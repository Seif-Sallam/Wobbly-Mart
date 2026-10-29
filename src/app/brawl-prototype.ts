// PROTOTYPE (throwaway, branch prototype/brawl-feel): /brawl-prototype.html?feel=A|B|C|D&ctl=K1|K2|K3[&gallery=1]
// How Smack (tap), Shove (hold, release), Knockout (3 quick hits) and falling in water feel, and the phone controls
// for them. Local only: P1 (WASD), P2 joins on its keys or a gamepad, plus wandering dummies. No networking.
import * as THREE from 'three';
import GUI from 'lil-gui';
import { loadAssets } from '../view/assets';
import { lookCharacter, type Character } from '../view/characters';
import { itemModel } from '../view/instanced';
import { paletteColor, paletteMaterial } from '../view/materials';
import { SCREEN_RIGHT, SCREEN_UP } from '../view/stage';
import { FEEL } from '../feel';
import { CAP_COLOURS, LIGHT, PALETTE, type CapName } from '../palette';
import { TUNING } from '../sim/tuning';

// ---------------------------------------------------------------------------------------------------- presets

interface Feel {
  /** Smack: victim frozen (s), reach (m), cone half-angle (°), knockback (m/s), Items that fly, cooldown (s). */
  stun: number;
  smackRange: number;
  smackCone: number;
  smackPush: number;
  smackItems: number;
  smackCooldown: number;
  /** K1 only: a press longer than this (s) turns into a Shove charge. */
  holdTime: number;
  /** Shove: seconds to full charge, move speed × while charging, reach (m), launch speed at 0 and full charge (m/s),
   * Items that fly at full charge, the attacker's own lunge at full charge (m/s), victim frozen at full charge (s). */
  chargeTime: number;
  chargeSlow: number;
  shoveRange: number;
  shoveMin: number;
  shoveMax: number;
  shoveItems: number;
  lunge: number;
  shoveStun: number;
  /** Knockback decay (1/s); bounce off shelves (0–1); share of a flying body's speed passed on to whoever it hits. */
  friction: number;
  bounce: number;
  chain: number;
  /** Knockout: hits within comboWindow (s) to knock out, dazed time (s), extra Items that fly. */
  comboWindow: number;
  koHits: number;
  koDaze: number;
  koItems: number;
  /** Chance a flying egg breaks into a Mess. */
  eggBreak: number;
  /** Juice: whole-game freeze on a hit (s), camera shake (m), victim squash (share). */
  hitstop: number;
  shake: number;
  squash: number;
  /** Water: time from splash to Office respawn (s); can't be hit after respawn (s). */
  respawn: number;
  invuln: number;
  /** Stamina pips; a Smack costs smackCost, a Shove shoveCostMin..shoveCostMax by charge (charge is capped by what
   * you can pay). Regen pips/s after regenDelay (s) without spending; running empty winds you until recoverTo. */
  staminaMax: number;
  smackCost: number;
  shoveCostMin: number;
  shoveCostMax: number;
  regen: number;
  regenDelay: number;
  recoverTo: number;
  /** Comic words (SMACK!, SHOVE!, K.O.!) and speed lines behind flying bodies. */
  words: boolean;
  wordSize: number;
  speedLines: boolean;
}

const BASE: Feel = {
  stun: 1,
  smackRange: 1.3,
  smackCone: 55,
  smackPush: 3,
  smackItems: 2,
  smackCooldown: 0.3,
  holdTime: 0.18,
  chargeTime: 0.8,
  chargeSlow: 0.45,
  shoveRange: 1.5,
  shoveMin: 4,
  shoveMax: 11,
  shoveItems: 3,
  lunge: 3,
  shoveStun: 0.8,
  friction: 3,
  bounce: 0.4,
  chain: 0,
  comboWindow: 2,
  koHits: 3,
  koDaze: 3,
  koItems: 3,
  eggBreak: 0.5,
  hitstop: 0,
  shake: 0.08,
  squash: 0.3,
  respawn: 4,
  invuln: 1.5,
  staminaMax: 3,
  smackCost: 1,
  shoveCostMin: 1,
  shoveCostMax: 2.5,
  regen: 0.8,
  regenDelay: 0.6,
  recoverTo: 1.5,
  words: true,
  wordSize: 1.2,
  speedLines: true,
};

const FEELS: Record<string, { name: string; params: Feel }> = {
  A: { name: 'Slapstick: floaty, long stun, slidey floor', params: BASE },
  B: {
    name: 'Crunchy arcade: hit-stop, big shake, crisp stops',
    params: {
      ...BASE,
      stun: 0.6,
      smackPush: 2,
      smackItems: 3,
      smackCooldown: 0.22,
      chargeTime: 0.5,
      shoveMin: 5,
      shoveMax: 13,
      friction: 7,
      bounce: 0.2,
      hitstop: 0.08,
      shake: 0.25,
      squash: 0.5,
    },
  },
  C: {
    name: 'Heavy sumo: weak Smack, Shove is king',
    params: {
      ...BASE,
      stun: 0.4,
      smackPush: 1.2,
      smackItems: 1,
      chargeTime: 1.2,
      chargeSlow: 0.25,
      shoveRange: 1.8,
      shoveMin: 6,
      shoveMax: 16,
      shoveItems: 5,
      lunge: 6,
      shoveStun: 1.2,
      friction: 2,
      koHits: 4,
      hitstop: 0.04,
      shake: 0.15,
    },
  },
  D: {
    name: 'Pinball: bodies bounce and chain into others',
    params: {
      ...BASE,
      stun: 0.8,
      smackPush: 4.5,
      smackItems: 4,
      shoveMin: 6,
      shoveMax: 12,
      friction: 1.6,
      bounce: 0.95,
      chain: 0.6,
      koItems: 4,
      shake: 0.12,
      squash: 0.4,
    },
  },
};

const CTLS: Record<string, string> = {
  K1: 'One button: tap = Smack, hold = Shove',
  K2: 'Two buttons: Smack and Shove',
  K3: 'Gestures: tap right side = Smack, drag = aimed Shove',
};

// ---------------------------------------------------------------------------------------------------- arena

interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
}
const ISLAND = { x: 9, z: 7 };
/** Water channel |z| < CHANNEL across the middle, crossed by bridges at these x (half-width BRIDGE). */
const CHANNEL = 1.3;
const BRIDGES = [-5, 5];
const BRIDGE = 0.8;
const SOLIDS: Box[] = [
  { x: -3, z: -4.5, w: 3, d: 0.8 },
  { x: 3, z: 4.6, w: 3, d: 0.8 },
  { x: 1, z: -3.6, w: 1.4, d: 0.9 },
  { x: -6.3, z: 3.4, w: 0.9, d: 2.2 },
];
const OFFICE = { x: -7.6, z: -5.6 };
const CRATES = [
  { x: 7.4, z: -5.6 },
  { x: -7.4, z: 5.8 },
];
const PRODUCTS = ['tomato', 'egg', 'pudding'];
const CAP_RED = CAP_COLOURS.red;
const R = TUNING.playerRadius;
const CAP = TUNING.base.stack;
const DT = 1 / 60;

const overFloor = (x: number, z: number): boolean =>
  Math.abs(x) <= ISLAND.x &&
  Math.abs(z) <= ISLAND.z &&
  (Math.abs(z) >= CHANNEL || BRIDGES.some((b) => Math.abs(x - b) <= BRIDGE));

// ---------------------------------------------------------------------------------------------------- sim

interface Pad {
  mx: number;
  mz: number;
  sprint: boolean;
  smack: boolean;
  shove: boolean;
  /** K3: aimed Shove direction (rad) and charge (0–1) from the drag. */
  aim?: number;
  charge?: number;
}
const idle = (): Pad => ({ mx: 0, mz: 0, sprint: false, smack: false, shove: false });

interface Fighter {
  name: string;
  human: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Knockback velocity, on top of walking. */
  kx: number;
  kz: number;
  facing: number;
  stack: string[];
  stun: number;
  daze: number;
  hits: number[];
  /** Smack button held for (s), −1 when up; Shove charge 0–1, −1 when not charging. */
  press: number;
  charge: number;
  cooldown: number;
  /** >0: in the water, seconds until the Office respawn. */
  fall: number;
  invuln: number;
  stamina: number;
  spentAt: number;
  winded: boolean;
  pips: THREE.Sprite[];
  pad: Pad;
  prev: Pad;
  stats: { smacks: number; shoves: number; kos: number; splashes: number; dropped: number };
  ai?: { tx: number; tz: number; wait: number; fight: number };
  ch: Character;
  stars: THREE.Group;
  ring: THREE.Mesh;
  items: THREE.Object3D[];
  squash: number;
}

interface Loose {
  product: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  landed: boolean;
  sink: number;
  obj: THREE.Object3D;
}

interface Fx {
  obj: THREE.Mesh | THREE.Sprite;
  t: number;
  life: number;
  grow: number;
  rise: number;
  /** Comic word: pops past its size, then settles and fades. */
  word?: boolean;
}

const WORD_TEX = new Map<string, THREE.CanvasTexture>();
/** A comic starburst with a word on it, as a sprite texture. */
function wordTexture(text: string, fill: string, ink: string): THREE.CanvasTexture {
  const key = `${text}|${fill}`;
  const found = WORD_TEX.get(key);
  if (found) return found;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.translate(256, 128);
  g.beginPath();
  const spikes = 14;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 ? 0.72 : 1;
    g.lineTo(Math.cos(a) * 240 * r, Math.sin(a) * 118 * r);
  }
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = ink;
  g.stroke();
  g.rotate(-0.12);
  g.font = `900 ${text.length > 7 ? 70 : 92}px "Arial Black", Impact, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 16;
  g.lineJoin = 'round';
  g.strokeStyle = ink;
  g.strokeText(text, 0, 6);
  g.fillStyle = PALETTE.cream;
  g.fillText(text, 0, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  WORD_TEX.set(key, tex);
  return tex;
}
const pickWord = (list: string[]) => list[Math.floor(Math.random() * list.length)];

const LOOKS: [string, CapName][] = [
  ['male-a', 'orange'],
  ['female-b', 'blue'],
  ['orc', 'orange'],
  ['soldier', 'orange'],
  ['archer', 'orange'],
];

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

class Brawl {
  readonly scene = new THREE.Scene();
  readonly fighters: Fighter[] = [];
  readonly loose: Loose[] = [];
  readonly messes: { x: number; z: number; obj: THREE.Mesh }[] = [];
  readonly fx: Fx[] = [];
  t = 0;
  freeze = 0;
  shakeT = 0;
  shakeAmp = 0;
  fightBack = false;

  constructor(
    public P: Feel,
    public ctl: string,
  ) {
    this.buildArena();
  }

  private buildArena(): void {
    const s = this.scene;
    s.background = paletteColor('sky');
    const hemi = new THREE.HemisphereLight(paletteColor('sky'), paletteColor('grass'), LIGHT.hemiIntensity);
    const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunIntensity);
    sun.position.set(10, 22, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
    s.add(hemi, sun);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: paletteColor('sky').multiplyScalar(0.55), roughness: 0.25 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.35;
    water.receiveShadow = true;
    s.add(water);
    const slab = (x: number, z: number, w: number, d: number, colour: string, h = 0.5, y = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paletteMaterial(colour));
      m.position.set(x, y - h / 2, z);
      m.receiveShadow = true;
      m.castShadow = y > 0;
      s.add(m);
      return m;
    };
    const half = (ISLAND.z - CHANNEL) / 2;
    slab(0, CHANNEL + half, ISLAND.x * 2, half * 2, 'path');
    slab(0, -CHANNEL - half, ISLAND.x * 2, half * 2, 'path');
    for (const b of BRIDGES) slab(b, 0, BRIDGE * 2, CHANNEL * 2, 'wood', 0.2);
    for (const b of SOLIDS) slab(b.x, b.z, b.w, b.d, 'wood', 1.1, 1.1);
    slab(OFFICE.x, OFFICE.z, 1.6, 1.6, 'pad', 0.05, 0.02);
    for (const c of CRATES) {
      slab(c.x, c.z, 1.1, 1.1, 'dirt', 0.6, 0.6);
      for (let i = 0; i < 3; i++) {
        const item = itemModel(PRODUCTS[i]);
        item.position.set(c.x - 0.3 + i * 0.3, 0.65, c.z);
        s.add(item);
      }
    }
  }

  add(name: string, human: boolean, x: number, z: number): Fighter {
    const [look, cap] = LOOKS[this.fighters.length % LOOKS.length];
    const ch = lookCharacter(look, cap);
    this.scene.add(ch.root);
    const stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: PALETTE.pad }));
      star.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.35, 0, Math.sin((i * Math.PI * 2) / 3) * 0.35);
      stars.add(star);
    }
    stars.position.y = ch.top + 0.25;
    stars.visible = false;
    ch.root.add(stars);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.6, 32),
      new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.visible = false;
    ch.root.add(ring);
    const pips: THREE.Sprite[] = [];
    for (let i = 0; i < 5; i++) {
      const pip = new THREE.Sprite(new THREE.SpriteMaterial({ color: PALETTE.pad, depthTest: false }));
      pip.scale.set(0.26, 0.1, 1);
      pip.renderOrder = 10;
      pips.push(pip);
      this.scene.add(pip);
    }
    const f: Fighter = {
      name,
      human,
      x,
      z,
      vx: 0,
      vz: 0,
      kx: 0,
      kz: 0,
      facing: 0,
      stack: [],
      stun: 0,
      daze: 0,
      hits: [],
      press: -1,
      charge: -1,
      cooldown: 0,
      fall: 0,
      invuln: 0,
      stamina: this.P.staminaMax,
      spentAt: -99,
      winded: false,
      pips,
      pad: idle(),
      prev: idle(),
      stats: { smacks: 0, shoves: 0, kos: 0, splashes: 0, dropped: 0 },
      ch,
      stars,
      ring,
      items: [],
      squash: 0,
    };
    this.fill(f, 6);
    this.fighters.push(f);
    return f;
  }

  remove(f: Fighter): void {
    this.scene.remove(f.ch.root);
    for (const o of [...f.items, ...f.pips]) this.scene.remove(o);
    this.fighters.splice(this.fighters.indexOf(f), 1);
  }

  fill(f: Fighter, n: number): void {
    while (f.stack.length < n) f.stack.push(PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)]);
  }

  // ------------------------------------------------------------------ step

  step(): void {
    if (this.freeze > 0) {
      this.freeze -= DT;
      return;
    }
    this.t += DT;
    for (const f of this.fighters) {
      if (f.ai) this.think(f);
      this.control(f);
    }
    for (const f of this.fighters) this.move(f);
    this.bump();
    for (const f of this.fighters) this.water(f);
    this.flyLoose();
    for (const f of this.fighters) {
      f.prev = { ...f.pad };
      f.stun = Math.max(0, f.stun - DT);
      f.daze = Math.max(0, f.daze - DT);
      f.cooldown = Math.max(0, f.cooldown - DT);
      f.invuln = Math.max(0, f.invuln - DT);
      if (this.t - f.spentAt > this.P.regenDelay && f.charge < 0)
        f.stamina = Math.min(this.P.staminaMax, f.stamina + this.P.regen * DT);
      if (f.winded && f.stamina >= this.P.recoverTo) f.winded = false;
      if (this.P.speedLines && Math.hypot(f.kx, f.kz) > 4.5 && f.fall <= 0 && Math.random() < 0.6) this.streak(f);
    }
  }

  /** Pays stamina for an attack; false (and a puff of sweat) when it can't. */
  private pay(f: Fighter, cost: number): boolean {
    if (f.winded || f.stamina + 1e-6 < cost) {
      if (this.t - f.spentAt > 0.4) {
        f.spentAt = this.t;
        this.puff(f.x, f.ch.top + 0.3, f.z, PALETTE.sky, 0.25, 0.4, 1);
        if (this.P.words) this.word(f.x, f.ch.top + 0.6, f.z, 'pant…', PALETTE.sky, 0.55);
      }
      return false;
    }
    f.stamina -= cost;
    f.spentAt = this.t;
    if (f.stamina <= 0.05) {
      f.stamina = 0;
      f.winded = true;
    }
    return true;
  }

  /** The most Shove charge f can afford, 0–1; −1 when even a weak Shove is too dear. */
  private chargeCap(f: Fighter): number {
    if (f.winded || f.stamina + 1e-6 < this.P.shoveCostMin) return -1;
    const span = this.P.shoveCostMax - this.P.shoveCostMin;
    return span <= 0 ? 1 : Math.min(1, (f.stamina - this.P.shoveCostMin) / span);
  }

  private busy(f: Fighter): boolean {
    return f.stun > 0 || f.daze > 0 || f.fall > 0;
  }

  private control(f: Fighter): void {
    const p = f.pad;
    if (this.busy(f)) {
      f.press = -1;
      f.charge = -1;
      return;
    }
    const pressed = (k: 'smack' | 'shove') => p[k] && !f.prev[k];
    const released = (k: 'smack' | 'shove') => !p[k] && f.prev[k];
    // Smack button: K1 is tap/hold on the one button; otherwise it Smacks on press.
    if (this.ctl === 'K1') {
      if (pressed('smack')) f.press = 0;
      if (p.smack && f.press >= 0) {
        f.press += DT;
        const cap = this.chargeCap(f);
        if (f.press > this.P.holdTime && cap >= 0)
          f.charge = Math.min(cap, (f.press - this.P.holdTime) / this.P.chargeTime);
      }
      if (released('smack') && f.press >= 0) {
        if (f.charge >= 0) this.shove(f, f.charge);
        else this.smack(f);
        f.press = -1;
        f.charge = -1;
      }
    } else if (pressed('smack')) this.smack(f);
    // Shove button (K2, K3 drag, and P2/gamepad's second button everywhere): charge from 0 while held.
    if (p.shove) {
      if (p.aim !== undefined) f.facing = f.ch.facing = p.aim;
      const cap = this.chargeCap(f);
      if (cap < 0 && pressed('shove')) this.pay(f, this.P.shoveCostMin);
      if (cap >= 0) f.charge = Math.min(cap, p.charge ?? Math.max(0, f.charge) + DT / this.P.chargeTime);
    }
    if (released('shove') && f.charge >= 0) {
      this.shove(f, f.charge);
      f.charge = -1;
    }
  }

  private target(f: Fighter, range: number): Fighter | null {
    let best: Fighter | null = null;
    let bestD = range;
    for (const o of this.fighters) {
      if (o === f || o.fall > 0 || o.invuln > 0) continue;
      const dx = o.x - f.x;
      const dz = o.z - f.z;
      const d = Math.hypot(dx, dz);
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - f.facing), Math.cos(Math.atan2(dx, dz) - f.facing)));
      // aim assist: anyone touching counts, whatever the facing
      if (d <= bestD && (off <= THREE.MathUtils.degToRad(this.P.smackCone) || d < R * 2.2)) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private smack(f: Fighter): void {
    if (f.cooldown > 0 || !this.pay(f, this.P.smackCost)) return;
    f.cooldown = this.P.smackCooldown;
    const v = this.target(f, this.P.smackRange);
    this.swipe(f);
    if (!v) return;
    f.stats.smacks++;
    if (this.P.words) this.word(v.x, v.ch.top + 0.5, v.z, pickWord(['SMACK!', 'WHAP!', 'BOP!', 'THWACK!']), PALETTE.orange);
    const [dx, dz] = this.dir(f, v);
    v.kx += dx * this.P.smackPush;
    v.kz += dz * this.P.smackPush;
    v.stun = Math.max(v.stun, this.P.stun);
    this.fling(v, this.P.smackItems, dx, dz);
    this.hit(f, v, 1);
  }

  private shove(f: Fighter, c: number): void {
    if (!this.pay(f, this.P.shoveCostMin + (this.P.shoveCostMax - this.P.shoveCostMin) * c)) return;
    const sx = Math.sin(f.facing);
    const sz = Math.cos(f.facing);
    f.kx += sx * this.P.lunge * c;
    f.kz += sz * this.P.lunge * c;
    const v = this.target(f, this.P.shoveRange);
    this.puff(f.x + sx, 0.6, f.z + sz, PALETTE.orange, 0.35 + c * 0.4, 0.3);
    if (!v) return;
    f.stats.shoves++;
    if (this.P.words)
      this.word(
        v.x,
        v.ch.top + 0.5,
        v.z,
        c >= 0.95 ? 'KA-SHOVE!!' : pickWord(['SHOVE!', 'WHOOSH!', 'OOF!']),
        c >= 0.95 ? PALETTE.money : PALETTE.leaf,
        0.8 + c * 0.5,
      );
    const [dx, dz] = this.dir(f, v, 0.6);
    const speed = this.P.shoveMin + (this.P.shoveMax - this.P.shoveMin) * c;
    v.kx += dx * speed;
    v.kz += dz * speed;
    v.stun = Math.max(v.stun, this.P.shoveStun * (0.4 + 0.6 * c));
    this.fling(v, Math.round(this.P.shoveItems * c), dx, dz);
    this.hit(f, v, 0.6 + c);
  }

  /** Push direction from f to v, leaning toward f's facing by `aim`. */
  private dir(f: Fighter, v: Fighter, aim = 0.3): [number, number] {
    let dx = v.x - f.x;
    let dz = v.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    dx = (dx / d) * (1 - aim) + Math.sin(f.facing) * aim;
    dz = (dz / d) * (1 - aim) + Math.cos(f.facing) * aim;
    const n = Math.hypot(dx, dz) || 1;
    return [dx / n, dz / n];
  }

  private hit(f: Fighter, v: Fighter, power: number): void {
    v.squash = this.P.squash * Math.min(1.5, power);
    this.freeze = this.P.hitstop * power;
    this.shakeT = 0.25;
    this.shakeAmp = this.P.shake * power;
    this.puff(v.x, 1, v.z, PALETTE.pad, 0.4, 0.25);
    v.hits = v.hits.filter((t) => this.t - t < this.P.comboWindow);
    v.hits.push(this.t);
    if (v.hits.length >= this.P.koHits && v.daze <= 0) {
      v.hits = [];
      v.daze = this.P.koDaze;
      v.stun = 0;
      f.stats.kos++;
      this.fling(v, this.P.koItems, 0, 0);
      this.puff(v.x, 1.2, v.z, PALETTE.pad, 0.8, 0.5);
      if (this.P.words) this.word(v.x, v.ch.top + 1, v.z, 'K.O.!', PALETTE.ink, 1.5);
    }
  }

  /** The top n Items of v's Stack fly off as Loose Items, roughly along (dx, dz). */
  private fling(v: Fighter, n: number, dx: number, dz: number): void {
    for (let i = 0; i < n && v.stack.length; i++) {
      const product = v.stack.pop() as string;
      v.stats.dropped++;
      const a = Math.atan2(dx, dz) + rnd(-1.2, 1.2) + (dx === 0 && dz === 0 ? rnd(0, Math.PI * 2) : 0);
      const sp = rnd(1.5, 3.5);
      const obj = itemModel(product);
      this.scene.add(obj);
      this.loose.push({
        product,
        x: v.x,
        y: FEEL.stackBase + v.stack.length * FEEL.itemSpacing,
        z: v.z,
        vx: Math.sin(a) * sp,
        vz: Math.cos(a) * sp,
        vy: rnd(3, 5.5),
        spin: rnd(-12, 12),
        landed: false,
        sink: 0,
        obj,
      });
    }
  }

  private move(f: Fighter): void {
    const p = f.pad;
    let mx = this.busy(f) ? 0 : p.mx;
    let mz = this.busy(f) ? 0 : p.mz;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    if (len > 0.1 && f.charge < 0) f.facing = Math.atan2(mx, mz);
    if (len > 0.1 && f.charge >= 0 && p.aim === undefined) f.facing = Math.atan2(mx, mz);
    const inMess = this.messes.some((m) => Math.hypot(m.x - f.x, m.z - f.z) < 0.6);
    const top =
      TUNING.base.playerSpeed *
      (p.sprint && f.charge < 0 ? TUNING.sprint.speed : 1) *
      (f.charge >= 0 ? this.P.chargeSlow : 1) *
      (inMess ? 0.6 : 1);
    const dx = mx * top - f.vx;
    const dz = mz * top - f.vz;
    const speeding = len * top >= Math.hypot(f.vx, f.vz);
    const maxDelta = (TUNING.base.playerSpeed / (speeding ? FEEL.accelTime : FEEL.stopTime)) * DT;
    const d = Math.hypot(dx, dz);
    if (d <= maxDelta) {
      f.vx += dx;
      f.vz += dz;
    } else {
      f.vx += (dx / d) * maxDelta;
      f.vz += (dz / d) * maxDelta;
    }
    if (f.fall > 0) return;
    f.x += (f.vx + f.kx) * DT;
    f.z += (f.vz + f.kz) * DT;
    const decay = Math.exp(-this.P.friction * DT);
    f.kx *= decay;
    f.kz *= decay;
    for (const b of SOLIDS) {
      const cx = THREE.MathUtils.clamp(f.x, b.x - b.w / 2, b.x + b.w / 2);
      const cz = THREE.MathUtils.clamp(f.z, b.z - b.d / 2, b.z + b.d / 2);
      const ox = f.x - cx;
      const oz = f.z - cz;
      const dist = Math.hypot(ox, oz);
      if (dist >= R || dist === 0) continue;
      const nx = ox / dist;
      const nz = oz / dist;
      f.x = cx + nx * R;
      f.z = cz + nz * R;
      const kn = f.kx * nx + f.kz * nz;
      if (kn < 0) {
        f.kx -= (1 + this.P.bounce) * kn * nx;
        f.kz -= (1 + this.P.bounce) * kn * nz;
        if (-kn > 3) this.puff(f.x - nx * R, 0.8, f.z - nz * R, PALETTE.cream, 0.3, 0.2);
        if (-kn > 4 && this.P.words) this.word(f.x - nx * R, 1.6, f.z - nz * R, 'BONK!', PALETTE.wood, 0.7);
      }
    }
    // walking into a crate refills the Stack
    if (CRATES.some((c) => Math.hypot(c.x - f.x, c.z - f.z) < 1.2) && Math.random() < DT * 4) this.fill(f, Math.min(CAP, f.stack.length + 1));
  }

  private bump(): void {
    const fs = this.fighters.filter((f) => f.fall <= 0);
    for (let i = 0; i < fs.length; i++)
      for (let j = i + 1; j < fs.length; j++) {
        const a = fs[i];
        const b = fs[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= R * 2 || d === 0) continue;
        const nx = dx / d;
        const nz = dz / d;
        const push = (R * 2 - d) / 2;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        if (this.P.chain <= 0) continue;
        for (const [from, to, s] of [
          [a, b, 1],
          [b, a, -1],
        ] as const) {
          const along = (from.kx * nx + from.kz * nz) * s;
          if (along < 3) continue;
          to.kx += nx * s * along * this.P.chain;
          to.kz += nz * s * along * this.P.chain;
          from.kx *= 1 - this.P.chain;
          from.kz *= 1 - this.P.chain;
          to.stun = Math.max(to.stun, 0.4);
          this.puff((a.x + b.x) / 2, 0.9, (a.z + b.z) / 2, PALETTE.pad, 0.35, 0.2);
        }
      }
  }

  private water(f: Fighter): void {
    if (f.fall > 0) {
      f.fall -= DT;
      if (f.fall <= 0) {
        f.x = OFFICE.x;
        f.z = OFFICE.z;
        f.vx = f.vz = f.kx = f.kz = 0;
        f.stun = f.daze = 0;
        f.hits = [];
        f.invuln = this.P.invuln;
        f.stamina = this.P.staminaMax;
        f.winded = false;
        if (!f.human) this.fill(f, 4);
      }
      return;
    }
    if (overFloor(f.x, f.z)) return;
    f.fall = this.P.respawn;
    f.stats.splashes++;
    f.stats.dropped += f.stack.length;
    f.stack = [];
    f.charge = f.press = -1;
    this.splash(f.x, f.z, 1);
    if (this.P.words) this.word(f.x, 1.2, f.z, 'SPLOOSH!', PALETTE.sky, 1.1);
  }

  private flyLoose(): void {
    for (const l of [...this.loose]) {
      if (l.sink > 0) {
        l.sink += DT;
        l.y -= DT * 0.8;
        if (l.sink > 1) this.dropLoose(l);
        continue;
      }
      if (!l.landed) {
        l.vy -= 18 * DT;
        l.x += l.vx * DT;
        l.z += l.vz * DT;
        l.y += l.vy * DT;
        if (l.y <= 0.15 && l.vy < 0) {
          if (!overFloor(l.x, l.z)) {
            l.sink = DT;
            this.splash(l.x, l.z, 0.4);
          } else if (l.product === 'egg' && Math.random() < this.P.eggBreak) {
            this.mess(l.x, l.z);
            this.dropLoose(l);
            continue;
          } else {
            l.y = 0.15;
            l.landed = true;
          }
        }
        continue;
      }
      const taker = this.fighters.find(
        (f) => f.fall <= 0 && !this.busy(f) && f.stack.length < CAP && Math.hypot(f.x - l.x, f.z - l.z) < 0.6,
      );
      if (taker) {
        taker.stack.push(l.product);
        this.dropLoose(l);
      }
    }
  }

  private dropLoose(l: Loose): void {
    this.scene.remove(l.obj);
    this.loose.splice(this.loose.indexOf(l), 1);
  }

  private mess(x: number, z: number): void {
    const obj = new THREE.Mesh(
      new THREE.CircleGeometry(rnd(0.35, 0.5), 20),
      new THREE.MeshStandardMaterial({ color: PALETTE.pad, roughness: 0.3 }),
    );
    obj.rotation.x = -Math.PI / 2;
    obj.position.set(x, 0.02, z);
    this.scene.add(obj);
    this.messes.push({ x, z, obj });
    if (this.messes.length > 12) this.scene.remove((this.messes.shift() as { obj: THREE.Mesh }).obj);
    this.puff(x, 0.2, z, PALETTE.pad, 0.4, 0.3);
  }

  private splash(x: number, z: number, size: number): void {
    for (let i = 0; i < 3; i++) this.puff(x + rnd(-0.3, 0.3), -0.2, z + rnd(-0.3, 0.3), PALETTE.cream, size, 0.45, 2);
  }

  puff(x: number, y: number, z: number, colour: string, size: number, life: number, rise = 0.5): void {
    const obj = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 8),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9 }),
    );
    obj.position.set(x, y, z);
    obj.scale.setScalar(size * 0.4);
    this.scene.add(obj);
    this.fx.push({ obj, t: 0, life, grow: size, rise });
  }

  word(x: number, y: number, z: number, text: string, fill: string, size = 1): void {
    const obj = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: wordTexture(text, fill, PALETTE.ink), transparent: true, depthTest: false }),
    );
    obj.position.set(x + rnd(-0.2, 0.2), y, z + rnd(-0.2, 0.2));
    obj.material.rotation = rnd(-0.25, 0.25);
    obj.renderOrder = 20;
    this.scene.add(obj);
    this.fx.push({ obj, t: 0, life: 0.75, grow: size * this.P.wordSize, rise: 0.6, word: true });
  }

  /** A white arc swept in front of a Smack. */
  private swipe(f: Fighter): void {
    const arc = Math.PI * 0.9;
    const obj = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.06, 6, 20, arc),
      new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0.9 }),
    );
    // flat on the floor plane, the arc centred on the facing direction
    obj.rotation.set(Math.PI / 2, 0, Math.PI / 2 - arc / 2);
    const g = new THREE.Group();
    g.add(obj);
    g.position.set(f.x, 0.95, f.z);
    g.rotation.y = f.facing;
    this.scene.add(g);
    this.fx.push({ obj, t: 0, life: 0.16, grow: 0, rise: 0 });
    obj.userData.holder = g;
  }

  /** A speed line trailing a flying body. */
  private streak(f: Fighter): void {
    const sp = Math.hypot(f.kx, f.kz);
    const obj = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.5 + sp * 0.06),
      new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0.9 }),
    );
    obj.position.set(f.x - (f.kx / sp) * 0.5 + rnd(-0.3, 0.3), rnd(0.3, 1.4), f.z - (f.kz / sp) * 0.5 + rnd(-0.3, 0.3));
    obj.rotation.y = Math.atan2(f.kx, f.kz);
    this.scene.add(obj);
    this.fx.push({ obj, t: 0, life: 0.22, grow: 0, rise: 0 });
  }

  // ------------------------------------------------------------------ dummies

  private think(f: Fighter): void {
    const ai = f.ai as NonNullable<Fighter['ai']>;
    f.pad = idle();
    if (this.busy(f)) return;
    ai.wait -= DT;
    if (ai.wait > 0) return;
    const dx = ai.tx - f.x;
    const dz = ai.tz - f.z;
    const d = Math.hypot(dx, dz);
    const nx = f.x + (dx / (d || 1)) * 0.6;
    const nz = f.z + (dz / (d || 1)) * 0.6;
    if (d < 0.3 || !overFloor(nx, nz)) {
      // a new spot on the same bank, sometimes a crate
      const side = Math.sign(f.z) || 1;
      const crate = CRATES.find((c) => Math.sign(c.z) === side);
      [ai.tx, ai.tz] =
        crate && Math.random() < 0.25 ? [crate.x, crate.z] : [rnd(-8, 8), side * rnd(CHANNEL + 0.8, ISLAND.z - 0.6)];
      ai.wait = rnd(0, 1.2);
      return;
    }
    f.pad.mx = (dx / d) * 0.55;
    f.pad.mz = (dz / d) * 0.55;
    if (!this.fightBack) return;
    const foe = this.fighters.find((o) => o.human && o.fall <= 0 && Math.hypot(o.x - f.x, o.z - f.z) < 1.2);
    if (!foe) return;
    f.pad.mx = (foe.x - f.x) * 0.3;
    f.pad.mz = (foe.z - f.z) * 0.3;
    ai.fight += DT;
    if (ai.fight > 0.7) {
      ai.fight = 0;
      f.facing = Math.atan2(foe.x - f.x, foe.z - f.z);
      f.pad.smack = true;
    }
  }

  // ------------------------------------------------------------------ view

  draw(dt: number): void {
    const frozen = this.freeze > 0;
    for (const f of this.fighters) {
      const sinking = f.fall > 0 ? this.P.respawn - f.fall : -1;
      f.ch.root.visible = sinking < 0.7;
      f.ch.update(frozen ? 0 : dt, f.x, f.z, f.fall > 0 ? 0 : f.vx, f.fall > 0 ? 0 : f.vz, f.stack.length > 0);
      f.ch.root.position.y = sinking >= 0 ? -sinking * 1.6 : 0;
      f.squash = Math.max(0, f.squash - dt * 3);
      const sq = f.squash * Math.abs(Math.sin(f.squash * 12));
      f.ch.visual.scale.set(1 + sq, 1 - sq, 1 + sq);
      // dazed: tipped over a little and wobbling
      f.ch.visual.rotation.z = f.daze > 0 ? Math.sin(this.t * 6) * 0.25 : f.stun > 0 ? Math.sin(this.t * 30) * 0.08 : 0;
      f.stars.visible = f.daze > 0 || f.stun > 0.3;
      f.stars.scale.setScalar(f.daze > 0 ? 1 : 0.6);
      f.stars.rotation.y += dt * (f.daze > 0 ? 5 : 9);
      f.ring.visible = f.charge >= 0;
      if (f.charge >= 0) {
        f.ring.scale.setScalar(0.8 + f.charge * 1.4);
        (f.ring.material as THREE.MeshBasicMaterial).color.set(f.charge >= 1 ? PALETTE.orange : PALETTE.cream);
        f.ch.visual.position.x = Math.sin(this.t * 60) * 0.03 * f.charge;
      } else f.ch.visual.position.x = 0;
      f.ch.visual.visible = f.invuln <= 0 || Math.floor(this.t * 10) % 2 === 0;
      // stamina pips over the head: full yellow, part-filled cream, empty dark; red blink while winded
      const n = Math.ceil(this.P.staminaMax);
      f.pips.forEach((pip, i) => {
        const fillShare = THREE.MathUtils.clamp(f.stamina - i, 0, 1);
        pip.visible = i < n && f.ch.root.visible;
        pip.position.set(f.x, f.ch.root.position.y + f.ch.top + 0.75, f.z);
        pip.center.set(0.5 - (i - (n - 1) / 2) * 1.25, 0.5);
        const blink = f.winded && Math.floor(this.t * 6) % 2 === 0;
        pip.material.color.set(blink ? CAP_RED : fillShare >= 1 ? PALETTE.pad : fillShare > 0 ? PALETTE.cream : PALETTE.ink);
        pip.material.opacity = fillShare > 0 || blink ? 1 : 0.45;
        pip.material.transparent = true;
        pip.scale.set(0.26 * (fillShare > 0 && fillShare < 1 ? 0.5 + fillShare * 0.5 : 1), 0.1, 1);
      });
      // Stack: one model per Item, rebuilt when the products change
      while (f.items.length > f.stack.length) this.scene.remove(f.items.pop() as THREE.Object3D);
      for (let i = 0; i < f.stack.length; i++) {
        if (!f.items[i] || f.items[i].userData.product !== f.stack[i]) {
          if (f.items[i]) this.scene.remove(f.items[i]);
          f.items[i] = itemModel(f.stack[i]);
          f.items[i].userData.product = f.stack[i];
          this.scene.add(f.items[i]);
        }
        const o = f.items[i];
        o.visible = f.ch.root.visible;
        const lean = f.daze > 0 ? Math.sin(this.t * 6) * 0.06 * i : 0;
        o.position.set(
          f.x + Math.sin(f.ch.facing) * FEEL.stackForward + lean,
          f.ch.root.position.y + FEEL.stackBase + i * FEEL.itemSpacing * (1 - f.squash * 0.5),
          f.z + Math.cos(f.ch.facing) * FEEL.stackForward,
        );
        o.rotation.y = f.ch.facing;
      }
    }
    for (const l of this.loose) {
      l.obj.position.set(l.x, l.y, l.z);
      if (!l.landed && !frozen) l.obj.rotation.x += l.spin * dt;
    }
    for (const e of [...this.fx]) {
      e.t += dt;
      const k = e.t / e.life;
      if (e.word) {
        // pop to 1.35× in the first 15%, settle to 1×, fade over the last 40%
        const pop = k < 0.15 ? (k / 0.15) * 1.35 : 1.35 - Math.min(1, (k - 0.15) / 0.15) * 0.35;
        e.obj.scale.set(e.grow * pop * 1.4, e.grow * pop * 0.7, 1);
      } else if (e.grow > 0) e.obj.scale.setScalar(e.grow * (0.4 + k));
      e.obj.position.y += e.rise * dt;
      (e.obj.material as THREE.Material).opacity = (e.word ? 1 : 0.9) * Math.min(1, e.word ? (1 - k) / 0.4 : 1 - k);
      if (k >= 1) {
        this.scene.remove((e.obj.userData.holder as THREE.Object3D | undefined) ?? e.obj);
        this.fx.splice(this.fx.indexOf(e), 1);
      }
    }
    this.shakeT = Math.max(0, this.shakeT - dt);
  }

  shake(): THREE.Vector3 {
    const a = this.shakeAmp * (this.shakeT / 0.25);
    return new THREE.Vector3(rnd(-a, a), 0, rnd(-a, a));
  }
}

// ---------------------------------------------------------------------------------------------------- camera

const YAW = THREE.MathUtils.degToRad(FEEL.cameraYawDeg);
const PITCH = THREE.MathUtils.degToRad(FEEL.cameraPitchDeg);
const OFFSET = new THREE.Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH));

function aim(cam: THREE.OrthographicCamera, focus: THREE.Vector3, size: number, w: number, h: number): void {
  const short = Math.min(w, h);
  Object.assign(cam, {
    left: (-size / 2) * (w / short),
    right: (size / 2) * (w / short),
    top: (size / 2) * (h / short),
    bottom: (-size / 2) * (h / short),
  });
  cam.updateProjectionMatrix();
  cam.position.copy(focus).addScaledVector(OFFSET, 60);
  cam.lookAt(focus);
}

/** Screen direction (right, up) to a floor direction. */
const toFloor = (sx: number, sy: number): [number, number] => [
  SCREEN_RIGHT.x * sx + SCREEN_UP.x * sy,
  SCREEN_RIGHT.y * sx + SCREEN_UP.y * sy,
];

// ---------------------------------------------------------------------------------------------------- page

const css = `
body{margin:0;overflow:hidden;font:14px system-ui,sans-serif;background:${PALETTE.sky};touch-action:none;user-select:none}
#scene{position:fixed;inset:0;width:100vw;height:100vh;display:block}
.hud{position:fixed;left:8px;top:8px;color:${PALETTE.ink};background:#fff8;border-radius:8px;padding:6px 8px;
  font:12px ui-monospace,monospace;white-space:pre;pointer-events:none;max-width:60vw;overflow:hidden}
.bar{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);display:flex;gap:6px;align-items:center;
  background:${PALETTE.ink};color:${PALETTE.cream};border-radius:999px;padding:4px 8px;box-shadow:0 2px 8px #0006;z-index:5}
.bar button{background:none;border:0;color:inherit;font:inherit;font-size:16px;padding:4px 8px;cursor:pointer}
.bar span{white-space:nowrap;font-size:12px}
.btn{position:fixed;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;
  color:${PALETTE.ink};font-weight:700;font-size:13px;background:${PALETTE.cream}cc;border:3px solid ${PALETTE.ink};
  box-shadow:0 3px 0 ${PALETTE.ink}}
.btn.on{transform:translateY(2px);box-shadow:none}
.joy{position:fixed;width:110px;height:110px;margin:-55px;border-radius:50%;border:2px dashed ${PALETTE.ink}88;
  pointer-events:none;display:none}
.joy i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px;border-radius:50%;background:${PALETTE.ink}88}
.hint{position:fixed;right:12px;bottom:56px;color:${PALETTE.ink};background:#fff8;border-radius:8px;padding:4px 8px;
  font-size:12px;pointer-events:none}
.drag{position:fixed;height:6px;background:${PALETTE.orange};transform-origin:0 50%;border-radius:3px;display:none;
  pointer-events:none}
.label{position:fixed;color:${PALETTE.ink};background:#fffc;border-radius:6px;padding:2px 6px;font-size:12px;
  pointer-events:none}
.cell{position:fixed;border:2px solid #fff0;box-sizing:border-box;cursor:pointer}
.cell:hover,.cell.pick{border-color:${PALETTE.orange}}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement = document.body) {
  const e = document.createElement(tag);
  e.className = cls;
  parent.append(e);
  return e;
}

const url = new URL(location.href);
const pick = (k: string, all: object, d: string): string =>
  (url.searchParams.get(k) ?? '') in all ? (url.searchParams.get(k) as string) : d;
const go = (k: string, v: string | null) => {
  if (v === null) url.searchParams.delete(k);
  else url.searchParams.set(k, v);
  location.href = url.toString();
};

async function start(): Promise<void> {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LIGHT.exposure;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const loading = el('div', 'hud');
  loading.textContent = 'Loading models…';
  await loadAssets((d, t) => (loading.textContent = `Loading models… ${d}/${t}`));
  loading.remove();
  const feelKey = pick('feel', FEELS, 'D');
  const ctl = pick('ctl', CTLS, 'K1');
  if (url.searchParams.has('gallery')) gallery(renderer, ctl);
  else play(renderer, feelKey, ctl);
}

// ------------------------------------------------------------------ gallery: every preset, scripted, side by side

function gallery(renderer: THREE.WebGLRenderer, ctl: string): void {
  const keys = Object.keys(FEELS);
  const cams = keys.map(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200));
  const shows = keys.map((k) => {
    const b = new Brawl({ ...FEELS[k].params }, 'K2');
    const bully = b.add('Sam', true, 0, 6.2);
    const victim = b.add('Dummy', false, 0, 3.6);
    victim.stack = ['egg', 'tomato', 'egg', 'pudding', 'egg', 'tomato', 'egg', 'egg'];
    return { b, bully, victim, phase: 'approach', t: 0, n: 0 };
  });
  const cells = keys.map((k, i) => {
    const c = el('div', 'cell');
    const label = el('div', 'label');
    label.textContent = `${k}: ${FEELS[k].name}`;
    c.onclick = () => {
      url.searchParams.delete('gallery');
      go('feel', k);
    };
    return { c, label, i };
  });
  const bar = el('div', 'bar');
  bar.innerHTML = `<span>Gallery: tap a preset to play it</span>`;
  const layout = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    const cols = innerWidth > innerHeight ? 4 : 2;
    const rows = Math.ceil(keys.length / cols);
    return { cols, rows, w: innerWidth / cols, h: innerHeight / rows };
  };
  // the bully walks up, Smacks to a Knockout, then charges a full Shove toward the water
  const script = (s: (typeof shows)[number]) => {
    const { bully: f, victim: v } = s;
    f.pad = idle();
    s.t += DT;
    if (s.phase === 'approach') {
      const d = Math.hypot(v.x - f.x, v.z - f.z);
      f.pad.mx = (v.x - f.x) / d;
      f.pad.mz = (v.z - f.z) / d;
      if (d < 1) [s.phase, s.t, s.n] = ['smack', 0, 0];
    } else if (s.phase === 'smack') {
      f.facing = Math.atan2(v.x - f.x, v.z - f.z);
      f.pad.smack = s.t % 0.4 < 0.05;
      if (s.t > 0.4 * s.b.P.koHits + 0.1) [s.phase, s.t] = ['charge', 0];
      const d = Math.hypot(v.x - f.x, v.z - f.z);
      if (d > 1) {
        f.pad.mx = (v.x - f.x) / d;
        f.pad.mz = (v.z - f.z) / d;
      }
    } else if (s.phase === 'charge') {
      const d = Math.hypot(v.x - f.x, v.z - f.z);
      if (d > 0.9) {
        f.pad.mx = ((v.x - f.x) / d) * 0.6;
        f.pad.mz = ((v.z - f.z) / d) * 0.6;
      }
      f.pad.aim = Math.atan2(v.x - f.x, v.z - f.z);
      // winded after the Smacks: wait for enough stamina to pay a full Shove
      if (f.winded || f.stamina < s.b.P.shoveCostMax) s.t = 0;
      f.pad.shove = s.t > 0 && s.t < s.b.P.chargeTime + 0.15;
      if (s.t > s.b.P.chargeTime + 0.3) [s.phase, s.t] = ['after', 0];
    } else if (s.t > s.b.P.respawn + 1.5) {
      Object.assign(f, { x: 0, z: 6.2, kx: 0, kz: 0, vx: 0, vz: 0, stamina: s.b.P.staminaMax, winded: false });
      Object.assign(v, { x: 0, z: 3.6, kx: 0, kz: 0, vx: 0, vz: 0, fall: 0, stun: 0, daze: 0, hits: [], invuln: 0 });
      v.stack = ['egg', 'tomato', 'egg', 'pudding', 'egg', 'tomato', 'egg', 'egg'];
      for (const l of [...s.b.loose]) s.b.scene.remove(l.obj);
      s.b.loose.length = 0;
      [s.phase, s.t] = ['approach', 0];
    }
  };
  let acc = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= DT) {
      for (const s of shows) {
        script(s);
        s.b.step();
      }
      acc -= DT;
    }
    const L = layout();
    renderer.setScissorTest(true);
    shows.forEach((s, i) => {
      s.b.draw(dt);
      const cx = i % L.cols;
      const cy = Math.floor(i / L.cols);
      const x = cx * L.w;
      const y = innerHeight - (cy + 1) * L.h;
      renderer.setViewport(x, y, L.w, L.h);
      renderer.setScissor(x, y, L.w, L.h);
      aim(cams[i], new THREE.Vector3(0, 0, 3.2).add(s.b.shake()), 9, L.w, L.h);
      renderer.render(s.b.scene, cams[i]);
      Object.assign(cells[i].c.style, { left: `${x}px`, top: `${cy * L.h}px`, width: `${L.w}px`, height: `${L.h}px` });
      Object.assign(cells[i].label.style, { left: `${x + 6}px`, top: `${cy * L.h + 6}px` });
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  void ctl;
}

// ------------------------------------------------------------------ play

function play(renderer: THREE.WebGLRenderer, feelKey: string, ctl: string): void {
  const P: Feel = { ...FEELS[feelKey].params };
  const b = new Brawl(P, ctl);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const p1 = b.add('P1', true, -2, -3);
  let p2: Fighter | null = null;
  const dummies: Fighter[] = [];
  const opts = { dummies: 2, fightBack: false };
  const setDummies = () => {
    while (dummies.length > opts.dummies) b.remove(dummies.pop() as Fighter);
    while (dummies.length < opts.dummies) {
      const d = b.add(`Dummy ${dummies.length + 1}`, false, rnd(-6, 6), dummies.length % 2 ? 4 : -2.5);
      d.ai = { tx: d.x, tz: d.z, wait: 0, fight: 0 };
      dummies.push(d);
    }
  };
  setDummies();

  // ---------------- input: keyboard, gamepad, touch
  const keys = new Set<string>();
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (['Slash', 'Period', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftRight'].includes(e.code) && !p2)
      p2 = b.add('P2', true, 2, 3);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const keyPad = (up: string, down: string, left: string, right: string, sprint: string, smack: string, shove: string): Pad => {
    const sx = (keys.has(right) ? 1 : 0) - (keys.has(left) ? 1 : 0);
    const sy = (keys.has(up) ? 1 : 0) - (keys.has(down) ? 1 : 0);
    const n = Math.hypot(sx, sy) || 1;
    const [mx, mz] = toFloor(sx / n, sy / n);
    return { mx, mz, sprint: keys.has(sprint), smack: keys.has(smack), shove: keys.has(shove) };
  };
  const gamepad = (): Pad | null => {
    const g = navigator.getGamepads?.().find((x) => x);
    if (!g) return null;
    const ax = Math.abs(g.axes[0]) > 0.15 ? g.axes[0] : 0;
    const ay = Math.abs(g.axes[1]) > 0.15 ? g.axes[1] : 0;
    const [mx, mz] = toFloor(ax, -ay);
    const btn = (i: number) => !!g.buttons[i]?.pressed;
    return { mx, mz, sprint: btn(7) || btn(5), smack: btn(0), shove: btn(1) || btn(2) };
  };

  const touch = { mx: 0, mz: 0, force: 0, smack: false, shove: false, aim: undefined as number | undefined, charge: undefined as number | undefined };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const joy = el('div', 'joy');
  const knob = el('i', '', joy);
  const drag = el('div', 'drag');
  const buttons: { e: HTMLElement; kind: 'smack' | 'shove' }[] = [];
  if (coarse) {
    const mk = (label: string, kind: 'smack' | 'shove', size: number, right: number, bottom: number) => {
      const e = el('div', 'btn');
      e.innerHTML = label;
      Object.assign(e.style, { width: `${size}px`, height: `${size}px`, right: `${right}px`, bottom: `${bottom}px` });
      buttons.push({ e, kind });
      return e;
    };
    if (ctl === 'K1') mk('SMACK<br><small>hold: SHOVE</small>', 'smack', 112, 28, 60);
    if (ctl === 'K2') {
      mk('SMACK', 'smack', 104, 24, 56);
      mk('SHOVE<br><small>hold</small>', 'shove', 80, 140, 36);
    }
    if (ctl === 'K3') el('div', 'hint').textContent = 'tap right side = Smack · drag = aimed Shove';
  }
  const pointers = new Map<number, { kind: 'joy' | 'smack' | 'shove' | 'gesture'; x: number; y: number; t: number }>();
  const JOY = FEEL.joyLandscape / 2;
  canvas().addEventListener('pointerdown', onDown);
  for (const bt of buttons) bt.e.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (p.kind === 'joy') {
      const len = Math.hypot(dx, dy);
      const k = Math.min(1, len / JOY);
      touch.force = len / JOY;
      const push = Math.min(1, k / FEEL.joyFullPush);
      [touch.mx, touch.mz] = len > 0 ? toFloor((dx / len) * push, (-dy / len) * push) : [0, 0];
      knob.style.transform = `translate(${(dx / (len || 1)) * k * JOY}px,${(dy / (len || 1)) * k * JOY}px)`;
    }
    if (p.kind === 'gesture') {
      const len = Math.hypot(dx, dy);
      if (len > 18) {
        touch.shove = true;
        const [fx, fz] = toFloor(dx / len, -dy / len);
        touch.aim = Math.atan2(fx, fz);
        touch.charge = Math.min(1, (len - 18) / 110);
        Object.assign(drag.style, {
          display: 'block',
          left: `${p.x}px`,
          top: `${p.y - 3}px`,
          width: `${len}px`,
          transform: `rotate(${Math.atan2(dy, dx)}rad)`,
        });
      }
    }
  });
  const onUp = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (p.kind === 'joy') {
      touch.mx = touch.mz = touch.force = 0;
      joy.style.display = 'none';
    }
    if (p.kind === 'smack') touch.smack = false;
    if (p.kind === 'shove') touch.shove = false;
    if (p.kind === 'gesture') {
      if (!touch.shove) pulse = 2;
      touch.shove = false;
      drag.style.display = 'none';
    }
    for (const bt of buttons) bt.e.classList.toggle('on', [...pointers.values()].some((q) => q.kind === bt.kind));
  };
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  let pulse = 0;
  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && !coarse) return;
    e.preventDefault();
    const bt = buttons.find((x) => x.e === e.currentTarget);
    const kind = bt ? bt.kind : e.clientX < innerWidth * FEEL.joyZone ? 'joy' : ctl === 'K3' ? 'gesture' : null;
    if (!kind) return;
    pointers.set(e.pointerId, { kind, x: e.clientX, y: e.clientY, t: performance.now() });
    if (kind === 'joy') Object.assign(joy.style, { display: 'block', left: `${e.clientX}px`, top: `${e.clientY}px` });
    if (kind === 'smack') touch.smack = true;
    if (kind === 'shove') {
      touch.shove = true;
      touch.aim = touch.charge = undefined;
    }
    bt?.e.classList.add('on');
  }
  function canvas(): HTMLElement {
    return renderer.domElement;
  }
  const touchPad = (): Pad => {
    const smack = touch.smack || pulse > 0;
    if (pulse > 0) pulse--;
    return {
      mx: touch.mx,
      mz: touch.mz,
      sprint: touch.force > FEEL.sprintForce,
      smack,
      shove: touch.shove,
      aim: touch.shove ? touch.aim : undefined,
      charge: touch.shove ? touch.charge : undefined,
    };
  };

  // ---------------- tuning panel and switcher
  const gui = new GUI({ title: `Brawl feel ${feelKey}` });
  if (coarse) gui.close();
  const feel = gui.addFolder('Feel');
  for (const k of Object.keys(P) as (keyof Feel)[]) feel.add(P, k).listen();
  feel.close();
  gui.add(opts, 'dummies', 0, 3, 1).onChange(setDummies);
  gui.add(opts, 'fightBack').name('dummies fight back').onChange((v: boolean) => (b.fightBack = v));
  gui.add(
    {
      dump: () => {
        const json = JSON.stringify({ feel: feelKey, ctl, params: P }, null, 2);
        console.log(json);
        void navigator.clipboard?.writeText(json);
        alertBox(json);
      },
    },
    'dump',
  ).name('Dump current values');
  const alertBox = (text: string) => {
    const box = el('pre', 'hud');
    Object.assign(box.style, { left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'auto', zIndex: '9' });
    box.textContent = `${text}\n\n(copied — tap to close)`;
    box.onclick = () => box.remove();
  };
  const cycle = (k: string, all: object, cur: string, step: number) => {
    const list = Object.keys(all);
    go(k, list[(list.indexOf(cur) + step + list.length) % list.length]);
  };
  const bar = el('div', 'bar');
  const btn = (label: string, fn: () => void) => {
    const e = el('button', '', bar);
    e.textContent = label;
    e.onclick = fn;
  };
  btn('◀', () => cycle('feel', FEELS, feelKey, -1));
  el('span', '', bar).textContent = `Feel ${feelKey}`;
  btn('▶', () => cycle('feel', FEELS, feelKey, 1));
  btn('◀', () => cycle('ctl', CTLS, ctl, -1));
  el('span', '', bar).textContent = `${ctl}${coarse ? '' : ' (phone)'}`;
  btn('▶', () => cycle('ctl', CTLS, ctl, 1));
  btn('▦', () => go('gallery', '1'));
  const hud = el('div', 'hud');

  // ---------------- loop
  const focus = new THREE.Vector3(p1.x, 0, p1.z);
  let size = coarse ? FEEL.zoomPhone : FEEL.zoomDesktop;
  let acc = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const pad = gamepad();
    if (pad && !p2) p2 = b.add('P2', true, 2, 3);
    p1.pad = coarse
      ? touchPad()
      : keyPad('KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft', 'Space', 'KeyE');
    if (p2) {
      const k = keyPad('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftRight', 'Slash', 'Period');
      p2.pad = pad && Math.hypot(pad.mx, pad.mz) + +pad.smack + +pad.shove > Math.hypot(k.mx, k.mz) + +k.smack + +k.shove ? pad : k;
    }
    acc += dt;
    while (acc >= DT) {
      b.step();
      acc -= DT;
    }
    b.draw(dt);
    const humans = b.fighters.filter((f) => f.human && f.fall <= 0);
    if (humans.length) {
      const cx = humans.reduce((s, f) => s + f.x, 0) / humans.length;
      const cz = humans.reduce((s, f) => s + f.z, 0) / humans.length;
      const spread = Math.max(...humans.map((f) => Math.hypot(f.x - cx, f.z - cz)));
      focus.lerp(new THREE.Vector3(cx, 0, cz), 1 - Math.exp(-6 * dt));
      const want = Math.min(26, Math.max(coarse ? FEEL.zoomPhone : FEEL.zoomDesktop, spread * 2.4 + 8));
      size += (want - size) * (1 - Math.exp(-3 * dt));
    }
    renderer.setSize(innerWidth, innerHeight, false);
    aim(camera, focus.clone().add(b.shake()), size, innerWidth, innerHeight);
    renderer.render(b.scene, camera);
    hud.textContent =
      `Feel ${feelKey}: ${FEELS[feelKey].name}\nControls ${ctl}: ${CTLS[ctl]}\n` +
      (coarse ? '' : 'P1: WASD · Shift sprint · Space smack (K1: hold = shove) · E shove\n') +
      (coarse ? '' : 'P2: arrows · RShift · / smack · . shove  (or a gamepad: A smack, B shove)\n') +
      b.fighters
        .map((f) => {
          const state = f.fall > 0 ? `SPLASH ${f.fall.toFixed(1)}` : f.daze > 0 ? `KO ${f.daze.toFixed(1)}` : f.stun > 0 ? `stun ${f.stun.toFixed(1)}` : f.charge >= 0 ? `charge ${Math.round(f.charge * 100)}%` : '';
          const s = f.stats;
          const sta = `${f.stamina.toFixed(1)}${f.winded ? ' WINDED' : ''}`;
          return `${f.name.padEnd(8)} stamina ${sta.padEnd(10)} stack ${String(f.stack.length).padStart(2)} ${state.padEnd(11)} smack ${s.smacks} shove ${s.shoves} KO ${s.kos} splash ${s.splashes} lost ${s.dropped}`;
        })
        .join('\n') +
      `\nloose ${b.loose.length} · messes ${b.messes.length}`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
