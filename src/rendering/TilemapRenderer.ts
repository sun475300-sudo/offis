import * as PIXI from 'pixi.js';
import { TileData, TileType } from '../types';
import { TILE_SIZE, Tilemap } from '../spatial/Tilemap';

/** Color palette for tile types */
const TILE_COLORS: Record<TileType, number> = {
  [TileType.Floor]: 0x2C2C3E,
  [TileType.Wall]: 0x1A1A2E,
  [TileType.Desk]: 0x6B4226,
  [TileType.Door]: 0x3D5A80,
  [TileType.MeetingTable]: 0x5C4033,
  [TileType.Corridor]: 0x333350,
};

/** Room zone definition for labels */
interface RoomZone {
  label: string;
  col: number;
  row: number;
  width: number;
  height: number;
  color: number;
}

const ROOM_ZONES: RoomZone[] = [
  { label: 'Frontend Team', col: 1, row: 1, width: 12, height: 5, color: 0x4FC3F7 },
  { label: 'Backend Team', col: 1, row: 7, width: 12, height: 5, color: 0x81C784 },
  { label: 'Design Studio', col: 1, row: 13, width: 6, height: 5, color: 0xFFB74D },
  { label: 'Meeting Room', col: 8, row: 13, width: 5, height: 5, color: 0x3FB950 },
  { label: 'Right Wing', col: 15, row: 1, width: 24, height: 5, color: 0x90A4AE },
  { label: 'Review Team', col: 1, row: 19, width: 12, height: 4, color: 0x9C27B0 },
  { label: 'Conference Room', col: 34, row: 9, width: 8, height: 7, color: 0x58A6FF },
  { label: 'Server Room', col: 34, row: 19, width: 6, height: 6, color: 0xFF6666 },
];

export class TilemapRenderer {
  private container: PIXI.Container;
  private labelsContainer: PIXI.Container;
  private renderer: PIXI.IRenderer | null;
  private bakedTexture: PIXI.RenderTexture | null = null;
  private bakedSprite: PIXI.Sprite | null = null;

  constructor(parentContainer: PIXI.Container, renderer?: PIXI.IRenderer) {
    this.container = new PIXI.Container();
    this.labelsContainer = new PIXI.Container();
    this.renderer = renderer ?? null;
    parentContainer.addChild(this.container);
    parentContainer.addChild(this.labelsContainer);
  }

  /** Render the entire tilemap as pixel graphics */
  renderMap(tilemap: Tilemap): void {
    // removeChildren detaches but does not release the underlying GPU
    // resources — destroy each child so repeated renderMap() calls
    // don't leak Graphics/Text objects.
    for (const child of [...this.container.children]) child.destroy({ children: true });
    for (const child of [...this.labelsContainer.children]) child.destroy({ children: true });
    this.container.removeChildren();
    this.labelsContainer.removeChildren();
    if (this.bakedTexture) {
      this.bakedTexture.destroy(true);
      this.bakedTexture = null;
      this.bakedSprite = null;
    }

    const width = tilemap.getWidth();
    const height = tilemap.getHeight();
    const grid = tilemap.getRawGrid();

    const gfx = new PIXI.Graphics();

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const tile = grid[r][c];
        const color = TILE_COLORS[tile.type] ?? 0x2C2C3E;

        gfx.beginFill(color);
        gfx.drawRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        gfx.endFill();

        // Desk detail — monitor with stand
        if (tile.type === TileType.Desk) {
          // Monitor screen
          gfx.beginFill(0x87CEEB, 0.6);
          gfx.drawRect(
            c * TILE_SIZE + TILE_SIZE * 0.2,
            r * TILE_SIZE + TILE_SIZE * 0.15,
            TILE_SIZE * 0.6,
            TILE_SIZE * 0.35,
          );
          gfx.endFill();
          // Monitor stand
          gfx.beginFill(0x555555);
          gfx.drawRect(
            c * TILE_SIZE + TILE_SIZE * 0.4,
            r * TILE_SIZE + TILE_SIZE * 0.5,
            TILE_SIZE * 0.2,
            TILE_SIZE * 0.15,
          );
          gfx.endFill();
          // Keyboard
          gfx.beginFill(0x333344);
          gfx.drawRect(
            c * TILE_SIZE + TILE_SIZE * 0.15,
            r * TILE_SIZE + TILE_SIZE * 0.7,
            TILE_SIZE * 0.7,
            TILE_SIZE * 0.15,
          );
          gfx.endFill();
        }

        // Meeting table — center line + cup markers
        if (tile.type === TileType.MeetingTable) {
          gfx.lineStyle(1, 0x8B7355);
          gfx.moveTo(c * TILE_SIZE, r * TILE_SIZE + TILE_SIZE / 2);
          gfx.lineTo(c * TILE_SIZE + TILE_SIZE, r * TILE_SIZE + TILE_SIZE / 2);
          gfx.lineStyle(0);
        }

        // Door — draw doorframe accent
        if (tile.type === TileType.Door) {
          gfx.lineStyle(1, 0x58A6FF, 0.4);
          gfx.drawRect(
            c * TILE_SIZE + 2,
            r * TILE_SIZE + 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4,
          );
          gfx.lineStyle(0);
        }

        // Wall — subtle brick pattern
        if (tile.type === TileType.Wall) {
          gfx.lineStyle(1, 0x252535, 0.3);
          // Horizontal brick line
          gfx.moveTo(c * TILE_SIZE, r * TILE_SIZE + TILE_SIZE / 2);
          gfx.lineTo(c * TILE_SIZE + TILE_SIZE, r * TILE_SIZE + TILE_SIZE / 2);
          // Vertical brick offset
          const offset = (r % 2 === 0) ? TILE_SIZE / 2 : 0;
          gfx.moveTo(c * TILE_SIZE + offset, r * TILE_SIZE);
          gfx.lineTo(c * TILE_SIZE + offset, r * TILE_SIZE + TILE_SIZE / 2);
          gfx.lineStyle(0);
        }
      }
    }

    // Grid lines (subtle)
    gfx.lineStyle(1, 0x444466, 0.15);
    for (let c = 0; c <= width; c++) {
      gfx.moveTo(c * TILE_SIZE, 0);
      gfx.lineTo(c * TILE_SIZE, height * TILE_SIZE);
    }
    for (let r = 0; r <= height; r++) {
      gfx.moveTo(0, r * TILE_SIZE);
      gfx.lineTo(width * TILE_SIZE, r * TILE_SIZE);
    }

    this.container.addChild(gfx);

    // Render room zone labels
    this.renderRoomLabels();

    // GPU bake: flatten the static tile + label graphics into a single
    // RenderTexture and replace the per-frame command stream with a single
    // textured-quad draw. The Graphics objects are still useful here as a
    // source — we render *into* the RenderTexture once and then discard
    // the source geometry. After this, every frame the GPU samples one
    // big tilemap texture instead of replaying thousands of drawRects.
    this.bakeToTexture(tilemap);
  }

  /**
   * Bake this.container + this.labelsContainer into one RenderTexture and
   * swap them out for a single Sprite. No-op when no renderer was passed in
   * (headless / vitest paths) — the Graphics fallback still renders fine.
   */
  private bakeToTexture(tilemap: Tilemap): void {
    if (!this.renderer) return;

    const width = tilemap.getWidth() * TILE_SIZE;
    const height = tilemap.getHeight() * TILE_SIZE;
    const resolution = Math.min(window.devicePixelRatio || 1, 2);

    const rt = PIXI.RenderTexture.create({ width, height, resolution });
    // Use LINEAR so room labels and antialiased grid lines stay smooth
    // under camera zoom.
    rt.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;

    // Render both containers (tiles + labels) into the same RenderTexture.
    // We render the tiles first, then labels, so labels stack on top exactly
    // like the live container ordering.
    const flat = new PIXI.Container();
    while (this.container.children.length) {
      flat.addChild(this.container.children[0]);
    }
    while (this.labelsContainer.children.length) {
      flat.addChild(this.labelsContainer.children[0]);
    }
    this.renderer.render(flat, { renderTexture: rt });
    // Source Graphics/Text are no longer needed — texture has captured them.
    flat.destroy({ children: true });

    const sprite = new PIXI.Sprite(rt);
    // The RenderTexture's resolution-scaled size needs no extra scaling here;
    // Sprite renders at the texture's logical (CSS-pixel) dimensions.
    this.container.addChild(sprite);
    this.bakedTexture = rt;
    this.bakedSprite = sprite;
  }

  /** Draw room zone labels on the map */
  private renderRoomLabels(): void {
    for (const zone of ROOM_ZONES) {
      // Zone border highlight
      const border = new PIXI.Graphics();
      border.lineStyle(1, zone.color, 0.2);
      border.drawRect(
        zone.col * TILE_SIZE,
        zone.row * TILE_SIZE,
        zone.width * TILE_SIZE,
        zone.height * TILE_SIZE,
      );
      this.labelsContainer.addChild(border);

      // Corner accent marks
      const cornerSize = 6;
      const accent = new PIXI.Graphics();
      accent.lineStyle(2, zone.color, 0.4);
      const x = zone.col * TILE_SIZE;
      const y = zone.row * TILE_SIZE;
      const w = zone.width * TILE_SIZE;
      const h = zone.height * TILE_SIZE;
      // Top-left
      accent.moveTo(x, y + cornerSize); accent.lineTo(x, y); accent.lineTo(x + cornerSize, y);
      // Top-right
      accent.moveTo(x + w - cornerSize, y); accent.lineTo(x + w, y); accent.lineTo(x + w, y + cornerSize);
      // Bottom-left
      accent.moveTo(x, y + h - cornerSize); accent.lineTo(x, y + h); accent.lineTo(x + cornerSize, y + h);
      // Bottom-right
      accent.moveTo(x + w - cornerSize, y + h); accent.lineTo(x + w, y + h); accent.lineTo(x + w, y + h - cornerSize);
      this.labelsContainer.addChild(accent);

      // Label text
      const label = new PIXI.Text(zone.label, {
        fontFamily: 'monospace',
        fontSize: 9,
        fill: zone.color,
        fontWeight: 'bold',
      });
      label.alpha = 0.5;
      label.x = zone.col * TILE_SIZE + 4;
      label.y = zone.row * TILE_SIZE - 12;
      this.labelsContainer.addChild(label);
    }
  }
}
