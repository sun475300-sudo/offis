/**
 * HUDManager - Handles all DOM updates and UI panel management.
 * Separates UI logic from the main game loop.
 */
export class HUDManager {
  constructor() {
    this.setupPanelMinimizers();
  }

  updateStats(stats: { agents: number; idle: number; working: number; tasks: number; fps: number }): void {
    this.setElementText('stat-agents', stats.agents.toString());
    this.setElementText('stat-idle', stats.idle.toString());
    this.setElementText('stat-working', stats.working.toString());
    this.setElementText('stat-tasks', stats.tasks.toString());
    this.setElementText('stat-fps', stats.fps.toString());
  }

  updateMonitorPanel(stats: {
    agents: number;
    runners: number;
    tasks: number;
    debates: number;
    tokens: number;
    loops: number;
    successRate: string;
    avgTime: string;
  }): void {
    this.setElementText('monitor-agents', `${stats.agents}명 활성`);
    this.setElementText('monitor-runners', `${stats.runners}대 대기`);
    this.setElementText('monitor-tasks', `${stats.tasks}건`);
    this.setElementText('monitor-debates', `${stats.debates}건`);
    this.setElementText('monitor-tokens', stats.tokens.toLocaleString());
    
    // CI/CD
    this.setElementText('monitor-loops', `${stats.loops}건`);
    this.setElementText('monitor-success', stats.successRate);
    this.setElementText('monitor-avg-time', stats.avgTime);
  }

  updateTestDashboard(stats: { total: number; successRate: string; avgTime: string; schedules: string[] }): void {
    this.setElementText('test-total-count', stats.total.toString());
    this.setElementText('test-success-rate', stats.successRate);
    this.setElementText('test-avg-time', stats.avgTime);

    // Update schedules
    const list = document.getElementById('test-schedule-list');
    if (list) {
      if (stats.schedules.length === 0) {
        list.innerHTML = `<div class="test-schedule-item">예정된 테스트 없음</div>`;
      } else {
        list.innerHTML = stats.schedules.map(s => `<div class="test-schedule-item">${s}</div>`).join('');
      }
    }
  }

  updateAgentPanel(agents: any[]): void {
    const list = document.getElementById('agent-list');
    if (!list) return;

    // Use a template-based approach or simplified innerHTML for now to match main.ts
    // In a full refactor, this would be more efficient
    list.innerHTML = agents.map(agent => `
      <div class="agent-item" data-id="${agent.id}" data-state="${agent.state}">
        <div class="agent-avatar" style="background-color: #${agent.color.toString(16).padStart(6, '0')}"></div>
        <div class="agent-info">
          <div class="agent-name">${agent.name}</div>
          <div class="agent-role">${agent.role}</div>
        </div>
        <div class="agent-state" data-state="${agent.state}">${agent.state}</div>
      </div>
    `).join('');
  }

  logSystem(message: string, type: string = 'info'): void {
    this.appendToCLIOutput(`[SYSTEM] ${message}`, type);
  }

  logUser(message: string): void {
    this.appendToCLIOutput(`❯ ${message}`, 'user');
  }

  logError(message: string): void {
    this.appendToCLIOutput(`[ERROR] ${message}`, 'error');
  }

  private appendToCLIOutput(text: string, type: string): void {
    const output = document.getElementById('cli-output');
    if (!output) return;

    const entry = document.createElement('div');
    entry.className = `cli-line cli-line-${type}`;
    entry.textContent = text;
    
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
    
    // Limit lines
    while (output.childNodes.length > 50) {
      output.removeChild(output.firstChild!);
    }
  }

  private setElementText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  private setupPanelMinimizers(): void {
    const panels = [
      { btn: 'btn-minimize-panel', panel: 'agent-panel' },
      { btn: 'btn-minimize-history', panel: 'history-panel' },
      { btn: 'btn-minimize-monitor', panel: 'monitor-panel' },
      { btn: 'btn-minimize-test-dashboard', panel: 'test-dashboard-panel' },
      { btn: 'btn-minimize-chat', panel: 'chat-panel' },
    ];

    panels.forEach(({ btn, panel }) => {
      const btnEl = document.getElementById(btn);
      const panelEl = document.getElementById(panel);
      if (btnEl && panelEl) {
        btnEl.onclick = () => {
          panelEl.classList.toggle('minimized');
          btnEl.textContent = panelEl.classList.contains('minimized') ? '+' : '−';
        };
      }
    });
  }
}
