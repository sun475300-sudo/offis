import { BTContext, BTNodeStatus } from '../types';

// ============================================================
// Behavior Tree Engine
// Provides Composite (Selector, Sequence), Decorator, and Leaf nodes
// for modular, reusable agent AI.
// ============================================================

export abstract class BTNode {
  abstract tick(ctx: BTContext): BTNodeStatus;
  reset(): void {}
}

/** Runs children in order; fails on first failure, succeeds when all succeed */
export class SequenceNode extends BTNode {
  private children: BTNode[];
  private currentIndex: number = 0;

  constructor(children: BTNode[]) {
    super();
    this.children = children;
  }

  tick(ctx: BTContext): BTNodeStatus {
    while (this.currentIndex < this.children.length) {
      const status = this.children[this.currentIndex].tick(ctx);
      if (status === BTNodeStatus.Running) return BTNodeStatus.Running;
      if (status === BTNodeStatus.Failure) {
        this.currentIndex = 0;
        return BTNodeStatus.Failure;
      }
      this.currentIndex++;
    }
    this.currentIndex = 0;
    return BTNodeStatus.Success;
  }

  reset(): void {
    this.currentIndex = 0;
    for (const child of this.children) child.reset();
  }
}

/** Tries children in order; succeeds on first success, fails when all fail */
export class SelectorNode extends BTNode {
  private children: BTNode[];
  private currentIndex: number = 0;

  constructor(children: BTNode[]) {
    super();
    this.children = children;
  }

  tick(ctx: BTContext): BTNodeStatus {
    while (this.currentIndex < this.children.length) {
      const status = this.children[this.currentIndex].tick(ctx);
      if (status === BTNodeStatus.Running) return BTNodeStatus.Running;
      if (status === BTNodeStatus.Success) {
        this.currentIndex = 0;
        return BTNodeStatus.Success;
      }
      this.currentIndex++;
    }
    this.currentIndex = 0;
    return BTNodeStatus.Failure;
  }

  reset(): void {
    this.currentIndex = 0;
    for (const child of this.children) child.reset();
  }
}

/** Inverts the result of its child */
export class InverterNode extends BTNode {
  constructor(private child: BTNode) {
    super();
  }

  tick(ctx: BTContext): BTNodeStatus {
    const status = this.child.tick(ctx);
    if (status === BTNodeStatus.Success) return BTNodeStatus.Failure;
    if (status === BTNodeStatus.Failure) return BTNodeStatus.Success;
    return BTNodeStatus.Running;
  }
}

/** Repeats child until it fails */
export class RepeatUntilFailNode extends BTNode {
  constructor(private child: BTNode) {
    super();
  }

  tick(ctx: BTContext): BTNodeStatus {
    const status = this.child.tick(ctx);
    if (status === BTNodeStatus.Failure) return BTNodeStatus.Success;
    return BTNodeStatus.Running;
  }
}

/** Leaf node that runs a custom function */
export class ActionNode extends BTNode {
  constructor(private action: (ctx: BTContext) => BTNodeStatus) {
    super();
  }

  tick(ctx: BTContext): BTNodeStatus {
    return this.action(ctx);
  }
}

/** Leaf node that checks a condition */
export class ConditionNode extends BTNode {
  constructor(private condition: (ctx: BTContext) => boolean) {
    super();
  }

  tick(ctx: BTContext): BTNodeStatus {
    return this.condition(ctx) ? BTNodeStatus.Success : BTNodeStatus.Failure;
  }
}
