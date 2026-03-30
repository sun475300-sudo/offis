import { AgentSnapshot, Vec2 } from '../types';

/**
 * Spatial Hash Grid for efficient neighbor queries.
 * Divides the world into cells and tracks which agents are in each cell.
 * O(1) average-case neighbor lookup instead of O(n^2) brute force.
 */
export class SpatialHash {
  private readonly cellSize: number;
  private buckets: Map<string, AgentSnapshot[]> = new Map();

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
  }

  /** Rebuild the entire spatial hash from current agent positions */
  rebuild(agents: AgentSnapshot[]): void {
    this.buckets.clear();
    for (const agent of agents) {
      const key = this.positionToKey(agent.position);
      if (!this.buckets.has(key)) {
        this.buckets.set(key, []);
      }
      this.buckets.get(key)!.push(agent);
    }
  }

  /** Query agents within a radius from a position */
  queryRadius(center: Vec2, radius: number): AgentSnapshot[] {
    const results: AgentSnapshot[] = [];
    const minCol = Math.floor((center.x - radius) / this.cellSize);
    const maxCol = Math.floor((center.x + radius) / this.cellSize);
    const minRow = Math.floor((center.y - radius) / this.cellSize);
    const maxRow = Math.floor((center.y + radius) / this.cellSize);

    const radiusSq = radius * radius;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const bucket = this.buckets.get(`${c},${r}`);
        if (!bucket) continue;
        for (const agent of bucket) {
          const dx = agent.position.x - center.x;
          const dy = agent.position.y - center.y;
          if (dx * dx + dy * dy <= radiusSq) {
            results.push(agent);
          }
        }
      }
    }

    return results;
  }

  private positionToKey(pos: Vec2): string {
    const c = Math.floor(pos.x / this.cellSize);
    const r = Math.floor(pos.y / this.cellSize);
    return `${c},${r}`;
  }
}
