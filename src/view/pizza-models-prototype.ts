// PROTOTYPE — throwaway (branch prototype/pizza-models). The Pizza Place's new Producers in three looks, in the game's
// own camera and light; ?variant=A|B|C, a lil-gui panel and a value dump.
import * as THREE from 'three';
import GUI from 'lil-gui';
import { Stage } from './stage';
import { buildStation } from './stations';
import { loadAssets } from './assets';
import { ITEM_SIZE } from '../../catalog/assets';
import { applyCssPalette } from '../palette';

type Variant = 'A' | 'B' | 'C';
const NAMES: Record<Variant, string> = {
  A: 'A · Trattoria (terracotta, wood & copper)',
  B: 'B · Neon diner (red & white, chrome, belt oven)',
  C: 'C · Napoli tiles (cobalt majolica & gold)',
};

// prototype-only colours (would move to palette.ts)
const C = {
  ink: '#3a2416', tomato: '#e0453a', sauce: '#c8281e', sauceDark: '#9e1d15', crust: '#e2a55a', crustRaw: '#f3dcae',
  cheese: '#ffd75e', cheeseRind: '#e0a92e', pepperoni: '#a8261c', pepper: '#3fae3a', olive: '#3a3a28', oliveGreen: '#6f9a2a', olivePale: '#c4d47a',
  mushroom: '#efe3cf', basil: '#2f8a2a', dough: '#f6e6c4', flour: '#ffffff', sack: '#efe2c8', milk: '#ffffff',
  blueCap: '#6fa8dc', glass: '#d8f0f4', fire: '#ff8a2a', fireCore: '#ffd23a', smoke: '#d9d4cc', steam: '#f0f0f0',
  leaf: '#8aa66a', leafDark: '#6d8a52', trunk: '#7a6248', dirt: '#8a5a3a', steel: '#c9d2da', steelDark: '#9aa5ae',
  white: '#fbf7f0', iron: '#3a3a40',
};
const FLAG = { black: '#1a1a1a', white: '#fbf7f0', green: '#149954', red: '#e4312b' };

interface Look {
  base: string; top: string; accent: string; veggie: string; trim: string;
  brick: string; wood: string; woodDark: string; metal: THREE.Material; planter: string; planterRim: string; floor: string;
}
const LOOKS: Record<Variant, Look> = {
  A: {
    base: '#c9774a', top: '#8a5530', accent: '#c8281e', veggie: '#3f9a3a', trim: '#f3e2c4',
    brick: '#b4603e', wood: '#c17a43', woodDark: '#8a5530', metal: shinyM('#c46a3a'), planter: '#c9774a',
    planterRim: '#a85d36', floor: '#efe0c8',
  },
  B: {
    base: '#fbf7f0', top: '#d6302a', accent: '#d6302a', veggie: '#2fae5a', trim: '#2a2a30',
    brick: '#d6302a', wood: '#2a2a30', woodDark: '#2a2a30', metal: shinyM('#c9d2da'), planter: '#d6302a',
    planterRim: '#c9d2da', floor: '#f4ecec',
  },
  C: {
    base: '#f7f4ec', top: '#1f4fa8', accent: '#d9a72a', veggie: '#3f9a3a', trim: '#1f4fa8',
    brick: '#f7f4ec', wood: '#b07a48', woodDark: '#7a5230', metal: shinyM('#d9a72a'), planter: '#f7f4ec',
    planterRim: '#1f4fa8', floor: '#eef1f6',
  },
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(c: string, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = c + JSON.stringify(extra);
  let m = mats.get(key);
  if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...extra })));
  return m;
}
function shinyM(c: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.25 });
}
const gloss = (c: string) => mat(c, { roughness: 0.3 });
const clear = (c: string, o = 0.45) => mat(c, { transparent: true, opacity: o, roughness: 0.1 });
const glow = (c: string) => mat(c, { emissive: c, emissiveIntensity: 1.2, roughness: 0.6 });
type Paint = string | THREE.Material;
const mOf = (c: Paint) => (typeof c === 'string' ? mat(c) : c);
function put<T extends THREE.Mesh>(parent: THREE.Object3D, m: T, x = 0, y = 0, z = 0): T {
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (p: THREE.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0) =>
  put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mOf(c)), x, y + h / 2, z);
const cyl = (p: THREE.Object3D, r: number, h: number, c: Paint, x = 0, y = 0, z = 0, rb = r, seg = 16) =>
  put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, rb, h, seg), mOf(c)), x, y + h / 2, z);
const sph = (p: THREE.Object3D, r: number, c: Paint, x = 0, y = 0, z = 0, detail = 1) =>
  put(p, new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mOf(c)), x, y, z);
const cone = (p: THREE.Object3D, r: number, h: number, c: Paint, x = 0, y = 0, z = 0, seg = 12) =>
  put(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mOf(c)), x, y + h / 2, z);
const torus = (p: THREE.Object3D, r: number, t: number, c: Paint, x = 0, y = 0, z = 0) => {
  const m = put(p, new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 24), mOf(c)), x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
};
const dome = (p: THREE.Object3D, r: number, c: Paint, x = 0, y = 0, z = 0) =>
  put(p, new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mOf(c)), x, y, z);
const group = (p: THREE.Object3D, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  return g;
};

const el = (id: string) => document.getElementById(id) as HTMLElement;
const Q = new URLSearchParams(location.search);
/** Tunable numbers; the panel edits these live and "Show values" dumps them. */
const P = {
  variant: (Q.get('variant') ?? 'C') as Variant,
  focus: Q.get('focus') ?? 'overview',
  working: 'cycle' as 'cycle' | 'on' | 'off',
  showFootprints: true,
  showItems: true,
  zoom: 7,
  ovenSign: true,
  toppingSize: 1,
  oliveSize: 1.4,
  groundScale: 1.3,
  dropSpeed: 1,
  treeHeight: 1,
  flagSize: 1.3,
  scarfSize: 1,
  wave: 1,
  spin: 1,
  fire: 1,
  steam: 1,
  footprints: {
    sauce_pot: [2.2, 3.3],
    dough_mixer: [2.2, 3.3],
    olive_tree: [2.5, 2.5],
    pizza_oven: [2.8, 3.5],
    veggie_pizza_oven: [2.8, 3.5],
  } as Record<string, [number, number]>,
};

type ItemKind = 'sauce' | 'dough' | 'olives' | 'pizza' | 'veggie' | 'tomato' | 'flour' | 'milk' | 'cheese';

interface Built {
  group: THREE.Group;
  animate: (dt: number, t: number, working: boolean) => void;
  output: ItemKind;
  /** Where input Items sit (the game's input tray: one column of 3 painted spots per Recipe input). */
  inputs: { at: THREE.Vector3; kind: ItemKind }[];
}

const PRODUCERS: { id: string; name: string; recipe: string }[] = [
  { id: 'sauce_pot', name: 'Sauce pot', recipe: 'tomato → pizza sauce (3.5 s)' },
  { id: 'dough_mixer', name: 'Dough mixer', recipe: 'flour + milk → dough (5 s)' },
  { id: 'olive_tree', name: 'Olive tree', recipe: '→ olives (6 s, 4 plants)' },
  { id: 'pizza_oven', name: 'Pizza oven', recipe: 'dough + sauce + cheese → pizza (7 s)' },
  { id: 'veggie_pizza_oven', name: 'Veggie pizza oven', recipe: 'dough + sauce + olives → veggie pizza (7 s)' },
];

// ---------- Items

const IS = ITEM_SIZE / 0.544;
/** A pizza disc; `raw` is pale dough before the oven, `veggie` swaps pepperoni for pepper rings, olives and mushroom. */
function pizza(p: THREE.Object3D, veggie: boolean, raw = false): THREE.Group {
  const g = group(p);
  const k = P.toppingSize;
  cyl(g, 0.24, 0.05, raw ? C.crustRaw : C.crust, 0, 0, 0, 0.24, 24);
  torus(g, 0.22, 0.03, raw ? C.crustRaw : C.crust, 0, 0.05);
  cyl(g, 0.2, 0.012, gloss(C.sauce), 0, 0.05, 0, 0.2, 24);
  if (!raw) cyl(g, 0.18, 0.012, C.cheese, 0, 0.06, 0, 0.18, 18);
  const spots: [number, number][] = [[0.1, 0.02], [-0.07, 0.09], [-0.05, -0.1], [0.04, -0.12], [-0.12, -0.01], [0.09, 0.11]];
  spots.forEach(([x, z], i) => {
    if (!veggie) cyl(g, 0.04 * k, 0.015, C.pepperoni, x, 0.07, z, 0.04 * k, 12);
    else if (i % 3 === 0) torus(g, 0.05 * k, 0.014 * k, gloss(C.pepper), x, 0.08, z);
    else if (i % 3 === 1) torus(g, 0.025 * k, 0.012 * k, C.olive, x, 0.08, z);
    else box(g, 0.06 * k, 0.015, 0.04 * k, C.mushroom, x, 0.07, z);
  });
  if (veggie) sph(g, 0.03 * k, C.basil, 0, 0.08, 0, 0).scale.set(1.4, 0.4, 1);
  return g;
}

function item(kind: ItemKind): THREE.Group {
  const g = new THREE.Group();
  g.scale.setScalar(IS);
  switch (kind) {
    case 'sauce':
      // a jar: red body, white lid, a mini tomato on the lid
      cyl(g, 0.12, 0.22, gloss(C.sauce), 0, 0, 0, 0.12, 16);
      cyl(g, 0.125, 0.06, C.white, 0, 0.22);
      sph(g, 0.05, gloss(C.tomato), 0, 0.32, 0, 1);
      box(g, 0.2, 0.08, 0.01, C.white, 0, 0.07, 0.12);
      break;
    case 'dough':
      sph(g, 0.16, C.dough, 0, 0.11, 0, 2).scale.set(1, 0.7, 1);
      sph(g, 0.06, C.flour, 0.05, 0.2, 0.04, 0).scale.set(1, 0.2, 1);
      break;
    case 'olives':
      // a little glass jar of olives with a green lid
      cyl(g, 0.11, 0.22, clear(C.glass, 0.5), 0, 0, 0, 0.11, 14);
      for (let i = 0; i < 6; i++) sph(g, 0.045, C.oliveGreen, Math.cos(i * 2.1) * 0.05, 0.05 + (i % 3) * 0.06, Math.sin(i * 2.1) * 0.05, 1);
      cyl(g, 0.115, 0.05, C.leafDark, 0, 0.22);
      break;
    case 'pizza':
      pizza(g, false);
      break;
    case 'veggie':
      pizza(g, true);
      break;
    case 'tomato':
      sph(g, 0.13, gloss(C.tomato), 0, 0.13, 0, 2);
      break;
    case 'flour':
      box(g, 0.24, 0.3, 0.16, C.sack);
      box(g, 0.25, 0.08, 0.17, C.blueCap, 0, 0.12);
      break;
    case 'milk':
      cyl(g, 0.09, 0.24, C.milk, 0, 0, 0, 0.1);
      cyl(g, 0.05, 0.06, C.milk, 0, 0.24);
      cyl(g, 0.055, 0.03, C.blueCap, 0, 0.3);
      break;
    case 'cheese':
      cyl(g, 0.2, 0.12, C.cheeseRind, 0, 0, 0, 0.2, 20);
      cyl(g, 0.185, 0.005, C.cheese, 0, 0.12, 0, 0.185, 20);
      break;
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

const SPOT: Record<string, string> = {
  tomato: C.tomato, flour: C.flour, milk: C.milk, cheese: C.cheese, dough: C.dough, sauce: C.sauce, olives: C.oliveGreen,
};

// ---------- shared bits

function puffs(p: THREE.Object3D, x: number, y: number, z: number, colour: string, rise = 0.8, n = 4) {
  const ps = Array.from({ length: n }, () => sph(p, 0.09, clear(colour, 0.7), x, y, z, 1));
  return (t: number, on: boolean, amount: number) =>
    ps.forEach((m, i) => {
      const k = (t * 0.6 + i / n) % 1;
      m.visible = on && amount > 0;
      m.position.set(x + Math.sin(t * 2 + i) * 0.08, y + k * rise * amount, z);
      m.scale.setScalar(0.5 + k * 1.6);
    });
}

/** Licking flames: cones that flicker in height. */
function flames(p: THREE.Object3D, spots: [number, number][], y: number, r = 0.1) {
  const f = spots.map(([x, z], i) => {
    const o = cone(p, r, 0.3, glow(i % 2 ? C.fire : C.fireCore), x, y, z, 6);
    return o;
  });
  return (t: number, on: boolean) =>
    f.forEach((m, i) => {
      m.visible = P.fire > 0;
      m.scale.y = (on ? 1 : 0.4) * P.fire * (0.75 + Math.sin(t * 13 + i * 2) * 0.25);
    });
}

/** The game's input tray: a low stand, one column of 3 painted spots per Recipe input. */
function tray(g: THREE.Object3D, L: Look, x0: number, z0: number, kinds: ItemKind[]): Built['inputs'] {
  const cols = kinds.length === 1 ? [kinds[0], kinds[0]] : kinds;
  const wide = cols.length * 0.27 + 0.12;
  const mid = x0 + (cols.length - 1) * 0.135;
  box(g, wide, 0.32, 0.92, L.wood, mid, 0, z0);
  box(g, wide + 0.04, 0.04, 0.96, L.woodDark, mid, 0.32, z0);
  return cols.flatMap((kind, k) =>
    [0, 1, 2].map((r) => {
      const x = x0 + k * 0.27;
      const z = z0 + (r - 1) * 0.27;
      box(g, 0.22, 0.012, 0.22, new THREE.MeshStandardMaterial({ color: SPOT[kind], transparent: true, opacity: 0.55 }), x, 0.36, z);
      return { at: new THREE.Vector3(x, 0.372, z), kind };
    }),
  );
}

/** A floor Machine shifted right to make room for its input tray on the left (wider for 3 inputs). */
function withTray(b: Omit<Built, 'inputs'>, L: Look, w: number, kinds: ItemKind[]): Built {
  const shift = 0.3 + Math.max(0, kinds.length - 2) * 0.27;
  for (const c of b.group.children) c.position.x += shift;
  return { ...b, inputs: tray(b.group, L, -w / 2 + 0.2, 0, kinds) };
}

function counter(g: THREE.Object3D, L: Look, w: number, d: number, h = 0.85): number {
  box(g, w, h, d, L.base);
  box(g, w + 0.06, 0.06, d + 0.06, L.top, 0, h);
  if (L === LOOKS.C) for (let i = 0; i < 4; i++) box(g, w * 0.22, 0.22, 0.01, L.top, -w * 0.33 + i * w * 0.22, h * 0.35, d / 2 + 0.005).rotation.z = Math.PI / 4;
  return h + 0.06;
}

// ---------- Olive tree (Crop)

/** A gnarled twin trunk in a big planter; a wide, flat silver-green canopy; olives hang under it as the plants. */
function oliveTree(w: number, d: number, L: Look): Built {
  const g = new THREE.Group();
  const s = Math.min(w, d);
  const h = 1.1 * P.treeHeight;
  const square = L !== LOOKS.A;
  if (square) {
    box(g, s * 0.62, 0.45, s * 0.62, L.planter);
    box(g, s * 0.66, 0.06, s * 0.66, L.planterRim, 0, 0.45);
    if (L === LOOKS.C) for (const z of [-1, 1]) for (let i = 0; i < 3; i++) box(g, 0.2, 0.2, 0.01, L.top, (i - 1) * 0.42, 0.12, (z * s * 0.62) / 2 + z * 0.006).rotation.z = Math.PI / 4;
  } else {
    cyl(g, s * 0.3, 0.5, L.planter, 0, 0, 0, s * 0.24, 18);
    torus(g, s * 0.31, 0.06, L.planterRim, 0, 0.5);
  }
  cyl(g, s * 0.28, 0.02, C.dirt, 0, 0.48);
  const trunk = group(g, 0, 0.5, 0);
  cyl(trunk, 0.09, h * 0.6, C.trunk, 0, 0, 0, 0.14, 7).rotation.z = 0.25;
  cyl(trunk, 0.08, h * 0.55, C.trunk, 0.1, 0, 0, 0.12, 7).rotation.z = -0.3;
  cyl(trunk, 0.07, h * 0.5, C.trunk, 0, h * 0.4, 0, 0.09, 7).rotation.z = 0.15;
  const top = group(g, 0, 0.5 + h + 0.25, 0);
  for (const [x, y, z, r] of [
    [0, 0, 0, 0.55], [0.45, -0.05, 0.15, 0.4], [-0.45, 0, -0.1, 0.42], [0.1, 0.1, -0.42, 0.38], [-0.15, -0.05, 0.42, 0.38],
  ])
    sph(top, r, (x + z) > 0 ? C.leaf : C.leafDark, x, y, z).scale.set(1, 0.6, 1);
  // each cluster ripens on a branch (pale → olive green), drops into the soil below and waits there to be picked
  const topY = 0.5 + h + 0.25;
  const soil = 0.5;
  const r = 0.06 * P.oliveSize;
  const unripe = new THREE.Color(C.olivePale);
  const ripe = new THREE.Color(C.oliveGreen);
  const clusters = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const hang = new THREE.Vector3(Math.cos(a) * 0.55, topY - 0.36, Math.sin(a) * 0.55);
    const ground = new THREE.Vector3(Math.cos(a) * 0.42, soil, Math.sin(a) * 0.42);
    const m = gloss(C.oliveGreen).clone();
    const o = group(g, hang.x, hang.y, hang.z);
    const stalk = cyl(o, 0.01, 0.14, C.trunk, 0, 0.02);

    for (let k = 0; k < 4; k++) {
      const heap = k === 3 ? [0, r * 1.5, 0] : [Math.cos(k * 2.1) * r * 1.1, r * 0.9, Math.sin(k * 2.1) * r * 1.1];
      sph(o, r, m, heap[0], heap[1] - r * 2.4, heap[2], 1).scale.set(1, 1.3, 1);
    }
    return { o, m, stalk, hang, ground, offset: i * 0.8 };
  });
  const flag = palestineFlag(g, -s * 0.29, 0.51, s * 0.29, 2.9);
  keffiyeh(g, s * 0.2, 0.51, s * 0.2);
  const cycle = 6 / P.dropSpeed;
  return {
    group: g,
    output: 'olives',
    inputs: [],
    animate: (_dt, t) => {
      top.rotation.z = Math.sin(t * 1.1) * 0.03;
      top.rotation.x = Math.sin(t * 0.8 + 1) * 0.02;
      for (const c of clusters) {
        const k = ((t + c.offset * cycle) % (cycle * 1.4)) / cycle;
        c.o.visible = P.showItems && k < 1.3;
        if (k < 0.55) {
          // growing and ripening on the branch
          c.o.position.copy(c.hang);
          c.o.scale.setScalar(Math.max(0.05, k / 0.55));
          c.m.color.copy(unripe).lerp(ripe, Math.min(1, k / 0.5));
          c.stalk.visible = true;
        } else if (k < 0.7) {
          // falls with a little bounce at the end
          const f = (k - 0.55) / 0.15;
          c.o.position.lerpVectors(c.hang, c.ground, f * f);
          c.o.scale.setScalar(1);
          c.stalk.visible = false;
        } else {
          // lying in the soil, ready to pick; drawn bigger there so it reads
          const b = Math.max(0, 1 - (k - 0.7) / 0.08);
          c.o.position.set(c.ground.x, c.ground.y + Math.abs(Math.sin(b * Math.PI)) * 0.08 * b + r * 2.4 * P.groundScale, c.ground.z);
          c.o.scale.setScalar(P.groundScale);
        }
      }
      flag.forEach((seg, i) => (seg.rotation.y = Math.sin(t * 3 - i * 0.9) * 0.25 * P.wave));
    },
  };
}

/** The Palestinian flag on a pole in the planter's front corner, flying over the canopy; returns its waving segments. */
function palestineFlag(g: THREE.Object3D, x: number, y: number, z: number, pole: number): THREE.Group[] {
  cyl(g, 0.025, pole, gloss(C.white), x, y, z);
  sph(g, 0.045, gloss('#d9a72a'), x, y + pole + 0.03, z, 1);
  const len = 0.8 * P.flagSize;
  const hgt = len / 2;
  const n = 4;
  const segW = len / n;
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = group(g, x, y + pole - hgt - 0.02, z);
  for (let i = 0; i < n; i++) {
    // each segment hangs off the last one so the cloth ripples
    const seg = group(parent, i ? segW : 0, 0, 0);
    [FLAG.green, FLAG.white, FLAG.black].forEach((c, k) => box(seg, segW, hgt / 3, 0.012, mat(c, { side: THREE.DoubleSide }), segW / 2, (k * hgt) / 3, 0));
    if (i === 0) {
      // the red triangle at the hoist, a third of the length
      const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, hgt), new THREE.Vector2(len / 3, hgt / 2)]);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false }), mat(FLAG.red));
      put(seg, m, 0, 0, -0.01);
    }
    segs.push(seg);
    parent = seg;
  }
  return segs;
}

/** The keffiyeh's look: white cloth, black fishnet weave, black border bands and a tasselled edge. */
function keffiyehTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const x = cv.getContext('2d') as CanvasRenderingContext2D;
  x.fillStyle = '#fbf7f0';
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#1a1a1a';
  x.lineWidth = 3;
  for (let i = -256; i < 512; i += 22) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 256, 256);
    x.moveTo(i, 256);
    x.lineTo(i + 256, 0);
    x.stroke();
  }
  x.fillStyle = '#1a1a1a';
  for (const y of [0, 236]) x.fillRect(0, y, 256, 20);
  // a row of olive-leaf marks inside each border
  for (const y of [32, 214])
    for (let i = 8; i < 256; i += 20) {
      x.beginPath();
      x.ellipse(i, y, 7, 3.5, 0.6, 0, Math.PI * 2);
      x.fill();
    }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A keffiyeh lying folded on the ground beside the tree: a square with one corner folded over, tassels on two edges. */
function keffiyeh(g: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const k = group(g, x, y, z);
  k.rotation.y = 0.3;
  const cloth = new THREE.MeshStandardMaterial({ map: keffiyehTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const w = 0.46 * P.scarfSize;
  box(k, w, 0.012, w, cloth);
  // the folded-over half lies on top as a triangle
  const tri = new THREE.Shape([new THREE.Vector2(-w / 2, -w / 2), new THREE.Vector2(w / 2, -w / 2), new THREE.Vector2(w / 2, w / 2)]);
  const flapGeo = new THREE.ShapeGeometry(tri);
  const uv = flapGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / w + 0.5);
  const flap = put(k, new THREE.Mesh(flapGeo, cloth), 0, 0.016, 0);
  flap.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const u = -w / 2 + 0.03 + (i * (w - 0.06)) / 7;
    cyl(k, 0.012, 0.012, mat('#1a1a1a'), u, 0, w / 2 + 0.03).rotation.x = Math.PI / 2;
    cyl(k, 0.012, 0.012, mat('#1a1a1a'), w / 2 + 0.03, 0, u).rotation.z = Math.PI / 2;
  }
  return k;
}

// ---------- Sauce pot

function saucePot(w: number, _d: number, L: Look, v: Variant): Built {
  const g = new THREE.Group();
  let top: number;
  let fire: (t: number, on: boolean) => void;
  if (v === 'A') {
    // copper pot on a brick fire ring
    cyl(g, 0.6, 0.35, L.brick, 0, 0, 0, 0.65);
    fire = flames(g, [[0, 0.1], [0.15, -0.1], [-0.15, -0.05]], 0.2);
    cyl(g, 0.5, 0.55, L.metal, 0, 0.35, 0, 0.4);
    torus(g, 0.5, 0.05, L.metal, 0, 0.9);
    top = 0.9;
  } else if (v === 'B') {
    // steel stockpot on a gas burner
    box(g, 1.1, 0.5, 1.0, C.steelDark);
    box(g, 1.14, 0.04, 1.04, L.top, 0, 0.5);
    torus(g, 0.32, 0.03, C.iron, 0, 0.56);
    const ring = Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * Math.PI * 2) * 0.3, Math.sin((i / 8) * Math.PI * 2) * 0.3] as [number, number]);
    const f = flames(g, ring, 0.54, 0.04);
    fire = f;
    cyl(g, 0.45, 0.6, L.metal, 0, 0.6, 0, 0.45, 20);
    torus(g, 0.45, 0.03, C.steelDark, 0, 1.2);
    top = 1.2;
  } else {
    // a white-and-cobalt ceramic pot on a tiled stove
    counter(g, L, 1.2, 1.0, 0.5);
    fire = flames(g, [[0, 0]], 0.56, 0.12);
    cyl(g, 0.48, 0.6, gloss(L.base), 0, 0.62, 0, 0.38, 20);
    torus(g, 0.46, 0.03, gloss(L.top), 0, 0.82);
    torus(g, 0.44, 0.03, gloss(L.top), 0, 1.0);
    torus(g, 0.48, 0.04, gloss(L.accent), 0, 1.22);
    top = 1.22;
  }
  cyl(g, 0.45, 0.03, gloss(C.sauce), 0, top - 0.06);
  const bubbles = [0, 1, 2, 3, 4].map((i) => sph(g, 0.06, gloss(C.sauceDark), Math.cos(i * 2) * 0.25, top, Math.sin(i * 2) * 0.25, 0));
  // the stirrer: ladle (A), motor paddle on an arm (B), wooden spoon (C)
  const stir = group(g, 0, top, 0);
  if (v === 'B') {
    box(g, 0.08, 1.1, 0.08, L.metal, 0.6, 0.5, -0.3);
    box(g, 0.7, 0.1, 0.1, L.metal, 0.3, 1.55, -0.3).rotation.y = 0.6;
    cyl(g, 0.12, 0.2, L.accent, 0, 1.45, 0);
    cyl(stir, 0.025, 0.55, C.steelDark, 0, -0.2);
    box(stir, 0.3, 0.12, 0.02, C.steelDark, 0, -0.2);
  } else {
    const arm = group(stir, 0.18, 0, 0);
    cyl(arm, 0.025, 0.75, v === 'A' ? L.woodDark : L.wood, 0, -0.1, 0).rotation.z = -0.35;
    sph(arm, 0.08, v === 'A' ? L.metal : L.wood, -0.05, -0.08, 0, 1).scale.set(1, 0.5, 1);
  }
  const puff = puffs(g, 0, top + 0.1, 0, C.steam);
  return withTray(
    {
      group: g,
      output: 'sauce',
      animate: (dt, t, wk) => {
        stir.rotation.y += dt * (wk ? (v === 'B' ? 6 : 2.5) * P.spin : 0);
        bubbles.forEach((b, i) => {
          const k = (t * 1.2 + i / 5) % 1;
          b.visible = wk;
          b.position.y = top - 0.04 + k * 0.12;
          b.scale.setScalar(0.4 + k * 0.8);
        });
        fire(t, wk);
        puff(t, wk, P.steam);
      },
    },
    L,
    w,
    ['tomato'],
  );
}

// ---------- Dough mixer

function doughMixer(w: number, _d: number, L: Look, v: Variant): Built {
  const g = new THREE.Group();
  let animate: Built['animate'];
  if (v === 'A') {
    // a wooden kneading table: a rolling pin rolls the dough flat and it springs back round; flour dust puffs
    const top = counter(g, L, 1.3, 1.0);
    box(g, 1.0, 0.02, 0.7, C.flour, 0, top);
    const dough = sph(g, 0.22, C.dough, 0, top + 0.12, 0, 2);
    const pin = group(g, 0, top + 0.12, 0);
    cyl(pin, 0.07, 0.8, L.wood, 0, -0.4).rotation.z = Math.PI / 2;
    for (const x of [-0.5, 0.5]) cyl(pin, 0.03, 0.2, L.woodDark, x, -0.1).rotation.z = Math.PI / 2;
    const dust = puffs(g, 0, top + 0.05, 0.2, C.flour, 0.4, 3);
    animate = (_dt, t, wk) => {
      const k = wk ? Math.sin(t * 4 * P.spin) : 0;
      pin.position.z = k * 0.25;
      pin.rotation.x = k * 3;
      pin.position.y = top + (wk ? 0.16 : 0.3);
      dough.scale.set(1 + (wk ? 0.35 : 0), wk ? 0.45 + Math.abs(k) * 0.1 : 0.75, 1 + (wk ? 0.25 : 0));
      dust(t, wk, 1);
    };
  } else if (v === 'B') {
    // a big planetary stand mixer: arched red head, chrome bowl, the hook spins and orbits
    box(g, 1.1, 0.25, 0.9, L.top);
    box(g, 0.3, 1.2, 0.35, L.accent, 0, 0.25, -0.3);
    box(g, 0.34, 0.3, 1.0, L.accent, 0, 1.3, -0.05);
    cyl(g, 0.38, 0.5, L.metal, 0, 0.3, 0.1, 0.26, 20);
    const dough = sph(g, 0.25, C.dough, 0, 0.62, 0.1, 2);
    const hook = group(g, 0, 1.3, 0.2);
    cyl(hook, 0.035, 0.6, C.steelDark, 0, -0.6);
    torus(hook, 0.08, 0.025, C.steelDark, 0.06, -0.55).rotation.set(0.4, 0, 0);
    box(g, 0.36, 0.06, 0.06, C.white, 0, 1.44, 0.46);
    animate = (dt, t, wk) => {
      hook.rotation.y += dt * (wk ? 8 * P.spin : 0);
      hook.position.x = wk ? Math.sin(t * 2 * P.spin) * 0.08 : 0;
      dough.scale.set(1 + (wk ? Math.sin(t * 9) * 0.08 : 0), 0.7, 1 + (wk ? Math.cos(t * 9) * 0.08 : 0));
      g.rotation.z = wk ? Math.sin(t * 40) * 0.004 : 0;
    };
  } else {
    // a tiled spiral mixer: the bowl turns while a gold spiral hook spins against it
    counter(g, L, 1.2, 1.0, 0.6);
    const bowl = group(g, 0, 0.66, 0.05);
    cyl(bowl, 0.45, 0.4, L.metal, 0, 0, 0, 0.35, 20);
    sph(bowl, 0.3, C.dough, 0.08, 0.34, 0, 2).scale.set(1, 0.5, 1);
    box(g, 0.25, 1.0, 0.3, gloss(L.base), 0, 0.6, -0.45);
    box(g, 0.3, 0.25, 0.75, gloss(L.top), 0, 1.5, -0.15);
    const hook = group(g, 0.1, 1.5, 0.12);
    for (let i = 0; i < 4; i++) torus(hook, 0.07, 0.022, L.metal, 0, -0.15 - i * 0.12);
    cyl(hook, 0.025, 0.55, L.metal, 0.07, -0.55);
    animate = (dt, _t, wk) => {
      bowl.rotation.y -= dt * (wk ? 2 * P.spin : 0);
      hook.rotation.y += dt * (wk ? 9 * P.spin : 0);
    };
  }
  return withTray({ group: g, output: 'dough', animate }, L, w, ['flour', 'milk']);
}

// ---------- Pizza ovens (one model; the veggie one wears green and its own sign)

function ovenSign(g: THREE.Object3D, L: Look, veggie: boolean, x: number, y: number, z: number): void {
  if (!P.ovenSign) return;
  const s = group(g, x, y, z);
  box(s, 0.12, 0.3, 0.12, L.woodDark, 0, 0, 0);
  const disc = pizza(s, veggie);
  disc.rotation.x = Math.PI / 2 - 0.25;
  disc.position.set(0, 0.55, 0.06);
  disc.scale.setScalar(1.4);
  torus(s, 0.36, 0.03, veggie ? L.veggie : L.accent, 0, 0.55, 0.05).rotation.x = -0.25;
}

/** A pizza on a peel that slides in (raw) and back out (baked). */
function peel(g: THREE.Object3D, L: Look, veggie: boolean, x: number, y: number, zIn: number, zOut: number) {
  const pl = group(g, x, y, zOut);
  box(pl, 0.5, 0.02, 0.45, L.wood, 0, 0, 0);
  box(pl, 0.06, 0.03, 0.9, L.wood, 0, 0, 0.6);
  const raw = pizza(pl, veggie, true);
  const baked = pizza(pl, veggie);
  raw.position.y = baked.position.y = 0.02;
  raw.scale.setScalar(0.9);
  baked.scale.setScalar(0.9);
  return (t: number, on: boolean) => {
    const k = on ? (t * 0.35 * P.spin) % 1 : 0;
    const inside = Math.sin(k * Math.PI);
    pl.position.z = zOut + (zIn - zOut) * inside;
    raw.visible = on && k < 0.5;
    baked.visible = on && k >= 0.5;
  };
}

function pizzaOven(w: number, _d: number, L: Look, v: Variant, veggie: boolean): Built {
  const g = new THREE.Group();
  const band = veggie ? L.veggie : L.accent;
  let animate: Built['animate'];
  if (v === 'A' || v === 'C') {
    // a wood-fired dome on a base: brick (A) or cobalt-and-white mosaic (C); fire glows in the arched mouth
    const tiles = v === 'C';
    box(g, 1.6, 0.8, 1.5, tiles ? gloss(L.base) : L.brick);
    box(g, 1.66, 0.08, 1.56, tiles ? gloss(L.top) : L.woodDark, 0, 0.8);
    const domeY = 0.88;
    dome(g, 0.75, tiles ? gloss(L.base) : L.brick, 0, domeY, -0.1);
    if (tiles) for (let i = 0; i < 3; i++) torus(g, 0.74 - i * 0.12 - 0.05, 0.035, gloss(i % 2 ? L.accent : L.top), 0, domeY + 0.18 + i * 0.18, -0.1).scale.set(1, 1, 1 - i * 0.05);
    else torus(g, 0.74, 0.05, L.woodDark, 0, domeY + 0.05, -0.1);
    // arched mouth with a coloured rim; the fire flickers inside
    const mouth = group(g, 0, domeY, 0.55);
    box(mouth, 0.6, 0.35, 0.12, C.iron, 0, 0, 0);
    torus(mouth, 0.3, 0.06, gloss(band), 0, 0.35, 0.02).rotation.x = 0;
    box(mouth, 0.72, 0.08, 0.16, gloss(band), 0, -0.02, 0.02);
    const fire = flames(g, [[-0.2, -0.1], [0, -0.25], [0.2, -0.1]], domeY, 0.12);
    const ember = box(g, 0.5, 0.04, 0.4, glow(C.fire), 0, domeY, -0.15);
    // chimney and smoke
    cyl(g, 0.1, 0.5, tiles ? gloss(L.top) : C.iron, 0, domeY + 0.65, 0.2);
    const smoke = puffs(g, 0, domeY + 1.2, 0.2, C.smoke, 1);
    const slide = peel(g, L, veggie, 0, domeY + 0.02, -0.05, 0.6);
    ovenSign(g, L, veggie, 0.62, domeY + 0.6, -0.1);
    animate = (_dt, t, wk) => {
      fire(t, wk);
      (ember.material as THREE.MeshStandardMaterial).emissiveIntensity = (wk ? 1.2 : 0.4) + Math.sin(t * 9) * 0.2;
      smoke(t, wk, P.steam);
      slide(t, wk);
    };
  } else {
    // a chrome conveyor oven: raw pizzas ride the belt into the glowing tunnel and roll out baked
    box(g, 1.7, 0.75, 1.0, L.base);
    for (let i = 0; i < 6; i++) box(g, 0.28, 0.28, 0.01, i % 2 ? C.white : L.trim, -0.7 + i * 0.28, 0.2, 0.505);
    const beltY = 0.9;
    box(g, 1.7, 0.1, 0.62, C.iron, 0, 0.78);
    const slats = Array.from({ length: 12 }, (_, i) => box(g, 0.06, 0.02, 0.58, C.steelDark, -0.85 + i * 0.14, beltY - 0.02));
    box(g, 0.95, 0.55, 0.8, L.metal, 0, beltY + 0.1);
    box(g, 0.97, 0.08, 0.82, gloss(band), 0, beltY + 0.62);
    // neon strip and the hot mouth glow
    const neon = box(g, 0.9, 0.06, 0.04, glow(band), 0, beltY + 0.4, 0.42);
    for (const x of [-0.48, 0.48]) box(g, 0.02, 0.35, 0.62, glow(C.fire), x, beltY + 0.08);
    const rides = [0, 1, 2].map(() => ({ raw: pizza(g, veggie, true), baked: pizza(g, veggie) }));
    rides.forEach((r) => (r.raw.scale.setScalar(0.8), r.baked.scale.setScalar(0.8)));
    ovenSign(g, L, veggie, 0, beltY + 0.7, 0);
    let s = 0;
    animate = (dt, t, wk) => {
      s += dt * (wk ? 0.35 * P.spin : 0);
      slats.forEach((m, i) => (m.position.x = -0.85 + ((i / slats.length + s) % 1) * 1.7));
      rides.forEach((r, i) => {
        const k = (s + i / 3) % 1;
        const x = -0.85 + k * 1.7;
        r.raw.position.set(x, beltY, 0);
        r.baked.position.set(x, beltY, 0);
        r.raw.visible = wk && x < 0;
        r.baked.visible = wk && x >= 0;
      });
      (neon.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + Math.sin(t * (wk ? 12 : 2)) * 0.25;
    };
  }
  return withTray({ group: g, output: veggie ? 'veggie' : 'pizza', animate }, L, w, ['dough', 'sauce', veggie ? 'olives' : 'cheese']);
}

const BUILDERS: Record<string, (w: number, d: number, L: Look, v: Variant) => Built> = {
  sauce_pot: saucePot,
  dough_mixer: doughMixer,
  olive_tree: oliveTree,
  pizza_oven: (w, d, L, v) => pizzaOven(w, d, L, v, false),
  veggie_pizza_oven: (w, d, L, v) => pizzaOven(w, d, L, v, true),
};

// ---------- the showroom

applyCssPalette(document.documentElement);
await loadAssets(() => {});
const stage = new Stage(document.getElementById('scene') as HTMLCanvasElement);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat('#efe0c8'));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
stage.scene.add(floor);

const REFS: Record<string, { name: string; size: [number, number]; label: string }> = {
  ref_oven: { name: 'oven', size: [2.4, 3.5], label: 'Oven (Corner Shop, for scale)' },
  ref_mill: { name: 'mill', size: [2.4, 3.5], label: 'Mill (Corner Shop, for scale)' },
};

interface Placed {
  id: string;
  root: THREE.Group;
  built: Built | null;
  animateRef?: (dt: number, wk: boolean) => void;
  centre: THREE.Vector3;
  phase: number;
  outCount: number;
  outItems: THREE.Object3D[];
  inItems: THREE.Object3D[];
  label: HTMLDivElement;
}
let placed: Placed[] = [];

function rebuild(): void {
  for (const p of placed) {
    stage.scene.remove(p.root);
    p.label.remove();
  }
  placed = [];
  const L = LOOKS[P.variant];
  floor.material = mat(L.floor);
  const rows: string[][] = [
    ['sauce_pot', 'dough_mixer', 'olive_tree', 'ref_mill'],
    ['pizza_oven', 'veggie_pizza_oven', 'ref_oven'],
  ];
  let z = 0;
  for (const row of rows) {
    let x = 0;
    let depth = 0;
    for (const id of row) {
      const ref = REFS[id];
      const [w, d] = ref ? ref.size : P.footprints[id];
      const root = new THREE.Group();
      root.position.set(x + w / 2, 0, z + d / 2);
      stage.scene.add(root);
      const label = document.createElement('div');
      label.className = 'lbl';
      label.textContent = PRODUCERS.find((p) => p.id === id)?.name ?? ref?.label ?? id;
      label.onclick = (e) => (e.stopPropagation(), focusOn(id));
      el('labels').append(label);
      const p: Placed = {
        id, root, built: null, centre: root.position.clone(), phase: Math.random() * 5,
        outCount: 0, outItems: [], inItems: [], label,
      };
      if (ref) {
        const v = buildStation(ref.name, [-w / 2, -d / 2, w, d], 0);
        root.add(v.root);
        p.animateRef = v.animate;
      } else if (id === 'olive_tree') {
        const built = BUILDERS[id](w, d, L, P.variant);
        root.add(built.group);
        p.built = built;
      } else {
        const strip = 1.1;
        const built = BUILDERS[id](w, d - strip, L, P.variant);
        built.group.position.z = -strip / 2;
        root.add(built.group);
        box(root, 1.46, 0.1, 0.99, L.woodDark, 0, 0, d / 2 - strip / 2);
        p.built = built;
        // output pallet: 3 + 2 + 1 Items; inputs on the tray spots
        for (let i = 0; i < 6; i++) {
          const m = item(built.output);
          const r = i < 3 ? 0 : i < 5 ? 1 : 2;
          const k = i < 3 ? i - 1 : i < 5 ? i - 3.5 : 0;
          m.position.set(k * 0.42, 0.1 + r * 0.22, d / 2 - 0.55);
          m.visible = false;
          root.add(m);
          p.outItems.push(m);
        }
        for (const s of built.inputs) {
          const m = item(s.kind);
          m.position.copy(s.at);
          built.group.add(m);
          p.inItems.push(m);
        }
      }
      if (P.showFootprints) {
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.02, d)),
          new THREE.LineBasicMaterial({ color: '#3a2416' }),
        );
        edge.position.y = 0.01;
        root.add(edge);
      }
      placed.push(p);
      x += w + 1.5;
      depth = Math.max(depth, d);
    }
    z += depth + 2;
  }
  focusOn(P.focus);
}

function focusOn(id: string): void {
  P.focus = id;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  const p = placed.find((q) => q.id === id);
  if (p) {
    stage.focus.copy(p.centre);
    stage.zoomTo(P.zoom);
  } else {
    const bb = new THREE.Box3();
    for (const q of placed) bb.expandByObject(q.root);
    bb.getCenter(stage.focus).setY(0);
    stage.zoomTo(innerWidth < innerHeight ? 24 : 16);
  }
  const meta = PRODUCERS.find((q) => q.id === id);
  el('cap').textContent = meta
    ? `${meta.name} — ${meta.recipe} · footprint ${P.footprints[id].join(' × ')} m`
    : `${NAMES[P.variant]} — tap a name to look closer`;
  for (const q of placed) q.label.classList.toggle('on', q.id === id);
}

// ---------- panel

const gui = new GUI({ title: 'Pizza Place Producers' });
if (innerWidth < 700) gui.close();
gui
  .add(P, 'focus', {
    Overview: 'overview',
    ...Object.fromEntries(PRODUCERS.map((p) => [p.name, p.id])),
    'Oven (ref)': 'ref_oven',
    'Mill (ref)': 'ref_mill',
  })
  .name('Look at')
  .onChange((v: string) => focusOn(v));
gui.add(P, 'working', ['cycle', 'on', 'off']).name('Working');
gui.add(P, 'showItems').name('Show Items');
gui.add(P, 'showFootprints').name('Footprints').onChange(rebuild);
gui.add(P, 'zoom', 4, 14, 0.5).name('Close-up zoom m').onChange(() => focusOn(P.focus));
const look = gui.addFolder('Look');
look.add(P, 'ovenSign').name('Pizza sign on ovens').onChange(rebuild);
look.add(P, 'toppingSize', 0.6, 1.8, 0.05).name('Topping size').onFinishChange(rebuild);
look.add(P, 'oliveSize', 0.6, 2.5, 0.05).name('Olive size').onFinishChange(rebuild);
look.add(P, 'groundScale', 0.6, 2.5, 0.05).name('Olives on the ground ×');
look.add(P, 'dropSpeed', 0.3, 3, 0.1).name('Ripen / drop speed').onFinishChange(rebuild);
look.add(P, 'treeHeight', 0.6, 1.6, 0.05).name('Tree height').onFinishChange(rebuild);
look.add(P, 'flagSize', 0.5, 1.8, 0.05).name('Flag size').onFinishChange(rebuild);
look.add(P, 'scarfSize', 0.5, 1.8, 0.05).name('Keffiyeh size').onFinishChange(rebuild);
look.add(P, 'wave', 0, 3, 0.1).name('Flag wave');
const motion = gui.addFolder('Motion');
motion.add(P, 'spin', 0, 3, 0.1).name('Speed (stir / knead / belt)');
motion.add(P, 'fire', 0, 2, 0.1).name('Fire');
motion.add(P, 'steam', 0, 3, 0.1).name('Steam / smoke');
const fp = gui.addFolder('Footprints (w × d m)');
fp.close();
for (const p of PRODUCERS) {
  const pair = P.footprints[p.id];
  const o = { w: pair[0], d: pair[1] };
  fp.add(o, 'w', 1.5, 5, 0.1).name(`${p.name} w`).onFinishChange((v: number) => ((pair[0] = v), rebuild()));
  fp.add(o, 'd', 1.5, 5, 0.1).name(`${p.name} d`).onFinishChange((v: number) => ((pair[1] = v), rebuild()));
}
const dump = document.getElementById('dump') as HTMLPreElement;
gui.add({ show: () => ((dump.style.display = 'block'), (dump.textContent = JSON.stringify(P, null, 1))) }, 'show').name('Show values');
gui.add({ hide: () => (dump.style.display = 'none') }, 'hide').name('Hide values');

const KEYS: Variant[] = ['A', 'B', 'C'];
function setVariant(v: Variant): void {
  P.variant = v;
  const u = new URL(location.href);
  u.searchParams.set('variant', v);
  history.replaceState(null, '', u);
  el('vname').textContent = NAMES[v];
  rebuild();
}
const step = (k: number) => setVariant(KEYS[(KEYS.indexOf(P.variant) + k + KEYS.length) % KEYS.length]);
el('prev').onclick = () => step(-1);
el('next').onclick = () => step(1);
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
el('scene').addEventListener('click', () => focusOn('overview'));

setVariant(KEYS.includes(P.variant) ? P.variant : 'C');

// ---------- loop

const clock = new THREE.Clock();
let t = 0;
const screen = new THREE.Vector2();
function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  for (const p of placed) {
    const wk = P.working === 'on' || (P.working === 'cycle' && (t + p.phase) % 7 < 4.5);
    if (p.animateRef) p.animateRef(dt, wk);
    if (p.built) {
      p.built.animate(dt, t, wk);
      if (wk) p.outCount = Math.min(6, p.outCount + dt * 0.6);
      else if (p.outCount >= 6) p.outCount = 0;
      p.outItems.forEach((m, i) => (m.visible = P.showItems && i < Math.floor(p.outCount)));
      p.inItems.forEach((m, i) => (m.visible = P.showItems && i % 3 < (wk ? 1 : 2)));
    }
  }
  for (const p of placed) {
    stage.toScreen(p.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), screen);
    p.label.style.left = `${screen.x}px`;
    p.label.style.top = `${screen.y}px`;
  }
  stage.render(dt);
}
frame();
