import { describe, it, expect } from 'vitest';
import { Pathfinder } from './Pathfinder';
import { ITilemap, TileData, TileType, GridCell, Vec2 } from '../types';

/**
 * Mock tilemap: a simple grid where specific cells can be marked as walls.
 */
function createMockTilemap(width: number, height: number, walls: Set<string> = new Set()): ITilemap {
  return {
    getWidth: () => width,
    getHeight: () => height,
    getTile(col: number, row: number): TileData {
      const key = `${col},${row}`;
      if (walls.has(key) || col < 0 || row < 0 || col >= width || row >= height) {
        return { type: TileType.Wall, walkable: false, occupantId: null, weight: 1 };
      }
      return { type: TileType.Floor, walkable: true, occupantId: null, weight: 1 };
    },
    isWalkable(col: number, row: number): boolean {
      if (col < 0 || row < 0 || col >= width || row >= height) return false;
      return !walls.has(`${col},${row}`);
    },
    setOccupant(_col: number, _row: number, _agentId: string | null): void {},
    gridToWorld(cell: GridCell): Vec2 {
      return { x: cell.col * 32, y: cell.row * 32 };
    },
    worldToGrid(pos: Vec2): GridCell {
      return { col: Math.floor(pos.x / 32), row: Math.floor(pos.y / 32) };
    },
  };
}

describe('Pathfinder', () => {
  it('should find a path on an open grid', () => {
    const tilemap = createMockTilemap(10, 10);
    const pathfinder = new Pathfinder(tilemap);

    const result = pathfinder.findPath({ col: 0, row: 0 }, { col: 5, row: 5 });

    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
    expect(result.path[0]).toEqual({ col: 0, row: 0 });
    expect(result.path[result.path.length - 1]).toEqual({ col: 5, row: 5 });
  });

  it('should return the start cell when start equals goal', () => {
    const tilemap = createMockTilemap(10, 10);
    const pathfinder = new Pathfinder(tilemap);

    const result = pathfinder.findPath({ col: 3, row: 3 }, { col: 3, row: 3 });

    expect(result.found).toBe(true);
    expect(result.path).toEqual([{ col: 3, row: 3 }]);
    expect(result.cost).toBe(0);
  });

  it('should return not found when path is completely blocked', () => {
    // Create a wall that completely blocks passage
    const walls = new Set<string>();
    // Vertical wall across the entire grid at col=5
    for (let r = 0; r < 10; r++) {
      walls.add(`5,${r}`);
    }
    const tilemap = createMockTilemap(10, 10, walls);
    const pathfinder = new Pathfinder(tilemap);

    const result = pathfinder.findPath({ col: 0, row: 0 }, { col: 9, row: 0 });

    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
  });

  it('should navigate around obstacles', () => {
    // Wall with a gap
    const walls = new Set<string>();
    for (let r = 0; r < 9; r++) {
      walls.add(`5,${r}`);
    }
    // Gap at row 9 (bottom)
    const tilemap = createMockTilemap(10, 10, walls);
    const pathfinder = new Pathfinder(tilemap);

    const result = pathfinder.findPath({ col: 0, row: 0 }, { col: 9, row: 0 });

    expect(result.found).toBe(true);
    // Path must go around the wall
    expect(result.path.length).toBeGreaterThan(5);
    // No cell in the path should be a wall
    for (const cell of result.path) {
      expect(walls.has(`${cell.col},${cell.row}`)).toBe(false);
    }
  });

  it('should respect dynamic obstacles', () => {
    const tilemap = createMockTilemap(5, 1);
    const pathfinder = new Pathfinder(tilemap);

    // Block the only row except start and goal
    const obstacles: GridCell[] = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ];

    const result = pathfinder.findPath({ col: 0, row: 0 }, { col: 4, row: 0 }, obstacles);

    // On a 5x1 grid with middle blocked, no path possible
    expect(result.found).toBe(false);
  });

  it('should report nodesExplored > 0 for non-trivial paths', () => {
    const tilemap = createMockTilemap(10, 10);
    const pathfinder = new Pathfinder(tilemap);

    const result = pathfinder.findPath({ col: 0, row: 0 }, { col: 9, row: 9 });

    expect(result.found).toBe(true);
    expect(result.nodesExplored).toBeGreaterThan(0);
    expect(result.cost).toBeGreaterThan(0);
  });

  it('should find nearest walkable cell when goal is unwalkable', () => {
    const walls = new Set<string>(['5,5']);
    const tilemap = createMockTilemap(10, 10, walls);
    const pathfinder = new Pathfinder(tilemap);

    const result = pathfinder.findPath({ col: 0, row: 0 }, { col: 5, row: 5 });

    // Should find path to a neighbor of (5,5) since (5,5) is a wall
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
  });
});
