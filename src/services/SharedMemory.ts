export type MemoryType = 'episodic' | 'semantic' | 'working' | 'shared';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: unknown;
  sourceAgentId: string;
  tags: string[];
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: Record<string, unknown>;
}

export interface SharedMemoryOptions {
  maxEntries?: number;
  defaultTTL?: number;
  syncInterval?: number;
}

export interface MemoryQuery {
  type?: MemoryType;
  tags?: string[];
  sourceAgentId?: string;
  since?: number;
  until?: number;
  limit?: number;
}

export class SharedMemory {
  private static instance: SharedMemory;
  private entries: Map<string, MemoryEntry> = new Map();
  private options: Required<SharedMemoryOptions>;
  private listeners: Set<(entry: MemoryEntry) => void> = new Set();
  private syncInterval: number | null = null;

  private constructor(options: SharedMemoryOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries || 1000,
      defaultTTL: options.defaultTTL || 3600000,
      syncInterval: options.syncInterval || 5000
    };
  }

  static getInstance(options?: SharedMemoryOptions): SharedMemory {
    if (!SharedMemory.instance) {
      SharedMemory.instance = new SharedMemory(options);
    }
    return SharedMemory.instance;
  }

  write(
    type: MemoryType,
    content: unknown,
    sourceAgentId: string,
    options?: { tags?: string[]; ttl?: number; metadata?: Record<string, unknown> }
  ): MemoryEntry {
    const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entry: MemoryEntry = {
      id,
      type,
      content,
      sourceAgentId,
      tags: options?.tags || [],
      timestamp: Date.now(),
      expiresAt: options?.ttl ? Date.now() + options.ttl : Date.now() + this.options.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
      metadata: options?.metadata
    };

    this.entries.set(id, entry);
    this.cleanup();
    this.notifyListeners(entry);

    return entry;
  }

  read(id: string): MemoryEntry | null {
    const entry = this.entries.get(id);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.entries.delete(id);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    return entry;
  }

  query(filter: MemoryQuery): MemoryEntry[] {
    let results = Array.from(this.entries.values());

    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(e =>
        filter.tags!.some(tag => e.tags.includes(tag))
      );
    }
    if (filter.sourceAgentId) {
      results = results.filter(e => e.sourceAgentId === filter.sourceAgentId);
    }
    if (filter.since) {
      results = results.filter(e => e.timestamp >= filter.since!);
    }
    if (filter.until) {
      results = results.filter(e => e.timestamp <= filter.until!);
    }

    results.sort((a, b) => b.lastAccessed - a.lastAccessed);

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  search(keywords: string[], limit = 10): MemoryEntry[] {
    const query: MemoryQuery = { limit };
    const results: MemoryEntry[] = [];

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const matches = this.query(query).filter(e => {
        const contentStr = JSON.stringify(e.content).toLowerCase();
        return contentStr.includes(keywordLower) || e.tags.some(t => t.toLowerCase().includes(keywordLower));
      });
      results.push(...matches);
    }

    return [...new Map(results.map(e => [e.id, e])).values()]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  deleteByAgent(agentId: string): number {
    let count = 0;
    for (const [id, entry] of this.entries) {
      if (entry.sourceAgentId === agentId) {
        this.entries.delete(id);
        count++;
      }
    }
    return count;
  }

  subscribe(listener: (entry: MemoryEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(entry: MemoryEntry): void {
    for (const listener of this.listeners) {
      listener(entry);
    }
  }

  private cleanup(): void {
    if (this.entries.size > this.options.maxEntries) {
      const sorted = Array.from(this.entries.values())
        .sort((a, b) => a.lastAccessed - b.lastAccessed);
      const toRemove = this.entries.size - this.options.maxEntries;
      for (let i = 0; i < toRemove; i++) {
        this.entries.delete(sorted[i].id);
      }
    }

    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.entries.delete(id);
      }
    }
  }

  getStats(): { total: number; byType: Record<MemoryType, number>; totalAccesses: number } {
    const stats = { total: this.entries.size, byType: {} as Record<MemoryType, number>, totalAccesses: 0 };
    for (const entry of this.entries.values()) {
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
      stats.totalAccesses += entry.accessCount;
    }
    return stats;
  }

  export(): string {
    return JSON.stringify(Array.from(this.entries.values()), null, 2);
  }

  import(json: string): boolean {
    try {
      const data = JSON.parse(json);
      this.entries.clear();
      for (const entry of data) {
        this.entries.set(entry.id, entry);
      }
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

export const sharedMemory = SharedMemory.getInstance();