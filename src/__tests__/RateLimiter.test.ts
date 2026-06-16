import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('RateLimiter', () => {
  // Need fresh module each test for the singleton
  let RateLimiter: typeof import('../services/RateLimiter').RateLimiter;

  beforeEach(async () => {
    vi.resetModules();
    ({ RateLimiter } = await import('../services/RateLimiter'));
  });

  // regression for fix(services): RateLimiter.check counts the call that creates a window
  it('first call in a fresh window counts against the budget', () => {
    const rl = RateLimiter.getInstance();
    rl.configure('test-key', { maxRequests: 3, windowMs: 1000, scope: 'global' });
    const r1 = rl.check('test-key');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    rl.check('test-key');
    rl.check('test-key');
    // 4th call should be blocked
    expect(rl.check('test-key').allowed).toBe(false);
  });

  // regression for fix(services): RateLimiter.consume no longer double-counts
  it('consume(N) deducts exactly N from the budget', () => {
    const rl = RateLimiter.getInstance();
    rl.configure('consume-key', { maxRequests: 10, windowMs: 60000, scope: 'global' });
    expect(rl.consume('consume-key', 5)).toBe(true);
    expect(rl.getRemaining('consume-key')).toBe(5);
    expect(rl.consume('consume-key', 5)).toBe(true);
    expect(rl.getRemaining('consume-key')).toBe(0);
    expect(rl.consume('consume-key', 1)).toBe(false);
  });

  it('blocks once maxRequests is exceeded and unblocks after window', () => {
    vi.useFakeTimers();
    try {
      const rl = RateLimiter.getInstance();
      rl.configure('window-key', { maxRequests: 2, windowMs: 1000, scope: 'global' });
      expect(rl.check('window-key').allowed).toBe(true);
      expect(rl.check('window-key').allowed).toBe(true);
      expect(rl.check('window-key').allowed).toBe(false);
      vi.advanceTimersByTime(1100);
      const after = rl.check('window-key');
      expect(after.allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
