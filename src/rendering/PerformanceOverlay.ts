import * as PIXI from 'pixi.js';

/**
 * Performance HUD overlay — FPS graph, memory usage, agent count metrics.
 * Renders as a fixed-position overlay on the game canvas.
 */
export class PerformanceOverlay {
  private container: PIXI.Container;
  private fpsText: PIXI.Text;
  private memoryText: PIXI.Text;
  private agentText: PIXI.Text;
  private fpsGraph: PIXI.Graphics;
  private fpsHistory: number[] = [];
  private readonly maxHistoryLength = 120;
  private readonly graphWidth = 150;
  private readonly graphHeight = 40;
  private visible: boolean = true;

  constructor(parentContainer: PIXI.Container) {
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;

    // Background
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0d1117, 0.85);
    bg.lineStyle(1, 0x30363d);
    bg.drawRoundedRect(0, 0, 170, 130, 6);
    bg.endFill();
    bg.zIndex = 0;
    this.container.addChild(bg);

    // Title
    const title = new PIXI.Text('PERFORMANCE', {
      fontFamily: 'monospace',
      fontSize: 9,
      fill: 0x8b949e,
      letterSpacing: 1,
    });
    title.position.set(8, 6);
    title.zIndex = 1;
    this.container.addChild(title);

    // FPS text
    this.fpsText = new PIXI.Text('FPS: 60', {
      fontFamily: 'monospace',
      fontSize: 11,
      fill: 0x3fb950,
      fontWeight: 'bold',
    });
    this.fpsText.position.set(8, 22);
    this.fpsText.zIndex = 1;
    this.container.addChild(this.fpsText);

    // Memory text
    this.memoryText = new PIXI.Text('MEM: --', {
      fontFamily: 'monospace',
      fontSize: 10,
      fill: 0x58a6ff,
    });
    this.memoryText.position.set(8, 38);
    this.memoryText.zIndex = 1;
    this.container.addChild(this.memoryText);

    // Agent count text
    this.agentText = new PIXI.Text('AGT: 0 | TKS: 0', {
      fontFamily: 'monospace',
      fontSize: 10,
      fill: 0xd29922,
    });
    this.agentText.position.set(8, 54);
    this.agentText.zIndex = 1;
    this.container.addChild(this.agentText);

    // FPS graph
    this.fpsGraph = new PIXI.Graphics();
    this.fpsGraph.position.set(8, 74);
    this.fpsGraph.zIndex = 1;
    this.container.addChild(this.fpsGraph);

    parentContainer.addChild(this.container);
  }

  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.visible = this.visible;
  }

  update(fps: number, agentCount: number, taskCount: number): void {
    if (!this.visible) return;

    // FPS
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.maxHistoryLength) {
      this.fpsHistory.shift();
    }

    const fpsColor = fps >= 55 ? 0x3fb950 : fps >= 30 ? 0xd29922 : 0xf85149;
    this.fpsText.text = `FPS: ${fps}`;
    this.fpsText.style.fill = fpsColor;

    // Memory (if available)
    const perf = (performance as any);
    if (perf.memory) {
      const usedMB = (perf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
      const totalMB = (perf.memory.totalJSHeapSize / (1024 * 1024)).toFixed(0);
      this.memoryText.text = `MEM: ${usedMB}/${totalMB}MB`;
    }

    // Agent/Task counts
    this.agentText.text = `AGT: ${agentCount} | TKS: ${taskCount}`;

    // Draw FPS graph
    this.fpsGraph.clear();

    // Graph background
    this.fpsGraph.beginFill(0x161b22);
    this.fpsGraph.drawRect(0, 0, this.graphWidth, this.graphHeight);
    this.fpsGraph.endFill();

    // 60fps line
    this.fpsGraph.lineStyle(1, 0x30363d, 0.5);
    this.fpsGraph.moveTo(0, 0);
    this.fpsGraph.lineTo(this.graphWidth, 0);

    // 30fps line
    const halfY = this.graphHeight / 2;
    this.fpsGraph.moveTo(0, halfY);
    this.fpsGraph.lineTo(this.graphWidth, halfY);

    // FPS line graph
    if (this.fpsHistory.length > 1) {
      this.fpsGraph.lineStyle(1.5, fpsColor, 0.9);

      const step = this.graphWidth / this.maxHistoryLength;
      for (let i = 0; i < this.fpsHistory.length; i++) {
        const x = i * step;
        const y = this.graphHeight - (this.fpsHistory[i] / 60) * this.graphHeight;
        const clampedY = Math.max(0, Math.min(this.graphHeight, y));

        if (i === 0) {
          this.fpsGraph.moveTo(x, clampedY);
        } else {
          this.fpsGraph.lineTo(x, clampedY);
        }
      }
    }
  }
}
