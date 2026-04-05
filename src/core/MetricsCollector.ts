export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface MetricSeries {
  name: string;
  points: MetricPoint[];
  tags?: Record<string, string>;
}

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  state: string;
  taskCount: number;
  completedTasks: number;
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
}

export interface SystemMetrics {
  timestamp: number;
  fps: number;
  memory: number;
  activeAgents: number;
  totalAgents: number;
  eventsPerSecond: number;
  networkLatency: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, MetricSeries> = new Map();
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private maxDataPoints = 1000;
  private eventCount = 0;
  private lastEventCount = 0;
  private lastEventTime = 0;

  private constructor() {
    this.lastEventTime = Date.now();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  trackMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { name, points: [], tags });
    }
    const series = this.metrics.get(name)!;
    series.points.push({ timestamp: Date.now(), value });
    if (series.points.length > this.maxDataPoints) {
      series.points.shift();
    }
  }

  updateAgentMetrics(agentId: string, data: Partial<AgentMetrics>): void {
    if (!this.agentMetrics.has(agentId)) {
      this.agentMetrics.set(agentId, {
        agentId,
        agentName: data.agentName || 'Unknown',
        state: 'idle',
        taskCount: 0,
        completedTasks: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        responseTime: 0
      });
    }
    const metrics = this.agentMetrics.get(agentId)!;
    Object.assign(metrics, data);
  }

  recordSystemMetrics(metrics: Omit<SystemMetrics, 'timestamp'>): void {
    this.systemMetrics.push({ ...metrics, timestamp: Date.now() });
    if (this.systemMetrics.length > this.maxDataPoints) {
      this.systemMetrics.shift();
    }
  }

  recordEvent(): void {
    this.eventCount++;
    const now = Date.now();
    if (now - this.lastEventTime >= 1000) {
      const eventsPerSecond = (this.eventCount - this.lastEventCount) * 1000 / (now - this.lastEventTime);
      this.trackMetric('eventsPerSecond', eventsPerSecond);
      this.lastEventCount = this.eventCount;
      this.lastEventTime = now;
    }
  }

  getMetric(name: string): MetricSeries | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): MetricSeries[] {
    return Array.from(this.metrics.values());
  }

  getAgentMetrics(agentId: string): AgentMetrics | undefined {
    return this.agentMetrics.get(agentId);
  }

  getAllAgentMetrics(): AgentMetrics[] {
    return Array.from(this.agentMetrics.values());
  }

  getSystemMetrics(since?: number): SystemMetrics[] {
    if (since) {
      return this.systemMetrics.filter(m => m.timestamp >= since);
    }
    return [...this.systemMetrics];
  }

  getAggregatedStats(name: string): { min: number; max: number; avg: number; count: number } | null {
    const series = this.metrics.get(name);
    if (!series || series.points.length === 0) return null;
    const values = series.points.map(p => p.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    };
  }

  clear(): void {
    this.metrics.clear();
    this.agentMetrics.clear();
    this.systemMetrics = [];
    this.eventCount = 0;
    this.lastEventCount = 0;
  }
}

export const metrics = MetricsCollector.getInstance();