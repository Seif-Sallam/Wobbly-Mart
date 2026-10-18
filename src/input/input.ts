// Keyboard, touch joystick and Tap Walk → world-space move intent (screen-up is camera-relative); pinch, wheel and
// + − → zoom.
import nipplejs from 'nipplejs';
import { FEEL } from '../feel';
import { PALETTE } from '../palette';
import type { Settings } from '../sim/save';
import type { World } from '../sim/world';
import { TapWalk } from './tap-walk';

const YAW = (FEEL.cameraYawDeg * Math.PI) / 180;
const RIGHT = { x: Math.cos(YAW), z: -Math.sin(YAW) };
const UP = { x: -Math.sin(YAW), z: -Math.cos(YAW) };

export class Input {
  private keys = new Set<string>();
  private joy = { x: 0, y: 0, active: false, force: 0 };
  onEscape: () => void = () => {};
  /** Zoom shortcut: multiply the view size by this (> 1 shows more). */
  onZoom: (factor: number) => void = () => {};
  /** A tap or click on the game (screen px); `double` = second tap in quick succession. */
  onTap: (x: number, y: number, double: boolean) => void = () => {};
  readonly tap = new TapWalk();
  enabled = true;
  private pinch = 0;
  private manager: ReturnType<typeof nipplejs.create> | null = null;
  private joyKey = '';
  /** A finger is on the stick. */
  joyHeld = false;
  /** Manual grab on landscape phones is on: a finger held right of the stick's zone acts as Space. */
  holdGrab = false;
  private holding = false;

  constructor(
    private readonly zone: HTMLElement,
    ring: HTMLElement,
  ) {
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
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.pinchZoom();
    this.taps(zone);
    this.holdToGrab(ring);
    this.joystick(FEEL.joyPortrait);
  }

  /** Landscape: Fixed rests bottom-left, Free appears under the thumb; portrait always follows the thumb. Rebuilds only
   * when something changed. `inset` is the safe area (px). */
  setJoystick(mode: Settings['joystick'], land: boolean, inset: { left: number; bottom: number }): void {
    const key = `${mode}|${land}|${inset.left}|${inset.bottom}`;
    if (key === this.joyKey) return;
    this.joyKey = key;
    const rest =
      land && mode === 'fixed'
        ? { left: inset.left + FEEL.joyRestLeft, bottom: inset.bottom + FEEL.joyRestBottom }
        : undefined;
    this.joystick(land ? FEEL.joyLandscape : FEEL.joyPortrait, rest);
  }

  /** A finger held on the game right of the stick's zone is Space, with a faint ring under it. */
  private holdToGrab(ring: HTMLElement): void {
    let id: number | null = null;
    addEventListener(
      'pointerdown',
      (e) => {
        if (!this.holdGrab || id !== null || !(e.target instanceof HTMLCanvasElement)) return;
        if (e.clientX < innerWidth * FEEL.joyZone) return;
        id = e.pointerId;
        this.holding = true;
        Object.assign(ring.style, { left: `${e.clientX}px`, top: `${e.clientY}px`, opacity: '0.35' });
      },
      true,
    );
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      this.holding = false;
      ring.style.opacity = '0';
    };
    addEventListener('pointerup', end, true);
    addEventListener('pointercancel', end, true);
  }

  /** (Re)builds the thumb stick: it appears under the thumb, or sits at `rest` (px from the zone's bottom-left). */
  private joystick(size: number, rest?: { left: number; bottom: number }): void {
    this.manager?.destroy();
    this.joy = { x: 0, y: 0, active: false, force: 0 };
    const manager = nipplejs.create({
      zone: this.zone,
      color: PALETTE.ink,
      size,
      ...(rest
        ? { mode: 'static' as const, position: { left: `${rest.left}px`, bottom: `${rest.bottom}px` } }
        : { mode: 'dynamic' as const }),
    });
    this.manager = manager;
    manager.on('move', (e) => {
      this.joy.active = true;
      // the stick reaches full speed at joyFullPush of the ring; past the ring it sprints
      this.joy.force = e.data.force;
      const k = Math.min(1, e.data.force / FEEL.joyFullPush);
      this.joy.x = e.data.vector.x * k;
      this.joy.y = e.data.vector.y * k;
    });
    manager.on('start', () => (this.joyHeld = true));
    manager.on('end', () => {
      this.joyHeld = false;
      this.joy = { x: 0, y: 0, active: false, force: 0 };
    });
  }

  /** Short, still presses on the game (not drags, not on the HUD or panels) are taps. */
  private taps(zone: HTMLElement): void {
    let down: { x: number; y: number; t: number; id: number } | null = null;
    let pointers = 0;
    let lastTap = -Infinity;
    const onGame = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      return el instanceof HTMLCanvasElement || zone.contains(el);
    };
    addEventListener(
      'pointerdown',
      (e) => {
        pointers++;
        down =
          pointers === 1 && onGame(e) ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
      },
      true,
    );
    const up = (e: PointerEvent) => {
      pointers = Math.max(0, pointers - 1);
      const d = down;
      if (!d || d.id !== e.pointerId) return;
      down = null;
      const now = performance.now();
      if (now - d.t >= FEEL.tapMs || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= FEEL.tapPx || this.pinch) return;
      const double = now - lastTap < FEEL.doubleTapMs;
      lastTap = now;
      this.onTap(e.clientX, e.clientY, double);
    };
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
  }

  /** Two-finger pinch zooms; the joystick sleeps during it and a moment after. */
  private pinchZoom(): void {
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const opts = { capture: true, passive: true };
    addEventListener(
      'touchstart',
      (e) => {
        // a thumb on the stick plus a second finger is never a pinch
        if (e.touches.length !== 2 || this.joyHeld) return;
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

  /** World-space direction, length ≤ 1: the joystick or keys, else a Tap Walk (which any real push cancels). */
  move(w: World): { x: number; z: number } {
    const m = this.manual();
    if (Math.hypot(m.x, m.z) > FEEL.tapCancelPush) this.tap.cancel();
    return this.tap.target ? this.tap.move(w) : m;
  }

  private manual(): { x: number; z: number } {
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
    return (
      this.has('ShiftLeft', 'ShiftRight') ||
      (this.joy.active && this.joy.force > FEEL.sprintForce) ||
      (!!this.tap.target && this.tap.sprint)
    );
  }

  get grab(): boolean {
    return this.keys.has('Space') || this.holding;
  }

  get touch(): boolean {
    return matchMedia('(pointer: coarse)').matches;
  }
}
