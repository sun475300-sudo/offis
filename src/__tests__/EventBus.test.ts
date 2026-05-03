import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../core/EventBus';
import { EventType } from '../types';

// performance.now() 폴리필 (Node 환경)
global.performance = { now: () => Date.now() } as any;

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('이벤트를 emit하고 handler가 호출된다', () => {
    const handler = vi.fn();
    bus.on(EventType.TaskCompleted, handler);
    bus.emit(EventType.TaskCompleted, { taskId: 't1', agentId: 'a1' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].payload).toEqual({ taskId: 't1', agentId: 'a1' });
  });

  it('여러 handler가 동일 이벤트를 수신한다', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on(EventType.TaskAssigned, h1);
    bus.on(EventType.TaskAssigned, h2);
    bus.emit(EventType.TaskAssigned, { taskId: 't2' });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('off()로 handler를 제거한다', () => {
    const handler = vi.fn();
    bus.on(EventType.TaskFailed, handler);
    bus.off(EventType.TaskFailed, handler);
    bus.emit(EventType.TaskFailed, { taskId: 't3' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('다른 타입 이벤트는 수신하지 않는다', () => {
    const handler = vi.fn();
    bus.on(EventType.TaskCompleted, handler);
    bus.emit(EventType.TaskFailed, { taskId: 't4' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('getRecentEvents()가 최근 이벤트를 반환한다', () => {
    bus.emit(EventType.CommandReceived, { prompt: 'test1' });
    bus.emit(EventType.CommandReceived, { prompt: 'test2' });
    bus.emit(EventType.CommandReceived, { prompt: 'test3' });
    const recent = bus.getRecentEvents(2);
    expect(recent).toHaveLength(2);
    expect((recent[1].payload as any).prompt).toBe('test3');
  });

  it('handler 예외가 다른 handler 실행을 막지 않는다', () => {
    const badHandler = vi.fn(() => { throw new Error('crash'); });
    const goodHandler = vi.fn();
    bus.on(EventType.TasksParsed, badHandler);
    bus.on(EventType.TasksParsed, goodHandler);
    expect(() => bus.emit(EventType.TasksParsed, {})).not.toThrow();
    expect(goodHandler).toHaveBeenCalledOnce();
  });

  it('clear() 후 handler가 더 이상 호출되지 않는다', () => {
    const handler = vi.fn();
    bus.on(EventType.TaskCompleted, handler);
    bus.clear();
    bus.emit(EventType.TaskCompleted, { taskId: 't5' });
    expect(handler).not.toHaveBeenCalled();
  });
});
