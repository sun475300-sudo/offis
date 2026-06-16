import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CircuitBreaker', () => {
  let CircuitBreaker: typeof import('../services/CircuitBreaker').CircuitBreaker;
  let breaker: import('../services/CircuitBreaker').CircuitBreaker;

  beforeEach(async () => {
    vi.resetModules();
    ({ CircuitBreaker } = await import('../services/CircuitBreaker'));
    breaker = CircuitBreaker.getInstance();
  });

  it('opens after reaching failureThreshold', () => {
    breaker.registerCircuit('A', { failureThreshold: 3, successThreshold: 1, timeout: 1000, resetTimeout: 5000 });
    breaker.recordFailure('A');
    breaker.recordFailure('A');
    expect(breaker.getState('A')).toBe('closed');
    breaker.recordFailure('A');
    expect(breaker.getState('A')).toBe('open');
    expect(breaker.canExecute('A')).toBe(false);
  });

  // regression for fix(services): CircuitBreaker resets nextAttempt on half_open -> open
  it('half_open -> open resets nextAttempt so circuit is not immediately re-tried', () => {
    vi.useFakeTimers();
    try {
      breaker.registerCircuit('B', { failureThreshold: 1, successThreshold: 1, timeout: 1000, resetTimeout: 5000 });
      // Trip open
      breaker.recordFailure('B');
      expect(breaker.getState('B')).toBe('open');
      // Advance past resetTimeout to allow half_open transition
      vi.advanceTimersByTime(5001);
      expect(breaker.canExecute('B')).toBe(true);
      expect(breaker.getState('B')).toBe('half_open');
      // Fail in half_open — should transition back to open AND reset
      // nextAttempt so a follow-up canExecute remains false until
      // another full resetTimeout has elapsed.
      breaker.recordFailure('B');
      expect(breaker.getState('B')).toBe('open');
      expect(breaker.canExecute('B')).toBe(false);
      // Even after a short delay we must still be open.
      vi.advanceTimersByTime(100);
      expect(breaker.canExecute('B')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('successive successes close a half_open circuit', () => {
    vi.useFakeTimers();
    try {
      breaker.registerCircuit('C', { failureThreshold: 1, successThreshold: 2, timeout: 1000, resetTimeout: 1000 });
      breaker.recordFailure('C');
      vi.advanceTimersByTime(1001);
      breaker.canExecute('C');
      expect(breaker.getState('C')).toBe('half_open');
      breaker.recordSuccess('C');
      breaker.recordSuccess('C');
      expect(breaker.getState('C')).toBe('closed');
    } finally {
      vi.useRealTimers();
    }
  });
});
