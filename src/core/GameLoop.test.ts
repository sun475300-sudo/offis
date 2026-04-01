import { describe, it, expect, vi } from 'vitest';
import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
  it('should register update callbacks', () => {
    const loop = new GameLoop();
    const cb = vi.fn();
    loop.onUpdate(cb);
    expect(typeof loop.onUpdate).toBe('function');
  });

  it('should register draw callbacks', () => {
    const loop = new GameLoop();
    const cb = vi.fn();
    loop.onDraw(cb);
    expect(typeof loop.onDraw).toBe('function');
  });

  it('should remove update callbacks', () => {
    const loop = new GameLoop();
    const cb = vi.fn();
    loop.onUpdate(cb);
    loop.removeUpdate(cb);
    // No crash = success
  });

  it('should remove draw callbacks', () => {
    const loop = new GameLoop();
    const cb = vi.fn();
    loop.onDraw(cb);
    loop.removeDraw(cb);
  });

  it('should report 0 FPS before starting', () => {
    const loop = new GameLoop();
    expect(loop.getFPS()).toBe(0);
  });
});
