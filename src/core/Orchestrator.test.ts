import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from './Orchestrator';
import {
  AgentRole,
  AgentState,
  EventType,
  GameEvent,
  GridCell,
  IEventBus,
  IPathfinder,
  ITilemap,
  PathResult,
  TileData,
  TileType,
  Vec2,
} from '../types';
import { AgentManager } from '../agent/AgentManager';

// --- Mocks ---
function createMockEventBus(): IEventBus {
  const handlers = new Map<EventType, Set<(event: GameEvent) => void>>();
  return {
    emit: vi.fn((type: EventType, payload: unknown) => {
      const set = handlers.get(type);
      if (set) {
        for (const h of set) {
          h({ type, payload, timestamp: Date.now() });
        }
      }
    }),
    on: vi.fn((type: EventType, handler: (event: GameEvent) => void) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
    }),
    off: vi.fn(),
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

describe('Orchestrator', () => {
  it('should process a command and dispatch tasks', async () => {
    const eventBus = createMockEventBus();
    const tilemap = createMockTilemap();
    const pathfinder = createMockPathfinder();
    const agentManager = new AgentManager(tilemap, pathfinder, eventBus);

    // Add a frontend agent
    agentManager.addAgent({
      id: 'fe-1',
      name: 'Alice',
      role: AgentRole.Frontend,
      homeDesk: { col: 3, row: 3 },
      speed: 3,
      color: 0x4FC3F7,
    });

    const orchestrator = new Orchestrator(agentManager, eventBus);
    await orchestrator.processCommand('프론트엔드 페이지 만들어줘');

    // Should have emitted CommandReceived and TasksParsed
    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.CommandReceived,
      expect.objectContaining({ prompt: '프론트엔드 페이지 만들어줘' })
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.TasksParsed,
      expect.objectContaining({ tasks: expect.any(Array) })
    );
  });

  it('should trigger pipeline for pipeline keywords', async () => {
    const eventBus = createMockEventBus();
    const tilemap = createMockTilemap();
    const pathfinder = createMockPathfinder();
    const agentManager = new AgentManager(tilemap, pathfinder, eventBus);

    // Add CEO pipeline agents
    agentManager.addAgent({ id: 'ceo-1', name: 'CEO', role: AgentRole.CEO, homeDesk: { col: 13, row: 3 }, speed: 4, color: 0xFFD700 });
    agentManager.addAgent({ id: 'arc-1', name: 'Arch', role: AgentRole.Architect, homeDesk: { col: 13, row: 5 }, speed: 3, color: 0xFF6B6B });
    agentManager.addAgent({ id: 'cod-1', name: 'Cody', role: AgentRole.Coder, homeDesk: { col: 13, row: 7 }, speed: 3.5, color: 0x51CF66 });
    agentManager.addAgent({ id: 'rev-1', name: 'Rex', role: AgentRole.Reviewer, homeDesk: { col: 13, row: 9 }, speed: 3.2, color: 0x845EF7 });

    const orchestrator = new Orchestrator(agentManager, eventBus);
    await orchestrator.processCommand('프로젝트 최적화 파이프라인 실행');

    // Should have triggered PipelineCreated event
    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.PipelineCreated,
      expect.objectContaining({ pipelineId: expect.any(String) })
    );
  });

  it('should report tasks correctly', async () => {
    const eventBus = createMockEventBus();
    const tilemap = createMockTilemap();
    const pathfinder = createMockPathfinder();
    const agentManager = new AgentManager(tilemap, pathfinder, eventBus);
    const orchestrator = new Orchestrator(agentManager, eventBus);

    const report = orchestrator.getTaskReport();
    expect(report).toHaveProperty('total');
    expect(report).toHaveProperty('completed');
    expect(report).toHaveProperty('pending');
  });

  it('should have dispatch loop methods', () => {
    const eventBus = createMockEventBus();
    const tilemap = createMockTilemap();
    const pathfinder = createMockPathfinder();
    const agentManager = new AgentManager(tilemap, pathfinder, eventBus);
    const orchestrator = new Orchestrator(agentManager, eventBus);

    // Methods should exist (startDispatchLoop uses window.setInterval — browser only)
    expect(typeof orchestrator.startDispatchLoop).toBe('function');
    expect(typeof orchestrator.stopDispatchLoop).toBe('function');
  });
});
