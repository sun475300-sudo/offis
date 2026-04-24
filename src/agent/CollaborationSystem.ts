import {
  AgentRole,
  AgentState,
  EventType,
  GridCell,
  IEventBus,
  TaskInfo,
  TaskPriority,
  TaskStatus,
} from '../types';
import { AgentManager } from './AgentManager';

/** Meeting types */
export enum MeetingType {
  StandUp = 'standup',
  CodeReview = 'code_review',
  PairProgramming = 'pair_programming',
  Planning = 'planning',
  VideoConference = 'video_conference',
}

export interface Meeting {
  id: string;
  type: MeetingType;
  participants: string[]; // agent IDs
  location: GridCell;
  duration: number; // seconds
  startedAt: number;
  description: string;
}

export interface PairSession {
  id: string;
  driverId: string;
  navigatorId: string;
  taskId: string;
  location: GridCell;
  startedAt: number;
}

/**
 * Collaboration System — manages meetings, pair programming, and group tasks.
 */
export class CollaborationSystem {
  private activeMeetings: Map<string, Meeting> = new Map();
  private pairSessions: Map<string, PairSession> = new Map();
  private meetingIdCounter = 0;

  // Meeting room locations on the tilemap
  private readonly meetingRooms: GridCell[] = [
    { col: 9, row: 14 },   // Main meeting room
    { col: 17, row: 14 },  // Secondary room
    { col: 9, row: 20 },   // Breakout room
  ];

  constructor(
    private agentManager: AgentManager,
    private eventBus: IEventBus,
  ) {}

  /** Call a standup meeting with agents of specific roles */
  callMeeting(
    type: MeetingType,
    roleFilter: AgentRole[],
    description: string,
    duration: number = 10,
  ): Meeting | null {
    // Find available meeting room
    const room = this.findAvailableRoom();
    if (!room) return null;

    // Find matching idle/working agents (max 6 per meeting)
    const agents = this.agentManager.getAllAgents()
      .filter(a => roleFilter.includes(a.role))
      .slice(0, 6);

    if (agents.length < 2) return null;

    const meetingId = `meeting-${++this.meetingIdCounter}`;
    const participantIds = agents.map(a => a.id);

    const meeting: Meeting = {
      id: meetingId,
      type,
      participants: participantIds,
      location: room,
      duration,
      startedAt: Date.now(),
      description,
    };

    this.activeMeetings.set(meetingId, meeting);

    // Assign meeting tasks to each participant
    for (const agent of agents) {
      // Offset positions around the table
      const idx = agents.indexOf(agent);
      const offset: GridCell = {
        col: room.col + (idx % 3) - 1,
        row: room.row + Math.floor(idx / 3),
      };

      agent.assignTask({
        id: `${meetingId}-${agent.id}`,
        description: `${this.getMeetingLabel(type)}: ${description}`,
        requiredRole: agent.role,
        targetDesk: offset,
        priority: TaskPriority.High,
        status: TaskStatus.Assigned,
        assignedAgentId: agent.id,
        estimatedDuration: duration,
        progress: 0,
        parentTaskId: null,
        createdAt: Date.now(),
      });
    }

    // Previously emitted AgentStateChanged with a meeting-shaped payload,
    // which the AppEventHandlers listener then silently dropped because
    // agentId was undefined. Use a dedicated event so observers that
    // actually care about meetings can subscribe.
    this.eventBus.emit(EventType.MeetingStarted, {
      meetingId,
      type,
      participants: participantIds,
    });

    return meeting;
  }

  /** Start a pair programming session between two agents */
  startPairProgramming(
    driverRole: AgentRole,
    navigatorRole: AgentRole,
    taskDescription: string,
    duration: number = 15,
  ): PairSession | null {
    const drivers = this.agentManager.findIdleAgentsByRole(driverRole);
    const navigators = this.agentManager.findIdleAgentsByRole(navigatorRole);

    if (drivers.length === 0 || navigators.length === 0) return null;

    const driver = drivers[0];
    const navigator = navigators[0];

    // Pair works at the driver's desk
    const location = driver.getSnapshot().gridCell;
    const pairId = `pair-${Date.now()}`;

    const session: PairSession = {
      id: pairId,
      driverId: driver.id,
      navigatorId: navigator.id,
      taskId: pairId,
      location,
      startedAt: Date.now(),
    };

    this.pairSessions.set(pairId, session);

    // Assign collaborative tasks
    const sharedTask: TaskInfo = {
      id: pairId,
      description: `[Pair] ${taskDescription}`,
      requiredRole: driverRole,
      targetDesk: location,
      priority: TaskPriority.High,
      status: TaskStatus.Assigned,
      assignedAgentId: driver.id,
      estimatedDuration: duration,
      progress: 0,
      parentTaskId: null,
      createdAt: Date.now(),
    };

    driver.assignTask(sharedTask);

    // Navigator moves adjacent to driver
    const navDesk: GridCell = { col: location.col + 1, row: location.row };
    navigator.assignTask({
      ...sharedTask,
      id: `${pairId}-nav`,
      description: `[Navigator] ${taskDescription}`,
      requiredRole: navigatorRole,
      targetDesk: navDesk,
      assignedAgentId: navigator.id,
    });

    return session;
  }

  /** Get all active meetings */
  getActiveMeetings(): Meeting[] {
    return Array.from(this.activeMeetings.values());
  }

  /** Get all active pair sessions */
  getActivePairSessions(): PairSession[] {
    return Array.from(this.pairSessions.values());
  }

  /** Cleanup finished meetings (called periodically) */
  update(): void {
    const now = Date.now();

    for (const [id, meeting] of this.activeMeetings) {
      if (now - meeting.startedAt > meeting.duration * 1000) {
        this.activeMeetings.delete(id);
      }
    }

    for (const [id, session] of this.pairSessions) {
      const driver = this.agentManager.getAgent(session.driverId);
      if (driver && driver.isIdle()) {
        this.pairSessions.delete(id);
      }
    }
  }

  private findAvailableRoom(): GridCell | null {
    const occupiedRooms = new Set(
      Array.from(this.activeMeetings.values()).map(m => `${m.location.col},${m.location.row}`)
    );

    for (const room of this.meetingRooms) {
      if (!occupiedRooms.has(`${room.col},${room.row}`)) {
        return room;
      }
    }
    return null;
  }

  private getMeetingLabel(type: MeetingType): string {
    const labels: Record<MeetingType, string> = {
      [MeetingType.StandUp]: 'Stand-Up',
      [MeetingType.CodeReview]: 'Code Review',
      [MeetingType.PairProgramming]: 'Pair Programming',
      [MeetingType.Planning]: 'Sprint Planning',
      [MeetingType.VideoConference]: 'Video Conference',
    };
    return labels[type];
  }
}
