import { describe, it, expect, vi } from 'vitest';
import {
  AgentRole,
  AgentState,
  EventType,
  GameEvent,
  GridCell,
  IEventBus,
  IPathfinder,
  ITilemap,
  TaskInfo,
  TaskPriority,
  TaskStatus,
  TileType,
  Vec2,
} from '../types';
import { Agent } from './Agent';

function createMockEventBus(): IEventBus {
  const handlers = new Map<EventType, Set<(event: GameEvent<unknown>) => void>>();
  return {
    emit: vi.fn((type, payload) => {
      const set = handlers.get(type);
      if (set) for (const h of set) h({ type, payload, timestamp: Date.now() });
    }),
    on: vi.fn((type, handler) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler as (event: GameEvent<unknown>) => void);
    }),
    off: vi.fn((type, handler) => {
      handlers.get(type)?.delete(handler as (event: GameEvent<unknown>) => void);
    }),
  };
}

function createMockTilemap(): ITilemap {
  return {
    getWidth: () => 40,
    getHeight: () => 25,
    getTile: () => ({ type: TileType.Floor, walkable: true, occupantId: null, weight: 1 }),
    isWalkable: () => true,
    setOccupant: vi.fn(),
    gridToWorld: (cell: GridCell) => ({ x: cell.col * 32, y: cell.row * 32 }),
    worldToGrid: (pos: Vec2) => ({ col: Math.floor(pos.x / 32), row: Math.floor(pos.y / 32) }),
  };
}

function createMockPathfinder(): IPathfinder {
  return {
    findPath: (start: GridCell, goal: GridCell) => ({
      path: [start, goal],
      found: true,
      cost: 1,
      nodesExplored: 2,
    }),
  };
}

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id: 'task-1',
    description: 'Test task',
    requiredRole: AgentRole.Frontend,
    targetDesk: { col: 10, row: 10 },
    priority: TaskPriority.Normal,
    status: TaskStatus.Assigned,
    assignedAgentId: 'test-agent',
    estimatedDuration: 5,
    progress: 0,
    parentTaskId: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function createAgent() {
  const eventBus = createMockEventBus();
  const tilemap = createMockTilemap();
  const pathfinder = createMockPathfinder();
  const agent = new Agent(
    { id: 'a1', name: 'TestAgent', role: AgentRole.Frontend, homeDesk: { col: 3, row: 3 }, speed: 5, color: 0xFFFFFF },
    tilemap,
    pathfinder,
    eventBus,
  );
  return { agent, eventBus, tilemap, pathfinder };
}

describe('Agent', () => {
  it('should initialize in Idle state', () => {
    const { agent } = createAgent();
    expect(agent.getState()).toBe(AgentState.Idle);
    expect(agent.isIdle()).toBe(true);
  });

  it('should return a valid snapshot', () => {
    const { agent } = createAgent();
    const snap = agent.getSnapshot();
    expect(snap.id).toBe('a1');
    expect(snap.name).toBe('TestAgent');
    expect(snap.role).toBe(AgentRole.Frontend);
    expect(snap.state).toBe(AgentState.Idle);
    expect(snap.position).toHaveProperty('x');
    expect(snap.position).toHaveProperty('y');
  });

  it('should transition to Moving when assigned a task', () => {
    const { agent } = createAgent();
    agent.assignTask(createTask());
    expect(agent.getState()).toBe(AgentState.Moving);
    expect(agent.isIdle()).toBe(false);
  });

  it('should emit AgentStateChanged on state transition', () => {
    const { agent, eventBus } = createAgent();
    agent.assignTask(createTask());
    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.AgentStateChanged,
      expect.objectContaining({ agentId: 'a1', newState: AgentState.Moving })
    );
  });

  it('should return position matching homeDesk on init', () => {
    const { agent } = createAgent();
    const pos = agent.getPosition();
    // homeDesk is {col:3, row:3}, gridToWorld multiplies by 32
    expect(pos.x).toBe(3 * 32);
    expect(pos.y).toBe(3 * 32);
  });

  it('should accept avoidance offset', () => {
    const { agent } = createAgent();
    // Should not throw
    agent.applyAvoidanceOffset({ x: 5, y: -3 });
    expect(agent.getSnapshot()).toBeDefined();
  });

  it('should accept occupied cells', () => {
    const { agent } = createAgent();
    agent.setOccupiedCells([{ col: 1, row: 1 }]);
    expect(agent.getSnapshot()).toBeDefined();
  });

  it('should process movement during update when Moving', () => {
    const { agent, tilemap } = createAgent();
    agent.assignTask(createTask({ targetDesk: { col: 4, row: 3 } }));
    expect(agent.getState()).toBe(AgentState.Moving);

    // Run several updates to move the agent
    for (let i = 0; i < 20; i++) {
      agent.update(0.1);
    }

    // Agent should have moved (either arrived or still moving)
    const snap = agent.getSnapshot();
    expect(snap.state).not.toBe(AgentState.Idle);
  });

  it('should progress work when in Working state', () => {
    const { agent } = createAgent();
    // Force into working state by assigning task with same desk
    agent.assignTask(createTask({ targetDesk: { col: 3, row: 3 } }));

    // Path is [start, goal] with same cell, so after first update it should arrive
    for (let i = 0; i < 10; i++) {
      agent.update(0.1);
    }

    // After some updates, should have progressed or completed
    const snap = agent.getSnapshot();
    // Could be Working (progressing) or Returning (completed work)
    expect([AgentState.Working, AgentState.Returning, AgentState.Idle]).toContain(snap.state);
  });

  it('should clean up event listeners on destroy', () => {
    const { agent, eventBus } = createAgent();
    agent.destroy();
    expect(eventBus.off).toHaveBeenCalledWith(
      EventType.AgentStateChanged,
      expect.any(Function)
    );
  });
});
