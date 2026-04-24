export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';
export type DecompositionStrategy = 'sequential' | 'parallel' | 'hierarchical' | 'mixed';
export type SubTaskStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'blocked';

export interface TaskDecomposition {
  id: string;
  originalTask: string;
  complexity: TaskComplexity;
  strategy: DecompositionStrategy;
  subTasks: SubTask[];
  createdAt: number;
  completedAt?: number;
}

export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  status: SubTaskStatus;
  assignedAgentId?: string;
  priority: number;
  estimatedDuration?: number;
  actualDuration?: number;
  result?: unknown;
  error?: string;
}

export interface DecompositionResult {
  success: boolean;
  decomposition?: TaskDecomposition;
  reason?: string;
}

export class TaskDecomposer {
  private static instance: TaskDecomposer;
  private decompositions: Map<string, TaskDecomposition> = new Map();
  private maxHistory = 100;

  private constructor() {}

  static getInstance(): TaskDecomposer {
    if (!TaskDecomposer.instance) {
      TaskDecomposer.instance = new TaskDecomposer();
    }
    return TaskDecomposer.instance;
  }

  decompose(task: string, strategy: DecompositionStrategy = 'mixed'): DecompositionResult {
    const complexity = this.assessComplexity(task);
    const subTasks = this.generateSubTasks(task, complexity, strategy);

    const decomposition: TaskDecomposition = {
      id: `decomp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalTask: task,
      complexity,
      strategy,
      subTasks,
      createdAt: Date.now()
    };

    this.decompositions.set(decomposition.id, decomposition);
    this.cleanup();

    return { success: true, decomposition };
  }

  private assessComplexity(task: string): TaskComplexity {
    const words = task.split(/\s+/).length;
    const hasConditionals = /\b(if|else|when|unless|or|and)\b/i.test(task);
    const hasLoops = /\b(loop|repeat|iterate|while|for each)\b/i.test(task);
    const hasMultipleSteps = /step\d|1\)|2\)|3\)|first|then|next|finally/i.test(task);

    let score = 0;
    if (words > 20) score++;
    if (words > 50) score++;
    if (hasConditionals) score++;
    if (hasLoops) score++;
    if (hasMultipleSteps) score++;

    if (score <= 1) return 'simple';
    if (score <= 2) return 'moderate';
    if (score <= 4) return 'complex';
    return 'very_complex';
  }

  private generateSubTasks(task: string, complexity: TaskComplexity, strategy: DecompositionStrategy): SubTask[] {
    const subTasks: SubTask[] = [];
    let count: number;

    switch (complexity) {
      case 'simple':
        count = 1;
        break;
      case 'moderate':
        count = 2 + Math.floor(Math.random() * 2);
        break;
      case 'complex':
        count = 4 + Math.floor(Math.random() * 3);
        break;
      case 'very_complex':
        count = 6 + Math.floor(Math.random() * 4);
        break;
      default:
        count = 3;
    }

    const keywords = this.extractKeywords(task);

    for (let i = 0; i < count; i++) {
      const subtaskId = `sub-${i}`;
      const dependencies: string[] = [];

      if (strategy === 'sequential' || strategy === 'hierarchical') {
        if (i > 0) {
          dependencies.push(`sub-${i - 1}`);
        }
      } else if (strategy === 'mixed' && i >= Math.ceil(count / 2)) {
        dependencies.push(`sub-${Math.floor(i / 2)}`);
      }

      subTasks.push({
        id: subtaskId,
        description: this.generateSubtaskDescription(keywords, i, count),
        dependencies,
        status: 'pending',
        priority: count - i
      });
    }

    return subTasks;
  }

  private extractKeywords(task: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'to', 'for', 'of', 'in', 'on', 'with', 'by']);
    return task.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  private generateSubtaskDescription(keywords: string[], index: number, total: number): string {
    const templates = [
      `Analyze and understand ${keywords.slice(0, 2).join(' ')}`,
      `Implement core functionality for ${keywords[0] || 'task'}`,
      `Handle edge cases and validation`,
      `Test and verify the implementation`,
      `Document and report results`,
      `Review and refine the solution`,
      `Optimize performance`,
      `Handle errors and recovery`
    ];
    return templates[index % templates.length];
  }

  updateSubTask(decompositionId: string, subTaskId: string, updates: Partial<SubTask>): boolean {
    const decomposition = this.decompositions.get(decompositionId);
    if (!decomposition) return false;

    const subTask = decomposition.subTasks.find(s => s.id === subTaskId);
    if (!subTask) return false;

    Object.assign(subTask, updates);

    if (updates.status === 'completed' || updates.status === 'failed') {
      this.checkDependencies(decomposition);
    }

    return true;
  }

  private checkDependencies(decomposition: TaskDecomposition): void {
    for (const subTask of decomposition.subTasks) {
      // Re-evaluate both pending and previously-blocked tasks; otherwise a
      // task whose deps complete later never leaves the blocked state.
      if (subTask.status !== 'pending' && subTask.status !== 'blocked') continue;

      const allDepsCompleted = subTask.dependencies.every(depId => {
        const dep = decomposition.subTasks.find(s => s.id === depId);
        return dep?.status === 'completed';
      });

      if (allDepsCompleted) {
        subTask.status = 'ready';
      } else {
        subTask.status = 'blocked';
      }
    }

    const allCompleted = decomposition.subTasks.every(s => s.status === 'completed');
    if (allCompleted) {
      decomposition.completedAt = Date.now();
    }
  }

  getDecomposition(id: string): TaskDecomposition | undefined {
    return this.decompositions.get(id);
  }

  getAllDecompositions(): TaskDecomposition[] {
    return Array.from(this.decompositions.values());
  }

  private cleanup(): void {
    if (this.decompositions.size > this.maxHistory) {
      const sorted = Array.from(this.decompositions.values())
        .sort((a, b) => a.createdAt - b.createdAt);
      // Snapshot the eviction count; the previous loop bound decreased as
      // we deleted, so only half the targeted entries were removed.
      const toRemove = this.decompositions.size - this.maxHistory;
      for (let i = 0; i < toRemove; i++) {
        this.decompositions.delete(sorted[i].id);
      }
    }
  }
}

export const taskDecomposer = TaskDecomposer.getInstance();