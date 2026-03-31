import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipelineSystem } from './PipelineSystem';
import { AgentManager } from '../agent/AgentManager';
import {
  AgentRole,
  EventType,
  IEventBus,
  GameEvent,
  PipelineStage,
} from '../types';

/** Minimal mock EventBus that records emitted events */
function createMockEventBus(): IEventBus & { emitted: { type: EventType; payload: unknown }[] } {
  const handlers = new Map<EventType, Set<(event: GameEvent) => void>>();
  const emitted: { type: EventType; payload: unknown }[] = [];

  return {
    emitted,
    emit<T>(type: EventType, payload: T): void {
      emitted.push({ type, payload });
      const set = handlers.get(type);
      if (set) {
        for (const h of set) {
          h({ type, payload, timestamp: Date.now() } as GameEvent);
        }
      }
    },
    on<T>(type: EventType, handler: (event: GameEvent<T>) => void): void {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler as (event: GameEvent) => void);
    },
    off<T>(type: EventType, handler: (event: GameEvent<T>) => void): void {
      handlers.get(type)?.delete(handler as (event: GameEvent) => void);
    },
  };
}

/** Create a mock AgentManager with agents for each pipeline role */
function createMockAgentManager(): AgentManager {
  const mockAgent = (id: string, role: AgentRole) => ({
    id,
    name: `Agent-${id}`,
    role,
    isIdle: () => true,
    assignTask: vi.fn(),
    getSnapshot: vi.fn(),
  });

  const agents = [
    mockAgent('ceo-1', AgentRole.CEO),
    mockAgent('arc-1', AgentRole.Architect),
    mockAgent('cod-1', AgentRole.Coder),
    mockAgent('rev-1', AgentRole.Reviewer),
  ];

  return {
    findIdleAgentsByRole(role: AgentRole) {
      return agents.filter(a => a.role === role);
    },
    getAgent(id: string) {
      return agents.find(a => a.id === id);
    },
  } as unknown as AgentManager;
}

describe('PipelineSystem', () => {
  let eventBus: ReturnType<typeof createMockEventBus>;
  let agentManager: AgentManager;
  let pipeline: PipelineSystem;

  beforeEach(() => {
    eventBus = createMockEventBus();
    agentManager = createMockAgentManager();
    pipeline = new PipelineSystem(agentManager, eventBus);
  });

  it('should create a pipeline and emit PipelineCreated event', () => {
    const result = pipeline.createPipeline('Build a login page');

    expect(result).not.toBeNull();
    expect(result!.goal).toBe('Build a login page');
    expect(result!.currentStage).toBe(PipelineStage.Planning);
    expect(result!.stages).toHaveLength(4);

    const createdEvent = eventBus.emitted.find(e => e.type === EventType.PipelineCreated);
    expect(createdEvent).toBeDefined();
  });

  it('should assign agents to all pipeline roles', () => {
    const result = pipeline.createPipeline('Test goal');

    expect(result).not.toBeNull();
    expect(result!.assignedAgents.ceo).toBe('ceo-1');
    expect(result!.assignedAgents.architect).toBe('arc-1');
    expect(result!.assignedAgents.coder).toBe('cod-1');
    expect(result!.assignedAgents.reviewer).toBe('rev-1');
  });

  it('should return null when agents are not available', () => {
    const emptyManager = {
      findIdleAgentsByRole: () => [],
      getAgent: () => undefined,
    } as unknown as AgentManager;

    const sys = new PipelineSystem(emptyManager, eventBus);
    const result = sys.createPipeline('No agents available');

    expect(result).toBeNull();
  });

  it('should advance stages and eventually complete', () => {
    const result = pipeline.createPipeline('Multi-stage test');
    expect(result).not.toBeNull();
    const id = result!.id;

    // First stage is in_progress after creation
    expect(pipeline.getPipeline(id)!.currentStage).toBe(PipelineStage.Planning);

    // Advance through all 4 stages
    pipeline.advanceStage(id, 'Planning output');
    expect(pipeline.getPipeline(id)!.currentStage).toBe(PipelineStage.Architecture);

    pipeline.advanceStage(id, 'Architecture output');
    expect(pipeline.getPipeline(id)!.currentStage).toBe(PipelineStage.Coding);

    pipeline.advanceStage(id, 'Coding output');
    expect(pipeline.getPipeline(id)!.currentStage).toBe(PipelineStage.Review);

    pipeline.advanceStage(id, 'Review output');
    expect(pipeline.getPipeline(id)!.currentStage).toBe(PipelineStage.Complete);
    expect(pipeline.getPipeline(id)!.completedAt).not.toBeNull();

    const completedEvent = eventBus.emitted.find(e => e.type === EventType.PipelineCompleted);
    expect(completedEvent).toBeDefined();
  });

  it('should mark pipeline as failed', () => {
    const result = pipeline.createPipeline('Fail test');
    expect(result).not.toBeNull();
    const id = result!.id;

    pipeline.failPipeline(id, 'Something went wrong');

    const p = pipeline.getPipeline(id)!;
    expect(p.currentStage).toBe(PipelineStage.Failed);

    const failedEvent = eventBus.emitted.find(e => e.type === EventType.PipelineFailed);
    expect(failedEvent).toBeDefined();
  });

  it('should generate a report for completed pipeline', () => {
    const result = pipeline.createPipeline('Report test');
    const id = result!.id;

    pipeline.advanceStage(id, 'Out 1');
    pipeline.advanceStage(id, 'Out 2');
    pipeline.advanceStage(id, 'Out 3');
    pipeline.advanceStage(id, 'Out 4');

    const report = pipeline.generateReport(id);
    expect(report).not.toBeNull();
    expect(report!.success).toBe(true);
    expect(report!.goal).toBe('Report test');
    expect(report!.stages.length).toBeGreaterThan(0);
  });

  it('should track active pipelines', () => {
    pipeline.createPipeline('Active 1');
    pipeline.createPipeline('Active 2');

    expect(pipeline.getActivePipelines()).toHaveLength(2);
    expect(pipeline.getAllPipelines()).toHaveLength(2);
  });
});
