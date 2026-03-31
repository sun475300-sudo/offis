import { GridCell, IPathfinder, ITilemap, PathNode, PathResult } from '../types';

class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  get size() { return this.data.length; }

  push(item: T): void {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[parent]) >= 0) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.compare(this.data[left], this.data[smallest]) < 0) smallest = left;
      if (right < n && this.compare(this.data[right], this.data[smallest]) < 0) smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

/**
 * A* Pathfinder with dynamic obstacle support.
 * Uses a binary heap for the open set for O(log n) insert/extract.
 */
export class Pathfinder implements IPathfinder {
  private tilemap: ITilemap;

  // 8-directional movement (including diagonals)
  private static readonly DIRS: readonly GridCell[] = [
    { col: 0, row: -1 },  // N
    { col: 1, row: -1 },  // NE
    { col: 1, row: 0 },   // E
    { col: 1, row: 1 },   // SE
    { col: 0, row: 1 },   // S
    { col: -1, row: 1 },  // SW
    { col: -1, row: 0 },  // W
    { col: -1, row: -1 }, // NW
  ];

  constructor(tilemap: ITilemap) {
    this.tilemap = tilemap;
  }

  findPath(start: GridCell, goal: GridCell, dynamicObstacles: GridCell[] = []): PathResult {
    const obstacleSet = new Set<string>(
      dynamicObstacles.map(c => `${c.col},${c.row}`)
    );

    // Don't block the goal itself (agent is heading there)
    obstacleSet.delete(`${goal.col},${goal.row}`);

    if (!this.tilemap.isWalkable(goal.col, goal.row) && !obstacleSet.has(`${goal.col},${goal.row}`)) {
      // Try to find nearest walkable neighbor to goal
      const alt = this.nearestWalkable(goal);
      if (!alt) return { path: [], found: false, cost: 0, nodesExplored: 0 };
      goal = alt;
    }

    const openList = new MinHeap<PathNode>((a, b) => a.f - b.f);
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

    while (openList.size > 0) {
      // Extract node with lowest f score
      const current = openList.pop()!;

      // Skip stale entries (a better path was already found for this node)
      const ck = this.key(current.cell);
      const bestG = gScores.get(ck);
      if (bestG !== undefined && current.g > bestG) continue;

      nodesExplored++;

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

        // Check walkability
        if (!this.tilemap.isWalkable(neighbor.col, neighbor.row)) continue;

        // Check dynamic obstacles
        if (obstacleSet.has(nk)) continue;

        // Diagonal: ensure we can cut corner (both adjacent cardinal tiles must be walkable)
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

      // Safety limit to prevent infinite loops on large maps
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

  /** Find nearest walkable cell to a target (BFS) */
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
