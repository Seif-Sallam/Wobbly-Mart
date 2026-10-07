// Mirrors the sim into the scene every frame; turns sim events into motion (flying Items, springs, puffs, numbers).
import * as THREE from 'three';
import type { Mover, Ref, SimEvent, World } from '../sim/world';
import type { Box, Point } from '../sim/map';
import { stationModel } from '../sim/map';
import { boxCentre } from '../sim/geometry';
import { areaOf, walkAgent } from '../sim/walk';
import { cashPilePoint, padRemaining, stackCap, visiblePads } from '../sim/economy';
import { Stage } from './stage';
import { Level } from './level';
import { Juice } from './juice';
import { Character } from './characters';
import { PadVisual } from './pads';
import { buildStation, ghostify, type StationVisual } from './stations';
import { InstancedModel, billModel, itemModel } from './instanced';
import { model } from './assets';
import { StationBatch } from './station-batch';
import { CanvasTex, canvasSprite, outlinedText, roundRect } from './text';
import { icon } from './thumbs';
import { paletteMaterial } from './materials';
import { Tweens, ease } from '../tween';
import { FEEL } from '../feel';
import { PALETTE, SHADES, withAlpha } from '../palette';
import { TUNING } from '../sim/tuning';

const CUSTOMER_MODELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => `customer-${k}`);
const ROLE_CAP = { cashier: 'orange', stocker: 'money' } as const;
const BILL_VALUE = 5;
const PILE_MAX_BILLS = 24;
const CART_SCALE = 0.7;
const LOOSE_Y = 0.15;
const LOOSE_TILT = new THREE.Vector2(1.2, 0);

interface Flight {
  product: string;
  from: THREE.Vector3;
  to: () => THREE.Vector3;
  t: number;
  key: string;
  bill?: boolean;
}

interface StackLook {
  lean: THREE.Vector2;
  leanVel: THREE.Vector2;
  prevVel: THREE.Vector2;
}

interface CustomerLook {
  ch: Character;
  bubble: THREE.Sprite;
  tex: CanvasTex;
  drawn: string;
  stack: StackLook;
}

const newStack = (): StackLook => ({
  lean: new THREE.Vector2(),
  leanVel: new THREE.Vector2(),
  prevVel: new THREE.Vector2(),
});

export class WorldView {
  readonly level: Level;
  readonly juice = new Juice();
  readonly tweens = new Tweens();
  readonly root = new THREE.Group();
  private stations = new Map<string, StationVisual>();
  private pads = new Map<string, PadVisual>();
  private items = new Map<string, InstancedModel>();
  private plants = new Map<string, InstancedModel>();
  private batch = new StationBatch();
  private puffTimers = new Map<string, number>();
  private wanderers: { ch: Character; mover: Mover; target: Point }[] = [];
  private bills: InstancedModel;
  private blobs: THREE.InstancedMesh;
  private splats = new Map<number, THREE.Object3D>();
  private player: Character;
  private playerStack = newStack();
  private sprintPuff = 0;
  private customers = new Map<number, CustomerLook>();
  private staff = new Map<string, { ch: Character; stack: StackLook }>();
  private flights: Flight[] = [];
  private pending = new Map<string, number>();
  private ownedKey = '';
  private maxTag: THREE.Sprite;
  private officeMark: THREE.Sprite;
  private arrow: THREE.Mesh;
  private ghosts: THREE.Object3D[] = [];
  private prev = new Map<string, Point>();
  private time = 0;
  /** Set by the app: tutorial / guidance target point, or null. */
  arrowTarget: THREE.Vector3 | null = null;
  officeAlert = false;
  /** When set, the camera looks here instead of following the Player (title screen). */
  cameraOverride: THREE.Vector3 | null = null;
  private camFocus = new THREE.Vector3();

  constructor(
    private readonly stage: Stage,
    private w: World,
  ) {
    this.level = new Level(w.map.layout, (b: Box) => areaOf(this.w, b), w.map.start.owned);
    this.root.add(this.level.group, this.juice.group, this.batch.group);
    stage.scene.add(this.root);
    for (const [id, p] of Object.entries(w.map.products)) {
      void id;
      if (!this.items.has(p.model)) this.items.set(p.model, new InstancedModel(itemModel(p.model), 500, this.root));
    }
    this.bills = new InstancedModel(billModel(), 600, this.root);
    for (const name of ['tomato-bush', 'wheat-plant'])
      this.plants.set(name, new InstancedModel(model(name), 64, this.root, false));
    this.blobs = this.makeBlobs();
    this.player = new Character('player', { hat: 'orange' });
    this.root.add(this.player.root);
    this.maxTag = this.tag('MAX', PALETTE.orange);
    this.officeMark = this.tag('!', PALETTE.orange);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 16), paletteMaterial('orange'));
    this.arrow.rotation.x = Math.PI;
    this.arrow.castShadow = true;
    this.root.add(this.arrow);
    this.reset(w);
  }

  /** Point the view at a (new) World, e.g. after a reload. Clears everything dynamic. */
  reset(w: World): void {
    this.w = w;
    for (const v of this.stations.values()) this.root.remove(v.root);
    for (const p of this.pads.values()) this.root.remove(p.group);
    for (const c of this.customers.values()) this.root.remove(c.ch.root, c.bubble);
    for (const s of this.staff.values()) this.root.remove(s.ch.root);
    for (const m of this.splats.values()) this.root.remove(m);
    this.stations.clear();
    this.batch.clear();
    this.pads.clear();
    this.customers.clear();
    this.staff.clear();
    this.splats.clear();
    this.flights = [];
    this.pending.clear();
    this.ownedKey = '';
    this.player.facing = Math.PI;
    this.camFocus.set(w.player.x, 0, w.player.z);
    this.syncOwned(false);
  }

  private tag(text: string, color: string): THREE.Sprite {
    const tex = new CanvasTex(256, 128);
    tex.draw((g, w, h) => {
      g.fillStyle = PALETTE.cream;
      roundRect(g, 20, 14, w - 40, h - 28, 40);
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = PALETTE.ink;
      g.stroke();
      outlinedText(g, text, w / 2, h / 2 + 4, 66, color);
    });
    const s = canvasSprite(tex, 0.55);
    s.visible = false;
    this.root.add(s);
    return s;
  }

  private makeBlobs(): THREE.InstancedMesh {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, withAlpha(PALETTE.ink, 0.45));
    grad.addColorStop(1, withAlpha(PALETTE.ink, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(geo, mat, 64);
    m.frustumCulled = false;
    this.root.add(m);
    return m;
  }

  /** Record positions before sim steps, for smooth interpolation. */
  beforeSteps(): void {
    const w = this.w;
    this.prev.set('player', [w.player.x, w.player.z]);
    for (const c of w.customers) this.prev.set(`c${c.id}`, [c.x, c.z]);
    for (const s of w.stockers) this.prev.set(s.id, [s.x, s.z]);
  }

  private lerp(key: string, x: number, z: number, alpha: number): Point {
    const p = this.prev.get(key);
    return p ? [p[0] + (x - p[0]) * alpha, p[1] + (z - p[1]) * alpha] : [x, z];
  }

  // ---------- ownership → stations, pads, level

  private syncOwned(animate: boolean): void {
    const w = this.w;
    const key = [...w.owned, ...w.stations.keys()].join(',') + `|${w.complete}`;
    if (key === this.ownedKey) return;
    this.ownedKey = key;
    this.level.setOwned(w.owned, animate);
    this.level.showParty(w.complete);
    for (const st of w.stations.values()) {
      if (this.stations.has(st.id)) continue;
      const def = w.map.pads[st.id]?.unlocks ?? w.map.freeStations[st.id]?.unlocks;
      const name = def ? stationModel(w.map, def) : null;
      if (!name) continue;
      const v = buildStation(name, st.box, st.rot);
      this.stations.set(st.id, v);
      this.root.add(v.root);
      this.batch.add(st.id, v.body, v.root.position);
      if (animate) {
        const id = st.id;
        const grow = (k: number) => {
          v.body.scale.setScalar(Math.max(0.01, k));
          this.batch.setScale(id, Math.max(0.01, k), Math.max(0.01, k));
        };
        grow(0.01);
        this.tweens.add(0.45, grow, { ease: (t) => ease.outBack(t, FEEL.springOvershoot * 1.5) });
        this.juice.puff(v.root.position.clone().setY(0.3), PALETTE.path, 10, 1.6);
      }
    }
    for (const [id, pad] of this.pads) {
      if (!w.owned.has(id)) continue;
      this.root.remove(pad.group);
      this.pads.delete(id);
    }
  }

  private padFor(id: string): PadVisual {
    let pad = this.pads.get(id);
    if (pad) return pad;
    const w = this.w;
    const place = w.map.layout.places[id];
    const def = w.map.pads[id].unlocks;
    const name = stationModel(w.map, def);
    let ghost: THREE.Object3D | null = null;
    if (name) {
      const v = buildStation(name, place.box, place.rot);
      ghostify(v.root);
      v.root.position.set(0, 0, 0);
      ghost = v.root;
    }
    const iconName =
      name ?? (def.kind === 'cashier' || def.kind === 'stocker' ? 'employee' : def.kind === 'exit' ? 'van' : 'area');
    const [x, z] = boxCentre(place.box);
    pad = new PadVisual(x, z, iconName, ghost);
    this.pads.set(id, pad);
    this.root.add(pad.group);
    return pad;
  }

  /** Pulsing ghosts of everything an Area will hold, during its Area Pan. */
  private syncGhosts(): void {
    const pan = this.w.pan;
    if (!pan && this.ghosts.length) {
      for (const g of this.ghosts) this.root.remove(g);
      this.ghosts = [];
    }
    if (!pan || this.ghosts.length) return;
    const w = this.w;
    for (const [id, pad] of Object.entries(w.map.pads)) {
      const place = w.map.layout.places[id];
      if (w.owned.has(id) || areaOf(w, place.box) !== pan.area) continue;
      const name = stationModel(w.map, pad.unlocks);
      if (!name) continue;
      const v = buildStation(name, place.box, place.rot);
      ghostify(v.root, 0.4);
      this.ghosts.push(v.root);
      this.root.add(v.root);
    }
  }

  // ---------- positions of things Items fly between

  private stackSlot(x: number, z: number, facing: number, look: StackLook, i: number, scale = 1): THREE.Vector3 {
    const h = FEEL.stackBase * scale + i * FEEL.itemSpacing * scale;
    const above = Math.max(0, i - FEEL.stackRigid) * FEEL.itemSpacing * scale;
    const bend = above ** FEEL.bendPower * FEEL.bendGain;
    const t = performance.now() / 1000;
    const jiggle = FEEL.jiggle * above;
    return new THREE.Vector3(
      x +
        Math.sin(facing) * FEEL.stackForward * scale +
        look.lean.x * bend +
        Math.sin(t * FEEL.jiggleSpeed + i * 0.35) * jiggle,
      h,
      z +
        Math.cos(facing) * FEEL.stackForward * scale +
        look.lean.y * bend +
        Math.cos(t * FEEL.jiggleSpeed * 0.8 + i * 0.3) * jiggle,
    );
  }

  private local(v: StationVisual, p: THREE.Vector3): THREE.Vector3 {
    return p.clone().applyMatrix4(v.root.matrixWorld);
  }

  private refPos(ref: Ref, product: string, index: number): THREE.Vector3 {
    const w = this.w;
    if ('agent' in ref) {
      if (ref.agent === 'player')
        return this.stackSlot(w.player.x, w.player.z, this.player.facing, this.playerStack, index);
      const s = w.stockers.find((o) => o.id === ref.id);
      const look = this.staff.get(ref.id);
      return s && look ? this.stackSlot(s.x, s.z, look.ch.facing, look.stack, index) : new THREE.Vector3();
    }
    if ('customer' in ref) {
      const c = w.customers.find((o) => o.id === ref.customer);
      const look = this.customers.get(ref.customer);
      return c && look ? this.stackSlot(c.x, c.z, look.ch.facing, look.stack, index, CART_SCALE) : new THREE.Vector3();
    }
    if ('loose' in ref) {
      const it = w.loose.find((o) => o.id === ref.loose) ?? w.player;
      return new THREE.Vector3(it.x, LOOSE_Y, it.z);
    }
    const st = w.stations.get(ref.station);
    const v = this.stations.get(ref.station);
    if (!st || !v) return new THREE.Vector3();
    v.root.updateMatrixWorld();
    if (st.kind === 'shelf')
      return this.local(v, v.slots[Math.min(index, v.slots.length - 1)] ?? new THREE.Vector3(0, 1, 0));
    if (st.kind === 'producer') {
      const type = w.map.producers[st.type];
      if (type.inputs.includes(product) && product !== type.output) {
        const k = type.inputs.indexOf(product);
        const slots = v.inputSlots;
        return this.local(v, slots[(index + k * 3) % Math.max(1, slots.length)] ?? new THREE.Vector3(0, 0.5, 0));
      }
      if (st.plants.length) {
        const i = st.plants.reduce((best, t, j) => (t > st.plants[best] ? j : best), 0);
        return this.local(v, (v.plants[i] ?? new THREE.Vector3()).clone().setY(0.6));
      }
      return this.local(v, v.slots[Math.min(index, v.slots.length - 1)] ?? new THREE.Vector3(0, 0.5, 0));
    }
    return this.local(v, new THREE.Vector3(0, 0.9, 0));
  }

  private containerKey(ref: Ref, product: string): string {
    if ('agent' in ref) return ref.agent === 'player' ? 'stack:player' : `stack:${ref.id}`;
    if ('customer' in ref) return `cart:${ref.customer}`;
    if ('loose' in ref) return `loose:${ref.loose}`;
    const st = this.w.stations.get(ref.station);
    if (st?.kind === 'producer' && w_isInput(this.w, st.type, product)) return `input:${ref.station}:${product}`;
    return `st:${ref.station}`;
  }

  private count(ref: Ref, product: string): number {
    const w = this.w;
    if ('agent' in ref) {
      if (ref.agent === 'player') return w.player.stack.length;
      return w.stockers.find((s) => s.id === ref.id)?.stack.length ?? 0;
    }
    if ('customer' in ref) return w.customers.find((c) => c.id === ref.customer)?.cart.length ?? 0;
    if ('loose' in ref) return w.loose.some((o) => o.id === ref.loose) ? 1 : 0;
    const st = w.stations.get(ref.station);
    if (st?.kind === 'shelf') return st.items;
    if (st?.kind === 'producer') return w_isInput(w, st.type, product) ? (st.input[product] ?? 0) : st.tray;
    return 0;
  }

  private shown(key: string, actual: number): number {
    return Math.max(0, actual - (this.pending.get(key) ?? 0));
  }

  // ---------- events

  private onEvent(e: SimEvent): void {
    const w = this.w;
    switch (e.type) {
      case 'transfer': {
        if ('loose' in e.to) this.player.emote('no');
        const fromCount = this.count(e.from, e.product);
        const from = this.refPos(e.from, e.product, fromCount);
        const key = this.containerKey(e.to, e.product);
        const index = this.count(e.to, e.product) - 1;
        this.pending.set(key, (this.pending.get(key) ?? 0) + 1);
        this.flights.push({ product: e.product, from, to: () => this.refPos(e.to, e.product, index), t: 0, key });
        break;
      }
      case 'trashed': {
        const from = this.refPos(e.from, e.product, this.count(e.from, e.product));
        const trash = w.stations.get('trash');
        const [x, z] = trash ? boxCentre(trash.box) : [from.x, from.z];
        this.flights.push({ product: e.product, from, to: () => new THREE.Vector3(x, 0.7, z), t: 0, key: '' });
        break;
      }
      case 'padBought':
        this.syncOwned(true);
        if (e.pad === 'exit') {
          const van = this.level.van;
          this.tweens.add(1.2, (k) => {
            van.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 0.6;
            van.scale.set(1 + Math.sin(k * Math.PI * 6) * 0.04 * (1 - k), 1, 1);
          });
        }
        break;
      case 'produced': {
        const st = w.stations.get(e.station);
        const v = this.stations.get(e.station);
        if (st?.kind !== 'producer' || !v) break;
        const kind = w.map.producers[st.type].kind;
        if (kind === 'animal') this.juice.puff(v.root.position.clone().setY(0.6), SHADES.white, 4, 0.8);
        if (kind === 'machine')
          this.juice.puff(
            v.root.position.clone().setY(1.2),
            st.type === 'mill' ? SHADES.splat.flour : SHADES.steam,
            3,
            0.4,
          );
        break;
      }
      case 'paid': {
        const st = w.stations.get(e.register);
        if (!st) break;
        const [x, z] = boxCentre(st.box);
        this.juice.money(e.register, e.amount, new THREE.Vector3(x, 1.8, z));
        this.juice.coin(new THREE.Vector3(x, 1.2, z));
        this.customers.get(e.customer)?.ch.emote('yes');
        break;
      }
      case 'cashCollect': {
        const [x, z] = cashPilePoint(w, e.register);
        const bills = Math.min(PILE_MAX_BILLS, Math.ceil(e.amount / BILL_VALUE));
        const each = e.amount / bills;
        for (let i = 0; i < bills; i++) {
          const delay = (i / bills) * e.duration;
          this.tweens.add(0.001, () => {}, {
            delay,
            done: () => {
              this.flights.push({
                product: '',
                bill: true,
                from: new THREE.Vector3(x, 0.1 + (bills - i) * 0.07, z),
                to: () => new THREE.Vector3(w.player.x, 1.2, w.player.z),
                t: 0,
                key: '',
              });
              this.juice.money('player', each, new THREE.Vector3(w.player.x, 2.2, w.player.z));
            },
          });
        }
        this.juice.coin(new THREE.Vector3(x, 0.5, z));
        this.pileHidden.set(e.register, { total: bills, t: 0, duration: e.duration });
        break;
      }
      case 'angry':
        this.customers.get(e.customer)?.ch.emote('no');
        break;
      case 'mess': {
        const m = w.messes.find((o) => o.id === e.mess);
        if (m) this.addSplat(m.id, m.x, m.z, m.items);
        this.customers.get(e.customer)?.ch.emote('no');
        break;
      }
      case 'messCleared': {
        const s = this.splats.get(e.mess);
        if (s) {
          this.juice.puff(s.position.clone().setY(0.2), PALETTE.cream, 6, 1);
          this.root.remove(s);
          this.splats.delete(e.mess);
        }
        break;
      }
      case 'complete':
        this.syncOwned(true);
        break;
    }
  }

  private pileHidden = new Map<string, { total: number; t: number; duration: number }>();

  private addSplat(id: number, x: number, z: number, items: string[]): void {
    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    const shape = new THREE.Shape();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 0.45 + Math.random() * 0.25;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const splat = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      paletteMaterial(SHADES.splat[items[0]] ?? PALETTE.dirt),
    );
    splat.rotation.x = -Math.PI / 2;
    splat.receiveShadow = true;
    g.add(splat);
    for (const [i, p] of items.slice(0, 3).entries()) {
      const it = itemModel(this.w.map.products[p]?.model ?? p);
      it.position.set(Math.cos(i * 2.1) * 0.3, 0.05, Math.sin(i * 2.1) * 0.3);
      it.rotation.set(Math.PI / 2, i, 0);
      g.add(it);
    }
    this.root.add(g);
    this.splats.set(id, g);
  }

  // ---------- per frame

  update(dt: number, alpha: number, events: SimEvent[]): void {
    const w = this.w;
    this.time += dt;
    this.tweens.update(dt);
    for (const e of events) this.onEvent(e);
    this.syncOwned(true);
    this.syncGhosts();
    this.syncPads(dt);
    this.syncCharacters(dt, alpha);
    this.drawItems(dt);
    for (const [id, v] of this.stations) {
      const st = w.stations.get(id);
      const working = st?.kind === 'producer' && st.work > 0;
      v.animate(dt, working);
      for (const m of v.mixers) m.update(dt);
      // steam / flour puffs while a Machine works
      if (working && st.kind === 'producer' && w.map.producers[st.type].kind === 'machine') {
        const t = (this.puffTimers.get(id) ?? 0) + dt;
        this.puffTimers.set(id, t % 0.7);
        if (t >= 0.7)
          this.juice.puff(
            v.root.position.clone().setY(1.3),
            st.type === 'mill' ? SHADES.splat.flour : SHADES.white,
            2,
            0.3,
          );
      }
    }
    this.updateScenery(dt);
    this.juice.update(dt);
    const near: Point[] = [
      [w.player.x, w.player.z],
      ...w.customers.map((c): Point => [c.x, c.z]),
      ...w.stockers.map((s): Point => [s.x, s.z]),
    ];
    this.level.update(dt, near);
    this.updateMarkers();
    this.updateCamera(dt);
  }

  private syncPads(dt: number): void {
    const w = this.w;
    const visible = new Set(visiblePads(w));
    for (const [id, pad] of this.pads) {
      if (visible.has(id)) continue;
      this.root.remove(pad.group);
      this.pads.delete(id);
    }
    for (const id of visible) {
      const pad = this.padFor(id);
      const [x, z] = boxCentre(w.map.layout.places[id].box);
      const standing = Math.abs(w.player.x - x) < TUNING.padHalfSize && Math.abs(w.player.z - z) < TUNING.padHalfSize;
      pad.update(dt, padRemaining(w, id), w.map.pads[id].cost, standing);
    }
  }

  private updateStack(look: StackLook, vx: number, vz: number, dt: number): void {
    const ax = (vx - look.prevVel.x) / Math.max(dt, 1e-4);
    const az = (vz - look.prevVel.y) / Math.max(dt, 1e-4);
    look.prevVel.set(vx, vz);
    const acc = new THREE.Vector2(ax, az).clampLength(0, 60);
    look.leanVel.x += (-FEEL.swayStiffness * look.lean.x - FEEL.swayDamping * look.leanVel.x - acc.x * FEEL.sway) * dt;
    look.leanVel.y += (-FEEL.swayStiffness * look.lean.y - FEEL.swayDamping * look.leanVel.y - acc.y * FEEL.sway) * dt;
    look.lean.addScaledVector(look.leanVel, dt);
    look.lean.clampLength(0, FEEL.leanMax);
  }

  private syncCharacters(dt: number, alpha: number): void {
    const w = this.w;
    const [px, pz] = this.lerp('player', w.player.x, w.player.z, alpha);
    this.player.update(dt, px, pz, w.player.vx, w.player.vz, w.player.stack.length > 0);
    this.updateStack(this.playerStack, w.player.vx, w.player.vz, dt);
    this.sprintPuff -= dt;
    if (w.player.sprinting && this.sprintPuff <= 0) {
      this.sprintPuff = FEEL.sprintPuffGap;
      this.juice.puff(new THREE.Vector3(px, 0.1, pz), PALETTE.cream, 2, 0.5);
    }

    const alive = new Set<number>();
    for (const c of w.customers) {
      alive.add(c.id);
      let look = this.customers.get(c.id);
      if (!look) {
        const name = CUSTOMER_MODELS[Math.floor(c.look * CUSTOMER_MODELS.length)];
        const ch = new Character(name, {
          tint: SHADES.customerTints[Math.floor(c.look * 97) % SHADES.customerTints.length],
        });
        const tex = new CanvasTex(192, 128);
        const bubble = canvasSprite(tex, 0.6);
        this.root.add(ch.root, bubble);
        look = { ch, bubble, tex, drawn: '', stack: newStack() };
        this.customers.set(c.id, look);
      }
      const [x, z] = this.lerp(`c${c.id}`, c.x, c.z, alpha);
      look.ch.update(dt, x, z, c.vx, c.vz, c.cart.length > 0);
      this.updateStack(look.stack, c.vx, c.vz, dt);
      look.bubble.position.set(x, 2.05, z);
      this.drawBubble(look, c);
    }
    for (const [id, look] of this.customers) {
      if (alive.has(id)) continue;
      this.root.remove(look.ch.root, look.bubble);
      look.tex.texture.dispose();
      this.customers.delete(id);
    }
    for (const s of w.stockers) {
      let look = this.staff.get(s.id);
      if (!look) {
        look = { ch: new Character('employee', { hat: ROLE_CAP.stocker }), stack: newStack() };
        this.staff.set(s.id, look);
        this.root.add(look.ch.root);
      }
      const [x, z] = this.lerp(s.id, s.x, s.z, alpha);
      look.ch.update(dt, x, z, s.vx, s.vz, s.stack.length > 0);
      this.updateStack(look.stack, s.vx, s.vz, dt);
    }
    for (const c of w.cashiers) {
      let look = this.staff.get(c.id);
      if (!look) {
        look = { ch: new Character('employee', { hat: ROLE_CAP.cashier }), stack: newStack() };
        look.ch.facing = Math.PI;
        this.staff.set(c.id, look);
        this.root.add(look.ch.root);
      }
      look.ch.update(dt, c.x, c.z, 0, 0, false);
    }
    // blob shadows
    const spots: Point[] = [
      [px, pz],
      ...w.customers.map((c): Point => [c.x, c.z]),
      ...w.stockers.map((s): Point => [s.x, s.z]),
      ...w.cashiers.map((c): Point => [c.x, c.z]),
    ];
    const m = new THREE.Matrix4();
    spots
      .slice(0, 64)
      .forEach(([x, z], i) => this.blobs.setMatrixAt(i, m.makeScale(0.9, 1, 0.9).setPosition(x, 0.025, z)));
    this.blobs.count = Math.min(64, spots.length);
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  private drawBubble(look: CustomerLook, c: World['customers'][number]): void {
    const entry = c.list[c.li];
    const waiting = c.state === 'shop' && c.patience > 0;
    const state =
      c.state === 'shop' && entry
        ? `${entry.product}:${entry.want - entry.got}:${waiting ? Math.round(c.patience * 4) : -1}`
        : c.state === 'leave' && c.angry
          ? 'angry'
          : '';
    look.bubble.visible = state !== '';
    if (state === look.drawn) return;
    look.drawn = state;
    look.tex.draw((g, W, H) => {
      if (!state) return;
      g.fillStyle = PALETTE.cream;
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 7;
      roundRect(g, 8, 8, W - 16, H - 30, 30);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(W / 2 - 14, H - 24);
      g.lineTo(W / 2, H - 6);
      g.lineTo(W / 2 + 14, H - 24);
      g.fill();
      if (state === 'angry') {
        outlinedText(g, '>:(', W / 2, H / 2 - 10, 54, SHADES.angry);
        return;
      }
      const img = icon(this.w.map.products[entry.product]?.model ?? entry.product);
      if (img) g.drawImage(img, 18, 14, 74, 74);
      outlinedText(g, `${entry.want - entry.got}`, 132, H / 2 - 10, 56, PALETTE.cream);
      if (waiting) {
        const k = Math.min(1, c.patience / (c.patienceLimit + TUNING.patienceLeave));
        g.lineWidth = 9;
        g.strokeStyle = k < 0.5 ? SHADES.warn : k < 0.8 ? PALETTE.orange : SHADES.angry;
        g.beginPath();
        g.arc(55, 51, 42, -Math.PI / 2, -Math.PI / 2 + (1 - k) * Math.PI * 2);
        g.stroke();
      }
    });
  }

  private drawItems(dt: number): void {
    const w = this.w;
    for (const im of [...this.items.values(), ...this.plants.values()]) im.begin();
    this.bills.begin();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const put = (product: string, p: THREE.Vector3, yaw = 0, scale = 1, tilt?: THREE.Vector2) => {
      const im = this.items.get(w.map.products[product]?.model ?? product);
      if (!im) return;
      q.setFromEuler(new THREE.Euler(tilt?.y ?? 0, yaw, -(tilt?.x ?? 0)));
      im.add(m.compose(p, q, s.setScalar(scale)));
    };
    // Stations
    for (const st of w.stations.values()) {
      const v = this.stations.get(st.id);
      if (!v) continue;
      v.root.updateMatrixWorld();
      if (st.kind === 'shelf') {
        const n = this.shown(`st:${st.id}`, st.items);
        for (let i = 0; i < n && i < v.slots.length; i++) put(st.product, this.local(v, v.slots[i]), st.rot + i);
      } else if (st.kind === 'producer') {
        const type = w.map.producers[st.type];
        if (st.plants.length) {
          const plants = this.plants.get(v.plantModel ?? '');
          st.plants.forEach((t, i) => {
            const at = v.plants[i];
            if (!at) return;
            const grown = 0.35 + 0.65 * (1 - Math.min(1, t / type.workTime));
            plants?.add(
              m.compose(this.local(v, at), q.setFromEuler(new THREE.Euler(0, i * 2.4, 0)), s.setScalar(grown)),
            );
            if (t <= 0 && type.output === 'tomato') put('tomato', this.local(v, at.clone().setY(0.55)), i);
          });
        } else {
          const n = this.shown(`st:${st.id}`, st.tray);
          for (let i = 0; i < n && i < v.slots.length; i++) put(type.output, this.local(v, v.slots[i]), i * 0.7);
          type.inputs.forEach((p, k) => {
            const count = this.shown(`input:${st.id}:${p}`, st.input[p] ?? 0);
            for (let i = 0; i < count; i++) {
              const slot = v.inputSlots[(i + k * 3) % Math.max(1, v.inputSlots.length)];
              if (slot) put(p, this.local(v, slot).add(new THREE.Vector3(0, Math.floor(i / 6) * 0.3, 0)), i);
            }
          });
        }
      } else if (st.kind === 'register') {
        const hidden = this.pileHidden.get(st.id);
        let bills = Math.min(PILE_MAX_BILLS, Math.ceil(st.cash / BILL_VALUE));
        if (hidden) {
          hidden.t += dt;
          bills += Math.max(0, Math.round(hidden.total * (1 - hidden.t / hidden.duration)));
          if (hidden.t >= hidden.duration) this.pileHidden.delete(st.id);
        }
        const [x, z] = cashPilePoint(w, st.id);
        for (let i = 0; i < bills; i++) {
          const col = i % 2;
          this.bills.add(
            m.compose(
              new THREE.Vector3(x + col * 0.05, 0.03 + Math.floor(i / 2) * 0.065, z + col * 0.04),
              q.setFromEuler(new THREE.Euler(0, ((i * 37) % 7) * 0.08, 0)),
              s.setScalar(1),
            ),
          );
        }
      }
    }
    // Stacks
    const stack = (items: string[], key: string, x: number, z: number, facing: number, look: StackLook, scale = 1) => {
      const n = this.shown(key, items.length);
      for (let i = 0; i < n; i++) {
        const tilt = look.lean.clone().multiplyScalar(i * 0.12);
        put(items[i], this.stackSlot(x, z, facing, look, i, scale), facing, scale, tilt);
      }
    };
    stack(
      w.player.stack,
      'stack:player',
      this.player.root.position.x,
      this.player.root.position.z,
      this.player.facing,
      this.playerStack,
    );
    for (const st of w.stockers) {
      const look = this.staff.get(st.id);
      if (look)
        stack(st.stack, `stack:${st.id}`, look.ch.root.position.x, look.ch.root.position.z, look.ch.facing, look.stack);
    }
    for (const c of w.customers) {
      const look = this.customers.get(c.id);
      if (look)
        stack(
          c.cart,
          `cart:${c.id}`,
          look.ch.root.position.x,
          look.ch.root.position.z,
          look.ch.facing,
          look.stack,
          CART_SCALE,
        );
    }
    for (const it of w.loose)
      if (this.shown(`loose:${it.id}`, 1))
        put(it.product, new THREE.Vector3(it.x, LOOSE_Y, it.z), it.id, 1, LOOSE_TILT);
    // Flights
    this.flights = this.flights.filter((f) => {
      f.t = Math.min(1, f.t + dt / FEEL.flyTime);
      const to = f.to();
      const e = f.t * f.t * (3 - 2 * f.t);
      const p = f.from.clone().lerp(to, e);
      p.y += FEEL.flyArc * 4 * f.t * (1 - f.t);
      if (f.bill) this.bills.add(m.compose(p, q.setFromEuler(new THREE.Euler(f.t * 6, f.t * 9, 0)), s.setScalar(1)));
      else if (f.product) put(f.product, p, f.t * 8, f.t > 0.85 ? 1 + (1 - f.t) * 2 : 1);
      if (f.t < 1) return true;
      if (f.key) this.pending.set(f.key, Math.max(0, (this.pending.get(f.key) ?? 1) - 1));
      if (f.key.startsWith('st:') || f.key.startsWith('input:')) this.bounce(f.key.split(':')[1]);
      return false;
    });
    for (const im of [...this.items.values(), ...this.plants.values()]) im.end();
    this.bills.end();
  }

  private bounce(id: string): void {
    const v = this.stations.get(id);
    if (!v || v.body.scale.x < 0.99) return;
    this.tweens.add(0.2, (k) => {
      const b = Math.sin(k * Math.PI) * FEEL.stationBounce;
      v.body.scale.set(1 + b * 0.5, 1 - b, 1 + b * 0.5);
      this.batch.setScale(id, 1 + b * 0.5, 1 - b);
    });
  }

  private updateMarkers(): void {
    const w = this.w;
    const p = this.player.root.position;
    const full = w.player.stack.length >= stackCap(w);
    this.maxTag.visible = full;
    if (full) {
      const top = this.stackSlot(p.x, p.z, this.player.facing, this.playerStack, w.player.stack.length);
      this.maxTag.position.copy(top).add(new THREE.Vector3(0, 0.45 + Math.abs(Math.sin(this.time * 6)) * 0.12, 0));
    }
    const office = w.stations.get('office');
    this.officeMark.visible = !!office && this.officeAlert;
    if (office) {
      const [x, z] = boxCentre(office.box);
      this.officeMark.position.set(x, 2 + Math.abs(Math.sin(this.time * 4)) * 0.3, z);
    }
    this.arrow.visible = !!this.arrowTarget;
    if (this.arrowTarget)
      this.arrow.position
        .copy(this.arrowTarget)
        .add(new THREE.Vector3(0, 2.2 + Math.abs(Math.sin(this.time * 4)) * 0.5, 0));
  }

  private updateCamera(dt: number): void {
    const w = this.w;
    if (this.cameraOverride) {
      this.stage.focus.copy(this.cameraOverride);
      return;
    }
    const p = this.player.root.position;
    const goal = new THREE.Vector3(p.x + w.player.vx * FEEL.lookAhead, 0, p.z + w.player.vz * FEEL.lookAhead);
    this.camFocus.lerp(goal, 1 - Math.exp(-FEEL.followSharpness * dt));
    const focus = this.camFocus.clone();
    if (w.pan) {
      const rects = w.map.layout.areas[w.pan.area] ?? [];
      const target = new THREE.Vector3();
      for (const r of rects) target.add(new THREE.Vector3(r[0] + r[2] / 2, 0, r[1] + r[3] / 2));
      target.divideScalar(Math.max(1, rects.length));
      const t = w.pan.t;
      const k =
        t < FEEL.panGlide
          ? ease.inOutCubic(t / FEEL.panGlide)
          : t < FEEL.panGlide + FEEL.panHold
            ? 1
            : 1 - ease.inOutCubic((t - FEEL.panGlide - FEEL.panHold) / FEEL.panGlide);
      focus.lerp(target, k);
      for (const g of this.ghosts)
        g.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh)
            (mesh.material as THREE.MeshStandardMaterial).opacity = 0.25 + Math.abs(Math.sin(t * 6)) * 0.35;
        });
    }
    this.stage.focus.copy(focus);
  }

  /** Title screen: a few scenery people stroll the shop floor (no sim, no real Customers). */
  scenery(count: number): void {
    for (const s of this.wanderers) this.root.remove(s.ch.root);
    this.wanderers = [];
    const floors = this.w.map.layout.floors;
    for (let i = 0; i < count && floors.length; i++) {
      const ch = new Character(CUSTOMER_MODELS[i % CUSTOMER_MODELS.length]);
      const p = this.randomFloorPoint();
      this.wanderers.push({ ch, mover: { x: p[0], z: p[1], vx: 0, vz: 0 }, target: this.randomFloorPoint() });
      this.root.add(ch.root);
    }
  }

  private randomFloorPoint(): Point {
    const f = this.w.map.layout.floors[Math.floor(Math.random() * this.w.map.layout.floors.length)];
    return [f[0] + 1 + Math.random() * (f[2] - 2), f[1] + 1 + Math.random() * (f[3] - 2)];
  }

  private updateScenery(dt: number): void {
    for (const s of this.wanderers) {
      if (walkAgent(this.w, 'shopper', s.mover, { point: s.target }, 1.6, dt)) s.target = this.randomFloorPoint();
      s.ch.update(dt, s.mover.x, s.mover.z, s.mover.vx, s.mover.vz, false);
    }
  }

  /** World-space position for a Station or Pad id (for arrows and edge markers). */
  anchorOf(id: string): THREE.Vector3 | null {
    const place = this.w.map.layout.places[id];
    if (!place) return null;
    const [x, z] = boxCentre(place.box);
    return new THREE.Vector3(x, 0, z);
  }
}

const w_isInput = (w: World, type: string, product: string): boolean => {
  const t = w.map.producers[type];
  return t.inputs.includes(product) && t.output !== product;
};
