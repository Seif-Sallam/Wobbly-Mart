// The cleaning look: the Mop Stand and pedal Trash Bin models, the mop in hand, mopping (ring, suds, shrink),
// stink over waiting Messes, the grumpy bubble over Customers standing in one, and the bin lid.
import * as THREE from 'three';
import type { Box } from '../sim/map';
import type { World } from '../sim/world';
import { distToBox } from '../sim/geometry';
import { inMess } from '../sim/cleaning';
import { TUNING } from '../sim/tuning';
import { FEEL } from '../feel';
import { PALETTE, SHADES } from '../palette';
import type { Character } from './characters';
import type { StationVisual } from './stations';
import { dynamic, mergeStatic } from './merge';
import { cyl, slab } from './shapes';
import { SCREEN_RIGHT } from './stage';
import { CanvasTex, canvasSprite, outlinedText, roundRect } from './text';

const C = SHADES.cleaning;
const basic = (color: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });

/** A flat label (canvas texture) kept out of the merged Station mesh. */
function label(parent: THREE.Object3D, size: number, draw: (g: CanvasRenderingContext2D, w: number) => void) {
  const tex = new CanvasTex(256, 256);
  tex.draw((g, w) => draw(g, w));
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex.texture, transparent: true }),
  );
  parent.add(dynamic(m));
  return m;
}

/** Wooden stick, grey clamp, a head of white strands. Stands on its head at the origin. */
export function mopModel(): THREE.Group {
  const g = new THREE.Group();
  cyl(g, 0.03, 1.35, 'wood', 0, 0.18);
  cyl(g, 0.06, 0.08, C.metal, 0, 0.16);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const strand = cyl(g, 0.03, 0.28, SHADES.white, Math.cos(a) * 0.07, -0.05, Math.sin(a) * 0.07);
    strand.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
  }
  mergeStatic(g);
  return g;
}

/** Blue two-shelf janitor cart on wheels, a spray bottle, a yellow WET A-frame beside it. The free mop is the view's. */
export function buildMopStand(v: StationVisual): void {
  slab(v.body, 0.9, 0.12, 0.55, C.cart, 0, 0.14);
  slab(v.body, 0.9, 0.06, 0.55, C.cart, 0, 0.72);
  for (const [x, z] of [
    [-0.42, -0.25],
    [0.42, -0.25],
    [-0.42, 0.25],
    [0.42, 0.25],
  ]) {
    slab(v.body, 0.05, 0.7, 0.05, C.metal, x, 0.14, z);
    cyl(v.body, 0.07, 0.05, 'ink', x, 0.04, z).rotation.z = Math.PI / 2;
  }
  cyl(v.body, 0.05, 0.22, C.spray, 0.25, 0.78, 0.1, 0.06);
  for (const k of [-1, 1]) {
    const leaf = slab(v.body, 0.36, 0.55, 0.03, C.sign, -0.75, 0, 0.1 + k * 0.07);
    leaf.rotation.x = -k * 0.25;
  }
  const wet = label(v.body, 0.3, (g, w) => outlinedText(g, 'WET', w / 2, w / 2 - 30, 70, PALETTE.ink, PALETTE.cream));
  wet.position.set(-0.75, 0.33, 0.24);
  wet.rotation.x = -0.25;
}

/** Pink pedal bin with a smiley face; the cream lid (`v.lid`) hinges at the back. */
export function buildPedalBin(v: StationVisual): void {
  cyl(v.body, 0.3, 0.8, C.bin);
  slab(v.body, 0.22, 0.04, 0.12, 'ink', 0, 0.03, 0.35);
  const face = label(v.body, 0.4, (g, w) => {
    g.fillStyle = g.strokeStyle = PALETTE.ink;
    for (const x of [w / 2 - 50, w / 2 + 50]) {
      g.beginPath();
      g.arc(x, 100, 16, 0, Math.PI * 2);
      g.fill();
    }
    g.lineWidth = 12;
    g.beginPath();
    g.arc(w / 2, 140, 40, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  });
  face.position.set(0, 0.45, 0.305);
  const lid = dynamic(new THREE.Group());
  cyl(lid, 0.31, 0.08, 'cream', 0, 0, 0.31);
  lid.position.set(0, 0.8, -0.31);
  v.body.add(lid);
  v.lid = lid;
}

/** A flat ring that fills clockwise from the top; rebuilt only when its fill changes by a 40th. */
class FillRing {
  readonly mesh: THREE.Mesh;
  private shown = -1;

  constructor(
    private readonly inner: number,
    private readonly outer: number,
    color: string,
  ) {
    const mat = basic(color, 0.9);
    mat.side = THREE.DoubleSide; // it fills clockwise, so its faces point down
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 3;
  }

  set(fill: number): void {
    const k = Math.max(0.001, Math.round(fill * 40) / 40);
    if (k === this.shown) return;
    this.shown = k;
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.RingGeometry(this.inner, this.outer, 40, 1, Math.PI / 2, -k * Math.PI * 2);
  }
}

/** A mop held at a Character's side; swishes side to side while mopping. */
export class HeldMop {
  readonly mop = mopModel();
  private swish = 0;

  constructor(ch: Character) {
    ch.root.add(this.mop);
    this.update(0, false, false);
  }

  update(dt: number, held: boolean, mopping: boolean): void {
    this.mop.visible = held;
    if (!mopping) {
      this.mop.rotation.set(0.25, 0, -0.15);
      this.mop.position.set(0.35, 0, 0.25);
      return;
    }
    this.swish += dt * FEEL.mopSwish;
    this.mop.rotation.set(0.35, Math.sin(this.swish) * 0.9, Math.sin(this.swish) * 0.25);
    this.mop.position.set(0.35 + Math.sin(this.swish) * 0.15, 0, 0.45);
  }
}

const MAX_MESSES = 24;
const FLIES = 3;
const LINES = 2;

/** Three buzzing flies with flapping wings and two rising stink lines over every waiting Mess, in three draw calls. */
class Stink {
  readonly group = new THREE.Group();
  private bodies: THREE.InstancedMesh;
  private wings: THREE.InstancedMesh;
  private lines: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private size = new THREE.Vector3();

  constructor() {
    const pts = Array.from({ length: 10 }, (_, k) => new THREE.Vector3(Math.sin(k * 0.9) * 0.06, k * 0.06, 0));
    const wingMat = basic(SHADES.white, 0.7);
    wingMat.side = THREE.DoubleSide;
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.frustumCulled = false;
      im.count = 0;
      this.group.add(im);
      return im;
    };
    this.bodies = make(new THREE.SphereGeometry(0.045, 8, 6), basic(PALETTE.ink), MAX_MESSES * FLIES);
    this.wings = make(new THREE.PlaneGeometry(0.08, 0.05), wingMat, MAX_MESSES * FLIES);
    this.lines = make(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.02, 6),
      basic(SHADES.cleaning.stink, 0.8),
      MAX_MESSES * LINES,
    );
  }

  update(t: number, messes: { x: number; z: number }[]): void {
    const list = messes.slice(0, MAX_MESSES);
    list.forEach((mess, i) => {
      for (let f = 0; f < FLIES; f++) {
        const a = t * 4 + (f / FLIES) * Math.PI * 2 + i;
        this.v.set(
          mess.x + Math.cos(a) * FEEL.flyRadius,
          0.45 + Math.sin(a * 2.3) * 0.12,
          mess.z + Math.sin(a) * FEEL.flyRadius,
        );
        this.bodies.setMatrixAt(i * FLIES + f, this.m.makeTranslation(this.v));
        this.q.setFromEuler(this.e.set(Math.sin(t * 60 + f) * 0.8, 0, 0));
        this.wings.setMatrixAt(i * FLIES + f, this.m.compose(this.v.setY(this.v.y + 0.03), this.q, this.one));
      }
      // each line rises and swells then shrinks away, in place of a fade
      for (let l = 0; l < LINES; l++) {
        const k = (t * 0.6 + l + i * 0.37) % 1;
        const size = Math.max(0.01, Math.sin(k * Math.PI));
        this.v.set(mess.x + (l - 0.5) * 0.25, 0.15 + k * 0.6, mess.z);
        this.lines.setMatrixAt(i * LINES + l, this.m.compose(this.v, this.q.identity(), this.size.setScalar(size)));
      }
    });
    this.bodies.count = this.wings.count = list.length * FLIES;
    this.lines.count = list.length * LINES;
    for (const im of [this.bodies, this.wings, this.lines]) im.instanceMatrix.needsUpdate = true;
  }
}

/** The grumpy bubble: a scowl and 💢, redder with `k` 0–1. */
function drawBubble(tex: CanvasTex, k: number): void {
  tex.draw((c, w, h) => {
    const r = Math.round(255 - 40 * k);
    c.fillStyle = `rgb(255,${r - 10 * k},${r - 60 * k})`;
    c.strokeStyle = PALETTE.ink;
    c.lineWidth = 10;
    roundRect(c, 14, 14, w - 28, h - 50, 60);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(w / 2 - 22, h - 38);
    c.lineTo(w / 2, h - 8);
    c.lineTo(w / 2 + 22, h - 38);
    c.fill();
    c.stroke();
    c.lineWidth = 12;
    const y = h / 2 - 18;
    c.beginPath();
    c.moveTo(w / 2 - 70, y - 22 - 14 * k);
    c.lineTo(w / 2 - 22, y - 6);
    c.moveTo(w / 2 + 70, y - 22 - 14 * k);
    c.lineTo(w / 2 + 22, y - 6);
    c.stroke();
    c.fillStyle = PALETTE.ink;
    for (const x of [w / 2 - 42, w / 2 + 42]) {
      c.beginPath();
      c.arc(x, y + 16, 10, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(w / 2, y + 90, 40, 1.15 * Math.PI, 1.85 * Math.PI);
    c.stroke();
    c.font = `${Math.round(70 + 40 * k)}px system-ui`;
    c.textAlign = 'center';
    c.fillText('💢', w - 70, 90);
  });
}

interface Bubble {
  s: THREE.Sprite;
  tex: CanvasTex;
  inFor: number;
  outFor: number;
  drawn: number;
}

interface Bin {
  ring: FillRing;
  open: number;
  trashed: boolean;
}

/** What the cleaning look reads from the WorldView each frame. */
export interface CleaningContext {
  w: World;
  splats: Map<number, THREE.Object3D>;
  stations: Map<string, StationVisual>;
  /** Where a Customer is drawn this frame. */
  customerAt: (id: number) => THREE.Vector3 | undefined;
  /** Squash-and-spring a Station (the bin's slam). */
  bounce: (id: string) => void;
  puff: (at: THREE.Vector3, color: string, count: number, spread: number) => void;
}

export class CleaningLook {
  readonly group = new THREE.Group();
  private standMop = mopModel();
  private rings = new Map<number, FillRing>();
  private seen = new Map<number, number>();
  private stink = new Stink();
  private bubbles = new Map<number, Bubble>();
  private bins = new Map<string, Bin>();
  private suds: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private sudGeo = new THREE.SphereGeometry(0.06, 8, 6);
  private sudMat = basic(SHADES.white, 0.9);
  private t = 0;

  constructor() {
    this.group.add(this.standMop, this.stink.group);
  }

  reset(): void {
    for (const o of [...this.group.children]) if (o !== this.standMop && o !== this.stink.group) this.group.remove(o);
    for (const b of this.bubbles.values()) b.tex.texture.dispose();
    this.rings.clear();
    this.seen.clear();
    this.bubbles.clear();
    this.bins.clear();
    this.suds = [];
  }

  /** Items went into this bin while it was open: the lid slam puffs. */
  trashed(bin: string): void {
    const b = this.bins.get(bin);
    if (b) b.trashed = true;
  }

  update(dt: number, ctx: CleaningContext): void {
    this.t += dt;
    const w = ctx.w;
    const stand = [...w.stations.values()].find((s) => s.kind === 'mopStand');
    this.standMop.visible = !!stand && !w.player.mop;
    if (stand) this.standMop.position.set(stand.box[0] + 0.35, 0.3, stand.box[1] + 0.55);
    this.standMop.rotation.z = -0.1;
    this.updateMesses(dt, ctx);
    this.updateBubbles(dt, ctx);
    this.updateBins(dt, ctx);
  }

  private updateMesses(dt: number, ctx: CleaningContext): void {
    const live = new Set<number>();
    for (const m of ctx.w.messes) {
      live.add(m.id);
      ctx.splats.get(m.id)?.scale.setScalar(1 - (1 - FEEL.messShrinkTo) * m.progress);
      if (m.progress <= 0) continue;
      let ring = this.rings.get(m.id);
      if (!ring) {
        ring = new FillRing(0.7, 0.85, C.ring);
        ring.mesh.position.set(m.x, 0.06, m.z);
        this.group.add(ring.mesh);
        this.rings.set(m.id, ring);
      }
      ring.set(m.progress);
      // suds while someone is mopping it
      if (m.progress > (this.seen.get(m.id) ?? 0) && Math.random() < FEEL.mopSuds * dt) {
        const s = new THREE.Mesh(this.sudGeo, this.sudMat);
        s.position.set(m.x + (Math.random() - 0.5) * 0.8, 0.08, m.z + (Math.random() - 0.5) * 0.8);
        this.group.add(s);
        const v = new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          0.5 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.3,
        );
        this.suds.push({ m: s, v, life: 0.8 });
      }
      this.seen.set(m.id, m.progress);
    }
    this.stink.update(this.t, ctx.w.messes);
    for (const [id, ring] of this.rings) {
      if (live.has(id)) continue;
      this.group.remove(ring.mesh);
      this.rings.delete(id);
      this.seen.delete(id);
    }
    for (const s of this.suds) {
      s.life -= dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.scale.setScalar(Math.max(0.01, s.life * 1.4));
      if (s.life <= 0) this.group.remove(s.m);
    }
    this.suds = this.suds.filter((s) => s.life > 0);
  }

  private updateBubbles(dt: number, ctx: CleaningContext): void {
    const size = FEEL.bubbleSize;
    for (const c of ctx.w.customers) {
      const here = inMess(ctx.w, c.x, c.z);
      let b = this.bubbles.get(c.id);
      if (here && !b) {
        const tex = new CanvasTex(320, 280);
        b = { s: canvasSprite(tex, size), tex, inFor: 0, outFor: 0, drawn: -1 };
        this.group.add(b.s);
        this.bubbles.set(c.id, b);
      }
      if (!b) continue;
      if (here) {
        b.inFor += dt;
        b.outFor = 0;
      } else b.outFor += dt;
      const k = Math.min(1, b.inFor / FEEL.bubbleAnger);
      const step = Math.round(k * 20) / 20;
      if (step !== b.drawn) {
        b.drawn = step;
        drawBubble(b.tex, step);
      }
      const at = ctx.customerAt(c.id);
      const fade = Math.max(0, 1 - b.outFor / FEEL.bubbleFade);
      if (!at || fade === 0) {
        this.dropBubble(c.id, b);
        continue;
      }
      // beside the receipt card, to its right on screen
      const side = 0.55 + size * 0.6;
      const shake = Math.sin(this.t * 40) * 0.03 * k;
      b.s.position.set(
        at.x + SCREEN_RIGHT.x * side + shake,
        2 + Math.sin(this.t * 6) * 0.03,
        at.z + SCREEN_RIGHT.y * side,
      );
      const pop = Math.min(1, b.inFor * 6) * size * (1 + 0.25 * k);
      b.s.scale.set(pop * (b.tex.canvas.width / b.tex.canvas.height), pop, 1);
      (b.s.material as THREE.SpriteMaterial).opacity = fade;
    }
    for (const [id, b] of this.bubbles) if (!ctx.w.customers.some((c) => c.id === id)) this.dropBubble(id, b);
  }

  private dropBubble(id: number, b: Bubble): void {
    this.group.remove(b.s);
    b.tex.texture.dispose();
    this.bubbles.delete(id);
  }

  /** Lid opens and wobbles while someone stands at the bin, the hold ring fills, the lid slams when they leave. */
  private updateBins(dt: number, ctx: CleaningContext): void {
    const w = ctx.w;
    const p = w.player;
    for (const st of w.stations.values()) {
      if (st.kind !== 'trash') continue;
      const lid = ctx.stations.get(st.id)?.lid;
      if (!lid) continue;
      let b = this.bins.get(st.id);
      if (!b) {
        b = { ring: new FillRing(0.55, 0.68, PALETTE.orange), open: 0, trashed: false };
        b.ring.mesh.position.set(st.box[0] + st.box[2] / 2, 0.04, st.box[1] + st.box[3] / 2);
        this.group.add(b.ring.mesh);
        this.bins.set(st.id, b);
      }
      const near = (a: { x: number; z: number }, box: Box) => distToBox(a.x, a.z, box) <= TUNING.reach;
      const player = near(p, st.box);
      const here = player || w.stockers.some((s) => near(s, st.box) && s.job?.sink === st.id);
      if (b.open > 0.5 && !here) {
        ctx.bounce(st.id);
        if (b.trashed) ctx.puff(lid.getWorldPosition(new THREE.Vector3()).setY(1), PALETTE.cream, 8, 1);
        b.trashed = false;
      }
      b.open += ((here ? 1 : 0) - b.open) * Math.min(1, dt * (here ? 8 : 18));
      const wobble = here ? Math.sin(this.t * 18) * 0.12 : 0;
      lid.rotation.x = -b.open * (FEEL.binLidOpen + wobble);
      b.ring.mesh.visible = player && p.stack.length > 0;
      if (b.ring.mesh.visible) b.ring.set(p.trashHold / TUNING.trashHoldTime);
    }
  }
}
