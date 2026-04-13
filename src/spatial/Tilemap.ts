import { GridCell, ITilemap, TileData, TileType, Vec2 } from '../types';

export const TILE_SIZE = 32; // pixels per tile

/** Predefined office floor plan generator */
export class Tilemap implements ITilemap {
  private grid: TileData[][];
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = this.generateOfficeLayout();
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }

  getTile(col: number, row: number): TileData {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) {
      return { type: TileType.Wall, walkable: false, occupantId: null, weight: Infinity };
    }
    return this.grid[row][col];
  }

  isWalkable(col: number, row: number): boolean {
    return this.getTile(col, row).walkable;
  }

  setOccupant(col: number, row: number, agentId: string | null): void {
    if (col >= 0 && col < this.width && row >= 0 && row < this.height) {
      this.grid[row][col].occupantId = agentId;
    }
  }

  gridToWorld(cell: GridCell): Vec2 {
    return {
      x: cell.col * TILE_SIZE + TILE_SIZE / 2,
      y: cell.row * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  worldToGrid(pos: Vec2): GridCell {
    return {
      col: Math.floor(pos.x / TILE_SIZE),
      row: Math.floor(pos.y / TILE_SIZE),
    };
  }

  getRawGrid(): TileData[][] {
    return this.grid;
  }

  /** Generate a realistic office layout with rooms, corridors, desks */
  private generateOfficeLayout(): TileData[][] {
    const grid: TileData[][] = [];

    // Initialize all as floor
    for (let r = 0; r < this.height; r++) {
      grid[r] = [];
      for (let c = 0; c < this.width; c++) {
        grid[r][c] = { type: TileType.Floor, walkable: true, occupantId: null, weight: 1 };
      }
    }

    // Outer walls
    for (let c = 0; c < this.width; c++) {
      grid[0][c] = this.wall();
      grid[this.height - 1][c] = this.wall();
    }
    for (let r = 0; r < this.height; r++) {
      grid[r][0] = this.wall();
      grid[r][this.width - 1] = this.wall();
    }

    // Internal room partitions (horizontal walls with doors)
    const roomRows = [6, 12, 18];
    for (const rr of roomRows) {
      if (rr >= this.height - 1) continue;
      for (let c = 1; c < this.width - 1; c++) {
        grid[rr][c] = this.wall();
      }
      // Doors (corridors through walls)
      const doorPositions = [4, 10, 16, 22];
      for (const dp of doorPositions) {
        if (dp < this.width - 1) {
          grid[rr][dp] = { type: TileType.Door, walkable: true, occupantId: null, weight: 1 };
          if (dp + 1 < this.width - 1) {
            grid[rr][dp + 1] = { type: TileType.Door, walkable: true, occupantId: null, weight: 1 };
          }
        }
      }
    }

    // Vertical partition
    const partitionCol = 14;
    if (partitionCol < this.width - 1) {
      for (let r = 1; r < this.height - 1; r++) {
        if (grid[r][partitionCol].type !== TileType.Door && !roomRows.includes(r)) {
          grid[r][partitionCol] = this.wall();
        }
      }
      // Vertical doors
      for (const dr of [3, 9, 15, 21]) {
        if (dr < this.height - 1) {
          grid[dr][partitionCol] = { type: TileType.Door, walkable: true, occupantId: null, weight: 1 };
        }
      }
    }

    // Place desks in clusters
    const deskPositions: GridCell[] = [];
    const deskZones = [
      { startCol: 2, startRow: 2, cols: 4, rows: 3 },
      { startCol: 8, startRow: 2, cols: 4, rows: 3 },
      { startCol: 16, startRow: 2, cols: 4, rows: 3 },
      { startCol: 2, startRow: 8, cols: 4, rows: 3 },
      { startCol: 8, startRow: 8, cols: 4, rows: 3 },
      { startCol: 16, startRow: 8, cols: 4, rows: 3 },
      { startCol: 2, startRow: 14, cols: 4, rows: 3 },
      { startCol: 16, startRow: 14, cols: 4, rows: 3 },
    ];

    for (const zone of deskZones) {
      for (let dr = 0; dr < zone.rows; dr += 2) {
        for (let dc = 0; dc < zone.cols; dc += 2) {
          const c = zone.startCol + dc;
          const r = zone.startRow + dr;
          if (c < this.width - 1 && r < this.height - 1 && grid[r][c].type === TileType.Floor) {
            grid[r][c] = { type: TileType.Desk, walkable: false, occupantId: null, weight: Infinity };
            deskPositions.push({ col: c, row: r });
          }
        }
      }
    }

    // Meeting table (large unwalkable zone)
    const mtStart = { col: 8, row: 14 };
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 4; dc++) {
        const c = mtStart.col + dc;
        const r = mtStart.row + dr;
        if (c < this.width - 1 && r < this.height - 1) {
          grid[r][c] = { type: TileType.MeetingTable, walkable: false, occupantId: null, weight: Infinity };
        }
      }
    }

    // Conference Room (larger meeting area for debates)
    const confStart = { col: 35, row: 10 };
    for (let dr = 0; dr < 5; dr++) {
      for (let dc = 0; dc < 6; dc++) {
        const c = confStart.col + dc;
        const r = confStart.row + dr;
        if (c < this.width - 1 && r < this.height - 1) {
          grid[r][c] = { type: TileType.MeetingTable, walkable: false, occupantId: null, weight: Infinity };
        }
      }
    }

    // Server Room (for CI/CD runners)
    const serverStart = { col: 35, row: 20 };
    for (let dr = 0; dr < 4; dr++) {
      for (let dc = 0; dc < 4; dc++) {
        const c = serverStart.col + dc;
        const r = serverStart.row + dr;
        if (c < this.width - 1 && r < this.height - 1) {
          grid[r][c] = { type: TileType.MeetingTable, walkable: false, occupantId: null, weight: Infinity };
        }
      }
    }

    // Mark corridor tiles for slightly lower pathfinding weight (preferred paths)
    for (let r = 1; r < this.height - 1; r++) {
      for (let c = 1; c < this.width - 1; c++) {
        if (grid[r][c].type === TileType.Door) {
          grid[r][c].weight = 0.8;
        }
      }
    }

    return grid;
  }

  /** Place a desk at a specific tile */
  placeDesk(col: number, row: number): boolean {
    if (col < 1 || col >= this.width - 1 || row < 1 || row >= this.height - 1) return false;
    const tile = this.grid[row][col];
    if (tile.type !== TileType.Floor) return false;
    this.grid[row][col] = { type: TileType.Desk, walkable: false, occupantId: null, weight: Infinity };
    return true;
  }

  /** Remove furniture at a specific tile (replace with floor) */
  removeFurniture(col: number, row: number): boolean {
    if (col < 1 || col >= this.width - 1 || row < 1 || row >= this.height - 1) return false;
    const tile = this.grid[row][col];
    if (tile.type === TileType.Wall || tile.type === TileType.Floor) return false;
    this.grid[row][col] = { type: TileType.Floor, walkable: true, occupantId: null, weight: 1 };
    return true;
  }

  /** Place a meeting table zone */
  placeMeetingTable(startCol: number, startRow: number, width: number, height: number): number {
    let placed = 0;
    for (let dr = 0; dr < height; dr++) {
      for (let dc = 0; dc < width; dc++) {
        const c = startCol + dc;
        const r = startRow + dr;
        if (c >= 1 && c < this.width - 1 && r >= 1 && r < this.height - 1) {
          if (this.grid[r][c].type === TileType.Floor) {
            this.grid[r][c] = { type: TileType.MeetingTable, walkable: false, occupantId: null, weight: Infinity };
            placed++;
          }
        }
      }
    }
    return placed;
  }

  /** Find the nearest walkable cell to a target (BFS) */
  findNearestWalkable(target: GridCell, maxRadius: number = 3): GridCell {
    if (this.isWalkable(target.col, target.row)) return target;

    const queue: GridCell[] = [target];
    const visited = new Set<string>();
    visited.add(`${target.col},${target.row}`);

    const directions = [
      { col: 0, row: -1 }, { col: 0, row: 1 },
      { col: -1, row: 0 }, { col: 1, row: 0 },
      { col: -1, row: -1 }, { col: 1, row: -1 },
      { col: -1, row: 1 }, { col: 1, row: 1 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      // Manhattan distance check for radius
      const dist = Math.abs(current.col - target.col) + Math.abs(current.row - target.row);
      if (dist > maxRadius) continue;

      for (const dir of directions) {
        const next = { col: current.col + dir.col, row: current.row + dir.row };
        const key = `${next.col},${next.row}`;
        
        if (next.col < 0 || next.col >= this.width || next.row < 0 || next.row >= this.height) continue;
        if (visited.has(key)) continue;

        if (this.isWalkable(next.col, next.row)) {
          return next;
        }

        visited.add(key);
        queue.push(next);
      }
    }

    return target; // Fallback to original
  }

  private wall(): TileData {
    return { type: TileType.Wall, walkable: false, occupantId: null, weight: Infinity };
  }
}
