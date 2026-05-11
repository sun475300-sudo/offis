import * as PIXI from 'pixi.js';
import { AgentRole, AgentSnapshot, AgentState } from '../types';

/**
 * Statistics chart renderer — inline charts for the dashboard overlay.
 * Renders agent productivity bars, state distribution pie, task timeline.
 */
export class StatsChartRenderer {
  private container: PIXI.Container;
  private visible: boolean = false;

  // Data tracking
  private taskCompletionHistory: { time: number; count: number }[] = [];
  private agentStateHistory: Map<string, AgentState[]> = new Map();
  private lastUpdateTime: number = 0;

  constructor(parentContainer: PIXI.Container) {
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.container.sortableChildren = true;
    parentContainer.addChild(this.container);
  }

  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.visible = this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Record agent states for timeline tracking */
  recordSnapshot(agents: AgentSnapshot[]): void {
    const now = Date.now();
    if (now - this.lastUpdateTime < 1000) return; // sample once per second
    this.lastUpdateTime = now;

    for (const agent of agents) {
      if (!this.agentStateHistory.has(agent.id)) {
        this.agentStateHistory.set(agent.id, []);
      }
      const history = this.agentStateHistory.get(agent.id)!;
      history.push(agent.state);
      if (history.length > 120) history.shift(); // keep 2 minutes of data
    }
  }

  /** Full redraw of the stats overlay */
  render(agents: AgentSnapshot[], completedTasks: number, totalTasks: number): void {
    if (!this.visible) return;

    // Destroy existing children instead of just detaching so we don't
    // leak a fresh set of Graphics/Text objects every render tick.
    for (const child of [...this.container.children]) child.destroy({ children: true });
    this.container.removeChildren();

    // Background panel
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0d1117, 0.92);
    bg.lineStyle(1, 0x30363d);
    bg.drawRoundedRect(0, 0, 320, 400, 8);
    bg.endFill();
    this.container.addChild(bg);

    // Title
    const title = new PIXI.Text('ANALYTICS DASHBOARD', {
      fontFamily: 'monospace', fontSize: 11, fill: 0xe6edf3, fontWeight: 'bold', letterSpacing: 1,
    });
    title.position.set(12, 10);
    this.container.addChild(title);

    // 1. Agent State Distribution Bar
    this.renderStateDistribution(agents, 12, 35);

    // 2. Role Activity Chart
    this.renderRoleActivity(agents, 12, 140);

    // 3. Task Completion Counter
    this.renderTaskCounter(completedTasks, totalTasks, 12, 260);

    // 4. Agent Utilization Metric
    this.renderUtilization(agents, 12, 320);
  }

  private renderStateDistribution(agents: AgentSnapshot[], x: number, y: number): void {
    const label = new PIXI.Text('State Distribution', {
      fontFamily: 'monospace', fontSize: 9, fill: 0x8b949e,
    });
    label.position.set(x, y);
    this.container.addChild(label);

    const stateCounts = new Map<AgentState, number>();
    for (const a of agents) {
      stateCounts.set(a.state, (stateCounts.get(a.state) || 0) + 1);
    }

    const STATE_COLORS: Record<string, number> = {
      idle: 0x8b949e,
      moving: 0x3fb950,
      working: 0xd29922,
      returning: 0x58a6ff,
      waiting: 0xf85149,
      collaborating: 0xa371f7,
    };

    const barY = y + 18;
    const barWidth = 290;
    const barHeight = 20;
    const total = agents.length || 1;
    let offsetX = x;

    const gfx = new PIXI.Graphics();

    for (const [state, count] of stateCounts) {
      const width = (count / total) * barWidth;
      gfx.beginFill(STATE_COLORS[state] ?? 0x888888);
      gfx.drawRect(offsetX, barY, width, barHeight);
      gfx.endFill();
      offsetX += width;
    }

    this.container.addChild(gfx);

    // Legend
    let legendX = x;
    const legendY = barY + 28;
    for (const [state, count] of stateCounts) {
      const dot = new PIXI.Graphics();
      dot.beginFill(STATE_COLORS[state] ?? 0x888888);
      dot.drawCircle(legendX + 4, legendY + 4, 3);
      dot.endFill();
      this.container.addChild(dot);

      const legendText = new PIXI.Text(`${state}: ${count}`, {
        fontFamily: 'monospace', fontSize: 8, fill: 0x8b949e,
      });
      legendText.position.set(legendX + 12, legendY - 1);
      this.container.addChild(legendText);

      legendX += 55;
      if (legendX > x + 280) {
        legendX = x;
      }
    }
  }

  private renderRoleActivity(agents: AgentSnapshot[], x: number, y: number): void {
    const label = new PIXI.Text('Role Activity', {
      fontFamily: 'monospace', fontSize: 9, fill: 0x8b949e,
    });
    label.position.set(x, y);
    this.container.addChild(label);

    const roleStats = new Map<AgentRole, { total: number; active: number }>();
    for (const a of agents) {
      const existing = roleStats.get(a.role) || { total: 0, active: 0 };
      existing.total++;
      if (a.state !== AgentState.Idle) existing.active++;
      roleStats.set(a.role, existing);
    }

    const ROLE_COLORS: Record<string, number> = {
      frontend: 0x4FC3F7,
      backend: 0x81C784,
      designer: 0xFFB74D,
      pm: 0xE57373,
      qa: 0xBA68C8,
      devops: 0x90A4AE,
      architect: 0x9C27B0,
      security: 0xF44336,
      performance: 0xFF9800,
    };

    const gfx = new PIXI.Graphics();
    let barY = y + 18;
    const maxBarWidth = 200;

    for (const [role, stats] of roleStats) {
      // Label
      const roleLabel = new PIXI.Text(`${role.toUpperCase().slice(0, 6)}`, {
        fontFamily: 'monospace', fontSize: 8, fill: 0x8b949e,
      });
      roleLabel.position.set(x, barY + 1);
      this.container.addChild(roleLabel);

      // Background bar
      const barX = x + 60;
      gfx.beginFill(0x21262d);
      gfx.drawRoundedRect(barX, barY, maxBarWidth, 10, 3);
      gfx.endFill();

      // Active bar
      const activeWidth = stats.total > 0 ? (stats.active / stats.total) * maxBarWidth : 0;
      gfx.beginFill(ROLE_COLORS[role] ?? 0x888888);
      gfx.drawRoundedRect(barX, barY, activeWidth, 10, 3);
      gfx.endFill();

      // Count text
      const countText = new PIXI.Text(`${stats.active}/${stats.total}`, {
        fontFamily: 'monospace', fontSize: 8, fill: 0xe6edf3,
      });
      countText.position.set(barX + maxBarWidth + 8, barY);
      this.container.addChild(countText);

      barY += 16;
    }

    this.container.addChild(gfx);
  }

  private renderTaskCounter(completed: number, total: number, x: number, y: number): void {
    const label = new PIXI.Text('Task Progress', {
      fontFamily: 'monospace', fontSize: 9, fill: 0x8b949e,
    });
    label.position.set(x, y);
    this.container.addChild(label);

    const gfx = new PIXI.Graphics();
    const barWidth = 290;

    gfx.beginFill(0x21262d);
    gfx.drawRoundedRect(x, y + 18, barWidth, 14, 5);
    gfx.endFill();

    const progress = total > 0 ? completed / total : 0;
    const fillColor = progress >= 1 ? 0x3fb950 : progress >= 0.5 ? 0xd29922 : 0x58a6ff;
    gfx.beginFill(fillColor);
    gfx.drawRoundedRect(x, y + 18, barWidth * progress, 14, 5);
    gfx.endFill();

    this.container.addChild(gfx);

    const progressText = new PIXI.Text(`${completed}/${total} (${Math.round(progress * 100)}%)`, {
      fontFamily: 'monospace', fontSize: 9, fill: 0xe6edf3, fontWeight: 'bold',
    });
    progressText.anchor.set(0.5, 0.5);
    progressText.position.set(x + barWidth / 2, y + 25);
    this.container.addChild(progressText);
  }

  private renderUtilization(agents: AgentSnapshot[], x: number, y: number): void {
    const active = agents.filter(a => a.state !== AgentState.Idle).length;
    const total = agents.length || 1;
    const utilization = Math.round((active / total) * 100);

    const label = new PIXI.Text(`Utilization: ${utilization}% (${active}/${total} active)`, {
      fontFamily: 'monospace', fontSize: 10, fill: utilization > 70 ? 0x3fb950 : utilization > 40 ? 0xd29922 : 0xf85149,
      fontWeight: 'bold',
    });
    label.position.set(x, y);
    this.container.addChild(label);
  }
}
