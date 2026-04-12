import * as PIXI from 'pixi.js';
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
    this.agentManager = new AgentManager(this.eventBus, this.pathfinder, this.tilemap);
    this.orchestrator = new Orchestrator(this.eventBus, this.agentManager, this.tilemap);
    this.cliEngine = new CLIEngine();
    
    this.soundManager = new SoundManager();
    this.toastManager = new ToastManager();
    this.chatSystem = new ChatSystem(this.eventBus);
    this.collaborationSystem = new CollaborationSystem(this.eventBus, this.agentManager, this.tilemap);
    this.debateManager = new DebateManager(this.eventBus);
    this.runnerManager = new RunnerManager(this.eventBus);
    this.gitHubService = new GitHubService();
  }

  private initRendering(): void {
    this.app = new PIXI.Application({
      view: document.getElementById('game-canvas') as HTMLCanvasElement,
      width: window.innerWidth,
      height: window.innerHeight - 150,
      backgroundColor: 0x0d1117,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
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
      this.orchestrator.update(deltaTime);
      this.collaborationSystem.update(deltaTime);
      this.camera.update(deltaTime);
      this.particleSystem.update(deltaTime);
      this.speechBubbleRenderer.update(deltaTime);
      this.taskProgressRenderer.update(deltaTime);

      // Rendering
      const snaps = this.agentManager.getAllAgents().map(a => a.getSnapshot());
      this.agentRenderer.renderAgents(snaps);

      // UI Update (Throttled)
      if (Math.random() < 0.1) {
        this.hud.updateStats({
          agents: snaps.length,
          idle: snaps.filter(s => s.state === AgentState.Idle).length,
          working: snaps.filter(s => s.state === AgentState.Working).length,
          tasks: this.orchestrator.getTaskReport().pending,
          fps: Math.round(this.app.ticker.FPS)
        });
        this.hud.updateAgentPanel(snaps);
      }
    });
  }
}

// Entry Point
document.addEventListener('DOMContentLoaded', () => {
  new PixelOfficeApp();
});
