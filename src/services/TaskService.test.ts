import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from './TaskService';
import {
  AgentRole,
  EventType,
  IEventBus,
  LLMTaskDecomposition,
  TaskPriority,
  TaskStatus,
} from '../types';

function createMockEventBus(): IEventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

describe('TaskService', () => {
  let eventBus: IEventBus;
  let service: TaskService;

  beforeEach(() => {
    eventBus = createMockEventBus();
    service = new TaskService(eventBus);
  });

  describe('task creation', () => {
    it('should create tasks from LLM decomposition', () => {
      const decomps: LLMTaskDecomposition[] = [
        { agent: AgentRole.Frontend, task: 'Build login page' },
        { agent: AgentRole.Backend, task: 'Create auth API' },
      ];

      const tasks = service.createTasksFromDecomposition(decomps);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].description).toBe('Build login page');
      expect(tasks[0].requiredRole).toBe(AgentRole.Frontend);
      expect(tasks[1].description).toBe('Create auth API');
      expect(tasks[1].requiredRole).toBe(AgentRole.Backend);
    });

    it('should assign unique IDs to each task', () => {
      const decomps: LLMTaskDecomposition[] = [
        { agent: AgentRole.Frontend, task: 'Task A' },
        { agent: AgentRole.Frontend, task: 'Task B' },
      ];

      const tasks = service.createTasksFromDecomposition(decomps);

      expect(tasks[0].id).not.toBe(tasks[1].id);
    });

    it('should set initial status to Pending', () => {
      const tasks = service.createTasksFromDecomposition([
        { agent: AgentRole.QA, task: 'Run tests' },
      ]);

      expect(tasks[0].status).toBe(TaskStatus.Pending);
      expect(tasks[0].progress).toBe(0);
      expect(tasks[0].assignedAgentId).toBeNull();
    });

    it('should use the provided priority', () => {
      const tasks = service.createTasksFromDecomposition([
        { agent: AgentRole.Backend, task: 'Fix critical bug', priority: TaskPriority.Critical },
      ]);

      expect(tasks[0].priority).toBe(TaskPriority.Critical);
    });

    it('should default to Normal priority when none is specified', () => {
      const tasks = service.createTasksFromDecomposition([
        { agent: AgentRole.Frontend, task: 'Add button' },
      ]);

      expect(tasks[0].priority).toBe(TaskPriority.Normal);
    });

    it('should store a parentTaskId when provided', () => {
      const tasks = service.createTasksFromDecomposition(
        [{ agent: AgentRole.Frontend, task: 'Sub-task' }],
        'parent-123',
      );

      expect(tasks[0].parentTaskId).toBe('parent-123');
    });
  });

  describe('task lifecycle', () => {
    let taskId: string;

    beforeEach(() => {
      const tasks = service.createTasksFromDecomposition([
        { agent: AgentRole.Frontend, task: 'Build UI' },
      ]);
      taskId = tasks[0].id;
    });

    it('should transition from Pending to Assigned', () => {
      service.markAssigned(taskId, 'agent-1');

      const task = service.getTask(taskId)!;
      expect(task.status).toBe(TaskStatus.Assigned);
      expect(task.assignedAgentId).toBe('agent-1');
    });

    it('should transition from Assigned to InProgress', () => {
      service.markAssigned(taskId, 'agent-1');
      service.markInProgress(taskId);

      expect(service.getTask(taskId)!.status).toBe(TaskStatus.InProgress);
    });

    it('should transition to Completed and set progress to 1', () => {
      service.markAssigned(taskId, 'agent-1');
      service.markInProgress(taskId);
      service.markCompleted(taskId);

      const task = service.getTask(taskId)!;
      expect(task.status).toBe(TaskStatus.Completed);
      expect(task.progress).toBe(1);
    });

    it('should emit TaskCompleted event when completed', () => {
      service.markAssigned(taskId, 'agent-1');
      service.markCompleted(taskId);

      expect(eventBus.emit).toHaveBeenCalledWith(
        EventType.TaskCompleted,
        expect.objectContaining({ taskId, agentId: 'agent-1' }),
      );
    });

    it('should transition to Failed status', () => {
      service.markAssigned(taskId, 'agent-1');
      service.markFailed(taskId);

      expect(service.getTask(taskId)!.status).toBe(TaskStatus.Failed);
    });

    it('should emit TaskFailed event when failed', () => {
      service.markFailed(taskId);

      expect(eventBus.emit).toHaveBeenCalledWith(
        EventType.TaskFailed,
        expect.objectContaining({ taskId }),
      );
    });
  });

  describe('priority sorting', () => {
    it('should return pending tasks sorted by priority (highest first)', () => {
      service.createTasksFromDecomposition([
        { agent: AgentRole.Frontend, task: 'Low task', priority: TaskPriority.Low },
        { agent: AgentRole.Backend, task: 'Critical task', priority: TaskPriority.Critical },
        { agent: AgentRole.QA, task: 'Normal task', priority: TaskPriority.Normal },
        { agent: AgentRole.Designer, task: 'High task', priority: TaskPriority.High },
      ]);

      const pending = service.getPendingTasks();

      expect(pending).toHaveLength(4);
      expect(pending[0].priority).toBe(TaskPriority.Critical);
      expect(pending[1].priority).toBe(TaskPriority.High);
      expect(pending[2].priority).toBe(TaskPriority.Normal);
      expect(pending[3].priority).toBe(TaskPriority.Low);
    });

    it('should exclude non-pending tasks from getPendingTasks', () => {
      const tasks = service.createTasksFromDecomposition([
        { agent: AgentRole.Frontend, task: 'Task A' },
        { agent: AgentRole.Backend, task: 'Task B' },
      ]);

      service.markAssigned(tasks[0].id, 'agent-1');

      const pending = service.getPendingTasks();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(tasks[1].id);
    });
  });

  describe('completion report', () => {
    it('should produce an accurate completion report', () => {
      const tasks = service.createTasksFromDecomposition([
        { agent: AgentRole.Frontend, task: 'Task A' },
        { agent: AgentRole.Backend, task: 'Task B' },
        { agent: AgentRole.QA, task: 'Task C' },
      ]);

      service.markAssigned(tasks[0].id, 'a1');
      service.markCompleted(tasks[0].id);
      service.markFailed(tasks[1].id);

      const report = service.getCompletionReport();

      expect(report.total).toBe(3);
      expect(report.completed).toBe(1);
      expect(report.failed).toBe(1);
      expect(report.pending).toBe(1);
    });
  });
});
