import * as PIXI from 'pixi.js';
import { Vec2 } from '../types';

export interface SpeechBubble {
  id: string;
  agentId: string;
  message: string;
  position: Vec2;
  duration: number;
  startTime: number;
  color: number;
}

export class SpeechBubbleRenderer {
  private container: PIXI.Container;
  private bubbles: Map<string, SpeechBubble> = new Map();
  private bubbleGraphics: Map<string, PIXI.Graphics> = new Map();
  private bubbleTexts: Map<string, PIXI.Text> = new Map();

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    parent.addChild(this.container);
  }

  addBubble(id: string, agentId: string, message: string, position: Vec2, color: number = 0xFFFFFF, duration: number = 3000): void {
    const bubble: SpeechBubble = {
      id,
      agentId,
      message,
      position: { ...position },
      duration,
      startTime: Date.now(),
      color,
    };

    this.bubbles.set(id, bubble);
    this.createBubbleGraphics(bubble);
  }

  private createBubbleGraphics(bubble: SpeechBubble): void {
    const graphics = new PIXI.Graphics();
    
    const maxWidth = 200;
    const padding = 8;
    const fontSize = 10;
    const lineHeight = 14;
    
    const text = new PIXI.Text(bubble.message, {
      fontFamily: 'Arial, sans-serif',
      fontSize: fontSize,
      fill: 0x1a1f26,
      wordWrap: true,
      wordWrapWidth: maxWidth - padding * 2,
    });
    
    text.x = padding;
    text.y = padding;
    
    const bubbleWidth = Math.min(maxWidth, text.width + padding * 2);
    const bubbleHeight = text.height + padding * 2;
    
    graphics.beginFill(bubble.color);
    graphics.lineStyle(1, 0x000000, 0.3);
    
    const radius = 6;
    graphics.drawRoundedRect(0, 0, bubbleWidth, bubbleHeight, radius);
    
    graphics.moveTo(bubbleWidth / 2 - 6, bubbleHeight);
    graphics.lineTo(bubbleWidth / 2, bubbleHeight + 8);
    graphics.lineTo(bubbleWidth / 2 + 6, bubbleHeight);
    graphics.endFill();
    
    graphics.x = bubble.position.x - bubbleWidth / 2;
    graphics.y = bubble.position.y - bubbleHeight - 20;
    
    graphics.addChild(text);
    
    this.container.addChild(graphics);
    this.bubbleGraphics.set(bubble.id, graphics);
    this.bubbleTexts.set(bubble.id, text);
  }

  update(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, bubble] of this.bubbles) {
      const elapsed = now - bubble.startTime;
      
      if (elapsed >= bubble.duration) {
        toRemove.push(id);
      } else if (elapsed > bubble.duration - 500) {
        const graphics = this.bubbleGraphics.get(id);
        if (graphics) {
          graphics.alpha = 1 - (elapsed - bubble.duration + 500) / 500;
        }
      }
    }

    for (const id of toRemove) {
      this.removeBubble(id);
    }
  }

  removeBubble(id: string): void {
    const graphics = this.bubbleGraphics.get(id);
    if (graphics) {
      this.container.removeChild(graphics);
      graphics.destroy({ children: true });
      this.bubbleGraphics.delete(id);
      this.bubbleTexts.delete(id);
    }
    this.bubbles.delete(id);
  }

  clearAll(): void {
    for (const [id] of this.bubbles) {
      this.removeBubble(id);
    }
  }

  getBubbleCount(): number {
    return this.bubbles.size;
  }
}
