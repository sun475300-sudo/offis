import * as PIXI from 'pixi.js';
import { AgentSnapshot, AgentState, TileType } from '../types';
import { Tilemap, TILE_SIZE } from '../spatial/Tilemap';

/**
 * Minimap — bird's eye view of the entire office rendered as a small overlay.
 * Shows agent positions as colored dots with real-time updates.
 */
export class MinimapRenderer {
  private container: PIXI.Container;
  private mapGraphics: PIXI.Graphics;
  private agentDots: PIXI.Graphics;
  private viewportRect: PIXI.Graphics;
  private background: PIXI.Graphics;

  private readonly minimapWidth: number;
  private readonly minimapHeight: number;

  private mapCols: number = 0;
  private mapRows: number = 0;

  constructor(
    parentContainer: PIXI.Container,
    minimapWidth: number = 200,
    minimapHeight: number = 120,
  ) {
    this.minimapWidth = minimapWidth;
    this.minimapHeight = minimapHeight;

    this.container = new PIXI.Container();
    this.container.sortableChildren = true;

    // Background panel
    this.background = new PIXI.Graphics();
    this.background.beginFill(0x0d1117, 0.85);
    this.background.lineStyle(1, 0x30363d);
    this.background.drawRoundedRect(-4, -4, minimapWidth + 8, minimapHeight + 8, 6);
    this.background.endFill();
    this.background.zIndex = 0;
    this.container.addChild(this.background);

    // Map tiles layer
    this.mapGraphics = new PIXI.Graphics();
    this.mapGraphics.zIndex = 1;
    this.container.addChild(this.mapGraphics);

    // Agent dots layer
    this.agentDots = new PIXI.Graphics();
    this.agentDots.zIndex = 2;
    this.container.addChild(this.agentDots);

    // Viewport rectangle
    this.viewportRect = new PIXI.Graphics();
    this.viewportRect.zIndex = 3;
    this.container.addChild(this.viewportRect);

    parentContainer.addChild(this.container);
  }

  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  /** Clean up all PIXI resources */
  destroy(): void {
    this.background.destroy();
    this.mapGraphics.destroy();
    this.agentDots.destroy();
    this.viewportRect.destroy();
    this.container.destroy({ children: true });
  }

  /** Render the static tilemap onto the minimap */
  renderMap(tilemap: Tilemap): void {
    this.mapCols = tilemap.getWidth();
    this.mapRows = tilemap.getHeight();

    const scaleX = this.minimapWidth / this.mapCols;
    const scaleY = this.minimapHeight / this.mapRows;

    const grid = tilemap.getRawGrid();
    this.mapGraphics.clear();

    const TILE_COLORS: Record<TileType, number> = {
      [TileType.Floor]: 0x2C2C3E,
      [TileType.Wall]: 0x1A1A2E,
      [TileType.Desk]: 0x6B4226,
      [TileType.Door]: 0x3D5A80,
      [TileType.MeetingTable]: 0x5C4033,
      [TileType.Corridor]: 0x333350,
    };

    for (let r = 0; r < this.mapRows; r++) {
      for (let c = 0; c < this.mapCols; c++) {
        const tile = grid[r][c];
        this.mapGraphics.beginFill(TILE_COLORS[tile.type] ?? 0x2C2C3E);
        this.mapGraphics.drawRect(
          c * scaleX,
          r * scaleY,
          Math.ceil(scaleX),
          Math.ceil(scaleY),
        );
        this.mapGraphics.endFill();
      }
    }
  }

  /** Update agent dots and viewport rectangle each frame */
  update(
    agents: AgentSnapshot[],
    cameraX: number,
    cameraY: number,
    viewportWidth: number,
    viewportHeight: number,
    zoom: number,
  ): void {
    const scaleX = this.minimapWidth / (this.mapCols * TILE_SIZE);
    const scaleY = this.minimapHeight / (this.mapRows * TILE_SIZE);

    // Agent dots
    this.agentDots.clear();
    const STATE_COLORS: Record<AgentState, number> = {
      [AgentState.Idle]: 0x888888,
      [AgentState.Moving]: 0x00FF88,
      [AgentState.Working]: 0xFFAA00,
      [AgentState.Returning]: 0x88CCFF,
      [AgentState.Waiting]: 0xFF6666,
      [AgentState.Collaborating]: 0xCC88FF,
    };

    for (const agent of agents) {
      const mx = agent.position.x * scaleX;
      const my = agent.position.y * scaleY;
      const color = STATE_COLORS[agent.state] ?? 0xFFFFFF;

      this.agentDots.beginFill(color);
      this.agentDots.drawCircle(mx, my, agent.state === AgentState.Working ? 2.5 : 1.5);
      this.agentDots.endFill();
    }

    // Viewport rectangle
    this.viewportRect.clear();
    this.viewportRect.lineStyle(1, 0x58a6ff, 0.8);

    const vw = (viewportWidth / zoom) * scaleX;
    const vh = (viewportHeight / zoom) * scaleY;
    const vx = cameraX * scaleX - vw / 2;
    const vy = cameraY * scaleY - vh / 2;

    this.viewportRect.drawRect(vx, vy, vw, vh);
  }
}
