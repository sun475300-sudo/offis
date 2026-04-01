import { describe, it, expect, vi } from 'vitest';
import {
  AgentRole,
  EventType,
  GameEvent,
  GridCell,
  IEventBus,
  IPathfinder,
  ITilemap,
  TileType,
  Vec2,
} from '../types';
import { AgentManager } from './AgentManager';
import { CollaborationSystem, MeetingType } from './CollaborationSystem';

function createMockEventBus(): IEventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
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

function createTestSetup() {
  const eventBus = createMockEventBus();
  const tilemap = createMockTilemap();
  const pathfinder = createMockPathfinder();
  const agentManager = new AgentManager(tilemap, pathfinder, eventBus);
  const collab = new CollaborationSystem(agentManager, eventBus);
  return { eventBus, agentManager, collab };
}

describe('CollaborationSystem', () => {
  it('should create a meeting with idle agents', () => {
    const { agentManager, collab } = createTestSetup();

    // Add idle frontend agents
    agentManager.addAgent({ id: 'fe-1', name: 'A', role: AgentRole.Frontend, homeDesk: { col: 2, row: 2 }, speed: 3, color: 0xFFFFFF });
    agentManager.addAgent({ id: 'fe-2', name: 'B', role: AgentRole.Frontend, homeDesk: { col: 4, row: 2 }, speed: 3, color: 0xFFFFFF });
    agentManager.addAgent({ id: 'fe-3', name: 'C', role: AgentRole.Frontend, homeDesk: { col: 6, row: 2 }, speed: 3, color: 0xFFFFFF });

    const meeting = collab.callMeeting(MeetingType.StandUp, [AgentRole.Frontend], 'Daily standup');
    expect(meeting).not.toBeNull();
    expect(meeting!.participants.length).toBeGreaterThanOrEqual(2);
    expect(meeting!.type).toBe(MeetingType.StandUp);
  });

  it('should return null when fewer than 2 agents available', () => {
    const { agentManager, collab } = createTestSetup();
    agentManager.addAgent({ id: 'fe-1', name: 'A', role: AgentRole.Frontend, homeDesk: { col: 2, row: 2 }, speed: 3, color: 0xFFFFFF });

    const meeting = collab.callMeeting(MeetingType.StandUp, [AgentRole.Frontend], 'Solo');
    expect(meeting).toBeNull();
  });

  it('should emit MeetingStarted event', () => {
    const { agentManager, collab, eventBus } = createTestSetup();
    agentManager.addAgent({ id: 'fe-1', name: 'A', role: AgentRole.Frontend, homeDesk: { col: 2, row: 2 }, speed: 3, color: 0xFFFFFF });
    agentManager.addAgent({ id: 'fe-2', name: 'B', role: AgentRole.Frontend, homeDesk: { col: 4, row: 2 }, speed: 3, color: 0xFFFFFF });

    collab.callMeeting(MeetingType.CodeReview, [AgentRole.Frontend], 'Review');

    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.MeetingStarted,
      expect.objectContaining({ type: 'meeting_started' })
    );
  });

  it('should track active meetings', () => {
    const { agentManager, collab } = createTestSetup();
    agentManager.addAgent({ id: 'fe-1', name: 'A', role: AgentRole.Frontend, homeDesk: { col: 2, row: 2 }, speed: 3, color: 0xFFFFFF });
    agentManager.addAgent({ id: 'fe-2', name: 'B', role: AgentRole.Frontend, homeDesk: { col: 4, row: 2 }, speed: 3, color: 0xFFFFFF });

    collab.callMeeting(MeetingType.Planning, [AgentRole.Frontend], 'Sprint');
    expect(collab.getActiveMeetings().length).toBe(1);
  });

  it('should start pair programming between two roles', () => {
    const { agentManager, collab } = createTestSetup();
    agentManager.addAgent({ id: 'fe-1', name: 'A', role: AgentRole.Frontend, homeDesk: { col: 2, row: 2 }, speed: 3, color: 0xFFFFFF });
    agentManager.addAgent({ id: 'be-1', name: 'B', role: AgentRole.Backend, homeDesk: { col: 4, row: 2 }, speed: 3, color: 0xFFFFFF });

    const session = collab.startPairProgramming(AgentRole.Frontend, AgentRole.Backend, 'Build API');
    expect(session).not.toBeNull();
    expect(session!.driverId).toBe('fe-1');
    expect(session!.navigatorId).toBe('be-1');
  });

  it('should return null for pair programming when no agents available', () => {
    const { collab } = createTestSetup();
    const session = collab.startPairProgramming(AgentRole.Frontend, AgentRole.Backend, 'Build');
    expect(session).toBeNull();
  });

  it('should cap meeting participants at 6', () => {
    const { agentManager, collab } = createTestSetup();
    for (let i = 0; i < 10; i++) {
      agentManager.addAgent({ id: `fe-${i}`, name: `Agent${i}`, role: AgentRole.Frontend, homeDesk: { col: 2 + i, row: 2 }, speed: 3, color: 0xFFFFFF });
    }

    const meeting = collab.callMeeting(MeetingType.StandUp, [AgentRole.Frontend], 'Big meeting');
    expect(meeting).not.toBeNull();
    expect(meeting!.participants.length).toBeLessThanOrEqual(6);
  });
});
