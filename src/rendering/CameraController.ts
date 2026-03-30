import * as PIXI from 'pixi.js';
import { Vec2 } from '../types';

/**
 * Camera Controller — handles pan, zoom, and agent tracking.
 * Operates by transforming the main stage container.
 */
export class CameraController {
  private container: PIXI.Container;
  private targetPosition: Vec2 = { x: 0, y: 0 };
  private currentPosition: Vec2 = { x: 0, y: 0 };
  private targetZoom: number = 1;
  private currentZoom: number = 1;
  private followTarget: Vec2 | null = null;

  private readonly minZoom = 0.3;
  private readonly maxZoom = 3.0;
  private readonly lerpSpeed = 5; // smooth follow speed
  private readonly panSpeed = 500;

  // Input state
  private keys: Set<string> = new Set();
  private isDragging: boolean = false;
  private dragStart: Vec2 = { x: 0, y: 0 };
  private dragCameraStart: Vec2 = { x: 0, y: 0 };

  constructor(container: PIXI.Container, private screenWidth: number, private screenHeight: number) {
    this.container = container;
    this.setupInput();
  }

  /** Follow a world position (e.g., agent position) */
  followPosition(pos: Vec2): void {
    this.followTarget = pos;
  }

  /** Stop following */
  clearFollow(): void {
    this.followTarget = null;
  }

  /** Set zoom level (0.3 - 3.0) */
  setZoom(zoom: number): void {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
  }

  /** Get current zoom level */
  getZoom(): number {
    return this.currentZoom;
  }

  /** Center camera on world coordinates */
  centerOn(worldX: number, worldY: number): void {
    this.targetPosition.x = worldX;
    this.targetPosition.y = worldY;
    this.followTarget = null;
  }

  /** Update camera each frame */
  update(deltaTime: number): void {
    // Follow target
    if (this.followTarget) {
      this.targetPosition.x = this.followTarget.x;
      this.targetPosition.y = this.followTarget.y;
    }

    // Keyboard panning
    const panDelta = this.panSpeed * deltaTime / this.currentZoom;
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) this.targetPosition.x -= panDelta;
    if (this.keys.has('ArrowRight') || this.keys.has('d')) this.targetPosition.x += panDelta;
    if (this.keys.has('ArrowUp') || this.keys.has('w')) this.targetPosition.y -= panDelta;
    if (this.keys.has('ArrowDown') || this.keys.has('s')) this.targetPosition.y += panDelta;

    // Smooth interpolation
    const t = 1 - Math.exp(-this.lerpSpeed * deltaTime);
    this.currentPosition.x += (this.targetPosition.x - this.currentPosition.x) * t;
    this.currentPosition.y += (this.targetPosition.y - this.currentPosition.y) * t;
    this.currentZoom += (this.targetZoom - this.currentZoom) * t;

    // Apply transform to container
    this.container.scale.set(this.currentZoom);
    this.container.position.set(
      this.screenWidth / 2 - this.currentPosition.x * this.currentZoom,
      this.screenHeight / 2 - this.currentPosition.y * this.currentZoom,
    );
  }

  updateScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  private setupInput(): void {
    window.addEventListener('keydown', (e) => this.keys.add(e.key));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));

    // Mouse wheel zoom
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.15 : 0.15;
      this.setZoom(this.targetZoom + zoomDelta);
    }, { passive: false });

    // Mouse drag panning
    window.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) { // middle or right click
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.dragCameraStart = { ...this.targetPosition };
        this.followTarget = null;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = (e.clientX - this.dragStart.x) / this.currentZoom;
        const dy = (e.clientY - this.dragStart.y) / this.currentZoom;
        this.targetPosition.x = this.dragCameraStart.x - dx;
        this.targetPosition.y = this.dragCameraStart.y - dy;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Prevent context menu
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
