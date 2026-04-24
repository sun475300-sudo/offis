export type AuditAction = 
  | 'agent_create' | 'agent_delete' | 'agent_update'
  | 'task_create' | 'task_complete' | 'task_fail'
  | 'meeting_start' | 'meeting_end'
  | 'code_review' | 'debate_create'
  | 'config_change' | 'plugin_enable' | 'plugin_disable'
  | 'system_login' | 'system_logout';

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  success: boolean;
}

export interface AuditFilter {
  action?: AuditAction[];
  resourceType?: string;
  userId?: string;
  since?: number;
  until?: number;
  success?: boolean;
}

export interface AuditStats {
  total: number;
  byAction: Record<AuditAction, number>;
  byResource: Record<string, number>;
  successRate: number;
}

export class AuditTrail {
  private static instance: AuditTrail;
  private entries: AuditEntry[] = [];
  private maxEntries = 10000;
  private listeners: Set<(entry: AuditEntry) => void> = new Set();

  private constructor() {}

  static getInstance(): AuditTrail {
    if (!AuditTrail.instance) {
      AuditTrail.instance = new AuditTrail();
    }
    return AuditTrail.instance;
  }

  log(action: AuditAction, resourceType: string, resourceId?: string, details?: Record<string, unknown>): string {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entry: AuditEntry = {
      id,
      timestamp: Date.now(),
      action,
      resourceType,
      resourceId,
      details,
      success: true
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    for (const listener of this.listeners) {
      listener(entry);
    }

    return id;
  }

  logSuccess(action: AuditAction, resourceType: string, resourceId?: string, details?: Record<string, unknown>): string {
    return this.log(action, resourceType, resourceId, details);
  }

  logFailure(action: AuditAction, resourceType: string, resourceId: string | undefined, details: Record<string, unknown>): string {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entry: AuditEntry = {
      id,
      timestamp: Date.now(),
      action,
      resourceType,
      resourceId,
      details,
      success: false
    };

    this.entries.push(entry);
    // Match log() so the cap is enforced and subscribers still receive
    // failure entries — otherwise failures silently grow the array past
    // maxEntries and never reach any observer.
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    for (const listener of this.listeners) {
      listener(entry);
    }
    return id;
  }

  get(filter?: AuditFilter): AuditEntry[] {
    let result = this.entries;

    if (filter) {
      if (filter.action) {
        result = result.filter(e => filter.action!.includes(e.action));
      }
      if (filter.resourceType) {
        result = result.filter(e => e.resourceType === filter.resourceType);
      }
      if (filter.userId) {
        result = result.filter(e => e.userId === filter.userId);
      }
      if (filter.since) {
        result = result.filter(e => e.timestamp >= filter.since!);
      }
      if (filter.until) {
        result = result.filter(e => e.timestamp <= filter.until!);
      }
      if (filter.success !== undefined) {
        result = result.filter(e => e.success === filter.success);
      }
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  getStats(filter?: AuditFilter): AuditStats {
    const entries = filter ? this.get(filter) : this.entries;
    const stats: AuditStats = {
      total: entries.length,
      byAction: {} as Record<AuditAction, number>,
      byResource: {},
      successRate: 0
    };

    let successCount = 0;
    for (const entry of entries) {
      stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;
      stats.byResource[entry.resourceType] = (stats.byResource[entry.resourceType] || 0) + 1;
      if (entry.success) successCount++;
    }

    stats.successRate = entries.length > 0 ? successCount / entries.length : 0;
    return stats;
  }

  subscribe(listener: (entry: AuditEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  export(filter?: AuditFilter): string {
    const entries = filter ? this.get(filter) : this.entries;
    return JSON.stringify(entries, null, 2);
  }

  clear(): void {
    this.entries = [];
  }
}

export const auditTrail = AuditTrail.getInstance();