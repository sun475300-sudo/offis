import {
  EventType,
  IEventBus,
  TaskInfo,
  TaskStatus,
} from '../types';
import { AgentManager } from '../agent/AgentManager';
import { LLMService, LLMServiceConfig } from '../services/LLMService';
import { TaskService } from '../services/TaskService';

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
  private dispatchInterval: number | null = null;

  constructor(
    private agentManager: AgentManager,
    private eventBus: IEventBus,
    llmConfig?: LLMServiceConfig,
  ) {
    this.llmService = new LLMService(llmConfig);
    this.taskService = new TaskService(eventBus);
    this.registerEventHandlers();
  }

  /** Process a user command — the main entry point */
  async processCommand(userPrompt: string): Promise<void> {
    console.log(`[Orchestrator] Received command: "${userPrompt}"`);

    this.eventBus.emit(EventType.CommandReceived, { prompt: userPrompt });

    // Step 1: Decompose via LLM
    const llmResponse = await this.llmService.decomposeTasks(userPrompt);
    console.log(`[Orchestrator] LLM decomposed into ${llmResponse.tasks.length} tasks`);
    console.log(`[Orchestrator] Reasoning: ${llmResponse.reasoning}`);

    // Step 2: Create TaskInfo objects
    const tasks = this.taskService.createTasksFromDecomposition(llmResponse.tasks);
    this.eventBus.emit(EventType.TasksParsed, { tasks, reasoning: llmResponse.reasoning });

    // Step 3: Dispatch tasks to agents
    this.dispatchPendingTasks();
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
  }
}
