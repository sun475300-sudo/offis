export interface ProfilerSample {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface ProfilerStats {
  name: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private samples: ProfilerSample[] = [];
  private activeTimers: Map<string, number> = new Map();
  private maxSamples = 10000;
  private enabled = true;

  private constructor() {}

  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  startTimer(name: string): void {
    if (!this.enabled) return;
    this.activeTimers.set(name, Date.now());
  }

  endTimer(name: string, metadata?: Record<string, unknown>): number {
    if (!this.enabled) return 0;
    const startTime = this.activeTimers.get(name);
    if (!startTime) return 0;

    const endTime = Date.now();
    const duration = endTime - startTime;

    const sample: ProfilerSample = {
      name,
      startTime,
      endTime,
      duration,
      metadata
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    this.activeTimers.delete(name);
    return duration;
  }

  profile<T>(name: string, fn: () => T): T {
    // Use a unique internal key per call so nested/concurrent calls
    // under the same public name don't overwrite each other's start
    // timestamp. We rewrite sample.name to the original for stats.
    const internalName = `${name}::${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.startTimer(internalName);
    try {
      return fn();
    } finally {
      this.endTimerAs(internalName, name);
    }
  }

  async profileAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const internalName = `${name}::${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.startTimer(internalName);
    try {
      return await fn();
    } finally {
      this.endTimerAs(internalName, name);
    }
  }

  private endTimerAs(internalName: string, reportedName: string): number {
    if (!this.enabled) return 0;
    const startTime = this.activeTimers.get(internalName);
    if (!startTime) return 0;
    const endTime = Date.now();
    const duration = endTime - startTime;
    this.samples.push({ name: reportedName, startTime, endTime, duration });
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    this.activeTimers.delete(internalName);
    return duration;
  }

  getStats(name?: string): ProfilerStats[] {
    const samples = name ? this.samples.filter(s => s.name === name) : this.samples;
    const statsMap = new Map<string, ProfilerStats>();

    for (const sample of samples) {
      if (!statsMap.has(sample.name)) {
        statsMap.set(sample.name, {
          name: sample.name,
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0
        });
      }

      const stats = statsMap.get(sample.name)!;
      stats.count++;
      stats.totalDuration += sample.duration;
      stats.minDuration = Math.min(stats.minDuration, sample.duration);
      stats.maxDuration = Math.max(stats.maxDuration, sample.duration);
    }

    const statsArray = Array.from(statsMap.values());
    for (const stats of statsArray) {
      stats.avgDuration = stats.totalDuration / stats.count;
      if (stats.minDuration === Infinity) stats.minDuration = 0;
    }

    return statsArray.sort((a, b) => b.totalDuration - a.totalDuration);
  }

  getBottlenecks(threshold = 100): ProfilerStats[] {
    return this.getStats().filter(s => s.avgDuration > threshold);
  }

  getSamples(name?: string, limit = 100): ProfilerSample[] {
    let samples = name ? this.samples.filter(s => s.name === name) : this.samples;
    return samples.slice(-limit).sort((a, b) => b.startTime - a.startTime);
  }

  clear(): void {
    this.samples = [];
    this.activeTimers.clear();
  }

  export(): string {
    return JSON.stringify({
      samples: this.samples,
      stats: this.getStats(),
      bottlenecks: this.getBottlenecks()
    }, null, 2);
  }

  getMemoryUsage(): { used: number; total: number } {
    const perf = window.performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } };
    if (perf.memory) {
      const mem = perf.memory;
      return { used: mem.usedJSHeapSize, total: mem.totalJSHeapSize };
    }
    return { used: 0, total: 0 };
  }
}

export const profiler = PerformanceProfiler.getInstance();