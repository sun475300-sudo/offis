export type TelemetryEventType = 'metric' | 'log' | 'trace' | 'event';

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  name: string;
  timestamp: number;
  payload: Record<string, unknown>;
  source: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
}

export interface TelemetryConfig {
  enabled: boolean;
  batchSize: number;
  flushInterval: number;
  maxBufferSize: number;
  levels: Set<string>;
}

export class Telemetry {
  private static instance: Telemetry;
  private buffer: TelemetryEvent[] = [];
  private config: TelemetryConfig = {
    enabled: true,
    batchSize: 50,
    flushInterval: 5000,
    maxBufferSize: 1000,
    levels: new Set(['info', 'warn', 'error'])
  };
  private flushInterval: number | null = null;
  private listeners: Set<(events: TelemetryEvent[]) => void> = new Set();
  private exporters: Set<(events: TelemetryEvent[]) => Promise<void>> = new Set();

  private constructor() {
    this.startAutoFlush();
  }

  static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  configure(config: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.flushInterval !== undefined) {
      this.startAutoFlush();
    }
  }

  private startAutoFlush(): void {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flushInterval = window.setInterval(() => this.flush(), this.config.flushInterval);
  }

  emit(type: TelemetryEventType, name: string, payload: Record<string, unknown>, source = 'system', level?: TelemetryEvent['level']): void {
    if (!this.config.enabled) return;
    if (level && !this.config.levels.has(level)) return;

    const event: TelemetryEvent = {
      id: `tel-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      name,
      timestamp: Date.now(),
      payload,
      source,
      level: level || 'info'
    };

    this.buffer.push(event);
    this.pruneBuffer();
  }

  metric(name: string, value: number, tags?: Record<string, string>): void {
    this.emit('metric', name, { value, tags: tags || {} });
  }

  log(name: string, message: string, level: TelemetryEvent['level'] = 'info'): void {
    this.emit('log', name, { message, level });
  }

  event(name: string, payload?: Record<string, unknown>): void {
    this.emit('event', name, payload || {});
  }

  trace(name: string, traceId: string, spanId: string): void {
    this.emit('trace', name, { traceId, spanId });
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0, this.config.batchSize);
    
    for (const exporter of this.exporters) {
      try {
        await exporter(events);
      } catch (e) {
        console.error('[Telemetry] Export failed:', e);
      }
    }

    this.notifyListeners(events);
  }

  addExporter(exporter: (events: TelemetryEvent[]) => Promise<void>): void {
    this.exporters.add(exporter);
  }

  removeExporter(exporter: (events: TelemetryEvent[]) => Promise<void>): boolean {
    return this.exporters.delete(exporter);
  }

  private pruneBuffer(): void {
    if (this.buffer.length > this.config.maxBufferSize) {
      this.buffer.splice(0, this.buffer.length - this.config.maxBufferSize);
    }
  }

  subscribe(listener: (events: TelemetryEvent[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(events: TelemetryEvent[]): void {
    for (const listener of this.listeners) {
      listener(events);
    }
  }

  getBuffer(): TelemetryEvent[] {
    return [...this.buffer];
  }

  getStats(): { buffered: number; exporters: number; enabled: boolean } {
    return {
      buffered: this.buffer.length,
      exporters: this.exporters.size,
      enabled: this.config.enabled
    };
  }

  enable(): void {
    this.config.enabled = true;
  }

  disable(): void {
    this.config.enabled = false;
  }

  clear(): void {
    this.buffer = [];
  }
}

export const telemetry = Telemetry.getInstance();