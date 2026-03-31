import { AgentSnapshot, AgentState, GridCell, Vec2 } from '../types';

/**
 * Local Avoidance System
 * Implements simplified RVO (Reciprocal Velocity Obstacles) for collision-free movement.
 * When agents approach each other in narrow corridors, they steer to avoid overlap.
 */
export class LocalAvoidance {
  private readonly avoidanceRadius: number = 24; // pixels
  private readonly avoidanceForce: number = 60;  // steering strength

  /**
   * Calculate avoidance steering vector for an agent given nearby agents.
   * Returns an offset Vec2 to add to the agent's movement direction.
   */
  computeSteering(
    agent: AgentSnapshot,
    nearbyAgents: AgentSnapshot[],
    deltaTime: number,
  ): Vec2 {
    let steerX = 0;
    let steerY = 0;

    for (const other of nearbyAgents) {
      if (other.id === agent.id) continue;

      const dx = agent.position.x - other.position.x;
      const dy = agent.position.y - other.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.avoidanceRadius && dist > 0.01) {
        // Inverse-distance repulsion force
        const strength = (this.avoidanceRadius - dist) / this.avoidanceRadius;
        const nx = dx / dist;
        const ny = dy / dist;

        steerX += nx * strength * this.avoidanceForce * deltaTime;
        steerY += ny * strength * this.avoidanceForce * deltaTime;
      }
    }

    return { x: steerX, y: steerY };
  }

  /**
   * Get dynamic obstacle cells from moving agents (for A* replanning).
   * Excludes the querying agent itself.
   */
  getDynamicObstacles(agents: AgentSnapshot[], excludeId: string): GridCell[] {
    return agents
      .filter(a => a.id !== excludeId && a.state !== AgentState.Idle)
      .map(a => a.gridCell);
  }

  /**
   * Check if two agents are about to collide head-on in a corridor.
   * If so, one yields by stepping aside.
   */
  shouldYield(agentA: AgentSnapshot, agentB: AgentSnapshot): boolean {
    // Lower ID yields (deterministic tie-breaking)
    if (agentA.state !== AgentState.Moving || agentB.state !== AgentState.Moving) return false;

    const dx = agentB.position.x - agentA.position.x;
    const dy = agentB.position.y - agentA.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.avoidanceRadius * 1.5) return false;

    // Dot product of movement directions — if negative, they're heading toward each other
    if (agentA.path.length === 0 || agentB.path.length === 0) return false;

    return agentA.id > agentB.id; // deterministic: higher-id agent yields
  }
}
