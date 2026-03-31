import { BTContext, BTNodeStatus, AgentState } from '../types';
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
    return BTNodeStatus.Failure;
  }

  // Path is already assigned by the Agent class in assignTask()
  return BTNodeStatus.Success;
}

function moveAlongPath(ctx: BTContext): BTNodeStatus {
  if (ctx.agent.state === AgentState.Moving && ctx.agent.path.length > 0) {
    return BTNodeStatus.Running; // still moving
  }

  if (ctx.agent.path.length === 0 && ctx.agent.state === AgentState.Moving) {
    // Arrived at destination — Agent class handles events in onArrived()
    return BTNodeStatus.Success;
  }

  if (ctx.agent.state !== AgentState.Moving && ctx.agent.path.length > 0) {
    // Moving — Agent class handles state transitions
    return BTNodeStatus.Running;
  }

  return BTNodeStatus.Success;
}

function executeWork(ctx: BTContext): BTNodeStatus {
  const task = ctx.agent.currentTask;
  if (!task) return BTNodeStatus.Failure;

  if (ctx.agent.state !== AgentState.Working) {
    // Agent class handles state transitions and event emissions
    return BTNodeStatus.Running;
  }

  // Progress the work — Agent class handles AgentFinishedWork event in onWorkCompleted()
  if (ctx.agent.progress >= 1.0) {
    return BTNodeStatus.Success;
  }

  return BTNodeStatus.Running;
}

function reportAndReturn(ctx: BTContext): BTNodeStatus {
  if (ctx.agent.state === AgentState.Returning) {
    if (ctx.agent.path.length === 0) {
      // Returned to home desk — Agent class handles state transition and task completion
      return BTNodeStatus.Success;
    }
    return BTNodeStatus.Running;
  }

  // Agent class handles the transition to Returning state
  return BTNodeStatus.Running;
}

function idleBehavior(_ctx: BTContext): BTNodeStatus {
  // Agent is idle — just wait for next task assignment
  return BTNodeStatus.Running;
}
