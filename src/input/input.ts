// Keyboard and touch joystick → world-space move intent. Screen-up is camera-relative.
import nipplejs from 'nipplejs';
import { FEEL } from '../feel';

const YAW = (FEEL.cameraYawDeg * Math.PI) / 180;
const RIGHT = { x: Math.cos(YAW), z: -Math.sin(YAW) };
const UP = { x: -Math.sin(YAW), z: -Math.cos(YAW) };

export type InputKind = 'keys' | 'touch';

export class Input {
  private keys = new Set<string>();
  private joy = { x: 0, y: 0, active: false };
  /** First input used — picks the movement hint. */
  firstKind: InputKind | null = null;
  onEscape: () => void = () => {};
  enabled = true;

  constructor(zone: HTMLElement) {
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).closest?.('input, textarea')) return;
      if (e.code === 'Escape') {
        this.onEscape();
        return;
      }
      if (/^(Key[WASD]|Arrow|Space)/.test(e.code)) {
        e.preventDefault();
        this.firstKind ??= 'keys';
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    const manager = nipplejs.create({ zone, mode: 'dynamic', color: '#3a2416', size: 110 });
    manager.on('move', (e) => {
      this.firstKind ??= 'touch';
      this.joy.active = true;
      // half push = half speed
      const k = Math.min(1, e.data.force);
      this.joy.x = e.data.vector.x * k;
      this.joy.y = e.data.vector.y * k;
    });
    manager.on('end', () => {
      this.joy = { x: 0, y: 0, active: false };
    });
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

  get grab(): boolean {
    return this.keys.has('Space');
  }

  get touch(): boolean {
    return matchMedia('(pointer: coarse)').matches;
  }
}
