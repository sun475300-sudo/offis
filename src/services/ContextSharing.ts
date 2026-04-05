export interface SharedContext {
  id: string;
  key: string;
  value: unknown;
  ownerId: string;
  scope: ContextScope;
  timestamp: number;
  expiresAt?: number;
}

export type ContextScope = 'private' | 'team' | 'global';

export interface ContextSubscription {
  contextKey: string;
  agentId: string;
  callback: (value: unknown) => void;
}

export interface ContextUpdate {
  key: string;
  value: unknown;
  scope: ContextScope;
}

export class ContextSharing {
  private static instance: ContextSharing;
  private contexts: Map<string, SharedContext> = new Map();
  private subscriptions: Map<string, Set<ContextSubscription>> = new Map();
  private defaultScope: ContextScope = 'team';

  private constructor() {}

  static getInstance(): ContextSharing {
    if (!ContextSharing.instance) {
      ContextSharing.instance = new ContextSharing();
    }
    return ContextSharing.instance;
  }

  setDefaultScope(scope: ContextScope): void {
    this.defaultScope = scope;
  }

  set(key: string, value: unknown, ownerId: string, scope?: ContextScope): SharedContext {
    const existing = Array.from(this.contexts.values())
      .find(c => c.key === key && c.scope === (scope || this.defaultScope));

    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
      this.notifySubscribers(key, value);
      return existing;
    }

    const context: SharedContext = {
      id: `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      key,
      value,
      ownerId,
      scope: scope || this.defaultScope,
      timestamp: Date.now()
    };

    this.contexts.set(key, context);
    this.notifySubscribers(key, value);
    return context;
  }

  get(key: string, scope?: ContextScope): unknown {
    const context = this.contexts.get(key);
    if (!context) return undefined;

    if (scope && context.scope !== scope) return undefined;
    return context.value;
  }

  getWithScope(key: string): { value: unknown; scope: ContextScope } | null {
    const context = this.contexts.get(key);
    if (!context) return null;
    return { value: context.value, scope: context.scope };
  }

  delete(key: string, requesterId: string): boolean {
    const context = this.contexts.get(key);
    if (!context) return false;
    if (context.scope === 'private' && context.ownerId !== requesterId) return false;

    this.contexts.delete(key);
    this.subscriptions.delete(key);
    return true;
  }

  share(contexts: ContextUpdate[], ownerId: string): SharedContext[] {
    return contexts.map(c => this.set(c.key, c.value, ownerId, c.scope));
  }

  subscribe(key: string, agentId: string, callback: (value: unknown) => void): () => void {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    const subscription: ContextSubscription = { contextKey: key, agentId, callback };
    this.subscriptions.get(key)!.add(subscription);

    return () => {
      this.subscriptions.get(key)?.delete(subscription);
    };
  }

  subscribeAll(agentId: string, callback: (key: string, value: unknown) => void): () => void {
    const allKeys = Array.from(this.contexts.keys());
    const unsubscribers: (() => void)[] = [];

    for (const key of allKeys) {
      unsubscribers.push(this.subscribe(key, agentId, (value) => callback(key, value)));
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }

  private notifySubscribers(key: string, value: unknown): void {
    const subs = this.subscriptions.get(key);
    if (subs) {
      for (const sub of subs) {
        sub.callback(value);
      }
    }
  }

  getAccessibleContexts(agentId: string, teamId?: string): SharedContext[] {
    return Array.from(this.contexts.values()).filter(c => {
      switch (c.scope) {
        case 'private':
          return c.ownerId === agentId;
        case 'team':
          return true;
        case 'global':
          return true;
        default:
          return false;
      }
    });
  }

  getTeamContexts(teamId: string): SharedContext[] {
    return Array.from(this.contexts.values()).filter(c => c.scope === 'team');
  }

  getGlobalContexts(): SharedContext[] {
    return Array.from(this.contexts.values()).filter(c => c.scope === 'global');
  }

  getStats(): { total: number; private: number; team: number; global: number } {
    const stats = { total: this.contexts.size, private: 0, team: 0, global: 0 };
    for (const context of this.contexts.values()) {
      stats[context.scope]++;
    }
    return stats;
  }

  clear(): void {
    this.contexts.clear();
    this.subscriptions.clear();
  }

  export(): string {
    return JSON.stringify(Array.from(this.contexts.values()), null, 2);
  }
}

export const contextSharing = ContextSharing.getInstance();