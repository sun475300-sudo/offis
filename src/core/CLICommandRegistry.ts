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
import { AgentRole, AgentState, TaskPriority, TaskStatus } from '../types';
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
        if (meetingType === MeetingType.VideoConference) {
          toastManager.info('Video Meeting', `화상 회의 시작: ${meeting.participants.length}명 참가`);
          logSystem(`📹 화상 회의실 활성화: ${meeting.participants.length}명`, 'system');
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
      const agentCount = parseInt(args[0]) || 10;
      const concurrent = parseInt(args[1]) || 3;
      const duration = parseInt(args[2]) || 5;
      
      logSystem(`🔧 부하 테스트 시작: 에이전트 ${agentCount}개, 동시 ${concurrent}개, ${duration}초`, 'system');
      toastManager.info('Stress Test', `에이전트 ${agentCount}개 테스트 중...`);
      
      const config: StressTestConfig = {
        agentCount,
        concurrentTasks: concurrent,
        duration,
        codeReviewCount: Math.floor(agentCount / 3),
      };
      
      const result = await testSuite.runStressTest(config, {
        onAgentSpawn: (count) => {
          if (count % 5 === 0) logSystem(`에이전트 생성 중: ${count}/${agentCount}`, 'system');
        },
        onTaskComplete: (taskId, dur) => {
          logSystem(`✅ 작업 완료: ${taskId} (${dur}ms)`, 'system');
        },
        onError: (err) => logError(err),
      });
      
      const report = testSuite.generateReport(result);
      logSystem(report, 'success');
      toastManager.showTestNotification('success', 'stress', result);
      ctx.updateTestDashboard();
      return report;
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
