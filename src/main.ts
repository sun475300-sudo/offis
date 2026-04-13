import * as PIXI from 'pixi.js';

// Diagnostic: Global error handler to see silent crashes
window.onerror = (msg, url, line, col, error) => {
  const log = document.createElement('div');
  log.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:red;color:white;padding:10px;font-family:monospace;';
  log.textContent = `CRASH: ${msg} at ${line}:${col}`;
  document.body.appendChild(log);
  return false;
};

console.log('Offis Boot Sequence Started');
import { 
  AgentRole, 
  AgentState, 
  EventType, 
  GameEvent, 
  IEventBus, 
  TaskPriority, 
  TaskStatus 
} from './types';

// Core Systems
import { EventBus } from './core/EventBus';
import { CLIEngine } from './core/CLIEngine';
import { Orchestrator } from './core/Orchestrator';
import { AgentManager } from './agent/AgentManager';
import { Tilemap } from './spatial/Tilemap';
import { Pathfinder } from './spatial/Pathfinder';

// Rendering
import { TilemapRenderer } from './rendering/TilemapRenderer';
import { AgentRenderer } from './rendering/AgentRenderer';
import { CameraController } from './rendering/CameraController';
import { GridRenderer } from './rendering/GridRenderer';
import { ParticleSystem } from './rendering/ParticleSystem';
import { SpeechBubbleRenderer } from './rendering/SpeechBubbleRenderer';
import { TaskProgressRenderer } from './rendering/TaskProgressRenderer';

// Services & UI
import { SoundManager } from './core/SoundManager';
import { ToastManager } from './core/ToastManager';
import { ChatSystem } from './core/ChatSystem';
import { DebateManager } from './debate/DebateManager';
import { RunnerManager } from './debate/RunnerManager';
import { GitHubService } from './services/GitHubService';
import { CollaborationSystem } from './agent/CollaborationSystem';

// Refactored Modules
import { INITIAL_AGENTS, REVIEW_AGENTS } from './agent/AgentData';
import { registerAllCommands } from './core/CLICommandRegistry';
import { setupAllEventHandlers } from './core/AppEventHandlers';
import { HUDManager } from './ui/HUDManager';

// Constants
const TILE_SIZE = 32;
const MAP_WIDTH = 60;
const MAP_HEIGHT = 40;

export class PixelOfficeApp {
  private app: PIXI.Application;
  private eventBus: EventBus;
  private cliEngine: CLIEngine;
  private orchestrator: Orchestrator;
  private agentManager: AgentManager;
  private tilemap: Tilemap;
  private pathfinder: Pathfinder;
  
  private tilemapRenderer: TilemapRenderer;
  private agentRenderer: AgentRenderer;
  private camera: CameraController;
  private particleSystem: ParticleSystem;
  private speechBubbleRenderer: SpeechBubbleRenderer;
  private taskProgressRenderer: TaskProgressRenderer;

  private soundManager: SoundManager;
  private toastManager: ToastManager;
  private hud: HUDManager;
  private chatSystem: ChatSystem;
  private collaborationSystem: CollaborationSystem;
  private debateManager: DebateManager;
  private runnerManager: RunnerManager;
  private gitHubService: GitHubService;

  private rootContainer: PIXI.Container;

  constructor() {
    this.initSystems();
    this.initRendering();
    this.initUI();
    this.setupIntegration();
    this.startLoop();
  }

  private initSystems(): void {
    this.eventBus = new EventBus();
    this.tilemap = new Tilemap(MAP_WIDTH, MAP_HEIGHT);
    this.pathfinder = new Pathfinder(this.tilemap);
    
    // ⚠️ FIXED: Corrected parameter order for AgentManager and Orchestrator
    this.agentManager = new AgentManager(this.tilemap, this.pathfinder, this.eventBus);
    this.orchestrator = new Orchestrator(this.agentManager, this.eventBus);
    
    this.cliEngine = new CLIEngine();
    this.soundManager = new SoundManager();
    this.toastManager = new ToastManager();
    this.chatSystem = new ChatSystem(this.eventBus);
    this.collaborationSystem = new CollaborationSystem(this.eventBus, this.agentManager, this.tilemap);
    this.debateManager = new DebateManager(this.eventBus);
    this.runnerManager = new RunnerManager(this.eventBus);
    this.gitHubService = new GitHubService();

    // Start Orchestrator's automatic assignment loop
    this.orchestrator.startDispatchLoop(2000);
  }

  private initRendering(): void {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    
    this.app = new PIXI.Application({
      view: canvas,
      width: window.innerWidth,
      height: window.innerHeight - 150,
      backgroundColor: 0x05070a, // Match --bg-dark
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      backgroundAlpha: 0, // Allow CSS background to show through if needed
    });

    this.rootContainer = new PIXI.Container();
    this.app.stage.addChild(this.rootContainer);

    this.camera = new CameraController(this.rootContainer, window.innerWidth, window.innerHeight - 150);
    this.tilemapRenderer = new TilemapRenderer(this.rootContainer);
    this.agentRenderer = new AgentRenderer(this.rootContainer);
    this.particleSystem = new ParticleSystem(this.rootContainer);
    this.speechBubbleRenderer = new SpeechBubbleRenderer(this.rootContainer);
    this.taskProgressRenderer = new TaskProgressRenderer(this.rootContainer);

    this.tilemapRenderer.renderMap(this.tilemap);
  }

  private initUI(): void {
    this.hud = new HUDManager();
    
    // Setup resize & zoom
    window.addEventListener('resize', () => {
      this.app.renderer.resize(window.innerWidth, window.innerHeight - 150);
      this.camera.updateScreenSize(window.innerWidth, window.innerHeight - 150);
    });

    // Integrated zoom/pan via camera controller is internal to that class
  }

  private setupIntegration(): void {
    // 1. Initial Agents
    INITIAL_AGENTS.forEach(config => this.agentManager.createAgent(config));
    REVIEW_AGENTS.forEach(config => this.agentManager.createAgent(config));

    // 2. Event Handlers
    setupAllEventHandlers(
      this.eventBus, 
      this.agentManager, 
      this.hud, 
      this.soundManager, 
      this.toastManager, 
      this.chatSystem,
      this.particleSystem,
      this.taskProgressRenderer
    );

    // 3. CLI Commands
    registerAllCommands({
      agentManager: this.agentManager,
      orchestrator: this.orchestrator,
      tilemap: this.tilemap,
      tilemapRenderer: this.tilemapRenderer,
      camera: this.camera,
      soundManager: this.soundManager,
      toastManager: this.toastManager,
      collaborationSystem: this.collaborationSystem,
      chatSystem: this.chatSystem,
      debateManager: this.debateManager,
      runnerManager: this.runnerManager,
      gitHubService: this.gitHubService,
      cliEngine: this.cliEngine,
      particleSystem: this.particleSystem,
      meetingRoomRenderer: null, // To be implemented or passed
      logSystem: (msg, type) => this.hud.logSystem(msg, type),
      logUser: (msg) => this.hud.logUser(msg),
      logError: (msg) => this.hud.logError(msg),
      runDebateWithVisualization: async (id) => {}, // Logic moved to DebateManager ideally
      startCodeReview: async (code, project) => {},
      updateTestDashboard: () => {}
    });

    this.setupDOMListeners();
  }

  private setupDOMListeners(): void {
    const input = document.getElementById('cli-input') as HTMLInputElement;
    const submitBtn = document.getElementById('btn-submit');

    const handleCLI = async () => {
      const command = input.value.trim();
      if (!command) return;

      input.value = '';
      if (command.startsWith('/')) {
        const result = await this.cliEngine.execute(command);
        if (result.output) {
          result.output.split('\n').forEach(line => this.hud.logSystem(line, result.type));
        }
      } else {
        this.hud.logUser(command);
        await this.orchestrator.processCommand(command);
      }
    };

    submitBtn?.addEventListener('click', handleCLI);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCLI();
    });
  }

  private startLoop(): void {
    let lastTime = performance.now();
    
    this.app.ticker.add(() => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Update Systems
      this.agentManager.update(deltaTime);
      // NOTE: Orchestrator might not have a frame-by-frame update method, 
      // but it handles its own dispatch loop or state. 
      // Removed non-existent this.orchestrator.update(deltaTime);
      
      if (this.collaborationSystem) this.collaborationSystem.update();
      this.camera.update(deltaTime);
      this.particleSystem.update(deltaTime);
      this.speechBubbleRenderer.update();
      // taskProgressRenderer does not have an update method for ticker loop

      // Rendering
      const snaps = this.agentManager.getAllAgents().map(a => a.getSnapshot());
      this.agentRenderer.update(snaps, deltaTime);

      // UI Update (Throttled)
      if (Math.random() < 0.1) {
        const report = this.orchestrator.getTaskReport();
        this.hud.updateStats({
          agents: snaps.length,
          idle: snaps.filter(s => s.state === AgentState.Idle).length,
          working: snaps.filter(s => s.state === AgentState.Working).length,
          tasks: report.pending + report.inProgress,
          fps: Math.round(this.app.ticker.FPS)
        });
        this.hud.updateAgentPanel(snaps);

        // Update Full Monitor
        const runStats = this.runnerManager.getStats();
        this.hud.updateMonitorPanel({
          agents: snaps.length,
          runners: runStats.activeRunners,
          tasks: report.pending,
          debates: this.debateManager.getAllSessions().filter(s => s.status === 'active').length,
          tokens: this.debateManager.getTokenUsage(),
          loops: runStats.runningLoops,
          successRate: runStats.totalTests > 0 ? Math.round((runStats.completedLoops / (runStats.runningLoops + runStats.completedLoops || 1)) * 100) + '%' : '100%',
          avgTime: '3.2s' // Mocked for now, can be calculated from RunnerManager
        });

        // Update Test Dashboard
        const schedules = ['부하 테스트 (14:30)', '회귀 테스트 (15:00)']; // Mocked schedules
        this.hud.updateTestDashboard({
          total: runStats.totalTests,
          successRate: runStats.totalTests > 0 ? '98%' : 'N/A', // Simplified
          avgTime: '120ms',
          schedules: schedules
        });
      }
    });
  }
}

// Entry Point
// Initialize the application directly
const app = new PixelOfficeApp();

// Optional: expose for debugging
(window as any).__PIXEL_OFFICE__ = app;
