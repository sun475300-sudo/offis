import {
  AgentState,
  EventType,
  IEventBus,
  ITilemap,
  TaskInfo,
  TaskStatus,
} from '../types';
import { AgentManager } from '../agent/AgentManager';
import { LLMService, LLMServiceConfig } from '../services/LLMService';
import { TaskService } from '../services/TaskService';
import { GitHubService, GitHubPullRequest } from '../services/GitHubService';
import { DebateManager } from '../debate/DebateManager';

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
    private tilemap: ITilemap,
    private gitHubService: GitHubService,
    private debateManager: DebateManager,
    llmConfig?: LLMServiceConfig,
  ) {
    this.llmService = new LLMService(llmConfig);
    this.taskService = new TaskService(eventBus, tilemap);
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

  /** Start a technical workflow derived from a GitHub Pull Request */
  async handleGitHubWorkflow(owner: string, repo: string, prNumber: number): Promise<void> {
    console.log(`[Orchestrator] Starting GitHub Workflow for ${owner}/${repo} PR #${prNumber}`);
    
    this.eventBus.emit(EventType.CommandReceived, { prompt: `/github ${owner}/${repo} ${prNumber}` });

    try {
      // 1. Fetch PR Data
      const pr = await this.gitHubService.getPullRequest(owner, repo, prNumber);
      const diff = await this.gitHubService.getPRDiff(owner, repo, prNumber);
      
      this.eventBus.emit(EventType.TasksParsed, { 
        tasks: [], // Empty initially
        reasoning: `GitHub PR #${prNumber} 분석 중... (Title: ${pr.title})` 
      });

      // 2. Technical Decomposition (Prompt with PR context)
      const technicalPrompt = `
        다음 GitHub Pull Request를 분석하고 리뷰 태스크를 생성해주세요.
        PR 제목: ${pr.title}
        작성자: ${pr.author}
        내용: ${pr.body}
        
        코드 변경 요약 (Diff):
        ${diff.substring(0, 3000)} // LLM context limit safeguard
      `;

      const llmResponse = await this.llmService.decomposeTasks(technicalPrompt);
      
      // 3. Create Tasks
      const tasks = this.taskService.createTasksFromDecomposition(llmResponse.tasks);
      this.eventBus.emit(EventType.TasksParsed, { tasks, reasoning: `GitHub PR 리뷰 자동 배정: ${llmResponse.reasoning}` });

      // 4. Dispatch
      this.dispatchPendingTasks();

      // 5. Trigger Technical Debate (Visualization handled by main/HUD)
      const session = await this.debateManager.startDebate(diff, `PR #${prNumber}: ${pr.title}`);
      this.eventBus.emit(EventType.TechnicalDebateTriggered, { sessionId: session.id });

    } catch (error) {
      console.error('[Orchestrator] GitHub Workflow failed:', error);
      this.eventBus.emit(EventType.TaskFailed, { agentId: 'system', taskId: 'github-wf', reason: 'GitHub API 연동 실패' });
    }
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
      this.checkStaleTasks();
    }, intervalMs);
  }

  private checkStaleTasks(): void {
    const activeTasks = this.taskService
      .getAllTasks()
      .filter(t => t.status === TaskStatus.Assigned || t.status === TaskStatus.InProgress);

    const STALE_TIMEOUT = 15000; // 15 seconds of no observable progress
    const now = Date.now();

    for (const task of activeTasks) {
      // Skip tasks whose agent is actively progressing. pulseTask isn't
      // called anywhere, so relying on lastPulse alone killed long
      // tasks (estimatedDuration > 15s) even while the agent was
      // clearly still working/moving/returning.
      if (task.assignedAgentId) {
        const agent = this.agentManager.getAgent(task.assignedAgentId);
        const state = agent?.getState();
        if (state === AgentState.Working || state === AgentState.Moving || state === AgentState.Returning) {
          continue;
        }
      }

      const pulse = task.lastPulse || task.createdAt;
      if (now - pulse > STALE_TIMEOUT) {
        console.warn(`[Orchestrator] Task "${task.description}" stalled — resetting to Pending`);
        task.status = TaskStatus.Pending;
        task.assignedAgentId = null;
        task.lastPulse = now; // reset watchdog so we don't re-trigger next tick
        // Previously also emitted TaskFailed here, but this class's own
        // TaskFailed handler runs markFailed(taskId), which flips the
        // status we just set back to Pending straight to Failed.
      }
    }
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
