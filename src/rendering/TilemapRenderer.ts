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

export class TilemapRenderer {
  private container: PIXI.Container;

  constructor(parentContainer: PIXI.Container) {
    this.container = new PIXI.Container();
    parentContainer.addChild(this.container);
  }

  /** Render the entire tilemap as pixel graphics */
  renderMap(tilemap: Tilemap): void {
    for (const child of this.container.children) {
      child.destroy({ children: true });
    }
    this.container.removeChildren();

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

        // Desk detail — draw a small monitor on desk tiles
        if (tile.type === TileType.Desk) {
          gfx.beginFill(0x87CEEB, 0.6);
          gfx.drawRect(
            c * TILE_SIZE + TILE_SIZE * 0.25,
            r * TILE_SIZE + TILE_SIZE * 0.2,
            TILE_SIZE * 0.5,
            TILE_SIZE * 0.35,
          );
          gfx.endFill();
        }

        // Meeting table — draw center line
        if (tile.type === TileType.MeetingTable) {
          gfx.lineStyle(1, 0x8B7355);
          gfx.moveTo(c * TILE_SIZE, r * TILE_SIZE + TILE_SIZE / 2);
          gfx.lineTo(c * TILE_SIZE + TILE_SIZE, r * TILE_SIZE + TILE_SIZE / 2);
          gfx.lineStyle(0);
        }
      }
    }

    // Grid lines (subtle)
    gfx.lineStyle(1, 0x444466, 0.2);
    for (let c = 0; c <= width; c++) {
      gfx.moveTo(c * TILE_SIZE, 0);
      gfx.lineTo(c * TILE_SIZE, height * TILE_SIZE);
    }
    for (let r = 0; r <= height; r++) {
      gfx.moveTo(0, r * TILE_SIZE);
      gfx.lineTo(width * TILE_SIZE, r * TILE_SIZE);
    }

    this.container.addChild(gfx);
  }
}
