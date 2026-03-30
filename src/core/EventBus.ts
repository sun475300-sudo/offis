import { EventType, GameEvent, IEventBus } from '../types';

type EventHandler<T = unknown> = (event: GameEvent<T>) => void;

export class EventBus implements IEventBus {
  private listeners: Map<EventType, Set<EventHandler<any>>> = new Map();
  private eventLog: GameEvent[] = [];
  private readonly maxLogSize = 500;

  emit<T>(type: EventType, payload: T): void {
    const event: GameEvent<T> = {
      type,
      payload,
      timestamp: performance.now(),
    };

    this.eventLog.push(event as GameEvent);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[EventBus] Error in handler for ${type}:`, err);
        }
      }
    }
  }

  on<T>(type: EventType, handler: EventHandler<T>): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  off<T>(type: EventType, handler: EventHandler<T>): void {
    this.listeners.get(type)?.delete(handler);
  }

  getRecentEvents(count: number = 20): GameEvent[] {
    return this.eventLog.slice(-count);
  }

  clear(): void {
    this.listeners.clear();
    this.eventLog = [];
  }
}
