import {
  AgentConfig,
  AgentRole,
  AgentSnapshot,
  IEventBus,
  IPathfinder,
  ITilemap,
  TaskInfo,
} from '../types';
import { Agent } from './Agent';
import { LocalAvoidance } from '../spatial/LocalAvoidance';
import { SpatialHash } from '../spatial/SpatialHash';

export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private localAvoidance: LocalAvoidance;
  private spatialHash: SpatialHash;

  constructor(
    private tilemap: ITilemap,
    private pathfinder: IPathfinder,
    private eventBus: IEventBus,
  ) {
    this.localAvoidance = new LocalAvoidance();
    this.spatialHash = new SpatialHash(64);
  }

  /** Register a new agent into the system */
  addAgent(config: AgentConfig): Agent {
    const agent = new Agent(config, this.tilemap, this.pathfinder, this.eventBus);
    this.agents.set(config.id, agent);
    return agent;
  }

  /** Alias for addAgent */
  createAgent(config: AgentConfig): Agent {
    return this.addAgent(config);
  }

  /** Remove agent from the system */
  removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      const snap = agent.getSnapshot();
      this.tilemap.setOccupant(snap.gridCell.col, snap.gridCell.row, null);
    }
    this.agents.delete(id);
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAllSnapshots(): AgentSnapshot[] {
    return this.getAllAgents().map(a => a.getSnapshot());
  }

  /** Find idle agents that match a specific role */
  findIdleAgentsByRole(role: AgentRole): Agent[] {
    return this.getAllAgents().filter(
      a => a.role === role && a.isIdle()
    );
  }

  /** Find first available idle agent for a given role */
  findBestAgentForTask(task: TaskInfo): Agent | null {
    const candidates = this.findIdleAgentsByRole(task.requiredRole);
    if (candidates.length === 0) return null;

    // Pick the closest idle agent to the task target
    let best: Agent | null = null;
    let bestDist = Infinity;

    for (const agent of candidates) {
      const pos = agent.getPosition();
      const target = this.tilemap.gridToWorld(task.targetDesk);
      const dx = pos.x - target.x;
      const dy = pos.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = agent;
      }
    }

    return best;
  }

  /** Main update loop — called every frame */
  update(deltaTime: number): void {
    const snapshots = this.getAllSnapshots();

    // Rebuild spatial hash for efficient neighbor queries
    this.spatialHash.rebuild(snapshots);

    // Collect occupied cells from all agents
    const allOccupied = snapshots.map(s => s.gridCell);

    // Update each agent with local avoidance
    for (const agent of this.agents.values()) {
      const snap = agent.getSnapshot();

      // Supply occupied cells (excluding this agent's own cell)
      const otherOccupied = allOccupied.filter(
        c => c.col !== snap.gridCell.col || c.row !== snap.gridCell.row
      );
      agent.setOccupiedCells(otherOccupied);

      // Query nearby agents for avoidance
      const nearby = this.spatialHash.queryRadius(snap.position, 48);
      const steering = this.localAvoidance.computeSteering(snap, nearby, deltaTime);
      agent.applyAvoidanceOffset(steering);

      // Update agent logic
      agent.update(deltaTime);
    }
  }

  /** Spawn a preset team of agents for the office */
  spawnDefaultTeam(): void {
    const teamConfigs: AgentConfig[] = [
      { id: 'fe-1', name: 'Alice', role: AgentRole.Frontend, homeDesk: { col: 3, row: 3 }, speed: 3, color: 0x4FC3F7 },
      { id: 'fe-2', name: 'Bob', role: AgentRole.Frontend, homeDesk: { col: 5, row: 3 }, speed: 3.2, color: 0x4DD0E1 },
      { id: 'fe-3', name: 'Carol', role: AgentRole.Frontend, homeDesk: { col: 3, row: 5 }, speed: 2.8, color: 0x81D4FA },
      { id: 'be-1', name: 'Dave', role: AgentRole.Backend, homeDesk: { col: 9, row: 3 }, speed: 2.5, color: 0x81C784 },
      { id: 'be-2', name: 'Eve', role: AgentRole.Backend, homeDesk: { col: 11, row: 3 }, speed: 3, color: 0xA5D6A7 },
      { id: 'be-3', name: 'Frank', role: AgentRole.Backend, homeDesk: { col: 9, row: 5 }, speed: 2.7, color: 0x66BB6A },
      { id: 'ds-1', name: 'Grace', role: AgentRole.Designer, homeDesk: { col: 17, row: 3 }, speed: 3.5, color: 0xFFB74D },
      { id: 'ds-2', name: 'Hank', role: AgentRole.Designer, homeDesk: { col: 19, row: 3 }, speed: 3, color: 0xFFA726 },
      { id: 'pm-1', name: 'Iris', role: AgentRole.PM, homeDesk: { col: 17, row: 5 }, speed: 4, color: 0xE57373 },
      { id: 'qa-1', name: 'Jack', role: AgentRole.QA, homeDesk: { col: 3, row: 9 }, speed: 3, color: 0xBA68C8 },
      { id: 'qa-2', name: 'Kate', role: AgentRole.QA, homeDesk: { col: 5, row: 9 }, speed: 2.8, color: 0xCE93D8 },
      { id: 'do-1', name: 'Leo', role: AgentRole.DevOps, homeDesk: { col: 9, row: 9 }, speed: 3.3, color: 0x90A4AE },
    ];

    for (const config of teamConfigs) {
      this.addAgent(config);
    }
  }

  /**
   * Spawn the CEO pipeline team (CEO → Architect → Coder → Reviewer).
   * These agents handle the PaperClip-style delegation workflow.
   */
  spawnPipelineTeam(): void {
    const pipelineConfigs: AgentConfig[] = [
      { id: 'ceo-1',  name: 'Director',  role: AgentRole.CEO,       homeDesk: { col: 13, row: 3 }, speed: 4.0, color: 0xFFD700 },
      { id: 'arc-1',  name: 'Archie',    role: AgentRole.Architect, homeDesk: { col: 13, row: 5 }, speed: 3.0, color: 0xFF6B6B },
      { id: 'cod-1',  name: 'Cody',      role: AgentRole.Coder,     homeDesk: { col: 13, row: 7 }, speed: 3.5, color: 0x51CF66 },
      { id: 'rev-1',  name: 'Rex',       role: AgentRole.Reviewer,  homeDesk: { col: 13, row: 9 }, speed: 3.2, color: 0x845EF7 },
    ];

    for (const config of pipelineConfigs) {
      // Only add if not already present
      if (!this.agents.has(config.id)) {
        this.addAgent(config);
      }
    }
  }
}
