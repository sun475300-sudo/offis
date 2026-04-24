import {
  AgentConfig,
  AgentRole,
  AgentSnapshot,
  AgentState,
  BTContext,
  BTNodeStatus,
  EventType,
  GridCell,
  IEventBus,
  IPathfinder,
  ITilemap,
  TaskInfo,
  Vec2,
} from '../types';
import { BTNode } from './BehaviorTree';
import { createAgentBehaviorTree, clearIdleTimer } from './AgentBehaviors';
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

  // Stuck Detection
  private lastPos: Vec2 = { x: 0, y: 0 };
  private stuckTicks: number = 0;
  private readonly STUCK_THRESHOLD = 5; // Re-path after 5 ticks of no progress

  // Bug 6 fix: provider for other agents' occupied cells
  private occupiedCellsProvider: (() => GridCell[]) | null = null;

  // Bug fix: store event handler to allow cleanup on destroy
  private stateChangeHandler: ((event: any) => void) | null = null;

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

  /** Bug 6 fix: inject a provider for dynamic obstacle positions */
  setOccupiedCellsProvider(provider: () => GridCell[]): void {
    this.occupiedCellsProvider = provider;
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
      } else {
        // Fix: emit failure event and release task so agent can be reassigned
        console.warn(`[Agent ${this.name}] Path to task "${task.description}" not found ? releasing task`);
        this.eventBus.emit(EventType.TaskFailed, {
          taskId: task.id,
          agentId: this.id,
          reason: 'pathfinding_failed',
        });
        this.currentTask = null;
      }
    }
  }

  applyAvoidanceOffset(offset: Vec2): void {
    this.avoidanceOffset = offset;
  }

  update(deltaTime: number): void {
    // Tick behavior tree with a snapshot; sync mutations back afterward
    const snapshot = this.getSnapshot();
    const ctx: BTContext = {
      agent: snapshot,
      deltaTime,
      eventBus: this.eventBus,
      pathfinder: this.pathfinder,
      tilemap: this.tilemap,
    };
    this.behaviorTree.tick(ctx);

    // Bug 2 fix: sync BT-computed path back to the real agent
    if (snapshot.path.length > 0 && this.path.length === 0) {
      this.path = snapshot.path;
    }

    // Fix: recover from stuck state (task assigned but idle with no path)
    if (this.currentTask && this.path.length === 0 && this.state === AgentState.Idle) {
      const retryResult = this.pathfinder.findPath(this.gridCell, this.currentTask.targetDesk);
      if (retryResult.found && retryResult.path.length > 1) {
        this.path = retryResult.path.slice(1);
        this.setState(AgentState.Moving);
      }
    }

    // Process movement
    if (this.state === AgentState.Moving || this.state === AgentState.Returning) {
      this.checkStuckStatus();
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
      } else if (this.state === AgentState.Returning) {
        // Bug 5 fix: agent arrived home — transition to Idle and release task
        this.setState(AgentState.Idle);
        this.completeTask();
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

    // Start returning home with dynamic avoidance
    const obstacles = this.getOccupiedCells();
    const result = this.pathfinder.findPath(this.gridCell, this.homeDesk, obstacles);
    if (result.found) {
      this.path = result.path.slice(1);
      this.setState(AgentState.Returning);
    } else {
      // Fallback: simple path if blocked
      const fallback = this.pathfinder.findPath(this.gridCell, this.homeDesk);
      if (fallback.found) {
        this.path = fallback.path.slice(1);
        this.setState(AgentState.Returning);
      } else {
        this.setState(AgentState.Idle);
        this.completeTask();
      }
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
    // Listen for state change events (from behavior tree)
    this.stateChangeHandler = (event) => {
      const payload = event.payload as { agentId: string; newState: AgentState };
      if (payload.agentId !== this.id) return;

      if (payload.newState === AgentState.Returning && this.state === AgentState.Working) {
        // Compute path home
        const result = this.pathfinder.findPath(this.gridCell, this.homeDesk);
        if (result.found) {
          this.path = result.path.slice(1);
        }
      }
    };
    this.eventBus.on(EventType.AgentStateChanged, this.stateChangeHandler);
  }

  /** Bug fix: cleanup event handlers to prevent memory leak */
  destroy(): void {
    if (this.stateChangeHandler) {
      this.eventBus.off(EventType.AgentStateChanged, this.stateChangeHandler);
      this.stateChangeHandler = null;
    }
    // Drop this agent's idle-timer entry from the module-level Map in
    // AgentBehaviors so it doesn't accumulate across spawn/despawn cycles.
    clearIdleTimer(this.id);
  }

  private getOccupiedCells(): GridCell[] {
    // Bug 6 fix: delegate to the provider injected by AgentManager
    return this.occupiedCellsProvider ? this.occupiedCellsProvider() : [];
  }

  private checkStuckStatus(): void {
    const dist = Math.sqrt(
      Math.pow(this.position.x - this.lastPos.x, 2) + 
      Math.pow(this.position.y - this.lastPos.y, 2)
    );

    if (dist < 0.1) {
      this.stuckTicks++;
    } else {
      this.stuckTicks = 0;
      this.lastPos = { ...this.position };
    }

    if (this.stuckTicks > this.STUCK_THRESHOLD && this.currentTask) {
      console.log(`[Agent ${this.name}] Stuck detected - forcing path recalculation`);
      const obstacles = this.getOccupiedCells();
      const result = this.pathfinder.findPath(this.gridCell, this.currentTask.targetDesk, obstacles);
      if (result.found) {
        this.path = result.path.slice(1);
      }
      this.stuckTicks = 0;
    }
  }
}
