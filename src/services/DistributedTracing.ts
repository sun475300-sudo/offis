export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export type SpanStatus = 'ok' | 'error' | 'unset';

export interface TraceSpan {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatus;
  error?: string;
  tags: Record<string, string>;
  logs: SpanLog[];
}

export interface SpanLog {
  timestamp: number;
  message: string;
  fields?: Record<string, unknown>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

export class DistributedTracing {
  private static instance: DistributedTracing;
  private spans: Map<string, TraceSpan> = new Map();
  private currentTrace: TraceContext | null = null;
  private maxSpans = 5000;
  private listeners: Set<(span: TraceSpan) => void> = new Set();

  private constructor() {}

  static getInstance(): DistributedTracing {
    if (!DistributedTracing.instance) {
      DistributedTracing.instance = new DistributedTracing();
    }
    return DistributedTracing.instance;
  }

  createTrace(): TraceContext {
    const traceId = this.generateId();
    const spanId = this.generateId();
    this.currentTrace = { traceId, spanId, sampled: Math.random() > 0.1 };
    return this.currentTrace;
  }

  private generateId(): string {
    return `${Date.now().toString(16)}-${Math.random().toString(16).substr(2, 16)}`;
  }

  startSpan(name: string, kind: SpanKind = 'internal', parentId?: string): TraceSpan {
    const traceId = this.currentTrace?.traceId || this.createTrace().traceId;
    const spanId = this.generateId();

    const span: TraceSpan = {
      id: spanId,
      traceId,
      parentId: parentId || this.currentTrace?.spanId,
      name,
      kind,
      startTime: Date.now(),
      status: 'unset',
      tags: {},
      logs: []
    };

    this.spans.set(spanId, span);
    this.pruneSpans();
    return span;
  }

  endSpan(spanId: string, status: SpanStatus = 'ok', error?: string): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    if (error) {
      span.error = error;
      span.status = 'error';
    }

    this.notifyListeners(span);
  }

  addTag(spanId: string, key: string, value: string): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  addLog(spanId: string, message: string, fields?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        fields
      });
    }
  }

  getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  getTrace(traceId: string): TraceSpan[] {
    return Array.from(this.spans.values())
      .filter(s => s.traceId === traceId);
  }

  getCurrentTrace(): TraceContext | null {
    return this.currentTrace;
  }

  injectContext(): Record<string, string> {
    if (!this.currentTrace) return {};
    return {
      'x-trace-id': this.currentTrace.traceId,
      'x-span-id': this.currentTrace.spanId,
      'x-sampled': String(this.currentTrace.sampled)
    };
  }

  extractContext(headers: Record<string, string>): TraceContext | null {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const sampled = headers['x-sampled'] !== 'false';

    if (traceId && spanId) {
      this.currentTrace = { traceId, spanId, sampled };
      return this.currentTrace;
    }
    return null;
  }

  private pruneSpans(): void {
    if (this.spans.size > this.maxSpans) {
      const sorted = Array.from(this.spans.values())
        .sort((a, b) => a.startTime - b.startTime);
      // Snapshot the eviction count; the previous loop bound decreased as
      // we deleted, so only half the targeted entries were removed.
      const toRemove = this.spans.size - this.maxSpans;
      for (let i = 0; i < toRemove; i++) {
        this.spans.delete(sorted[i].id);
      }
    }
  }

  subscribe(listener: (span: TraceSpan) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(span: TraceSpan): void {
    for (const listener of this.listeners) {
      listener(span);
    }
  }

  getStats(): { totalSpans: number; byKind: Record<SpanKind, number>; errors: number; avgDuration: number } {
    const stats = { totalSpans: this.spans.size, byKind: {} as Record<SpanKind, number>, errors: 0, avgDuration: 0 };
    let totalDuration = 0;
    let withDuration = 0;

    for (const span of this.spans.values()) {
      stats.byKind[span.kind] = (stats.byKind[span.kind] || 0) + 1;
      if (span.status === 'error') stats.errors++;
      if (span.duration) {
        totalDuration += span.duration;
        withDuration++;
      }
    }

    stats.avgDuration = withDuration > 0 ? totalDuration / withDuration : 0;
    return stats;
  }

  export(): string {
    return JSON.stringify(Array.from(this.spans.values()), null, 2);
  }

  clear(): void {
    this.spans.clear();
    this.currentTrace = null;
  }
}

export const distributedTracing = DistributedTracing.getInstance();