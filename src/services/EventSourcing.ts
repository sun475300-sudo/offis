export interface Event {
  id: string;
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: number;
  version: number;
}

export interface Aggregate {
  id: string;
  type: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  state: Record<string, unknown>;
}

export interface EventSourcingConfig {
  maxEventsPerAggregate: number;
  snapshotInterval: number;
  replayEnabled: boolean;
}

export class EventSourcing {
  private static instance: EventSourcing;
  private events: Map<string, Event[]> = new Map();
  private aggregates: Map<string, Aggregate> = new Map();
  private config: EventSourcingConfig = {
    maxEventsPerAggregate: 500,
    snapshotInterval: 10,
    replayEnabled: true
  };
  private handlers: Map<string, (aggregate: Aggregate, event: Event) => Aggregate> = new Map();
  private listeners: Set<(event: Event) => void> = new Set();

  private constructor() {}

  static getInstance(): EventSourcing {
    if (!EventSourcing.instance) {
      EventSourcing.instance = new EventSourcing();
    }
    return EventSourcing.instance;
  }

  configure(config: Partial<EventSourcingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  registerHandler(type: string, handler: (aggregate: Aggregate, event: Event) => Aggregate): void {
    this.handlers.set(type, handler);
  }

  createAggregate(id: string, type: string, initialState: Record<string, unknown> = {}): Aggregate {
    const aggregate: Aggregate = {
      id,
      type,
      version: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: initialState
    };
    this.aggregates.set(id, aggregate);
    return aggregate;
  }

  emit(type: string, aggregateId: string, payload: Record<string, unknown>, metadata: Record<string, unknown> = {}): Event {
    const aggregate = this.aggregates.get(aggregateId);
    if (!aggregate) {
      throw new Error(`Aggregate ${aggregateId} not found`);
    }

    const event: Event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      aggregateId,
      payload,
      metadata,
      timestamp: Date.now(),
      version: aggregate.version + 1
    };

    if (!this.events.has(aggregateId)) {
      this.events.set(aggregateId, []);
    }

    const events = this.events.get(aggregateId)!;
    events.push(event);

    if (this.handlers.has(type)) {
      const handler = this.handlers.get(type)!;
      const updated = handler(aggregate, event);
      this.aggregates.set(aggregateId, updated);
    }

    this.pruneEvents(aggregateId);
    this.notifyListeners(event);
    return event;
  }

  getEvents(aggregateId: string): Event[] {
    return [...(this.events.get(aggregateId) || [])];
  }

  getEventCount(aggregateId: string): number {
    return this.events.get(aggregateId)?.length || 0;
  }

  async replay(aggregateId: string): Promise<Aggregate> {
    const events = this.events.get(aggregateId) || [];
    if (events.length === 0) {
      return this.aggregates.get(aggregateId)!;
    }

    const firstEvent = events[0];
    let aggregate: Aggregate = {
      id: aggregateId,
      type: firstEvent.type,
      version: 0,
      createdAt: firstEvent.timestamp,
      updatedAt: firstEvent.timestamp,
      state: {}
    };

    for (const event of events) {
      if (this.handlers.has(event.type)) {
        const handler = this.handlers.get(event.type)!;
        aggregate = handler(aggregate, event);
      }
    }

    this.aggregates.set(aggregateId, aggregate);
    return aggregate;
  }

  getAggregate(aggregateId: string): Aggregate | undefined {
    return this.aggregates.get(aggregateId);
  }

  deleteAggregate(aggregateId: string): boolean {
    this.aggregates.delete(aggregateId);
    return this.events.delete(aggregateId);
  }

  private pruneEvents(aggregateId: string): void {
    const events = this.events.get(aggregateId);
    if (!events) return;

    if (events.length > this.config.maxEventsPerAggregate) {
      const snapshots = Math.floor(events.length / this.config.snapshotInterval);
      const toRemove = snapshots * this.config.snapshotInterval - this.config.snapshotInterval;
      if (toRemove > 0) {
        events.splice(0, toRemove);
      }
    }
  }

  subscribe(listener: (event: Event) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: Event): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  queryEvents(since?: number, type?: string): Event[] {
    let allEvents: Event[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events);
    }

    if (since) {
      allEvents = allEvents.filter(e => e.timestamp >= since);
    }
    if (type) {
      allEvents = allEvents.filter(e => e.type === type);
    }

    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  getStats(): { aggregates: number; totalEvents: number; handlers: number } {
    let totalEvents = 0;
    for (const events of this.events.values()) {
      totalEvents += events.length;
    }
    return {
      aggregates: this.aggregates.size,
      totalEvents,
      handlers: this.handlers.size
    };
  }

  export(): string {
    return JSON.stringify({
      aggregates: Array.from(this.aggregates.entries()),
      events: Array.from(this.events.entries())
    }, null, 2);
  }

  clear(): void {
    this.events.clear();
    this.aggregates.clear();
  }
}

export const eventSourcing = EventSourcing.getInstance();