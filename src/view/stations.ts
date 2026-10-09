// Station visuals: one builder per model name. Each knows where its Items sit and how it moves while working.
import * as THREE from 'three';
import type { Box, Rot } from '../sim/map';
import { centred, clipsOf, model } from './assets';
import { ITEM_SIZE } from '../../catalog/assets';
import { PRODUCERS } from '../../catalog/producers';
import { FEEL } from '../feel';
import { footprint } from '../sim/geometry';
import { paletteMaterial } from './materials';
import { PALETTE, SHADES } from '../palette';
import { dynamic, mergeStatic } from './merge';
import { cyl, grid, slab } from './shapes';
import { buildCheckout, buildStand } from './stands';
import type { ProductId } from '../../catalog/products';

/** Shelf stands are named `<product>-stand` in the asset table. */
const STAND = '-stand';

export interface StationVisual {
  /** At the box centre, rotated; children are in local metres with the front at +z. */
  root: THREE.Group;
  /** Scaled for spring-up and per-Item bounces. */
  body: THREE.Group;
  /** Local positions for displayed Items (Shelf stock or Tray). */
  slots: THREE.Vector3[];
  /** Shelf Items lean forward by this much (rad), on slanted bins. */
  slotTilt?: number;
  /** Checkout belt start, till end and bagging tray, local. */
  belt?: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  /** Local positions for Recipe inputs waiting to be used. */
  inputSlots: THREE.Vector3[];
  /** Local positions of Crop plants. */
  plants: THREE.Vector3[];
  /** Crop plants are drawn instanced by the view with this model. */
  plantModel: string | null;
  mixers: THREE.AnimationMixer[];
  /** Per-frame motion; `working` while a Machine/Animal is busy. */
  animate: (dt: number, working: boolean) => void;
}

/** Output pallet: strip depth in the box, board size and height, Item gap (m). */
const OUTPUT = { strip: 1.1, pallet: [1.46, 0.99], palletHeight: 0.1, gap: 0.42 } as const;

function playIdle(obj: THREE.Object3D, name: string, mixers: THREE.AnimationMixer[], clip = 'idle'): void {
  const c = clipsOf(name).find((a) => a.name === clip);
  if (!c) return;
  const mixer = new THREE.AnimationMixer(obj);
  const action = mixer.clipAction(c);
  action.time = Math.random() * c.duration;
  action.play();
  mixers.push(mixer);
}

/** Output on a dark pallet; Items piled 3 + 2 + 1. */
function pallet(body: THREE.Group, z: number): THREE.Vector3[] {
  const [pw, pd] = OUTPUT.pallet;
  slab(body, pw, OUTPUT.palletHeight, pd, 'woodDark', 0, 0, z);
  const y = OUTPUT.palletHeight;
  return [
    ...grid(3, 1, OUTPUT.gap * 2, 0, y, 0, z),
    ...grid(2, 1, OUTPUT.gap, 0, y + ITEM_SIZE * 0.5, 0, z),
    new THREE.Vector3(0, y + ITEM_SIZE, z),
  ];
}

/** A closed fence along all four sides, each segment centred on its side. */
function fence(body: THREE.Group, w: number, d: number): void {
  const side = (cx: number, cz: number, len: number, alongX: boolean) => {
    const n = Math.max(1, Math.round(len));
    for (let i = 0; i < n; i++) {
      const f = model('fence-post', { height: 0.55 });
      f.scale.x *= len / n / new THREE.Box3().setFromObject(f).getSize(new THREE.Vector3()).x;
      const g = centred(f);
      const k = (i + 0.5) / n - 0.5;
      if (alongX) g.position.set(cx + k * len, 0, cz);
      else {
        g.position.set(cx, 0, cz + k * len);
        g.rotation.y = Math.PI / 2;
      }
      body.add(g);
    }
  };
  side(0, -d / 2, w, true);
  side(0, d / 2, w, true);
  side(-w / 2, 0, d, false);
  side(w / 2, 0, d, false);
}

/** One soil strip in a low wooden planter; the plants sit in a single line along it. */
function tomatoBed(w: number, d: number, plants: number, v: StationVisual): void {
  const len = w * 0.9;
  const depth = Math.min(d * 0.45, 0.9);
  const soilY = 0.18;
  slab(v.body, len, soilY, depth, 'dirt');
  const t = 0.08;
  const h = soilY + 0.08;
  slab(v.body, len + 2 * t, h, t, 'wood', 0, 0, -(depth + t) / 2);
  slab(v.body, len + 2 * t, h, t, 'wood', 0, 0, (depth + t) / 2);
  slab(v.body, t, h, depth, 'wood', -(len + t) / 2, 0, 0);
  slab(v.body, t, h, depth, 'wood', (len + t) / 2, 0, 0);
  v.plants = grid(plants, 1, len - 0.5, 0, soilY);
  v.plantModel = 'tomato-bush';
}

/** Tilled patch with two furrow ridges inside a low fence; plants split over the furrows. */
function wheatField(w: number, d: number, plants: number, v: StationVisual): void {
  const s = Math.min(w, d);
  slab(v.body, s, 0.06, s, 'dirt');
  for (const k of [-0.5, 0.5]) slab(v.body, s * 0.8, 0.12, 0.45, 'dirtDark', 0, 0.06, k * s * 0.4);
  fence(v.body, s, s);
  v.plants = grid(Math.ceil(plants / 2), 2, s * 0.6, s * 0.4, 0.18).slice(0, plants);
  v.plantModel = 'wheat-plant';
}

/** Four wall panels around a square, roof fitted on top. */
function hut(size: number, wallH: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const wall = model('wall-wood', { height: wallH });
    const ws = new THREE.Box3().setFromObject(wall).getSize(new THREE.Vector3());
    wall.scale.x *= size / ws.x;
    wall.scale.z *= 0.06 / Math.max(ws.z, 1e-3);
    const c = centred(wall);
    const a = (i * Math.PI) / 2;
    c.position.set(Math.sin(a) * (size / 2), 0, Math.cos(a) * (size / 2));
    c.rotation.y = a;
    g.add(c);
  }
  const roof = centred(model('roof', { fit: [size + 0.15, size + 0.15] }));
  roof.position.y = wallH;
  g.add(roof);
  return g;
}

function coop(w: number, d: number, v: StationVisual): void {
  slab(v.body, w, 0.04, d, 'path');
  fence(v.body, w, d);
  const h = hut(0.8, 0.6);
  h.position.set(-w / 2 + 0.55, 0, -d / 2 + 0.55);
  v.body.add(h);
  const chicks = 4;
  for (let i = 0; i < chicks; i++) {
    const a = model('chick', { height: 0.5 });
    a.position.set((i - (chicks - 1) / 2) * (w / (chicks + 1)) + 0.1, 0.04, 0.1 + (i % 2) * 0.25);
    a.rotation.y = (Math.random() - 0.5) * 1.5;
    v.body.add(a);
    playIdle(dynamic(a), 'chick', v.mixers);
  }
  slab(v.body, 0.7, 0.18, 0.32, 'woodDark', w / 2 - 0.55, 0, -d / 2 + 0.35);
  v.inputSlots = grid(3, 2, 0.45, 0.12, 0.2, w / 2 - 0.55, -d / 2 + 0.35);
}

/** Open pasture: grass, closed fence, hay bales back-left, a trough back-right. */
function cowPen(w: number, d: number, v: StationVisual): void {
  const s = Math.min(w, d);
  slab(v.body, s, 0.04, s, 'grass');
  fence(v.body, s, s);
  for (const [x, z] of [
    [-s / 2 + 0.5, -s / 2 + 0.5],
    [-s / 2 + 1.1, -s / 2 + 0.45],
  ])
    cyl(v.body, 0.3, 0.5, 'path', x, 0.3, z).rotation.z = Math.PI / 2;
  const cow = model('cow');
  cow.position.set(0.2, 0.04, 0.15);
  cow.rotation.y = -0.5;
  v.body.add(cow);
  playIdle(dynamic(cow), 'cow', v.mixers);
  slab(v.body, 0.9, 0.22, 0.38, 'woodDark', s / 2 - 0.65, 0, -s / 2 + 0.45);
  v.inputSlots = grid(3, 2, 0.55, 0.12, 0.22, s / 2 - 0.65, -s / 2 + 0.45);
}

/** Four sails on a hub, turning about its forward (+z) axis. */
function sails(len: number): THREE.Group {
  const hub = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    slab(arm, 0.07, len, 0.05, 'woodDark');
    slab(arm, 0.32, len * 0.78, 0.03, 'cream', 0.2, len * 0.2, 0.02);
    arm.rotation.z = (i * Math.PI) / 2;
    hub.add(arm);
  }
  cyl(hub, 0.1, 0.12, 'woodDark', 0, -0.06).rotation.x = Math.PI / 2;
  mergeStatic(hub);
  return hub;
}

/** Wooden barn with a dark gable roof and door; sails on the gable front. */
function mill(w: number, d: number, v: StationVisual): void {
  const s = Math.min(w, d);
  const bw = s * 0.7;
  const h = 1.4;
  slab(v.body, bw, h, s * 0.6, 'wood', 0, 0, -s * 0.1);
  for (const k of [-1, 1])
    slab(v.body, bw * 0.62, 0.08, s * 0.66, 'woodDark', (k * bw) / 4.4, h + 0.18, -s * 0.1).rotation.z = -k * 0.6;
  slab(v.body, 0.42, 0.75, 0.05, 'woodDark', 0, 0, s * 0.2);
  const hub = sails(1);
  hub.position.set(0, h + 0.1, s * 0.22);
  v.body.add(dynamic(hub));
  v.inputSlots = grid(3, 2, 0.45, 0.2, 0.02, -s / 2 + 0.35, s * 0.3);
  let a = 0;
  v.animate = (dt, working) => {
    a += dt * (working ? FEEL.millSpin : FEEL.millIdleSpin);
    hub.rotation.z = a;
  };
}

/** Black iron stove on legs: grey top, door frame, a glass door that glows, stovepipe at the back. */
function oven(w: number, d: number, v: StationVisual): void {
  const s = Math.min(w, d);
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    slab(v.body, 0.08, 0.25, 0.08, 'ink', (x * s) / 3.6, 0, (z * s) / 4.6 - s * 0.08);
  slab(v.body, s * 0.62, 0.85, s * 0.5, 'ink', 0, 0.25, -s * 0.08);
  slab(v.body, s * 0.66, 0.06, s * 0.54, 'road', 0, 1.1, -s * 0.08);
  slab(v.body, 0.55, 0.42, 0.04, 'road', 0, 0.42, s * 0.17);
  cyl(v.body, 0.08, 1, 'ink', s * 0.18, 1.16, -s * 0.22);
  const glowMat = new THREE.MeshStandardMaterial({ color: PALETTE.ink, emissive: SHADES.glow, emissiveIntensity: 0 });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.04), glowMat);
  glow.position.set(0, 0.63, s * 0.19);
  v.body.add(dynamic(glow));
  v.inputSlots = grid(2, 2, 0.32, 0.25, 0.02, -s / 2 + 0.3, s * 0.32).concat(
    grid(2, 2, 0.32, 0.25, 0.02, s / 2 - 0.3, s * 0.32),
  );
  let t = 0;
  v.animate = (dt, working) => {
    t += dt;
    const target = working ? FEEL.ovenGlow + Math.sin(t * 8) * FEEL.ovenPulse : FEEL.ovenGlowIdle;
    glowMat.emissiveIntensity += (target - glowMat.emissiveIntensity) * Math.min(1, dt * 6);
  };
}

/** Blender standing on its counter, centred on the top, tomato inputs beside it. */
function blender(w: number, d: number, v: StationVisual): void {
  const top = counter(w, d, v);
  const b = centred(model('kitchen-blender', { height: 1.3 }));
  mergeStatic(b);
  const bx = 0.06 * w;
  b.position.set(bx, top, 0);
  v.body.add(dynamic(b));
  v.inputSlots = grid(2, 2, 0.22, 0.25, top, -0.33 * w, 0);
  let t = 0;
  v.animate = (dt, working) => {
    t += dt;
    b.rotation.z = working ? Math.sin(t * 33) * 0.08 : 0;
    b.position.x = bx + (working ? Math.sin(t * 43) * 0.02 : 0);
  };
}

function counter(w: number, d: number, v: StationVisual): number {
  const bar = centred(model('kitchen-bar', { fit: [w * 0.75, d * 0.9] }));
  bar.position.x = -w * 0.12;
  v.body.add(bar);
  return new THREE.Box3().setFromObject(bar).max.y;
}

function build(name: string, w: number, d: number, v: StationVisual): void {
  if (name.endsWith(STAND)) return buildStand(name.slice(0, -STAND.length) as ProductId, w, d, v);
  switch (name) {
    case 'tomato-bed':
      return tomatoBed(w, d, PRODUCERS.tomato_bed.plants, v);
    case 'wheat-field':
      return wheatField(w, d, PRODUCERS.wheat_field.plants, v);
    case 'chicken-coop':
      return coop(w, d, v);
    case 'cow-pen':
      return cowPen(w, d, v);
    case 'blender':
      return blender(w, d, v);
    case 'mill':
      return mill(w, d, v);
    case 'oven':
      return oven(w, d, v);
    case 'register':
      return buildCheckout(w, d, v);
    case 'office': {
      const desk = centred(model('desk', { fit: [w, d] }));
      const top = new THREE.Box3().setFromObject(desk).max.y;
      const screen = centred(model('computer-screen'));
      screen.position.set(0, top, -0.15);
      const chair = centred(model('chair-desk'));
      chair.position.set(0, 0, -d / 2 - 0.35);
      v.body.add(desk, screen, chair);
      return;
    }
    case 'trash':
      v.body.add(model('trash'));
      return;
    case 'exit': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), paletteMaterial('wood'));
      pole.position.y = 0.8;
      const sign = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 3), paletteMaterial('orange'));
      sign.rotation.set(0, 0, -Math.PI / 2);
      sign.position.set(0.15, 1.45, 0);
      pole.castShadow = sign.castShadow = true;
      v.body.add(pole, sign);
      return;
    }
  }
}

const PALLETED = new Set(['chicken-coop', 'cow-pen', 'blender', 'mill', 'oven']);

export function buildStation(name: string, box: Box, rot: Rot): StationVisual {
  const [w, d] = footprint(box, rot);
  const root = new THREE.Group();
  root.position.set(box[0] + box[2] / 2, 0, box[1] + box[3] / 2);
  root.rotation.y = THREE.MathUtils.degToRad(rot);
  const body = new THREE.Group();
  root.add(body);
  const v: StationVisual = {
    root,
    body,
    slots: [],
    inputSlots: [],
    plants: [],
    plantModel: null,
    mixers: [],
    animate: () => {},
  };
  // the output pallet fills a strip along the box's front edge; the structure fills the rest
  const strip = PALLETED.has(name) ? OUTPUT.strip : 0;
  build(name, w, d - strip, v);
  if (strip) {
    for (const c of v.body.children) c.position.z -= strip / 2;
    for (const p of [...v.inputSlots, ...v.plants]) p.z -= strip / 2;
    v.slots = pallet(v.body, d / 2 - strip / 2);
  }
  mergeStatic(v.body);
  return v;
}

/** Semi-transparent copy for Pad previews and Area Pan ghosts. */
export function ghostify(obj: THREE.Object3D, opacity = 0.45): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    const g = src.clone();
    g.transparent = true;
    g.opacity = opacity;
    g.depthWrite = false;
    m.material = g;
    m.castShadow = false;
  });
}
