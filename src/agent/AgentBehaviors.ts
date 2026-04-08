import { BTContext, BTNodeStatus, AgentState, EventType } from '../types';
import {
  BTNode,
  SequenceNode,
  SelectorNode,
  ActionNode,
  ConditionNode,
} from './BehaviorTree';

/**
 * Factory for creating the standard Agent Behavior Tree.
 *
 * Tree structure:
 *   Selector (root)
 *   ├── Sequence [HasTask → ComputePath → MoveToTarget → ExecuteWork → ReportAndReturn]
 *   └── Action [IdleBehavior]
 */
export function createAgentBehaviorTree(): BTNode {
  return new SelectorNode([
    // Branch 1: If agent has a task, execute the full work cycle
    new SequenceNode([
      new ConditionNode(hasAssignedTask),
      new ActionNode(computePath),
      new ActionNode(moveAlongPath),
      new ActionNode(executeWork),
      new ActionNode(reportAndReturn),
    ]),
    // Branch 2: Idle behavior (wander or wait)
    new ActionNode(idleBehavior),
  ]);
}

// --- Condition Checks ---

function hasAssignedTask(ctx: BTContext): boolean {
  return ctx.agent.currentTask !== null;
}

// --- Action Nodes ---

function computePath(ctx: BTContext): BTNodeStatus {
  const task = ctx.agent.currentTask;
  if (!task) return BTNodeStatus.Failure;

  // If path already computed and not empty, skip
  if (ctx.agent.path.length > 0) return BTNodeStatus.Success;

  const currentCell = ctx.agent.gridCell;
  const targetCell = task.targetDesk;

  const result = ctx.pathfinder.findPath(currentCell, targetCell);

  if (!result.found) {
    // Try with dynamic obstacle avoidance (recompute without blocking)
    ctx.eventBus.emit(EventType.AgentPathBlocked, {
      agentId: ctx.agent.id,
      from: currentCell,
      to: targetCell,
    });
    return BTNodeStatus.Failure;
  }

  // Store path on agent (will be consumed by the Agent class)
  ctx.agent.path = result.path.slice(1); // remove starting cell
  return BTNodeStatus.Success;
}

function moveAlongPath(ctx: BTContext): BTNodeStatus {
  if (ctx.agent.state === AgentState.Moving && ctx.agent.path.length > 0) {
    return BTNodeStatus.Running; // still moving
  }

  if (ctx.agent.path.length === 0 && ctx.agent.state === AgentState.Moving) {
    // Arrived at destination
    ctx.eventBus.emit(EventType.AgentArrived, { agentId: ctx.agent.id });
    return BTNodeStatus.Success;
  }

  if (ctx.agent.state !== AgentState.Moving && ctx.agent.path.length > 0) {
    // Start moving
    ctx.eventBus.emit(EventType.AgentStateChanged, {
      agentId: ctx.agent.id,
      newState: AgentState.Moving,
    });
    return BTNodeStatus.Running;
  }

  return BTNodeStatus.Success;
}

function executeWork(ctx: BTContext): BTNodeStatus {
  const task = ctx.agent.currentTask;
  if (!task) return BTNodeStatus.Failure;

  if (ctx.agent.state !== AgentState.Working) {
    ctx.eventBus.emit(EventType.AgentStartedWork, {
      agentId: ctx.agent.id,
      taskId: task.id,
    });
    ctx.eventBus.emit(EventType.AgentStateChanged, {
      agentId: ctx.agent.id,
      newState: AgentState.Working,
    });
    return BTNodeStatus.Running;
  }

  // Progress the work
  if (ctx.agent.progress >= 1.0) {
    ctx.eventBus.emit(EventType.AgentFinishedWork, {
      agentId: ctx.agent.id,
      taskId: task.id,
    });
    return BTNodeStatus.Success;
  }

  return BTNodeStatus.Running;
}

function reportAndReturn(ctx: BTContext): BTNodeStatus {
  if (ctx.agent.state === AgentState.Returning) {
    if (ctx.agent.path.length === 0) {
      // Returned to home desk
      ctx.eventBus.emit(EventType.AgentStateChanged, {
        agentId: ctx.agent.id,
        newState: AgentState.Idle,
      });
      ctx.eventBus.emit(EventType.TaskCompleted, {
        agentId: ctx.agent.id,
        taskId: ctx.agent.currentTask?.id,
      });
      return BTNodeStatus.Success;
    }
    return BTNodeStatus.Running;
  }

  // Start returning
  ctx.eventBus.emit(EventType.AgentStateChanged, {
    agentId: ctx.agent.id,
    newState: AgentState.Returning,
  });
  return BTNodeStatus.Running;
}

// Per-agent idle state tracking
const idleTimers: Map<string, { nextActionTime: number; idleAction: 'waiting' | 'wandering' | 'coffee' | 'chatting' }> = new Map();

function idleBehavior(ctx: BTContext): BTNodeStatus {
  const agentId = ctx.agent.id;
  const now = Date.now();

  let timer = idleTimers.get(agentId);
  if (!timer) {
    // Initialize with a random delay before first idle action (3-8 seconds)
    timer = {
      nextActionTime: now + 3000 + Math.random() * 5000,
      idleAction: 'waiting',
    };
    idleTimers.set(agentId, timer);
  }

  // If currently wandering and path is being followed, keep running
  if (timer.idleAction === 'wandering' && ctx.agent.path.length > 0) {
    return BTNodeStatus.Running;
  }

  // If we finished wandering, go back to waiting with new timer
  if (timer.idleAction === 'wandering' && ctx.agent.path.length === 0) {
    timer.idleAction = 'waiting';
    timer.nextActionTime = now + 4000 + Math.random() * 6000;
    // Return to idle state
    if (ctx.agent.state !== AgentState.Idle) {
      ctx.eventBus.emit(EventType.AgentStateChanged, {
        agentId: ctx.agent.id,
        newState: AgentState.Idle,
      });
    }
    return BTNodeStatus.Running;
  }

  // Not time for next action yet
  if (now < timer.nextActionTime) return BTNodeStatus.Running;

  // Pick a random idle action
  const roll = Math.random();
  if (roll < 0.4) {
    // 40% chance: random wander to a nearby walkable tile
    const currentCell = ctx.agent.gridCell;
    const offsets = [
      { col: -2, row: 0 }, { col: 2, row: 0 },
      { col: 0, row: -2 }, { col: 0, row: 2 },
      { col: -1, row: -1 }, { col: 1, row: 1 },
    ];
    const offset = offsets[Math.floor(Math.random() * offsets.length)];
    const target = { col: currentCell.col + offset.col, row: currentCell.row + offset.row };

    if (ctx.tilemap.isWalkable(target.col, target.row)) {
      const result = ctx.pathfinder.findPath(currentCell, target);
      if (result.found && result.path.length > 1) {
        ctx.agent.path = result.path.slice(1);
        timer.idleAction = 'wandering';
        ctx.eventBus.emit(EventType.AgentStateChanged, {
          agentId: ctx.agent.id,
          newState: AgentState.Moving,
        });
        return BTNodeStatus.Running;
      }
    }

    // Couldn't wander — just reset timer
    timer.nextActionTime = now + 3000 + Math.random() * 5000;
  } else if (roll < 0.6) {
    // 20% chance: coffee break (just switch to waiting state briefly)
    timer.idleAction = 'coffee';
    timer.nextActionTime = now + 5000 + Math.random() * 3000;
    if (ctx.agent.state !== AgentState.Waiting) {
      ctx.eventBus.emit(EventType.AgentStateChanged, {
        agentId: ctx.agent.id,
        newState: AgentState.Waiting,
      });
    }
  } else {
    // 40% chance: just wait longer
    timer.idleAction = 'waiting';
    timer.nextActionTime = now + 5000 + Math.random() * 8000;
    if (ctx.agent.state !== AgentState.Idle) {
      ctx.eventBus.emit(EventType.AgentStateChanged, {
        agentId: ctx.agent.id,
        newState: AgentState.Idle,
      });
    }
  }

  return BTNodeStatus.Running;
}
