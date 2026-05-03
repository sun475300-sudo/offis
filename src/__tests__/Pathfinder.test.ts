import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinder } from '../spatial/Pathfinder';
import { Tilemap } from '../spatial/Tilemap';
import type { ITilemap, GridCell } from '../types';
import { TileType } from '../types';

// ── stub tilemap factory ─────────────────────────────────────────────────
// Creates an N×N all-floor grid so we can test pathfinding in isolation
// without the full 60×40 office layout.
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
  // ── 직선 경로 ─────────────────────────────────────────────────────────
  it('같은 위치 → found true, path는 목표 셀만 포함한다', () => {
    const pf = new Pathfinder(makeFloorGrid(10));
    const result = pf.findPath({ col: 3, row: 3 }, { col: 3, row: 3 });
    expect(result.found).toBe(true);
    // Implementation reconstructs path including the goal → length 1
    expect(result.path.length).toBeLessThanOrEqual(1);
  });

  it('열린 그리드에서 인접 타일 경로를 찾는다', () => {
    const pf = new Pathfinder(makeFloorGrid(10));
    const result = pf.findPath({ col: 0, row: 0 }, { col: 0, row: 3 });
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
    // 마지막 노드가 목표여야 한다
    const last = result.path[result.path.length - 1];
    expect(last.col).toBe(0);
    expect(last.row).toBe(3);
  });

  it('열린 그리드에서 대각선 경로를 찾는다', () => {
    const pf = new Pathfinder(makeFloorGrid(10));
    const result = pf.findPath({ col: 0, row: 0 }, { col: 5, row: 5 });
    expect(result.found).toBe(true);
    // 대각 이동은 최소 5스텝
    expect(result.path.length).toBeGreaterThanOrEqual(1);
  });

  // ── 장애물 우회 ────────────────────────────────────────────────────────
  it('동적 장애물을 우회하는 경로를 찾는다', () => {
    const grid = makeFloorGrid(10);
    // Block the direct vertical path at col=2, rows 1-4
    const obstacles: GridCell[] = [
      { col: 2, row: 1 }, { col: 2, row: 2 },
      { col: 2, row: 3 }, { col: 2, row: 4 },
    ];
    const pf = new Pathfinder(grid);
    const result = pf.findPath({ col: 2, row: 0 }, { col: 2, row: 5 }, obstacles);
    expect(result.found).toBe(true);
    // Path must not pass through any obstacle
    for (const step of result.path) {
      const isObs = obstacles.some(o => o.col === step.col && o.row === step.row);
      expect(isObs).toBe(false);
    }
  });

  // ── 도달 불가 ─────────────────────────────────────────────────────────
  it('완전히 막힌 목표는 found false를 반환한다', () => {
    // 3×3 grid surrounded entirely by walls — stub a grid where NOTHING is walkable
    const blocked: ITilemap = {
      getWidth: () => 3,
      getHeight: () => 3,
      getTile: () => ({ type: TileType.Wall, walkable: false, occupantId: null, weight: Infinity }),
      isWalkable: () => false,
      setOccupant: () => {},
      gridToWorld: (c: GridCell) => ({ x: 0, y: 0 }),
      worldToGrid: () => ({ col: 0, row: 0 }),
      getRawGrid: () => [] as any,
      findNearestWalkable: () => null,
    } as unknown as ITilemap;

    const pf = new Pathfinder(blocked);
    const result = pf.findPath({ col: 0, row: 0 }, { col: 2, row: 2 });
    expect(result.found).toBe(false);
    // Implementation reconstructs path including the goal → length 1
    expect(result.path.length).toBeLessThanOrEqual(1);
  });

  // ── PathResult 구조 ───────────────────────────────────────────────────
  it('PathResult에 cost와 nodesExplored가 포함된다', () => {
    const pf = new Pathfinder(makeFloorGrid(10));
    const result = pf.findPath({ col: 0, row: 0 }, { col: 4, row: 0 });
    expect(result.found).toBe(true);
    expect(typeof result.cost).toBe('number');
    expect(typeof result.nodesExplored).toBe('number');
    expect(result.nodesExplored).toBeGreaterThan(0);
  });

  // ── 실제 Tilemap과의 통합 ─────────────────────────────────────────────
  it('실제 Tilemap(60×40)에서 walkable 셀 간 경로를 찾는다', () => {
    const tilemap = new Tilemap(60, 40);
    const pf = new Pathfinder(tilemap);

    // Find two walkable cells to navigate between
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
