import {
  EventType,
  IEventBus,
  PipelineReport,
  TaskInfo,
  TaskStatus,
} from '../types';
import { AgentManager } from '../agent/AgentManager';
import { LLMService, LLMServiceConfig } from '../services/LLMService';
import { TaskService } from '../services/TaskService';
import { PipelineSystem } from '../pipeline/PipelineSystem';

/**
 * Central Orchestrator — the "brain" of the system.
 * 1. Receives natural language commands
 * 2. Decomposes them into tasks via LLM (or mock)
 * 3. Assigns tasks to idle agents via priority queue
 * 4. Monitors completion and triggers follow-up actions
 */
export class Orchestrator {
  private llmService: LLMService;
  private taskService: TaskService;
  private pipelineSystem: PipelineSystem;
  private dispatchInterval: number | null = null;

  constructor(
    private agentManager: AgentManager,
    private eventBus: IEventBus,
    llmConfig?: LLMServiceConfig,
  ) {
    this.llmService = new LLMService(llmConfig);
    this.taskService = new TaskService(eventBus);
    this.pipelineSystem = new PipelineSystem(agentManager, eventBus);
    this.registerEventHandlers();
  }

  /** Process a user command — the main entry point */
  async processCommand(userPrompt: string): Promise<void> {
    console.log(`[Orchestrator] Received command: "${userPrompt}"`);

    this.eventBus.emit(EventType.CommandReceived, { prompt: userPrompt });

    // Check if this command should use the CEO pipeline
    if (this.shouldUsePipeline(userPrompt)) {
      this.launchPipeline(userPrompt);
      return;
    }

    // Standard flow: decompose via LLM
    const llmResponse = await this.llmService.decomposeTasks(userPrompt);
    console.log(`[Orchestrator] LLM decomposed into ${llmResponse.tasks.length} tasks`);
    console.log(`[Orchestrator] Reasoning: ${llmResponse.reasoning}`);

    // Step 2: Create TaskInfo objects
    const tasks = this.taskService.createTasksFromDecomposition(llmResponse.tasks);
    this.eventBus.emit(EventType.TasksParsed, { tasks, reasoning: llmResponse.reasoning });

    // Step 3: Dispatch tasks to agents
    this.dispatchPendingTasks();
  }

  /**
   * Launch a CEO-driven pipeline for complex, multi-stage tasks.
   * CEO → Architect → Coder → Reviewer
   */
  launchPipeline(goal: string): void {
    console.log(`[Orchestrator] Launching CEO pipeline for: "${goal}"`);
    const pipeline = this.pipelineSystem.createPipeline(goal);
    if (!pipeline) {
      console.warn('[Orchestrator] Failed to create pipeline — falling back to standard dispatch');
      this.llmService.decomposeTasks(goal).then(llmResponse => {
        const tasks = this.taskService.createTasksFromDecomposition(llmResponse.tasks);
        this.eventBus.emit(EventType.TasksParsed, { tasks, reasoning: llmResponse.reasoning });
        this.dispatchPendingTasks();
      }).catch(err => {
        console.error('[Orchestrator] Pipeline fallback failed:', err);
      });
    }
  }

  /** Get the pipeline system for external access */
  getPipelineSystem(): PipelineSystem {
    return this.pipelineSystem;
  }

  /** Get pipeline reports */
  getPipelineReports(): PipelineReport[] {
    return this.pipelineSystem.getAllPipelines()
      .map(p => this.pipelineSystem.generateReport(p.id))
      .filter((r): r is PipelineReport => r !== null);
  }

  /** Try to assign all pending tasks to available agents */
  dispatchPendingTasks(): void {
    const pendingTasks = this.taskService.getPendingTasks();

    for (const task of pendingTasks) {
      const agent = this.agentManager.findBestAgentForTask(task);
      if (agent) {
        this.assignTaskToAgent(task, agent.id);
      }
    }
  }

  /** Start periodic dispatch loop (for queued tasks awaiting available agents) */
  startDispatchLoop(intervalMs: number = 2000): void {
    this.dispatchInterval = window.setInterval(() => {
      this.dispatchPendingTasks();
    }, intervalMs);
  }

  stopDispatchLoop(): void {
    if (this.dispatchInterval !== null) {
      clearInterval(this.dispatchInterval);
      this.dispatchInterval = null;
    }
  }

  getTaskReport() {
    return this.taskService.getCompletionReport();
  }

  getTaskService(): TaskService {
    return this.taskService;
  }

  private assignTaskToAgent(task: TaskInfo, agentId: string): void {
    const agent = this.agentManager.getAgent(agentId);
    if (!agent) return;

    this.taskService.markAssigned(task.id, agentId);
    agent.assignTask(task);

    this.eventBus.emit(EventType.TaskAssigned, {
      taskId: task.id,
      agentId,
      taskDescription: task.description,
    });

    console.log(`[Orchestrator] Assigned "${task.description}" to ${agent.name} (${agent.role})`);
  }

  /**
   * Determine if a command is complex enough to warrant the full CEO pipeline.
   * Keywords that trigger pipeline mode: multi-step projects, full features, optimization requests.
   */
  private shouldUsePipeline(prompt: string): boolean {
    const pipelineKeywords = [
      '파이프라인', 'pipeline', 'ceo',
      '팀 구성', '팀을 구성', '에이전트 팀',
      '프로젝트', 'project',
      '최적화', 'optimize', 'optimization',
      '전체 리뷰', 'full review',
      '자동화', 'automate',
      '설계부터', '기획부터',
      '알고리즘 개선', '로직 고도화',
      '풀스택', 'fullstack', 'full-stack',
    ];
    const lower = prompt.toLowerCase();
    return pipelineKeywords.some(kw => lower.includes(kw));
  }

  private registerEventHandlers(): void {
    // When a task completes, try to dispatch remaining pending tasks
    this.eventBus.on(EventType.TaskCompleted, (event) => {
      const payload = event.payload as { taskId: string; agentId: string };
      this.taskService.markCompleted(payload.taskId);
      console.log(`[Orchestrator] Task ${payload.taskId} completed by ${payload.agentId}`);

      // Dispatch any queued tasks now that an agent is free
      setTimeout(() => this.dispatchPendingTasks(), 500);
    });

    this.eventBus.on(EventType.TaskFailed, (event) => {
      const payload = event.payload as { taskId: string };
      this.taskService.markFailed(payload.taskId);
      console.log(`[Orchestrator] Task ${payload.taskId} failed — will retry on next dispatch`);
    });

    // Log pipeline lifecycle events
    this.eventBus.on(EventType.PipelineCompleted, (event) => {
      const payload = event.payload as { pipelineId: string; goal: string; report: PipelineReport };
      console.log(`[Orchestrator] Pipeline completed: ${payload.pipelineId}`);
      console.log(`[Orchestrator] Report:`, payload.report);
    });

    this.eventBus.on(EventType.PipelineFailed, (event) => {
      const payload = event.payload as { pipelineId: string; reason: string };
      console.log(`[Orchestrator] Pipeline failed: ${payload.pipelineId} — ${payload.reason}`);
    });
  }
}
