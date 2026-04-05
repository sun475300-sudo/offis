import { A2ATask } from './A2AProtocol';

export type DelegationStrategy = 'round_robin' | 'capability_match' | 'least_loaded' | 'random';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'delegated' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface DelegationRequest {
  taskId: string;
  description: string;
  requirements: string[];
  priority: TaskPriority;
  deadline?: number;
  input: Record<string, unknown>;
}

export interface DelegationResult {
  success: boolean;
  task?: A2ATask;
  agentId?: string;
  error?: string;
  reason?: string;
}

export interface DelegationStats {
  totalDelegations: number;
  successfulDelegations: number;
  failedDelegations: number;
  averageDelegationTime: number;
  byAgent: Record<string, number>;
}

export class TaskDelegation {
  private static instance: TaskDelegation;
  private agentLoads: Map<string, number> = new Map();
  private delegationHistory: { taskId: string; agentId: string; timestamp: number; success: boolean }[] = [];
  private defaultStrategy: DelegationStrategy = 'capability_match';
  private maxRetries = 3;

  private constructor() {}

  static getInstance(): TaskDelegation {
    if (!TaskDelegation.instance) {
      TaskDelegation.instance = new TaskDelegation();
    }
    return TaskDelegation.instance;
  }

  setStrategy(strategy: DelegationStrategy): void {
    this.defaultStrategy = strategy;
  }

  setMaxRetries(max: number): void {
    this.maxRetries = max;
  }

  async delegateTask(
    request: DelegationRequest,
    agentIds: string[],
    preferredAgent?: string
  ): Promise<DelegationResult> {
    if (agentIds.length === 0) {
      return { success: false, error: 'No available agents' };
    }

    const selectedAgentId = this.selectAgent(agentIds, preferredAgent);
    if (!selectedAgentId) {
      return { success: false, error: 'Failed to select agent' };
    }

    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < this.maxRetries) {
      try {
        this.incrementLoad(selectedAgentId);

        const task: A2ATask = {
          id: request.taskId,
          status: 'pending',
          agentId: selectedAgentId,
          input: request.input,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        this.delegationHistory.push({
          taskId: request.taskId,
          agentId: selectedAgentId,
          timestamp: Date.now(),
          success: true
        });

        this.decrementLoad(selectedAgentId);

        return {
          success: true,
          task,
          agentId: selectedAgentId
        };
      } catch (error) {
        attempts++;
        lastError = error instanceof Error ? error.message : String(error);
        this.decrementLoad(selectedAgentId);
      }
    }

    this.delegationHistory.push({
      taskId: request.taskId,
      agentId: selectedAgentId,
      timestamp: Date.now(),
      success: false
    });

    return {
      success: false,
      error: lastError,
      reason: `Failed after ${this.maxRetries} attempts`
    };
  }

  private selectAgent(agentIds: string[], preferredAgent?: string): string | null {
    if (preferredAgent && agentIds.includes(preferredAgent)) {
      return preferredAgent;
    }

    switch (this.defaultStrategy) {
      case 'round_robin':
        return this.selectRoundRobin(agentIds);
      case 'capability_match':
        return this.selectCapabilityMatch(agentIds);
      case 'least_loaded':
        return this.selectLeastLoaded(agentIds);
      case 'random':
        return agentIds[Math.floor(Math.random() * agentIds.length)];
      default:
        return agentIds[0];
    }
  }

  private selectRoundRobin(agentIds: string[]): string {
    const lastUsed = this.delegationHistory[this.delegationHistory.length - 1]?.agentId;
    if (!lastUsed || !agentIds.includes(lastUsed)) {
      return agentIds[0];
    }
    const idx = agentIds.indexOf(lastUsed);
    return agentIds[(idx + 1) % agentIds.length];
  }

  private selectCapabilityMatch(agentIds: string[]): string {
    return agentIds[Math.floor(Math.random() * agentIds.length)];
  }

  private selectLeastLoaded(agentIds: string[]): string {
    let minLoad = Infinity;
    let selected = agentIds[0];

    for (const agentId of agentIds) {
      const load = this.agentLoads.get(agentId) || 0;
      if (load < minLoad) {
        minLoad = load;
        selected = agentId;
      }
    }

    return selected;
  }

  private incrementLoad(agentId: string): void {
    const current = this.agentLoads.get(agentId) || 0;
    this.agentLoads.set(agentId, current + 1);
  }

  private decrementLoad(agentId: string): void {
    const current = this.agentLoads.get(agentId) || 0;
    this.agentLoads.set(agentId, Math.max(0, current - 1));
  }

  getAgentLoad(agentId: string): number {
    return this.agentLoads.get(agentId) || 0;
  }

  getAllLoads(): Record<string, number> {
    const loads: Record<string, number> = {};
    for (const [agentId, load] of this.agentLoads) {
      loads[agentId] = load;
    }
    return loads;
  }

  getStats(): DelegationStats {
    const stats: DelegationStats = {
      totalDelegations: this.delegationHistory.length,
      successfulDelegations: 0,
      failedDelegations: 0,
      averageDelegationTime: 0,
      byAgent: {}
    };

    let totalTime = 0;

    for (const entry of this.delegationHistory) {
      if (entry.success) {
        stats.successfulDelegations++;
      } else {
        stats.failedDelegations++;
      }
      stats.byAgent[entry.agentId] = (stats.byAgent[entry.agentId] || 0) + 1;
    }

    return stats;
  }

  cancelDelegation(taskId: string): boolean {
    const idx = this.delegationHistory.findIndex(e => e.taskId === taskId);
    if (idx >= 0) {
      const entry = this.delegationHistory[idx];
      this.decrementLoad(entry.agentId);
      return true;
    }
    return false;
  }

  clearHistory(): void {
    this.delegationHistory = [];
  }
}

export const taskDelegation = TaskDelegation.getInstance();