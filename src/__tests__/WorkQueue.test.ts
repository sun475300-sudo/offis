import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WorkQueue', () => {
  let WorkQueue: typeof import('../services/WorkQueue').WorkQueue;
  let queue: import('../services/WorkQueue').WorkQueue;

  beforeEach(async () => {
    vi.resetModules();
    ({ WorkQueue } = await import('../services/WorkQueue'));
    queue = WorkQueue.getInstance();
    queue.clear();
  });

  it('enqueue + peek + dequeue order by priority', () => {
    queue.enqueue('low', { v: 1 }, { priority: 'low' });
    queue.enqueue('crit', { v: 2 }, { priority: 'critical' });
    queue.enqueue('mid', { v: 3 }, { priority: 'normal' });
    // peek should be highest priority
    expect(queue.peek()?.type).toBe('crit');
  });

  // regression for fix(services): WorkQueue.requeue use-after-splice
  it('requeue captures the work item before splicing (no array drift)', () => {
    queue.enqueue('a', { v: 1 });
    const b = queue.enqueue('b', { v: 2 });
    queue.enqueue('c', { v: 3 });
    // requeue the middle item — should re-enqueue with the original
    // (b) payload, NOT the item that shifted into b's slot after the
    // splice. The previous (buggy) impl read this.queue[workIndex]
    // AFTER splice and re-enqueued whatever shifted in.
    const ok = queue.requeue(b.id);
    expect(ok).toBe(true);
    const byType = queue.getByType('b');
    expect(byType.length).toBe(1);
    expect((byType[0].payload as { v: number }).v).toBe(2);
    // and 'a' / 'c' are still present exactly once
    expect(queue.getByType('a').length).toBe(1);
    expect(queue.getByType('c').length).toBe(1);
  });

  it('remove drops the item by id', () => {
    const w = queue.enqueue('x', { v: 1 });
    expect(queue.remove(w.id)).toBe(true);
    expect(queue.getById(w.id)).toBeNull();
  });
});
