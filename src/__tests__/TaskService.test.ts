import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '../services/TaskService';
import { AgentRole, TaskPriority, TaskStatus, EventType } from '../types';
import type { IEventBus, LLMTaskDecomposition } from '../types';

// --- mock EventBus ---
function makeMockBus(): IEventBus {
  return { on: vi.fn(), off: vi.fn(), emit: vi.fn(), clear: vi.fn() } as unknown as IEventBus;
}

describe('TaskService', () => {
  let svc: TaskService;
  let bus: IEventBus;

  beforeEach(() => {
    bus = makeMockBus();
    svc = new TaskService(bus);
  });

  // ── createTasksFromDecomposition ──────────────────────────────────────
  it('decomposition에서 TaskInfo 배열을 생성한다', () => {
    const decomps: LLMTaskDecomposition[] = [
      { task: 'UI 구현', agent: AgentRole.Frontend, priority: TaskPriority.High },
      { task: 'API 개발', agent: AgentRole.Backend, priority: TaskPriority.Normal },
    ];
    const tasks = svc.createTasksFromDecomposition(decomps);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe('UI 구현');
    expect(tasks[0].requiredRole).toBe(AgentRole.Frontend);
    expect(tasks[0].status).toBe(TaskStatus.Pending);
    expect(tasks[0].priority).toBe(TaskPriority.High);
    expect(tasks[1].description).toBe('API 개발');
  });

  it('각 task에 고유 id가 부여된다', () => {
    const decomps: LLMTaskDecomposition[] = [
      { task: 'task A', agent: AgentRole.QA },
      { task: 'task B', agent: AgentRole.QA },
    ];
    const [a, b] = svc.createTasksFromDecomposition(decomps);
    expect(a.id).not.toBe(b.id);
  });

  it('parentTaskId를 설정할 수 있다', () => {
    const [task] = svc.createTasksFromDecomposition(
      [{ task: '서브태스크', agent: AgentRole.PM }],
      'parent-42',
    );
    expect(task.parentTaskId).toBe('parent-42');
  });

  it('priority 미지정 시 Normal이 기본값이다', () => {
    const [task] = svc.createTasksFromDecomposition([{ task: '기본 작업', agent: AgentRole.DevOps }]);
    expect(task.priority).toBe(TaskPriority.Normal);
  });

  // ── getPendingTasks ───────────────────────────────────────────────────
  it('getPendingTasks는 Pending 상태 작업만 반환한다', () => {
    const [t1, t2] = svc.createTasksFromDecomposition([
      { task: 'A', agent: AgentRole.Frontend },
      { task: 'B', agent: AgentRole.Backend },
    ]);
    svc.markAssigned(t1.id, 'agent-1');
    const pending = svc.getPendingTasks();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(t2.id);
  });

  it('getPendingTasks는 priority 내림차순으로 정렬된다', () => {
    svc.createTasksFromDecomposition([
      { task: 'low',      agent: AgentRole.QA,       priority: TaskPriority.Low },
      { task: 'critical', agent: AgentRole.QA,       priority: TaskPriority.Critical },
      { task: 'normal',   agent: AgentRole.QA,       priority: TaskPriority.Normal },
    ]);
    const pending = svc.getPendingTasks();
    expect(pending[0].priority).toBe(TaskPriority.Critical);
    expect(pending[1].priority).toBe(TaskPriority.Normal);
    expect(pending[2].priority).toBe(TaskPriority.Low);
  });

  // ── markAssigned / markInProgress / markCompleted / markFailed ────────
  it('markAssigned가 상태와 agentId를 갱신한다', () => {
    const [t] = svc.createTasksFromDecomposition([{ task: 'X', agent: AgentRole.Designer }]);
    svc.markAssigned(t.id, 'agent-007');
    const updated = svc.getTask(t.id)!;
    expect(updated.status).toBe(TaskStatus.Assigned);
    expect(updated.assignedAgentId).toBe('agent-007');
  });

  it('markInProgress가 상태를 InProgress로 변경한다', () => {
    const [t] = svc.createTasksFromDecomposition([{ task: 'Y', agent: AgentRole.Backend }]);
    svc.markAssigned(t.id, 'a1');
    svc.markInProgress(t.id);
    expect(svc.getTask(t.id)!.status).toBe(TaskStatus.InProgress);
  });

  it('markCompleted가 상태를 Completed로, progress를 1로 변경한다', () => {
    const [t] = svc.createTasksFromDecomposition([{ task: 'Z', agent: AgentRole.Frontend }]);
    svc.markCompleted(t.id);
    const done = svc.getTask(t.id)!;
    expect(done.status).toBe(TaskStatus.Completed);
    expect(done.progress).toBe(1);
  });

  it('markCompleted 중복 호출을 무시한다', () => {
    const [t] = svc.createTasksFromDecomposition([{ task: 'dup', agent: AgentRole.QA }]);
    svc.markCompleted(t.id);
    svc.markCompleted(t.id); // 두 번째 호출 — 예외 없어야 함
    expect(svc.getTask(t.id)!.status).toBe(TaskStatus.Completed);
  });

  it('markFailed가 상태를 Failed로 변경한다', () => {
    const [t] = svc.createTasksFromDecomposition([{ task: 'fail', agent: AgentRole.DevOps }]);
    svc.markFailed(t.id);
    expect(svc.getTask(t.id)!.status).toBe(TaskStatus.Failed);
  });

  // ── getCompletionReport ───────────────────────────────────────────────
  it('getCompletionReport가 정확한 집계를 반환한다', () => {
    const tasks = svc.createTasksFromDecomposition([
      { task: 'p1', agent: AgentRole.Frontend },
      { task: 'p2', agent: AgentRole.Backend },
      { task: 'p3', agent: AgentRole.QA },
      { task: 'p4', agent: AgentRole.PM },
    ]);
    svc.markAssigned(tasks[0].id, 'a1');   // assigned → inProgress count
    svc.markCompleted(tasks[1].id);
    svc.markFailed(tasks[2].id);
    // tasks[3] remains Pending

    const report = svc.getCompletionReport();
    expect(report.total).toBe(4);
    expect(report.completed).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.pending).toBe(1);
    expect(report.inProgress).toBe(1); // Assigned counts as inProgress
  });
});
