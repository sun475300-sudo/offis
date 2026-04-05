export type RecoveryAction = 'restart' | 'reset' | 'retry' | 'fallback' | 'migrate' | 'escalate' | 'compensate';
export type RecoveryStrategy = 'automatic' | 'manual' | 'hybrid';

export interface RecoveryRule {
  id: string;
  name: string;
  errorPattern: string | RegExp;
  action: RecoveryAction;
  maxAttempts: number;
  enabled: boolean;
}

export interface RecoveryEvent {
  id: string;
  agentId: string;
  ruleId: string;
  action: RecoveryAction;
  timestamp: number;
  success: boolean;
  details: string;
}

export interface RecoveryPlan {
  id: string;
  agentId: string;
  actions: RecoveryAction[];
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface SelfHealingConfig {
  enabled: boolean;
  maxConcurrentRecoveries: number;
  recoveryTimeout: number;
  autoEscalate: boolean;
}

export class SelfHealing {
  private static instance: SelfHealing;
  private rules: Map<string, RecoveryRule> = new Map();
  private events: RecoveryEvent[] = [];
  private activePlans: Map<string, RecoveryPlan> = new Map();
  private config: SelfHealingConfig = {
    enabled: true,
    maxConcurrentRecoveries: 5,
    recoveryTimeout: 60000,
    autoEscalate: true
  };
  private listeners: Set<(event: RecoveryEvent) => void> = new Set();
  private maxEvents = 300;

  private constructor() {
    this.registerDefaultRules();
  }

  static getInstance(): SelfHealing {
    if (!SelfHealing.instance) {
      SelfHealing.instance = new SelfHealing();
    }
    return SelfHealing.instance;
  }

  private registerDefaultRules(): void {
    this.addRule({
      name: 'Connection Timeout',
      errorPattern: /timeout|ETIMEDOUT/i,
      action: 'retry',
      maxAttempts: 3,
      enabled: true
    });

    this.addRule({
      name: 'Out of Memory',
      errorPattern: /memory|MEMORY/i,
      action: 'fallback',
      maxAttempts: 2,
      enabled: true
    });

    this.addRule({
      name: 'Agent Crash',
      errorPattern: /crash|dead|unavailable/i,
      action: 'restart',
      maxAttempts: 5,
      enabled: true
    });

    this.addRule({
      name: 'Task Failure',
      errorPattern: /failed|error/i,
      action: 'retry',
      maxAttempts: 3,
      enabled: true
    });
  }

  configure(config: Partial<SelfHealingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  addRule(rule: Omit<RecoveryRule, 'id'>): RecoveryRule {
    const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newRule: RecoveryRule = { ...rule, id };
    this.rules.set(id, newRule);
    return newRule;
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      return true;
    }
    return false;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      return true;
    }
    return false;
  }

  findMatchingRule(error: string): RecoveryRule | null {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      const pattern = typeof rule.errorPattern === 'string'
        ? new RegExp(rule.errorPattern, 'i')
        : rule.errorPattern;
      if (pattern.test(error)) {
        return rule;
      }
    }
    return null;
  }

  async recover(agentId: string, error: string): Promise<RecoveryEvent> {
    const rule = this.findMatchingRule(error);
    if (!rule) {
      return this.createEvent(agentId, 'none', 'escalate', false, 'No matching rule found');
    }

    const event = await this.executeRecovery(agentId, rule);
    return event;
  }

  private async executeRecovery(agentId: string, rule: RecoveryRule): Promise<RecoveryEvent> {
    let success = false;
    let details = '';

    for (let attempt = 1; attempt <= rule.maxAttempts; attempt++) {
      try {
        await this.performAction(rule.action, agentId);
        success = true;
        details = `Recovered after ${attempt} attempt(s)`;
        break;
      } catch (actionError) {
        details = `Attempt ${attempt} failed: ${actionError}`;
        await this.sleep(1000 * attempt);
      }
    }

    return this.createEvent(agentId, rule.id, rule.action, success, details);
  }

  private async performAction(action: RecoveryAction, agentId: string): Promise<void> {
    switch (action) {
      case 'restart':
        console.log(`[SelfHealing] Restarting agent ${agentId}...`);
        break;
      case 'reset':
        console.log(`[SelfHealing] Resetting agent ${agentId}...`);
        break;
      case 'retry':
        console.log(`[SelfHealing] Retrying for agent ${agentId}...`);
        break;
      case 'fallback':
        console.log(`[SelfHealing] Using fallback for agent ${agentId}...`);
        break;
      case 'migrate':
        console.log(`[SelfHealing] Migrating agent ${agentId}...`);
        break;
      case 'escalate':
        console.log(`[SelfHealing] Escalating for agent ${agentId}...`);
        break;
      case 'compensate':
        console.log(`[SelfHealing] Compensating for agent ${agentId}...`);
        break;
    }
  }

  private createEvent(agentId: string, ruleId: string, action: RecoveryAction, success: boolean, details: string): RecoveryEvent {
    const event: RecoveryEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId,
      ruleId,
      action,
      timestamp: Date.now(),
      success,
      details
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.shift();
    this.notifyListeners(event);
    return event;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  subscribe(listener: (event: RecoveryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: RecoveryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  getEvents(agentId?: string, limit = 50): RecoveryEvent[] {
    let events = this.events;
    if (agentId) {
      events = events.filter(e => e.agentId === agentId);
    }
    return events.slice(-limit);
  }

  getStats(): { total: number; successful: number; failed: number; byAction: Record<RecoveryAction, number> } {
    const stats = { total: this.events.length, successful: 0, failed: 0, byAction: {} as Record<RecoveryAction, number> };
    for (const event of this.events) {
      if (event.success) stats.successful++;
      else stats.failed++;
      stats.byAction[event.action] = (stats.byAction[event.action] || 0) + 1;
    }
    return stats;
  }

  clear(): void {
    this.events = [];
    this.activePlans.clear();
  }
}

export const selfHealing = SelfHealing.getInstance();