import {
  AgentConfig,
  AgentRole,
  AgentSnapshot,
  AgentState,
  BTContext,
  EventType,
  GridCell,
  IEventBus,
  IPathfinder,
  ITilemap,
  TaskInfo,
  Vec2,
} from '../types';
import { BTNode } from './BehaviorTree';
import { createAgentBehaviorTree } from './AgentBehaviors';
import { TILE_SIZE } from '../spatial/Tilemap';

export class Agent {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly homeDesk: GridCell;
  readonly speed: number;
  readonly color: number;

  private state: AgentState = AgentState.Idle;
  private position: Vec2;
  private gridCell: GridCell;
  private currentTask: TaskInfo | null = null;
  private path: GridCell[] = [];
  private progress: number = 0;
  private behaviorTree: BTNode;

  // Interpolation state
  private moveTarget: Vec2 | null = null;
  private avoidanceOffset: Vec2 = { x: 0, y: 0 };
  private occupiedCells: GridCell[] = [];
  private stateChangeHandler!: (event: { payload: unknown }) => void;

  constructor(
    config: AgentConfig,
    private tilemap: ITilemap,
    private pathfinder: IPathfinder,
    private eventBus: IEventBus,
  ) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.homeDesk = config.homeDesk;
    this.speed = config.speed;
    this.color = config.color;
    this.gridCell = config.homeDesk;
    this.position = tilemap.gridToWorld(config.homeDesk);
    this.behaviorTree = createAgentBehaviorTree();

    this.registerEventHandlers();
  }

  getSnapshot(): AgentSnapshot {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      state: this.state,
      position: { ...this.position },
      gridCell: { ...this.gridCell },
      currentTask: this.currentTask,
      progress: this.progress,
      path: [...this.path],
    };
  }

  getState(): AgentState {
    return this.state;
  }

  getPosition(): Vec2 {
    return this.position;
  }

  isIdle(): boolean {
    return this.state === AgentState.Idle;
  }

  assignTask(task: TaskInfo): void {
    this.currentTask = task;
    this.progress = 0;
    this.path = [];

    // Compute path to task target
    const obstacles = this.getOccupiedCells();
    const result = this.pathfinder.findPath(this.gridCell, task.targetDesk, obstacles);

    if (result.found) {
      this.path = result.path.slice(1); // drop current cell
      this.setState(AgentState.Moving);
    } else {
      // Retry without dynamic obstacles
      const fallback = this.pathfinder.findPath(this.gridCell, task.targetDesk);
      if (fallback.found) {
        this.path = fallback.path.slice(1);
        this.setState(AgentState.Moving);
      }
    }
  }

  applyAvoidanceOffset(offset: Vec2): void {
    this.avoidanceOffset = offset;
  }

  setOccupiedCells(cells: GridCell[]): void {
    this.occupiedCells = cells;
  }

  update(deltaTime: number): void {
    // Tick behavior tree
    const ctx: BTContext = {
      agent: this.getSnapshot(),
      deltaTime,
      eventBus: this.eventBus,
      pathfinder: this.pathfinder,
      tilemap: this.tilemap,
    };
    this.behaviorTree.tick(ctx);

    // Process movement
    if (this.state === AgentState.Moving || this.state === AgentState.Returning) {
      this.processMovement(deltaTime);
    }

    // Process work progress
    if (this.state === AgentState.Working && this.currentTask) {
      const workRate = 1.0 / this.currentTask.estimatedDuration;
      this.progress = Math.min(1.0, this.progress + workRate * deltaTime);

      if (this.progress >= 1.0) {
        this.onWorkCompleted();
      }
    }
  }

  private processMovement(deltaTime: number): void {
    if (this.path.length === 0) {
      if (this.state === AgentState.Moving) {
        this.onArrived();
      }
      return;
    }

    // Get next waypoint
    if (!this.moveTarget) {
      const nextCell = this.path[0];
      this.moveTarget = this.tilemap.gridToWorld(nextCell);
    }

    // Lerp toward target with delta time
    const targetX = this.moveTarget.x + this.avoidanceOffset.x;
    const targetY = this.moveTarget.y + this.avoidanceOffset.y;
    const dx = targetX - this.position.x;
    const dy = targetY - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const moveDistance = this.speed * TILE_SIZE * deltaTime;

    if (dist <= moveDistance) {
      // Arrived at this waypoint
      this.position.x = this.moveTarget.x;
      this.position.y = this.moveTarget.y;

      // Update grid cell
      const oldCell = this.gridCell;
      this.gridCell = this.path.shift()!;
      this.moveTarget = null;
      this.avoidanceOffset = { x: 0, y: 0 };

      // Update tilemap occupancy
      this.tilemap.setOccupant(oldCell.col, oldCell.row, null);
      this.tilemap.setOccupant(this.gridCell.col, this.gridCell.row, this.id);
    } else {
      // Move toward target
      const nx = dx / dist;
      const ny = dy / dist;
      this.position.x += nx * moveDistance;
      this.position.y += ny * moveDistance;
    }
  }

  private onArrived(): void {
    if (this.currentTask) {
      this.setState(AgentState.Working);
      this.eventBus.emit(EventType.AgentArrived, { agentId: this.id });
      this.eventBus.emit(EventType.AgentStartedWork, {
        agentId: this.id,
        taskId: this.currentTask.id,
      });
    }
  }

  private onWorkCompleted(): void {
    this.eventBus.emit(EventType.AgentFinishedWork, {
      agentId: this.id,
      taskId: this.currentTask?.id,
    });

    // Start returning home
    const result = this.pathfinder.findPath(this.gridCell, this.homeDesk);
    if (result.found) {
      this.path = result.path.slice(1);
      this.setState(AgentState.Returning);
    } else {
      this.setState(AgentState.Idle);
      this.completeTask();
    }
  }

  private completeTask(): void {
    if (this.currentTask) {
      this.eventBus.emit(EventType.TaskCompleted, {
        agentId: this.id,
        taskId: this.currentTask.id,
      });
      this.currentTask = null;
      this.progress = 0;
    }
  }

  private setState(newState: AgentState): void {
    const old = this.state;
    this.state = newState;
    this.eventBus.emit(EventType.AgentStateChanged, {
      agentId: this.id,
      oldState: old,
      newState,
    });
  }

  private registerEventHandlers(): void {
    this.stateChangeHandler = (event) => {
      const payload = event.payload as { agentId: string; newState: AgentState };
      // Skip own events to avoid redundant path computation
      if (payload.agentId === this.id) return;
    };
    this.eventBus.on(EventType.AgentStateChanged, this.stateChangeHandler as any);
  }

  /** Clean up event listeners to prevent ghost handlers */
  destroy(): void {
    this.eventBus.off(EventType.AgentStateChanged, this.stateChangeHandler as any);
  }

  private getOccupiedCells(): GridCell[] {
    return this.occupiedCells;
  }
}
