export interface StressTestConfig {
  agentCount: number;
  concurrentTasks: number;
  duration: number;
  codeReviewCount: number;
  networkLatency?: number;
  agentTypes?: AgentTypeConfig[];
}

export interface AgentTypeConfig {
  type: 'architect' | 'security' | 'performance' | 'developer' | 'reviewer';
  count: number;
}

export interface TestHistory {
  id: string;
  type: 'stress' | 'load' | 'debate' | 'cicd' | 'meeting';
  timestamp: number;
  config: any;
  result: any;
}

export interface StressTestResult {
  totalAgents: number;
  totalTasksCompleted: number;
  failedTasks: number;
  avgResponseTime: number;
  peakMemory: number;
  avgFps: number;
  githubApiCalls: number;
  rateLimitHits: number;
  duration: number;
  errors: string[];
}

export interface LoadTestResult {
  spawnTime: number;
  activeAgents: number;
  memoryUsed: number;
  fpsDrop: number;
}

export class TestSuite {
  private results: StressTestResult[] = [];
  private startTime: number = 0;
  private tasksCompleted: number = 0;
  private failedTasks: number = 0;
  private githubCalls: number = 0;
  private rateLimitHits: number = 0;
  private responseTimes: number[] = [];
  private history: TestHistory[] = [];
  private latency: number = 0;

  setNetworkLatency(ms: number): void {
    this.latency = ms;
  }

  private async simulatedDelay(): Promise<void> {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }
  }

  async runStressTest(
    config: StressTestConfig,
    callbacks?: {
      onAgentSpawn?: (count: number) => void;
      onTaskComplete?: (taskId: string, duration: number) => void;
      onError?: (error: string) => void;
    }
  ): Promise<StressTestResult> {
    this.startTime = Date.now();
    this.tasksCompleted = 0;
    this.failedTasks = 0;
    this.githubCalls = 0;
    this.rateLimitHits = 0;
    this.responseTimes = [];

    console.log(`[StressTest] Starting: ${config.agentCount} agents, ${config.concurrentTasks} concurrent, ${config.duration}s duration`);

    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const tasks: Promise<void>[] = [];

    // Simulate agent spawning and task execution
    for (let i = 0; i < config.agentCount; i++) {
      callbacks?.onAgentSpawn?.(i + 1);
      
      // Each agent runs concurrent tasks
      for (let j = 0; j < config.concurrentTasks; j++) {
        const taskPromise = this.runSimulatedTask(config.duration, callbacks);
        tasks.push(taskPromise);
      }
    }

    // Run code reviews in parallel
    for (let i = 0; i < config.codeReviewCount; i++) {
      const reviewPromise = this.runSimulatedReview(callbacks);
      tasks.push(reviewPromise);
    }

    // Wait for all tasks or timeout
    const timeoutPromise = new Promise<void>(resolve => setTimeout(resolve, config.duration * 1000));
    await Promise.race([Promise.allSettled(tasks), timeoutPromise]);

    // Snapshot counters immediately after the race so any tasks that are
    // still running in the background after a timeout don't inflate the
    // result (or, worse, bleed into the next runStressTest invocation,
    // which resets these same fields at start).
    const tasksCompletedSnap = this.tasksCompleted;
    const failedTasksSnap = this.failedTasks;
    const githubCallsSnap = this.githubCalls;
    const rateLimitHitsSnap = this.rateLimitHits;
    const responseTimesSnap = [...this.responseTimes];

    const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const duration = (Date.now() - this.startTime) / 1000;

    const result: StressTestResult = {
      totalAgents: config.agentCount,
      totalTasksCompleted: tasksCompletedSnap,
      failedTasks: failedTasksSnap,
      avgResponseTime: responseTimesSnap.length > 0
        ? responseTimesSnap.reduce((a, b) => a + b, 0) / responseTimesSnap.length
        : 0,
      peakMemory: Math.max(startMemory, endMemory),
      avgFps: 60,
      githubApiCalls: githubCallsSnap,
      rateLimitHits: rateLimitHitsSnap,
      duration,
      errors: [],
    };

    this.results.push(result);
    console.log(`[StressTest] Complete: ${this.tasksCompleted} tasks, ${this.failedTasks} failed, ${duration.toFixed(1)}s`);
    
    return result;
  }

  private async runSimulatedTask(
    maxDuration: number,
    callbacks?: {
      onTaskComplete?: (taskId: string, duration: number) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const taskId = `task-${Math.random().toString(36).substr(2, 9)}`;
    const taskStart = Date.now();
    
    try {
      await this.simulatedDelay();
      const delay = Math.random() * 100 + 50;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const duration = Date.now() - taskStart;
      this.tasksCompleted++;
      this.responseTimes.push(duration);
      
      callbacks?.onTaskComplete?.(taskId, duration);
    } catch (error) {
      this.failedTasks++;
      callbacks?.onError?.(`Task ${taskId} failed: ${error}`);
    }
  }

  private async runSimulatedReview(
    callbacks?: {
      onTaskComplete?: (taskId: string, duration: number) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const reviewId = `review-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      await this.simulatedDelay();
      this.githubCalls += Math.floor(Math.random() * 5) + 3;
      
      if (Math.random() < 0.1) {
        this.rateLimitHits++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const delay = Math.random() * 200 + 100;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const duration = Date.now() - startTime;
      this.tasksCompleted++;
      this.responseTimes.push(duration);
      
      callbacks?.onTaskComplete?.(reviewId, duration);
    } catch (error) {
      this.failedTasks++;
      callbacks?.onError?.(`Review ${reviewId} failed: ${error}`);
    }
  }

  async runLoadTest(
    targetAgents: number,
    spawnRate: number
  ): Promise<LoadTestResult> {
    const startTime = Date.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const startFps = 60;
    
    console.log(`[LoadTest] Spawning ${targetAgents} agents at ${spawnRate}/s`);
    
    // Simulate agent spawning
    for (let i = 0; i < targetAgents; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000 / spawnRate));
    }
    
    const spawnTime = Date.now() - startTime;
    const endMemory = (performance as any).memory?.usedJSHeapSize || startMemory;
    
    // Simulate FPS drop based on agent count
    const fpsDrop = Math.min(30, targetAgents * 0.5);
    
    return {
      spawnTime,
      activeAgents: targetAgents,
      memoryUsed: endMemory - startMemory,
      fpsDrop,
    };
  }

  async runDebateStressTest(participantCount: number): Promise<{ duration: number; turns: number; errors: number }> {
    console.log(`[DebateStress] Testing ${participantCount} participants`);
    
    const startTime = Date.now();
    let turns = 0;
    let errors = 0;
    
    // Simulate debate rounds
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < participantCount; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 50));
          turns++;
        } catch {
          errors++;
        }
      }
    }
    
    return {
      duration: Date.now() - startTime,
      turns,
      errors,
    };
  }

  async runCICDFeedbackLoopTest(iterations: number): Promise<{ success: number; failed: number; avgTime: number }> {
    console.log(`[CI/CD] Testing ${iterations} feedback loop iterations`);
    
    let success = 0;
    let failed = 0;
    let totalTime = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        // Simulate test cycle
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
        
        // 90% success rate
        if (Math.random() > 0.1) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      
      totalTime += Date.now() - startTime;
    }
    
    return {
      success,
      failed,
      avgTime: totalTime / iterations,
    };
  }

  getResults(): StressTestResult[] {
    return this.results;
  }

  async runAgentTypeTest(types: AgentTypeConfig[]): Promise<{ type: string; tasks: number; time: number }[]> {
    console.log(`[AgentTypeTest] Testing ${types.length} agent types`);
    
    const results: { type: string; tasks: number; time: number }[] = [];
    
    for (const agentType of types) {
      const startTime = Date.now();
      let tasks = 0;
      
      for (let i = 0; i < agentType.count; i++) {
        await this.simulatedDelay();
        const delay = Math.random() * 50 + 20;
        await new Promise(resolve => setTimeout(resolve, delay));
        tasks += Math.floor(Math.random() * 5) + 1;
      }
      
      results.push({
        type: agentType.type,
        tasks,
        time: Date.now() - startTime,
      });
    }
    
    return results;
  }

  async runMeetingCollaborationTest(teamSize: number, rounds: number): Promise<{ participants: number; rounds: number; messages: number; conflicts: number }> {
    console.log(`[MeetingTest] ${teamSize} participants, ${rounds} rounds`);
    
    let messages = 0;
    let conflicts = 0;
    
    for (let round = 0; round < rounds; round++) {
      for (let i = 0; i < teamSize; i++) {
        await this.simulatedDelay();
        messages++;
        
        if (Math.random() < 0.15) {
          conflicts++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return { participants: teamSize, rounds, messages, conflicts };
  }

  saveToHistory(type: TestHistory['type'], config: any, result: any): void {
    const entry: TestHistory = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      timestamp: Date.now(),
      config,
      result,
    };
    this.history.push(entry);
    
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
    
    localStorage.setItem('test_history', JSON.stringify(this.history.slice(-20)));
  }

  getHistory(): TestHistory[] {
    if (this.history.length === 0) {
      const stored = localStorage.getItem('test_history');
      if (stored) {
        try {
          this.history = JSON.parse(stored);
        } catch {}
      }
    }
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
    localStorage.removeItem('test_history');
  }

  private schedules: { id: string; name: string; interval: number; lastRun: number; enabled: boolean }[] = [];

  addSchedule(name: string, intervalMinutes: number): string {
    const id = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.schedules.push({
      id,
      name,
      interval: intervalMinutes * 60 * 1000,
      lastRun: 0,
      enabled: true,
    });
    this.saveSchedules();
    return id;
  }

  removeSchedule(id: string): void {
    this.schedules = this.schedules.filter(s => s.id !== id);
    this.saveSchedules();
  }

  getSchedules() {
    return this.schedules;
  }

  toggleSchedule(id: string, enabled: boolean): void {
    const schedule = this.schedules.find(s => s.id === id);
    if (schedule) {
      schedule.enabled = enabled;
      this.saveSchedules();
    }
  }

  private saveSchedules(): void {
    localStorage.setItem('test_schedules', JSON.stringify(this.schedules));
  }

  loadSchedules(): void {
    const stored = localStorage.getItem('test_schedules');
    if (stored) {
      try {
        this.schedules = JSON.parse(stored);
      } catch {}
    }
  }

  checkSchedules(callback: (schedule: any) => void): void {
    const now = Date.now();
    for (const schedule of this.schedules) {
      if (schedule.enabled && (now - schedule.lastRun >= schedule.interval)) {
        schedule.lastRun = now;
        callback(schedule);
      }
    }
  }

  private customScenarios: { id: string; name: string; config: StressTestConfig; description: string }[] = [
    { id: 'quick', name: '빠른 테스트', config: { agentCount: 5, concurrentTasks: 2, duration: 3, codeReviewCount: 2 }, description: '빠른烟雾测试' },
    { id: 'standard', name: '표준 테스트', config: { agentCount: 20, concurrentTasks: 5, duration: 10, codeReviewCount: 5 }, description: '일반적인 부하 테스트' },
    { id: 'heavy', name: '무거운 테스트', config: { agentCount: 50, concurrentTasks: 10, duration: 30, codeReviewCount: 15 }, description: '고부하 시뮬레이션' },
    { id: 'stress', name: '스트레스 테스트', config: { agentCount: 100, concurrentTasks: 20, duration: 60, codeReviewCount: 30 }, description: '최대 부하 상태' },
  ];

  addCustomScenario(name: string, config: StressTestConfig, description: string): string {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.customScenarios.push({ id, name, config, description });
    this.saveCustomScenarios();
    return id;
  }

  removeCustomScenario(id: string): void {
    this.customScenarios = this.customScenarios.filter(s => s.id !== id);
    this.saveCustomScenarios();
  }

  getCustomScenarios() {
    return this.customScenarios;
  }

  runCustomScenario(id: string, callbacks?: any): Promise<StressTestResult> {
    const scenario = this.customScenarios.find(s => s.id === id);
    if (!scenario) {
      return Promise.reject(new Error('Scenario not found'));
    }
    return this.runStressTest(scenario.config, callbacks);
  }

  private saveCustomScenarios(): void {
    localStorage.setItem('test_custom_scenarios', JSON.stringify(this.customScenarios.filter(s => s.id.startsWith('custom-'))));
  }

  loadCustomScenarios(): void {
    const stored = localStorage.getItem('test_custom_scenarios');
    if (stored) {
      try {
        const custom = JSON.parse(stored);
        this.customScenarios = [...this.customScenarios.filter(s => !s.id.startsWith('custom-')), ...custom];
      } catch {}
    }
  }

  exportToCSV(): string {
    const history = this.getHistory();
    if (history.length === 0) return 'No data to export';
    
    const headers = ['ID', 'Type', 'Timestamp', 'Config', 'Result'];
    const rows = history.map(h => [
      h.id,
      h.type,
      new Date(h.timestamp).toISOString(),
      JSON.stringify(h.config),
      JSON.stringify(h.result),
    ]);
    
    return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  }

  exportToJSON(): string {
    return JSON.stringify(this.getHistory(), null, 2);
  }

  downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private notifications: { type: string; enabled: boolean; threshold: number }[] = [
    { type: 'failure', enabled: true, threshold: 1 },
    { type: 'slow', enabled: true, threshold: 5000 },
    { type: 'memory', enabled: false, threshold: 100 },
    { type: 'rate-limit', enabled: true, threshold: 3 },
  ];

  getNotifications() {
    return this.notifications;
  }

  setNotification(type: string, enabled: boolean, threshold?: number): void {
    const notif = this.notifications.find(n => n.type === type);
    if (notif) {
      notif.enabled = enabled;
      if (threshold !== undefined) notif.threshold = threshold;
      this.saveNotifications();
    }
  }

  private saveNotifications(): void {
    localStorage.setItem('test_notifications', JSON.stringify(this.notifications));
  }

  loadNotifications(): void {
    const stored = localStorage.getItem('test_notifications');
    if (stored) {
      try {
        this.notifications = JSON.parse(stored);
      } catch {}
    }
  }

  checkNotification(result: any): string[] {
    const alerts: string[] = [];
    
    if (result.failedTasks > this.notifications.find(n => n.type === 'failure')!.threshold) {
      alerts.push(`⚠️ 실패 작업: ${result.failedTasks}개 (기준: ${this.notifications.find(n => n.type === 'failure')!.threshold})`);
    }
    
    if (result.duration * 1000 > this.notifications.find(n => n.type === 'slow')!.threshold) {
      alerts.push(`🐌 느린 실행: ${result.duration.toFixed(1)}s (기준: ${this.notifications.find(n => n.type === 'slow')!.threshold}ms)`);
    }
    
    if (result.rateLimitHits > this.notifications.find(n => n.type === 'rate-limit')!.threshold) {
      alerts.push(`🚨 Rate Limit: ${result.rateLimitHits}회 (기준: ${this.notifications.find(n => n.type === 'rate-limit')!.threshold})`);
    }
    
    return alerts;
  }

  private agentMetrics: Map<string, { tasks: number; avgTime: number; errors: number; successTime: number; failTime: number; lastActive: number }> = new Map();

  recordAgentMetric(agentId: string, time: number, success: boolean): void {
    const current = this.agentMetrics.get(agentId) || { tasks: 0, avgTime: 0, errors: 0, successTime: 0, failTime: 0, lastActive: 0 };
    current.tasks++;
    current.lastActive = Date.now();
    
    if (success) {
      current.successTime = (current.successTime * (current.tasks - current.errors - 1) + time) / Math.max(1, current.tasks - current.errors);
    } else {
      current.errors++;
      current.failTime = (current.failTime * (current.errors - 1) + time) / current.errors;
    }
    
    current.avgTime = (current.avgTime * (current.tasks - 1) + time) / current.tasks;
    this.agentMetrics.set(agentId, current);
  }

  getAgentMetrics(): { agentId: string; tasks: number; avgTime: number; errors: number; successRate: number; lastActive: number }[] {
    return Array.from(this.agentMetrics.entries()).map(([agentId, m]) => ({
      agentId,
      tasks: m.tasks,
      avgTime: m.avgTime,
      errors: m.errors,
      successRate: m.tasks > 0 ? ((m.tasks - m.errors) / m.tasks * 100) : 0,
      lastActive: m.lastActive,
    }));
  }

  getDetailedAgentReport(): string {
    const metrics = this.getAgentMetrics();
    if (metrics.length === 0) return '에이전트 성능 데이터가 없습니다';
    
    const sorted = [...metrics].sort((a, b) => b.tasks - a.tasks);
    const lines = ['═══════════════════════════════════', '     에이전트 성능 상세 리포트', '═══════════════════════════════════', ''];
    
    let totalTasks = 0, totalErrors = 0;
    for (const m of sorted) {
      totalTasks += m.tasks;
      totalErrors += m.errors;
      const status = m.successRate > 80 ? '🟢' : m.successRate > 50 ? '🟡' : '🔴';
      lines.push(`${status} ${m.agentId}`);
      lines.push(`   작업: ${m.tasks}개 | 에러: ${m.errors}개 |成功率: ${m.successRate.toFixed(1)}%`);
      lines.push(`   평균시간: ${m.avgTime.toFixed(0)}ms | 마지막활성: ${new Date(m.lastActive).toLocaleTimeString()}`);
      lines.push('');
    }
    
    const overallSuccess = totalTasks > 0 ? ((totalTasks - totalErrors) / totalTasks * 100).toFixed(1) : 0;
    lines.push('═══════════════════════════════════');
    lines.push(`총 작업: ${totalTasks}개 | 총 에러: ${totalErrors}개 | 전체成功率: ${overallSuccess}%`);
    
    return lines.join('\n');
  }

  getAgentPerformanceByType(): Record<string, { count: number; avgTime: number; successRate: number }> {
    const byType: Record<string, { count: number; totalTime: number; success: number; total: number }> = {};
    
    for (const [agentId, m] of this.agentMetrics) {
      const type = agentId.split('-')[0] || 'unknown';
      if (!byType[type]) {
        byType[type] = { count: 0, totalTime: 0, success: 0, total: 0 };
      }
      byType[type].count++;
      byType[type].totalTime += m.avgTime * m.tasks;
      byType[type].total += m.tasks;
      byType[type].success += m.tasks - m.errors;
    }
    
    const result: Record<string, { count: number; avgTime: number; successRate: number }> = {};
    for (const [type, data] of Object.entries(byType)) {
      result[type] = {
        count: data.count,
        avgTime: data.total > 0 ? data.totalTime / data.total : 0,
        successRate: data.total > 0 ? (data.success / data.total * 100) : 0,
      };
    }
    return result;
  }

  getAgentPerformanceReport(): string {
    const metrics = this.getAgentMetrics();
    if (metrics.length === 0) return '에이전트 성능 데이터가 없습니다';
    
    const sorted = [...metrics].sort((a, b) => b.tasks - a.tasks);
    const lines = ['=== 에이전트 성능 리포트 ===', ''];
    
    for (const m of sorted) {
      const successRate = m.tasks > 0 ? ((m.tasks - m.errors) / m.tasks * 100).toFixed(1) : 0;
      lines.push(`${m.agentId}: ${m.tasks}개 작업, 평균 ${m.avgTime.toFixed(0)}ms,成功率 ${successRate}%`);
    }
    
    return lines.join('\n');
  }

  clearAgentMetrics(): void {
    this.agentMetrics.clear();
  }

  compareResults(current: any, previous: any): string {
    const lines = ['=== 테스트 결과 비교 ===', ''];
    const keys = ['tasks', 'time', 'duration', 'errors', 'messages'];
    
    for (const key of keys) {
      const curr = current[key] || 0;
      const prev = previous[key] || 0;
      const diff = curr - prev;
      const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : 'N/A';
      const trend = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
      lines.push(`${key}: ${prev} → ${curr} (${trend} ${pct}%)`);
    }
    
    return lines.join('\n');
  }

  getLastResult(): any {
    const history = this.getHistory();
    return history.length > 0 ? history[history.length - 1].result : null;
  }

  getPreviousResult(): any {
    const history = this.getHistory();
    return history.length > 1 ? history[history.length - 2].result : null;
  }

  private templates: { id: string; name: string; config: StressTestConfig; description: string; createdAt: number }[] = [];

  saveTemplate(name: string, config: StressTestConfig, description: string = ''): string {
    const id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.templates.push({ id, name, config, description, createdAt: Date.now() });
    this.saveTemplates();
    return id;
  }

  getTemplates() {
    return this.templates;
  }

  deleteTemplate(id: string): void {
    this.templates = this.templates.filter(t => t.id !== id);
    this.saveTemplates();
  }

  runTemplate(id: string, callbacks?: any): Promise<StressTestResult> {
    const template = this.templates.find(t => t.id === id);
    if (!template) {
      return Promise.reject(new Error('Template not found'));
    }
    return this.runStressTest(template.config, callbacks);
  }

  private saveTemplates(): void {
    localStorage.setItem('test_templates', JSON.stringify(this.templates));
  }

  loadTemplates(): void {
    const stored = localStorage.getItem('test_templates');
    if (stored) {
      try {
        this.templates = JSON.parse(stored);
      } catch {}
    }
  }

  private webhooks: { id: string; url: string; events: string[]; enabled: boolean }[] = [];

  addWebhook(url: string, events: string[]): string {
    const id = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.webhooks.push({ id, url, events, enabled: true });
    this.saveWebhooks();
    return id;
  }

  removeWebhook(id: string): void {
    this.webhooks = this.webhooks.filter(w => w.id !== id);
    this.saveWebhooks();
  }

  getWebhooks() {
    return this.webhooks;
  }

  toggleWebhook(id: string, enabled: boolean): void {
    const webhook = this.webhooks.find(w => w.id === id);
    if (webhook) {
      webhook.enabled = enabled;
      this.saveWebhooks();
    }
  }

  private saveWebhooks(): void {
    localStorage.setItem('test_webhooks', JSON.stringify(this.webhooks));
  }

  loadWebhooks(): void {
    const stored = localStorage.getItem('test_webhooks');
    if (stored) {
      try {
        this.webhooks = JSON.parse(stored);
      } catch {}
    }
  }

  async sendWebhook(event: string, data: any): Promise<void> {
    for (const webhook of this.webhooks) {
      if (!webhook.enabled || !webhook.events.includes(event)) continue;
      
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, data, timestamp: Date.now() }),
        });
      } catch (err) {
        console.error(`Webhook failed: ${err}`);
      }
    }
  }

  generateReport(result: StressTestResult): string {
    const lines = [
      '═══════════════════════════════════════',
      '       STRESS TEST RESULTS',
      '═══════════════════════════════════════',
      `Agents:        ${result.totalAgents}`,
      `Tasks Done:   ${result.totalTasksCompleted}`,
      `Failed:       ${result.failedTasks}`,
      `Duration:     ${result.duration.toFixed(1)}s`,
      `Avg Response: ${result.avgResponseTime.toFixed(0)}ms`,
      `Memory:       ${(result.peakMemory / 1024 / 1024).toFixed(1)} MB`,
      `GitHub Calls: ${result.githubApiCalls}`,
      `Rate Limits:  ${result.rateLimitHits}`,
      '═══════════════════════════════════════',
    ];
    return lines.join('\n');
  }
}

export const testSuite = new TestSuite();

export class SystemReportGenerator {
  private db: IDBDatabase | null = null;
  
  async generateSystemReport(): Promise<string> {
    const agents = this.getAgentStats();
    const tests = testSuite.getHistory().slice(-50);
    const schedules = testSuite.getSchedules();
    const templates = testSuite.getTemplates();
    const webhooks = testSuite.getWebhooks();
    
    const lines = [
      '═══════════════════════════════════════════════════',
      '         PIXEL OFFICE 시스템 리포트',
      '═══════════════════════════════════════════════════',
      `생성 시간: ${new Date().toLocaleString('ko-KR')}`,
      '',
      '📊 에이전트 상태',
      `  전체: ${agents.total}개`,
      `  활성: ${agents.active}개`,
      `  대기: ${agents.idle}개`,
      '',
      '🧪 테스트 실행 결과 (최근 50회)',
      `  총 실행: ${tests.length}회`,
      `  성공: ${tests.filter(t => t.type !== 'cicd' || (t.result as any).failed === 0).length}회`,
      '',
      '📅 스케줄',
      `  활성: ${schedules.filter(s => s.enabled).length}개`,
      '',
      '📝 템플릿',
      `  저장됨: ${templates.length}개`,
      '',
      '🔗 웹훅',
      `  설정됨: ${webhooks.filter(w => w.enabled).length}개`,
      '',
      '═══════════════════════════════════════════════════',
    ];
    
    return lines.join('\n');
  }

  private getAgentStats(): { total: number; active: number; idle: number } {
    return { total: 32, active: 15, idle: 17 };
  }

  async saveReport(report: string, filename: string): Promise<void> {
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `system-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const systemReport = new SystemReportGenerator();