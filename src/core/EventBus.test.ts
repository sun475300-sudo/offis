import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from './EventBus';
import { EventType, GameEvent } from '../types';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should call handler when event is emitted', () => {
    const handler = vi.fn();
    bus.on(EventType.TaskCompleted, handler);
    bus.emit(EventType.TaskCompleted, { taskId: 't1' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventType.TaskCompleted,
        payload: { taskId: 't1' },
      }),
    );
  });

  it('should support multiple handlers for the same event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on(EventType.AgentArrived, h1);
    bus.on(EventType.AgentArrived, h2);
    bus.emit(EventType.AgentArrived, { agentId: 'a1' });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('should not call handler after off()', () => {
    const handler = vi.fn();
    bus.on(EventType.TaskFailed, handler);
    bus.off(EventType.TaskFailed, handler);
    bus.emit(EventType.TaskFailed, { taskId: 't1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not call handlers for different event types', () => {
    const handler = vi.fn();
    bus.on(EventType.TaskCompleted, handler);
    bus.emit(EventType.TaskFailed, { taskId: 't1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should record events in the event log', () => {
    bus.emit(EventType.TaskCompleted, { taskId: 't1' });
    bus.emit(EventType.TaskFailed, { taskId: 't2' });

    const log = bus.getRecentEvents(10);
    expect(log).toHaveLength(2);
    expect(log[0].type).toBe(EventType.TaskCompleted);
    expect(log[1].type).toBe(EventType.TaskFailed);
  });

  it('should limit event log via getRecentEvents count', () => {
    for (let i = 0; i < 10; i++) {
      bus.emit(EventType.TickUpdate, { tick: i });
    }

    const recent = bus.getRecentEvents(3);
    expect(recent).toHaveLength(3);
    expect((recent[0].payload as { tick: number }).tick).toBe(7);
  });

  it('should include timestamp on emitted events', () => {
    bus.emit(EventType.TaskCompleted, {});
    const log = bus.getRecentEvents(1);
    expect(log[0].timestamp).toBeTypeOf('number');
    expect(log[0].timestamp).toBeGreaterThan(0);
  });

  it('should clear all listeners and log', () => {
    const handler = vi.fn();
    bus.on(EventType.TaskCompleted, handler);
    bus.emit(EventType.TaskCompleted, {});

    // Before clear: 1 event in log, handler called once
    expect(bus.getRecentEvents(10)).toHaveLength(1);
    expect(handler).toHaveBeenCalledOnce();

    bus.clear();

    // Log should be empty after clear
    expect(bus.getRecentEvents(10)).toHaveLength(0);

    // Emit again — handler should NOT fire (listeners cleared)
    bus.emit(EventType.TaskCompleted, {});
    expect(handler).toHaveBeenCalledOnce();

    // But the new emit still records to the fresh log
    expect(bus.getRecentEvents(10)).toHaveLength(1);
  });

  it('should not throw when handler errors', () => {
    const badHandler = () => {
      throw new Error('oops');
    };
    const goodHandler = vi.fn();
    bus.on(EventType.TaskCompleted, badHandler);
    bus.on(EventType.TaskCompleted, goodHandler);

    expect(() => bus.emit(EventType.TaskCompleted, {})).not.toThrow();
    expect(goodHandler).toHaveBeenCalledOnce();
  });
});
