// PROTOTYPE (throwaway, branch prototype/cleaning-look): `?clean=A|B|C` — the look of the cleaning fixtures:
// Mop Stand, the mop in hand and mopping, stink lines, the grumpy bubble, the Trash Bin and the Clean cap.
// A light rules layer runs the mop here (take it with an empty Stack, 2 s on a Mess); the sim itself is untouched.
import * as THREE from 'three';
import type { Game } from './game';
import type { Station } from '../sim/world';
import { distToBox } from '../sim/geometry';
import { TUNING } from '../sim/tuning';
import { Character } from '../view/characters';
import { CanvasTex, canvasSprite, outlinedText, roundRect } from '../view/text';
import { PALETTE, SHADES } from '../palette';
import { SCREEN_RIGHT } from '../view/stage';

type StandStyle = 'bucket' | 'rack' | 'cart';
type BinStyle = 'metal' | 'wheelie' | 'pedal';
type StinkStyle = 'lines' | 'clouds' | 'flies';
interface Params {
  stand: StandStyle;
  bin: BinStyle;
  stink: StinkStyle;
  mops: number;
  cleanTime: number;
  suds: number;
  shrinkTo: number;
  bubbleSize: number;
  angerTime: number;
  lidOpen: number;
  cleanCap: string;
}
const BASE: Params = {
  stand: 'bucket',
  bin: 'metal',
  stink: 'lines',
  mops: 1,
  cleanTime: 2,
  suds: 10,
  shrinkTo: 0.25,
  bubbleSize: 0.75,
  angerTime: 4,
  lidOpen: 1.1,
  cleanCap: '#f2c230',
};
const PRESETS: Record<string, { name: string; params: Params }> = {
  A: { name: 'Bucket + metal bin + wavy stink lines', params: { ...BASE } },
  B: {
    name: 'Wall rack + wheelie bin + stink clouds',
    params: { ...BASE, stand: 'rack', bin: 'wheelie', stink: 'clouds' },
  },
  C: {
    name: 'Janitor cart + pedal bin with a face + flies',
    params: { ...BASE, stand: 'cart', bin: 'pedal', stink: 'flies' },
  },
};
const VARIANTS = Object.keys(PRESETS);
const CAP_CHOICES = { yellow: '#f2c230', teal: '#2bb3a3', lime: '#8bc34a', pink: '#e86aa6' };

type Look = { ch: Character };
type ViewGuts = {
  player: Character;
  splats: Map<number, THREE.Group>;
  customers: Map<number, Look>;
  batch: { setScale: (id: string, xz: number, y: number) => void };
  addSplat: (id: number, x: number, z: number, items: string[]) => void;
  juice: { puff: (at: THREE.Vector3, color: string, count?: number, spread?: number) => void };
};

const mat = (c: string, opts: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...opts });
const box = (w: number, h: number, d: number, c: string) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
const cyl = (rt: number, rb: number, h: number, c: string, seg = 16) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
const shadowAll = (g: THREE.Object3D) => g.traverse((o) => (o.castShadow = true));

function mopModel(): THREE.Group {
  const g = new THREE.Group();
  const stick = cyl(0.03, 0.03, 1.35, PALETTE.wood, 8);
  stick.position.y = 0.85;
  const clamp = cyl(0.06, 0.06, 0.08, '#9aa3ad', 10);
  clamp.position.y = 0.2;
  const head = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const strand = cyl(0.025, 0.035, 0.28, SHADES.white, 6);
    const a = (i / 9) * Math.PI * 2;
    strand.position.set(Math.cos(a) * 0.07, 0.09, Math.sin(a) * 0.07);
    strand.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    head.add(strand);
  }
  g.add(stick, clamp, head);
  shadowAll(g);
  return g;
}

/** Mop Stand: holds up to `n` mops; `free` of them are shown. Returns the group and the mop slots. */
function standModel(style: StandStyle): { g: THREE.Group; slots: THREE.Group[] } {
  const g = new THREE.Group();
  const slots: THREE.Group[] = [];
  const addSlots = (pos: [number, number, number][], tilt = 0) =>
    pos.forEach(([x, y, z]) => {
      const m = mopModel();
      m.position.set(x, y, z);
      m.rotation.z = tilt;
      g.add(m);
      slots.push(m);
    });
  if (style === 'bucket') {
    const bucket = cyl(0.36, 0.3, 0.45, '#f2c230', 20);
    bucket.position.y = 0.3;
    const water = cyl(0.33, 0.33, 0.02, '#7fc7e8', 20);
    water.position.y = 0.48;
    const wringer = box(0.5, 0.12, 0.2, '#3d7fd6');
    wringer.position.set(0, 0.6, -0.25);
    for (const [x, z] of [
      [-0.25, -0.25],
      [0.25, -0.25],
      [-0.25, 0.25],
      [0.25, 0.25],
    ]) {
      const wheel = cyl(0.06, 0.06, 0.05, PALETTE.ink, 10);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.06, z);
      g.add(wheel);
    }
    g.add(bucket, water, wringer);
    addSlots(
      [
        [-0.12, 0.25, 0.05],
        [0.1, 0.25, 0.1],
        [0.02, 0.25, -0.1],
      ],
      0.12,
    );
  } else if (style === 'rack') {
    const board = box(1.0, 0.7, 0.08, PALETTE.wood);
    board.position.set(0, 1.45, -0.42);
    const pail = cyl(0.22, 0.18, 0.3, '#3d7fd6');
    pail.position.set(0.32, 0.15, 0);
    g.add(board, pail);
    for (let i = 0; i < 3; i++) {
      const peg = cyl(0.03, 0.03, 0.18, PALETTE.ink, 6);
      peg.rotation.x = Math.PI / 2;
      peg.position.set(-0.3 + i * 0.3, 1.5, -0.32);
      g.add(peg);
    }
    // mops hang head-up from the pegs
    addSlots([
      [-0.3, 1.75, -0.3],
      [0, 1.75, -0.3],
      [0.3, 1.75, -0.3],
    ]);
    for (const m of slots) m.rotation.x = Math.PI;
  } else {
    const base = box(0.9, 0.12, 0.55, '#3d7fd6');
    base.position.y = 0.2;
    const shelf = box(0.9, 0.06, 0.55, '#3d7fd6');
    shelf.position.y = 0.75;
    for (const [x, z] of [
      [-0.42, -0.25],
      [0.42, -0.25],
      [-0.42, 0.25],
      [0.42, 0.25],
    ]) {
      const post = box(0.05, 0.7, 0.05, '#9aa3ad');
      post.position.set(x, 0.5, z);
      const wheel = cyl(0.07, 0.07, 0.05, PALETTE.ink, 10);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.07, z);
      g.add(post, wheel);
    }
    const spray = cyl(0.05, 0.06, 0.22, '#2bb3a3', 10);
    spray.position.set(0.25, 0.9, 0.1);
    const sign = new THREE.Group();
    const a = box(0.36, 0.55, 0.03, '#f2c230');
    a.rotation.x = 0.25;
    a.position.set(0, 0.28, 0.07);
    const b = a.clone();
    b.rotation.x = -0.25;
    b.position.z = -0.07;
    sign.add(a, b);
    sign.position.set(-0.75, 0, 0.1);
    const tex = new CanvasTex(256, 256);
    tex.draw((c, w, h) => outlinedText(c, 'WET', w / 2, h / 2 - 30, 70, PALETTE.ink, PALETTE.cream));
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({ map: tex.texture, transparent: true }),
    );
    label.position.set(-0.75, 0.33, 0.24);
    label.rotation.x = -0.25;
    g.add(base, shelf, spray, sign, label);
    addSlots(
      [
        [-0.25, 0.3, 0.05],
        [-0.05, 0.3, 0.05],
        [0.12, 0.3, -0.05],
      ],
      -0.1,
    );
  }
  shadowAll(g);
  return { g, slots };
}

/** Trash Bin with a hinged lid; `lid` pivots at the back edge. */
function binModel(style: BinStyle): { g: THREE.Group; lid: THREE.Group; ring: THREE.Mesh } {
  const g = new THREE.Group();
  const lid = new THREE.Group();
  if (style === 'metal') {
    const can = cyl(0.36, 0.3, 0.9, '#9aa3ad', 20);
    can.position.y = 0.45;
    for (let i = 0; i < 3; i++) {
      const rib = cyl(0.365, 0.365, 0.03, '#7d8690', 20);
      rib.position.y = 0.2 + i * 0.25;
      g.add(rib);
    }
    const top = cyl(0.39, 0.39, 0.06, '#7d8690', 20);
    top.position.set(0, 0, 0.38);
    const knob = cyl(0.06, 0.06, 0.08, PALETTE.ink, 10);
    knob.position.set(0, 0.06, 0.38);
    lid.add(top, knob);
    lid.position.set(0, 0.92, -0.38);
    g.add(can);
  } else if (style === 'wheelie') {
    const body = box(0.7, 1.0, 0.7, '#3f9e4f');
    body.position.y = 0.55;
    const top = box(0.76, 0.07, 0.76, '#2f7d3f');
    top.position.set(0, 0, 0.38);
    const handle = box(0.6, 0.06, 0.06, PALETTE.ink);
    handle.position.set(0, 0.05, 0.02);
    lid.add(top, handle);
    lid.position.set(0, 1.07, -0.38);
    for (const x of [-0.3, 0.3]) {
      const wheel = cyl(0.1, 0.1, 0.07, PALETTE.ink, 12);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.1, -0.32);
      g.add(wheel);
    }
    g.add(body);
  } else {
    const can = cyl(0.3, 0.3, 0.8, '#e86aa6', 20);
    can.position.y = 0.4;
    const top = cyl(0.31, 0.31, 0.08, PALETTE.cream, 20);
    top.position.set(0, 0, 0.31);
    lid.add(top);
    lid.position.set(0, 0.82, -0.31);
    const pedal = box(0.22, 0.04, 0.12, PALETTE.ink);
    pedal.position.set(0, 0.05, 0.35);
    // a little face on the front
    const tex = new CanvasTex(256, 256);
    tex.draw((c, w) => {
      c.fillStyle = PALETTE.ink;
      for (const x of [w / 2 - 50, w / 2 + 50]) {
        c.beginPath();
        c.arc(x, 100, 16, 0, Math.PI * 2);
        c.fill();
      }
      c.lineWidth = 12;
      c.strokeStyle = PALETTE.ink;
      c.beginPath();
      c.arc(w / 2, 140, 40, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
    });
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.4),
      new THREE.MeshBasicMaterial({ map: tex.texture, transparent: true }),
    );
    face.position.set(0, 0.45, 0.305);
    g.add(can, pedal, face);
  }
  g.add(lid);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.68, 40, 1, 0, 0.001),
    new THREE.MeshBasicMaterial({ color: PALETTE.orange, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);
  shadowAll(g);
  return { g, lid, ring };
}

function stinkModel(style: StinkStyle): THREE.Group {
  const g = new THREE.Group();
  const green = new THREE.MeshBasicMaterial({ color: '#7fae3a', transparent: true, opacity: 0.8, depthWrite: false });
  if (style === 'lines') {
    for (let i = 0; i < 3; i++) {
      const pts = Array.from({ length: 12 }, (_, k) => new THREE.Vector3(Math.sin(k * 0.9 + i) * 0.08, k * 0.07, 0));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 6), green.clone());
      tube.position.x = (i - 1) * 0.22;
      tube.userData.phase = i * 0.7;
      g.add(tube);
    }
  } else if (style === 'clouds') {
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), green.clone());
      puff.userData.phase = i * 0.5;
      g.add(puff);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const fly = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 6),
        new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
      );
      const wing = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, 0.05),
        new THREE.MeshBasicMaterial({ color: SHADES.white, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
      );
      wing.position.y = 0.03;
      fly.add(body, wing);
      fly.userData.phase = (i / 3) * Math.PI * 2;
      g.add(fly);
    }
    for (let i = 0; i < 2; i++) {
      const pts = Array.from({ length: 10 }, (_, k) => new THREE.Vector3(Math.sin(k * 0.9 + i) * 0.06, k * 0.06, 0));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.02, 6), green.clone());
      tube.position.x = (i - 0.5) * 0.25;
      tube.userData.phase = i;
      tube.userData.line = true;
      g.add(tube);
    }
  }
  g.userData.style = style;
  return g;
}

function animateStink(g: THREE.Group, t: number): void {
  const style = g.userData.style as StinkStyle;
  for (const c of g.children) {
    const ph = (c.userData.phase as number) ?? 0;
    const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (style === 'lines' || c.userData.line) {
      const k = (t * 0.6 + ph) % 1;
      c.position.y = 0.15 + k * 0.6;
      if (m) m.opacity = Math.sin(k * Math.PI) * 0.85;
    } else if (style === 'clouds') {
      const k = (t * 0.4 + ph) % 1;
      c.position.set(Math.sin((t + ph) * 2) * 0.15, 0.2 + k * 0.9, Math.cos((t + ph) * 2) * 0.1);
      c.scale.setScalar(0.6 + k * 0.9);
      if (m) m.opacity = Math.sin(k * Math.PI) * 0.6;
    } else {
      const a = t * 4 + ph;
      c.position.set(Math.cos(a) * 0.35, 0.45 + Math.sin(a * 2.3) * 0.12, Math.sin(a) * 0.35);
      c.children[1].rotation.x = Math.sin(t * 60) * 0.8;
    }
  }
}

/** The grumpy bubble: 💢 and a scowl, angrier with `k` 0..1. */
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
    // scowl: slanted brows, flat-to-down mouth
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

export async function openCleaningPrototype(game: Game): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const url = new URL(location.href);
  let variant = url.searchParams.get('clean') ?? 'A';
  if (!PRESETS[variant]) variant = 'A';
  const P: Params = { ...PRESETS[variant].params };
  const view = game.view as unknown as ViewGuts;
  const scene = game.stage.scene;
  const w = () => game.world;
  TUNING.messClearRadius = -1; // walking over a Mess no longer cleans it

  // ---------- Mop Stand
  const standPlace = () => w().map.layout.places.mop_stand?.box;
  let stand: ReturnType<typeof standModel> | null = null;
  let freeMops = P.mops;
  const cleaner = new Character('employee', { hat: P.cleanCap });
  scene.add(cleaner.root);
  const buildStand = () => {
    if (stand) scene.remove(stand.g);
    const b = standPlace();
    if (!b) return;
    stand = standModel(P.stand);
    stand.g.position.set(b[0] + b[2] / 2, 0, b[1] + b[3] / 2);
    scene.add(stand.g);
    cleaner.setHat(P.cleanCap);
  };
  const showFree = () => stand?.slots.forEach((m, i) => (m.visible = i < Math.min(freeMops, P.mops)));

  // ---------- mop in hand
  const handMop = mopModel();
  handMop.visible = false;
  view.player.root.add(handMop);
  handMop.position.set(0.35, 0, 0.25);
  let holding = false;
  let nearStandBefore = false;
  let swish = 0;
  const progress = new Map<number, number>();
  const suds: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  const sudMat = new THREE.MeshBasicMaterial({ color: SHADES.white, transparent: true, opacity: 0.9 });
  const sudGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const cleanRing = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.85, 40, 1, 0, 0.001),
    new THREE.MeshBasicMaterial({ color: '#7fc7e8', transparent: true, opacity: 0.9, depthWrite: false }),
  );
  cleanRing.rotation.x = -Math.PI / 2;
  cleanRing.renderOrder = 3;
  scene.add(cleanRing);
  const setHolding = (on: boolean) => {
    holding = on;
    handMop.visible = on;
    freeMops += on ? -1 : 1;
    game.manualGrab = on; // with the mop in hand, nothing is picked up
    view.juice.puff(view.player.root.position.clone().setY(0.9), PALETTE.cream, 6, 0.8);
    showFree();
  };

  // ---------- stinks and bubbles
  const stinks = new Map<number, THREE.Group>();
  const bubbles = new Map<number, { s: THREE.Sprite; tex: CanvasTex; inFor: number; outFor: number }>();
  const rebuildStinks = () => {
    for (const s of stinks.values()) scene.remove(s);
    stinks.clear();
  };

  // ---------- Trash Bins
  const bins = new Map<string, ReturnType<typeof binModel> & { open: number; slam: number; had: number }>();
  const buildBins = () => {
    for (const b of bins.values()) scene.remove(b.g);
    bins.clear();
  };
  const trashStations = () => [...w().stations.values()].filter((s): s is Station => s.kind === 'trash');

  // ---------- tools
  const tools = {
    messHere: () => {
      const p = w().player;
      const id = w().nextId++;
      const items = ['egg', 'tomato', 'milk'].slice(0, 1 + (id % 3));
      w().messes.push({ id, x: p.x + 1.2, z: p.z + 0.6, items });
      view.addSplat(id, p.x + 1.2, p.z + 0.6, items);
    },
    messUnderCustomer: () => {
      const c = w().customers.find((o) => o.state === 'shop');
      if (!c) return;
      const id = w().nextId++;
      w().messes.push({ id, x: c.x, z: c.z, items: ['egg'] });
      view.addSplat(id, c.x, c.z, ['egg']);
    },
    fillStack: () => {
      const st = w().player.stack;
      while (st.length < 8) st.push(['tomato', 'egg', 'milk'][st.length % 3]);
    },
    emptyStack: () => (w().player.stack.length = 0),
    unlockAll: async () => {
      const m = await import('../sim/economy');
      for (const id of Object.keys(w().map.pads)) m.own(w(), id, true);
    },
  };

  // ---------- panel
  const style = document.createElement('style');
  style.textContent = `
    #proto-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;display:flex;gap:6px;
      background:#3a2416e6;padding:6px;border-radius:12px;font:600 13px system-ui;color:#fff1d0}
    #proto-bar button{font:inherit;border:0;border-radius:8px;padding:6px 10px;background:#fff1d0;color:#3a2416;cursor:pointer}
    #proto-bar button.on{background:#f26b1d;color:#fff}
    #proto-label{position:fixed;left:12px;top:12px;z-index:20;background:#3a2416e6;color:#fff1d0;padding:6px 10px;
      border-radius:8px;font:600 12px system-ui;white-space:pre;pointer-events:none}
    #proto-dump{position:fixed;inset:10% 20%;z-index:30;background:#fff1d0;color:#3a2416;padding:16px;border-radius:12px;
      font:12px ui-monospace,monospace;white-space:pre;overflow:auto;display:none}`;
  document.head.append(style);
  const bar = document.createElement('div');
  bar.id = 'proto-bar';
  const label = document.createElement('div');
  label.id = 'proto-label';
  const dump = document.createElement('div');
  dump.id = 'proto-dump';
  dump.onclick = () => (dump.style.display = 'none');
  document.body.append(bar, label, dump);
  for (const el of [bar, dump]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  const gui = new GUI({ title: 'PROTOTYPE · Cleaning look (live)' });
  gui.domElement.style.zIndex = '20';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (innerWidth < 700) gui.close();
  const rebuildAll = () => {
    buildStand();
    showFree();
    rebuildStinks();
    buildBins();
  };
  const select = (v: string) => {
    variant = v;
    Object.assign(P, PRESETS[v].params);
    url.searchParams.set('clean', v);
    history.replaceState(null, '', url);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    for (const b of bar.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v);
    if (holding) setHolding(false);
    freeMops = P.mops;
    rebuildAll();
  };
  for (const v of VARIANTS) {
    const b = document.createElement('button');
    b.textContent = v;
    b.dataset.v = v;
    b.title = PRESETS[v].name;
    b.onclick = () => select(v);
    bar.append(b);
  }
  const messBtn = document.createElement('button');
  messBtn.textContent = '+ Mess';
  messBtn.onclick = tools.messHere;
  const dumpBtn = document.createElement('button');
  dumpBtn.textContent = 'Dump';
  dumpBtn.onclick = () => {
    dump.textContent = `// clean=${variant} — ${PRESETS[variant].name}\n${JSON.stringify(P, null, 2)}`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(messBtn, dumpBtn);
  const fLook = gui.addFolder('Look');
  fLook.add(P, 'stand', ['bucket', 'rack', 'cart']).name('Mop Stand').onChange(rebuildAll);
  fLook.add(P, 'bin', ['metal', 'wheelie', 'pedal']).name('Trash Bin').onChange(rebuildAll);
  fLook.add(P, 'stink', ['lines', 'clouds', 'flies']).name('stink').onChange(rebuildAll);
  fLook
    .add(P, 'cleanCap', CAP_CHOICES)
    .name('Clean cap')
    .onChange(() => cleaner.setHat(P.cleanCap));
  const fMop = gui.addFolder('Mopping');
  fMop
    .add(P, 'mops', 1, 3, 1)
    .name('mops on the stand (Upgrade)')
    .onChange(() => {
      freeMops = P.mops - (holding ? 1 : 0);
      showFree();
    });
  fMop.add(P, 'cleanTime', 0.5, 4, 0.1).name('clean time s (Mop speed)');
  fMop.add(P, 'suds', 0, 30, 1).name('suds per second');
  fMop.add(P, 'shrinkTo', 0, 1, 0.05).name('Mess shrinks to');
  const fMood = gui.addFolder('Grumpy bubble, bin');
  fMood.add(P, 'bubbleSize', 0.3, 1.2, 0.05).name('bubble size (m)');
  fMood.add(P, 'angerTime', 1, 10, 0.5).name('s to full anger');
  fMood.add(P, 'lidOpen', 0.3, 1.8, 0.05).name('lid opens (rad)');
  const fTools = gui.addFolder('Tools');
  fTools.add(tools, 'messHere').name('Mess next to me');
  fTools.add(tools, 'messUnderCustomer').name('Mess under a Customer');
  fTools.add(tools, 'fillStack').name('fill Stack (for the bin)');
  fTools.add(tools, 'emptyStack').name('empty Stack (to take the mop)');
  fTools.add(tools, 'unlockAll').name('unlock all');

  // ---------- every frame
  let last = performance.now();
  let t = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    const W = w();
    const p = W.player;
    if (!stand && standPlace()) rebuildAll();

    // Clean Stocker waiting by the stand
    const sb = standPlace();
    if (sb) cleaner.update(dt, sb[0] - 0.6, sb[1] + sb[3] + 0.6, 0, 0, false);

    // take / return the mop at the stand
    const nearStand = !!sb && distToBox(p.x, p.z, sb) <= TUNING.reach + 0.3;
    if (nearStand && !nearStandBefore) {
      if (!holding && p.stack.length === 0 && freeMops > 0) setHolding(true);
      else if (holding) setHolding(false);
    }
    nearStandBefore = nearStand;

    // mopping
    const mess = holding ? W.messes.find((m) => Math.hypot(m.x - p.x, m.z - p.z) < 0.75) : undefined;
    cleanRing.visible = !!mess;
    if (mess) {
      const k = Math.min(1, (progress.get(mess.id) ?? 0) + dt / P.cleanTime);
      progress.set(mess.id, k);
      swish += dt * 14;
      handMop.rotation.set(0.35, Math.sin(swish) * 0.9, Math.sin(swish) * 0.25);
      handMop.position.set(0.35 + Math.sin(swish) * 0.15, 0, 0.45);
      const splat = view.splats.get(mess.id);
      if (splat) splat.scale.setScalar(1 - (1 - P.shrinkTo) * k);
      cleanRing.position.set(mess.x, 0.06, mess.z);
      cleanRing.geometry.dispose();
      cleanRing.geometry = new THREE.RingGeometry(0.7, 0.85, 40, 1, Math.PI / 2, -k * Math.PI * 2);
      if (Math.random() < P.suds * dt) {
        const m = new THREE.Mesh(sudGeo, sudMat);
        m.position.set(mess.x + (Math.random() - 0.5) * 0.8, 0.08, mess.z + (Math.random() - 0.5) * 0.8);
        scene.add(m);
        suds.push({
          m,
          v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3),
          life: 0.8,
        });
      }
      if (k >= 1) {
        W.messes = W.messes.filter((m) => m.id !== mess.id);
        progress.delete(mess.id);
        if (splat) {
          view.juice.puff(splat.position.clone().setY(0.3), SHADES.white, 14, 1.4);
          view.juice.puff(splat.position.clone().setY(0.6), PALETTE.pad, 8, 1.8);
          splat.removeFromParent();
          view.splats.delete(mess.id);
        }
      }
    } else if (holding) {
      handMop.rotation.set(0.25, 0, -0.15);
      handMop.position.set(0.35, 0, 0.25);
    }
    for (const s of [...suds]) {
      s.life -= dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.scale.setScalar(Math.max(0.01, s.life * 1.4));
      if (s.life <= 0) {
        scene.remove(s.m);
        suds.splice(suds.indexOf(s), 1);
      }
    }

    // stink over every waiting Mess
    for (const m of W.messes) {
      let s = stinks.get(m.id);
      if (!s) {
        s = stinkModel(P.stink);
        s.position.set(m.x, 0, m.z);
        scene.add(s);
        stinks.set(m.id, s);
      }
      animateStink(s, t);
    }
    for (const [id, s] of stinks)
      if (!W.messes.some((m) => m.id === id)) {
        scene.remove(s);
        stinks.delete(id);
      }

    // grumpy bubble over Customers standing in a Mess
    for (const c of W.customers) {
      const inMess = W.messes.some((m) => Math.hypot(m.x - c.x, m.z - c.z) < TUNING.messRadius);
      let b = bubbles.get(c.id);
      if (inMess && !b) {
        const tex = new CanvasTex(320, 280);
        b = { s: canvasSprite(tex, P.bubbleSize), tex, inFor: 0, outFor: 0 };
        scene.add(b.s);
        bubbles.set(c.id, b);
      }
      if (!b) continue;
      if (inMess) {
        b.inFor += dt;
        b.outFor = 0;
      } else b.outFor += dt;
      const k = Math.min(1, b.inFor / P.angerTime);
      drawBubble(b.tex, k);
      const pop = Math.min(1, b.inFor * 6);
      const fade = Math.max(0, 1 - b.outFor / 0.6);
      const shake = Math.sin(t * 40) * 0.03 * k;
      // beside the receipt card, to its right on screen
      const side = 0.55 + P.bubbleSize * 0.6;
      b.s.position.set(c.x + SCREEN_RIGHT.x * side + shake, 2.0 + Math.sin(t * 6) * 0.03, c.z + SCREEN_RIGHT.y * side);
      b.s.scale.set(P.bubbleSize * (1 + 0.25 * k) * pop * 1.14, P.bubbleSize * (1 + 0.25 * k) * pop, 1);
      (b.s.material as THREE.SpriteMaterial).opacity = fade;
      if (fade === 0) {
        scene.remove(b.s);
        bubbles.delete(c.id);
      }
    }
    for (const [id, b] of bubbles)
      if (!W.customers.some((c) => c.id === id)) {
        scene.remove(b.s);
        bubbles.delete(id);
      }

    // Trash Bins: lid opens and wobbles while you stand on one, ring fills, lid slams when you leave
    for (const st of trashStations()) {
      let b = bins.get(st.id);
      if (!b) {
        b = { ...binModel(P.bin), open: 0, slam: 0, had: 0 };
        b.g.position.set(st.box[0] + st.box[2] / 2, 0, st.box[1] + st.box[3] / 2);
        scene.add(b.g);
        bins.set(st.id, b);
      }
      view.batch.setScale(st.id, 0.001, 0.001); // hide the stock can
      const here = distToBox(p.x, p.z, st.box) <= TUNING.reach;
      const target = here ? 1 : 0;
      if (b.open > 0.5 && !here) b.slam = 1;
      b.open += (target - b.open) * Math.min(1, dt * (here ? 8 : 18));
      if (b.slam > 0) {
        b.slam = Math.max(0, b.slam - dt * 4);
        if (b.slam === 0 || b.slam < 0.75) {
          if (b.had > 0) view.juice.puff(b.g.position.clone().setY(1), PALETTE.cream, 8, 1);
          b.had = 0;
          b.slam = 0;
          b.g.scale.set(1.12, 0.88, 1.12);
        }
      }
      b.g.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 10));
      const wobble = here ? Math.sin(t * 18) * 0.12 : 0;
      b.lid.rotation.x = -(b.open * P.lidOpen + wobble * b.open);
      const hold = here ? Math.min(1, p.trashHold / TUNING.trashHoldTime) : 0;
      if (here && p.trashHold >= TUNING.trashHoldTime) b.had++;
      b.ring.visible = here && p.stack.length > 0;
      b.ring.geometry.dispose();
      b.ring.geometry = new THREE.RingGeometry(0.55, 0.68, 40, 1, Math.PI / 2, -Math.max(0.001, hold) * Math.PI * 2);
    }

    label.textContent =
      `PROTOTYPE · clean=${variant}\n${PRESETS[variant].name}\n` +
      `${holding ? 'holding the mop: put it back at the Mop Stand' : p.stack.length ? 'Stack not empty: no mop' : 'walk to the Mop Stand (Office) to take a mop'} · mops free ${freeMops}/${P.mops} · Messes ${W.messes.length}`;
    requestAnimationFrame(tick);
  };
  Object.assign(window, { protoClean: { bubbles, stinks, bins } });
  select(variant);
  requestAnimationFrame(tick);
}
