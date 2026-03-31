import * as PIXI from 'pixi.js';
import { Vec2 } from '../types';

export interface TaskProgress {
  id: string;
  agentId: string;
  label: string;
  progress: number;
  maxProgress: number;
  position: Vec2;
  color: number;
}

export class TaskProgressRenderer {
  private container: PIXI.Container;
  private progressBars: Map<string, PIXI.Graphics> = new Map();
  private progressLabels: Map<string, PIXI.Text> = new Map();
  private progressData: Map<string, TaskProgress> = new Map();

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    parent.addChild(this.container);
  }

  addProgress(id: string, agentId: string, label: string, position: Vec2, color: number = 0x3FB950): void {
    const data: TaskProgress = {
      id,
      agentId,
      label,
      progress: 0,
      maxProgress: 100,
      position: { ...position },
      color,
    };
    this.progressData.set(id, data);
    this.createProgressBar(data);
  }

  private createProgressBar(data: TaskProgress): void {
    const barWidth = 50;
    const barHeight = 6;
    const padding = 2;

    const graphics = new PIXI.Graphics();
    
    graphics.beginFill(0x30363D);
    graphics.drawRoundedRect(0, 0, barWidth, barHeight, 2);
    graphics.endFill();

    const progressWidth = (data.progress / data.maxProgress) * barWidth;
    if (progressWidth > 0) {
      graphics.beginFill(data.color);
      graphics.drawRoundedRect(padding, padding, progressWidth - padding * 2, barHeight - padding * 2, 1);
      graphics.endFill();
    }

    graphics.x = data.position.x - barWidth / 2;
    graphics.y = data.position.y - 20;

    this.container.addChild(graphics);
    this.progressBars.set(data.id, graphics);

    const label = new PIXI.Text(data.label, {
      fontFamily: 'Arial',
      fontSize: 8,
      fill: 0xE6EDF3,
    });
    label.x = graphics.x;
    label.y = graphics.y - 12;
    this.container.addChild(label);
    this.progressLabels.set(data.id, label);
  }

  updateProgress(id: string, progress: number): void {
    const data = this.progressData.get(id);
    if (!data) return;

    data.progress = Math.min(progress, data.maxProgress);
    
    const graphics = this.progressBars.get(id);
    if (graphics) {
      graphics.clear();
      
      const barWidth = 50;
      const barHeight = 6;
      const padding = 2;

      graphics.beginFill(0x30363D);
      graphics.drawRoundedRect(0, 0, barWidth, barHeight, 2);
      graphics.endFill();

      const progressWidth = (data.progress / data.maxProgress) * barWidth;
      if (progressWidth > 0) {
        graphics.beginFill(data.color);
        graphics.drawRoundedRect(padding, padding, progressWidth - padding * 2, barHeight - padding * 2, 1);
        graphics.endFill();
      }
    }

    const label = this.progressLabels.get(id);
    if (label) {
      label.text = `${data.label} ${Math.round(data.progress)}%`;
    }
  }

  removeProgress(id: string): void {
    const graphics = this.progressBars.get(id);
    if (graphics) {
      this.container.removeChild(graphics);
      graphics.destroy();
      this.progressBars.delete(id);
    }

    const label = this.progressLabels.get(id);
    if (label) {
      this.container.removeChild(label);
      label.destroy();
      this.progressLabels.delete(id);
    }

    this.progressData.delete(id);
  }

  clearAll(): void {
    const keys = [...this.progressData.keys()];
    for (const id of keys) {
      this.removeProgress(id);
    }
  }

  getProgressCount(): number {
    return this.progressData.size;
  }
}
