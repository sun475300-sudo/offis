export type RateLimitScope = 'global' | 'per_agent' | 'per_api';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  scope: RateLimitScope;
}

export interface RateLimitRecord {
  key: string;
  count: number;
  resetTime: number;
  blocked: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  retryAfter?: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limits: Map<string, RateLimitConfig> = new Map();
  private records: Map<string, RateLimitRecord> = new Map();
  private waiting: Map<string, number[]> = new Map();
  private listeners: Set<(key: string, allowed: boolean) => void> = new Set();

  private constructor() {
    this.setDefaultLimits();
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  private setDefaultLimits(): void {
    this.limits.set('global', { maxRequests: 100, windowMs: 60000, scope: 'global' });
    this.limits.set('github_api', { maxRequests: 50, windowMs: 60000, scope: 'per_api' });
    this.limits.set('openai_api', { maxRequests: 60, windowMs: 60000, scope: 'per_api' });
    this.limits.set('agent_task', { maxRequests: 10, windowMs: 10000, scope: 'per_agent' });
  }

  configure(key: string, config: Partial<RateLimitConfig>): void {
    const existing = this.limits.get(key) || { maxRequests: 10, windowMs: 10000, scope: 'global' };
    this.limits.set(key, { ...existing, ...config });
  }

  check(key: string): RateLimitResult {
    const config = this.limits.get(key);
    if (!config) {
      return { allowed: true, remaining: Infinity, resetIn: 0 };
    }

    const record = this.records.get(key);
    const now = Date.now();

    if (!record || now >= record.resetTime) {
      const newRecord: RateLimitRecord = {
        key,
        count: 0,
        resetTime: now + config.windowMs,
        blocked: false
      };
      this.records.set(key, newRecord);
      return { allowed: true, remaining: config.maxRequests, resetIn: config.windowMs };
    }

    if (record.blocked) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: record.resetTime - now,
        retryAfter: record.resetTime - now
      };
    }

    if (record.count >= config.maxRequests) {
      record.blocked = true;
      this.notifyListeners(key, false);
      return {
        allowed: false,
        remaining: 0,
        resetIn: record.resetTime - now,
        retryAfter: record.resetTime - now
      };
    }

    record.count++;
    this.notifyListeners(key, true);

    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetIn: record.resetTime - now
    };
  }

  async throttle<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const result = this.check(key);
    
    if (!result.allowed && result.retryAfter) {
      await new Promise(resolve => setTimeout(resolve, result.retryAfter));
      return this.throttle(key, fn);
    }

    return fn();
  }

  consume(key: string, amount = 1): boolean {
    const result = this.check(key);
    if (!result.allowed) return false;

    const record = this.records.get(key);
    if (record) {
      record.count += amount;
    }
    return true;
  }

  reset(key: string): boolean {
    this.records.delete(key);
    return true;
  }

  resetAll(): void {
    this.records.clear();
  }

  getRemaining(key: string): number {
    const config = this.limits.get(key);
    const record = this.records.get(key);
    if (!config || !record) return config?.maxRequests || 0;
    return Math.max(0, config.maxRequests - record.count);
  }

  getResetTime(key: string): number | null {
    const record = this.records.get(key);
    return record?.resetTime || null;
  }

  isBlocked(key: string): boolean {
    const record = this.records.get(key);
    return record?.blocked || false;
  }

  waitForAvailability(key: string, timeoutMs = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        const result = this.check(key);
        
        if (result.allowed) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error('Rate limit wait timeout'));
        }
      }, 100);
    });
  }

  subscribe(listener: (key: string, allowed: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(key: string, allowed: boolean): void {
    for (const listener of this.listeners) {
      listener(key, allowed);
    }
  }

  getStats(): { totalLimits: number; activeRecords: number; blocked: number } {
    let blocked = 0;
    for (const record of this.records.values()) {
      if (record.blocked) blocked++;
    }
    return {
      totalLimits: this.limits.size,
      activeRecords: this.records.size,
      blocked
    };
  }

  getAllKeys(): string[] {
    return Array.from(this.limits.keys());
  }
}

export const rateLimiter = RateLimiter.getInstance();