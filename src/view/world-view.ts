// Mirrors the sim into the scene every frame; turns sim events into motion (flying Items, springs, puffs, numbers).
import * as THREE from 'three';
import type { Mover, Ref, SimEvent, Station, World } from '../sim/world';
import type { Box, Point } from '../sim/map';
import { stationModel } from '../sim/map';
import { boxCentre } from '../sim/geometry';
import { areaOf, walkAgent, type Target } from '../sim/walk';
import { cashPilePoint, padRemaining, stackCap, visiblePads } from '../sim/economy';
import { stalled } from '../sim/producers';
import { Stage } from './stage';
import { Level } from './level';
import { Juice } from './juice';
import { Character } from './characters';
import { CleaningLook, HeldMop } from './cleaning';
import { LayoutGhost } from './layout-ghost';
import { PadVisual } from './pads';
import { ANIMAL_MODELS, buildStation, ghostify, type StationVisual } from './stations';
import { InstancedModel, LiveInstances, billModel, itemModel, modelDrawer, type ModelDrawer } from './instanced';
import { model } from './assets';
import { StationBatch } from './station-batch';
import { CanvasTex, canvasSprite, outlinedText, roundRect } from './text';
import { Receipt } from './receipt';
import { Car } from './cars';
import { InspectorLook, ThiefLook } from './visitors';
import { basketLean, basketPose, basketSlot, hasBasket } from './basket';
import { paletteMaterial } from './materials';
import { Tweens, ease } from '../tween';
import { FEEL } from '../feel';
import { PALETTE, SHADES, withAlpha, THEMES } from '../palette';
import { PRODUCTS } from '../../catalog/products';
import { TUNING } from '../sim/tuning';

const CUSTOMER_MODELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => `customer-${k}`);
const INSPECTOR_MODEL = 'customer-g';
const BILL_VALUE = 5;
const PILE_MAX_BILLS = 24;
const CART_SCALE = 0.7;
const LOOSE_Y = 0.15;
const RIPE_TOMATO_Y = 0.42;
const RECEIPT_Y = 1.75;
const MAX_ANIMALS = 32;
/** Tap Walk ring and glow: above the floor tiles. */
const WALK_MARK_Y = 0.08;
/** Copies of each Item model, bill or basket drawn at once. */
const MAX_COPIES = 600;
const BILL = 'bill';
const BASKET = 'basket';
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

interface CarLook {
  car: Car;
  card: Receipt;
  leaving: boolean;
}

interface CustomerLook {
  ch: Character;
  receipt: Receipt;
  stack: StackLook;
}

const newStack = (): StackLook => ({
  lean: new THREE.Vector2(),
  leanVel: new THREE.Vector2(),
  prevVel: new THREE.Vector2(),
});

export class WorldView {
  level: Level;
  readonly juice = new Juice();
  readonly tweens = new Tweens();
  readonly root = new THREE.Group();
  private stations = new Map<string, StationVisual>();
  private pads = new Map<string, PadVisual>();
  /** Items, Money bills and Customers' baskets. */
  private items: ModelDrawer;
  private plants = new Map<string, InstancedModel>();
  private batch = new StationBatch();
  private animals: LiveInstances;
  private puffTimers = new Map<string, number>();
  private wanderers: { ch: Character; mover: Mover; target: Point }[] = [];
  /** Customers whose basket tipped over in a Mess. */
  private spilled = new Set<number>();
  private blobs: THREE.InstancedMesh;
  private splats = new Map<number, THREE.Object3D>();
  private player: Character;
  private playerStack = newStack();
  private sprintPuff = 0;
  private customers = new Map<number, CustomerLook>();
  private staff = new Map<string, { ch: Character; stack: StackLook }>();
  private cleaners = new Map<string, { ch: Character; mop: HeldMop }>();
  private cleaning = new CleaningLook();
  private thief: { look: ThiefLook; stack: StackLook } | null = null;
  private inspector: InspectorLook | null = null;
  /** Delivery cars by pickup tile id; a leaving one drives off before it goes. */
  private cars = new Map<string, CarLook>();
  /** Needs cards by Station id, made the first time one is needed. */
  private needs = new Map<string, Receipt>();
  readonly layoutGhost = new LayoutGhost();
  private playerMop: HeldMop;
  private flights: Flight[] = [];
  private pending = new Map<string, number>();
  private ownedKey = '';
  private maxTag: THREE.Sprite;
  private officeMark: THREE.Sprite;
  private arrow: THREE.Mesh;
  private ghosts: THREE.Object3D[] = [];
  private prev = new Map<string, Point>();
  private time = 0;
  /** Set by the game: where a Tap Walk is heading, or null. */
  walkTarget: Target | null = null;
  private walkRing: THREE.Mesh;
  private walkGlow: THREE.Mesh;
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
    this.level = this.buildLevel(w);
    this.root.add(this.level.group, this.juice.group, this.batch.group, this.cleaning.group, this.layoutGhost.group);
    stage.scene.add(this.root);
    const models = new Map<string, THREE.Object3D>([
      [BILL, billModel()],
      [BASKET, model('shopping-basket', { height: FEEL.basketHeight })],
    ]);
    // every Map's Products, so switching Maps needs no new drawers
    for (const p of Object.values(PRODUCTS)) if (!models.has(p.model)) models.set(p.model, itemModel(p.model));
    const multiDraw = stage.renderer.extensions.has('WEBGL_multi_draw');
    this.items = modelDrawer(models, MAX_COPIES, this.root, multiDraw);
    for (const name of ['tomato-bush', 'wheat-plant'])
      this.plants.set(name, new InstancedModel(model(name), 64, this.root, false));
    this.animals = new LiveInstances(
      ANIMAL_MODELS.map((name) => model(name)),
      MAX_ANIMALS,
      this.root,
      multiDraw,
    );
    this.blobs = this.makeBlobs();
    this.player = new Character('player', { hat: 'orange' });
    this.root.add(this.player.root);
    this.playerMop = new HeldMop(this.player);
    this.maxTag = this.tag('MAX', PALETTE.orange);
    this.officeMark = this.tag('!', PALETTE.orange);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 16), paletteMaterial('orange'));
    this.arrow.rotation.x = Math.PI;
    this.arrow.castShadow = true;
    this.root.add(this.arrow);
    const ringMat = new THREE.MeshBasicMaterial({
      color: PALETTE.orange,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.walkRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2), ringMat);
    this.walkRing.renderOrder = 2;
    const glowMat = new THREE.MeshBasicMaterial({ color: PALETTE.pad, transparent: true, depthWrite: false });
    this.walkGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowMat);
    this.walkGlow.renderOrder = 1;
    this.root.add(this.walkRing, this.walkGlow);
    this.reset(w);
  }

  private buildLevel(w: World): Level {
    return new Level(w.map.layout, (b: Box) => areaOf(this.w, b), w.map.start.owned, THEMES[w.map.id]);
  }

  /** Point the view at a (new) World, e.g. after a reload. Clears everything dynamic. */
  reset(w: World): void {
    const newMap = w.map.id !== this.w.map.id;
    this.w = w;
    if (newMap) {
      this.root.remove(this.level.group);
      this.level = this.buildLevel(w);
      this.root.add(this.level.group);
    }
    for (const v of this.stations.values()) this.root.remove(v.root);
    for (const p of this.pads.values()) this.root.remove(p.group);
    for (const c of this.customers.values()) {
      this.root.remove(c.ch.root, c.receipt.sprite);
      c.receipt.dispose();
    }
    for (const s of [...this.staff.values(), ...this.cleaners.values()]) this.root.remove(s.ch.root);
    for (const m of this.splats.values()) this.root.remove(m);
    for (const id of [...this.cars.keys()]) this.removeCar(id);
    for (const id of [...this.needs.keys()]) this.removeNeeds(id);
    this.thief?.look.dispose();
    this.inspector?.dispose();
    this.thief = null;
    this.inspector = null;
    this.stations.clear();
    this.batch.clear();
    this.animals.clear();
    this.pads.clear();
    this.customers.clear();
    this.staff.clear();
    this.cleaners.clear();
    this.cleaning.reset();
    this.splats.clear();
    this.spilled.clear();
    this.flights = [];
    this.pending.clear();
    this.ownedKey = '';
    this.player.facing = Math.PI;
    this.camFocus.set(w.player.x, 0, w.player.z);
    for (const m of w.messes) this.addSplat(m.id, m.x, m.z, m.items);
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
    for (const s of [...w.stockers, ...w.cleaners]) this.prev.set(s.id, [s.x, s.z]);
    for (const [key, v] of [
      ['thief', w.thief],
      ['inspector', w.inspector],
    ] as const)
      if (v) this.prev.set(key, [v.x, v.z]);
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
      for (const m of v.mixers) this.animals.adopt(m.getRoot() as THREE.Object3D);
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
      name ??
      (['cashier', 'stocker', 'cleaner'].includes(def.kind) ? 'employee' : def.kind === 'exit' ? 'van' : 'area');
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
      if (ref.agent === 'thief') {
        const th = w.thief;
        const look = this.thief;
        return th && look ? this.stackSlot(th.x, th.z, look.look.ch.facing, look.stack, index) : new THREE.Vector3();
      }
      const s = w.stockers.find((o) => o.id === ref.id);
      const look = this.staff.get(ref.id);
      return s && look ? this.stackSlot(s.x, s.z, look.ch.facing, look.stack, index) : new THREE.Vector3();
    }
    if ('customer' in ref) {
      const c = w.customers.find((o) => o.id === ref.customer);
      const look = this.customers.get(ref.customer);
      if (c && look && hasBasket(c.id))
        return basketSlot(c.x, c.z, look.ch.facing, index, basketLean(c.id, look.stack.lean));
      return c && look ? this.stackSlot(c.x, c.z, look.ch.facing, look.stack, index, CART_SCALE) : new THREE.Vector3();
    }
    if ('loose' in ref) {
      const it = w.loose.find((o) => o.id === ref.loose) ?? w.player;
      return new THREE.Vector3(it.x, LOOSE_Y, it.z);
    }
    const car = this.cars.get(ref.station)?.car.root.position;
    if (car) return car.clone().setY(1);
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
    if ('agent' in ref) return ref.agent === 'stocker' ? `stack:${ref.id}` : `stack:${ref.agent}`;
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
      if (ref.agent === 'thief') return w.thief?.carry.length ?? 0;
      return w.stockers.find((s) => s.id === ref.id)?.stack.length ?? 0;
    }
    if ('customer' in ref) return w.customers.find((c) => c.id === ref.customer)?.cart.length ?? 0;
    if ('loose' in ref) return w.loose.some((o) => o.id === ref.loose) ? 1 : 0;
    const st = w.stations.get(ref.station);
    if (st?.kind === 'shelf') return st.items;
    if (st?.kind === 'producer') return w_isInput(w, st.type, product) ? (st.input[product] ?? 0) : st.tray;
    if (st?.kind === 'pickup') return st.delivery?.order.reduce((n, l) => n + l.got, 0) ?? 0;
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
        // whoever tipped it says "no!"
        if ('loose' in e.to && 'agent' in e.from && e.from.agent !== 'thief')
          (e.from.agent === 'player' ? this.player : this.staff.get(e.from.id)?.ch)?.emote('no');
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
        const trash = w.stations.get(e.station);
        const [x, z] = trash ? boxCentre(trash.box) : [from.x, from.z];
        this.flights.push({ product: e.product, from, to: () => new THREE.Vector3(x, 0.7, z), t: 0, key: '' });
        this.cleaning.trashed(e.station);
        break;
      }
      case 'mop':
        this.juice.puff(this.player.root.position.clone().setY(0.9), PALETTE.cream, 6, 0.8);
        break;
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
        this.flyBills(
          bills,
          e.duration,
          (i) => new THREE.Vector3(x, 0.1 + (bills - i) * 0.07, z),
          () => new THREE.Vector3(w.player.x, 1.2, w.player.z),
          () => this.juice.money('player', e.amount / bills, new THREE.Vector3(w.player.x, 2.2, w.player.z)),
        );
        this.juice.coin(new THREE.Vector3(x, 0.5, z));
        this.pileHidden.set(e.register, { total: bills, t: 0, duration: e.duration });
        break;
      }
      case 'thiefGrab': {
        const th = w.thief;
        if (th?.cash) this.thiefCash(th.target, th.cash, true);
        break;
      }
      case 'angry':
        this.customers.get(e.customer)?.ch.emote('no');
        break;
      case 'mess': {
        const m = w.messes.find((o) => o.id === e.mess);
        if (m) this.addSplat(m.id, m.x, m.z, m.items);
        const look = this.customers.get(e.customer);
        look?.ch.emote('no');
        if (look && hasBasket(e.customer)) this.tipBasket(e.customer, look.ch);
        break;
      }
      case 'messCleared': {
        const s = this.splats.get(e.mess);
        if (s) {
          // sparkle pop
          this.juice.puff(s.position.clone().setY(0.3), SHADES.white, 14, 1.4);
          this.juice.puff(s.position.clone().setY(0.6), PALETTE.pad, 8, 1.8);
          this.root.remove(s);
          this.splats.delete(e.mess);
        }
        break;
      }
      case 'deliveryHonk':
        this.hopCar(e.station, 0.5);
        break;
      case 'deliveryDone': {
        const at = this.cars.get(e.station)?.car.root.position.clone().setY(2.4);
        if (!at) break;
        if (e.amount) this.juice.money(e.station, e.amount, at);
        if (e.amount) this.juice.coin(at.clone().setY(1.4));
        if (e.tip) this.juice.money(`${e.station}:tip`, e.tip, at.clone().setY(3), ' tip');
        break;
      }
      case 'robberyDone': {
        const look = this.thief?.look;
        if (!look) break;
        if (e.caught && e.cash && w.thief) this.thiefCash(w.thief.target, e.cash, false);
        const at = look.ch.root.position.clone().setY(2.3);
        this.juice.money('thief', e.caught ? e.amount : -e.amount, at);
        if (e.caught) look.tumble();
        else this.juice.puff(at.setY(0.4), PALETTE.cream, 8, 1);
        break;
      }
      case 'inspection': {
        if (!this.inspector) break;
        if (e.review) {
          this.inspector.badReview();
          this.inspector.ch.emote('no');
        }
        if (e.amount) this.juice.money('inspector', e.amount, this.inspector.ch.root.position.clone().setY(2.6));
        break;
      }
      case 'complete':
        this.syncOwned(true);
        break;
    }
  }

  /** `count` bills flying one after another over `duration` s; `each` runs as each one leaves. */
  private flyBills(
    count: number,
    duration: number,
    from: (i: number) => THREE.Vector3,
    to: () => THREE.Vector3,
    each = () => {},
  ): void {
    for (let i = 0; i < count; i++)
      this.tweens.add(0.001, () => {}, {
        delay: (i / count) * duration,
        done: () => {
          this.flights.push({ product: '', bill: true, from: from(i), to, t: 0, key: '' });
          each();
        },
      });
  }

  /** Stolen cash flies from the Cash Pile into the Thief's arms, or back onto the Pile when caught. */
  private thiefCash(register: string, cash: number, stolen: boolean): void {
    const [x, z] = cashPilePoint(this.w, register);
    const pile = () => new THREE.Vector3(x, 0.3, z);
    const thief = () => this.thief?.look.ch.root.position.clone().setY(FEEL.stackBase) ?? pile();
    const bills = Math.min(PILE_MAX_BILLS, Math.ceil(cash / BILL_VALUE));
    this.flyBills(bills, FEEL.cashDrainMin, stolen ? pile : thief, stolen ? thief : pile);
  }

  // ---------- Event visitors

  private syncVisitors(dt: number, alpha: number): void {
    const w = this.w;
    const th = w.thief;
    if (th && !this.thief) {
      const model = CUSTOMER_MODELS[Math.floor(th.look * CUSTOMER_MODELS.length)];
      this.thief = { look: new ThiefLook(model, this.root, this.tweens), stack: newStack() };
    }
    if (!th && this.thief) {
      this.thief.look.dispose();
      this.thief = null;
    }
    if (th && this.thief) {
      const [x, z] = this.lerp('thief', th.x, th.z, alpha);
      this.thief.look.update(dt, th, x, z);
      this.updateStack(this.thief.stack, th.vx, th.vz, dt);
    }
    const ins = w.inspector;
    if (ins && !this.inspector) this.inspector = new InspectorLook(INSPECTOR_MODEL, this.root, this.tweens);
    if (!ins && this.inspector) {
      this.inspector.dispose();
      this.inspector = null;
    }
    if (ins && this.inspector) {
      const [x, z] = this.lerp('inspector', ins.x, ins.z, alpha);
      const far = Math.hypot(w.player.x - ins.x, w.player.z - ins.z) > TUNING.events.inspector.escort;
      this.inspector.update(dt, ins, x, z, far);
    }
  }

  // ---------- Delivery cars

  /** Cars follow the sim's pickups: drive in and bounce when an order comes, drive off with a puff when it goes. */
  private syncCars(dt: number): void {
    const w = this.w;
    for (const st of w.stations.values()) {
      if (st.kind !== 'pickup') continue;
      const look = this.cars.get(st.id);
      const d = st.delivery;
      if (d && !look) this.driveIn(st.id, st.car, d.look);
      if (!d && look && !look.leaving) this.driveOff(st.id, look);
      if (!d || !look || look.leaving) continue;
      const red = d.time - d.t <= TUNING.events.honkAt;
      look.car.setFace(red);
      look.card.sprite.position.copy(look.car.root.position).setY(FEEL.carCardY);
      look.card.updateOrder(d, w.map.products, dt, red);
    }
  }

  /** A needs card over each empty Shelf and each Animal or Machine stalled for an input. */
  private syncNeeds(dt: number): void {
    const w = this.w;
    for (const id of this.needs.keys()) if (!w.stations.has(id)) this.removeNeeds(id);
    for (const st of w.stations.values()) {
      const needs = needsOf(w, st);
      let card = this.needs.get(st.id);
      if (!needs || (!needs.show && !card)) continue;
      if (!card) {
        card = new Receipt();
        card.sprite.scale.multiplyScalar(FEEL.needCardScale);
        // drawn over the Station's own sign and props
        (card.sprite.material as THREE.SpriteMaterial).depthTest = false;
        card.sprite.renderOrder = 10;
        this.root.add(card.sprite);
        this.needs.set(st.id, card);
      }
      const [x, z] = boxCentre(st.box);
      card.sprite.position.set(x, FEEL.needCardY, z);
      card.updateNeeds(needs.lines, needs.show && !this.cameraOverride, dt);
    }
  }

  private removeNeeds(id: string): void {
    const card = this.needs.get(id);
    if (!card) return;
    this.root.remove(card.sprite);
    card.dispose();
    this.needs.delete(id);
  }

  private driveIn(id: string, spot: Box, colour: number): void {
    const car = new Car(spot, colour);
    const card = new Receipt();
    const [x, z] = boxCentre(spot);
    const from = -car.length;
    car.root.position.set(from, 0, z);
    card.sprite.visible = false;
    card.sprite.scale.multiplyScalar(FEEL.carCardScale);
    this.root.add(car.root, card.sprite);
    this.cars.set(id, { car, card, leaving: false });
    this.tweens.add(FEEL.carDriveIn, (k) => (car.root.position.x = from + (x - from) * k), {
      done: () => this.hopCar(id, 1),
    });
  }

  private driveOff(id: string, look: CarLook): void {
    look.leaving = true;
    look.card.sprite.visible = false;
    const car = look.car.root;
    const from = car.position.x;
    const to = this.w.map.layout.size[0] + look.car.length;
    this.juice.puff(
      car.position
        .clone()
        .setX(from - look.car.length / 2)
        .setY(0.4),
      SHADES.steam,
      8,
      0.8,
    );
    this.tweens.add(FEEL.carDriveOff, (k) => (car.position.x = from + (to - from) * k), {
      ease: ease.inOutCubic,
      done: () => this.removeCar(id),
    });
  }

  private removeCar(id: string): void {
    const look = this.cars.get(id);
    if (!look) return;
    this.root.remove(look.car.root, look.card.sprite);
    look.car.dispose();
    look.card.dispose();
    this.cars.delete(id);
  }

  /** A bounce on parking or a honk; Items landing squash it instead (see bounce). */
  private hopCar(id: string, scale: number): void {
    const body = this.cars.get(id)?.car.body;
    if (!body) return;
    this.tweens.add(0.5, (k) => {
      body.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * FEEL.carBounce * scale;
    });
  }

  /** The basket tips over where the Mess spilled, lies there a moment, then fades. */
  private tipBasket(id: number, ch: Character): void {
    this.spilled.add(id);
    const b = model('shopping-basket', { height: FEEL.basketHeight });
    const p = basketPose(ch.root.position.x, ch.root.position.z, ch.facing);
    b.position.set(p.x, 0.15, p.z);
    b.rotation.set(Math.PI / 2, ch.facing, 0);
    ghostify(b, 1);
    this.root.add(b);
    const fade = (k: number) =>
      b.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mat) mat.opacity = 1 - k;
      });
    this.tweens.add(FEEL.basketFade, fade, {
      delay: FEEL.basketFade,
      done: () => this.root.remove(b),
    });
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
    this.syncCars(dt);
    this.syncNeeds(dt);
    this.syncVisitors(dt, alpha);
    this.drawItems(dt);
    for (const [id, v] of this.stations) {
      const st = w.stations.get(id);
      const working = (st?.kind === 'producer' && st.work > 0) || (st?.kind === 'register' && st.progress > 0);
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
    this.cleaning.update(dt, {
      w,
      splats: this.splats,
      stations: this.stations,
      customerAt: (id) => this.customers.get(id)?.ch.root.position,
      bounce: (id) => this.bounce(id),
      puff: (at, color, count, spread) => this.juice.puff(at, color, count, spread),
    });
    this.layoutGhost.update(dt);
    this.animals.update();
    this.updateScenery(dt);
    this.juice.update(dt);
    const near: Point[] = [
      [w.player.x, w.player.z],
      ...w.customers.map((c): Point => [c.x, c.z]),
      ...[...w.stockers, ...w.cleaners].map((s): Point => [s.x, s.z]),
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
    const mopping =
      w.player.mop && w.messes.some((m) => Math.hypot(m.x - w.player.x, m.z - w.player.z) <= TUNING.messClearRadius);
    this.playerMop.update(dt, w.player.mop, mopping);
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
        const receipt = new Receipt();
        this.root.add(ch.root, receipt.sprite);
        look = { ch, receipt, stack: newStack() };
        this.customers.set(c.id, look);
      }
      const [x, z] = this.lerp(`c${c.id}`, c.x, c.z, alpha);
      look.ch.update(dt, x, z, c.vx, c.vz, c.cart.length > 0);
      this.updateStack(look.stack, c.vx, c.vz, dt);
      look.receipt.sprite.position.set(x, RECEIPT_Y, z);
      look.receipt.update(c, w.map.products, dt);
    }
    for (const [id, look] of this.customers) {
      if (alive.has(id)) continue;
      this.root.remove(look.ch.root, look.receipt.sprite);
      look.receipt.dispose();
      this.customers.delete(id);
      this.spilled.delete(id);
    }
    for (const s of w.stockers) {
      let look = this.staff.get(s.id);
      if (!look) {
        look = { ch: new Character('employee', { hat: SHADES.roleCaps[s.role] }), stack: newStack() };
        this.staff.set(s.id, look);
        this.root.add(look.ch.root);
      }
      look.ch.setHat(SHADES.roleCaps[s.role]);
      const [x, z] = this.lerp(s.id, s.x, s.z, alpha);
      look.ch.update(dt, x, z, s.vx, s.vz, s.stack.length > 0);
      this.updateStack(look.stack, s.vx, s.vz, dt);
    }
    for (const c of w.cleaners) {
      let look = this.cleaners.get(c.id);
      if (!look) {
        const ch = new Character('employee', { hat: SHADES.cleanerCap });
        look = { ch, mop: new HeldMop(ch) };
        this.cleaners.set(c.id, look);
        this.root.add(ch.root);
      }
      const [x, z] = this.lerp(c.id, c.x, c.z, alpha);
      look.ch.update(dt, x, z, c.vx, c.vz, false);
      look.mop.update(dt, true, c.mopping);
    }
    for (const c of w.cashiers) {
      let look = this.staff.get(c.id);
      if (!look) {
        look = { ch: new Character('employee', { hat: SHADES.white }), stack: newStack() };
        look.ch.facing = Math.PI;
        this.staff.set(c.id, look);
        this.root.add(look.ch.root);
      }
      const reg = w.stations.get(c.register);
      if (reg) look.ch.facing = Math.atan2(reg.box[0] + reg.box[2] / 2 - c.x, reg.box[1] + reg.box[3] / 2 - c.z);
      look.ch.update(dt, c.x, c.z, 0, 0, false);
    }
    // blob shadows
    const spots: Point[] = [
      [px, pz],
      ...w.customers.map((c): Point => [c.x, c.z]),
      ...w.stockers.map((s): Point => [s.x, s.z]),
      ...w.cashiers.map((c): Point => [c.x, c.z]),
      ...w.cleaners.map((c): Point => [c.x, c.z]),
      ...(w.thief ? [[w.thief.x, w.thief.z] as Point] : []),
      ...(w.inspector && w.inspector.state !== 'warn' ? [[w.inspector.x, w.inspector.z] as Point] : []),
    ];
    const m = new THREE.Matrix4();
    spots
      .slice(0, 64)
      .forEach(([x, z], i) => this.blobs.setMatrixAt(i, m.makeScale(0.9, 1, 0.9).setPosition(x, 0.025, z)));
    this.blobs.count = Math.min(64, spots.length);
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  private drawItems(dt: number): void {
    const w = this.w;
    this.items.begin();
    for (const im of this.plants.values()) im.begin();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const put = (product: string, p: THREE.Vector3, yaw = 0, scale = 1, tilt?: THREE.Vector2) => {
      q.setFromEuler(new THREE.Euler(tilt?.y ?? 0, yaw, -(tilt?.x ?? 0)));
      this.items.add(w.map.products[product]?.model ?? product, m.compose(p, q, s.setScalar(scale)));
    };
    const onBelt = new Set<number>();
    // Stations
    for (const st of w.stations.values()) {
      const v = this.stations.get(st.id);
      if (!v) continue;
      v.root.updateMatrixWorld();
      if (st.kind === 'shelf') {
        const n = this.shown(`st:${st.id}`, st.items);
        const yaw = THREE.MathUtils.degToRad(st.rot);
        const lean = new THREE.Vector2(0, v.slotTilt ?? 0);
        for (let i = 0; i < n && i < v.slots.length; i++) put(st.product, this.local(v, v.slots[i]), yaw, 1, lean);
      } else if (st.kind === 'producer') {
        const type = w.map.producers[st.type];
        if (st.plants.length) {
          const plants = this.plants.get(v.plantModel ?? '');
          st.plants.forEach((t, i) => {
            const at = v.plants[i];
            if (!at) return;
            const grown = 0.35 + 0.65 * (1 - Math.min(1, t / type.workTime));
            // no plant model (Juice Bar Crops): the output Item itself grows in place
            if (!v.plantModel)
              return put(type.output, this.local(v, at), i * 2.4, (t <= 0 ? 1 : grown * 0.8) * (v.plantScale ?? 1));
            plants?.add(
              m.compose(this.local(v, at), q.setFromEuler(new THREE.Euler(0, i * 2.4, 0)), s.setScalar(grown)),
            );
            if (t <= 0 && type.output === 'tomato')
              put('tomato', this.local(v, at.clone().setY(at.y + RIPE_TOMATO_Y)), i);
          });
        } else {
          const n = this.shown(`st:${st.id}`, st.tray);
          for (let i = 0; i < n && i < v.slots.length; i++) put(type.output, this.local(v, v.slots[i]), i * 0.7);
          type.inputs.forEach((p, k) => {
            const count = this.shown(`input:${st.id}:${p}`, st.input[p] ?? 0);
            for (let i = 0; i < count; i++) {
              const [n, layer] = v.inputColumns ? [k * 3 + (i % 3), Math.floor(i / 3)] : [i + k * 3, Math.floor(i / 6)];
              const slot = v.inputSlots[n % Math.max(1, v.inputSlots.length)];
              if (slot) put(p, this.local(v, slot).add(new THREE.Vector3(0, layer * 0.3, 0)), i);
            }
          });
        }
      } else if (st.kind === 'register') {
        const front = st.progress > 0 && v.belt ? w.customers.find((c) => c.id === st.queue[0]) : undefined;
        if (front && v.belt) {
          // the goods ride the belt to the till, staggered by order, then drop into the bagging tray
          onBelt.add(front.id);
          const [a, b, bag] = v.belt;
          const n = Math.max(1, front.cart.length);
          front.cart.forEach((p, i) => {
            const t = THREE.MathUtils.clamp(st.progress * 1.6 - (i / n) * 0.6, 0, 1);
            const at =
              t < 1
                ? a.clone().lerp(b, t)
                : bag.clone().add(new THREE.Vector3((i % 3) * 0.18, Math.floor(i / 3) * 0.3, ((i % 2) - 0.5) * 0.15));
            put(p, this.local(v, at), THREE.MathUtils.degToRad(st.rot), CART_SCALE);
          });
        }
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
          this.items.add(
            BILL,
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
    const th = w.thief;
    const thief = this.thief;
    if (th && thief) {
      const { x, z } = thief.look.ch.root.position;
      stack(th.carry, 'stack:thief', x, z, thief.look.ch.facing, thief.stack);
      const bills = Math.min(PILE_MAX_BILLS, Math.ceil(th.cash / BILL_VALUE));
      for (let i = 0; i < bills; i++) {
        const at = this.stackSlot(x, z, thief.look.ch.facing, thief.stack, 0).setY(FEEL.stackBase + i * 0.065);
        this.items.add(
          BILL,
          m.compose(at, q.setFromEuler(new THREE.Euler(0, thief.look.ch.facing, 0)), s.setScalar(1)),
        );
      }
    }
    for (const c of w.customers) {
      const look = this.customers.get(c.id);
      if (!look || !hasBasket(c.id)) continue;
      const { x, z } = look.ch.root.position;
      if (!this.spilled.has(c.id))
        this.items.add(
          BASKET,
          m.compose(
            basketPose(x, z, look.ch.facing),
            q.setFromEuler(new THREE.Euler(0, look.ch.facing, 0)),
            s.setScalar(1),
          ),
        );
      if (onBelt.has(c.id)) continue;
      const lean = basketLean(c.id, look.stack.lean);
      const n = this.shown(`cart:${c.id}`, c.cart.length);
      for (let i = 0; i < n; i++) {
        const tilt = lean.clone().multiplyScalar(Math.min(i, FEEL.basketTiltItems) * 0.08);
        put(c.cart[i], basketSlot(x, z, look.ch.facing, i, lean), look.ch.facing, FEEL.basketItemScale, tilt);
      }
    }
    for (const c of w.customers) {
      const look = this.customers.get(c.id);
      if (look && !onBelt.has(c.id) && !hasBasket(c.id))
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
      if (f.bill)
        this.items.add(BILL, m.compose(p, q.setFromEuler(new THREE.Euler(f.t * 6, f.t * 9, 0)), s.setScalar(1)));
      else if (f.product) put(f.product, p, f.t * 8, f.t > 0.85 ? 1 + (1 - f.t) * 2 : 1);
      if (f.t < 1) return true;
      if (f.key) this.pending.set(f.key, Math.max(0, (this.pending.get(f.key) ?? 1) - 1));
      if (f.key.startsWith('st:') || f.key.startsWith('input:')) this.bounce(f.key.split(':')[1]);
      return false;
    });
    this.items.end();
    for (const im of this.plants.values()) im.end();
  }

  /** Edit Layout hides the picked fixture while its ghost is carried. */
  hideStation(id: string, hidden: boolean): void {
    const v = this.stations.get(id);
    if (v) v.root.visible = !hidden;
    this.batch.setScale(id, hidden ? 0.001 : 1, hidden ? 0.001 : 1);
  }

  private bounce(id: string): void {
    const car = this.cars.get(id)?.car.body;
    if (car)
      this.tweens.add(0.2, (k) => {
        const b = Math.sin(k * Math.PI) * FEEL.carSquash;
        car.scale.set(1 + b * 0.5, 1 - b, 1 + b * 0.5);
      });
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
    const t = this.walkTarget;
    const station = t && 'station' in t ? w.stations.get(t.station) : undefined;
    this.walkRing.visible = !!t;
    this.walkGlow.visible = !!station;
    if (t) {
      const [x, z] = station ? boxCentre(station.box) : 'point' in t ? t.point : [0, 0];
      this.walkRing.position.set(x, WALK_MARK_Y, z);
      this.walkRing.scale.setScalar(FEEL.tapRing * (1 + FEEL.tapRingPulse * Math.sin(this.time * 8)));
    }
    if (station) {
      const [bx, bz, bw, bd] = station.box;
      this.walkGlow.position.set(bx + bw / 2, WALK_MARK_Y - 0.01, bz + bd / 2);
      this.walkGlow.scale.set(bw + 2 * FEEL.tapGlowMargin, 1, bd + 2 * FEEL.tapGlowMargin);
      (this.walkGlow.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(this.time * 6);
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
    const tp = w.thiefPan;
    if (tp && w.thief) {
      const g = FEEL.thiefPanGlide;
      const back = tp.duration - g;
      const k = tp.t < g ? ease.inOutCubic(tp.t / g) : tp.t < back ? 1 : 1 - ease.inOutCubic((tp.t - back) / g);
      focus.lerp(new THREE.Vector3(w.thief.x, 0, w.thief.z), k);
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

function needsOf(
  w: World,
  st: Station,
): { show: boolean; lines: { model: string; have: number; cap: number }[] } | null {
  const model = (p: string) => w.map.products[p]?.model ?? p;
  if (st.kind === 'shelf')
    return { show: !st.items, lines: [{ model: model(st.product), have: st.items, cap: TUNING.shelfCap }] };
  if (st.kind !== 'producer') return null;
  const type = w.map.producers[st.type];
  if (!type.inputs.length) return null;
  const lines = type.inputs.map((p) => ({ model: model(p), have: st.input[p] ?? 0, cap: type.inputCap ?? 0 }));
  return { show: stalled(w, st), lines };
}

const w_isInput = (w: World, type: string, product: string): boolean => {
  const t = w.map.producers[type];
  return t.inputs.includes(product) && t.output !== product;
};
