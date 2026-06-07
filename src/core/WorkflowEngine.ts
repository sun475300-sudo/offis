export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  params?: Record<string, unknown>;
  condition?: string;
  onSuccess?: string;
  onFailure?: string;
  retry?: number;
  delay?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  currentStep: number;
  createdAt: number;
  updatedAt: number;
  context: Record<string, unknown>;
}

export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  stepsExecuted: number;
  output?: unknown;
  error?: string;
}

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private workflows: Map<string, Workflow> = new Map();
  private readonly maxWorkflows = 500;
  private activeWorkflows: Set<string> = new Set();
  private stepHandlers: Map<string, (params: Record<string, unknown>, context: Record<string, unknown>) => Promise<unknown>> = new Map();

  private constructor() {
    this.registerDefaultHandlers();
  }

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  private registerDefaultHandlers(): void {
    this.registerHandler('log', async (params) => {
      console.log(`[Workflow] ${params.message}`);
      return params.message;
    });

    this.registerHandler('delay', async (params) => {
      const ms = (params.ms as number) || 1000;
      await new Promise(resolve => setTimeout(resolve, ms));
      return true;
    });

    this.registerHandler('setContext', async (params, context) => {
      context[params.key as string] = params.value;
      return context[params.key as string];
    });

    this.registerHandler('condition', async (params, context) => {
      const expr = params.expression as string;
      try {
        const keys = Object.keys(context);
        let result = expr;
        for (const key of keys) {
          if (typeof context[key] === 'string' || typeof context[key] === 'number') {
            result = result.replace(new RegExp(`\\$${key}`, 'g'), String(context[key]));
          }
        }
        // Reject anything that isn't a simple numeric/boolean comparison
        // before handing it to the evaluator — the previous eval() would
        // happily run arbitrary JS pulled from workflow definitions.
        if (!/^[\s\d\w."'<>=!&|()+\-*/%]+$/.test(result)) return false;
        // eslint-disable-next-line no-new-func
        return Boolean(new Function(`"use strict"; return (${result});`)());
      } catch {
        return false;
      }
    });
  }

  registerHandler(action: string, handler: (params: Record<string, unknown>, context: Record<string, unknown>) => Promise<unknown>): void {
    this.stepHandlers.set(action, handler);
  }

  createWorkflow(id: string, name: string, steps: Omit<WorkflowStep, 'id'>[], description?: string): Workflow {
    const workflow: Workflow = {
      id,
      name,
      description,
      steps: steps.map((s, i) => ({ ...s, id: `step-${i}` })),
      status: 'idle',
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: {}
    };
    this.workflows.set(id, workflow);
    // Evict terminal-state workflows first (completed/failed), then
    // FIFO, but never touch one that's mid-run.
    if (this.workflows.size > this.maxWorkflows) {
      const toDrop = this.workflows.size - this.maxWorkflows;
      const dropKeys: string[] = [];
      for (const [k, w] of this.workflows) {
        if (this.activeWorkflows.has(k)) continue;
        if (w.status === 'completed' || w.status === 'failed') {
          dropKeys.push(k);
          if (dropKeys.length >= toDrop) break;
        }
      }
      if (dropKeys.length < toDrop) {
        for (const k of this.workflows.keys()) {
          if (this.activeWorkflows.has(k)) continue;
          if (!dropKeys.includes(k)) dropKeys.push(k);
          if (dropKeys.length >= toDrop) break;
        }
      }
      for (const k of dropKeys) this.workflows.delete(k);
    }
    return workflow;
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  async runWorkflow(id: string): Promise<WorkflowResult> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      return { workflowId: id, success: false, stepsExecuted: 0, error: 'Workflow not found' };
    }

    workflow.status = 'running';
    workflow.currentStep = 0;
    this.activeWorkflows.add(id);

    let stepsExecuted = 0;
    let lastError: string | undefined;

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        // Honor pauseWorkflow() between steps: poll until the user
        // resumes (or cancels by deleting / setting failed). Without
        // this, pauseWorkflow flipped status to 'paused' but the loop
        // kept executing, making the pause feature a no-op. Read via a
        // local widened reference so TS doesn't narrow status to the
        // literal we set above (status mutates from other methods).
        const liveStatus = () => (workflow as { status: WorkflowStatus }).status;
        while (liveStatus() === 'paused') {
          await new Promise(r => setTimeout(r, 100));
        }
        if (liveStatus() !== 'running') {
          return { workflowId: id, success: false, stepsExecuted, error: `Workflow ${liveStatus()}` };
        }

        const step = workflow.steps[i];
        workflow.currentStep = i;
        workflow.updatedAt = Date.now();

        if (step.condition) {
          const handler = this.stepHandlers.get('condition');
          if (handler) {
            const result = await handler({ expression: step.condition }, workflow.context);
            if (!result) {
              if (step.onFailure) {
                workflow.context['failureAction'] = step.onFailure;
              }
              continue;
            }
          }
        }

        if (step.delay) {
          await new Promise(resolve => setTimeout(resolve, step.delay));
        }

        let attempt = 0;
        const maxRetries = step.retry ?? 0;
        let success = false;

        while (attempt <= maxRetries && !success) {
          try {
            const handler = this.stepHandlers.get(step.action);
            if (!handler) {
              throw new Error(`No handler for action: ${step.action}`);
            }
            const result = await handler(step.params || {}, workflow.context);
            workflow.context[`${step.id}_result`] = result;
            success = true;
          } catch (error) {
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
          }
        }

        stepsExecuted++;
      }

      workflow.status = 'completed';
      workflow.updatedAt = Date.now();
      return { workflowId: id, success: true, stepsExecuted, output: workflow.context };
    } catch (error) {
      workflow.status = 'failed';
      lastError = error instanceof Error ? error.message : String(error);
      return { workflowId: id, success: false, stepsExecuted, error: lastError };
    } finally {
      this.activeWorkflows.delete(id);
    }
  }

  pauseWorkflow(id: string): boolean {
    const workflow = this.workflows.get(id);
    if (workflow && workflow.status === 'running') {
      workflow.status = 'paused';
      return true;
    }
    return false;
  }

  resumeWorkflow(id: string): boolean {
    const workflow = this.workflows.get(id);
    if (workflow && workflow.status === 'paused') {
      workflow.status = 'running';
      return true;
    }
    return false;
  }

  deleteWorkflow(id: string): boolean {
    if (this.activeWorkflows.has(id)) {
      return false;
    }
    return this.workflows.delete(id);
  }

  getActiveWorkflows(): string[] {
    return Array.from(this.activeWorkflows);
  }
}

export const workflowEngine = WorkflowEngine.getInstance();