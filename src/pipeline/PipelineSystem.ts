import {
  AgentRole,
  EventType,
  GridCell,
  IEventBus,
  PipelineStage,
  PipelineStageInfo,
  PipelineReport,
  PipelineTask,
  TaskInfo,
  TaskPriority,
  TaskStatus,
} from '../types';
import { AgentManager } from '../agent/AgentManager';

/**
 * PipelineSystem — CEO-driven multi-agent delegation pipeline.
 *
 * Implements the PaperClip-inspired workflow:
 *   CEO (goal analysis) → Architect (design) → Coder (implement) → Reviewer (verify)
 *
 * Each stage produces an output artifact that feeds into the next stage.
 * The CEO agent coordinates the entire flow and receives the final report.
 */
export class PipelineSystem {
  private pipelines: Map<string, PipelineTask> = new Map();
  private pipelineIdCounter = 0;

  // Work locations for each pipeline role
  private readonly pipelineDesks: Record<string, GridCell> = {
    ceo:       { col: 13, row: 3 },
    architect: { col: 13, row: 5 },
    coder:     { col: 13, row: 7 },
    reviewer:  { col: 13, row: 9 },
  };

  constructor(
    private agentManager: AgentManager,
    private eventBus: IEventBus,
  ) {
    this.registerEventHandlers();
  }

  /**
   * Launch a new pipeline: CEO receives the goal and delegates through stages.
   */
  createPipeline(goal: string): PipelineTask | null {
    const pipelineId = `pipeline-${++this.pipelineIdCounter}-${Date.now()}`;

    const stages: PipelineStageInfo[] = [
      {
        stage: PipelineStage.Planning,
        agentId: null,
        agentRole: AgentRole.CEO,
        taskDescription: `[CEO] 목표 분석 및 팀 구성 계획: ${goal}`,
        status: 'pending',
        output: '',
        startedAt: null,
        completedAt: null,
      },
      {
        stage: PipelineStage.Architecture,
        agentId: null,
        agentRole: AgentRole.Architect,
        taskDescription: `[Architect] 솔루션 설계 및 구조 정의`,
        status: 'pending',
        output: '',
        startedAt: null,
        completedAt: null,
      },
      {
        stage: PipelineStage.Coding,
        agentId: null,
        agentRole: AgentRole.Coder,
        taskDescription: `[Coder] 설계 기반 구현 작업`,
        status: 'pending',
        output: '',
        startedAt: null,
        completedAt: null,
      },
      {
        stage: PipelineStage.Review,
        agentId: null,
        agentRole: AgentRole.Reviewer,
        taskDescription: `[Reviewer] 코드 품질 검증 및 피드백`,
        status: 'pending',
        output: '',
        startedAt: null,
        completedAt: null,
      },
    ];

    const pipeline: PipelineTask = {
      id: pipelineId,
      goal,
      currentStage: PipelineStage.Planning,
      stages,
      assignedAgents: {
        ceo: null,
        architect: null,
        coder: null,
        reviewer: null,
      },
      createdAt: Date.now(),
      completedAt: null,
    };

    // Try to assign agents to all roles
    const assigned = this.assignPipelineAgents(pipeline);
    if (!assigned) {
      console.warn('[Pipeline] Not enough agents available for pipeline');
      return null;
    }

    this.pipelines.set(pipelineId, pipeline);

    this.eventBus.emit(EventType.PipelineCreated, {
      pipelineId,
      goal,
      agents: pipeline.assignedAgents,
    });

    console.log(`[Pipeline] Created pipeline ${pipelineId}: "${goal}"`);

    // Kick off the first stage (CEO planning)
    this.startStage(pipeline, 0);

    return pipeline;
  }

  /** Get all active pipelines */
  getActivePipelines(): PipelineTask[] {
    return Array.from(this.pipelines.values())
      .filter(p => p.currentStage !== PipelineStage.Complete && p.currentStage !== PipelineStage.Failed);
  }

  /** Get all pipelines (including completed) */
  getAllPipelines(): PipelineTask[] {
    return Array.from(this.pipelines.values());
  }

  /** Get a specific pipeline */
  getPipeline(id: string): PipelineTask | undefined {
    return this.pipelines.get(id);
  }

  /** Generate a final report for a completed pipeline */
  generateReport(pipelineId: string): PipelineReport | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;

    const stageReports = pipeline.stages
      .filter(s => s.completedAt !== null)
      .map(s => ({
        stage: s.stage,
        agent: s.agentId || 'unassigned',
        output: s.output,
        duration: (s.completedAt || 0) - (s.startedAt || 0),
      }));

    return {
      pipelineId,
      goal: pipeline.goal,
      stages: stageReports,
      totalDuration: (pipeline.completedAt || Date.now()) - pipeline.createdAt,
      success: pipeline.currentStage === PipelineStage.Complete,
    };
  }

  /**
   * Called when a pipeline agent finishes its task.
   * Advances to the next stage or completes the pipeline.
   */
  advanceStage(pipelineId: string, stageOutput: string): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return;

    // Find current stage index
    const currentIdx = pipeline.stages.findIndex(
      s => s.status === 'in_progress'
    );
    if (currentIdx === -1) return;

    const currentStage = pipeline.stages[currentIdx];
    currentStage.status = 'completed';
    currentStage.output = stageOutput;
    currentStage.completedAt = Date.now();

    this.eventBus.emit(EventType.PipelineStageCompleted, {
      pipelineId,
      stage: currentStage.stage,
      agentId: currentStage.agentId,
      output: stageOutput,
    });

    console.log(`[Pipeline] Stage ${currentStage.stage} completed for ${pipelineId}`);

    // Check if there are more stages
    const nextIdx = currentIdx + 1;
    if (nextIdx < pipeline.stages.length) {
      // Feed output from current stage into the next stage's description
      const nextStage = pipeline.stages[nextIdx];
      nextStage.taskDescription += ` | 이전 단계 결과: ${stageOutput.substring(0, 200)}`;
      this.startStage(pipeline, nextIdx);
    } else {
      // All stages complete — pipeline finished
      pipeline.currentStage = PipelineStage.Complete;
      pipeline.completedAt = Date.now();

      this.eventBus.emit(EventType.PipelineCompleted, {
        pipelineId,
        goal: pipeline.goal,
        report: this.generateReport(pipelineId),
      });

      console.log(`[Pipeline] ✓ Pipeline ${pipelineId} completed successfully`);
    }
  }

  /** Mark a pipeline as failed */
  failPipeline(pipelineId: string, reason: string): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return;

    pipeline.currentStage = PipelineStage.Failed;

    // Mark any in-progress stage as failed
    for (const stage of pipeline.stages) {
      if (stage.status === 'in_progress') {
        stage.status = 'failed';
        stage.output = reason;
        stage.completedAt = Date.now();
      }
    }

    this.eventBus.emit(EventType.PipelineFailed, {
      pipelineId,
      reason,
    });

    console.log(`[Pipeline] ✗ Pipeline ${pipelineId} failed: ${reason}`);
  }

  /**
   * Periodic update — checks for stuck pipelines and auto-advances mock stages.
   * Called from the game loop.
   */
  update(deltaTime: number): void {
    for (const pipeline of this.pipelines.values()) {
      if (pipeline.currentStage === PipelineStage.Complete ||
          pipeline.currentStage === PipelineStage.Failed) {
        continue;
      }

      const activeStage = pipeline.stages.find(s => s.status === 'in_progress');
      if (!activeStage || !activeStage.startedAt) continue;

      // Check for stuck stages (timeout after 60 seconds)
      const elapsed = Date.now() - activeStage.startedAt;
      if (elapsed > 60000) {
        this.failPipeline(pipeline.id, `Stage ${activeStage.stage} timed out after 60s`);
      }
    }
  }

  // ─── Private Methods ───────────────────────────────────────

  private assignPipelineAgents(pipeline: PipelineTask): boolean {
    const roleMap: { key: keyof PipelineTask['assignedAgents']; role: AgentRole }[] = [
      { key: 'ceo', role: AgentRole.CEO },
      { key: 'architect', role: AgentRole.Architect },
      { key: 'coder', role: AgentRole.Coder },
      { key: 'reviewer', role: AgentRole.Reviewer },
    ];

    for (const { key, role } of roleMap) {
      const agents = this.agentManager.findIdleAgentsByRole(role);
      if (agents.length === 0) {
        // Fallback: try PM for CEO, Backend for Coder, QA for Reviewer
        const fallbackRole = this.getFallbackRole(role);
        const fallbackAgents = fallbackRole
          ? this.agentManager.findIdleAgentsByRole(fallbackRole)
          : [];
        if (fallbackAgents.length === 0) {
          console.warn(`[Pipeline] No agent available for role: ${role}`);
          return false;
        }
        pipeline.assignedAgents[key] = fallbackAgents[0].id;
      } else {
        pipeline.assignedAgents[key] = agents[0].id;
      }

      // Update the stage's agentId
      const stageForRole = pipeline.stages.find(s => s.agentRole === role);
      if (stageForRole) {
        stageForRole.agentId = pipeline.assignedAgents[key];
      }
    }

    return true;
  }

  private getFallbackRole(role: AgentRole): AgentRole | null {
    const fallbacks: Partial<Record<AgentRole, AgentRole>> = {
      [AgentRole.CEO]: AgentRole.PM,
      [AgentRole.Coder]: AgentRole.Backend,
      [AgentRole.Reviewer]: AgentRole.QA,
    };
    return fallbacks[role] ?? null;
  }

  private startStage(pipeline: PipelineTask, stageIdx: number): void {
    const stage = pipeline.stages[stageIdx];
    stage.status = 'in_progress';
    stage.startedAt = Date.now();
    pipeline.currentStage = stage.stage;

    const agentId = stage.agentId;
    if (!agentId) {
      this.failPipeline(pipeline.id, `No agent assigned for stage ${stage.stage}`);
      return;
    }

    const agent = this.agentManager.getAgent(agentId);
    if (!agent) {
      this.failPipeline(pipeline.id, `Agent ${agentId} not found for stage ${stage.stage}`);
      return;
    }

    // Get the desk location for this role
    const roleKey = this.getRoleKey(stage.agentRole);
    const targetDesk = this.pipelineDesks[roleKey] || { col: 13, row: 5 };

    const task: TaskInfo = {
      id: `${pipeline.id}-${stage.stage}`,
      description: stage.taskDescription,
      requiredRole: stage.agentRole,
      targetDesk,
      priority: TaskPriority.Critical,
      status: TaskStatus.Assigned,
      assignedAgentId: agentId,
      estimatedDuration: this.getStageDuration(stage.stage),
      progress: 0,
      parentTaskId: pipeline.id,
      createdAt: Date.now(),
    };

    agent.assignTask(task);

    this.eventBus.emit(EventType.PipelineStageStarted, {
      pipelineId: pipeline.id,
      stage: stage.stage,
      agentId,
      taskDescription: stage.taskDescription,
    });

    console.log(`[Pipeline] Stage ${stage.stage} started — agent: ${agent.name} (${agent.role})`);
  }

  private getRoleKey(role: AgentRole): string {
    const map: Partial<Record<AgentRole, string>> = {
      [AgentRole.CEO]: 'ceo',
      [AgentRole.Architect]: 'architect',
      [AgentRole.Coder]: 'coder',
      [AgentRole.Reviewer]: 'reviewer',
      // Fallback roles
      [AgentRole.PM]: 'ceo',
      [AgentRole.Backend]: 'coder',
      [AgentRole.QA]: 'reviewer',
    };
    return map[role] || 'coder';
  }

  private getStageDuration(stage: PipelineStage): number {
    const durations: Record<string, number> = {
      [PipelineStage.Planning]: 8,
      [PipelineStage.Architecture]: 12,
      [PipelineStage.Coding]: 15,
      [PipelineStage.Review]: 10,
    };
    return durations[stage] || 10;
  }

  private registerEventHandlers(): void {
    // Listen for task completions that belong to a pipeline
    this.eventBus.on(EventType.TaskCompleted, (event) => {
      const payload = event.payload as { taskId: string; agentId: string };
      const taskId = payload.taskId;

      // Check if this task belongs to a pipeline
      for (const pipeline of this.pipelines.values()) {
        const stage = pipeline.stages.find(
          s => `${pipeline.id}-${s.stage}` === taskId && s.status === 'in_progress'
        );
        if (stage) {
          // Generate mock output for this stage
          const output = this.generateStageOutput(stage, pipeline.goal);
          this.advanceStage(pipeline.id, output);
          break;
        }
      }
    });

    this.eventBus.on(EventType.TaskFailed, (event) => {
      const payload = event.payload as { taskId: string };

      for (const pipeline of this.pipelines.values()) {
        const stage = pipeline.stages.find(
          s => `${pipeline.id}-${s.stage}` === payload.taskId && s.status === 'in_progress'
        );
        if (stage) {
          this.failPipeline(pipeline.id, `Stage ${stage.stage} task failed`);
          break;
        }
      }
    });
  }

  /** Generate simulated output for each pipeline stage */
  private generateStageOutput(stage: PipelineStageInfo, goal: string): string {
    switch (stage.stage) {
      case PipelineStage.Planning:
        return `[CEO 분석 완료] 목표: "${goal}" → 팀 구성: Architect(설계), Coder(구현), Reviewer(검증). 우선순위: 핵심 로직 → 테스트 → 문서화`;

      case PipelineStage.Architecture:
        return `[설계 완료] 모듈 구조 정의, 인터페이스 설계, 의존성 그래프 작성. 핵심 컴포넌트: Controller, Service, Model 레이어 분리`;

      case PipelineStage.Coding:
        return `[구현 완료] 설계 기반 코드 작성, 단위 테스트 포함. 변경 파일 수: 4, 추가 라인: 180, 삭제 라인: 23`;

      case PipelineStage.Review:
        return `[리뷰 완료] 코드 품질: A등급. 이슈 0건(critical), 2건(minor). 성능 영향 없음. 배포 승인`;

      default:
        return `[${stage.stage}] 완료`;
    }
  }
}
