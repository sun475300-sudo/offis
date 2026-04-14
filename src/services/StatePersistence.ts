export interface PersistedState {
  id: string;
  type: StateType;
  data: Record<string, unknown>;
  version: number;
  createdAt: number;
  updatedAt: number;
  checksum?: string;
}

export type StateType = 'agent' | 'task' | 'workflow' | 'session' | 'configuration';

export interface StateSnapshot {
  id: string;
  timestamp: number;
  states: PersistedState[];
  metadata?: Record<string, unknown>;
}

export interface StateQuery {
  type?: StateType;
  since?: number;
  until?: number;
  limit?: number;
}

export class StatePersistence {
  private static instance: StatePersistence;
  private storage: Map<string, PersistedState> = new Map();
  private snapshots: StateSnapshot[] = [];
  private maxStates = 5000;
  private maxSnapshots = 50;
  private listeners: Set<(state: PersistedState) => void> = new Set();

  private constructor() {
    this.loadFromStorage();
    window.addEventListener('beforeunload', () => this.saveToStorage());
  }

  static getInstance(): StatePersistence {
    if (!StatePersistence.instance) {
      StatePersistence.instance = new StatePersistence();
    }
    return StatePersistence.instance;
  }

  save(type: StateType, id: string, data: Record<string, unknown>): PersistedState {
    const key = `${type}-${id}`;
    const existing = this.storage.get(key);

    const state: PersistedState = {
      id: key,
      type,
      data,
      version: (existing?.version || 0) + 1,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      checksum: this.generateChecksum(data)
    };

    this.storage.set(key, state);
    this.cleanup();
    this.notifyListeners(state);

    return state;
  }

  load(type: StateType, id: string): PersistedState | null {
    const key = `${type}-${id}`;
    return this.storage.get(key) || null;
  }

  delete(type: StateType, id: string): boolean {
    const key = `${type}-${id}`;
    return this.storage.delete(key);
  }

  query(filter: StateQuery): PersistedState[] {
    let results = Array.from(this.storage.values());

    if (filter.type) {
      results = results.filter(s => s.type === filter.type);
    }
    if (filter.since) {
      results = results.filter(s => s.updatedAt >= filter.since!);
    }
    if (filter.until) {
      results = results.filter(s => s.updatedAt <= filter.until!);
    }

    results.sort((a, b) => b.updatedAt - a.updatedAt);

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  createSnapshot(metadata?: Record<string, unknown>): StateSnapshot {
    const snapshot: StateSnapshot = {
      id: `snapshot-${Date.now()}`,
      timestamp: Date.now(),
      states: Array.from(this.storage.values()),
      metadata
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return false;

    this.storage.clear();
    for (const state of snapshot.states) {
      this.storage.set(state.id, state);
    }

    return true;
  }

  getSnapshot(snapshotId: string): StateSnapshot | null {
    return this.snapshots.find(s => s.id === snapshotId) || null;
  }

  getAllSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  getStats(): { total: number; byType: Record<StateType, number>; snapshots: number } {
    const stats = { total: this.storage.size, byType: {} as Record<StateType, number>, snapshots: this.snapshots.length };

    for (const state of this.storage.values()) {
      stats.byType[state.type] = (stats.byType[state.type] || 0) + 1;
    }

    return stats;
  }

  subscribe(listener: (state: PersistedState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(state: PersistedState): void {
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private generateChecksum(data: Record<string, unknown>): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private cleanup(): void {
    if (this.storage.size > this.maxStates) {
      const sorted = Array.from(this.storage.values())
        .sort((a, b) => a.updatedAt - b.updatedAt);
      for (let i = 0; i < this.storage.size - this.maxStates; i++) {
        this.storage.delete(sorted[i].id);
      }
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const data = JSON.stringify({
        states: Array.from(this.storage.values()),
        snapshots: this.snapshots
      });
      localStorage.setItem('offis-state', data);
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const data = localStorage.getItem('offis-state');
      if (data) {
        const parsed = JSON.parse(data);
        
        // Precise Error Check: Validate structure before applying
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.states)) {
          for (const state of parsed.states) {
            if (state.id && state.type && state.data) {
              this.storage.set(state.id, state);
            }
          }
        }
        
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.snapshots)) {
          this.snapshots = parsed.snapshots.filter((s: any) => s.id && Array.isArray(s.states));
        }
      }
    } catch (e) {
      console.warn('[StatePersistence] Failed to load or validate state — resetting:', e);
      this.clear(); // Reset to prevent persistent crashes
    }
  }

  clear(): void {
    this.storage.clear();
    this.snapshots = [];
  }

  export(): string {
    return JSON.stringify({
      states: Array.from(this.storage.values()),
      snapshots: this.snapshots
    }, null, 2);
  }

  import(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.states) {
        this.storage.clear();
        for (const state of data.states) {
          this.storage.set(state.id, state);
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const statePersistence = StatePersistence.getInstance();