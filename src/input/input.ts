// Keyboard and touch joystick → world-space move intent (screen-up is camera-relative); pinch, wheel and + − → zoom.
import nipplejs from 'nipplejs';
import { FEEL } from '../feel';
import { PALETTE } from '../palette';

const YAW = (FEEL.cameraYawDeg * Math.PI) / 180;
const RIGHT = { x: Math.cos(YAW), z: -Math.sin(YAW) };
const UP = { x: -Math.sin(YAW), z: -Math.cos(YAW) };

export type InputKind = 'keys' | 'touch';

export class Input {
  private keys = new Set<string>();
  private joy = { x: 0, y: 0, active: false, force: 0 };
  /** First input used — picks the movement hint. */
  firstKind: InputKind | null = null;
  onEscape: () => void = () => {};
  /** Zoom shortcut: multiply the view size by this (> 1 shows more). */
  onZoom: (factor: number) => void = () => {};
  enabled = true;
  private pinch = 0;

  constructor(zone: HTMLElement) {
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).closest?.('input, textarea')) return;
      if (e.code === 'Escape') {
        this.onEscape();
        return;
      }
      if (e.key === '+' || e.key === '=') this.onZoom(1 - FEEL.zoomStep);
      if (e.key === '-' || e.key === '_') this.onZoom(1 + FEEL.zoomStep);
      if (/^(Key[WASD]|Arrow|Space)/.test(e.code)) {
        e.preventDefault();
        this.firstKind ??= 'keys';
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener(
      'wheel',
      (e) => {
        if ((e.target as HTMLElement).closest?.('.panel, .lil-gui') || !e.deltaY) return;
        this.onZoom(1 + Math.sign(e.deltaY) * FEEL.zoomStep);
      },
      { passive: true },
    );
    this.pinchZoom();
    const manager = nipplejs.create({ zone, mode: 'dynamic', color: PALETTE.ink, size: 110 });
    manager.on('move', (e) => {
      this.firstKind ??= 'touch';
      this.joy.active = true;
      // half push = half speed
      this.joy.force = e.data.force;
      const k = Math.min(1, e.data.force);
      this.joy.x = e.data.vector.x * k;
      this.joy.y = e.data.vector.y * k;
    });
    manager.on('end', () => {
      this.joy = { x: 0, y: 0, active: false, force: 0 };
    });
  }

  /** Two-finger pinch zooms; the joystick sleeps during it and a moment after. */
  private pinchZoom(): void {
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const opts = { capture: true, passive: true };
    addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 2) return;
        this.pinch = spread(e.touches);
        this.enabled = false;
      },
      opts,
    );
    addEventListener(
      'touchmove',
      (e) => {
        if (!this.pinch || e.touches.length !== 2) return;
        const d = spread(e.touches);
        if (d > 0) this.onZoom(this.pinch / d);
        this.pinch = d;
      },
      opts,
    );
    addEventListener(
      'touchend',
      (e) => {
        if (!this.pinch || e.touches.length >= 2) return;
        this.pinch = 0;
        setTimeout(() => (this.enabled = true), FEEL.pinchQuiet * 1000);
      },
      opts,
    );
  }

  private has(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** World-space direction, length ≤ 1. */
  move(): { x: number; z: number } {
    if (!this.enabled) return { x: 0, z: 0 };
    let sx = (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    let sy = (this.has('KeyW', 'ArrowUp') ? 1 : 0) - (this.has('KeyS', 'ArrowDown') ? 1 : 0);
    const len = Math.hypot(sx, sy);
    if (len > 0) {
      sx /= len;
      sy /= len;
    } else if (this.joy.active) {
      sx = this.joy.x;
      sy = this.joy.y;
    }
    return { x: RIGHT.x * sx + UP.x * sy, z: RIGHT.z * sx + UP.z * sy };
  }

  get sprint(): boolean {
    return this.has('ShiftLeft', 'ShiftRight') || (this.joy.active && this.joy.force > FEEL.sprintForce);
  }

  get grab(): boolean {
    return this.keys.has('Space');
  }

  get touch(): boolean {
    return matchMedia('(pointer: coarse)').matches;
  }
}
