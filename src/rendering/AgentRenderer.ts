import * as PIXI from 'pixi.js';
import { AgentSnapshot, AgentState } from '../types';
import { TILE_SIZE } from '../spatial/Tilemap';

/** Renders individual agent sprites with state-based visuals */
interface AgentVisual {
  container: PIXI.Container;
  body: PIXI.Graphics;
  nameLabel: PIXI.Text;
  roleLabel: PIXI.Text;
  statusIndicator: PIXI.Graphics;
  speechBubble: PIXI.Container;
  speechText: PIXI.Text;
  progressBar: PIXI.Graphics;
  progressBg: PIXI.Graphics;
  pathLine: PIXI.Graphics;
}

const STATE_COLORS: Record<AgentState, number> = {
  [AgentState.Idle]: 0x888888,
  [AgentState.Moving]: 0x00FF88,
  [AgentState.Working]: 0xFFAA00,
  [AgentState.Returning]: 0x88CCFF,
  [AgentState.Waiting]: 0xFF6666,
  [AgentState.Collaborating]: 0xCC88FF,
};

const ROLE_ICONS: Record<string, string> = {
  frontend: 'FE',
  backend: 'BE',
  designer: 'DS',
  pm: 'PM',
  qa: 'QA',
  devops: 'DO',
};

export class AgentRenderer {
  private parentContainer: PIXI.Container;
  private agentVisuals: Map<string, AgentVisual> = new Map();

  constructor(parentContainer: PIXI.Container) {
    this.parentContainer = parentContainer;
  }

  /** Sync all agent visuals with current snapshots */
  update(snapshots: AgentSnapshot[], deltaTime: number): void {
    const activeIds = new Set<string>();

    for (const snap of snapshots) {
      activeIds.add(snap.id);

      let visual = this.agentVisuals.get(snap.id);
      if (!visual) {
        visual = this.createAgentVisual(snap);
        this.agentVisuals.set(snap.id, visual);
        this.parentContainer.addChild(visual.container);
      }

      this.updateVisual(visual, snap, deltaTime);
    }

    // Remove visuals for agents that no longer exist
    for (const [id, visual] of this.agentVisuals) {
      if (!activeIds.has(id)) {
        this.parentContainer.removeChild(visual.container);
        this.agentVisuals.delete(id);
      }
    }
  }

  private createAgentVisual(snap: AgentSnapshot): AgentVisual {
    const container = new PIXI.Container();
    container.sortableChildren = true;

    // Body (pixel character)
    const body = new PIXI.Graphics();
    this.drawPixelCharacter(body, snap.role, 0xFFFFFF);
    body.zIndex = 1;
    container.addChild(body);

    // Name label
    const nameLabel = new PIXI.Text(snap.name, {
      fontFamily: 'monospace',
      fontSize: 9,
      fill: 0xFFFFFF,
      align: 'center',
    });
    nameLabel.anchor.set(0.5, 0);
    nameLabel.position.set(0, TILE_SIZE * 0.55);
    nameLabel.zIndex = 3;
    container.addChild(nameLabel);

    // Role badge
    const roleLabel = new PIXI.Text(ROLE_ICONS[snap.role] || '??', {
      fontFamily: 'monospace',
      fontSize: 7,
      fill: 0x000000,
      fontWeight: 'bold',
    });
    roleLabel.anchor.set(0.5, 0.5);
    roleLabel.position.set(0, -TILE_SIZE * 0.3);
    roleLabel.zIndex = 4;
    container.addChild(roleLabel);

    // Status indicator dot
    const statusIndicator = new PIXI.Graphics();
    statusIndicator.position.set(TILE_SIZE * 0.3, -TILE_SIZE * 0.3);
    statusIndicator.zIndex = 4;
    container.addChild(statusIndicator);

    // Speech bubble (hidden by default)
    const speechBubble = new PIXI.Container();
    speechBubble.visible = false;
    speechBubble.zIndex = 10;

    const bubbleBg = new PIXI.Graphics();
    bubbleBg.beginFill(0xFFFFFF, 0.9);
    bubbleBg.drawRoundedRect(-50, -40, 100, 24, 6);
    bubbleBg.endFill();
    // Bubble tail
    bubbleBg.beginFill(0xFFFFFF, 0.9);
    bubbleBg.moveTo(-4, -16);
    bubbleBg.lineTo(4, -16);
    bubbleBg.lineTo(0, -10);
    bubbleBg.closePath();
    bubbleBg.endFill();
    speechBubble.addChild(bubbleBg);

    const speechText = new PIXI.Text('', {
      fontFamily: 'monospace',
      fontSize: 8,
      fill: 0x333333,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 90,
    });
    speechText.anchor.set(0.5, 0.5);
    speechText.position.set(0, -28);
    speechBubble.addChild(speechText);
    container.addChild(speechBubble);

    // Progress bar background
    const progressBg = new PIXI.Graphics();
    progressBg.visible = false;
    progressBg.zIndex = 5;
    container.addChild(progressBg);

    // Progress bar fill
    const progressBar = new PIXI.Graphics();
    progressBar.visible = false;
    progressBar.zIndex = 6;
    container.addChild(progressBar);

    // Path visualization
    const pathLine = new PIXI.Graphics();
    pathLine.zIndex = 0;
    container.addChild(pathLine);

    return {
      container,
      body,
      nameLabel,
      roleLabel,
      statusIndicator,
      speechBubble,
      speechText,
      progressBar,
      progressBg,
      pathLine,
    };
  }

  private updateVisual(visual: AgentVisual, snap: AgentSnapshot, _deltaTime: number): void {
    // Position
    visual.container.position.set(snap.position.x, snap.position.y);

    // Redraw body with current color
    visual.body.clear();
    this.drawPixelCharacter(visual.body, snap.role, snap.state === AgentState.Idle ? 0x888888 : 0xFFFFFF);

    // Status indicator
    visual.statusIndicator.clear();
    const stateColor = STATE_COLORS[snap.state];
    visual.statusIndicator.beginFill(stateColor);
    visual.statusIndicator.drawCircle(0, 0, 3);
    visual.statusIndicator.endFill();

    // Pulse animation for working state
    if (snap.state === AgentState.Working) {
      const pulse = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
      visual.body.alpha = pulse;
    } else {
      visual.body.alpha = 1;
    }

    // Speech bubble — show task description when working
    if (snap.state === AgentState.Working && snap.currentTask) {
      visual.speechBubble.visible = true;
      const taskText = snap.currentTask.description.substring(0, 20) + '...';
      visual.speechText.text = taskText;
    } else {
      visual.speechBubble.visible = false;
    }

    // Progress bar
    if (snap.state === AgentState.Working && snap.progress > 0) {
      const barWidth = 28;
      const barHeight = 4;
      const barY = -TILE_SIZE * 0.5;

      visual.progressBg.visible = true;
      visual.progressBg.clear();
      visual.progressBg.beginFill(0x333333);
      visual.progressBg.drawRect(-barWidth / 2, barY, barWidth, barHeight);
      visual.progressBg.endFill();

      visual.progressBar.visible = true;
      visual.progressBar.clear();
      visual.progressBar.beginFill(0x00FF88);
      visual.progressBar.drawRect(-barWidth / 2, barY, barWidth * snap.progress, barHeight);
      visual.progressBar.endFill();
    } else {
      visual.progressBg.visible = false;
      visual.progressBar.visible = false;
    }

    // Path visualization (subtle dotted line)
    visual.pathLine.clear();
    if (snap.path.length > 0 && (snap.state === AgentState.Moving || snap.state === AgentState.Returning)) {
      visual.pathLine.lineStyle(1, stateColor, 0.3);
      visual.pathLine.moveTo(0, 0);
      for (const cell of snap.path) {
        const wx = cell.col * TILE_SIZE + TILE_SIZE / 2 - snap.position.x;
        const wy = cell.row * TILE_SIZE + TILE_SIZE / 2 - snap.position.y;
        visual.pathLine.lineTo(wx, wy);
      }
    }
  }

  /** Draw a simple pixel character (8x10 px style) */
  private drawPixelCharacter(gfx: PIXI.Graphics, role: string, tint: number): void {
    const s = 2; // pixel scale
    const ox = -s * 4; // center offset
    const oy = -s * 5;

    // Head
    gfx.beginFill(0xFFDBB5);
    gfx.drawRect(ox + s * 2, oy, s * 4, s * 4);
    gfx.endFill();

    // Eyes
    gfx.beginFill(0x333333);
    gfx.drawRect(ox + s * 3, oy + s * 1, s, s);
    gfx.drawRect(ox + s * 5, oy + s * 1, s, s);
    gfx.endFill();

    // Body (role-colored)
    const roleColors: Record<string, number> = {
      frontend: 0x4FC3F7,
      backend: 0x81C784,
      designer: 0xFFB74D,
      pm: 0xE57373,
      qa: 0xBA68C8,
      devops: 0x90A4AE,
    };
    const bodyColor = roleColors[role] ?? 0xAAAAAA;
    gfx.beginFill(bodyColor);
    gfx.drawRect(ox + s * 1, oy + s * 4, s * 6, s * 4);
    gfx.endFill();

    // Legs
    gfx.beginFill(0x444466);
    gfx.drawRect(ox + s * 2, oy + s * 8, s * 2, s * 2);
    gfx.drawRect(ox + s * 5, oy + s * 8, s * 2, s * 2);
    gfx.endFill();
  }
}
