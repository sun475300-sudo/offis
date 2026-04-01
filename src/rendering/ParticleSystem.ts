import * as PIXI from 'pixi.js';
import { Vec2 } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  alpha: number;
}

/**
 * Lightweight particle system for visual effects:
 * - Task completion sparkles
 * - Agent arrival puff
 * - Working state keyboard typing sparks
 * - Error/failure red particles
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private graphics: PIXI.Graphics;
  private readonly maxParticles = 500;

  constructor(parentContainer: PIXI.Container) {
    this.graphics = new PIXI.Graphics();
    this.graphics.zIndex = 50;
    parentContainer.addChild(this.graphics);
  }

  /** Emit sparkle burst at position (e.g., task completion) */
  emitSparkle(pos: Vec2, color: number = 0x3fb950, count: number = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 30 + Math.random() * 50;
      this.addParticle({
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
      this.addParticle({
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
    this.addParticle({
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

  /** Update all particles */
  update(deltaTime: number): void {
    // Update existing
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vy += 30 * deltaTime; // gravity
      p.life -= deltaTime;
      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Redraw
    this.graphics.clear();
    for (const p of this.particles) {
      this.graphics.beginFill(p.color, p.alpha);
      this.graphics.drawCircle(p.x, p.y, p.size * (p.life / p.maxLife));
      this.graphics.endFill();
    }
  }

  /** Clean up all PIXI resources */
  destroy(): void {
    this.particles.length = 0;
    this.graphics.destroy();
  }

  private addParticle(p: Particle): void {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    this.particles.push(p);
  }
}
