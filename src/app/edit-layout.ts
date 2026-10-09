// Edit Layout mode: the paused World, the play camera where you stand. Tap a fixture to lift it, drag it or tap a spot,
// turn it, put it back; Done pays the Moves, Cancel puts everything back for free.
import * as THREE from 'three';
import type { Game } from './game';
import type { Placement } from '../sim/map';
import { stationModel } from '../sim/map';
import type { Station } from '../sim/world';
import { boxCentre, inBox } from '../sim/geometry';
import {
  canPayMoves,
  cashierBox,
  cutOff,
  finishLayout,
  fixtureName,
  movable,
  moveBill,
  movesLeft,
  nextRot,
  payMoves,
  place,
  spotProblem,
  turned,
} from '../sim/layout';
import { FEEL } from '../feel';
import type { LayoutUi } from '../ui/app';

const SNAP = 0.5;
const TAP_SLOP_PX = 6;
/** A tap within this of a fixture's footprint picks it (m). */
const PICK_SLOP = 0.2;

const snap = (v: number): number => Math.round(v / SNAP) * SNAP;
const same = (a: Placement, b: Placement): boolean =>
  a.rot === b.rot && a.box.every((v, i) => Math.abs(v - b.box[i]) < 1e-6);

interface Drag {
  pan: boolean;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  offset: [number, number];
  moved: boolean;
}

export class EditLayout {
  open = false;
  private start = new Map<string, Placement>();
  private picked: { id: string; spot: Placement; why: string | null } | null = null;
  private flash = '';
  private flashUntil = 0;
  private focus = new THREE.Vector3();
  private drag: Drag | null = null;

  constructor(
    private readonly game: Game,
    private readonly joy: HTMLElement,
    /** The panel changed. */
    private readonly changed: () => void,
    /** Done paid for the Moves: save. */
    private readonly paid: () => void,
  ) {
    const canvas = game.stage.renderer.domElement;
    const onWorld = (e: Event) => e.target === canvas || e.target === joy;
    addEventListener('pointerdown', (e) => this.open && onWorld(e) && this.down(e));
    addEventListener('pointermove', (e) => this.open && this.move(e));
    addEventListener('pointerup', (e) => this.open && this.up(e));
    addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'KeyR') this.turn();
      if (e.code === 'Enter') this.done();
    });
  }

  private get w() {
    return this.game.world;
  }

  begin(): void {
    const w = this.w;
    this.open = true;
    this.game.paused = true;
    this.game.input.enabled = false;
    this.joy.style.pointerEvents = 'none';
    this.start = new Map(
      [...w.stations.values()].filter(movable).map((s) => [s.id, { box: [...s.box], rot: s.rot } as Placement]),
    );
    this.focus.set(w.player.x, 0, w.player.z);
    this.game.view.cameraOverride = this.focus;
    this.changed();
  }

  private end(): void {
    this.open = false;
    this.picked = null;
    this.drag = null;
    this.game.view.layoutGhost.hide();
    this.game.view.cameraOverride = null;
    this.game.input.enabled = true;
    this.joy.style.pointerEvents = '';
    this.game.paused = false;
    this.changed();
  }

  private moved(): string[] {
    return [...this.start]
      .filter(([id, s]) => {
        const st = this.w.stations.get(id);
        return st && !same(st, s);
      })
      .map(([id]) => id);
  }

  ui(): LayoutUi | null {
    if (!this.open) return null;
    const n = this.moved().length;
    const bill = moveBill(this.w, n);
    const why = this.picked?.why ?? (performance.now() < this.flashUntil ? this.flash : '');
    return {
      picked: this.picked ? fixtureName(this.picked.id) : null,
      why,
      movesLeft: movesLeft(this.w),
      prices: bill.prices,
      total: bill.total,
      next: bill.next,
      canDone: canPayMoves(this.w, n),
    };
  }

  // ---------- the buttons

  turn(): void {
    const p = this.picked;
    if (!p) return;
    p.spot = { box: turned(p.spot.box), rot: nextRot(p.spot.rot) };
    this.moveTo(...boxCentre(p.spot.box));
  }

  putBack(): void {
    const p = this.picked;
    if (!p) return;
    const from = this.start.get(p.id);
    this.picked = null;
    if (from) place(this.w, p.id, from);
    this.refresh();
  }

  cancel(): void {
    for (const [id, s] of this.start) place(this.w, id, s);
    finishLayout(this.w);
    this.refresh();
    this.end();
  }

  done(): void {
    this.drop();
    const n = this.moved().length;
    if (!canPayMoves(this.w, n)) return this.say(n > movesLeft(this.w) ? 'Not enough Moves left' : 'Not enough Money');
    payMoves(this.w, n);
    this.refresh();
    this.end();
    this.paid();
  }

  /** Esc: put the picked fixture back, or leave without paying. */
  escape(): void {
    if (this.picked) this.putBack();
    else this.cancel();
  }

  // ---------- picking, dragging, dropping

  private say(text: string): void {
    this.flash = text;
    this.flashUntil = performance.now() + FEEL.layoutReasonTime * 1000;
    this.changed();
    setTimeout(this.changed, FEEL.layoutReasonTime * 1000 + 50);
  }

  /** Rebuild the view after the World's places changed; keep the picked one hidden under its ghost. */
  private refresh(): void {
    this.game.view.reset(this.w);
    this.showGhost();
    this.changed();
  }

  private showGhost(): void {
    const p = this.picked;
    const view = this.game.view;
    if (!p) return view.layoutGhost.hide();
    const st = this.w.stations.get(p.id);
    const def = this.w.map.pads[p.id]?.unlocks;
    if (!st || !def) return;
    view.hideStation(p.id, true);
    view.layoutGhost.show(stationModel(this.w.map, def), p.spot, !p.why, cashierBox(this.w, p.id, st, p.spot));
  }

  private pick(st: Station): void {
    this.drop();
    this.picked = { id: st.id, spot: { box: [...st.box], rot: st.rot }, why: null };
    this.showGhost();
    this.changed();
  }

  private moveTo(cx: number, cz: number): void {
    const p = this.picked;
    if (!p) return;
    const b = p.spot.box;
    p.spot = { box: [snap(cx - b[2] / 2), snap(cz - b[3] / 2), b[2], b[3]], rot: p.spot.rot };
    p.why = spotProblem(this.w, p.id, p.spot);
    this.showGhost();
    this.changed();
  }

  /** Lands the picked fixture on a valid spot; on a red one it goes back and the bar says why. */
  private drop(): void {
    const p = this.picked;
    if (!p) return;
    this.picked = null;
    const st = this.w.stations.get(p.id);
    if (!st) return;
    const was: Placement = { box: [...st.box], rot: st.rot };
    let why = p.why;
    if (!why && !same(was, p.spot)) {
      place(this.w, p.id, p.spot);
      why = cutOff(this.w);
      if (why) place(this.w, p.id, was);
    }
    this.refresh();
    if (why) this.say(`${why}: it goes back`);
  }

  private at(e: PointerEvent): [number, number] | null {
    return this.game.stage.floorAt(e.clientX, e.clientY);
  }

  private down(e: PointerEvent): void {
    const p = this.at(e);
    if (!p) return;
    const [x, z] = p;
    const onPicked = !!this.picked && inBox(x, z, this.picked.spot.box, -PICK_SLOP);
    const hit = [...this.w.stations.values()]
      .filter((s) => movable(s) && inBox(x, z, s.box, -PICK_SLOP))
      .sort((a, b) => a.box[2] * a.box[3] - b.box[2] * b.box[3])[0];
    if (!onPicked && hit && hit.id !== this.picked?.id) this.pick(hit);
    const [cx, cz] = this.picked ? boxCentre(this.picked.spot.box) : [0, 0];
    this.drag = {
      pan: !this.picked || (!onPicked && !hit),
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      offset: [cx - x, cz - z],
      moved: false,
    };
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP_PX) d.moved = true;
    const p = this.at(e);
    if (!p) return;
    if (!d.pan) return this.moveTo(p[0] + d.offset[0], p[1] + d.offset[1]);
    // dragging empty floor pans: the floor moves with the finger (both points through the same camera)
    const last = this.game.stage.floorAt(d.lastX, d.lastY);
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    if (!last) return;
    this.focus.x -= p[0] - last[0];
    this.focus.z -= p[1] - last[1];
  }

  private up(e: PointerEvent): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.pan && d.moved) return this.drop();
    // a tap on empty floor sends the picked fixture there
    const p = this.at(e);
    if (d.pan && !d.moved && this.picked && p) {
      this.moveTo(p[0], p[1]);
      this.drop();
    }
  }
}
