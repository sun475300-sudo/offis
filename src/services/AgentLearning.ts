export type LearningType = 'reinforcement' | 'supervised' | 'imitation' | 'meta';

export interface LearningRecord {
  id: string;
  agentId: string;
  type: LearningType;
  input: unknown;
  output: unknown;
  feedback?: number;
  timestamp: number;
  success: boolean;
}

export interface ModelUpdate {
  parameter: string;
  oldValue: unknown;
  newValue: unknown;
  delta: number;
}

export interface LearningStats {
  agentId: string;
  totalRecords: number;
  successRate: number;
  avgFeedback: number;
  lastUpdated: number;
}

export interface TrainingConfig {
  type: LearningType;
  batchSize: number;
  learningRate: number;
  maxIterations: number;
}

export class AgentLearning {
  private static instance: AgentLearning;
  private records: Map<string, LearningRecord[]> = new Map();
  private models: Map<string, Record<string, unknown>> = new Map();
  private trainingQueue: { agentId: string; config: TrainingConfig }[] = [];

  private constructor() {}

  static getInstance(): AgentLearning {
    if (!AgentLearning.instance) {
      AgentLearning.instance = new AgentLearning();
    }
    return AgentLearning.instance;
  }

  record(agentId: string, type: LearningType, input: unknown, output: unknown, success: boolean, feedback?: number): LearningRecord {
    if (!this.records.has(agentId)) {
      this.records.set(agentId, []);
    }

    const record: LearningRecord = {
      id: `lrn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId,
      type,
      input,
      output,
      feedback,
      timestamp: Date.now(),
      success
    };

    this.records.get(agentId)!.push(record);
    this.pruneRecords(agentId);

    if (success || feedback !== undefined) {
      this.updateModel(agentId, type, record);
    }

    return record;
  }

  private pruneRecords(agentId: string): void {
    const records = this.records.get(agentId);
    if (!records) return;

    if (records.length > 1000) {
      records.splice(0, records.length - 1000);
    }
  }

  private updateModel(agentId: string, type: LearningType, record: LearningRecord): void {
    if (!this.models.has(agentId)) {
      this.models.set(agentId, {
        type,
        successCount: 0,
        totalCount: 0,
        feedbackCount: 0,
        avgFeedback: 0,
        lastUpdated: Date.now()
      });
    }

    const model = this.models.get(agentId)!;
    model.totalCount = (model.totalCount as number) + 1;
    if (record.success) {
      model.successCount = (model.successCount as number) + 1;
    }
    if (record.feedback !== undefined) {
      // Track feedbackCount independently; previously the running average
      // used totalCount, so records submitted without feedback still
      // "diluted" the average to zero.
      const prevFeedbackCount = (model.feedbackCount as number) ?? 0;
      const newFeedbackCount = prevFeedbackCount + 1;
      const currentAvg = model.avgFeedback as number;
      model.avgFeedback = (currentAvg * prevFeedbackCount + record.feedback) / newFeedbackCount;
      model.feedbackCount = newFeedbackCount;
    }
    model.lastUpdated = Date.now();
  }

  getRecords(agentId: string, limit = 100): LearningRecord[] {
    const records = this.records.get(agentId) || [];
    return records.slice(-limit);
  }

  getRecordsByType(agentId: string, type: LearningType): LearningRecord[] {
    const records = this.records.get(agentId) || [];
    return records.filter(r => r.type === type);
  }

  getModel(agentId: string): Record<string, unknown> | undefined {
    return this.models.get(agentId);
  }

  getStats(agentId: string): LearningStats | null {
    const records = this.records.get(agentId);
    if (!records || records.length === 0) return null;

    const successCount = records.filter(r => r.success).length;
    const feedbackSum = records.reduce((sum, r) => sum + (r.feedback || 0), 0);
    const feedbackCount = records.filter(r => r.feedback !== undefined).length;

    return {
      agentId,
      totalRecords: records.length,
      successRate: successCount / records.length,
      avgFeedback: feedbackCount > 0 ? feedbackSum / feedbackCount : 0,
      lastUpdated: records[records.length - 1].timestamp
    };
  }

  evaluate(agentId: string, input: unknown): { prediction: unknown; confidence: number } {
    const model = this.models.get(agentId);
    if (!model) {
      return { prediction: null, confidence: 0 };
    }

    const successRate = (model.successCount as number) / (model.totalCount as number || 1);
    const confidence = Math.min(successRate * 2, 1);

    return {
      prediction: input,
      confidence
    };
  }

  train(agentId: string, config: TrainingConfig): void {
    this.trainingQueue.push({ agentId, config });
  }

  getTrainingQueue(): { agentId: string; config: TrainingConfig }[] {
    return [...this.trainingQueue];
  }

  clearRecords(agentId: string): boolean {
    return this.records.delete(agentId);
  }

  clearModels(): void {
    this.models.clear();
  }

  getAllAgentStats(): LearningStats[] {
    const stats: LearningStats[] = [];
    for (const agentId of this.records.keys()) {
      const agentStats = this.getStats(agentId);
      if (agentStats) stats.push(agentStats);
    }
    return stats;
  }

  export(): string {
    const data: Record<string, unknown> = {};
    for (const [agentId, records] of this.records) {
      data[agentId] = { records, model: this.models.get(agentId) };
    }
    return JSON.stringify(data, null, 2);
  }

  import(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return false;

      // Stage valid entries before mutating state. Previously a single
      // malformed key could leave records in a half-imported state.
      const staged = new Map<string, { records: LearningRecord[]; model?: Record<string, unknown> }>();
      for (const [agentId, agentData] of Object.entries(data)) {
        if (!agentData || typeof agentData !== 'object') continue;
        const ad = agentData as { records?: unknown; model?: unknown };
        if (!Array.isArray(ad.records)) continue;
        staged.set(agentId, {
          records: ad.records as LearningRecord[],
          model: (ad.model && typeof ad.model === 'object') ? ad.model as Record<string, unknown> : undefined,
        });
      }

      this.records.clear();
      this.models.clear();
      for (const [agentId, entry] of staged) {
        this.records.set(agentId, entry.records);
        if (entry.model) this.models.set(agentId, entry.model);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const agentLearning = AgentLearning.getInstance();