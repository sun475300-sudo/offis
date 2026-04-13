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
import { testSuite, StressTestConfig } from '../services/TestSuite';
import { agentPersona, taskQueue, snippetManager, themeManager, configManager, resourceMonitor, collaborationHub, systemReport } from '../services/FeatureServices';

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
  
  // More commands can be added here...
}
