import {
  AgentRole,
  EventType,
  GridCell,
  IEventBus,
  LLMTaskDecomposition,
  TaskInfo,
  TaskPriority,
  TaskStatus,
} from '../types';

/**
 * Task decomposition and reporting aggregation service.
 * Converts LLM output into TaskInfo objects and manages task lifecycle.
 */
export class TaskService {
  private tasks: Map<string, TaskInfo> = new Map();
  private taskIdCounter: number = 0;

  // Map roles to designated work desks on the office tilemap
  private readonly roleDeskMap: Map<AgentRole, GridCell[]> = new Map([
    [AgentRole.Frontend, [{ col: 3, row: 15 }, { col: 5, row: 15 }]],
    [AgentRole.Backend, [{ col: 9, row: 15 }, { col: 11, row: 15 }]],
    [AgentRole.Designer, [{ col: 17, row: 9 }, { col: 19, row: 9 }]],
    [AgentRole.PM, [{ col: 17, row: 15 }, { col: 19, row: 15 }]],
    [AgentRole.QA, [{ col: 3, row: 11 }, { col: 5, row: 11 }]],
    [AgentRole.DevOps, [{ col: 9, row: 11 }, { col: 11, row: 11 }]],
    [AgentRole.CEO, [{ col: 13, row: 3 }]],
    [AgentRole.Architect, [{ col: 13, row: 5 }]],
    [AgentRole.Coder, [{ col: 13, row: 7 }]],
    [AgentRole.Reviewer, [{ col: 13, row: 9 }]],
  ]);

  constructor(private eventBus: IEventBus) {}

  /** Convert LLM decomposition output into TaskInfo objects */
  createTasksFromDecomposition(
    decompositions: LLMTaskDecomposition[],
    parentTaskId: string | null = null,
  ): TaskInfo[] {
    const created: TaskInfo[] = [];

    for (const decomp of decompositions) {
      const taskId = `task-${++this.taskIdCounter}-${Date.now()}`;
      const desks = this.roleDeskMap.get(decomp.agent) || [{ col: 10, row: 10 }];
      const desk = desks[this.taskIdCounter % desks.length];

      const task: TaskInfo = {
        id: taskId,
        description: decomp.task,
        requiredRole: decomp.agent,
        targetDesk: desk,
        priority: decomp.priority ?? TaskPriority.Normal,
        status: TaskStatus.Pending,
        assignedAgentId: null,
        estimatedDuration: this.estimateDuration(decomp),
        progress: 0,
        parentTaskId,
        createdAt: Date.now(),
      };

      this.tasks.set(taskId, task);
      created.push(task);
    }

    return created;
  }

  getTask(id: string): TaskInfo | undefined {
    return this.tasks.get(id);
  }

  getPendingTasks(): TaskInfo[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === TaskStatus.Pending)
      .sort((a, b) => b.priority - a.priority); // higher priority first
  }

  markAssigned(taskId: string, agentId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.Assigned;
      task.assignedAgentId = agentId;
    }
  }

  markInProgress(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.InProgress;
    }
  }

  markCompleted(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.Completed;
      task.progress = 1;
      this.eventBus.emit(EventType.TaskCompleted, { taskId, agentId: task.assignedAgentId });
    }
  }

  markFailed(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.Failed;
      this.eventBus.emit(EventType.TaskFailed, { taskId });
    }
  }

  getCompletionReport(): { total: number; completed: number; failed: number; pending: number; inProgress: number } {
    const all = Array.from(this.tasks.values());
    return {
      total: all.length,
      completed: all.filter(t => t.status === TaskStatus.Completed).length,
      failed: all.filter(t => t.status === TaskStatus.Failed).length,
      pending: all.filter(t => t.status === TaskStatus.Pending).length,
      inProgress: all.filter(t => t.status === TaskStatus.InProgress || t.status === TaskStatus.Assigned).length,
    };
  }

  private estimateDuration(decomp: LLMTaskDecomposition): number {
    // Mock duration estimation: 5-15 seconds based on complexity keywords
    const text = decomp.task.toLowerCase();
    if (text.includes('simple') || text.includes('간단')) return 5;
    if (text.includes('complex') || text.includes('복잡')) return 15;
    return 8 + Math.random() * 4; // 8-12 seconds default
  }
}
