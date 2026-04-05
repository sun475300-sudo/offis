export type SchedulingStrategy = 'fifo' | 'lifo' | 'priority' | 'round_robin' | 'earliest_deadline' | 'shortest_job';

export interface ScheduledTask {
  id: string;
  taskId: string;
  agentId?: string;
  priority: number;
  scheduledAt: number;
  deadline?: number;
  payload: Record<string, unknown>;
  status: 'pending' | 'scheduled' | 'running' | 'completed' | 'cancelled';
}

export interface ScheduleConfig {
  strategy: SchedulingStrategy;
  maxConcurrent: number;
  enablePreemption: boolean;
}

export class TaskScheduler {
  private static instance: TaskScheduler;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private config: ScheduleConfig = {
    strategy: 'priority',
    maxConcurrent: 10,
    enablePreemption: true
  };
  private listeners: Set<(task: ScheduledTask) => void> = new Set();

  private constructor() {}

  static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  configure(config: Partial<ScheduleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  schedule(task: Omit<ScheduledTask, 'id' | 'status'>): ScheduledTask {
    const id = `sched-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const scheduledTask: ScheduledTask = {
      ...task,
      id,
      status: 'pending'
    };
    this.scheduledTasks.set(id, scheduledTask);
    this.notifyListeners(scheduledTask);
    return scheduledTask;
  }

  scheduleAt(task: Omit<ScheduledTask, 'id' | 'status'>, delayMs: number): ScheduledTask {
    const scheduledTask = this.schedule(task);
    setTimeout(() => {
      if (scheduledTask.status === 'pending') {
        scheduledTask.status = 'scheduled';
      }
    }, delayMs);
    return scheduledTask;
  }

  scheduleRecurring(taskId: string, payload: Record<string, unknown>, intervalMs: number): () => void {
    const scheduleNext = () => {
      this.schedule({
        taskId,
        priority: 5,
        scheduledAt: Date.now(),
        payload
      });
    };
    scheduleNext();
    const intervalId = setInterval(scheduleNext, intervalMs);
    return () => clearInterval(intervalId);
  }

  cancel(taskId: string): boolean {
    const task = this.scheduledTasks.get(taskId);
    if (!task) return false;
    task.status = 'cancelled';
    return true;
  }

  getNextTask(): ScheduledTask | null {
    const tasks = Array.from(this.scheduledTasks.values())
      .filter(t => t.status === 'pending' || t.status === 'scheduled');

    if (tasks.length === 0) return null;

    switch (this.config.strategy) {
      case 'fifo':
        tasks.sort((a, b) => a.scheduledAt - b.scheduledAt);
        break;
      case 'lifo':
        tasks.sort((a, b) => b.scheduledAt - a.scheduledAt);
        break;
      case 'priority':
        tasks.sort((a, b) => b.priority - a.priority || a.scheduledAt - b.scheduledAt);
        break;
      case 'round_robin':
        tasks.sort((a, b) => a.scheduledAt - b.scheduledAt);
        break;
      case 'earliest_deadline':
        tasks.sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
        break;
      case 'shortest_job':
        break;
    }

    return tasks[0];
  }

  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  getTasksByStatus(status: ScheduledTask['status']): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values()).filter(t => t.status === status);
  }

  getTasksByAgent(agentId: string): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values()).filter(t => t.agentId === agentId);
  }

  subscribe(listener: (task: ScheduledTask) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(task: ScheduledTask): void {
    for (const listener of this.listeners) {
      listener(task);
    }
  }

  getStats(): { total: number; pending: number; scheduled: number; running: number; completed: number; cancelled: number } {
    const stats = { total: 0, pending: 0, scheduled: 0, running: 0, completed: 0, cancelled: 0 };
    for (const task of this.scheduledTasks.values()) {
      stats.total++;
      if (task.status in stats) {
        stats[task.status]++;
      }
    }
    return stats;
  }

  clear(): void {
    this.scheduledTasks.clear();
  }
}

export const taskScheduler = TaskScheduler.getInstance();