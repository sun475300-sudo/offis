import * as PIXI from 'pixi.js';
import { GridCell, Vec2 } from '../types';

export interface MeetingRoom {
  id: string;
  location: GridCell;
  participants: string[];
  isActive: boolean;
  glowGraphics?: PIXI.Graphics;
  labelGraphics?: PIXI.Graphics;
}

export class MeetingRoomRenderer {
  private container: PIXI.Container;
  private rooms: Map<string, MeetingRoom> = new Map();
  private TILE_SIZE: number = 32;

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    parent.addChild(this.container);
  }

  addMeetingRoom(id: string, location: GridCell): void {
    const room: MeetingRoom = {
      id,
      location,
      participants: [],
      isActive: false,
    };

    this.rooms.set(id, room);
    this.createRoomGraphics(room);
  }

  private createRoomGraphics(room: MeetingRoom): void {
    const glow = new PIXI.Graphics();
    glow.x = room.location.col * this.TILE_SIZE;
    glow.y = room.location.row * this.TILE_SIZE;
    
    this.drawRoom(glow, room.isActive);
    
    this.container.addChild(glow);
    room.glowGraphics = glow;

    // Label
    const label = new PIXI.Graphics();
    label.x = glow.x;
    label.y = glow.y - 20;
    
    this.drawLabel(label, '회의실', room.isActive);
    
    this.container.addChild(label);
    room.labelGraphics = label;
  }

  private drawRoom(gfx: PIXI.Graphics, isActive: boolean): void {
    gfx.clear();
    
    const width = this.TILE_SIZE * 4;
    const height = this.TILE_SIZE * 3;

    if (isActive) {
      // Glowing border when active
      gfx.lineStyle(3, 0x3FB950, 0.8);
      gfx.beginFill(0x3FB950, 0.15);
    } else {
      gfx.lineStyle(2, 0x30363D, 0.5);
      gfx.beginFill(0x30363D, 0.1);
    }

    gfx.drawRoundedRect(0, 0, width, height, 4);
    gfx.endFill();

    // Table in center
    gfx.lineStyle(1, isActive ? 0x3FB950 : 0x484F58);
    gfx.beginFill(isActive ? 0x238636 : 0x21262D);
    gfx.drawRoundedRect(width * 0.2, height * 0.3, width * 0.6, height * 0.4, 2);
    gfx.endFill();

    // Chairs around table
    const chairPositions = [
      { x: width * 0.3, y: height * 0.15 },
      { x: width * 0.5, y: height * 0.15 },
      { x: width * 0.7, y: height * 0.15 },
      { x: width * 0.3, y: height * 0.85 },
      { x: width * 0.5, y: height * 0.85 },
      { x: width * 0.7, y: height * 0.85 },
    ];

    for (const pos of chairPositions) {
      gfx.lineStyle(1, isActive ? 0x58A6FF : 0x484F58);
      gfx.beginFill(isActive ? 0x1F6FEB : 0x30363D);
      gfx.drawCircle(pos.x, pos.y, 6);
      gfx.endFill();
    }
  }

  private drawLabel(gfx: PIXI.Graphics, text: string, isActive: boolean): void {
    gfx.clear();
    
    const textObj = new PIXI.Text(text, {
      fontFamily: 'Arial',
      fontSize: 10,
      fill: isActive ? 0x3FB950 : 0x8B949E,
      fontWeight: 'bold',
    });
    
    textObj.x = 4;
    textObj.y = 0;
    
    gfx.addChild(textObj);
  }

  activateRoom(id: string, participantIds: string[]): void {
    const room = this.rooms.get(id);
    if (!room) return;

    room.isActive = true;
    room.participants = participantIds;

    if (room.glowGraphics) {
      this.drawRoom(room.glowGraphics, true);
    }
  }

  deactivateRoom(id: string): void {
    const room = this.rooms.get(id);
    if (!room) return;

    room.isActive = false;
    room.participants = [];

    if (room.glowGraphics) {
      this.drawRoom(room.glowGraphics, false);
    }
  }

  update(): void {
    // Pulse animation for active rooms
    const time = Date.now() / 1000;
    
    for (const room of this.rooms.values()) {
      if (room.isActive && room.glowGraphics) {
        const alpha = 0.6 + Math.sin(time * 3) * 0.3;
        room.glowGraphics.alpha = alpha;
      }
    }
  }

  clearAll(): void {
    for (const room of this.rooms.values()) {
      if (room.glowGraphics) {
        this.container.removeChild(room.glowGraphics);
        room.glowGraphics.destroy();
      }
      if (room.labelGraphics) {
        this.container.removeChild(room.labelGraphics);
        room.labelGraphics.destroy();
      }
    }
    this.rooms.clear();
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getActiveRoomCount(): number {
    return Array.from(this.rooms.values()).filter(r => r.isActive).length;
  }
}
