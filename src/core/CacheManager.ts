export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  evictionPolicy: 'lru' | 'fifo' | 'lfu';
  enableStats: boolean;
}

export class CacheManager<K extends string = string, V = unknown> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private config: CacheConfig;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 100,
      defaultTTL: config.defaultTTL || 60000,
      evictionPolicy: config.evictionPolicy || 'lru',
      enableStats: config.enableStats ?? true
    };
  }

  set(key: K, value: V, ttl?: number): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      hits: 0
    });
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    // LRU: reinsert to move to the end of insertion order
    if (this.config.evictionPolicy === 'lru') {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
    return entry.value;
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private isExpired(entry: CacheEntry<V>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evict(): void {
    let keyToRemove: K | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Oldest in Map insertion order is the least-recently-used entry,
        // because get() re-inserts on access.
        keyToRemove = this.cache.keys().next().value ?? null;
        break;

      case 'fifo':
        let oldest = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.timestamp < oldest) {
            oldest = entry.timestamp;
            keyToRemove = key;
          }
        }
        break;

      case 'lfu':
        let minHitsLFU = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.hits < minHitsLFU) {
            minHitsLFU = entry.hits;
            keyToRemove = key;
          }
        }
        break;
    }

    if (keyToRemove) {
      this.cache.delete(keyToRemove);
      this.stats.evictions++;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  cleanup(): number {
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }
}

export const defaultCache = new CacheManager();