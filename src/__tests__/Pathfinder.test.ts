import { describe, it, expect } from 'vitest';
import { Pathfinder } from '../spatial/Pathfinder';
import { Tilemap } from '../spatial/Tilemap';
import type { ITilemap, GridCell } from '../types';
import { TileType } from '../types';

// stub tilemap factory
function makeFloorGrid(size: number): ITilemap {
  const data: { walkable: boolean; occupantId: string | null }[][] = Array.from(
    { length: size },
    () => Array.from({ length: size }, () => ({ walkable: true, occupantId: null })),
  );

  return {
    getWidth: () => size,
    getHeight: () => size,
    getTile: (col: number, row: number) => {
      if (col < 0 || col >= size || row < 0 || row >= size) {
        return { type: TileType.Wall, walkable: false, occupantId: null, weight: Infinity };
      }
      return { type: TileType.Floor, walkable: data[row][col].walkable, occupantId: data[row][col].occupantId, weight: 1 };
    },
    isWalkable: (col: number, row: number) => {
      if (col < 0 || col >= size || row < 0 || row >= size) return false;
      return data[row][col].walkable;
    },
    setOccupant: (col: number, row: number, id: string | null) => {
      if (col >= 0 && col < size && row >= 0 && row < size) data[row][col].occupantId = id;
    },
    gridToWorld: (c: GridCell) => ({ x: c.col * 32, y: c.row * 32 }),
    worldToGrid: (v: { x: number; y: number }) => ({ col: Math.floor(v.x / 32), row: Math.floor(v.y / 32) }),
    getRawGrid: () => [] as any,
    findNearestWalkable: (c: GridCell) => c,
  } as unknown as ITilemap;
}

describe('Pathfinder', () => {
  it('same start and goal returns found true with path length <= 1', () => {
    const pf = new Pathfinder(makeFloorGrid(10));
    const result = pf.findPath({ col: 3, row: 3 }, { col: 3, row: 3 });
    expect(result.found).toBe(true);
    expect(result.path.length).toBeLessThanOrEqual(1);
  });

  it('finds adjacent path on open grid', () => {
    const pf = new Pathfinder(makeFloorGrid(10));
    const result = pf.findPath({ col: 0, row: 0 }, { col: 0, row: 3 });
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
    const last = result.path[result.path.length - 1];
    expect(last.col).toBe(0);
    expect(last.row).toBe(3);
  });

  it('finds diagonal path on open grid', () => {
    const pf = new Pathfinder(makeFloorGrid(10));
    const result = pf.findPath({ col: 0, row: 0 }, { col: 5, row: 5 });
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThanOrEqual(1);
  });

  it('routes around dynamic obstacles', () => {
    const grid = makeFloorGrid(10);
    const obstacles: GridCell[] = [
      { col: 2, row: 1 }, { col: 2, row: 2 },
      { col: 2, row: 3 }, { col: 2, row: 4 },
    ];
    const pf = new Pathfinder(grid);
    const result = pf.findPath({ col: 2, row: 0 }, { col: 2, row: 5 }, obstacles);
    expect(result.found).toBe(true);
    for (const step of result.path) {
      const isObs = obstacles.some(o => o.col === step.col && o.row === step.row);
      expect(isObs).toBe(false);
    }
  });

  it('returns found false when goal is fully blocked', () => {
    const blocked: ITilemap = {
      getWidth: () => 3,
      getHeight: () => 3,
      getTile: () => ({ type: TileType.Wall, walkable: false, occupantId: null, weight: Infinity }),
      isWalkable: () => false,
      setOccupant: () => {},
      gridToWorld: () => ({ x: 0, y: 0 }),
      worldToGrid: () => ({ col: 0, row: 0 }),
      getRawGrid: () => [] as any,
      findNearestWalkable: () => null as any,
    } as unknown as ITilemap;

    const pf = new Pathfinder(blocked);
    const result = pf.findPath({ col: 0, row: 0 }, { col: 2, row: 2 });
    expect(result.found).toBe(false);
    expect(result.path.length).toBeLessThanOrEqual(1);
  });

  // regression: bug-fix-2026-05-03 (start cell unwalkable guard)
  it('relocates unwalkable start to nearest walkable cell', () => {
    const data: { walkable: boolean }[][] = Array.from(
      { length: 10 },
      () => Array.from({ length: 10 }, () => ({ walkable: true })),
    );
    data[0][0].walkable = false;

    const grid: ITilemap = {
      getWidth: () => 10,
      getHeight: () => 10,
      getTile: (col: number, row: number) => {
        if (col < 0 || col >= 10 || row < 0 || row >= 10) {
          return { type: TileType.Wall, walkable: false, occupantId: null, weight: Infinity };
        }
        const w = data[row][col].walkable;
        return { type: w ? TileType.Floor : TileType.Desk, walkable: w, occupantId: null, weight: w ? 1 : Infinity };
      },
      isWalkable: (col: number, row: number) => {
        if (col < 0 || col >= 10 || row < 0 || row >= 10) return false;
        return data[row][col].walkable;
      },
      setOccupant: () => {},
      gridToWorld: (c: GridCell) => ({ x: c.col * 32, y: c.row * 32 }),
      worldToGrid: () => ({ col: 0, row: 0 }),
      getRawGrid: () => [] as any,
      findNearestWalkable: (c: GridCell) => {
        if (c.col === 0 && c.row === 0) return { col: 1, row: 0 };
        return c;
      },
    } as unknown as ITilemap;

    const pf = new Pathfinder(grid);
    const result = pf.findPath({ col: 0, row: 0 }, { col: 5, row: 0 });
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
    const first = result.path[0];
    expect(first.col === 0 && first.row === 0).toBe(false);
  });

  it('returns found false when both start and goal unwalkable and no alternative', () => {
    const allBlocked: ITilemap = {
      getWidth: () => 5,
      getHeight: () => 5,
      getTile: () => ({ type: TileType.Wall, walkable: false, occupantId: null, weight: Infinity }),
      isWalkable: () => false,
      setOccupant: () => {},
      gridToWorld: () => ({ x: 0, y: 0 }),
      worldToGrid: () => ({ col: 0, row: 0 }),
      getRawGrid: () => [] as any,
      findNearestWalkable: () => null as any,
    } as unknown as ITilemap;

    const pf = new Pathfinder(allBlocked);
    const result = pf.findPath({ col: 0, row: 0 }, { col: 4, row: 4 });
    expect(result.found).toBe(false);
    expect(result.path.length).toBeLessThanOrEqual(1);
  });

  it('PathResult includes cost and nodesExplored', () => {
    const pf = new Pathfinder(makeFloorGrid(10));
    const result = pf.findPath({ col: 0, row: 0 }, { col: 4, row: 0 });
    expect(result.found).toBe(true);
    expect(typeof result.cost).toBe('number');
    expect(typeof result.nodesExplored).toBe('number');
    expect(result.nodesExplored).toBeGreaterThan(0);
  });

  it('finds path between walkable cells on real Tilemap (60x40)', () => {
    const tilemap = new Tilemap(60, 40);
    const pf = new Pathfinder(tilemap);

    let start: GridCell | null = null;
    let goal: GridCell | null = null;
    outer: for (let r = 1; r < 39; r++) {
      for (let c = 1; c < 59; c++) {
        if (tilemap.isWalkable(c, r)) {
          if (!start) { start = { col: c, row: r }; }
          else if (Math.abs(c - start.col) + Math.abs(r - start.row) > 10) {
            goal = { col: c, row: r };
            break outer;
          }
        }
      }
    }
    expect(start).not.toBeNull();
    expect(goal).not.toBeNull();
    const result = pf.findPath(start!, goal!);
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
  });
});
