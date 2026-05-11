export type QueuePriority = 'low' | 'normal' | 'high' | 'critical';
export type QueueStrategy = 'fifo' | 'lifo' | 'priority';

export interface QueuedWork {
  id: string;
  type: string;
  payload: unknown;
  priority: QueuePriority;
  priorityValue: number;
  enqueuedAt: number;
  processingAt?: number;
  completedAt?: number;
  retries: number;
  maxRetries: number;
  metadata?: Record<string, unknown>;
}

export interface WorkQueueConfig {
  maxSize: number;
  defaultPriority: QueuePriority;
  defaultRetries: number;
  strategy: QueueStrategy;
}

export interface QueueStats {
  size: number;
  processed: number;
  failed: number;
  avgWaitTime: number;
  avgProcessTime: number;
}

export class WorkQueue {
  private static instance: WorkQueue;
  private queue: QueuedWork[] = [];
  private processing: Set<string> = new Set();
  private config: WorkQueueConfig = {
    maxSize: 1000,
    defaultPriority: 'normal',
    defaultRetries: 3,
    strategy: 'priority'
  };
  private processedCount = 0;
  private failedCount = 0;
  private totalWaitTime = 0;
  private totalProcessTime = 0;
  private listeners: Set<(work: QueuedWork) => void> = new Set();

  private constructor() {}

  static getInstance(): WorkQueue {
    if (!WorkQueue.instance) {
      WorkQueue.instance = new WorkQueue();
    }
    return WorkQueue.instance;
  }

  configure(config: Partial<WorkQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  enqueue(type: string, payload: unknown, options?: { priority?: QueuePriority; maxRetries?: number; metadata?: Record<string, unknown> }): QueuedWork {
    if (this.queue.length >= this.config.maxSize) {
      throw new Error('Queue is full');
    }

    const priorityValue = this.getPriorityValue(options?.priority || this.config.defaultPriority);
    const work: QueuedWork = {
      id: `work-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      payload,
      priority: options?.priority || this.config.defaultPriority,
      priorityValue,
      enqueuedAt: Date.now(),
      retries: 0,
      maxRetries: options?.maxRetries ?? this.config.defaultRetries,
      metadata: options?.metadata
    };

    this.queue.push(work);
    this.sortQueue();
    return work;
  }

  dequeue(): QueuedWork | null {
    if (this.queue.length === 0) return null;

    const work = this.queue.shift()!;
    work.processingAt = Date.now();
    this.processing.add(work.id);
    return work;
  }

  complete(workId: string): boolean {
    if (!this.processing.has(workId)) return false;

    const work = this.queue.find(w => w.id === workId);
    if (!work) return false;

    this.processing.delete(workId);
    this.processedCount++;
    
    if (work.processingAt) {
      this.totalProcessTime += Date.now() - work.processingAt;
    }
    this.totalWaitTime += (work.processingAt || Date.now()) - work.enqueuedAt;

    return true;
  }

  fail(workId: string): boolean {
    const work = this.queue.find(w => w.id === workId);
    if (!work) return false;

    work.retries++;
    if (work.retries < work.maxRetries) {
      work.processingAt = undefined;
      this.processing.delete(workId);
    } else {
      this.queue = this.queue.filter(w => w.id !== workId);
      this.failedCount++;
    }

    return true;
  }

  requeue(workId: string): boolean {
    const workIndex = this.queue.findIndex(w => w.id === workId);
    if (workIndex < 0) return false;

    const work = this.queue[workIndex];
    this.queue.splice(workIndex, 1);
    this.processing.delete(workId);
    return this.enqueue(work.type, work.payload, {
      priority: work.priority,
      maxRetries: work.maxRetries,
    }) !== null;
  }

  peek(): QueuedWork | null {
    return this.queue[0] || null;
  }

  getById(workId: string): QueuedWork | null {
    return this.queue.find(w => w.id === workId) || null;
  }

  getByType(type: string): QueuedWork[] {
    return this.queue.filter(w => w.type === type);
  }

  remove(workId: string): boolean {
    const index = this.queue.findIndex(w => w.id === workId);
    if (index < 0) return false;
    this.queue.splice(index, 1);
    return true;
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
  }

  private getPriorityValue(priority: QueuePriority): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private sortQueue(): void {
    switch (this.config.strategy) {
      case 'fifo':
        this.queue.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
        break;
      case 'lifo':
        this.queue.sort((a, b) => b.enqueuedAt - a.enqueuedAt);
        break;
      case 'priority':
        this.queue.sort((a, b) => b.priorityValue - a.priorityValue || a.enqueuedAt - b.enqueuedAt);
        break;
    }
  }

  subscribe(listener: (work: QueuedWork) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getStats(): QueueStats {
    const total = this.processedCount + this.failedCount;
    return {
      size: this.queue.length,
      processed: this.processedCount,
      failed: this.failedCount,
      avgWaitTime: total > 0 ? this.totalWaitTime / total : 0,
      avgProcessTime: this.processedCount > 0 ? this.totalProcessTime / this.processedCount : 0
    };
  }

  getAll(): QueuedWork[] {
    return [...this.queue];
  }
}

export const workQueue = WorkQueue.getInstance();