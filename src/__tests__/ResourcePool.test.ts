import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ResourcePool', () => {
  let ResourcePool: typeof import('../services/ResourcePool').ResourcePool;
  let pool: import('../services/ResourcePool').ResourcePool;

  beforeEach(async () => {
    vi.resetModules();
    ({ ResourcePool } = await import('../services/ResourcePool'));
    pool = ResourcePool.getInstance();
    pool.clear();
  });

  // regression for fix(services): ResourcePool allows partial allocations up to capacity
  it('allocates partial amounts up to capacity then saturates', () => {
    const res = pool.addResource({ name: 'cpu', type: 'cpu', capacity: 10 });
    const a = pool.allocate({ requesterId: 'r1', resourceType: 'cpu', amount: 3 });
    expect(a).not.toBeNull();
    expect(res.used).toBe(3);
    expect(res.status).toBe('available');

    const b = pool.allocate({ requesterId: 'r2', resourceType: 'cpu', amount: 7 });
    expect(b).not.toBeNull();
    expect(res.used).toBe(10);
    expect(res.status).toBe('in_use');

    // exhausted — should queue not allocate
    const c = pool.allocate({ requesterId: 'r3', resourceType: 'cpu', amount: 1 });
    expect(c).toBeNull();
  });

  // regression for fix(services): ResourcePool.release reopens partially-freed resource
  it('release reopens an in_use resource once it has headroom again', () => {
    const res = pool.addResource({ name: 'cpu', type: 'cpu', capacity: 5 });
    const a = pool.allocate({ requesterId: 'r1', resourceType: 'cpu', amount: 5 });
    expect(res.status).toBe('in_use');
    expect(a).not.toBeNull();
    pool.release(a!.id);
    expect(res.status).toBe('available');
    expect(res.used).toBe(0);
  });

  // regression for fix(services): ResourcePool.allocate rejects non-positive amounts
  it('rejects allocations with amount <= 0', () => {
    const res = pool.addResource({ name: 'cpu', type: 'cpu', capacity: 10 });
    expect(pool.allocate({ requesterId: 'r1', resourceType: 'cpu', amount: 0 })).toBeNull();
    expect(pool.allocate({ requesterId: 'r1', resourceType: 'cpu', amount: -3 })).toBeNull();
    expect(res.used).toBe(0);
  });

  // regression for fix(services): ResourcePool double-queue on processPendingRequests
  it('failed pending allocate is not re-queued multiple times', () => {
    pool.addResource({ name: 'cpu', type: 'cpu', capacity: 1 });
    const a = pool.allocate({ requesterId: 'r1', resourceType: 'cpu', amount: 1 });
    expect(a).not.toBeNull();
    // this should queue once
    pool.allocate({ requesterId: 'r2', resourceType: 'cpu', amount: 1 });
    expect(pool.getPendingRequests().length).toBe(1);
    // release triggers processPendingRequests — the queued request still
    // can't be filled (we re-allocate r1 below would saturate again),
    // and it must not double-queue
    pool.release(a!.id);
    // now r2 should be allocated
    expect(pool.getPendingRequests().length).toBe(0);
  });
});
