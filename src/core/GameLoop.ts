export type UpdateCallback = (deltaTime: number) => void;

export class GameLoop {
  private lastTimestamp: number = 0;
  private running: boolean = false;
  private rafId: number = 0;
  private updateCallbacks: UpdateCallback[] = [];
  private drawCallbacks: UpdateCallback[] = [];
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  /** Max delta clamp to prevent spiral of death (e.g. tab was backgrounded) */
  private readonly maxDelta: number = 0.1; // 100ms

  onUpdate(cb: UpdateCallback): void {
    this.updateCallbacks.push(cb);
  }

  onDraw(cb: UpdateCallback): void {
    this.drawCallbacks.push(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.tick(this.lastTimestamp);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  getFPS(): number {
    return this.fps;
  }

  private tick = (timestamp: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const rawDelta = (timestamp - this.lastTimestamp) / 1000; // seconds
    const deltaTime = Math.min(rawDelta, this.maxDelta);
    this.lastTimestamp = timestamp;

    // FPS counter
    this.frameCount++;
    this.fpsTimer += rawDelta;
    if (this.fpsTimer >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer -= 1.0;
    }

    // Update phase
    for (const cb of this.updateCallbacks) {
      cb(deltaTime);
    }

    // Draw phase
    for (const cb of this.drawCallbacks) {
      cb(deltaTime);
    }
  };
}
