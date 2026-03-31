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
import { Pathfinder } from './spatial/Pathfinder';
import { Tilemap } from './spatial/Tilemap';
import { LocalAvoidance } from './spatial/LocalAvoidance';
import { ReviewService } from './services/ReviewService';
import { DebateManager } from './debate/DebateManager';
import { RunnerManager, FeedbackLoopState } from './debate/RunnerManager';
import { CLIEngine } from './core/CLIEngine';
import { SoundManager } from './core/SoundManager';
import { CollaborationSystem, MeetingType } from './agent/CollaborationSystem';
import { AgentConfig, AgentRole, AgentState, EventType, AggregatedReviewReport, TaskPriority, TaskStatus } from './types';

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
  private debateManager: DebateManager;
  private runnerManager: RunnerManager;
  private minimapRenderer!: MinimapRenderer;
  private performanceOverlay!: PerformanceOverlay;
  private agentSelection!: AgentSelectionSystem;
  private particleSystem!: ParticleSystem;
  private speechBubbleRenderer!: SpeechBubbleRenderer;
  private statsChart!: StatsChartRenderer;
  private cliEngine: CLIEngine;
  private soundManager: SoundManager;
  private collaborationSystem!: CollaborationSystem;

  private rootContainer: PIXI.Container;
  private gameContainer: PIXI.Container;
  private hudContainer!: PIXI.Container;

  constructor() {
    this.app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight - 180,
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
    const screenHeight = window.innerHeight - 180;
    this.camera = new CameraController(this.rootContainer, screenWidth, screenHeight);
    this.tilemapRenderer = new TilemapRenderer(this.gameContainer);
    this.tilemapRenderer.renderMap(this.tilemap);
    this.agentRenderer = new AgentRenderer(this.gameContainer);
    this.reviewService = new ReviewService();
    this.debateManager = new DebateManager();
    this.runnerManager = new RunnerManager();

    // HUD container (screen-space, not affected by camera)
    this.hudContainer = new PIXI.Container();
    this.app.stage.addChild(this.hudContainer);

    // Phase 1: Minimap
    this.minimapRenderer = new MinimapRenderer(this.hudContainer, 200, 120);
    this.minimapRenderer.setPosition(16, screenHeight - 150);
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

    // Phase 9: Stats Chart
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

    this.gameLoop.start();
    this.logSystem('Pixel Office MAS Dashboard initialized');
    this.logSystem('📋 코드 리뷰 오피스가 준비되었습니다.');
    this.logSystem('CLI에 코드를 입력하고 "검수" 또는 "리뷰" 명령으로 코드 리뷰를 요청하세요.');
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
        window.innerHeight - 180,
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
      const { agentId, taskDescription } = event.payload as { agentId: string; taskDescription: string };
      const agent = this.agentManager.getAgent(agentId);
      if (agent) {
        this.logSystem(`Assigned to ${agent.name}: "${taskDescription.substring(0, 30)}..."`, 'success');
        this.soundManager.playTaskAssigned();
      }
    });

    this.eventBus.on(EventType.AgentStateChanged, (event) => {
      const { agentId, newState } = event.payload as { agentId: string; newState: AgentState };
    });

    this.eventBus.on(EventType.TaskCompleted, (event) => {
      const { agentId, taskId } = event.payload as { agentId: string; taskId: string };
      const agent = this.agentManager.getAgent(agentId);
      if (agent) {
        this.logSystem(`Task completed by ${agent.name}`, 'success');
        this.soundManager.playTaskComplete();
        // Sparkle particle at agent position
        const snap = agent.getSnapshot();
        this.particleSystem.emitSparkle(snap.position, 0x3fb950, 15);
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
      this.app.renderer.resize(window.innerWidth, window.innerHeight - 180);
      this.camera.updateScreenSize(window.innerWidth, window.innerHeight - 180);
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
    
    // Setup monitor panel minimize button
    const monitorMinimizeBtn = document.getElementById('btn-minimize-monitor');
    const monitorPanel = document.getElementById('monitor-panel');
    monitorMinimizeBtn?.addEventListener('click', () => {
      monitorPanel?.classList.toggle('minimized');
    });
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      this.logSystem('🔍 분석 작업 진행 중...', 'system');

      const report = await this.reviewService.runParallelReview(code);
      
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
}

new PixelOfficeApp();
