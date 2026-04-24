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

  // Debounced handle for the auto-persist timer. localStorage writes are
  // synchronous and can stall the main thread, so batch them instead of
  // firing on every save() call.
  private persistHandle: number | null = null;
  private schedulePersist(): void {
    if (typeof window === 'undefined') return;
    if (this.persistHandle !== null) return;
    this.persistHandle = window.setTimeout(() => {
      this.persistHandle = null;
      void this.saveToStorage();
    }, 250);
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
    // Previously only saved on beforeunload; a mid-session tab crash or
    // force-reload lost every write since load. Schedule a debounced
    // flush so recent data survives.
    this.schedulePersist();

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
    // Deep-clone states so future save()s don't retroactively mutate
    // the snapshot (save() updates the same PersistedState object in
    // place when an id already exists).
    const snappedStates: PersistedState[] = Array.from(this.storage.values())
      .map(s => JSON.parse(JSON.stringify(s)) as PersistedState);
    const snapshot: StateSnapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      states: snappedStates,
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
      const toRemove = this.storage.size - this.maxStates;
      for (let i = 0; i < toRemove; i++) {
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
      if (!data || typeof data !== 'object') return false;
      if (!Array.isArray(data.states)) return false;
      // Validate each state has at least an id before blowing away the
      // live storage. Without this check a malformed payload set
      // `undefined` as a Map key and corrupted all subsequent loads.
      const parsed: PersistedState[] = [];
      for (const state of data.states) {
        if (!state || typeof state !== 'object') continue;
        if (typeof state.id !== 'string' || typeof state.type !== 'string') continue;
        parsed.push(state as PersistedState);
      }
      this.storage.clear();
      for (const state of parsed) {
        this.storage.set(state.id, state);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const statePersistence = StatePersistence.getInstance();