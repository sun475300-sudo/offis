import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager } from '../core/CacheManager';

describe('CacheManager LRU', () => {
  let cache: CacheManager<string, number>;

  beforeEach(() => {
    cache = new CacheManager<string, number>({
      maxSize: 3,
      defaultTTL: 60000,
      evictionPolicy: 'lru',
    });
  });

  it('evicts least-recently-used entry on overflow', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // touch 'a' so 'b' becomes LRU
    expect(cache.get('a')).toBe(1);
    cache.set('d', 4);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  // regression for fix(core): CacheManager.set skips eviction when updating existing key
  it('updating existing key does not evict', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // re-setting 'a' should not evict any other entry
    cache.set('a', 99);
    expect(cache.size()).toBe(3);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.get('a')).toBe(99);
  });

  it('expired entries are missed and removed', () => {
    vi.useFakeTimers();
    try {
      cache.set('a', 1, 1000);
      expect(cache.get('a')).toBe(1);
      vi.advanceTimersByTime(2000);
      expect(cache.get('a')).toBeNull();
      expect(cache.has('a')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stats track hits and misses', () => {
    cache.set('a', 1);
    cache.get('a');
    cache.get('b'); // miss
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5, 5);
  });
});

describe('CacheManager FIFO', () => {
  it('evicts oldest by timestamp', () => {
    vi.useFakeTimers();
    try {
      const fifo = new CacheManager<string, number>({
        maxSize: 2,
        defaultTTL: 60000,
        evictionPolicy: 'fifo',
      });
      fifo.set('a', 1);
      vi.advanceTimersByTime(10);
      fifo.set('b', 2);
      vi.advanceTimersByTime(10);
      // touching 'a' should NOT change its insertion timestamp under FIFO
      fifo.get('a');
      vi.advanceTimersByTime(10);
      fifo.set('c', 3);
      expect(fifo.has('a')).toBe(false);
      expect(fifo.has('b')).toBe(true);
      expect(fifo.has('c')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
