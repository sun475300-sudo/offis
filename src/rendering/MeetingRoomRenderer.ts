import * as PIXI from 'pixi.js';
import { GridCell } from '../types';

const TILE_SIZE = 32;

export interface MeetingRoom {
  id: string;
  location: GridCell;
  participants: string[];
  isActive: boolean;
  glowGraphics?: PIXI.Graphics;
  labelText?: PIXI.Text;
  pulseRing?: PIXI.Graphics;
  bubbles?: PIXI.Container[];
}

const MEETING_QUOTES = [
  '스프린트 리뷰 시작!', '버그 원인 분석 중...', 'PR 코드리뷰 진행',
  '아키텍처 논의', '배포 전 최종 점검', '퍼포먼스 이슈 확인',
  '보안 취약점 토론', '인프라 비용 최적화', '다음 마일스톤 계획',
  'LLM 연동 방안 논의', 'API 스펙 확정', '롤아웃 일정 조율',
];

export class MeetingRoomRenderer {
  private container: PIXI.Container;
  private rooms: Map<string, MeetingRoom> = new Map();
  private time: number = 0;
  private bubbleTimer: number = 0;

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    this.container.zIndex = 10;
    parent.addChild(this.container);
  }

  /** Register a meeting room at a given tile coordinate */
  addMeetingRoom(id: string, location: GridCell): void {
    if (this.rooms.has(id)) return;
    const room: MeetingRoom = {
      id,
      location,
      participants: [],
      isActive: false,
      bubbles: [],
    };
    this.rooms.set(id, room);
    this._buildRoomGraphics(room);
  }

  private _buildRoomGraphics(room: MeetingRoom): void {
    const x = room.location.col * TILE_SIZE;
    const y = room.location.row * TILE_SIZE;

    // --- Pulse ring (behind everything) ---
    const ring = new PIXI.Graphics();
    ring.x = x + TILE_SIZE * 2;
    ring.y = y + TILE_SIZE * 1.5;
    ring.alpha = 0;
    this.container.addChild(ring);
    room.pulseRing = ring;

    // --- Main room graphic ---
    const glow = new PIXI.Graphics();
    glow.x = x;
    glow.y = y;
    this._drawRoom(glow, false);
    this.container.addChild(glow);
    room.glowGraphics = glow;

    // --- Label ---
    const label = new PIXI.Text('🏢 회의실', {
      fontFamily: '"Noto Sans KR", sans-serif',
      fontSize: 9,
      fill: 0x8B949E,
      fontWeight: 'bold',
      letterSpacing: 1,
    });
    label.x = x + 4;
    label.y = y - 16;
    this.container.addChild(label);
    room.labelText = label;
  }

  private _drawRoom(gfx: PIXI.Graphics, isActive: boolean): void {
    gfx.clear();
    const w = TILE_SIZE * 4;
    const h = TILE_SIZE * 3;

    if (isActive) {
      // Outer glow shadow
      gfx.lineStyle(8, 0x58A6FF, 0.15);
      gfx.drawRoundedRect(-4, -4, w + 8, h + 8, 8);

      // Active border
      gfx.lineStyle(2, 0x58A6FF, 0.9);
      gfx.beginFill(0x0D1B36, 0.85);
    } else {
      gfx.lineStyle(1, 0x30363D, 0.6);
      gfx.beginFill(0x161B22, 0.7);
    }
    gfx.drawRoundedRect(0, 0, w, h, 6);
    gfx.endFill();

    // Meeting table
    gfx.lineStyle(1, isActive ? 0x3FB950 : 0x44505A);
    gfx.beginFill(isActive ? 0x1A3A1F : 0x1C2128);
    gfx.drawRoundedRect(w * 0.18, h * 0.28, w * 0.64, h * 0.42, 3);
    gfx.endFill();

    // Chair positions around table
    const chairColor = isActive ? 0x1F6FEB : 0x30363D;
    const chairBorderColor = isActive ? 0x58A6FF : 0x484F58;
    const chairs = [
      { x: w * 0.28, y: h * 0.12 }, { x: w * 0.5, y: h * 0.12 }, { x: w * 0.72, y: h * 0.12 },
      { x: w * 0.15, y: h * 0.5 },
      { x: w * 0.28, y: h * 0.88 }, { x: w * 0.5, y: h * 0.88 }, { x: w * 0.72, y: h * 0.88 },
      { x: w * 0.85, y: h * 0.5 },
    ];
    for (const c of chairs) {
      gfx.lineStyle(1, chairBorderColor, 0.9);
      gfx.beginFill(chairColor);
      gfx.drawRoundedRect(c.x - 5, c.y - 5, 10, 10, 2);
      gfx.endFill();
    }

    // Laptop icons on table (small squares)
    if (isActive) {
      gfx.beginFill(0x58A6FF, 0.6);
      [[w * 0.3, h * 0.42], [w * 0.5, h * 0.42], [w * 0.67, h * 0.42]].forEach(([lx, ly]) => {
        gfx.drawRoundedRect(lx - 5, ly - 3, 10, 6, 1);
      });
      gfx.endFill();
    }
  }

  activateRoom(id: string, participantIds: string[]): void {
    const room = this.rooms.get(id);
    if (!room) return;
    room.isActive = true;
    room.participants = [...participantIds];
    if (room.glowGraphics) this._drawRoom(room.glowGraphics, true);
    if (room.labelText) {
      room.labelText.text = `🔴 회의 진행 중 (${participantIds.length}명)`;
      room.labelText.style.fill = 0x58A6FF as any;
    }
    // Spawn initial speech bubbles
    this._spawnBubble(room);
  }

  deactivateRoom(id: string): void {
    const room = this.rooms.get(id);
    if (!room) return;
    room.isActive = false;
    room.participants = [];
    if (room.glowGraphics) this._drawRoom(room.glowGraphics, false);
    if (room.labelText) {
      room.labelText.text = '🏢 회의실';
      room.labelText.style.fill = 0x8B949E as any;
    }
    this._clearBubbles(room);
    if (room.pulseRing) room.pulseRing.alpha = 0;
  }

  private _spawnBubble(room: MeetingRoom): void {
    if (!room.isActive || !room.bubbles) return;
    // Clean old bubbles
    if (room.bubbles.length > 3) {
      const old = room.bubbles.shift();
      if (old && old.parent) {
        old.parent.removeChild(old);
        old.destroy({ children: true });
      }
    }

    const quote = MEETING_QUOTES[Math.floor(Math.random() * MEETING_QUOTES.length)];
    const x = room.location.col * TILE_SIZE + TILE_SIZE * 0.5 + Math.random() * TILE_SIZE * 3;
    const y = room.location.row * TILE_SIZE - 10 - room.bubbles.length * 22;

    const bubble = new PIXI.Container();
    bubble.x = x;
    bubble.y = y;

    const bg = new PIXI.Graphics();
    const textObj = new PIXI.Text(quote, {
      fontFamily: '"Noto Sans KR", sans-serif',
      fontSize: 9,
      fill: 0xE6EDF3,
    });
    const padX = 8, padY = 4;
    const bw = textObj.width + padX * 2;
    const bh = textObj.height + padY * 2;

    bg.beginFill(0x21262D, 0.92);
    bg.lineStyle(1, 0x58A6FF, 0.7);
    bg.drawRoundedRect(0, 0, bw, bh, 4);
    // Tail
    bg.moveTo(10, bh);
    bg.lineTo(6, bh + 8);
    bg.lineTo(16, bh);
    bg.endFill();

    textObj.x = padX;
    textObj.y = padY;

    bubble.addChild(bg);
    bubble.addChild(textObj);
    bubble.alpha = 0;

    this.container.addChild(bubble);
    room.bubbles.push(bubble);

    // Fade in
    let fadeIn = 0;
    const fadeInTicker = () => {
      fadeIn += 0.08;
      bubble.alpha = Math.min(1, fadeIn);
      if (fadeIn >= 1) this.container.removeListener('__fadeIn', fadeInTicker as any);
    };
    // Use a simple interval instead
    const iv = setInterval(() => {
      fadeIn += 0.08;
      bubble.alpha = Math.min(1, fadeIn);
      if (fadeIn >= 1) clearInterval(iv);
    }, 16);
  }

  private _clearBubbles(room: MeetingRoom): void {
    if (!room.bubbles) return;
    for (const b of room.bubbles) {
      if (b.parent) b.parent.removeChild(b);
      b.destroy({ children: true });
    }
    room.bubbles = [];
  }

  update(deltaTime: number): void {
    this.time += deltaTime;
    this.bubbleTimer += deltaTime;

    for (const room of this.rooms.values()) {
      if (!room.isActive) continue;

      // Animate main room glow brightness
      if (room.glowGraphics) {
        room.glowGraphics.alpha = 0.8 + Math.sin(this.time * 2.5) * 0.2;
      }

      // Pulse ring animation
      if (room.pulseRing) {
        const scale = 1 + (this.time % 2) * 0.4;
        const alpha = Math.max(0, 0.5 - (this.time % 2) * 0.25);
        room.pulseRing.clear();
        room.pulseRing.lineStyle(2, 0x58A6FF, alpha);
        room.pulseRing.drawCircle(0, 0, 30 * scale);
        room.pulseRing.alpha = alpha;
      }

      // Spawn new speech bubble every 4 seconds per room
      if (this.bubbleTimer > 4.0 && room.isActive) {
        this._spawnBubble(room);
      }

      // Float existing bubbles upward
      if (room.bubbles) {
        for (const b of room.bubbles) {
          b.y -= 0.2;
          if (b.y < room.location.row * TILE_SIZE - 80) {
            b.alpha = Math.max(0, b.alpha - 0.02);
          }
        }
      }
    }

    if (this.bubbleTimer > 4.0) this.bubbleTimer = 0;
  }

  clearAll(): void {
    for (const room of this.rooms.values()) {
      this._clearBubbles(room);
      room.glowGraphics?.destroy();
      room.pulseRing?.destroy();
      room.labelText?.destroy();
    }
    this.rooms.clear();
    this.container.removeChildren();
  }

  getRoomCount(): number { return this.rooms.size; }
  getActiveRoomCount(): number {
    return Array.from(this.rooms.values()).filter(r => r.isActive).length;
  }
}
