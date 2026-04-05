export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthMetric {
  name: string;
  value: number;
  threshold: number;
  status: HealthStatus;
}

export interface AgentHealth {
  agentId: string;
  status: HealthStatus;
  metrics: HealthMetric[];
  lastCheck: number;
  uptime: number;
  errorCount: number;
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  enabled: boolean;
  thresholds: Record<string, { warning: number; critical: number }>;
}

export interface HealthAlert {
  id: string;
  agentId: string;
  status: HealthStatus;
  message: string;
  metric?: string;
  timestamp: number;
  acknowledged: boolean;
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private agentHealth: Map<string, AgentHealth> = new Map();
  private config: HealthCheckConfig = {
    interval: 30000,
    timeout: 5000,
    enabled: true,
    thresholds: {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 75, critical: 90 },
      responseTime: { warning: 1000, critical: 5000 },
      errorRate: { warning: 0.1, critical: 0.3 },
      taskQueue: { warning: 50, critical: 100 }
    }
  };
  private alerts: HealthAlert[] = [];
  private checkInterval: number | null = null;
  private listeners: Set<(alert: HealthAlert) => void> = new Set();
  private startTime = Date.now();

  private constructor() {}

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  configure(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  registerAgent(agentId: string): void {
    this.agentHealth.set(agentId, {
      agentId,
      status: 'unknown',
      metrics: [],
      lastCheck: 0,
      uptime: 0,
      errorCount: 0
    });
  }

  unregisterAgent(agentId: string): boolean {
    return this.agentHealth.delete(agentId);
  }

  updateMetrics(agentId: string, metrics: Record<string, number>): void {
    let health = this.agentHealth.get(agentId);
    if (!health) {
      this.registerAgent(agentId);
      health = this.agentHealth.get(agentId)!;
    }

    const healthMetrics: HealthMetric[] = [];
    let hasWarning = false;
    let hasCritical = false;

    for (const [name, value] of Object.entries(metrics)) {
      const threshold = this.config.thresholds[name];
      if (!threshold) continue;

      let status: HealthStatus = 'healthy';
      if (value >= threshold.critical) {
        status = 'unhealthy';
        hasCritical = true;
      } else if (value >= threshold.warning) {
        status = 'degraded';
        hasWarning = true;
      }

      healthMetrics.push({ name, value, threshold: threshold.critical, status });
    }

    health.metrics = healthMetrics;
    health.status = hasCritical ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';
    health.lastCheck = Date.now();
    health.uptime = Date.now() - this.startTime;
  }

  recordError(agentId: string): void {
    const health = this.agentHealth.get(agentId);
    if (health) {
      health.errorCount++;
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }
  }

  checkHealth(agentId: string): AgentHealth | null {
    return this.agentHealth.get(agentId) || null;
  }

  getAllHealth(): AgentHealth[] {
    return Array.from(this.agentHealth.values());
  }

  getUnhealthyAgents(): AgentHealth[] {
    return Array.from(this.agentHealth.values())
      .filter(h => h.status === 'unhealthy');
  }

  getSystemHealth(): HealthStatus {
    const healths = Array.from(this.agentHealth.values());
    if (healths.length === 0) return 'unknown';

    const unhealthy = healths.filter(h => h.status === 'unhealthy').length;
    const degraded = healths.filter(h => h.status === 'degraded').length;

    if (unhealthy > 0) return 'unhealthy';
    if (degraded > 0) return 'degraded';
    return 'healthy';
  }

  startMonitoring(): void {
    if (this.checkInterval) return;
    this.config.enabled = true;
    this.checkInterval = window.setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.config.enabled = false;
  }

  private performHealthCheck(): void {
    for (const [agentId, health] of this.agentHealth) {
      if (health.status === 'unhealthy' || health.status === 'degraded') {
        this.createAlert(agentId, health.status, `Agent ${agentId} is ${health.status}`);
      }
    }
  }

  private createAlert(agentId: string, status: HealthStatus, message: string): void {
    const alert: HealthAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId,
      status,
      message,
      timestamp: Date.now(),
      acknowledged: false
    };
    this.alerts.push(alert);
    this.notifyListeners(alert);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  getAlerts(acknowledged?: boolean, limit = 50): HealthAlert[] {
    let alerts = this.alerts;
    if (acknowledged !== undefined) {
      alerts = alerts.filter(a => a.acknowledged === acknowledged);
    }
    return alerts.slice(-limit);
  }

  subscribe(listener: (alert: HealthAlert) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(alert: HealthAlert): void {
    for (const listener of this.listeners) {
      listener(alert);
    }
  }

  getStats(): { totalAgents: number; healthy: number; degraded: number; unhealthy: number; alerts: number } {
    const stats = { totalAgents: this.agentHealth.size, healthy: 0, degraded: 0, unhealthy: 0, alerts: this.alerts.length };
    for (const health of this.agentHealth.values()) {
      if (health.status !== 'unknown') {
        stats[health.status]++;
      }
    }
    return stats;
  }

  clear(): void {
    this.agentHealth.clear();
    this.alerts = [];
  }
}

export const healthMonitor = HealthMonitor.getInstance();