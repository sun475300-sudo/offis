import { describe, it, expect } from 'vitest';
import { SpatialHash } from '../spatial/SpatialHash';
import type { AgentSnapshot } from '../types';
import { AgentRole, AgentState } from '../types';

function makeAgent(id: string, x: number, y: number): AgentSnapshot {
  return {
    id,
    name: id,
    role: AgentRole.Frontend,
    state: AgentState.Idle,
    position: { x, y },
    gridCell: { col: Math.floor(x / 32), row: Math.floor(y / 32) },
    currentTask: null,
    progress: 0,
    path: [],
  };
}

describe('SpatialHash', () => {
  it('queryRadius returns agents inside radius', () => {
    const hash = new SpatialHash(64);
    hash.rebuild([
      makeAgent('a', 0, 0),
      makeAgent('b', 30, 0),
      makeAgent('c', 100, 100),
    ]);
    const near = hash.queryRadius({ x: 0, y: 0 }, 40);
    const ids = near.map(a => a.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('queryRadius excludes agents past radius even when same bucket', () => {
    const hash = new SpatialHash(64);
    hash.rebuild([makeAgent('a', 0, 0), makeAgent('b', 60, 0)]);
    const near = hash.queryRadius({ x: 0, y: 0 }, 30);
    expect(near.map(a => a.id)).toEqual(['a']);
  });

  it('rebuild clears prior buckets', () => {
    const hash = new SpatialHash(64);
    hash.rebuild([makeAgent('a', 0, 0)]);
    hash.rebuild([makeAgent('b', 1000, 1000)]);
    expect(hash.queryRadius({ x: 0, y: 0 }, 100).map(a => a.id)).toEqual([]);
    expect(hash.queryRadius({ x: 1000, y: 1000 }, 100).map(a => a.id)).toEqual(['b']);
  });

  it('queryRadius spans neighboring buckets', () => {
    const hash = new SpatialHash(64);
    // place agents in different 64px buckets that should both fall in
    // a 100-radius query.
    hash.rebuild([makeAgent('a', 30, 30), makeAgent('b', 90, 30)]);
    const near = hash.queryRadius({ x: 60, y: 30 }, 80);
    expect(near.map(a => a.id).sort()).toEqual(['a', 'b']);
  });

  it('queryRadius returns empty when no agents', () => {
    const hash = new SpatialHash(64);
    hash.rebuild([]);
    expect(hash.queryRadius({ x: 0, y: 0 }, 100)).toEqual([]);
  });
});
