export type AdaptationTrigger = 'performance_drop' | 'error_rate' | 'latency' | 'resource_usage' | 'manual';
export type AdaptationAction = 'scale' | 'retry' | 'fallback' | 'migrate' | 'alert' | 'optimize';
export type AdaptationStatus = 'idle' | 'detecting' | 'analyzing' | 'adapting' | 'completed' | 'failed';

export interface AdaptationRule {
  id: string;
  name: string;
  trigger: AdaptationTrigger;
  threshold: number;
  action: AdaptationAction;
  params?: Record<string, unknown>;
  enabled: boolean;
}

export interface AdaptationEvent {
  id: string;
  ruleId: string;
  trigger: AdaptationTrigger;
  timestamp: number;
  beforeState: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  success: boolean;
  error?: string;
}

export interface AdaptationPlan {
  id: string;
  agentId: string;
  actions: AdaptationAction[];
  priority: number;
  estimatedImpact: number;
}

export interface AdaptationStats {
  totalEvents: number;
  successfulAdaptations: number;
  failedAdaptations: number;
  byTrigger: Record<AdaptationTrigger, number>;
  byAction: Record<AdaptationAction, number>;
}

export class AdaptationEngine {
  private static instance: AdaptationEngine;
  private rules: Map<string, AdaptationRule> = new Map();
  private events: AdaptationEvent[] = [];
  private activePlans: Map<string, AdaptationPlan> = new Map();
  private monitoringEnabled = false;
  private checkInterval: number | null = null;
  private maxEvents = 500;

  private constructor() {
    this.registerDefaultRules();
  }

  static getInstance(): AdaptationEngine {
    if (!AdaptationEngine.instance) {
      AdaptationEngine.instance = new AdaptationEngine();
    }
    return AdaptationEngine.instance;
  }

  private registerDefaultRules(): void {
    this.addRule({
      name: 'High Error Rate',
      trigger: 'error_rate',
      threshold: 0.1,
      action: 'retry',
      enabled: true
    });

    this.addRule({
      name: 'High Latency',
      trigger: 'latency',
      threshold: 1000,
      action: 'optimize',
      enabled: true
    });

    this.addRule({
      name: 'Low Performance',
      trigger: 'performance_drop',
      threshold: 0.5,
      action: 'fallback',
      enabled: true
    });

    this.addRule({
      name: 'High Resource Usage',
      trigger: 'resource_usage',
      threshold: 0.9,
      action: 'scale',
      enabled: true
    });
  }

  addRule(rule: Omit<AdaptationRule, 'id'>): AdaptationRule {
    const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newRule: AdaptationRule = { ...rule, id };
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

  getRule(ruleId: string): AdaptationRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): AdaptationRule[] {
    return Array.from(this.rules.values());
  }

  checkConditions(metrics: Record<string, number>): AdaptationEvent[] {
    const triggered: AdaptationEvent[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const value = metrics[rule.trigger];
      if (value !== undefined && value >= rule.threshold) {
        const event = this.triggerAdaptation(rule, metrics);
        triggered.push(event);
      }
    }

    return triggered;
  }

  private triggerAdaptation(rule: AdaptationRule, metrics: Record<string, number>): AdaptationEvent {
    const event: AdaptationEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      ruleId: rule.id,
      trigger: rule.trigger,
      timestamp: Date.now(),
      beforeState: { ...metrics },
      success: false
    };

    try {
      this.executeAction(rule.action, rule.params);
      event.afterState = { ...metrics };
      event.success = true;
    } catch (error) {
      event.error = error instanceof Error ? error.message : String(error);
    }

    this.events.push(event);
    this.pruneEvents();
    return event;
  }

  private executeAction(action: AdaptationAction, params?: Record<string, unknown>): void {
    switch (action) {
      case 'retry':
        console.log('[Adaptation] Retrying operation...');
        break;
      case 'fallback':
        console.log('[Adaptation] Using fallback strategy...');
        break;
      case 'scale':
        console.log('[Adaptation] Scaling resource...', params);
        break;
      case 'optimize':
        console.log('[Adaptation] Optimizing...', params);
        break;
      case 'migrate':
        console.log('[Adaptation] Migrating...', params);
        break;
      case 'alert':
        console.log('[Adaptation] Sending alert...', params);
        break;
    }
  }

  createPlan(agentId: string, actions: AdaptationAction[], priority = 0): AdaptationPlan {
    const plan: AdaptationPlan = {
      id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId,
      actions,
      priority,
      estimatedImpact: actions.length * 0.1
    };
    this.activePlans.set(plan.id, plan);
    return plan;
  }

  executePlan(planId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;

    for (const action of plan.actions) {
      this.executeAction(action);
    }

    return true;
  }

  cancelPlan(planId: string): boolean {
    return this.activePlans.delete(planId);
  }

  getActivePlans(): AdaptationPlan[] {
    return Array.from(this.activePlans.values());
  }

  getEvents(limit = 100): AdaptationEvent[] {
    return this.events.slice(-limit);
  }

  getEventsByRule(ruleId: string): AdaptationEvent[] {
    return this.events.filter(e => e.ruleId === ruleId);
  }

  getStats(): AdaptationStats {
    const stats: AdaptationStats = {
      totalEvents: this.events.length,
      successfulAdaptations: 0,
      failedAdaptations: 0,
      byTrigger: {} as Record<AdaptationTrigger, number>,
      byAction: {} as Record<AdaptationAction, number>
    };

    for (const event of this.events) {
      if (event.success) stats.successfulAdaptations++;
      else stats.failedAdaptations++;
      stats.byTrigger[event.trigger] = (stats.byTrigger[event.trigger] || 0) + 1;
    }

    return stats;
  }

  private pruneEvents(): void {
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  startMonitoring(intervalMs = 5000, getMetrics: () => Record<string, number>): void {
    this.monitoringEnabled = true;
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = window.setInterval(() => {
      const metrics = getMetrics();
      this.checkConditions(metrics);
    }, intervalMs);
  }

  stopMonitoring(): void {
    this.monitoringEnabled = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  isMonitoring(): boolean {
    return this.monitoringEnabled;
  }

  clear(): void {
    this.events = [];
    this.activePlans.clear();
  }
}

export const adaptationEngine = AdaptationEngine.getInstance();