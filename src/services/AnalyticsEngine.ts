export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

export interface AnalyticsMetric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface TimeSeries {
  name: string;
  points: TimeSeriesPoint[];
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface AnalyticsReport {
  id: string;
  title: string;
  metrics: Record<string, number>;
  timeRange: { start: number; end: number };
  generatedAt: number;
}

export interface DashboardConfig {
  refreshInterval: number;
  retentionPeriod: number;
  maxDataPoints: number;
}

export class AnalyticsEngine {
  private static instance: AnalyticsEngine;
  private metrics: Map<string, AnalyticsMetric[]> = new Map();
  private config: DashboardConfig = {
    refreshInterval: 5000,
    retentionPeriod: 3600000,
    maxDataPoints: 1000
  };
  private reportListeners: Set<(report: AnalyticsReport) => void> = new Set();

  private constructor() {}

  static getInstance(): AnalyticsEngine {
    if (!AnalyticsEngine.instance) {
      AnalyticsEngine.instance = new AnalyticsEngine();
    }
    return AnalyticsEngine.instance;
  }

  configure(config: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  record(metric: Omit<AnalyticsMetric, 'timestamp'>): void {
    const entry: AnalyticsMetric = { ...metric, timestamp: Date.now() };
    
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }
    
    const entries = this.metrics.get(metric.name)!;
    entries.push(entry);
    this.pruneMetrics(metric.name);
  }

  increment(name: string, value = 1, tags?: Record<string, string>): void {
    this.record({ name, type: 'counter', value, tags });
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record({ name, type: 'gauge', value, tags });
  }

  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.record({ name, type: 'timer', value: duration, tags });
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.record({ name, type: 'histogram', value, tags });
  }

  private pruneMetrics(name: string): void {
    const entries = this.metrics.get(name);
    if (!entries) return;

    const cutoff = Date.now() - this.config.retentionPeriod;
    const valid = entries.filter(e => e.timestamp > cutoff);
    // Always write back the filtered set; previously expired entries
    // were only removed when the array also exceeded maxDataPoints, so
    // low-rate metrics held stale data forever.
    const trimmed = valid.length > this.config.maxDataPoints
      ? valid.slice(-this.config.maxDataPoints)
      : valid;
    this.metrics.set(name, trimmed);
  }

  getMetric(name: string, since?: number): AnalyticsMetric[] {
    const entries = this.metrics.get(name) || [];
    if (since) {
      return entries.filter(e => e.timestamp >= since);
    }
    return [...entries];
  }

  getTimeSeries(name: string, interval: number, aggregation: TimeSeries['aggregation'] = 'avg'): TimeSeries {
    const entries = this.getMetric(name);
    if (entries.length === 0) {
      return { name, points: [], aggregation };
    }

    const minTime = Math.min(...entries.map(e => e.timestamp));
    const maxTime = Math.max(...entries.map(e => e.timestamp));
    const buckets = Math.ceil((maxTime - minTime) / interval);

    const points: TimeSeriesPoint[] = [];
    
    for (let i = 0; i < buckets; i++) {
      const bucketStart = minTime + (i * interval);
      const bucketEnd = bucketStart + interval;
      const bucketValues = entries
        .filter(e => e.timestamp >= bucketStart && e.timestamp < bucketEnd)
        .map(e => e.value);

      if (bucketValues.length === 0) continue;

      let value: number;
      switch (aggregation) {
        case 'sum':
          value = bucketValues.reduce((a, b) => a + b, 0);
          break;
        case 'min':
          value = Math.min(...bucketValues);
          break;
        case 'max':
          value = Math.max(...bucketValues);
          break;
        case 'count':
          value = bucketValues.length;
          break;
        default:
          value = bucketValues.reduce((a, b) => a + b, 0) / bucketValues.length;
      }

      points.push({ timestamp: bucketStart, value });
    }

    return { name, points, aggregation };
  }

  getSummary(name: string): { count: number; sum: number; avg: number; min: number; max: number } | null {
    const entries = this.getMetric(name);
    if (entries.length === 0) return null;

    const values = entries.map(e => e.value);
    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  generateReport(title: string, metricNames: string[], timeRange: { start: number; end: number }): AnalyticsReport {
    const metrics: Record<string, number> = {};
    
    for (const name of metricNames) {
      const summary = this.getSummary(name);
      if (summary) {
        metrics[`${name}_avg`] = summary.avg;
        metrics[`${name}_count`] = summary.count;
        metrics[`${name}_max`] = summary.max;
      }
    }

    return {
      id: `report-${Date.now()}`,
      title,
      metrics,
      timeRange,
      generatedAt: Date.now()
    };
  }

  subscribe(listener: (report: AnalyticsReport) => void): () => void {
    this.reportListeners.add(listener);
    return () => this.reportListeners.delete(listener);
  }

  getAllMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  getStats(): { totalMetrics: number; totalDataPoints: number; retentionPeriod: number } {
    let totalPoints = 0;
    for (const entries of this.metrics.values()) {
      totalPoints += entries.length;
    }
    return {
      totalMetrics: this.metrics.size,
      totalDataPoints: totalPoints,
      retentionPeriod: this.config.retentionPeriod
    };
  }

  clear(): void {
    this.metrics.clear();
  }

  export(): string {
    return JSON.stringify({
      config: this.config,
      metrics: Object.fromEntries(this.metrics)
    }, null, 2);
  }
}

export const analyticsEngine = AnalyticsEngine.getInstance();