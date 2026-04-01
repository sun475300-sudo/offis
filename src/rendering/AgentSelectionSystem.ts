import * as PIXI from 'pixi.js';
import { AgentSnapshot, AgentState, IEventBus, EventType, Vec2 } from '../types';
import { TILE_SIZE } from '../spatial/Tilemap';

/**
 * Agent Selection System — click to select agents, show detail popup, camera follow.
 * Phase 2: Interactive agent selection, detail popup, camera tracking integration.
 */
export class AgentSelectionSystem {
  private selectedAgentId: string | null = null;
  private hoveredAgentId: string | null = null;
  private selectionRing: PIXI.Graphics;
  private detailPopup: PIXI.Container;
  private popupBg: PIXI.Graphics;
  private popupTitle: PIXI.Text;
  private popupRole: PIXI.Text;
  private popupState: PIXI.Text;
  private popupTask: PIXI.Text;
  private popupProgress: PIXI.Graphics;
  private hoverHighlight: PIXI.Graphics;

  private onSelectCallback: ((agentId: string | null) => void) | null = null;

  constructor(
    private gameContainer: PIXI.Container,
    private eventBus: IEventBus,
  ) {
    // Selection ring (animated)
    this.selectionRing = new PIXI.Graphics();
    this.selectionRing.visible = false;
    this.selectionRing.zIndex = 100;
    this.gameContainer.addChild(this.selectionRing);

    // Hover highlight
    this.hoverHighlight = new PIXI.Graphics();
    this.hoverHighlight.visible = false;
    this.hoverHighlight.zIndex = 99;
    this.gameContainer.addChild(this.hoverHighlight);

    // Detail popup container
    this.detailPopup = new PIXI.Container();
    this.detailPopup.visible = false;
    this.detailPopup.zIndex = 200;
    this.detailPopup.sortableChildren = true;

    this.popupBg = new PIXI.Graphics();
    this.popupBg.zIndex = 0;
    this.detailPopup.addChild(this.popupBg);

    this.popupTitle = new PIXI.Text('', {
      fontFamily: 'monospace', fontSize: 12, fill: 0xe6edf3, fontWeight: 'bold',
    });
    this.popupTitle.position.set(12, 10);
    this.popupTitle.zIndex = 1;
    this.detailPopup.addChild(this.popupTitle);

    this.popupRole = new PIXI.Text('', {
      fontFamily: 'monospace', fontSize: 10, fill: 0x8b949e,
    });
    this.popupRole.position.set(12, 28);
    this.popupRole.zIndex = 1;
    this.detailPopup.addChild(this.popupRole);

    this.popupState = new PIXI.Text('', {
      fontFamily: 'monospace', fontSize: 10, fill: 0x3fb950,
    });
    this.popupState.position.set(12, 44);
    this.popupState.zIndex = 1;
    this.detailPopup.addChild(this.popupState);

    this.popupTask = new PIXI.Text('', {
      fontFamily: 'monospace', fontSize: 9, fill: 0xd29922, wordWrap: true, wordWrapWidth: 170,
    });
    this.popupTask.position.set(12, 62);
    this.popupTask.zIndex = 1;
    this.detailPopup.addChild(this.popupTask);

    this.popupProgress = new PIXI.Graphics();
    this.popupProgress.position.set(12, 90);
    this.popupProgress.zIndex = 1;
    this.detailPopup.addChild(this.popupProgress);

    this.gameContainer.addChild(this.detailPopup);
  }

  /** Register a click handler on the PIXI stage */
  setupInteraction(app: PIXI.Application): void {
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      if (event.button !== 0) return; // left click only
      const worldPos = this.screenToWorld(event.global, app);
      this.handleClick(worldPos);
    });

    app.stage.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      const worldPos = this.screenToWorld(event.global, app);
      this.handleHover(worldPos);
    });
  }

  onSelect(callback: (agentId: string | null) => void): void {
    this.onSelectCallback = callback;
  }

  getSelectedAgentId(): string | null {
    return this.selectedAgentId;
  }

  deselect(): void {
    this.selectedAgentId = null;
    this.selectionRing.visible = false;
    this.detailPopup.visible = false;
    this.onSelectCallback?.(null);
  }

  /** Update each frame — sync selection ring & popup with agent position */
  update(agents: AgentSnapshot[], deltaTime: number): void {
    // Update hover highlight
    if (this.hoveredAgentId) {
      const hovered = agents.find(a => a.id === this.hoveredAgentId);
      if (hovered) {
        this.hoverHighlight.visible = true;
        this.hoverHighlight.clear();
        this.hoverHighlight.lineStyle(1, 0x58a6ff, 0.4);
        this.hoverHighlight.drawCircle(hovered.position.x, hovered.position.y, 18);
      } else {
        this.hoverHighlight.visible = false;
      }
    }

    // Update selection ring
    if (!this.selectedAgentId) return;

    const selected = agents.find(a => a.id === this.selectedAgentId);
    if (!selected) {
      this.deselect();
      return;
    }

    // Animated selection ring
    const time = Date.now() * 0.003;
    const pulseRadius = 16 + Math.sin(time) * 3;

    this.selectionRing.visible = true;
    this.selectionRing.clear();

    // Outer glow
    this.selectionRing.lineStyle(2, 0x58a6ff, 0.3 + Math.sin(time) * 0.2);
    this.selectionRing.drawCircle(selected.position.x, selected.position.y, pulseRadius + 4);

    // Inner ring
    this.selectionRing.lineStyle(2, 0x58a6ff, 0.9);
    this.selectionRing.drawCircle(selected.position.x, selected.position.y, pulseRadius);

    // Detail popup
    this.updateDetailPopup(selected);
  }

  /** Clean up all PIXI resources and event listeners */
  destroy(app?: PIXI.Application): void {
    if (app) {
      app.stage.removeAllListeners();
    }
    this.selectionRing.destroy();
    this.hoverHighlight.destroy();
    this.detailPopup.destroy({ children: true });
    this.onSelectCallback = null;
  }

  /** Cache for finding agent by click position */
  private agentCache: AgentSnapshot[] = [];

  setAgentCache(agents: AgentSnapshot[]): void {
    this.agentCache = agents;
  }

  private handleClick(worldPos: Vec2): void {
    const clickRadius = 20;
    let closest: AgentSnapshot | null = null;
    let closestDist = clickRadius;

    for (const agent of this.agentCache) {
      const dx = agent.position.x - worldPos.x;
      const dy = agent.position.y - worldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = agent;
      }
    }

    if (closest) {
      this.selectedAgentId = closest.id;
      this.onSelectCallback?.(closest.id);
      this.eventBus.emit(EventType.CameraFollow, { agentId: closest.id });
    } else {
      this.deselect();
    }
  }

  private handleHover(worldPos: Vec2): void {
    const hoverRadius = 20;
    let closest: AgentSnapshot | null = null;
    let closestDist = hoverRadius;

    for (const agent of this.agentCache) {
      const dx = agent.position.x - worldPos.x;
      const dy = agent.position.y - worldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = agent;
      }
    }

    this.hoveredAgentId = closest?.id ?? null;
  }

  private screenToWorld(screenPos: PIXI.Point, app: PIXI.Application): Vec2 {
    // Transform screen coordinates to world coordinates through the container transform
    const rootContainer = app.stage.children[0] as PIXI.Container;
    if (!rootContainer) return { x: screenPos.x, y: screenPos.y };

    const transform = rootContainer.worldTransform;
    const invMatrix = transform.clone().invert();

    return {
      x: invMatrix.a * screenPos.x + invMatrix.c * screenPos.y + invMatrix.tx,
      y: invMatrix.b * screenPos.x + invMatrix.d * screenPos.y + invMatrix.ty,
    };
  }

  private updateDetailPopup(agent: AgentSnapshot): void {
    this.detailPopup.visible = true;
    this.detailPopup.position.set(agent.position.x + 25, agent.position.y - 60);

    const STATE_LABELS: Record<AgentState, string> = {
      [AgentState.Idle]: 'Idle',
      [AgentState.Moving]: 'Moving...',
      [AgentState.Working]: 'Working',
      [AgentState.Returning]: 'Returning',
      [AgentState.Waiting]: 'Waiting',
      [AgentState.Collaborating]: 'Collaborating',
    };

    const STATE_COLORS: Record<AgentState, number> = {
      [AgentState.Idle]: 0x8b949e,
      [AgentState.Moving]: 0x3fb950,
      [AgentState.Working]: 0xd29922,
      [AgentState.Returning]: 0x58a6ff,
      [AgentState.Waiting]: 0xf85149,
      [AgentState.Collaborating]: 0xa371f7,
    };

    this.popupTitle.text = `${agent.name} [${agent.id}]`;
    this.popupRole.text = `Role: ${agent.role.toUpperCase()}`;
    this.popupState.text = `State: ${STATE_LABELS[agent.state]}`;
    this.popupState.style.fill = STATE_COLORS[agent.state];

    const taskText = agent.currentTask
      ? `Task: ${agent.currentTask.description.substring(0, 40)}`
      : 'No active task';
    this.popupTask.text = taskText;

    // Progress bar
    this.popupProgress.clear();
    if (agent.state === AgentState.Working && agent.progress > 0) {
      const barWidth = 170;
      const barHeight = 6;
      this.popupProgress.beginFill(0x21262d);
      this.popupProgress.drawRoundedRect(0, 0, barWidth, barHeight, 3);
      this.popupProgress.endFill();
      this.popupProgress.beginFill(0x3fb950);
      this.popupProgress.drawRoundedRect(0, 0, barWidth * agent.progress, barHeight, 3);
      this.popupProgress.endFill();
    }

    // Background
    const popupHeight = agent.currentTask ? 110 : 85;
    this.popupBg.clear();
    this.popupBg.beginFill(0x161b22, 0.95);
    this.popupBg.lineStyle(1, 0x30363d);
    this.popupBg.drawRoundedRect(0, 0, 200, popupHeight, 8);
    this.popupBg.endFill();

    // Arrow pointing to agent
    this.popupBg.beginFill(0x161b22, 0.95);
    this.popupBg.moveTo(-8, 30);
    this.popupBg.lineTo(0, 24);
    this.popupBg.lineTo(0, 36);
    this.popupBg.closePath();
    this.popupBg.endFill();
  }
}
