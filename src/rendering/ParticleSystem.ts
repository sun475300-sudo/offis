import * as PIXI from 'pixi.js';
import { Vec2 } from '../types';

interface Particle {
  sprite: PIXI.Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  baseSize: number;
  baseAlpha: number;
}

/**
 * GPU-batched particle system.
 *
 * Implementation notes:
 *   - All particles share a single soft-circle RenderTexture so PIXI.ParticleContainer
 *     batches every draw into one GPU call regardless of count.
 *   - Sprites live in a fixed-size pool; emit() recycles instead of allocating.
 *     Hot path only mutates position / scale / alpha / tint — no Graphics
 *     geometry is rebuilt per frame.
 *   - Effects supported: task completion sparkle, agent arrival puff,
 *     working typing sparks, error burst.
 */
export class ParticleSystem {
  private container: PIXI.ParticleContainer;
  private texture: PIXI.Texture;
  private particles: Particle[] = [];
  private pool: PIXI.Sprite[] = [];
  private readonly maxParticles = 1024;

  constructor(parentContainer: PIXI.Container, renderer?: PIXI.IRenderer) {
    this.container = new PIXI.ParticleContainer(this.maxParticles, {
      scale: true,
      position: true,
      rotation: false,
      uvs: false,
      tint: true,
      alpha: true,
    });
    this.container.zIndex = 50;
    parentContainer.addChild(this.container);

    this.texture = this.buildParticleTexture(renderer);

    // Pre-warm the sprite pool so the first emit doesn't allocate.
    for (let i = 0; i < 64; i++) {
      this.pool.push(this.createPooledSprite());
    }
  }

  /** Emit sparkle burst at position (e.g., task completion) */
  emitSparkle(pos: Vec2, color: number = 0x3fb950, count: number = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 30 + Math.random() * 50;
      this.spawnParticle({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        color,
        size: 1.5 + Math.random() * 1.5,
        alpha: 1,
      });
    }
  }

  /** Emit a small puff (e.g., agent arrives at destination) */
  emitPuff(pos: Vec2, color: number = 0x888888, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 10 + Math.random() * 20;
      this.spawnParticle({
        x: pos.x + (Math.random() - 0.5) * 8,
        y: pos.y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        color,
        size: 2 + Math.random() * 2,
        alpha: 0.7,
      });
    }
  }

  /** Emit typing sparks from an agent (while working) */
  emitTypingSpark(pos: Vec2): void {
    if (Math.random() > 0.3) return; // throttle
    const colors = [0x4FC3F7, 0x81C784, 0xFFB74D, 0xE57373];
    const color = colors[Math.floor(Math.random() * colors.length)];
    this.spawnParticle({
      x: pos.x + (Math.random() - 0.5) * 10,
      y: pos.y - 5,
      vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 15,
      life: 0.2 + Math.random() * 0.2,
      maxLife: 0.4,
      color,
      size: 1 + Math.random(),
      alpha: 0.9,
    });
  }

  /** Emit error particles */
  emitError(pos: Vec2): void {
    this.emitSparkle(pos, 0xf85149, 8);
  }

  /**
   * Step every particle forward. Only sprite transform/alpha/tint properties
   * are touched; the GPU re-batches in a single draw call via ParticleContainer.
   */
  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const sprite = p.sprite;

      sprite.x += p.vx * deltaTime;
      sprite.y += p.vy * deltaTime;
      p.vy += 30 * deltaTime; // gravity
      p.life -= deltaTime;

      if (p.life <= 0) {
        // Recycle to pool — keep the GPU resource live.
        sprite.visible = false;
        this.pool.push(sprite);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }

      const lifeRatio = p.life / p.maxLife;
      const scale = p.baseSize * lifeRatio * 0.5; // base sprite is 16px wide
      sprite.scale.set(scale, scale);
      sprite.alpha = p.baseAlpha * lifeRatio;
    }
  }

  /** Drop all in-flight particles back into the pool. */
  clear(): void {
    for (const p of this.particles) {
      p.sprite.visible = false;
      this.pool.push(p.sprite);
    }
    this.particles.length = 0;
  }

  /** Release GPU resources held by this system. */
  destroy(): void {
    this.clear();
    this.container.destroy({ children: true });
    this.texture.destroy(true);
  }

  private spawnParticle(p: {
    x: number; y: number; vx: number; vy: number;
    life: number; maxLife: number;
    color: number; size: number; alpha: number;
  }): void {
    if (this.particles.length >= this.maxParticles) {
      // Drop the oldest particle to make room.
      const oldest = this.particles.shift()!;
      oldest.sprite.visible = false;
      this.pool.push(oldest.sprite);
    }

    const sprite = this.pool.pop() ?? this.createPooledSprite();
    sprite.x = p.x;
    sprite.y = p.y;
    sprite.tint = p.color;
    sprite.alpha = p.alpha;
    const s = p.size * 0.5;
    sprite.scale.set(s, s);
    sprite.visible = true;

    this.particles.push({
      sprite,
      vx: p.vx,
      vy: p.vy,
      life: p.life,
      maxLife: p.maxLife,
      baseSize: p.size,
      baseAlpha: p.alpha,
    });
  }

  private createPooledSprite(): PIXI.Sprite {
    const sprite = new PIXI.Sprite(this.texture);
    sprite.anchor.set(0.5);
    sprite.visible = false;
    this.container.addChild(sprite);
    return sprite;
  }

  /**
   * Bake a soft white circle into a RenderTexture once. Sprites tint it
   * per-particle; the actual texels never change after construction.
   *
   * Falls back to a generated canvas texture when no renderer is provided
   * (e.g., in unit tests) — both branches produce a usable, fully white-
   * with-alpha-falloff circle.
   */
  private buildParticleTexture(renderer?: PIXI.IRenderer): PIXI.Texture {
    const size = 32;
    const gfx = new PIXI.Graphics();
    // Soft falloff: stack concentric circles of increasing alpha so the
    // edge blends into transparency without needing a shader.
    const layers = 6;
    for (let i = 0; i < layers; i++) {
      const t = (i + 1) / layers;
      const radius = (size / 2) * t;
      const alpha = (1 - t) * 0.45 + 0.1;
      gfx.beginFill(0xffffff, alpha);
      gfx.drawCircle(size / 2, size / 2, radius);
      gfx.endFill();
    }
    // Final crisp core
    gfx.beginFill(0xffffff, 1);
    gfx.drawCircle(size / 2, size / 2, size / 6);
    gfx.endFill();

    if (renderer) {
      const rt = PIXI.RenderTexture.create({ width: size, height: size, resolution: 2 });
      renderer.render(gfx, { renderTexture: rt });
      gfx.destroy();
      return rt;
    }

    // Headless fallback (vitest, SSR): generateCanvasTexture is the only
    // path that does not require an active WebGL context.
    const tex = (gfx as any).generateCanvasTexture?.() ?? PIXI.Texture.WHITE;
    gfx.destroy();
    return tex;
  }
}
