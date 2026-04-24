// ============================================================
// Core Type Definitions for Multi-Agent Office System
// ============================================================

// --- Spatial Types ---

export interface Vec2 {
  x: number;
  y: number;
}

export interface GridCell {
  col: number;
  row: number;
}

export enum TileType {
  Floor = 0,
  Wall = 1,
  Desk = 2,
  Door = 3,
  MeetingTable = 4,
  Corridor = 5,
}

export interface TileData {
  type: TileType;
  walkable: boolean;
  occupantId: string | null;
  weight: number; // pathfinding cost multiplier
}

// --- Agent Types ---

export enum AgentRole {
  Frontend = 'frontend',
  Backend = 'backend',
  Designer = 'designer',
  PM = 'pm',
  QA = 'qa',
  DevOps = 'devops',
  Architect = 'architect',
  SecurityEngineer = 'security',
  PerformanceEngineer = 'performance',
}

export enum AgentState {
  Idle = 'idle',
  Moving = 'moving',
  Working = 'working',
  Returning = 'returning',
  Waiting = 'waiting',
  Collaborating = 'collaborating',
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  homeDesk: GridCell;
  speed: number; // tiles per second
  color: number; // hex color for sprite
}

export interface AgentSnapshot {
  id: string;
  name: string;
  role: AgentRole;
  state: AgentState;
  position: Vec2;       // world pixel position (interpolated)
  gridCell: GridCell;    // current logical grid cell
  currentTask: TaskInfo | null;
  progress: number;      // 0..1 for working state
  path: GridCell[];      // remaining path nodes
}

// --- Task Types ---

export enum TaskPriority {
  Low = 0,
  Normal = 1,
  High = 2,
  Critical = 3,
}

export enum TaskStatus {
  Pending = 'pending',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
}

export interface TaskInfo {
  id: string;
  description: string;
  requiredRole: AgentRole;
  targetDesk: GridCell;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgentId: string | null;
  estimatedDuration: number; // seconds
  progress: number;          // 0..1
  parentTaskId: string | null;
  createdAt: number;
  lastPulse?: number; // Last time the task was confirmed "active"
}

// --- Event Types ---

export enum EventType {
  // Orchestrator events
  CommandReceived = 'command:received',
  TasksParsed = 'tasks:parsed',
  TaskAssigned = 'task:assigned',
  TaskCompleted = 'task:completed',
  TaskFailed = 'task:failed',
  TechnicalDebateTriggered = 'tasks:debateTriggered',

  // Agent events
  AgentStateChanged = 'agent:stateChanged',
  AgentArrived = 'agent:arrived',
  AgentStartedWork = 'agent:startedWork',
  AgentFinishedWork = 'agent:finishedWork',
  AgentPathBlocked = 'agent:pathBlocked',
  AgentTalked = 'agent:talked',

  // Collaboration events
  MeetingStarted = 'collab:meetingStarted',

  // System events
  TickUpdate = 'system:tick',
  CameraFollow = 'camera:follow',
  CameraReset = 'camera:reset',
}

export interface GameEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: number;
}

// --- Pathfinding Types ---

export interface PathNode {
  cell: GridCell;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: PathNode | null;
}

export interface PathResult {
  path: GridCell[];
  found: boolean;
  cost: number;
  nodesExplored: number;
}

// --- LLM Service Types ---

export interface LLMTaskDecomposition {
  agent: AgentRole;
  task: string;
  priority?: TaskPriority;
  dependencies?: string[];
}

export interface LLMResponse {
  tasks: LLMTaskDecomposition[];
  reasoning: string;
  confidence: number;
}

// --- Code Review Types ---

export enum ReviewType {
  Architecture = 'architecture',
  BugsAndSecurity = 'bugs_security',
  Performance = 'performance',
}

export interface ReviewTask {
  id: string;
  code: string;
  language: string;
  reviewType: ReviewType;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: ReviewResult;
}

export interface ReviewResult {
  type: ReviewType;
  score: number;
  findings: ReviewFinding[];
  summary: string;
  recommendations: string[];
}

export interface ReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  line?: number;
  category: string;
  description: string;
  suggestion?: string;
}

export interface AggregatedReviewReport {
  totalScore: number;
  architectureScore: number;
  bugsScore: number;
  performanceScore: number;
  findings: ReviewFinding[];
  summary: string;
  recommendations: string[];
  reviewedBy: {
    architect: string;
    securityEngineer: string;
    performanceEngineer: string;
  };
  timestamp: number;
}

// --- Behavior Tree Types ---

export enum BTNodeStatus {
  Success = 'success',
  Failure = 'failure',
  Running = 'running',
}

export interface BTContext {
  agent: AgentSnapshot;
  deltaTime: number;
  eventBus: IEventBus;
  pathfinder: IPathfinder;
  tilemap: ITilemap;
}

// --- Interface Contracts ---

export interface IEventBus {
  emit<T>(type: EventType, payload: T): void;
  on<T>(type: EventType, handler: (event: GameEvent<T>) => void): void;
  off<T>(type: EventType, handler: (event: GameEvent<T>) => void): void;
}

export interface IPathfinder {
  findPath(start: GridCell, goal: GridCell, dynamicObstacles?: GridCell[]): PathResult;
}

export interface ITilemap {
  getWidth(): number;
  getHeight(): number;
  getTile(col: number, row: number): TileData;
  isWalkable(col: number, row: number): boolean;
  setOccupant(col: number, row: number, agentId: string | null): void;
  gridToWorld(cell: GridCell): Vec2;
  worldToGrid(pos: Vec2): GridCell;
  findNearestWalkable(target: GridCell, maxRadius?: number): GridCell;
}
