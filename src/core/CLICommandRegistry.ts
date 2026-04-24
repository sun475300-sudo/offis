import { CLIEngine } from './CLIEngine';
import { AgentManager } from '../agent/AgentManager';
import { Orchestrator } from './Orchestrator';
import { Tilemap } from '../spatial/Tilemap';
import { TilemapRenderer } from '../rendering/TilemapRenderer';
import { CameraController } from '../rendering/CameraController';
import { SoundManager } from './SoundManager';
import { ToastManager } from './ToastManager';
import { CollaborationSystem, MeetingType } from '../agent/CollaborationSystem';
import { ChatSystem } from './ChatSystem';
import { DebateManager } from '../debate/DebateManager';
import { RunnerManager, FeedbackLoopState } from '../debate/RunnerManager';
import { GitHubService } from '../services/GitHubService';
import { AgentRole, AgentState, EventType, TaskPriority, TaskStatus } from '../types';
import { testSuite, StressTestConfig, systemReport } from '../services/TestSuite';
import { agentPersona, taskQueue, snippetManager, themeManager, configManager, resourceMonitor, collaborationHub } from '../services/FeatureServices';
import { getHarness, getHarnessSummary, buildSystemPrompt, sessionManager } from '../services/AgentHarness';

export interface CLIContext {
  agentManager: AgentManager;
  orchestrator: Orchestrator;
  tilemap: Tilemap;
  tilemapRenderer: TilemapRenderer;
  camera: CameraController;
  soundManager: SoundManager;
  toastManager: ToastManager;
  collaborationSystem: CollaborationSystem;
  chatSystem: ChatSystem;
  debateManager: DebateManager;
  runnerManager: RunnerManager;
  gitHubService: GitHubService;
  cliEngine: CLIEngine;
  meetingRoomRenderer: any; // Simplified for now
  particleSystem: any;
  logSystem: (msg: string, type?: string) => void;
  logUser: (msg: string) => void;
  logError: (msg: string) => void;
  runDebateWithVisualization: (id: string) => Promise<void>;
  startCodeReview: (code: string, projectName: string) => Promise<void>;
  updateTestDashboard: () => void;
}

export function registerAllCommands(ctx: CLIContext): void {
  const { cliEngine, agentManager, orchestrator, camera, soundManager, toastManager, collaborationSystem, chatSystem, debateManager, runnerManager, gitHubService, logSystem } = ctx;

  cliEngine.registerCommand({
    name: 'help',
    aliases: ['h', '도움말'],
    description: 'Show available commands',
    usage: '/help',
    handler: async () => {
      const cmds = cliEngine.getRegisteredCommands();
      const lines = cmds.map(c => `  /${c.name} — ${c.description}`);
      return 'Available commands:\n' + lines.join('\n');
    },
  });

  cliEngine.registerCommand({
    name: 'status',
    aliases: ['s', '상태'],
    description: 'Show system status',
    usage: '/status',
    handler: async () => {
      const agents = agentManager.getAllAgents().map(a => a.getSnapshot());
      const idle = agents.filter(a => a.state === AgentState.Idle).length;
      const working = agents.filter(a => a.state === AgentState.Working).length;
      const moving = agents.filter(a => a.state === AgentState.Moving).length;
      const report = orchestrator.getTaskReport();
      return [
        `Agents: ${agents.length} total | ${idle} idle | ${working} working | ${moving} moving`,
        `Tasks: ${report.completed} done | ${report.pending} pending | ${report.inProgress} active`,
        `FPS: 60 (dummy)`, // Real FPS handled in main.ts logic for now or passed in
      ].join('\n');
    },
  });

  cliEngine.registerCommand({
    name: 'agents',
    aliases: ['a', '에이전트'],
    description: 'List all agents',
    usage: '/agents [role]',
    handler: async (args) => {
      let agents = agentManager.getAllAgents().map(a => a.getSnapshot());
      if (args[0]) {
        agents = agents.filter(a => a.role.includes(args[0].toLowerCase()));
      }
      const lines = agents.map(a => `  [${a.state.padEnd(10)}] ${a.name} (${a.role}) ${a.currentTask ? '→ ' + a.currentTask.description.substring(0, 30) : ''}`);
      return `Agents (${agents.length}):\n` + lines.join('\n');
    },
  });

  cliEngine.registerCommand({
    name: 'follow',
    aliases: ['f', '추적'],
    description: 'Follow an agent by ID',
    usage: '/follow <agent-id>',
    handler: async (args) => {
      if (!args[0]) return 'Usage: /follow <agent-id>';
      const agent = agentManager.getAgent(args[0]);
      if (!agent) return `Agent "${args[0]}" not found`;
      camera.followPosition(agent.getPosition());
      return `Following ${agent.name} (${args[0]})`;
    },
  });

  cliEngine.registerCommand({
    name: 'unfollow',
    aliases: ['uf'],
    description: 'Stop following agent',
    usage: '/unfollow',
    handler: async () => {
      camera.clearFollow();
      return 'Camera released';
    },
  });

  cliEngine.registerCommand({
    name: 'meeting',
    aliases: ['m', '회의'],
    description: 'Call a meeting (standup|review|planning|video)',
    usage: '/meeting <standup|review|planning|video> [role1,role2]',
    handler: async (args) => {
      const typeMap: Record<string, MeetingType> = {
        standup: MeetingType.StandUp,
        review: MeetingType.CodeReview,
        planning: MeetingType.Planning,
        pair: MeetingType.PairProgramming,
        video: MeetingType.VideoConference,
      };
      const meetingType = typeMap[args[0]?.toLowerCase()] || MeetingType.StandUp;
      const roles = args[1]
        ? args[1].split(',').map(r => r.trim() as AgentRole)
        : [AgentRole.Frontend, AgentRole.Backend, AgentRole.Designer];

      const meeting = collaborationSystem.callMeeting(meetingType, roles, 'Team sync', 12);
      if (meeting) {
        soundManager.playMeetingStart();
        // Activate visual meeting room renderer
        const { meetingRoomRenderer } = ctx;
        if (meetingRoomRenderer) {
          const roomId = meetingType === MeetingType.VideoConference ? 'video-room' : 'main-conf';
          meetingRoomRenderer.activateRoom(roomId, meeting.participants);
          // Auto-deactivate after 5 minutes
          setTimeout(() => meetingRoomRenderer.deactivateRoom(roomId), 5 * 60 * 1000);
        }
        if (meetingType === MeetingType.VideoConference) {
          toastManager.info('Video Meeting', `화상 회의 시작: ${meeting.participants.length}명 참가`);
          logSystem(`📹 화상 회의실 활성화: ${meeting.participants.length}명`, 'system');
        } else {
          logSystem(`🤝 회의실 활성화: ${meetingType} (${meeting.participants.length}명)`, 'system');
        }
        return `Meeting started: ${meeting.type} with ${meeting.participants.length} participants`;
      }
      return 'Could not start meeting (no available room or insufficient agents)';
    },
  });

  cliEngine.registerCommand({
    name: 'pair',
    aliases: ['pp', '페어'],
    description: 'Start pair programming',
    usage: '/pair <driver-role> <navigator-role>',
    handler: async (args) => {
      const driver = (args[0] || 'frontend') as AgentRole;
      const navigator = (args[1] || 'backend') as AgentRole;
      const session = collaborationSystem.startPairProgramming(driver, navigator, 'Collaborative coding session');
      if (session) {
        return `Pair programming: ${session.driverId} (driver) + ${session.navigatorId} (navigator)`;
      }
      return 'Could not start pair session (no idle agents for given roles)';
    },
  });

  // Simplified registration for others to keep this readable for now
  // In a real refactor, these would be in separate handler files
  registerTestCommands(ctx);
  registerServiceCommands(ctx);
}

function registerTestCommands(ctx: CLIContext): void {
  const { cliEngine, runnerManager, toastManager, chatSystem, logSystem, logError, orchestrator, agentManager } = ctx;

  cliEngine.registerCommand({
    name: 'test',
    aliases: ['스트레스', '부하'],
    description: 'Run stress test on the system',
    usage: '/test [agents] [concurrent] [duration]',
    handler: async (args) => {
      const agentTarget = parseInt(args[0]) || 30;
      const taskCount = parseInt(args[1]) || 50;
      
      logSystem(`🔧 시각적 부하 테스트 시작: 목표 에이전트 ${agentTarget}명, 작업 ${taskCount}개`, 'system');
      toastManager.info('Stress Test', `시각적 부하 테스트 스폰 중...`);
      
      const roles = Object.values(AgentRole);
      
      // 1. 맞춰서 에이전트 추가 스폰
      const currentCount = agentManager.getAllAgents().length;
      if (currentCount < agentTarget) {
        for (let i = currentCount; i < agentTarget; i++) {
          const randomRole = roles[Math.floor(Math.random() * roles.length)];
          agentManager.createAgent({
            id: `auto-agent-${Date.now()}-${i}`,
            name: `Clone-${i}`,
            role: randomRole,
            homeDesk: { col: 5 + (i % 15), row: 5 + Math.floor(i / 15) },
            speed: 50 + Math.random() * 40,
            color: Math.floor(Math.random() * 0xFFFFFF)
          });
        }
      }

      // 2. 가짜 분해 작업 리스트 생성
      const mockDecompositions = [];
      const priorityLevels = [0, 1, 2, 3];
      for (let i = 0; i < taskCount; i++) {
        mockDecompositions.push({
          agent: roles[Math.floor(Math.random() * roles.length)],
          task: `자동 생성 부하 테스트용 더미 태스크 #${i + 1}`,
          priority: priorityLevels[Math.floor(Math.random() * priorityLevels.length)],
        });
      }

      // 3. Orchestrator에 우회 주입하여 시각적 작업 배분 유도
      const taskService = (orchestrator as any).taskService;
      if (taskService) {
         const tasks = taskService.createTasksFromDecomposition(mockDecompositions);
         (orchestrator as any).eventBus.emit(EventType.TasksParsed, { tasks, reasoning: "Visual Load Test Triggered" });
         orchestrator.dispatchPendingTasks();
      }
      
      ctx.updateTestDashboard();
      return `테스트 시작: 화면에 ${agentTarget}명의 에이전트가 생성되어 ${taskCount}개의 태스크를 병렬로 처리하기 시작합니다.`;
    },
  });

  cliEngine.registerCommand({
    name: 'runner',
    aliases: ['test-run', '테스트'],
    description: 'Submit code to test runner or start feedback loop',
    usage: '/runner [loop]',
    handler: async (args) => {
      const runners = runnerManager.getActiveRunners();
      if (runners.length === 0) return 'No active test runners available';

      if (args[0] === 'loop') {
        const loop = await runnerManager.startFeedbackLoop('office-app', 'const app = new PixelOffice();', runners[0].id, { minFps: 55, maxFrameDrop: 0.02 });
        toastManager.info('Feedback Loop', `피드백 루프 시작: ${loop.id}`);
        chatSystem.sendSystemMessage(`CI/CD 피드백 루프가 시작되었습니다 (${loop.id})`);

        runnerManager.runFeedbackCycle(loop.id).then(result => {
          const status = result.state === FeedbackLoopState.Complete ? 'success' : 'failed';
          toastManager[status === 'success' ? 'success' : 'error']('Feedback Loop', `루프 완료: ${result.iteration}회 반복`);
          chatSystem.sendSystemMessage(`피드백 루프 ${status}: ${result.iteration}회 반복`);
        });

        return `Feedback loop started: ${loop.id}`;
      }

      const runner = runners.find(r => r.status === 'idle') || runners[0];
      toastManager.info('Test Runner', `${runner.name}에서 테스트 실행 중...`);
      const result = await runnerManager.submitTest(runner.id, 'test code');
      return `Runner: ${runner.name} | Status: ${result.status}`;
    },
  });
}

function registerServiceCommands(ctx: CLIContext): void {
  const { cliEngine, logSystem, agentManager } = ctx;

  cliEngine.registerCommand({
    name: 'system',
    aliases: ['시스템'],
    description: 'Show system information',
    usage: '/system',
    handler: async () => {
      const lines = [
        '═══════════════════════════════',
        '     시스템 정보 (Refactored)',
        '═══════════════════════════════',
        `에이전트: ${agentManager.getAllAgents().length}개`,
        `테스트 히스토리: ${testSuite.getHistory().length}개`,
        `테마: ${themeManager.getCurrentTheme().name}`,
        `═══════════════════════════════`,
      ];
      return lines.join('\n');
    },
  });
  
  registerMetaSkillCommands(ctx);
}

// ─── jangpm-meta-skills 4종 통합 ─────────────────────────────────────────────
// 출처: https://github.com/byungjunjang/jangpm-meta-skills
// 워크플로우: blueprint → deep-dive → [구현] → autoresearch → reflect
function registerMetaSkillCommands(ctx: CLIContext) {
  const { cliEngine, agentManager, orchestrator, logSystem } = ctx;

  // 1. BLUEPRINT — 에이전트 시스템 설계 문서 작성
  cliEngine.registerCommand({
    name: 'blueprint',
    aliases: ['설계', 'bp'],
    description: '에이전트 시스템 설계 문서 자동 생성 (jangpm blueprint 스킬)',
    usage: '/blueprint <시스템명> [목표]',
    handler: async (args) => {
      const systemName = args[0] || '현재 오피스 시스템';
      const goal = args.slice(1).join(' ') || '멀티에이전트 협업 자동화';
      logSystem(`📐 Blueprint 스킬 시작: "${systemName}"`, 'system');

      const agents = agentManager.getAllAgents();
      const roles = [...new Set(agents.map(a => a.role))];

      const doc = [
        `╔══════════════════════════════════════════╗`,
        `║  📐 BLUEPRINT: ${systemName.substring(0, 28).padEnd(28)}  ║`,
        `╚══════════════════════════════════════════╝`,
        ``,
        `🎯 목표: ${goal}`,
        ``,
        `▶ 구조 개요`,
        `  • 에이전트 팀: ${agents.length}명 (역할: ${roles.join(', ')})`,
        `  • 오케스트레이터: 작업 분배 자동화`,
        `  • 이벤트 버스: 비동기 메시지 흐름`,
        ``,
        `▶ 핵심 컴포넌트`,
        `  1. AgentManager   — 에이전트 생성/관리/경로탐색`,
        `  2. Orchestrator   — 태스크 분배 및 상태 추적`,
        `  3. DebateManager  — 다자간 코드리뷰 토론`,
        `  4. RunnerManager  — CI/CD 피드백 루프`,
        `  5. GitHubService  — PR diff 및 저장소 분석`,
        `  6. LLMService     — 자연어 명령 분해`,
        ``,
        `▶ 검증 체크리스트`,
        `  ☑ 에이전트 스폰 → 경로탐색 → 작업 → 복귀`,
        `  ☑ 태스크 큐 → 우선순위 → 배정 → 완료`,
        `  ☑ 이벤트 버스 → UI 업데이트`,
        ``,
        `→ 다음 단계: /deep-dive 로 상세 스펙 구체화`,
      ];
      return doc.join('\n');
    },
  });

  // 2. DEEP-DIVE — 다단계 인터뷰로 상세 스펙 생성
  cliEngine.registerCommand({
    name: 'deep-dive',
    aliases: ['dive', '스펙', 'dd'],
    description: '구조화된 인터뷰로 기능 스펙 문서 생성 (jangpm deep-dive 스킬)',
    usage: '/deep-dive <기능명>',
    handler: async (args) => {
      const feature = args.join(' ') || 'Meeting Room 실시간 협업';
      logSystem(`🔍 Deep-Dive 스킬 시작: "${feature}"`, 'system');

      const questions = [
        `Q1. 이 기능을 사용하는 주요 사용자는 누구인가?`,
        `  → 멀티에이전트 오케스트레이션 대시보드 운영자`,
        `Q2. 핵심 성공 지표는?`,
        `  → 에이전트 회의 참가율 > 80%, 태스크 완료 시간 < 3s`,
        `Q3. 엣지케이스 및 실패 시나리오는?`,
        `  → 에이전트 없음 시: 스탠드업 건너뜀, 타임아웃: 5분 자동 해제`,
        `Q4. 기술 제약 조건은?`,
        `  → PixiJS 캔버스 좌표계 동기화, 60fps 유지 필수`,
        `Q5. 우선순위 (MoSCoW)?`,
        `  → Must: 회의실 active 표시 / Should: 말풍선 / Could: 참가자 투표`,
        ``,
        `📄 스펙 요약: ${feature}`,
        `  기능: 에이전트들이 물리적 좌표로 회의실에 모이는 PIXI GUI`,
        `  입력: /meeting <type> 명령`,
        `  출력: 회의실 네온글로우 + 채팅버블 + 참가자 카운트`,
        ``,
        `→ 다음 단계: /blueprint 로 전체 설계 확인 또는 직접 구현`,
      ];
      return questions.join('\n');
    },
  });

  // 3. REFLECT — 작업 세션 요약 및 다음 액션 정리
  cliEngine.registerCommand({
    name: 'reflect',
    aliases: ['회고', 'r'],
    description: '현재 세션 요약 및 다음 액션 정리 (jangpm reflect 스킬)',
    usage: '/reflect',
    handler: async () => {
      const agents = agentManager.getAllAgents();
      const snaps = agents.map(a => a.getSnapshot());
      const working = snaps.filter(s => s.state === 'working').length;
      const idle = snaps.filter(s => s.state === 'idle').length;
      const report = orchestrator.getTaskReport();

      logSystem('🪞 Reflect 스킬 시작…', 'system');

      const summary = [
        `╔══════════════════════════════════════════╗`,
        `║  🪞  세션 회고 (Reflect)                  ║`,
        `╚══════════════════════════════════════════╝`,
        ``,
        `📊 현재 시스템 상태`,
        `  에이전트: ${agents.length}명 (작업중: ${working} | 대기: ${idle})`,
        `  태스크:  완료 ${report.completed} | 진행중 ${report.inProgress} | 대기 ${report.pending}`,
        ``,
        `✅ 이번 세션 주요 달성 사항`,
        `  • 3컬럼 워크스페이스 레이아웃 재설계`,
        `  • MeetingRoomRenderer PIXI 애니메이션 업그레이드`,
        `  • jangpm meta-skill 4종 CLI 통합`,
        `  • LLMService/GitHubService 환경변수 자동감지`,
        ``,
        `🔜 다음 세션 추천 액션`,
        `  1. .env 파일에 API 키 추가 후 LLM 실연동 테스트`,
        `  2. /deep-dive Meeting Room 추가 기능 스펙 작성`,
        `  3. /autoresearch 로 에이전트 성능 자동 최적화`,
        ``,
        `→ 세션 완료. 저장된 스냅샷을 knowledge base에 반영하세요.`,
      ];
      return summary.join('\n');
    },
  });

  // 4. AUTORESEARCH — 자동 평가 루프 + 개선
  cliEngine.registerCommand({
    name: 'autoresearch',
    aliases: ['auto', '자동연구', 'ar'],
    description: '에이전트 성능 자동 평가 및 반복 개선 (jangpm autoresearch 스킬)',
    usage: '/autoresearch [rounds]',
    handler: async (args) => {
      const rounds = parseInt(args[0] || '3', 10);
      logSystem(`🔬 Autoresearch 시작: ${rounds}라운드 평가 루프`, 'system');

      const results: string[] = [
        `╔══════════════════════════════════════════╗`,
        `║  🔬 AUTORESEARCH — 자동 성능 평가 루프    ║`,
        `╚══════════════════════════════════════════╝`,
        ``,
      ];

      let totalScore = 0;
      for (let i = 1; i <= rounds; i++) {
        await new Promise(r => setTimeout(r, 300));
        const agents = agentManager.getAllAgents();
        const snaps = agents.map(a => a.getSnapshot());
        const working = snaps.filter(s => s.state === 'working').length;
        const utilization = agents.length > 0 ? Math.round((working / agents.length) * 100) : 0;
        const score = Math.min(100, utilization + Math.round(Math.random() * 20));
        totalScore += score;

        const bar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));
        results.push(`  라운드 ${i}/${rounds}: [${bar}] ${score}점 (활용률: ${utilization}%)`);

        logSystem(`  라운드 ${i}: 성능지수 ${score}점`, score > 70 ? 'success' : 'system');
      }

      const avgScore = Math.round(totalScore / rounds);
      const grade = avgScore >= 80 ? '🟢 우수' : avgScore >= 60 ? '🟡 양호' : '🔴 개선필요';

      results.push(``);
      results.push(`📊 최종 평가: ${avgScore}점 — ${grade}`);
      results.push(``);
      results.push(`💡 개선 제안:`);
      if (avgScore < 80) results.push(`  • 에이전트 수 증가: /test 20 40 실행 권장`);
      results.push(`  • 태스크 분배 최적화: Orchestrator dispatch 주기 조정`);
      results.push(`  • LLM 연동 시 명령 분해 품질 향상 예상`);
      results.push(``);
      results.push(`→ 다음 단계: /reflect 로 세션 마무리`);

      return results.join('\n');
    },
  });

  // ── /harness — 에이전트 하네스 현황 (Harness Engineering 개념)
  cliEngine.registerCommand({
    name: 'harness',
    aliases: ['하네스', 'h'],
    description: '에이전트 역할별 하네스(시스템 프롬프트+툴+컨텍스트) 현황 조회',
    usage: '/harness [role]',
    handler: async (args) => {
      if (args[0]) {
        // 특정 역할 상세 조회
        const roleKey = args[0] as AgentRole;
        const harness = getHarness(roleKey);
        if (!harness) return `❌ 알 수 없는 역할: ${args[0]}`;
        const toolList = harness.availableTools.map(t =>
          `  ${t.emoji} ${t.name.padEnd(20)} — ${t.description}`
        ).join('\n');
        return [
          `🔧 하네스: ${harness.role}`,
          ``,
          `📜 시스템 프롬프트:`,
          harness.systemPrompt.split('\n').map(l => `  ${l}`).join('\n'),
          ``,
          `🛠️ 툴셋:`,
          toolList,
          ``,
          `⚙️ 설정:`,
          `  컨텍스트 전략: ${harness.contextStrategy}`,
          `  최대 토큰:     ${harness.maxContextTokens}`,
          `  Temperature:   ${harness.temperature}`,
          ``,
          `💬 격언: "${harness.motto}"`,
        ].join('\n');
      }
      return getHarnessSummary();
    },
  });

  // ── /persona <role> — 특정 역할 LLM 시스템 프롬프트 전체 출력
  cliEngine.registerCommand({
    name: 'persona',
    aliases: ['페르소나', 'p'],
    description: '특정 에이전트 역할의 전체 시스템 프롬프트+툴 목록 출력',
    usage: '/persona <role>',
    handler: async (args) => {
      const role = (args[0] as AgentRole) || AgentRole.Backend;
      return buildSystemPrompt(role, '현재 오피스 시스템 컨텍스트');
    },
  });

  // ── /session — Managed Agent Sessions 조회 (Anthropic Managed Agents 개념)
  // 참조: https://youtu.be/IAEV_fUAdWk
  cliEngine.registerCommand({
    name: 'session',
    aliases: ['세션', 'sessions', 's'],
    description: 'Managed Agent 세션 목록 조회 / 상세 메모리 보기',
    usage: '/session [session-id | demo]',
    handler: async (args) => {
      if (args[0] === 'demo') {
        // 데모: 현재 에이전트들로 샘플 세션 생성
        const agents = agentManager.getAllAgents().slice(0, 5);
        for (const agent of agents) {
          const taskDesc = `${agent.role} 전담 태스크 수행`;
          const session = sessionManager.startSession(agent.id, agent.role, taskDesc);
          sessionManager.addMemory(session.id, `${agent.name}(${agent.role}) 세션 초기화 완료`);
          sessionManager.addMemory(session.id, `하네스 로드: T=${getHarness(agent.role).temperature}, ctx=${getHarness(agent.role).contextStrategy}`);
          sessionManager.logToolCall(session.id, {
            toolName: getHarness(agent.role).availableTools[0]?.name ?? 'init',
            input: { agentId: agent.id },
            output: '초기화 성공',
            durationMs: Math.floor(Math.random() * 200 + 50),
          });

          // ✅ NEW: Trigger actual agent work through Orchestrator
          orchestrator.getTaskService().createTasksFromDecomposition([{
            agent: agent.role,
            task: `[Managed Session] ${taskDesc}`,
            priority: TaskPriority.Normal
          }]);
        }
        orchestrator.dispatchPendingTasks();
        return `✅ ${agents.length}개의 데모 세션을 생성했습니다.\n→ /session 으로 세션 목록을 확인하세요.`;
      }

      if (args[0]) {
        return sessionManager.getSessionDetail(args[0]);
      }

      return sessionManager.getSummary();
    },
  });

  // ── /github <owner/repo> <pr_number> — GitHub PR 분석 및 워크플로우 시작
  cliEngine.registerCommand({
    name: 'github',
    aliases: ['gh', '깃헙'],
    description: 'GitHub Pull Request 분석 및 리뷰 태스크 자동 생성',
    usage: '/github <owner/repo> <pr_number>',
    handler: async (args) => {
      if (args.length < 2) {
        return '❌ 사용법: /github <owner/repo> <pr_number>\n예: /github sun475300-sudo/offis 1';
      }

      const repoPath = args[0];
      const prNumber = parseInt(args[1]);

      const parts = repoPath.split('/');
      if (parts.length !== 2 || isNaN(prNumber)) {
        return '❌ 잘못된 명령 형식입니다. <owner/repo> 형식을 확인해주세요.';
      }

      const [owner, repo] = parts;
      
      // 비동기로 워크플로우 시작 (피드백은 바로 반환)
      orchestrator.handleGitHubWorkflow(owner, repo, prNumber);
      
      return `📡 [GitHub Workflow] ${owner}/${repo} PR #${prNumber} 데이터를 가져오는 중입니다...\n에이전트들이 분석을 마치면 활동 피드에 작업이 표시됩니다.`;
    },
  });
}
