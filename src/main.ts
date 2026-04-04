import * as PIXI from 'pixi.js';
import { EventBus } from './core/EventBus';
import { GameLoop } from './core/GameLoop';
import { Orchestrator } from './core/Orchestrator';
import { AgentManager } from './agent/AgentManager';
import { AgentRenderer } from './rendering/AgentRenderer';
import { TilemapRenderer } from './rendering/TilemapRenderer';
import { CameraController } from './rendering/CameraController';
import { MinimapRenderer } from './rendering/MinimapRenderer';
import { PerformanceOverlay } from './rendering/PerformanceOverlay';
import { AgentSelectionSystem } from './rendering/AgentSelectionSystem';
import { ParticleSystem } from './rendering/ParticleSystem';
import { StatsChartRenderer } from './rendering/StatsChartRenderer';
import { SpeechBubbleRenderer } from './rendering/SpeechBubbleRenderer';
import { TaskProgressRenderer } from './rendering/TaskProgressRenderer';
import { MeetingRoomRenderer } from './rendering/MeetingRoomRenderer';
import { Pathfinder } from './spatial/Pathfinder';
import { Tilemap } from './spatial/Tilemap';
import { LocalAvoidance } from './spatial/LocalAvoidance';
import { ReviewService } from './services/ReviewService';
import { GitHubService } from './services/GitHubService';
import { DebateManager } from './debate/DebateManager';
import { RunnerManager, FeedbackLoopState } from './debate/RunnerManager';
import { CLIEngine } from './core/CLIEngine';
import { SoundManager } from './core/SoundManager';
import { ChatSystem } from './core/ChatSystem';
import { ToastManager } from './core/ToastManager';
import { CollaborationSystem, MeetingType } from './agent/CollaborationSystem';
import { AgentConfig, AgentRole, AgentState, EventType, AggregatedReviewReport, TaskPriority, TaskStatus } from './types';
import { testSuite, StressTestConfig, StressTestResult } from './services/TestSuite';

const TILE_SIZE = 32;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 25;

class PixelOfficeApp {
  private app: PIXI.Application;
  private eventBus: EventBus;
  private gameLoop: GameLoop;
  private orchestrator: Orchestrator;
  private agentManager: AgentManager;
  private tilemap: Tilemap;
  private pathfinder: Pathfinder;
  private localAvoidance: LocalAvoidance;
  private agentRenderer: AgentRenderer;
  private tilemapRenderer: TilemapRenderer;
  private camera: CameraController;
  private reviewService: ReviewService;
  private gitHubService: GitHubService;
  private debateManager: DebateManager;
  private runnerManager: RunnerManager;
  private minimapRenderer!: MinimapRenderer;
  private performanceOverlay!: PerformanceOverlay;
  private agentSelection!: AgentSelectionSystem;
  private particleSystem!: ParticleSystem;
  private speechBubbleRenderer!: SpeechBubbleRenderer;
  private taskProgressRenderer!: TaskProgressRenderer;
  private meetingRoomRenderer!: MeetingRoomRenderer;
  private statsChart!: StatsChartRenderer;
  private cliEngine: CLIEngine;
  private soundManager: SoundManager;
  private collaborationSystem!: CollaborationSystem;
  private chatSystem: ChatSystem;
  private toastManager: ToastManager;

  private rootContainer: PIXI.Container;
  private gameContainer: PIXI.Container;
  private hudContainer!: PIXI.Container;

  constructor() {
    this.app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight - 150,
      backgroundColor: 0x1a1f26,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    document.getElementById('game-canvas')!.appendChild(this.app.view as unknown as HTMLElement);

    this.rootContainer = new PIXI.Container();
    this.gameContainer = new PIXI.Container();
    this.rootContainer.addChild(this.gameContainer);
    this.app.stage.addChild(this.rootContainer);

    this.eventBus = new EventBus();
    this.tilemap = this.createTilemap();
    this.pathfinder = new Pathfinder(this.tilemap);
    this.localAvoidance = new LocalAvoidance();
    this.agentManager = new AgentManager(this.tilemap, this.pathfinder, this.eventBus);
    this.orchestrator = new Orchestrator(this.agentManager, this.eventBus);
    
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight - 150;
    this.camera = new CameraController(this.rootContainer, screenWidth, screenHeight);
    this.tilemapRenderer = new TilemapRenderer(this.gameContainer);
    this.tilemapRenderer.renderMap(this.tilemap);
    this.agentRenderer = new AgentRenderer(this.gameContainer);
    this.reviewService = new ReviewService();
    this.gitHubService = new GitHubService();
    this.debateManager = new DebateManager();
    this.runnerManager = new RunnerManager();
    this.chatSystem = new ChatSystem();
    this.toastManager = new ToastManager();
    this.toastManager.init();

    // HUD container (screen-space, not affected by camera)
    this.hudContainer = new PIXI.Container();
    this.app.stage.addChild(this.hudContainer);

    // Phase 1: Minimap
    this.minimapRenderer = new MinimapRenderer(this.hudContainer, 200, 120);
    this.minimapRenderer.setPosition(220, screenHeight - 140);
    this.minimapRenderer.renderMap(this.tilemap);

    // Phase 1: Performance Overlay
    this.performanceOverlay = new PerformanceOverlay(this.hudContainer);
    this.performanceOverlay.setPosition(screenWidth - 186, 16);

    // Phase 2: Agent Selection
    this.agentSelection = new AgentSelectionSystem(this.gameContainer, this.eventBus);
    this.agentSelection.setupInteraction(this.app);
    this.agentSelection.onSelect((agentId) => {
      if (agentId) {
        const agent = this.agentManager.getAgent(agentId);
        if (agent) {
          this.camera.followPosition(agent.getPosition());
          this.soundManager.playSelect();
        }
      } else {
        this.camera.clearFollow();
      }
    });

    // Phase 4: Particle System
    this.particleSystem = new ParticleSystem(this.gameContainer);

    // Phase 10: Speech Bubble Renderer
    this.speechBubbleRenderer = new SpeechBubbleRenderer(this.gameContainer);

    // Task Progress Renderer
    this.taskProgressRenderer = new TaskProgressRenderer(this.gameContainer);

    // Meeting Room Renderer
    this.meetingRoomRenderer = new MeetingRoomRenderer(this.gameContainer);
    this.meetingRoomRenderer.addMeetingRoom('room-main', { col: 9, row: 14 });
    this.meetingRoomRenderer.addMeetingRoom('room-secondary', { col: 17, row: 14 });
    this.meetingRoomRenderer.addMeetingRoom('room-conference', { col: 35, row: 10 });

    // Stats Chart
    this.statsChart = new StatsChartRenderer(this.hudContainer);
    this.statsChart.setPosition(16, 16);

    // Phase 6: CLI Engine
    this.cliEngine = new CLIEngine();
    this.soundManager = new SoundManager();

    // Phase 5: Collaboration System
    this.collaborationSystem = new CollaborationSystem(this.agentManager, this.eventBus);

    this.gameLoop = new GameLoop();

    this.setupGameLoop();
    this.setupEventHandlers();
    this.createReviewAgents();
    this.createInitialAgents();
    this.registerCLICommands();
    this.setupCLI();
    this.setupResize();
    this.setupZoomControls();
    this.setupStorage();
    this.loadHistory();
    this.setupChatPanel();
    this.setupThemeToggle();
    this.setupContextMenu();
    this.setupKeyboardShortcuts();

    this.gameLoop.start();
    this.logSystem('Pixel Office MAS Dashboard initialized');
    this.logSystem('📋 코드 리뷰 오피스가 준비되었습니다.');
    this.logSystem('CLI에 코드를 입력하고 "검수" 또는 "리뷰" 명령으로 코드 리뷰를 요청하세요.');
    this.logSystem('💡 ? 키를 눌러 키보드 단축키를 확인하세요.');
  }

  private createTilemap(): Tilemap {
    return new Tilemap(MAP_WIDTH, MAP_HEIGHT);
  }

  private createInitialAgents(): void {
    const agents: AgentConfig[] = [
      // Frontend Developers (Row 2) - Accelerated
      { id: 'fe-1', name: '김철수', role: AgentRole.Frontend, homeDesk: { col: 2, row: 2 }, speed: 8, color: 0x4FC3F7 },
      { id: 'fe-2', name: '이영희', role: AgentRole.Frontend, homeDesk: { col: 4, row: 2 }, speed: 8, color: 0x29B6F6 },
      { id: 'fe-3', name: '박지민', role: AgentRole.Frontend, homeDesk: { col: 6, row: 2 }, speed: 9, color: 0x03A9F4 },
      { id: 'fe-4', name: '정수현', role: AgentRole.Frontend, homeDesk: { col: 8, row: 2 }, speed: 8, color: 0x039BE5 },
      
      // Backend Developers (Row 4)
      { id: 'be-1', name: '최민호', role: AgentRole.Backend, homeDesk: { col: 2, row: 4 }, speed: 8, color: 0x81C784 },
      { id: 'be-2', name: '강다현', role: AgentRole.Backend, homeDesk: { col: 4, row: 4 }, speed: 8, color: 0x66BB6A },
      { id: 'be-3', name: '윤서연', role: AgentRole.Backend, homeDesk: { col: 6, row: 4 }, speed: 7, color: 0x4CAF50 },
      { id: 'be-4', name: '신동현', role: AgentRole.Backend, homeDesk: { col: 8, row: 4 }, speed: 10, color: 0x43A047 },
      
      // Designers (Row 6)
      { id: 'ds-1', name: '한지민', role: AgentRole.Designer, homeDesk: { col: 2, row: 6 }, speed: 8, color: 0xFFB74D },
      { id: 'ds-2', name: '오하은', role: AgentRole.Designer, homeDesk: { col: 4, row: 6 }, speed: 8, color: 0xFFA726 },
      { id: 'ds-3', name: '적이다은', role: AgentRole.Designer, homeDesk: { col: 6, row: 6 }, speed: 8, color: 0xFF9800 },
      { id: 'ds-4', name: '윤보라', role: AgentRole.Designer, homeDesk: { col: 8, row: 6 }, speed: 9, color: 0xFB8C00 },
      
      // PMs (Row 8)
      { id: 'pm-1', name: '임정호', role: AgentRole.PM, homeDesk: { col: 2, row: 8 }, speed: 7, color: 0xE57373 },
      { id: 'pm-2', name: '조민지', role: AgentRole.PM, homeDesk: { col: 4, row: 8 }, speed: 7, color: 0xEF5350 },
      { id: 'pm-3', name: '서肝癌', role: AgentRole.PM, homeDesk: { col: 6, row: 8 }, speed: 8, color: 0xF44336 },
      
      // QA Engineers (Row 10)
      { id: 'qa-1', name: '황보경', role: AgentRole.QA, homeDesk: { col: 2, row: 10 }, speed: 10, color: 0xBA68C8 },
      { id: 'qa-2', name: '문소연', role: AgentRole.QA, homeDesk: { col: 4, row: 10 }, speed: 8, color: 0xAB47BC },
      { id: 'qa-3', name: '배유진', role: AgentRole.QA, homeDesk: { col: 6, row: 10 }, speed: 9, color: 0x9C27B0 },
      { id: 'qa-4', name: '차하늘', role: AgentRole.QA, homeDesk: { col: 8, row: 10 }, speed: 8, color: 0x8E24AA },
      
      // DevOps Engineers (Row 12)
      { id: 'do-1', name: '장현준', role: AgentRole.DevOps, homeDesk: { col: 2, row: 12 }, speed: 3, color: 0x90A4AE },
      { id: 'do-2', name: '구본욱', role: AgentRole.DevOps, homeDesk: { col: 4, row: 12 }, speed: 3.5, color: 0x78909C },
      { id: 'do-3', name: '남도열', role: AgentRole.DevOps, homeDesk: { col: 6, row: 12 }, speed: 3, color: 0x607D8B },
      { id: 'do-4', name: '양동현', role: AgentRole.DevOps, homeDesk: { col: 8, row: 12 }, speed: 2.8, color: 0x546E7A },
      
      // Additional Frontend (Row 14)
      { id: 'fe-5', name: '서민준', role: AgentRole.Frontend, homeDesk: { col: 2, row: 14 }, speed: 3, color: 0x00BCD4 },
      { id: 'fe-6', name: '류isl', role: AgentRole.Frontend, homeDesk: { col: 4, row: 14 }, speed: 3.2, color: 0x00ACC1 },
      
      // Additional Backend (Row 16)
      { id: 'be-5', name: '전민재', role: AgentRole.Backend, homeDesk: { col: 2, row: 16 }, speed: 3, color: 0x9CCC65 },
      { id: 'be-6', name: '홍길동', role: AgentRole.Backend, homeDesk: { col: 4, row: 16 }, speed: 2.7, color: 0x8BC34A },
    ];

    for (const config of agents) {
      this.agentManager.createAgent(config);
    }
  }

  private createReviewAgents(): void {
    const reviewAgents: AgentConfig[] = [
      // Review Team - Row 18
      { id: 'review-architect', name: '👨‍💻 수석 아키텍트', role: AgentRole.Architect, homeDesk: { col: 2, row: 18 }, speed: 2, color: 0x9C27B0 },
      { id: 'review-security', name: '🔒 보안/QA 엔지니어', role: AgentRole.SecurityEngineer, homeDesk: { col: 5, row: 18 }, speed: 2, color: 0xF44336 },
      { id: 'review-performance', name: '⚡ 성능 전문가', role: AgentRole.PerformanceEngineer, homeDesk: { col: 8, row: 18 }, speed: 2, color: 0xFF9800 },
      { id: 'review-security2', name: '🛡️ 침투 테스터', role: AgentRole.SecurityEngineer, homeDesk: { col: 11, row: 18 }, speed: 2.5, color: 0xE91E63 },
      { id: 'review-db', name: '🗄️ DB 전문가', role: AgentRole.PerformanceEngineer, homeDesk: { col: 14, row: 18 }, speed: 2, color: 0x00BCD4 },
    ];

    for (const config of reviewAgents) {
      this.agentManager.createAgent(config);
    }
  }

  private setupGameLoop(): void {
    this.gameLoop.onUpdate((deltaTime) => {
      const agents = this.agentManager.getAllAgents();
      const snapshots = agents.map(a => a.getSnapshot());

      const dynamicObstacles = this.localAvoidance.getDynamicObstacles(snapshots, '');
      
      for (const agent of agents) {
        const snapshot = agent.getSnapshot();
        const nearby = snapshots.filter(a => {
          const dx = a.position.x - snapshot.position.x;
          const dy = a.position.y - snapshot.position.y;
          return Math.sqrt(dx * dx + dy * dy) < 50;
        });
        const avoidance = this.localAvoidance.computeSteering(snapshot, nearby, deltaTime);
        agent.applyAvoidanceOffset(avoidance);
        agent.update(deltaTime);
      }

      // Particle effects for working agents
      for (const snap of snapshots) {
        if (snap.state === AgentState.Working) {
          this.particleSystem.emitTypingSpark(snap.position);
        }
      }

      this.particleSystem.update(deltaTime);
      this.camera.update(deltaTime);

      // Follow selected agent camera tracking
      const selectedId = this.agentSelection.getSelectedAgentId();
      if (selectedId) {
        const selectedAgent = this.agentManager.getAgent(selectedId);
        if (selectedAgent) {
          this.camera.followPosition(selectedAgent.getPosition());
        }
      }

      // Update task progress bars (position + progress sync)
      for (const snap of snapshots) {
        if (snap.currentTask && snap.state === AgentState.Working) {
          this.taskProgressRenderer.updateProgress(snap.currentTask.id, snap.progress * 100);
          this.taskProgressRenderer.updatePosition(snap.currentTask.id, snap.position);
        }
      }

      // Update meeting room visualization
      const meetings = this.collaborationSystem.getActiveMeetings();
      for (const meeting of meetings) {
        const roomId = meeting.location.col === 9 && meeting.location.row === 14 ? 'room-main'
          : meeting.location.col === 17 && meeting.location.row === 14 ? 'room-secondary'
          : 'room-conference';
        this.meetingRoomRenderer.activateRoom(roomId, meeting.participants);
      }
      this.meetingRoomRenderer.update();

      this.collaborationSystem.update();
      this.updateStats();
      this.updateMonitoring();
      this.speechBubbleRenderer.update();
    });

    this.gameLoop.onDraw(() => {
      const snapshots = this.agentManager.getAllAgents().map(a => a.getSnapshot());
      this.agentRenderer.update(snapshots, 0);

      // Update agent selection system
      this.agentSelection.setAgentCache(snapshots);
      this.agentSelection.update(snapshots, 0);

      // Update minimap
      const cameraPos = { x: 0, y: 0 }; // approximate from camera
      this.minimapRenderer.update(
        snapshots,
        (MAP_WIDTH * TILE_SIZE) / 2,
        (MAP_HEIGHT * TILE_SIZE) / 2,
        window.innerWidth,
        window.innerHeight - 150,
        1,
      );

      // Update performance overlay
      const taskReport = this.orchestrator.getTaskReport();
      this.performanceOverlay.update(
        this.gameLoop.getFPS(),
        snapshots.length,
        taskReport.completed + taskReport.pending + taskReport.inProgress,
      );

      // Update stats chart
      this.statsChart.recordSnapshot(snapshots);
      this.statsChart.render(snapshots, taskReport.completed, taskReport.completed + taskReport.pending + taskReport.inProgress);

      this.updateAgentPanel();
    });
  }

  private setupEventHandlers(): void {
    this.eventBus.on(EventType.CommandReceived, (event) => {
      const { prompt } = event.payload as { prompt: string };
      this.logUser(prompt);
    });

    this.eventBus.on(EventType.TasksParsed, (event) => {
      const { tasks } = event.payload as { tasks: any[] };
      this.logSystem(`Parsed ${tasks.length} tasks`, 'system');
    });

    this.eventBus.on(EventType.TaskAssigned, (event) => {
      const { agentId, taskDescription, taskId } = event.payload as { agentId: string; taskDescription: string; taskId?: string };
      const agent = this.agentManager.getAgent(agentId);
      if (agent) {
        const snap = agent.getSnapshot();
        this.logSystem(`Assigned to ${agent.name}: "${taskDescription.substring(0, 30)}..."`, 'success');
        this.soundManager.playTaskAssigned();
        this.toastManager.info('Task Assigned', `${agent.name}: ${taskDescription.substring(0, 40)}`, 3000);
        this.chatSystem.sendSystemMessage(`${agent.name}(${snap.role})에게 "${taskDescription.substring(0, 40)}" 작업 할당됨`);
        // Add progress bar for this task
        if (taskId) {
          this.taskProgressRenderer.addProgress(taskId, agentId, taskDescription.substring(0, 20), snap.position);
        }
      }
    });

    this.eventBus.on(EventType.AgentStateChanged, (event) => {
      const { agentId, newState } = event.payload as { agentId: string; newState: AgentState };
      const agent = this.agentManager.getAgent(agentId);
      if (agent && newState === AgentState.Working) {
        this.chatSystem.sendMessage(agentId, agent.name, agent.role, '작업 시작합니다!');
      }
    });

    this.eventBus.on(EventType.TaskCompleted, (event) => {
      const { agentId, taskId } = event.payload as { agentId: string; taskId: string };
      const agent = this.agentManager.getAgent(agentId);
      if (agent) {
        this.logSystem(`Task completed by ${agent.name}`, 'success');
        this.soundManager.playTaskComplete();
        this.toastManager.success('Task Completed', `${agent.name} 작업 완료!`);
        this.chatSystem.sendMessage(agentId, agent.name, agent.role, '작업 완료했습니다!');
        // Sparkle particle at agent position
        const snap = agent.getSnapshot();
        this.particleSystem.emitSparkle(snap.position, 0x3fb950, 15);
        // Remove progress bar
        if (taskId) {
          this.taskProgressRenderer.removeProgress(taskId);
        }
      }
    });

    this.eventBus.on(EventType.AgentArrived, (event) => {
      const { agentId } = event.payload as { agentId: string };
      const agent = this.agentManager.getAgent(agentId);
      if (agent) {
        this.particleSystem.emitPuff(agent.getSnapshot().position);
      }
    });
  }

  private registerCLICommands(): void {
    this.cliEngine.registerCommand({
      name: 'help',
      aliases: ['h', '도움말'],
      description: 'Show available commands',
      usage: '/help',
      handler: async () => {
        const cmds = this.cliEngine.getRegisteredCommands();
        const lines = cmds.map(c => `  /${c.name} — ${c.description}`);
        return 'Available commands:\n' + lines.join('\n');
      },
    });

    this.cliEngine.registerCommand({
      name: 'status',
      aliases: ['s', '상태'],
      description: 'Show system status',
      usage: '/status',
      handler: async () => {
        const agents = this.agentManager.getAllAgents().map(a => a.getSnapshot());
        const idle = agents.filter(a => a.state === AgentState.Idle).length;
        const working = agents.filter(a => a.state === AgentState.Working).length;
        const moving = agents.filter(a => a.state === AgentState.Moving).length;
        const report = this.orchestrator.getTaskReport();
        return [
          `Agents: ${agents.length} total | ${idle} idle | ${working} working | ${moving} moving`,
          `Tasks: ${report.completed} done | ${report.pending} pending | ${report.inProgress} active`,
          `FPS: ${this.gameLoop.getFPS()}`,
        ].join('\n');
      },
    });

    this.cliEngine.registerCommand({
      name: 'agents',
      aliases: ['a', '에이전트'],
      description: 'List all agents',
      usage: '/agents [role]',
      handler: async (args) => {
        let agents = this.agentManager.getAllAgents().map(a => a.getSnapshot());
        if (args[0]) {
          agents = agents.filter(a => a.role.includes(args[0].toLowerCase()));
        }
        const lines = agents.map(a => `  [${a.state.padEnd(10)}] ${a.name} (${a.role}) ${a.currentTask ? '→ ' + a.currentTask.description.substring(0, 30) : ''}`);
        return `Agents (${agents.length}):\n` + lines.join('\n');
      },
    });

    this.cliEngine.registerCommand({
      name: 'follow',
      aliases: ['f', '추적'],
      description: 'Follow an agent by ID',
      usage: '/follow <agent-id>',
      handler: async (args) => {
        if (!args[0]) return 'Usage: /follow <agent-id>';
        const agent = this.agentManager.getAgent(args[0]);
        if (!agent) return `Agent "${args[0]}" not found`;
        this.camera.followPosition(agent.getPosition());
        return `Following ${agent.name} (${args[0]})`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'unfollow',
      aliases: ['uf'],
      description: 'Stop following agent',
      usage: '/unfollow',
      handler: async () => {
        this.camera.clearFollow();
        this.agentSelection.deselect();
        return 'Camera released';
      },
    });

    this.cliEngine.registerCommand({
      name: 'meeting',
      aliases: ['m', '회의'],
      description: 'Call a meeting',
      usage: '/meeting <standup|review|planning> [role1,role2]',
      handler: async (args) => {
        const typeMap: Record<string, MeetingType> = {
          standup: MeetingType.StandUp,
          review: MeetingType.CodeReview,
          planning: MeetingType.Planning,
          pair: MeetingType.PairProgramming,
        };
        const meetingType = typeMap[args[0]?.toLowerCase()] || MeetingType.StandUp;
        const roles = args[1]
          ? args[1].split(',').map(r => r.trim() as AgentRole)
          : [AgentRole.Frontend, AgentRole.Backend, AgentRole.Designer];

        const meeting = this.collaborationSystem.callMeeting(meetingType, roles, 'Team sync', 12);
        if (meeting) {
          this.soundManager.playMeetingStart();
          return `Meeting started: ${meeting.type} with ${meeting.participants.length} participants`;
        }
        return 'Could not start meeting (no available room or insufficient agents)';
      },
    });

    this.cliEngine.registerCommand({
      name: 'pair',
      aliases: ['pp', '페어'],
      description: 'Start pair programming',
      usage: '/pair <driver-role> <navigator-role>',
      handler: async (args) => {
        const driver = (args[0] || 'frontend') as AgentRole;
        const navigator = (args[1] || 'backend') as AgentRole;
        const session = this.collaborationSystem.startPairProgramming(driver, navigator, 'Collaborative coding session');
        if (session) {
          return `Pair programming: ${session.driverId} (driver) + ${session.navigatorId} (navigator)`;
        }
        return 'Could not start pair session (no idle agents for given roles)';
      },
    });

    this.cliEngine.registerCommand({
      name: 'stats',
      aliases: ['analytics', '통계'],
      description: 'Toggle analytics dashboard',
      usage: '/stats',
      handler: async () => {
        this.statsChart.toggle();
        return `Analytics dashboard: ${this.statsChart.isVisible() ? 'ON' : 'OFF'}`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'sound',
      aliases: ['audio', '소리'],
      description: 'Toggle sound effects',
      usage: '/sound [on|off]',
      handler: async (args) => {
        if (args[0] === 'off') {
          this.soundManager.setEnabled(false);
          return 'Sound: OFF';
        }
        this.soundManager.setEnabled(true);
        return 'Sound: ON';
      },
    });

    this.cliEngine.registerCommand({
      name: 'zoom',
      aliases: ['z'],
      description: 'Set zoom level',
      usage: '/zoom <0.3-3.0>',
      handler: async (args) => {
        const level = parseFloat(args[0]) || 1;
        this.camera.setZoom(level);
        return `Zoom set to ${level}`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'perf',
      aliases: ['performance', '성능'],
      description: 'Toggle performance overlay',
      usage: '/perf',
      handler: async () => {
        this.performanceOverlay.toggle();
        return 'Performance overlay toggled';
      },
    });

    this.cliEngine.registerCommand({
      name: 'github',
      aliases: ['gh', '깃헙'],
      description: 'Analyze a GitHub repository',
      usage: '/github <owner/repo>',
      handler: async (args) => {
        if (!args[0]) return 'Usage: /github <owner/repo>';
        const parts = args[0].split('/');
        if (parts.length !== 2) return 'Format: /github owner/repo';
        const [owner, repo] = parts;
        this.logSystem(`Analyzing ${owner}/${repo}...`, 'system');
        this.toastManager.info('GitHub', `레포지토리 분석 중: ${owner}/${repo}`);
        try {
          const analysis = await this.gitHubService.analyzeRepo(owner, repo);
          this.chatSystem.sendSystemMessage(`GitHub 분석 완료: ${owner}/${repo}`);
          const lines = [
            `Repository: ${analysis.repo.fullName}`,
            `Stars: ${analysis.repo.stars} | Forks: ${analysis.repo.forks}`,
            `Languages: ${Object.keys(analysis.languages || {}).join(', ')}`,
            `Recent commits: ${analysis.recentCommits?.length || 0}`,
            `Files: ${analysis.fileCount} | Size: ${(analysis.totalSize / 1024).toFixed(1)}KB`,
          ];
          this.toastManager.success('Analysis Complete', `${owner}/${repo} 분석 완료`);
          return lines.join('\n');
        } catch (err) {
          this.toastManager.error('GitHub Error', `분석 실패: ${err}`);
          return `Error analyzing repo: ${err}`;
        }
      },
    });

    this.cliEngine.registerCommand({
      name: 'debate',
      aliases: ['토론'],
      description: 'Start a code review debate session',
      usage: '/debate [code-snippet]',
      handler: async (args) => {
        // Move review agents to conference room
        const reviewAgents = ['review-architect', 'review-security', 'review-performance'];
        for (const agentId of reviewAgents) {
          const agent = this.agentManager.getAgent(agentId);
          if (agent) {
            agent.assignTask({
              id: `debate-${Date.now()}-${agentId}`,
              description: '코드 토론 참가',
              requiredRole: agent.role,
              targetDesk: { col: 36, row: 11 },
              priority: TaskPriority.Critical,
              status: TaskStatus.Assigned,
              assignedAgentId: agentId,
              estimatedDuration: 20,
              progress: 0,
              parentTaskId: null,
              createdAt: Date.now(),
            });
          }
        }
        this.meetingRoomRenderer.activateRoom('room-conference', reviewAgents);
        this.soundManager.playMeetingStart();
        this.toastManager.info('Debate', '코드 토론이 시작됩니다!');
        this.chatSystem.sendSystemMessage('코드 토론 세션이 시작되었습니다. 리뷰 에이전트들이 회의실로 이동합니다.');

        // Actually run the debate with real-time chat updates
        const codeSnippet = args.join(' ') || 'function example() { return any; }';
        const session = await this.debateManager.startDebate(codeSnippet, 'Live Review');

        // Run debate asynchronously and stream turns to chat
        this.runDebateWithVisualization(session.id).catch(err => {
          this.logSystem(`Debate error: ${err}`, 'error');
        });

        return `Code review debate started (session: ${session.id}) — agents moving to conference room`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'runner',
      aliases: ['test', '테스트'],
      description: 'Submit code to test runner or start feedback loop',
      usage: '/runner [loop]',
      handler: async (args) => {
        const runners = this.runnerManager.getActiveRunners();
        if (runners.length === 0) return 'No active test runners available';

        if (args[0] === 'loop') {
          // Start a feedback loop
          const loop = await this.runnerManager.startFeedbackLoop(
            'office-app',
            'const app = new PixelOffice();',
            runners[0].id,
            { minFps: 55, maxFrameDrop: 0.02 },
          );
          this.toastManager.info('Feedback Loop', `피드백 루프 시작: ${loop.id}`);
          this.chatSystem.sendSystemMessage(`CI/CD 피드백 루프가 시작되었습니다 (${loop.id})`);

          // Run loop asynchronously
          this.runnerManager.runFeedbackCycle(loop.id).then(result => {
            const status = result.state === FeedbackLoopState.Complete ? 'success' : 'failed';
            this.toastManager[status === 'success' ? 'success' : 'error'](
              'Feedback Loop',
              `루프 완료: ${result.iteration}회 반복, ${result.fixAttempts}회 수정`,
            );
            this.chatSystem.sendSystemMessage(
              `피드백 루프 ${status}: ${result.iteration}회 반복, ${result.testResults.length}개 테스트 실행`,
            );
            this.logSystem(`Feedback loop ${status}: ${result.iteration} iterations`, status === 'success' ? 'success' : 'error');
          });

          return `Feedback loop started: ${loop.id}`;
        }

        // Single test run
        const runner = runners.find(r => r.status === 'idle') || runners[0];
        this.toastManager.info('Test Runner', `${runner.name}에서 테스트 실행 중...`);
        this.chatSystem.sendSystemMessage(`${runner.name} (${runner.type})에서 테스트를 실행합니다`);

        const result = await this.runnerManager.submitTest(runner.id, 'test code');
        const statusEmoji = result.status === 'success' ? '✅' : '❌';
        this.toastManager[result.status === 'success' ? 'success' : 'error'](
          'Test Result',
          `${statusEmoji} ${runner.name}: ${result.status}`,
        );
        this.chatSystem.sendSystemMessage(
          `${statusEmoji} 테스트 결과 (${runner.name}): ${result.status} | FPS: ${result.metrics.fps?.toFixed(1)} | Memory: ${result.metrics.memoryUsage?.toFixed(0)}MB`,
        );

        const lines = [
          `Runner: ${runner.name} (${runner.type})`,
          `Status: ${result.status}`,
          `FPS: ${result.metrics.fps?.toFixed(1)} | Memory: ${result.metrics.memoryUsage?.toFixed(0)}MB`,
          `Errors: ${result.errors.length}`,
        ];
        if (result.errors.length > 0) {
          lines.push(...result.errors.map(e => `  - ${e.type}: ${e.message}`));
        }
        return lines.join('\n');
      },
    });

    this.cliEngine.registerCommand({
      name: 'runners',
      aliases: ['러너'],
      description: 'List all test runners',
      usage: '/runners',
      handler: async () => {
        const runners = this.runnerManager.getAllRunners();
        const lines = runners.map(r => {
          const statusIcon = r.status === 'idle' ? '🟢' : r.status === 'running' ? '🟡' : r.status === 'error' ? '🔴' : '⚫';
          return `  ${statusIcon} ${r.name} (${r.type}) — ${r.specs.cpu} / ${r.specs.gpu} / ${r.specs.ram}`;
        });
        return `Test Runners (${runners.length}):\n${lines.join('\n')}`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'assign',
      aliases: ['task', '배정'],
      description: 'Assign task to a specific role',
      usage: '/assign <role> <task description>',
      handler: async (args) => {
        if (args.length < 2) return 'Usage: /assign <role> <description>';
        const role = args[0] as AgentRole;
        const description = args.slice(1).join(' ');
        const idle = this.agentManager.findIdleAgentsByRole(role);
        if (idle.length === 0) return `No idle ${role} agents available`;
        const agent = idle[0];
        agent.assignTask({
          id: `manual-${Date.now()}`,
          description,
          requiredRole: role,
          targetDesk: { col: 15, row: 15 },
          priority: TaskPriority.High,
          status: TaskStatus.Assigned,
          assignedAgentId: agent.id,
          estimatedDuration: 8,
          progress: 0,
          parentTaskId: null,
          createdAt: Date.now(),
        });
        this.soundManager.playTaskAssigned();
        return `Assigned "${description}" to ${agent.name} (${role})`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'review',
      aliases: ['검수', '리뷰'],
      description: 'Start a code review on editor code or pasted code',
      usage: '/review [code-snippet]',
      handler: async (args) => {
        // Get code from args, or from the code editor, or use a sample
        let code = args.join(' ');
        if (!code) {
          const editorEl = document.getElementById('code-textarea') as HTMLTextAreaElement;
          code = editorEl?.value?.trim() || '';
        }
        if (!code) {
          return 'Usage: /review <code> — or paste code in the editor first';
        }

        const projectName = `Review-${new Date().toLocaleTimeString()}`;
        this.startCodeReview(code, projectName).catch(err => {
          this.logError(`Review error: ${err}`);
        });
        return `Code review started (${code.length} chars) — review agents activated`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'fullreview',
      aliases: ['전체리뷰'],
      description: 'Run review + debate pipeline on code',
      usage: '/fullreview [code-snippet]',
      handler: async (args) => {
        let code = args.join(' ');
        if (!code) {
          const editorEl = document.getElementById('code-textarea') as HTMLTextAreaElement;
          code = editorEl?.value?.trim() || '';
        }
        if (!code) {
          return 'Usage: /fullreview <code> — or paste code in the editor first';
        }

        // Step 1: Run parallel review
        const projectName = `FullReview-${new Date().toLocaleTimeString()}`;
        this.toastManager.info('Full Review', '전체 리뷰 파이프라인 시작');
        this.chatSystem.sendSystemMessage('전체 리뷰 파이프라인이 시작됩니다: 리뷰 → 토론 → 결론');

        this.startCodeReview(code, projectName).then(async () => {
          // Step 2: After review completes, start debate
          this.toastManager.info('Debate', '리뷰 완료 — 토론 세션으로 전환');
          const session = await this.debateManager.startDebate(code, projectName);
          await this.runDebateWithVisualization(session.id);
          this.toastManager.success('Full Review', '전체 리뷰 파이프라인 완료!');
        }).catch(err => {
          this.logError(`Full review error: ${err}`);
        });

        return `Full review pipeline started (review → debate) on ${code.length} chars`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'desk',
      aliases: ['책상'],
      description: 'Place or remove a desk',
      usage: '/desk <add|remove> <col> <row>',
      handler: async (args) => {
        if (args.length < 3) return 'Usage: /desk <add|remove> <col> <row>';
        const action = args[0];
        const col = parseInt(args[1]);
        const row = parseInt(args[2]);
        if (isNaN(col) || isNaN(row)) return 'Invalid coordinates';

        if (action === 'add') {
          const ok = this.tilemap.placeDesk(col, row);
          if (ok) {
            this.tilemapRenderer.renderMap(this.tilemap);
            this.toastManager.success('Desk', `책상 배치: (${col}, ${row})`);
            return `Desk placed at (${col}, ${row})`;
          }
          return `Cannot place desk at (${col}, ${row}) — tile is not empty floor`;
        } else if (action === 'remove') {
          const ok = this.tilemap.removeFurniture(col, row);
          if (ok) {
            this.tilemapRenderer.renderMap(this.tilemap);
            this.toastManager.info('Furniture', `가구 제거: (${col}, ${row})`);
            return `Furniture removed at (${col}, ${row})`;
          }
          return `Nothing to remove at (${col}, ${row})`;
        }
        return 'Usage: /desk <add|remove> <col> <row>';
      },
    });

    this.cliEngine.registerCommand({
      name: 'test',
      aliases: ['스트레스', '부하'],
      description: 'Run stress test on the system',
      usage: '/test [agents] [concurrent] [duration]',
      handler: async (args) => {
        const agentCount = parseInt(args[0]) || 10;
        const concurrent = parseInt(args[1]) || 3;
        const duration = parseInt(args[2]) || 5;
        
        this.logSystem(`🔧 부하 테스트 시작: 에이전트 ${agentCount}개, 동시 ${concurrent}개, ${duration}초`, 'system');
        this.toastManager.info('Stress Test', `에이전트 ${agentCount}개 테스트 중...`);
        
        const config: StressTestConfig = {
          agentCount,
          concurrentTasks: concurrent,
          duration,
          codeReviewCount: Math.floor(agentCount / 3),
        };
        
        const result = await testSuite.runStressTest(config, {
          onAgentSpawn: (count) => {
            if (count % 5 === 0) {
              this.logSystem(`에이전트 생성 중: ${count}/${agentCount}`, 'system');
            }
          },
          onTaskComplete: (taskId, duration) => {
            this.logSystem(`✅ 작업 완료: ${taskId} (${duration}ms)`, 'system');
          },
          onError: (error) => {
            this.logError(error);
          },
        });
        
        const report = testSuite.generateReport(result);
        this.logSystem(report, 'success');
        this.toastManager.success('Stress Test', `완료: ${result.totalTasksCompleted}개 작업, ${result.failedTasks}개 실패`);
        
        return report;
      },
    });

    this.cliEngine.registerCommand({
      name: 'loadtest',
      aliases: ['부하테스트'],
      description: 'Run load test - spawn many agents',
      usage: '/loadtest [count] [rate]',
      handler: async (args) => {
        const targetAgents = parseInt(args[0]) || 50;
        const spawnRate = parseInt(args[1]) || 10;
        
        this.logSystem(`🚀 부하 테스트: ${targetAgents}개 에이전트 생성`, 'system');
        this.toastManager.info('Load Test', `${targetAgents}개 에이전트 생성 중...`);
        
        const result = await testSuite.runLoadTest(targetAgents, spawnRate);
        
        const report = `
Load Test Results:
  에이전트: ${result.activeAgents}
  생성 시간: ${result.spawnTime}ms
  메모리 사용: ${(result.memoryUsed / 1024).toFixed(1)}KB
  FPS 드롭: ${result.fpsDrop.toFixed(1)}`;
        
        this.logSystem(report, result.fpsDrop < 20 ? 'success' : 'error');
        this.toastManager[result.fpsDrop < 20 ? 'success' : 'error']('Load Test', `FPS 드롭: ${result.fpsDrop.toFixed(1)}`);
        
        return report;
      },
    });

    this.cliEngine.registerCommand({
      name: 'debate-test',
      aliases: ['토론테스트'],
      description: 'Run debate stress test',
      usage: '/debate-test [participants]',
      handler: async (args) => {
        const participants = parseInt(args[0]) || 5;
        
        this.logSystem(`💬 토론 스트레스 테스트: ${participants}명 참여`, 'system');
        this.toastManager.info('Debate Test', `${participants}명 토론 시뮬레이션...`);
        
        const result = await testSuite.runDebateStressTest(participants);
        
        const report = `
Debate Stress Results:
  참여자: ${participants}
  라운드: 10
  총 턴: ${result.turns}
  에러: ${result.errors}
  소요 시간: ${result.duration}ms`;
        
        this.logSystem(report, result.errors === 0 ? 'success' : 'error');
        this.toastManager.success('Debate Test', `${result.turns}턴 완료, ${result.errors}에러`);
        
        return report;
      },
    });

    this.cliEngine.registerCommand({
      name: 'cicd-test',
      aliases: ['씨아이시디테스트'],
      description: 'Run CI/CD feedback loop test',
      usage: '/cicd-test [iterations]',
      handler: async (args) => {
        const iterations = parseInt(args[0]) || 20;
        
        this.logSystem(`⚙️ CI/CD 피드백 루프 테스트: ${iterations}회 반복`, 'system');
        this.toastManager.info('CI/CD Test', `${iterations}회 반복 테스트 중...`);
        
        const result = await testSuite.runCICDFeedbackLoopTest(iterations);
        
        const report = `
CI/CD Feedback Loop Results:
  반복: ${iterations}
  성공: ${result.success}
  실패: ${result.failed}
 成功率: ${(result.success / iterations * 100).toFixed(1)}%
  평균 시간: ${result.avgTime.toFixed(1)}ms`;
        
        this.logSystem(report, result.failed === 0 ? 'success' : 'error');
        this.toastManager[result.failed === 0 ? 'success' : 'error']('CI/CD Test', `성공 ${result.success}, 실패 ${result.failed}`);
        
        return report;
      },
    });

    this.cliEngine.registerCommand({
      name: 'agent-test',
      aliases: ['에이전트테스트'],
      description: 'Test agent types individually',
      usage: '/agent-test [arch:count] [sec:count] [perf:count]',
      handler: async (args) => {
        const types: { type: 'architect' | 'security' | 'performance' | 'developer' | 'reviewer'; count: number }[] = [];
        
        for (const arg of args) {
          const [type, count] = arg.split(':');
          if (type && count) {
            types.push({ type: type as any, count: parseInt(count) || 1 });
          }
        }
        
        if (types.length === 0) {
          types.push({ type: 'architect', count: 5 }, { type: 'security', count: 5 }, { type: 'performance', count: 5 });
        }
        
        this.logSystem(`🧪 에이전트 타입 테스트: ${types.map(t => `${t.type}:${t.count}`).join(', ')}`, 'system');
        this.toastManager.info('Agent Type Test', '테스트 실행 중...');
        
        const result = await testSuite.runAgentTypeTest(types);
        
        const report = result.map(r => `  ${r.type}: ${r.tasks} tasks in ${r.time}ms`).join('\n');
        this.logSystem(`에이전트 타입 테스트 결과:\n${report}`, 'success');
        this.toastManager.success('Agent Type Test', `${result.length}개 타입 테스트 완료`);
        
        testSuite.saveToHistory('stress', { types }, result);
        return `Agent Type Results:\n${report}`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'meeting-test',
      aliases: ['회의테스트'],
      description: 'Test meeting collaboration',
      usage: '/meeting-test [participants] [rounds]',
      handler: async (args) => {
        const participants = parseInt(args[0]) || 8;
        const rounds = parseInt(args[1]) || 5;
        
        this.logSystem(`🏢 회의 협업 테스트: ${participants}명, ${rounds}라운드`, 'system');
        this.toastManager.info('Meeting Test', '협업 시뮬레이션...');
        
        const result = await testSuite.runMeetingCollaborationTest(participants, rounds);
        
        const report = `
Meeting Collaboration Results:
  참여자: ${result.participants}
  라운드: ${result.rounds}
  메시지: ${result.messages}
  충돌: ${result.conflicts}
  충돌률: ${(result.conflicts / result.messages * 100).toFixed(1)}%`;
        
        this.logSystem(report, result.conflicts < result.messages * 0.2 ? 'success' : 'error');
        this.toastManager[result.conflicts < result.messages * 0.2 ? 'success' : 'error']('Meeting Test', `메시지 ${result.messages}, 충돌 ${result.conflicts}`);
        
        testSuite.saveToHistory('meeting', { participants, rounds }, result);
        return report;
      },
    });

    this.cliEngine.registerCommand({
      name: 'latency',
      aliases: ['지연'],
      description: 'Set network latency for tests',
      usage: '/latency [ms]',
      handler: async (args) => {
        const ms = parseInt(args[0]) || 0;
        testSuite.setNetworkLatency(ms);
        
        this.logSystem(`🌐 네트워크 지연 설정: ${ms}ms`, 'system');
        this.toastManager.info('Latency', ms > 0 ? `${ms}ms 지연 활성화` : '지연 비활성화');
        
        return `Network latency set to ${ms}ms`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'history',
      aliases: ['히스토리'],
      description: 'Show test history',
      usage: '/history [count]',
      handler: async (args) => {
        const count = parseInt(args[0]) || 10;
        const history = testSuite.getHistory().slice(-count);
        
        if (history.length === 0) {
          return '테스트 히스토리가 없습니다';
        }
        
        const report = history.map(h => {
          const time = new Date(h.timestamp).toLocaleTimeString('ko-KR');
          return `[${time}] ${h.type}: ${JSON.stringify(h.result).slice(0, 50)}...`;
        }).join('\n');
        
        this.logSystem(`📜 테스트 히스토리 (${history.length}개):\n${report}`, 'system');
        return `Test History:\n${report}`;
      },
    });

    this.cliEngine.registerCommand({
      name: 'clear-history',
      aliases: ['히스토리초기화'],
      description: 'Clear test history',
      usage: '/clear-history',
      handler: async () => {
        testSuite.clearHistory();
        this.logSystem('🗑️ 테스트 히스토리 초기화됨', 'success');
        this.toastManager.success('History', '히스토리 초기화 완료');
        return 'Test history cleared';
      },
    });

    this.cliEngine.registerCommand({
      name: 'table',
      aliases: ['회의테이블'],
      description: 'Place a meeting table zone',
      usage: '/table <col> <row> <width> <height>',
      handler: async (args) => {
        if (args.length < 4) return 'Usage: /table <col> <row> <width> <height>';
        const col = parseInt(args[0]);
        const row = parseInt(args[1]);
        const w = parseInt(args[2]);
        const h = parseInt(args[3]);
        if ([col, row, w, h].some(isNaN)) return 'Invalid parameters';

        const placed = this.tilemap.placeMeetingTable(col, row, w, h);
        if (placed > 0) {
          this.tilemapRenderer.renderMap(this.tilemap);
          this.toastManager.success('Meeting Table', `회의 테이블 배치: ${placed}타일`);
          return `Meeting table placed: ${placed} tiles at (${col}, ${row}) ${w}x${h}`;
        }
        return 'Could not place table (area not empty)';
      },
    });
  }

  private setupCLI(): void {
    const input = document.getElementById('cli-input') as HTMLInputElement;
    const submitBtn = document.getElementById('btn-submit') as HTMLButtonElement;
    const attachBtn = document.getElementById('btn-attach') as HTMLButtonElement;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const attachedFilesContainer = document.getElementById('attached-files') as HTMLDivElement;
    
    const attachedFiles: Array<{ name: string; path?: string; githubUrl?: string; type: 'file' | 'folder' | 'github' }> = [];

    const updateAttachedFilesDisplay = () => {
      attachedFilesContainer.innerHTML = '';
      for (let i = 0; i < attachedFiles.length; i++) {
        const file = attachedFiles[i];
        const fileEl = document.createElement('div');
        fileEl.className = `attached-file ${file.type === 'github' ? 'github' : ''}`;
        fileEl.innerHTML = `
          <span class="file-icon">${file.type === 'github' ? '🔗' : file.type === 'folder' ? '📁' : '📄'}</span>
          <span class="file-name">${file.name}</span>
          <button class="file-remove" data-index="${i}">×</button>
        `;
        attachedFilesContainer.appendChild(fileEl);
      }
      
      attachedFilesContainer.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.target as HTMLElement).dataset.index || '0');
          attachedFiles.splice(idx, 1);
          updateAttachedFilesDisplay();
        });
      });
    };

    const extractGitHubUrl = (text: string): string | null => {
      const githubRegex = /(?:github\.com|github\.com\/[\w-]+\/[\w-]+)(?:\/tree\/[\w-]+(?:\/[\w-]+)*|\/blob\/[\w-]+\/[\w./-]+|\/pull\/\d+|\/issues\/\d+)?/gi;
      const match = text.match(githubRegex);
      return match ? `https://${match[0]}` : null;
    };

    attachBtn?.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files) {
        for (const file of fileInput.files) {
          const isDirectory = (file as any).webkitRelativePath || file.name.includes('/');
          attachedFiles.push({
            name: (file as any).webkitRelativePath || file.name,
            type: isDirectory ? 'folder' : 'file'
          });
        }
        updateAttachedFilesDisplay();
        this.logSystem(`${fileInput.files.length}개 파일/폴더 첨부됨`, 'system');
      }
    });

    input.addEventListener('paste', (e) => {
      const pastedText = e.clipboardData?.getData('text');
      if (pastedText) {
        const githubUrl = extractGitHubUrl(pastedText);
        if (githubUrl && !attachedFiles.some(f => f.githubUrl === githubUrl)) {
          const repoName = githubUrl.split('github.com/')[1]?.split('/')[1] || 'repo';
          attachedFiles.push({
            name: repoName,
            githubUrl: githubUrl,
            type: 'github'
          });
          updateAttachedFilesDisplay();
          this.logSystem(`GitHub 레포지토리 첨부: ${githubUrl}`, 'system');
          e.preventDefault();
          input.value = '';
        }
      }
    });

    const handleSubmit = async () => {
      const command = input.value.trim();
      if (!command && attachedFiles.length === 0) return;

      const fullCommand = command + (attachedFiles.length > 0
        ? '\n\n--- 첨부파일 ---\n' + attachedFiles.map(f =>
            f.type === 'github' ? `🔗 ${f.githubUrl}` : `📁 ${f.name}`
          ).join('\n')
        : '');

      input.value = '';
      input.disabled = true;
      submitBtn.disabled = true;

      this.logUser(fullCommand);

      // Check for GitHub attachments and trigger review
      const githubFiles = attachedFiles.filter(f => f.type === 'github');
      if (githubFiles.length > 0) {
        for (const ghFile of githubFiles) {
          const githubUrl = ghFile.githubUrl;
          if (!githubUrl) continue;
          
          // Check if it's a PR URL first
          const prParsed = this.gitHubService.parsePRUrl(githubUrl);
          if (prParsed) {
            await this.handlePRReview(prParsed.owner, prParsed.repo, prParsed.prNumber);
          } else {
            // Regular repo URL
            const parsed = this.gitHubService.parseRepoUrl(githubUrl);
            if (parsed) {
              await this.handleGitHubReview(parsed.owner, parsed.repo, command);
            }
          }
        }
        attachedFiles.length = 0;
        updateAttachedFilesDisplay();
        input.disabled = false;
        submitBtn.disabled = false;
        input.focus();
        return;
      }

      // Process through CLI engine first (slash commands)
      const cliResult = await this.cliEngine.execute(command);

      if (command.startsWith('/')) {
        // Slash command handled by CLI engine
        if (cliResult.output) {
          const lines = cliResult.output.split('\n');
          for (const line of lines) {
            this.logSystem(line, cliResult.type === 'error' ? 'error' : cliResult.type === 'success' ? 'success' : 'system');
          }
        }
      } else {
        // Natural language — pass to orchestrator
        try {
          await this.orchestrator.processCommand(command);
        } catch (err) {
          this.logError(`Error: ${err}`);
          this.soundManager.playError();
        }
      }

      attachedFiles.length = 0;
      updateAttachedFilesDisplay();

      input.disabled = false;
      submitBtn.disabled = false;
      input.focus();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = this.cliEngine.historyUp();
        if (prev !== null) input.value = prev;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = this.cliEngine.historyDown();
        if (next !== null) input.value = next;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const suggestions = this.cliEngine.getAutocompleteSuggestions(input.value);
        if (suggestions.length === 1) {
          input.value = suggestions[0] + ' ';
        } else if (suggestions.length > 1) {
          this.logSystem(`Suggestions: ${suggestions.join(', ')}`, 'system');
        }
      }
    });

    submitBtn.addEventListener('click', handleSubmit);

    const minimizeBtn = document.getElementById('btn-minimize-panel');
    const panel = document.getElementById('agent-panel');
    minimizeBtn?.addEventListener('click', () => {
      panel?.classList.toggle('minimized');
    });

    // Repository Editor Panel
    this.setupRepositoryEditor(attachedFiles, updateAttachedFilesDisplay, attachedFilesContainer);
  }

  private setupRepositoryEditor(
    attachedFiles: Array<{ name: string; path?: string; githubUrl?: string; type: 'file' | 'folder' | 'github' }>,
    updateAttachedFilesDisplay: () => void,
    attachedFilesContainer: HTMLDivElement
  ): void {
    const repoPanel = document.getElementById('repo-editor-panel') as HTMLDivElement;
    const fileTree = document.getElementById('file-tree') as HTMLDivElement;
    const editorTabs = document.getElementById('editor-tabs') as HTMLDivElement;
    const editorContent = document.getElementById('code-textarea') as HTMLTextAreaElement;
    const repoTitle = document.getElementById('repo-title') as HTMLSpanElement;
    const closeBtn = document.getElementById('btn-close-repo') as HTMLButtonElement;
    const refreshBtn = document.getElementById('btn-refresh-repo') as HTMLButtonElement;

    let currentRepoUrl: string | null = null;
    let openTabs: Array<{ path: string; name: string; content: string }> = [];
    let activeTabIndex = -1;

    const showRepoPanel = () => repoPanel.classList.add('visible');
    const hideRepoPanel = () => repoPanel.classList.remove('visible');

    const parseGitHubUrl = (url: string): { owner: string; repo: string; branch: string } | null => {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) return null;
      const branchMatch = url.match(/tree\/([^\/]+)/);
      return {
        owner: match[1],
        repo: match[2].replace(/\/$/, ''),
        branch: branchMatch ? branchMatch[1] : 'main'
      };
    };

    const fetchFileTree = async (repoUrl: string): Promise<void> => {
      const parsed = parseGitHubUrl(repoUrl);
      if (!parsed) return;

      currentRepoUrl = repoUrl;
      repoTitle.textContent = `📁 ${parsed.owner}/${parsed.repo}`;
      showRepoPanel();

      fileTree.innerHTML = '<div class="file-tree-loading">🔄 Loading repository...</div>';

      try {
        const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents?ref=${parsed.branch}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          fileTree.innerHTML = '<div class="file-tree-error">Failed to load repository</div>';
          return;
        }

        const contents = await response.json();
        fileTree.innerHTML = '';

        const sortedContents = (Array.isArray(contents) ? contents : [contents]).sort((a, b) => {
          if (a.type === 'dir' && b.type !== 'dir') return -1;
          if (a.type !== 'dir' && b.type === 'dir') return 1;
          return a.name.localeCompare(b.name);
        });

        for (const item of sortedContents) {
          const itemEl = document.createElement('div');
          itemEl.className = `file-tree-item ${item.type === 'dir' ? 'folder' : ''}`;
          itemEl.innerHTML = `
            <span class="tree-icon">${item.type === 'dir' ? '📁' : this.getFileIcon(item.name)}</span>
            <span class="tree-name">${item.name}</span>
          `;
          
          itemEl.addEventListener('click', async () => {
            if (item.type === 'dir') {
              await fetchDirectory(parsed.owner, parsed.repo, item.path, parsed.branch);
            } else {
              await openFile(parsed.owner, parsed.repo, item.path, item.name, parsed.branch);
            }
          });
          
          fileTree.appendChild(itemEl);
        }
      } catch (error) {
        fileTree.innerHTML = '<div class="file-tree-error">Error loading repository</div>';
      }
    };

    const fetchDirectory = async (owner: string, repo: string, path: string, branch: string): Promise<void> => {
      try {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
        const response = await fetch(apiUrl);
        const contents = await response.json();

        fileTree.innerHTML = '';

        // Add back button
        const backEl = document.createElement('div');
        backEl.className = 'file-tree-item';
        backEl.innerHTML = '<span class="tree-icon">⬆️</span><span class="tree-name">..</span>';
        backEl.addEventListener('click', async () => {
          const parentPath = path.split('/').slice(0, -1).join('/');
          if (parentPath) {
            await fetchDirectory(owner, repo, parentPath, branch);
          } else {
            await fetchFileTree(currentRepoUrl!);
          }
        });
        fileTree.appendChild(backEl);

        const sortedContents = (Array.isArray(contents) ? contents : [contents]).sort((a, b) => {
          if (a.type === 'dir' && b.type !== 'dir') return -1;
          if (a.type !== 'dir' && b.type === 'dir') return 1;
          return a.name.localeCompare(b.name);
        });

        for (const item of sortedContents) {
          const itemEl = document.createElement('div');
          itemEl.className = `file-tree-item ${item.type === 'dir' ? 'folder' : ''}`;
          itemEl.innerHTML = `
            <span class="tree-icon">${item.type === 'dir' ? '📁' : this.getFileIcon(item.name)}</span>
            <span class="tree-name">${item.name}</span>
          `;
          
          itemEl.addEventListener('click', async () => {
            if (item.type === 'dir') {
              await fetchDirectory(owner, repo, item.path, branch);
            } else {
              await openFile(owner, repo, item.path, item.name, branch);
            }
          });
          
          fileTree.appendChild(itemEl);
        }
      } catch (error) {
        console.error('Error fetching directory:', error);
      }
    };

    const openFile = async (owner: string, repo: string, path: string, name: string, branch: string): Promise<void> => {
      const existingTab = openTabs.findIndex(t => t.path === path);
      if (existingTab >= 0) {
        activeTabIndex = existingTab;
        renderTabs();
        return;
      }

      try {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.content) {
          const content = atob(data.content);
          openTabs.push({ path, name, content });
          activeTabIndex = openTabs.length - 1;
          renderTabs();
          editorContent.value = content;
        }
      } catch (error) {
        console.error('Error opening file:', error);
      }
    };

    const renderTabs = () => {
      editorTabs.innerHTML = '';
      openTabs.forEach((tab, index) => {
        const tabEl = document.createElement('div');
        tabEl.className = `editor-tab ${index === activeTabIndex ? 'active' : ''}`;
        tabEl.innerHTML = `
          <span>${this.getFileIcon(tab.name)} ${tab.name}</span>
          <span class="close-tab" data-index="${index}">×</span>
        `;
        
        tabEl.addEventListener('click', (e) => {
          if (!(e.target as HTMLElement).classList.contains('close-tab')) {
            activeTabIndex = index;
            renderTabs();
            editorContent.value = openTabs[index].content;
          }
        });
        
        editorTabs.appendChild(tabEl);
      });

      editorTabs.querySelectorAll('.close-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.target as HTMLElement).dataset.index || '0');
          openTabs.splice(idx, 1);
          if (activeTabIndex >= openTabs.length) activeTabIndex = openTabs.length - 1;
          if (openTabs.length > 0) {
            editorContent.value = openTabs[activeTabIndex].content;
          } else {
            editorContent.value = '';
          }
          renderTabs();
        });
      });
    };

    // Watch for attached files changes
    const checkForGitHub = () => {
      const githubFile = attachedFiles.find(f => f.type === 'github' && f.githubUrl);
      if (githubFile?.githubUrl) {
        fetchFileTree(githubFile.githubUrl);
      }
    };

    // Close button
    closeBtn?.addEventListener('click', () => {
      hideRepoPanel();
      currentRepoUrl = null;
      openTabs = [];
      activeTabIndex = -1;
      editorContent.value = '';
      renderTabs();
    });

    // Refresh button
    refreshBtn?.addEventListener('click', () => {
      if (currentRepoUrl) {
        fetchFileTree(currentRepoUrl);
      }
    });

    // Save to GitHub button
    const saveGithubBtn = document.getElementById('btn-save-github') as HTMLButtonElement;
    const githubTokenInput = document.getElementById('github-token') as HTMLInputElement;
    saveGithubBtn?.addEventListener('click', async () => {
      const token = githubTokenInput?.value?.trim();
      if (!token) {
        this.toastManager.error('GitHub', 'GitHub 토큰을 입력해주세요 (ghp_...)');
        return;
      }
      if (!currentRepoUrl) {
        this.toastManager.error('GitHub', '저장할 레포지토리가 없습니다');
        return;
      }
      if (activeTabIndex < 0 || !openTabs[activeTabIndex]) {
        this.toastManager.error('GitHub', '저장할 파일을 선택해주세요');
        return;
      }

      const tab = openTabs[activeTabIndex];
      const parsed = parseGitHubUrl(currentRepoUrl);
      if (!parsed) return;

      // Update content from editor
      tab.content = editorContent.value;

      try {
        this.toastManager.info('GitHub', `${tab.name} 저장 중...`);
        // Get current file SHA for update
        const getUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${tab.path}?ref=${parsed.branch}`;
        const getRes = await fetch(getUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        const fileData = await getRes.json();
        const sha = fileData.sha;

        // Push updated content
        const putUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${tab.path}`;
        const putRes = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Update ${tab.name} via Pixel Office`,
            content: btoa(unescape(encodeURIComponent(tab.content))),
            sha,
            branch: parsed.branch,
          }),
        });

        if (putRes.ok) {
          this.toastManager.success('GitHub', `${tab.name} 저장 완료!`);
          this.chatSystem.sendSystemMessage(`GitHub에 ${tab.name} 파일이 저장되었습니다`);
          this.logSystem(`Saved ${tab.name} to GitHub`, 'success');
        } else {
          const err = await putRes.json();
          this.toastManager.error('GitHub', `저장 실패: ${err.message || putRes.status}`);
        }
      } catch (err) {
        this.toastManager.error('GitHub', `저장 중 오류: ${err}`);
      }
    });

    // Download button — download currently open file
    const downloadBtn = document.getElementById('btn-download') as HTMLButtonElement;
    downloadBtn?.addEventListener('click', () => {
      if (activeTabIndex < 0 || !openTabs[activeTabIndex]) {
        this.toastManager.error('Download', '다운로드할 파일을 선택해주세요');
        return;
      }
      const tab = openTabs[activeTabIndex];
      const content = editorContent.value || tab.content;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = tab.name;
      a.click();
      URL.revokeObjectURL(url);
      this.toastManager.success('Download', `${tab.name} 다운로드 완료`);
    });

    // Monitor attached files for GitHub URLs
    const observer = setInterval(() => {
      const githubFile = attachedFiles.find(f => f.type === 'github' && f.githubUrl);
      if (githubFile?.githubUrl && githubFile.githubUrl !== currentRepoUrl) {
        fetchFileTree(githubFile.githubUrl);
      }
    }, 1000);

    // Click on attached file to open repo
    attachedFilesContainer.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.attached-file')) {
        const githubFile = attachedFiles.find(f => f.type === 'github' && f.githubUrl);
        if (githubFile?.githubUrl) {
          fetchFileTree(githubFile.githubUrl);
        }
      }
    });
  }

  private getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const icons: Record<string, string> = {
      ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨',
      html: '🌐', css: '🎨', scss: '🎨', less: '🎨',
      json: '📋', md: '📝', txt: '📄',
      py: '🐍', rb: '💎', go: '🔵', rs: '🦀',
      java: '☕', kt: '🟣', swift: '🍎',
      png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
      zip: '📦', tar: '📦', gz: '📦',
    };
    return icons[ext] || '📄';
  }

  private setupResize(): void {
    window.addEventListener('resize', () => {
      this.app.renderer.resize(window.innerWidth, window.innerHeight - 150);
      this.camera.updateScreenSize(window.innerWidth, window.innerHeight - 150);
    });
  }

  private setupZoomControls(): void {
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    const zoomResetBtn = document.getElementById('btn-zoom-reset');

    zoomInBtn?.addEventListener('click', () => {
      this.camera.setZoom(this.camera.getZoom() + 0.25);
    });

    zoomOutBtn?.addEventListener('click', () => {
      this.camera.setZoom(this.camera.getZoom() - 0.25);
    });

    zoomResetBtn?.addEventListener('click', () => {
      this.camera.setZoom(1);
      this.camera.centerOn(
        (MAP_WIDTH * TILE_SIZE) / 2,
        (MAP_HEIGHT * TILE_SIZE) / 2
      );
    });

    // Monitor panel minimize
    const monitorMinimizeBtn = document.getElementById('btn-minimize-monitor');
    const monitorPanel = document.getElementById('monitor-panel');
    monitorMinimizeBtn?.addEventListener('click', () => {
      monitorPanel?.classList.toggle('minimized');
    });
  }

  private updateStats(): void {
    const agents = this.agentManager.getAllAgents().map(a => a.getSnapshot());
    const idle = agents.filter(a => a.state === AgentState.Idle).length;
    const working = agents.filter(a => a.state === AgentState.Working).length;
    const tasks = this.orchestrator.getTaskReport();

    document.getElementById('stat-agents')!.textContent = String(agents.length);
    document.getElementById('stat-idle')!.textContent = String(idle);
    document.getElementById('stat-working')!.textContent = String(working);
    document.getElementById('stat-tasks')!.textContent = String(tasks.pending + tasks.completed);
    document.getElementById('stat-fps')!.textContent = String(this.gameLoop.getFPS());
  }

  /** Run debate session with real-time visualization in chat and speech bubbles */
  private async runDebateWithVisualization(sessionId: string): Promise<void> {
    const session = await this.debateManager.runDebate(sessionId);

    // Stream each turn's message to chat with a small delay for visual effect
    for (const turn of session.turns) {
      const agent = this.agentManager.getAgent(turn.speakerId);
      const agentName = agent?.name || turn.speakerId;
      const agentRole = agent?.role || turn.speakerRole;

      // Send as agent chat message
      this.chatSystem.sendMessage(turn.speakerId, agentName, agentRole, turn.message);

      // Show speech bubble on the agent
      if (agent) {
        const snap = agent.getSnapshot();
        this.speechBubbleRenderer.addBubble(
          `debate-${turn.speakerId}-${turn.turn}`,
          turn.speakerId,
          turn.message.substring(0, 30) + '...',
          snap.position,
          0xFFFFFF,
          4000,
        );
        // Particle effect for each turn
        this.particleSystem.emitSparkle(snap.position, turn.agreement ? 0x00FF88 : 0xFF6666, 8);
      }

      // Findings logged
      for (const finding of turn.findings) {
        const severity = finding.severity === 'critical' ? '🔴' : finding.severity === 'high' ? '🟠' : '🟡';
        this.logSystem(`${severity} [${finding.category}] ${finding.description}`, 'system');
      }
    }

    // Final conclusion
    if (session.finalConclusion) {
      this.chatSystem.sendSystemMessage(`📋 토론 결론: ${session.finalConclusion}`);
      this.toastManager.success('Debate Complete', session.finalConclusion);
      this.logSystem(`Debate concluded: ${session.finalConclusion}`, 'success');
    }

    // Deactivate conference room
    this.meetingRoomRenderer.deactivateRoom('room-conference');

    // Add to review history
    this.addHistoryEntry({
      timestamp: Date.now(),
      type: 'debate',
      summary: session.finalConclusion || 'Debate completed',
      findings: session.turns.flatMap(t => t.findings).length,
      turns: session.turns.length,
    });
  }

  private addHistoryEntry(entry: { timestamp: number; type: string; summary: string; findings: number; turns: number }): void {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    // Remove empty state if present
    const emptyEl = historyList.querySelector('.history-empty');
    if (emptyEl) emptyEl.remove();

    const item = document.createElement('div');
    item.className = 'history-item';
    const date = new Date(entry.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    item.innerHTML = `
      <div class="history-time">${timeStr}</div>
      <div class="history-info">
        <div class="history-type">${entry.type === 'debate' ? '💬 토론' : '🔍 리뷰'}</div>
        <div class="history-summary">${entry.summary}</div>
        <div class="history-meta">${entry.findings}개 발견 | ${entry.turns}턴</div>
      </div>
    `;
    historyList.prepend(item);
  }

  private updateMonitoring(): void {
    const agents = this.agentManager.getAllAgents();
    const snapshots = agents.map(a => a.getSnapshot());
    
    const idle = snapshots.filter(a => a.state === AgentState.Idle).length;
    const working = snapshots.filter(a => a.state === AgentState.Working).length;
    const moving = snapshots.filter(a => a.state === AgentState.Moving).length;
    
    const runners = this.runnerManager.getAllRunners();
    const activeRunners = this.runnerManager.getActiveRunners();
    
    const tasks = this.orchestrator.getTaskReport();
    const allDebates = this.debateManager.getAllSessions();
    const activeDebates = allDebates.filter(s => s.status === 'active');
    
    const agentsEl = document.getElementById('monitor-agents');
    const runnersEl = document.getElementById('monitor-runners');
    const tasksEl = document.getElementById('monitor-tasks');
    const debatesEl = document.getElementById('monitor-debates');
    const tokensEl = document.getElementById('monitor-tokens');
    const turnsEl = document.getElementById('monitor-turns');
    const loopsEl = document.getElementById('monitor-loops');
    const successEl = document.getElementById('monitor-success');
    
    if (agentsEl) agentsEl.textContent = `${agents.length}명 (${idle} 대기, ${working} 작업)`;
    if (runnersEl) runnersEl.textContent = `${activeRunners.length}대/${runners.length}대`;
    if (tasksEl) tasksEl.textContent = `${tasks.pending + tasks.inProgress}건`;
    if (debatesEl) debatesEl.textContent = `${activeDebates.length}건`;
    if (tokensEl) tokensEl.textContent = `${this.debateManager.getTokenUsage()} 토큰`;
    
    const latestDebate = activeDebates[0];
    if (latestDebate && turnsEl) {
      turnsEl.textContent = `${latestDebate.currentTurn}/${latestDebate.maxTurns}`;
    } else if (turnsEl) {
      turnsEl.textContent = '0/3';
    }
    
    const stats = this.runnerManager.getStats();
    if (loopsEl) loopsEl.textContent = `${stats.runningLoops}건`;

    const totalTests = stats.totalTests || 1;
    const completedLoops = stats.completedLoops || 0;
    const successRate = Math.round((completedLoops / totalTests) * 100);
    if (successEl) successEl.textContent = `${successRate}%`;

    // Average time from completed loops
    const avgTimeEl = document.getElementById('monitor-avg-time');
    if (avgTimeEl) {
      const allLoops = this.runnerManager.getAllLoops();
      const completed = allLoops.filter(l => l.completedAt);
      if (completed.length > 0) {
        const avgMs = completed.reduce((sum, l) => sum + ((l.completedAt || l.startedAt) - l.startedAt), 0) / completed.length;
        avgTimeEl.textContent = `${(avgMs / 1000).toFixed(1)}s`;
      } else {
        avgTimeEl.textContent = '0s';
      }
    }
  }

  private updateAgentPanel(): void {
    const agentList = document.getElementById('agent-list');
    const agents = this.agentManager.getAllAgents().map(a => a.getSnapshot());

    if (agentList!.children.length !== agents.length) {
      agentList!.innerHTML = '';
      for (const agent of agents) {
        const item = document.createElement('div');
        item.className = 'agent-item';
        item.dataset.state = agent.state;
        item.innerHTML = `
          <div class="agent-avatar"></div>
          <div class="agent-info">
            <div class="agent-name">${agent.name}</div>
            <div class="agent-role">${this.getRoleLabel(agent.role)}</div>
          </div>
          <div class="agent-state" data-state="${agent.state}">${agent.state}</div>
        `;
        agentList!.appendChild(item);
      }
    } else {
      const items = agentList!.children;
      for (let i = 0; i < agents.length; i++) {
        const item = items[i] as HTMLElement;
        item.dataset.state = agents[i].state;
        const stateEl = item.querySelector('.agent-state') as HTMLElement;
        if (stateEl) {
          stateEl.dataset.state = agents[i].state;
          stateEl.textContent = agents[i].state;
        }
      }
    }
  }

  private getRoleLabel(role: AgentRole): string {
    const labels: Record<string, string> = {
      [AgentRole.Frontend]: 'Frontend Developer',
      [AgentRole.Backend]: 'Backend Developer',
      [AgentRole.Designer]: 'Designer',
      [AgentRole.PM]: 'Project Manager',
      [AgentRole.QA]: 'QA Engineer',
      [AgentRole.DevOps]: 'DevOps Engineer',
      [AgentRole.Architect]: 'Architect',
      [AgentRole.SecurityEngineer]: 'Security Engineer',
      [AgentRole.PerformanceEngineer]: 'Performance Engineer',
    };
    return labels[role] || role;
  }

  private logUser(message: string): void {
    this.addCliMessage(message, 'user');
  }

  private logSystem(message: string, type: 'system' | 'success' | 'error' = 'system'): void {
    this.addCliMessage(message, type);
  }

  private logError(message: string): void {
    this.addCliMessage(message, 'error');
  }

  private async handleGitHubReview(owner: string, repo: string, command: string): Promise<void> {
    this.toastManager.info('GitHub', `${owner}/${repo} 분석 준비 중...`);
    this.logSystem(`🔗 GitHub 레포지토리 분석: ${owner}/${repo}`, 'system');

    try {
      this.toastManager.info('Fetching', '레포지토리 파일 가져오는 중...');
      
      // Get repo info and files
      const analysis = await this.gitHubService.analyzeRepo(owner, repo);
      
      this.logSystem(`📊 분석 결과: ${analysis.repo.stars} stars, ${analysis.repo.language}`, 'system');

      // Get main source files for review
      const sourceFiles: string[] = [];
      const contents = await this.gitHubService.getContents(owner, repo);
      
      for (const file of contents.slice(0, 10)) {
        if (file.type === 'file' && (file.name.endsWith('.ts') || file.name.endsWith('.js') || file.name.endsWith('.tsx') || file.name.endsWith('.jsx'))) {
          const content = await this.gitHubService.getFileContent(owner, repo, file.path);
          sourceFiles.push(`// ${file.path}\n${content}`);
        }
      }

      const codeToReview = sourceFiles.join('\n\n---\n\n') || `Repository: ${owner}/${repo}\nLanguage: ${analysis.repo.language}`;
      
      // Start review with the fetched code
      const projectName = `GitHub-Review-${repo}`;
      await this.startCodeReview(codeToReview, projectName);
      
      this.toastManager.success('Complete', `${owner}/${repo} 리뷰 완료`);
      this.logSystem(`✅ GitHub 리뷰 완료: ${owner}/${repo}`, 'success');
      
    } catch (error) {
      this.toastManager.error('GitHub Error', `${error}`);
      this.logError(`GitHub 분석 실패: ${error}`);
    }
  }

  private async handlePRReview(owner: string, repo: string, prNumber: number): Promise<void> {
    this.toastManager.info('PR Review', `#${prNumber} 분석 준비 중...`);
    this.logSystem(`📋 PR #${prNumber} 리뷰 시작: ${owner}/${repo}`, 'system');

    try {
      this.toastManager.info('Fetching', 'PR 정보 가져오는 중...');
      
      // Get PR details
      const pr = await this.gitHubService.getPullRequest(owner, repo, prNumber);
      
      this.logSystem(`📝 PR: ${pr.title}`, 'system');
      this.logSystem(`👤 작성자: ${pr.author} | 변경파일: ${pr.changedFiles}개 (+${pr.additions} -${pr.deletions})`, 'system');
      this.logSystem(`🔀 ${pr.headBranch} → ${pr.baseBranch}`, 'system');

      // Get PR files
      this.toastManager.info('Fetching', '변경 파일 가져오는 중...');
      const prFiles = await this.gitHubService.getPullRequestFiles(owner, repo, prNumber);
      
      this.logSystem(`📂 변경된 파일: ${prFiles.length}개`, 'system');
      
      // Build code for review with patch info
      const codeToReview = prFiles.map(file => {
        const statusIcon = file.status === 'added' ? '🟢' : file.status === 'removed' ? '🔴' : file.status === 'modified' ? '🟡' : '🔵';
        return `// ${statusIcon} ${file.filename} (${file.status})\n// +${file.additions} -${file.deletions}\n${file.patch || '(no diff available)'}`;
      }).join('\n\n---\n\n');

      // Move review agents to workspace for PR review
      const reviewAgents = ['review-architect', 'review-security', 'review-performance'];
      for (const agentId of reviewAgents) {
        const agent = this.agentManager.getAgent(agentId);
        if (agent) {
          agent.assignTask({
            id: `pr-review-${agentId}`,
            description: `PR #${prNumber} 리뷰 중`,
            requiredRole: agent.role,
            targetDesk: { col: 15 + reviewAgents.indexOf(agentId) * 3, row: 15 },
            priority: TaskPriority.High,
            status: TaskStatus.Assigned,
            assignedAgentId: agentId,
            estimatedDuration: 5,
            progress: 0,
            parentTaskId: null,
            createdAt: Date.now(),
          });
        }
      }

      // Start review with PR diff code
      const projectName = `PR-Review-${prNumber}`;
      await this.startCodeReview(codeToReview, projectName);
      
      this.toastManager.success('PR Complete', `#${prNumber} 리뷰 완료`);
      this.logSystem(`✅ PR #${prNumber} 리뷰 완료`, 'success');
      
    } catch (error) {
      this.toastManager.error('PR Error', `${error}`);
      this.logError(`PR 리뷰 실패: ${error}`);
    }
  }

  private addCliMessage(message: string, type: string): void {
    const output = document.getElementById('cli-output')!;
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    
    const div = document.createElement('div');
    div.className = `cli-message ${type}`;
    div.innerHTML = `
      <span class="time">[${time}]</span>
      <span class="content">${message}</span>
    `;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }

  private db: IDBDatabase | null = null;

  private setupStorage(): void {
    const request = indexedDB.open('PixelOfficeDB', 1);

    request.onerror = () => {
      console.error('IndexedDB 열기 실패');
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      this.logSystem('💾 저장소 준비 완료', 'system');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('reviews')) {
        const store = db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('projectName', 'projectName', { unique: false });
      }
    };
  }

  private async saveReviewToDB(report: AggregatedReviewReport, projectName: string, code: string): Promise<void> {
    console.log('[Debug] saveReviewToDB called:', { projectName, dbExists: !!this.db });
    
    if (!this.db) {
      console.warn('[Debug] IndexedDB not initialized, attempting to init...');
      this.logSystem('⚠️ 저장소를 초기화합니다...', 'system');
      
      // Try to init DB
      const request = indexedDB.open('PixelOfficeDB', 1);
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.logSystem('💾 저장소 준비 완료', 'system');
        this.saveReviewToDB(report, projectName, code);
      };
      request.onerror = () => {
        this.logError('저장소 초기화 실패');
      };
      return;
    }

    try {
      const transaction = this.db.transaction(['reviews'], 'readwrite');
      const store = transaction.objectStore('reviews');

      const reviewRecord = {
        projectName: projectName || 'Untitled',
        timestamp: Date.now(),
        code: code.substring(0, 5000),
        report: JSON.stringify(report),
        totalScore: report.totalScore,
      };

      const request = store.add(reviewRecord);
      
      request.onsuccess = () => {
        console.log('[Debug] Review saved successfully:', request.result);
        this.logSystem('💾 검수 결과가 자동으로 저장되었습니다.', 'success');
        this.loadHistory(); // Reload history after saving
      };
      
      request.onerror = () => {
        console.error('[Debug] Failed to save review:', request.error);
        this.logError('검수 결과 저장 실패');
      };
    } catch (error) {
      console.error('[Debug] Error saving to DB:', error);
      this.logError(`저장 오류: ${error}`);
    }
  }

  private async loadHistory(): Promise<void> {
    if (!this.db) return;

    const historyList = document.getElementById('history-list') as HTMLDivElement;
    const transaction = this.db.transaction(['reviews'], 'readonly');
    const store = transaction.objectStore('reviews');
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev');

    let count = 0;
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor && count < 10) {
        const record = cursor.value;
        const date = new Date(record.timestamp);
        const dateStr = date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        
        const scoreClass = record.totalScore >= 80 ? 'high' : record.totalScore >= 60 ? 'medium' : 'low';
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div class="project-name">${record.projectName}</div>
          <div class="timestamp">${dateStr}</div>
          <div class="score ${scoreClass}">점수: ${record.totalScore}/100</div>
        `;
        item.addEventListener('click', () => {
          this.logSystem(`📂 '${record.projectName}' 검수 기록을 불러옵니다...`, 'system');
          let report;
          try {
            report = typeof record.report === 'string' ? JSON.parse(record.report) : record.report;
          } catch (e) {
            report = record.report;
          }
          this.logSystem(`📊 종합 점수: ${report?.totalScore || record.totalScore}/100`, 'success');
          this.logSystem(`   - 아키텍처: ${report?.architectureScore || 0}/100`, 'system');
          this.logSystem(`   - 보안/버그: ${report?.bugsScore || 0}/100`, 'system');
          this.logSystem(`   - 성능: ${report?.performanceScore || 0}/100`, 'system');
          if (report?.findings?.length > 0) {
            this.logSystem(`   - 발견된 문제: ${report.findings.length}건`, 'system');
          }
        });
        
        historyList.appendChild(item);
        count++;
        cursor.continue();
      }
    };

    // Setup history panel minimize button
    const historyMinimizeBtn = document.getElementById('btn-minimize-history');
    const historyPanel = document.getElementById('history-panel');
    historyMinimizeBtn?.addEventListener('click', () => {
      historyPanel?.classList.toggle('minimized');
    });
  }

  private exportToMarkdown(report: AggregatedReviewReport, projectName: string): void {
    const markdown = this.reviewService.formatReviewReport(report);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_review_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.logSystem('📥 마크다운 파일로 다운로드되었습니다.', 'success');
  }

  private async startCodeReview(code: string, projectName: string): Promise<void> {
    this.logSystem('🔍 코드 검수를 시작합니다...', 'system');

    const architect = this.agentManager.getAgent('review-architect');
    const security = this.agentManager.getAgent('review-security');
    const performance = this.agentManager.getAgent('review-performance');

    if (architect) {
      architect.assignTask({
        id: 'task-architect',
        description: '🏗️ 구조 분석 중...',
        requiredRole: AgentRole.Architect,
        targetDesk: { col: 15, row: 15 },
        priority: TaskPriority.High,
        status: TaskStatus.Assigned,
        assignedAgentId: 'review-architect',
        estimatedDuration: 3,
        progress: 0,
        parentTaskId: null,
        createdAt: Date.now(),
      });
      this.logSystem('👨‍💻 수석 아키텍트 - 작업장으로 이동 중...', 'system');
    }

    if (security) {
      security.assignTask({
        id: 'task-security',
        description: '🔒 보안 분석 중...',
        requiredRole: AgentRole.SecurityEngineer,
        targetDesk: { col: 18, row: 15 },
        priority: TaskPriority.High,
        status: TaskStatus.Assigned,
        assignedAgentId: 'review-security',
        estimatedDuration: 3,
        progress: 0,
        parentTaskId: null,
        createdAt: Date.now(),
      });
      this.logSystem('🔒 보안/QA 엔지니어 - 작업장으로 이동 중...', 'system');
    }

    if (performance) {
      performance.assignTask({
        id: 'task-performance',
        description: '⚡ 성능 분석 중...',
        requiredRole: AgentRole.PerformanceEngineer,
        targetDesk: { col: 21, row: 15 },
        priority: TaskPriority.High,
        status: TaskStatus.Assigned,
        assignedAgentId: 'review-performance',
        estimatedDuration: 3,
        progress: 0,
        parentTaskId: null,
        createdAt: Date.now(),
      });
      this.logSystem('⚡ 성능 전문가 - 작업장으로 이동 중...', 'system');
    }

    try {
      // Phase 1: Show speech bubbles for each agent
      if (architect) {
        const architectPos = architect.getPosition();
        this.speechBubbleRenderer.addBubble(
          'bubble-architect-1',
          'review-architect',
          '🔍 코드 구조를 분석 중입니다...',
          architectPos,
          0x9C27B0,
          2000
        );
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      if (security) {
        const securityPos = security.getPosition();
        this.speechBubbleRenderer.addBubble(
          'bubble-security-1',
          'review-security',
          '🛡️ 보안 취약점을 검토 중입니다...',
          securityPos,
          0xF44336,
          2000
        );
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      if (performance) {
        const performancePos = performance.getPosition();
        this.speechBubbleRenderer.addBubble(
          'bubble-performance-1',
          'review-performance',
          '⚡ 성능 최적화 포인트를 탐색 중입니다...',
          performancePos,
          0xFF9800,
          2000
        );
      }

      this.logSystem('🔍 분석 작업 진행 중...', 'system');

      const report = await this.reviewService.runParallelReview(code);
      
      // Phase 2: Show completion speech bubbles
      if (architect) {
        this.speechBubbleRenderer.addBubble(
          'bubble-architect-done',
          'review-architect',
          `구조 분석 완료! (${report.architectureScore}점)`,
          architect.getPosition(),
          0x9C27B0,
          3000
        );
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      if (security) {
        this.speechBubbleRenderer.addBubble(
          'bubble-security-done',
          'review-security',
          `보안 검토 완료! (${report.bugsScore}점)`,
          security.getPosition(),
          0xF44336,
          3000
        );
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      if (performance) {
        this.speechBubbleRenderer.addBubble(
          'bubble-performance-done',
          'review-performance',
          `성능 분석 완료! (${report.performanceScore}점)`,
          performance.getPosition(),
          0xFF9800,
          3000
        );
      }

      this.logSystem('✅ 검수 완료!', 'success');
      this.logSystem(`📊 종합 점수: ${report.totalScore}/100`, 'success');
      this.logSystem(`   - 🏗️ 아키텍처: ${report.architectureScore}/100`, 'system');
      this.logSystem(`   - 🔒 보안/버그: ${report.bugsScore}/100`, 'system');
      this.logSystem(`   - ⚡ 성능: ${report.performanceScore}/100`, 'system');

      const findingsCount = report.findings.length;
      if (findingsCount > 0) {
        this.logSystem(`🔍 ${findingsCount}개의 문제점을 발견했습니다.`, 'system');
      }

      await this.saveReviewToDB(report, projectName, code);
      this.exportToMarkdown(report, projectName);

      this.logSystem('💡 자세한 분석 결과는 다운로드된 파일을 확인하세요.', 'system');
    } catch (error) {
      this.logError(`검수 중 오류 발생: ${error}`);
    }
  }

  private displayChatMessage(sender: string, content: string, type: 'text' | 'system' | 'debate' = 'text'): void {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    // Remove empty message if exists
    const emptyMsg = chatMessages.querySelector('.chat-empty');
    if (emptyMsg) {
      emptyMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
      <div class="sender ${type}">${sender}</div>
      <div class="content">${content}</div>
      <div class="timestamp">${time}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  private setupChatPanel(): void {
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const sendBtn = document.getElementById('btn-send-chat');
    const minimizeBtn = document.getElementById('btn-minimize-chat');
    const chatPanel = document.getElementById('chat-panel');

    const handleSend = () => {
      const message = chatInput.value.trim();
      if (!message) return;

      chatInput.value = '';
      this.chatSystem.sendMessage('user', '사용자', 'user', message, 'text');
      this.displayChatMessage('사용자', message, 'text');

      // Simulate agent response
      setTimeout(() => {
        const agents = this.agentManager.getAllAgents();
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];
        if (randomAgent) {
          const responses = [
            '명령을 확인했습니다. 작업을 시작합니다.',
            '분석 중입니다...',
            '검토를 진행하겠습니다.',
            '알겠습니다. 처리 중입니다.',
          ];
          const response = responses[Math.floor(Math.random() * responses.length)];
          this.displayChatMessage(randomAgent.name, response, 'text');
        }
      }, 500);
    };

    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    });

    sendBtn?.addEventListener('click', handleSend);

    minimizeBtn?.addEventListener('click', () => {
      chatPanel?.classList.toggle('minimized');
    });

    // Listen for chat system messages
    this.chatSystem.onMessage((msg) => {
      if (msg.senderId !== 'user') {
        this.displayChatMessage(msg.senderName, msg.content, msg.type);
      }
    });
  }

  private setupThemeToggle(): void {
    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const body = document.body;

    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.dataset.theme = savedTheme;
    if (themeIcon) {
      themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    }

    themeToggleBtn?.addEventListener('click', () => {
      const currentTheme = body.dataset.theme || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      body.dataset.theme = newTheme;
      localStorage.setItem('theme', newTheme);
      
      if (themeIcon) {
        themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
      }

      this.logSystem(`테마 변경: ${newTheme === 'dark' ? '다크 모드' : '라이트 모드'}`, 'system');
    });
  }

  private setupContextMenu(): void {
    const menu = document.getElementById('agent-context-menu') as HTMLDivElement;
    const menuHeader = document.getElementById('context-menu-header') as HTMLDivElement;
    let contextAgentId: string | null = null;

    const hideMenu = () => {
      menu.classList.remove('visible');
      contextAgentId = null;
    };

    // Right-click on canvas shows context menu if agent is under cursor
    const canvas = document.getElementById('game-canvas') as HTMLDivElement;
    canvas?.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      // Find agent near click position using the selection system's cache
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert screen coords to world coords (approximate using camera)
      const zoom = this.camera.getZoom();
      const worldX = mouseX / zoom + (this.rootContainer.x < 0 ? -this.rootContainer.x / zoom : 0);
      const worldY = mouseY / zoom + (this.rootContainer.y < 0 ? -this.rootContainer.y / zoom : 0);

      const snapshots = this.agentManager.getAllAgents().map(a => a.getSnapshot());
      let closestAgent: { id: string; name: string; role: string; dist: number } | null = null;
      for (const snap of snapshots) {
        const dx = snap.position.x - worldX;
        const dy = snap.position.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 30 && (!closestAgent || dist < closestAgent.dist)) {
          closestAgent = { id: snap.id, name: snap.name, role: snap.role, dist };
        }
      }

      if (closestAgent) {
        contextAgentId = closestAgent.id;
        menuHeader.textContent = `${closestAgent.name} (${closestAgent.role})`;
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.classList.add('visible');
      } else {
        hideMenu();
      }
    });

    // Hide on click outside
    document.addEventListener('click', hideMenu);

    // Context menu actions
    document.getElementById('ctx-follow')?.addEventListener('click', () => {
      if (!contextAgentId) return;
      const agent = this.agentManager.getAgent(contextAgentId);
      if (agent) {
        this.camera.followPosition(agent.getPosition());
        this.agentSelection.selectAgent(contextAgentId);
        this.soundManager.playSelect();
      }
      hideMenu();
    });

    document.getElementById('ctx-info')?.addEventListener('click', () => {
      if (!contextAgentId) return;
      const agent = this.agentManager.getAgent(contextAgentId);
      if (agent) {
        const snap = agent.getSnapshot();
        const info = [
          `ID: ${snap.id}`,
          `Name: ${snap.name}`,
          `Role: ${snap.role}`,
          `State: ${snap.state}`,
          `Position: (${snap.position.x.toFixed(0)}, ${snap.position.y.toFixed(0)})`,
          `Grid: (${snap.gridCell.col}, ${snap.gridCell.row})`,
          snap.currentTask ? `Task: ${snap.currentTask.description}` : 'No active task',
          snap.progress > 0 ? `Progress: ${(snap.progress * 100).toFixed(0)}%` : '',
        ].filter(Boolean);
        for (const line of info) this.logSystem(line, 'system');
      }
      hideMenu();
    });

    document.getElementById('ctx-assign')?.addEventListener('click', () => {
      if (!contextAgentId) return;
      const input = document.getElementById('cli-input') as HTMLInputElement;
      input.value = `/assign ${this.agentManager.getAgent(contextAgentId)?.role || 'frontend'} `;
      input.focus();
      hideMenu();
    });

    document.getElementById('ctx-recall')?.addEventListener('click', () => {
      if (!contextAgentId) return;
      const agent = this.agentManager.getAgent(contextAgentId);
      if (agent) {
        const snap = agent.getSnapshot();
        agent.assignTask({
          id: `recall-${Date.now()}`,
          description: '홈 데스크로 복귀',
          requiredRole: snap.role,
          targetDesk: snap.gridCell, // will be overridden to home
          priority: TaskPriority.Normal,
          status: TaskStatus.Assigned,
          assignedAgentId: contextAgentId,
          estimatedDuration: 2,
          progress: 0,
          parentTaskId: null,
          createdAt: Date.now(),
        });
        this.logSystem(`${snap.name}을(를) 홈으로 복귀시킵니다`, 'system');
      }
      hideMenu();
    });

    document.getElementById('ctx-meeting')?.addEventListener('click', () => {
      if (!contextAgentId) return;
      const agent = this.agentManager.getAgent(contextAgentId);
      if (agent) {
        const meeting = this.collaborationSystem.callMeeting(
          MeetingType.StandUp,
          [agent.role],
          `${agent.name} 요청 회의`,
          10,
        );
        if (meeting) {
          this.soundManager.playMeetingStart();
          this.logSystem(`${agent.name}의 역할 그룹 회의 소집됨`, 'success');
        }
      }
      hideMenu();
    });

    document.getElementById('ctx-pair')?.addEventListener('click', () => {
      if (!contextAgentId) return;
      const agent = this.agentManager.getAgent(contextAgentId);
      if (agent) {
        const partnerRole = agent.role === AgentRole.Frontend ? AgentRole.Backend : AgentRole.Frontend;
        const session = this.collaborationSystem.startPairProgramming(agent.role, partnerRole, 'Context menu pair session');
        if (session) {
          this.logSystem(`페어 프로그래밍 시작: ${agent.name}`, 'success');
        }
      }
      hideMenu();
    });
  }

  private setupKeyboardShortcuts(): void {
    const shortcutsOverlay = document.getElementById('shortcuts-overlay') as HTMLDivElement;

    document.addEventListener('keydown', (e) => {
      // Don't trigger when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case '+':
        case '=':
          this.camera.setZoom(this.camera.getZoom() + 0.25);
          break;
        case '-':
          this.camera.setZoom(this.camera.getZoom() - 0.25);
          break;
        case '0':
          this.camera.setZoom(1);
          break;
        case 'Home':
          this.camera.centerOn((MAP_WIDTH * TILE_SIZE) / 2, (MAP_HEIGHT * TILE_SIZE) / 2);
          this.camera.setZoom(1);
          break;
        case 'Escape':
          this.camera.clearFollow();
          this.agentSelection.deselect();
          shortcutsOverlay?.classList.remove('visible');
          break;
        case 'Tab':
          e.preventDefault();
          this.cycleNextAgent();
          break;
        case 's':
        case 'S':
          this.statsChart.toggle();
          break;
        case 'p':
        case 'P':
          this.performanceOverlay.toggle();
          break;
        case '/':
          e.preventDefault();
          (document.getElementById('cli-input') as HTMLInputElement)?.focus();
          break;
        case '?':
          shortcutsOverlay?.classList.toggle('visible');
          break;
      }
    });

    // Click outside overlay to close
    shortcutsOverlay?.addEventListener('click', (e) => {
      if (e.target === shortcutsOverlay) {
        shortcutsOverlay.classList.remove('visible');
      }
    });
  }

  private cycleNextAgent(): void {
    const agents = this.agentManager.getAllAgents();
    if (agents.length === 0) return;

    const currentId = this.agentSelection.getSelectedAgentId();
    let nextIndex = 0;
    if (currentId) {
      const currentIndex = agents.findIndex(a => a.id === currentId);
      nextIndex = (currentIndex + 1) % agents.length;
    }

    const next = agents[nextIndex];
    this.agentSelection.selectAgent(next.id);
    this.camera.followPosition(next.getPosition());
    this.soundManager.playSelect();
  }
}

new PixelOfficeApp();
