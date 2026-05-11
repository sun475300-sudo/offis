import { GridCell, IPathfinder, ITilemap, PathNode, PathResult } from '../types';

/**
 * A* Pathfinder with dynamic obstacle support.
 * Open set is currently a sort+shift list (O(n log n) per step).
 * Switching to a binary heap is a future optimization.
 */
export class Pathfinder implements IPathfinder {
  private tilemap: ITilemap;

  // 8-directional movement (including diagonals)
  private static readonly DIRS: readonly GridCell[] = [
    { col: 0, row: -1 },
    { col: 1, row: -1 },
    { col: 1, row: 0 },
    { col: 1, row: 1 },
    { col: 0, row: 1 },
    { col: -1, row: 1 },
    { col: -1, row: 0 },
    { col: -1, row: -1 },
  ];

  constructor(tilemap: ITilemap) {
    this.tilemap = tilemap;
  }

  findPath(start: GridCell, goal: GridCell, dynamicObstacles: GridCell[] = []): PathResult {
    const obstacleSet = new Set<string>(
      dynamicObstacles.map(c => `${c.col},${c.row}`)
    );

    obstacleSet.delete(`${goal.col},${goal.row}`);

    // Guard: relocate unwalkable start to nearest walkable cell.
    // (regression: bug-fix-2026-05-03)
    if (!this.tilemap.isWalkable(start.col, start.row)) {
      const altStart = this.nearestWalkable(start);
      if (!altStart) return { path: [], found: false, cost: 0, nodesExplored: 0 };
      start = altStart;
    }

    if (!this.tilemap.isWalkable(goal.col, goal.row)) {
      const alt = this.nearestWalkable(goal);
      if (!alt) return { path: [], found: false, cost: 0, nodesExplored: 0 };
      goal = alt;
    }

    const openList: PathNode[] = [];
    const closedSet = new Set<string>();
    const gScores = new Map<string, number>();
    let nodesExplored = 0;

    const startNode: PathNode = {
      cell: start,
      g: 0,
      h: this.heuristic(start, goal),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;

    openList.push(startNode);
    gScores.set(this.key(start), 0);

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;
      nodesExplored++;

      const ck = this.key(current.cell);

      if (current.cell.col === goal.col && current.cell.row === goal.row) {
        return {
          path: this.reconstructPath(current),
          found: true,
          cost: current.g,
          nodesExplored,
        };
      }

      closedSet.add(ck);

      for (const dir of Pathfinder.DIRS) {
        const neighbor: GridCell = {
          col: current.cell.col + dir.col,
          row: current.cell.row + dir.row,
        };

        const nk = this.key(neighbor);
        if (closedSet.has(nk)) continue;

        if (!this.tilemap.isWalkable(neighbor.col, neighbor.row)) continue;

        if (obstacleSet.has(nk)) continue;

        if (dir.col !== 0 && dir.row !== 0) {
          if (!this.tilemap.isWalkable(current.cell.col + dir.col, current.cell.row) ||
              !this.tilemap.isWalkable(current.cell.col, current.cell.row + dir.row)) {
            continue;
          }
        }

        const moveCost = (dir.col !== 0 && dir.row !== 0) ? 1.414 : 1.0;
        const tileWeight = this.tilemap.getTile(neighbor.col, neighbor.row).weight;
        const tentativeG = current.g + moveCost * tileWeight;

        const existingG = gScores.get(nk);
        if (existingG !== undefined && tentativeG >= existingG) continue;

        gScores.set(nk, tentativeG);

        const node: PathNode = {
          cell: neighbor,
          g: tentativeG,
          h: this.heuristic(neighbor, goal),
          f: 0,
          parent: current,
        };
        node.f = node.g + node.h;

        openList.push(node);
      }

      if (nodesExplored > 10000) {
        return { path: [], found: false, cost: 0, nodesExplored };
      }
    }

    return { path: [], found: false, cost: 0, nodesExplored };
  }

  /** Octile distance heuristic (for 8-directional movement) */
  private heuristic(a: GridCell, b: GridCell): number {
    const dx = Math.abs(a.col - b.col);
    const dy = Math.abs(a.row - b.row);
    return Math.max(dx, dy) + (1.414 - 1) * Math.min(dx, dy);
  }

  private key(cell: GridCell): string {
    return `${cell.col},${cell.row}`;
  }

  private reconstructPath(node: PathNode): GridCell[] {
    const path: GridCell[] = [];
    let current: PathNode | null = node;
    while (current) {
      path.unshift(current.cell);
      current = current.parent;
    }
    return path;
  }

  /** Find nearest walkable cell to a target (concentric ring search) */
  private nearestWalkable(center: GridCell): GridCell | null {
    for (let radius = 1; radius <= 5; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          const c = center.col + dc;
          const r = center.row + dr;
          if (this.tilemap.isWalkable(c, r)) {
            return { col: c, row: r };
          }
        }
      }
    }
    return null;
  }
}
