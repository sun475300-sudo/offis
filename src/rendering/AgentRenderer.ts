import * as PIXI from 'pixi.js';
import { AgentSnapshot, AgentState } from '../types';
import { TILE_SIZE } from '../spatial/Tilemap';

/** Animation state tracked per agent */
interface AnimState {
  prevX: number;
  prevY: number;
  facingRight: boolean;
  walkFrame: number;      // 0..3 walk cycle
  walkTimer: number;      // accumulator for walk cycle
  typingFrame: number;    // 0..1 typing hands
  typingTimer: number;
  idleTimer: number;      // accumulator for idle bob
  collabTimer: number;    // accumulator for collab wave
}

/** Renders individual agent sprites with state-based visuals */
interface AgentVisual {
  container: PIXI.Container;
  shadow: PIXI.Graphics;
  body: PIXI.Graphics;
  nameLabel: PIXI.Text;
  roleLabel: PIXI.Text;
  roleBadgeBg: PIXI.Graphics;
  statusIndicator: PIXI.Graphics;
  speechBubble: PIXI.Container;
  speechText: PIXI.Text;
  progressBar: PIXI.Graphics;
  progressBg: PIXI.Graphics;
  pathLine: PIXI.Graphics;
  anim: AnimState;
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
  architect: 'AR',
  security: 'SE',
  performance: 'PF',
};

const ROLE_COLORS: Record<string, number> = {
  frontend: 0x4FC3F7,
  backend: 0x81C784,
  designer: 0xFFB74D,
  pm: 0xE57373,
  qa: 0xBA68C8,
  devops: 0x90A4AE,
  architect: 0x7E57C2,
  security: 0xEF5350,
  performance: 0x26A69A,
};

// Skin tone palette for variety
const SKIN_TONES = [0xFFDBB5, 0xF5C5A3, 0xD4A373, 0xC68642, 0x8D5524];

// Hair styles (color options)
const HAIR_COLORS = [0x2C1B0E, 0x4A3222, 0x8B6914, 0xD4A017, 0xC04000, 0x1A1A2E];

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

    // Shadow ellipse under agent
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.2);
    shadow.drawEllipse(0, TILE_SIZE * 0.4, 8, 3);
    shadow.endFill();
    shadow.zIndex = 0;
    container.addChild(shadow);

    // Body (pixel character)
    const body = new PIXI.Graphics();
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

    // Role badge background
    const roleBadgeBg = new PIXI.Graphics();
    const badgeColor = ROLE_COLORS[snap.role] ?? 0xAAAAAA;
    roleBadgeBg.beginFill(badgeColor, 0.85);
    roleBadgeBg.drawRoundedRect(-9, -TILE_SIZE * 0.3 - 5, 18, 10, 3);
    roleBadgeBg.endFill();
    roleBadgeBg.zIndex = 3;
    container.addChild(roleBadgeBg);

    // Role badge text
    const roleLabel = new PIXI.Text(ROLE_ICONS[snap.role] || '??', {
      fontFamily: 'monospace',
      fontSize: 7,
      fill: 0xFFFFFF,
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

    // Animation state
    const anim: AnimState = {
      prevX: snap.position.x,
      prevY: snap.position.y,
      facingRight: true,
      walkFrame: 0,
      walkTimer: 0,
      typingFrame: 0,
      typingTimer: 0,
      idleTimer: Math.random() * Math.PI * 2, // offset so agents don't breathe in sync
      collabTimer: 0,
    };

    return {
      container,
      shadow,
      body,
      nameLabel,
      roleLabel,
      roleBadgeBg,
      statusIndicator,
      speechBubble,
      speechText,
      progressBar,
      progressBg,
      pathLine,
      anim,
    };
  }

  private updateVisual(visual: AgentVisual, snap: AgentSnapshot, deltaTime: number): void {
    const anim = visual.anim;

    // --- Direction tracking from position delta ---
    const dx = snap.position.x - anim.prevX;
    if (Math.abs(dx) > 0.5) {
      anim.facingRight = dx > 0;
    }
    anim.prevX = snap.position.x;
    anim.prevY = snap.position.y;

    // --- Animation timers ---
    const isMoving = snap.state === AgentState.Moving || snap.state === AgentState.Returning;
    if (isMoving) {
      anim.walkTimer += deltaTime;
      if (anim.walkTimer > 0.15) { // 150ms per frame
        anim.walkFrame = (anim.walkFrame + 1) % 4;
        anim.walkTimer = 0;
      }
    } else {
      anim.walkFrame = 0;
      anim.walkTimer = 0;
    }

    if (snap.state === AgentState.Working) {
      anim.typingTimer += deltaTime;
      if (anim.typingTimer > 0.2) { // 200ms per frame
        anim.typingFrame = (anim.typingFrame + 1) % 2;
        anim.typingTimer = 0;
      }
    } else {
      anim.typingFrame = 0;
      anim.typingTimer = 0;
    }

    anim.idleTimer += deltaTime;
    anim.collabTimer += deltaTime;

    // Position
    visual.container.position.set(snap.position.x, snap.position.y);

    // Idle breathing bob
    let bodyOffsetY = 0;
    if (snap.state === AgentState.Idle) {
      bodyOffsetY = Math.sin(anim.idleTimer * 2) * 1.0;
    } else if (snap.state === AgentState.Waiting) {
      bodyOffsetY = Math.sin(anim.idleTimer * 1.5) * 1.5;
    }

    // Redraw body with animations
    visual.body.clear();
    this.drawAnimatedCharacter(
      visual.body,
      snap.role,
      snap.state,
      anim,
      bodyOffsetY,
    );

    // Shadow squash when moving
    visual.shadow.clear();
    const shadowScaleX = isMoving ? 1.1 : 1.0;
    visual.shadow.beginFill(0x000000, 0.15);
    visual.shadow.drawEllipse(0, TILE_SIZE * 0.4, 8 * shadowScaleX, 3);
    visual.shadow.endFill();

    // Status indicator with glow
    visual.statusIndicator.clear();
    const stateColor = STATE_COLORS[snap.state];
    // Glow ring
    visual.statusIndicator.beginFill(stateColor, 0.3);
    visual.statusIndicator.drawCircle(0, 0, 5);
    visual.statusIndicator.endFill();
    // Core dot
    visual.statusIndicator.beginFill(stateColor);
    visual.statusIndicator.drawCircle(0, 0, 3);
    visual.statusIndicator.endFill();

    // Pulse for working/collaborating
    if (snap.state === AgentState.Working || snap.state === AgentState.Collaborating) {
      const pulse = 0.85 + Math.sin(Date.now() * 0.004) * 0.15;
      visual.statusIndicator.alpha = pulse;
    } else {
      visual.statusIndicator.alpha = 1;
    }
    visual.body.alpha = 1;

    // Speech bubble — show task description when working
    if (snap.state === AgentState.Working && snap.currentTask) {
      visual.speechBubble.visible = true;
      const taskText = snap.currentTask.description.substring(0, 20) + '...';
      visual.speechText.text = taskText;
    } else if (snap.state === AgentState.Collaborating) {
      visual.speechBubble.visible = true;
      visual.speechText.text = '🤝 Collaborating...';
    } else {
      visual.speechBubble.visible = false;
    }

    // Progress bar with color gradient
    if (snap.state === AgentState.Working && snap.progress > 0) {
      const barWidth = 28;
      const barHeight = 4;
      const barY = -TILE_SIZE * 0.55 + bodyOffsetY;

      visual.progressBg.visible = true;
      visual.progressBg.clear();
      visual.progressBg.beginFill(0x1A1A2E);
      visual.progressBg.lineStyle(1, 0x333333);
      visual.progressBg.drawRoundedRect(-barWidth / 2, barY, barWidth, barHeight, 2);
      visual.progressBg.endFill();

      visual.progressBar.visible = true;
      visual.progressBar.clear();
      // Color shifts from yellow to green as progress increases
      const progressColor = snap.progress < 0.5 ? 0xFFAA00 : 0x00FF88;
      visual.progressBar.beginFill(progressColor);
      visual.progressBar.drawRoundedRect(
        -barWidth / 2 + 1,
        barY + 1,
        Math.max(0, (barWidth - 2) * snap.progress),
        barHeight - 2,
        1,
      );
      visual.progressBar.endFill();
    } else {
      visual.progressBg.visible = false;
      visual.progressBar.visible = false;
    }

    // Path visualization (subtle dashed line with dots)
    visual.pathLine.clear();
    if (snap.path.length > 0 && isMoving) {
      visual.pathLine.lineStyle(1, stateColor, 0.25);
      visual.pathLine.moveTo(0, 0);
      for (let i = 0; i < snap.path.length; i++) {
        const cell = snap.path[i];
        const wx = cell.col * TILE_SIZE + TILE_SIZE / 2 - snap.position.x;
        const wy = cell.row * TILE_SIZE + TILE_SIZE / 2 - snap.position.y;
        visual.pathLine.lineTo(wx, wy);
        // Draw small dot at each waypoint
        if (i % 3 === 0) {
          visual.pathLine.beginFill(stateColor, 0.3);
          visual.pathLine.drawCircle(wx, wy, 1.5);
          visual.pathLine.endFill();
        }
      }
    }
  }

  /** Draw animated pixel character with walk/work/idle/collab states */
  private drawAnimatedCharacter(
    gfx: PIXI.Graphics,
    role: string,
    state: AgentState,
    anim: AnimState,
    bodyOffsetY: number,
  ): void {
    const s = 2; // pixel scale
    const flip = anim.facingRight ? 1 : -1;
    const ox = -s * 4;
    const oy = -s * 5 + bodyOffsetY;

    // Deterministic appearance from role string
    const roleHash = this.hashString(role);
    const skinColor = SKIN_TONES[roleHash % SKIN_TONES.length];
    const hairColor = HAIR_COLORS[(roleHash + 2) % HAIR_COLORS.length];
    const bodyColor = ROLE_COLORS[role] ?? 0xAAAAAA;

    // --- Hair ---
    gfx.beginFill(hairColor);
    gfx.drawRect(ox + s * 2, oy - s * 1, s * 4, s * 2);
    gfx.endFill();

    // --- Head ---
    gfx.beginFill(skinColor);
    gfx.drawRect(ox + s * 2, oy, s * 4, s * 4);
    gfx.endFill();

    // --- Eyes (direction-aware) ---
    gfx.beginFill(0x222222);
    if (anim.facingRight) {
      gfx.drawRect(ox + s * 4, oy + s * 1, s, s);
      gfx.drawRect(ox + s * 6, oy + s * 1, s, s);
    } else {
      gfx.drawRect(ox + s * 1, oy + s * 1, s, s);
      gfx.drawRect(ox + s * 3, oy + s * 1, s, s);
    }
    gfx.endFill();

    // --- Mouth (expression-based) ---
    if (state === AgentState.Working) {
      // Concentrated: flat line
      gfx.beginFill(0x333333);
      gfx.drawRect(ox + s * 3, oy + s * 3, s * 2, 1);
      gfx.endFill();
    } else if (state === AgentState.Collaborating) {
      // Smile
      gfx.beginFill(0x333333);
      gfx.drawRect(ox + s * 3, oy + s * 3, s * 2, 1);
      gfx.drawRect(ox + s * 2.5, oy + s * 2.8, s * 0.5, 1);
      gfx.drawRect(ox + s * 5, oy + s * 2.8, s * 0.5, 1);
      gfx.endFill();
    } else if (state === AgentState.Waiting) {
      // Blink animation
      const blink = Math.sin(anim.idleTimer * 3) > 0.95;
      if (blink) {
        // Eyes closed (overwrite eyes)
        gfx.beginFill(skinColor);
        gfx.drawRect(ox + s * 1, oy + s * 1, s * 6, s);
        gfx.endFill();
        gfx.beginFill(0x555555);
        gfx.drawRect(ox + s * 3, oy + s * 1.5, s * 2, 1);
        gfx.endFill();
      }
    }

    // --- Body / Torso ---
    gfx.beginFill(bodyColor);
    gfx.drawRect(ox + s * 1, oy + s * 4, s * 6, s * 4);
    gfx.endFill();

    // --- Arms (state-dependent animation) ---
    if (state === AgentState.Working) {
      // Typing animation: arms alternate up/down
      const armOffset = anim.typingFrame === 0 ? 0 : s;
      gfx.beginFill(skinColor);
      // Left arm reaching forward
      gfx.drawRect(ox - s * 0.5, oy + s * 4.5 + armOffset, s * 1.5, s * 2);
      // Right arm reaching forward
      gfx.drawRect(ox + s * 7, oy + s * 4.5 + (s - armOffset), s * 1.5, s * 2);
      gfx.endFill();
    } else if (state === AgentState.Collaborating) {
      // Wave animation
      const waveY = Math.sin(anim.collabTimer * 6) * s;
      gfx.beginFill(skinColor);
      // Left arm normal
      gfx.drawRect(ox - s * 0.5, oy + s * 5, s * 1.5, s * 2);
      // Right arm waving up
      gfx.drawRect(ox + s * 7, oy + s * 3 + waveY, s * 1.5, s * 2);
      gfx.endFill();
    } else if (state === AgentState.Moving || state === AgentState.Returning) {
      // Walking: arms swing opposite to legs
      const armSwing = (anim.walkFrame % 2 === 0 ? 1 : -1) * s * 0.5;
      gfx.beginFill(skinColor);
      gfx.drawRect(ox - s * 0.5, oy + s * 4.5 + armSwing, s * 1.5, s * 2);
      gfx.drawRect(ox + s * 7, oy + s * 4.5 - armSwing, s * 1.5, s * 2);
      gfx.endFill();
    } else {
      // Idle: arms at sides
      gfx.beginFill(skinColor);
      gfx.drawRect(ox - s * 0.5, oy + s * 5, s * 1.5, s * 2);
      gfx.drawRect(ox + s * 7, oy + s * 5, s * 1.5, s * 2);
      gfx.endFill();
    }

    // --- Legs (walk animation) ---
    gfx.beginFill(0x444466);
    if (state === AgentState.Moving || state === AgentState.Returning) {
      // Walk cycle: 4 frames (0,1,2,3) -> stride patterns
      const legOffset = [0, s, 0, -s][anim.walkFrame];
      // Left leg
      gfx.drawRect(ox + s * 2, oy + s * 8 + legOffset, s * 2, s * 2);
      // Right leg
      gfx.drawRect(ox + s * 5, oy + s * 8 - legOffset, s * 2, s * 2);
    } else {
      // Standing still
      gfx.drawRect(ox + s * 2, oy + s * 8, s * 2, s * 2);
      gfx.drawRect(ox + s * 5, oy + s * 8, s * 2, s * 2);
    }
    gfx.endFill();

    // --- Small accessory based on role ---
    if (role === 'devops' || role === 'security') {
      // Headset/headphones
      gfx.beginFill(0x555555);
      gfx.drawRect(ox + s * 1.5, oy + s * 0.5, s * 0.5, s * 2);
      gfx.drawRect(ox + s * 6, oy + s * 0.5, s * 0.5, s * 2);
      gfx.drawRect(ox + s * 1.5, oy - s * 0.5, s * 5, s * 0.5);
      gfx.endFill();
    } else if (role === 'designer') {
      // Beret hat
      gfx.beginFill(0xE91E63);
      gfx.drawRect(ox + s * 1.5, oy - s * 1.5, s * 5, s * 1);
      gfx.drawRect(ox + s * 3, oy - s * 2, s * 2, s * 1);
      gfx.endFill();
    } else if (role === 'architect') {
      // Glasses
      gfx.beginFill(0xFFD700);
      gfx.drawRect(ox + s * 2, oy + s * 1, s * 1.5, s * 0.3);
      gfx.drawRect(ox + s * 4.5, oy + s * 1, s * 1.5, s * 0.3);
      gfx.drawRect(ox + s * 3.5, oy + s * 1, s * 1, s * 0.3);
      gfx.endFill();
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
