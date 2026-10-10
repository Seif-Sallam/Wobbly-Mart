// PROTOTYPE — throwaway (branch prototype/juice-models). The Juice Bar's new Producers, code-built, in the game's
// own camera and light. Three style presets via ?variant=A|B|C, a lil-gui tuning panel and a value dump.
import * as THREE from 'three';
import GUI from 'lil-gui';
import { Stage } from './stage';
import { buildStation } from './stations';
import { ITEM_SIZE } from '../../catalog/assets';
import { applyCssPalette } from '../palette';

type Style = 'A' | 'B' | 'C';
const STYLE_NAMES: Record<Style, string> = {
  A: 'Orchard stand — rustic wood & copper',
  B: 'Fruit gadgets — giant fruit-shaped toys',
  C: 'Retro juice bar — pastel chrome & glass',
};

// prototype-only colours (would move to palette.ts)
const C = {
  apple: '#d63c2f', appleLight: '#e86a4a', orange: '#f28a1d', leaf: '#5e9e3a', leafDark: '#3f7a2a', leafLight: '#8bc34a',
  trunk: '#7a4a2a', wood: '#c17a43', woodDark: '#8a5530', copper: '#c46a3a', brick: '#a8553a', iron: '#3a3a40',
  cane: '#9ccc4a', caneNode: '#6f9a2e', straw: '#e8c46a', dirt: '#9c5b3a', dirtDark: '#7a4530', strawberry: '#e0453a',
  seed: '#ffe066', cream: '#fff1d0', ink: '#3a2416', chrome: '#c9d2da', mint: '#9fe0c9', pink: '#f7a8c4', sky: '#9ad3ec',
  butter: '#ffe39a', glass: '#bfe6f2', appleJuice: '#e8d24a', orangeJuice: '#f5a623', sugar: '#ffffff', candy: '#b3261e',
  smoothie: '#e86aa6', milk: '#ffffff', terracotta: '#d0784a', fire: '#ff7a1a', steam: '#f0f0f0', grass: '#a3c94a',
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(c: string, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = c + JSON.stringify(extra);
  let m = mats.get(key);
  if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...extra })));
  return m;
}
const shiny = (c: string) => mat(c, { roughness: 0.25, metalness: 0.6 });
const clear = (c: string, o = 0.45) => mat(c, { transparent: true, opacity: o, roughness: 0.1 });
function put<T extends THREE.Mesh>(parent: THREE.Object3D, m: T, x = 0, y = 0, z = 0): T {
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (p: THREE.Object3D, w: number, h: number, d: number, c: string | THREE.Material, x = 0, y = 0, z = 0) =>
  put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? mat(c) : c), x, y + h / 2, z);
const cyl = (p: THREE.Object3D, r: number, h: number, c: string | THREE.Material, x = 0, y = 0, z = 0, rb = r, seg = 16) =>
  put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, rb, h, seg), typeof c === 'string' ? mat(c) : c), x, y + h / 2, z);
const sph = (p: THREE.Object3D, r: number, c: string | THREE.Material, x = 0, y = 0, z = 0, detail = 1) =>
  put(p, new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), typeof c === 'string' ? mat(c) : c), x, y, z);
const cone = (p: THREE.Object3D, r: number, h: number, c: string | THREE.Material, x = 0, y = 0, z = 0, seg = 12) =>
  put(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), typeof c === 'string' ? mat(c) : c), x, y + h / 2, z);
const torus = (p: THREE.Object3D, r: number, t: number, c: string | THREE.Material, x = 0, y = 0, z = 0) => {
  const m = put(p, new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 24), typeof c === 'string' ? mat(c) : c), x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
};

/** Tunable numbers; the panel edits these live and "Show values" dumps them. */
const P = {
  style: (new URLSearchParams(location.search).get('variant') ?? 'A') as Style,
  focus: 'overview',
  working: 'cycle' as 'cycle' | 'on' | 'off',
  harvest: true,
  showFootprints: true,
  showItems: true,
  zoom: 7,
  fruitSize: 1,
  treeHeight: 1,
  sway: 1,
  shake: 1,
  spin: 1,
  bubbles: 1,
  footprints: {
    apple_tree: [2.5, 2.5],
    orange_tree: [2.5, 2.5],
    sugar_cane_field: [3, 3],
    strawberry_patch: [4, 2.4],
    apple_press: [2.2, 3.3],
    squeezer: [2, 2.6],
    sugar_mill: [2.4, 3.5],
    candy_pot: [2.2, 3.3],
    smoothie_blender: [2, 2.8],
  } as Record<string, [number, number]>,
};

interface Built {
  group: THREE.Group;
  animate: (dt: number, t: number, working: boolean) => void;
  fruits?: THREE.Object3D[];
  inputs?: { at: THREE.Vector3[]; colour: string };
  output?: string;
}

const PRODUCERS: { id: string; name: string; kind: 'crop' | 'machine'; recipe: string }[] = [
  { id: 'apple_tree', name: 'Apple tree', kind: 'crop', recipe: '→ apple (6 s, 4)' },
  { id: 'orange_tree', name: 'Orange tree', kind: 'crop', recipe: '→ orange (7 s, 4)' },
  { id: 'sugar_cane_field', name: 'Sugar cane field', kind: 'crop', recipe: '→ sugar cane (7 s, 6)' },
  { id: 'strawberry_patch', name: 'Strawberry patch', kind: 'crop', recipe: '→ strawberry (6 s, 6)' },
  { id: 'apple_press', name: 'Apple press', kind: 'machine', recipe: 'apple → apple juice (3 s)' },
  { id: 'squeezer', name: 'Squeezer', kind: 'machine', recipe: 'orange → orange juice (3.5 s)' },
  { id: 'sugar_mill', name: 'Sugar mill', kind: 'machine', recipe: 'sugar cane → sugar (4 s)' },
  { id: 'candy_pot', name: 'Candy pot', kind: 'machine', recipe: 'apple + sugar → candy apple (5 s)' },
  { id: 'smoothie_blender', name: 'Smoothie blender', kind: 'machine', recipe: 'strawberry + milk → smoothie (6 s)' },
];

// ---------- crops

function canopy(g: THREE.Object3D, style: Style, colour: string, h: number, r: number): THREE.Group {
  const c = new THREE.Group();
  g.add(c);
  c.position.y = h;
  if (style === 'A') {
    sph(c, r, colour, 0, 0, 0);
    for (const [x, y, z, s] of [[0.45, 0.15, 0.2, 0.7], [-0.4, 0.1, -0.25, 0.75], [0.1, 0.4, -0.35, 0.6], [-0.2, -0.15, 0.45, 0.6]])
      sph(c, r * s, colour, x * r, y * r, z * r);
  } else if (style === 'B') {
    sph(c, r * 1.15, colour, 0, 0, 0, 3);
  } else {
    // C: clipped topiary, two stacked balls
    sph(c, r * 0.9, colour, 0, -0.2 * r, 0, 2);
    sph(c, r * 0.6, colour, 0, 0.75 * r, 0, 2);
  }
  return c;
}

function fruitTree(style: Style, w: number, d: number, fruit: string, leaves: string, tall: number): Built {
  const g = new THREE.Group();
  const s = Math.min(w, d);
  const h = (style === 'B' ? 1.5 : 1.25) * tall * P.treeHeight;
  if (style === 'A') {
    cyl(g, s * 0.36, 0.12, C.dirt);
    torus(g, s * 0.37, 0.07, C.wood, 0, 0.12, 0);
    cyl(g, 0.12, h, C.trunk, 0, 0, 0, 0.17, 8);
  } else if (style === 'B') {
    box(g, s * 0.8, 0.06, s * 0.8, C.grass);
    cyl(g, 0.09, h, C.cream, 0, 0, 0, 0.09, 8);
  } else {
    cyl(g, s * 0.24, 0.6, C.terracotta, 0, 0, 0, s * 0.18);
    torus(g, s * 0.245, 0.05, C.terracotta, 0, 0.6, 0);
    cyl(g, s * 0.22, 0.04, C.dirt, 0, 0.56, 0);
    cyl(g, 0.08, h, C.trunk, 0, 0.6, 0, 0.1, 8);
    // little ladder leaning on it
    const lad = new THREE.Group();
    for (const k of [-1, 1]) box(lad, 0.04, 1.6, 0.04, C.wood, k * 0.15);
    for (let i = 0; i < 5; i++) box(lad, 0.3, 0.03, 0.03, C.wood, 0, 0.2 + i * 0.3);
    lad.position.set(s * 0.32, 0, s * 0.18);
    lad.rotation.z = 0.25;
    g.add(lad);
  }
  const r = style === 'B' ? 0.75 : 0.62;
  const top = canopy(g, style, leaves, h + (style === 'C' ? 0.6 : 0) + r * 0.6, r);
  const fruits: THREE.Object3D[] = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.6;
    const f = new THREE.Group();
    const fr = (style === 'B' ? 0.21 : 0.16) * P.fruitSize;
    sph(f, fr, fruit, 0, 0, 0, 2);
    if (fruit === C.apple) cyl(f, 0.015, 0.08, C.trunk, 0, fr * 0.8, 0);
    else sph(f, 0.03, C.leaf, 0, fr * 0.95, 0);
    f.position.set(Math.cos(a) * r * 1.02, (i % 2 ? -0.15 : 0.15) * r, Math.sin(a) * r * 0.95);
    top.add(f);
    fruits.push(f);
  }
  return {
    group: g,
    fruits,
    animate: (_dt, t) => {
      top.rotation.z = Math.sin(t * 1.3) * 0.03 * P.sway;
      top.rotation.x = Math.sin(t * 0.9 + 1) * 0.025 * P.sway;
      if (style === 'B') top.scale.setScalar(1 + Math.sin(t * 2) * 0.02 * P.sway);
    },
  };
}

function caneField(style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  const s = Math.min(w, d);
  const stalks: THREE.Group[] = [];
  const clump = (x: number, z: number, n: number, hgt: number) => {
    for (let i = 0; i < n; i++) {
      const st = new THREE.Group();
      const hh = hgt * (0.8 + ((i * 37) % 10) / 25);
      const segs = 4;
      for (let k = 0; k < segs; k++) {
        cyl(st, 0.045, hh / segs - 0.02, style === 'B' ? C.leafLight : C.cane, 0, (k * hh) / segs, 0, 0.05, 6);
        cyl(st, 0.055, 0.03, C.caneNode, 0, ((k + 1) * hh) / segs - 0.02, 0, 0.055, 6);
      }
      for (let k = 0; k < 2; k++) {
        const leaf = box(st, 0.05, 0.6, 0.015, C.leafLight, 0, hh - 0.3 - k * 0.2, 0);
        leaf.rotation.set(0.6 * (k ? 1 : -1), i, 0.4);
      }
      st.position.set(x + Math.cos(i * 2.4) * 0.12, 0, z + Math.sin(i * 2.4) * 0.12);
      g.add(st);
      stalks.push(st);
    }
  };
  if (style === 'A') {
    box(g, s, 0.06, s, C.dirt);
    for (const k of [-1, 0, 1]) box(g, s * 0.85, 0.1, 0.35, C.dirtDark, 0, 0.06, k * s * 0.3);
    for (let i = 0; i < 6; i++) clump(((i % 3) - 1) * s * 0.28, (Math.floor(i / 3) - 0.5) * s * 0.5, 3, 1.7);
    // low split-rail fence front + back
    for (const z of [-s / 2, s / 2]) {
      box(g, s, 0.05, 0.05, C.wood, 0, 0.35, z);
      for (const x of [-s / 2, 0, s / 2]) box(g, 0.08, 0.45, 0.08, C.woodDark, x, 0, z);
    }
  } else if (style === 'B') {
    box(g, s, 0.06, s, C.grass);
    for (let i = 0; i < 6; i++) {
      const x = ((i % 3) - 1) * s * 0.3;
      const z = (Math.floor(i / 3) - 0.5) * s * 0.45;
      cyl(g, 0.28, 0.12, C.dirtDark, x, 0.06, z);
      clump(x, z, 4, 2.1);
    }
  } else {
    // raised planter with a water channel and drip pipe
    box(g, s, 0.45, s * 0.8, C.mint);
    box(g, s * 0.92, 0.04, s * 0.72, C.dirt, 0, 0.45, 0);
    box(g, s * 0.92, 0.05, 0.12, clear(C.sky, 0.8), 0, 0.46, s * 0.4 + 0.08);
    cyl(g, 0.03, s * 0.9, shiny(C.chrome), 0, 0.6, -s * 0.3).rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const before = stalks.length;
      clump(((i % 3) - 1) * s * 0.3, (Math.floor(i / 3) - 0.5) * s * 0.4, 3, 1.6);
      for (const st of stalks.slice(before)) st.position.y = 0.48;
    }
  }
  return {
    group: g,
    fruits: stalks.filter((_, i) => i % 3 === 0).slice(0, 6),
    animate: (_dt, t) => {
      stalks.forEach((st, i) => (st.rotation.z = Math.sin(t * 1.6 + i * 0.7) * 0.05 * P.sway));
    },
  };
}

function berryMound(p: THREE.Object3D, style: Style, x: number, z: number, y = 0): THREE.Object3D {
  const m = new THREE.Group();
  m.position.set(x, y, z);
  p.add(m);
  if (style === 'B') {
    // a giant strawberry plant: one berry the size of a melon under big leaves
    for (let i = 0; i < 4; i++) {
      const l = box(m, 0.45, 0.04, 0.22, C.leaf, Math.cos(i * 1.57) * 0.2, 0.25, Math.sin(i * 1.57) * 0.2);
      l.rotation.y = -i * 1.57;
      l.rotation.z = 0.3;
    }
  } else {
    sph(m, 0.28, C.leaf, 0, 0.12, 0);
    sph(m, 0.18, C.leafDark, 0.15, 0.2, 0.08);
  }
  const berry = new THREE.Group();
  const br = (style === 'B' ? 0.22 : 0.13) * P.fruitSize;
  const b = cone(berry, br, br * 1.6, C.strawberry, 0, -br * 0.8, 0, 10);
  b.rotation.x = Math.PI;
  b.position.y = br * 0.8;
  if (style === 'B') for (let i = 0; i < 8; i++) sph(berry, 0.025, C.seed, Math.cos(i) * br * 0.55, Math.sin(i * 3) * br * 0.3, Math.sin(i) * br * 0.55, 0);
  cone(berry, br * 0.8, 0.05, C.leafDark, 0, br * 0.75, 0, 6);
  berry.position.set(style === 'B' ? 0 : 0.2, style === 'B' ? 0.3 : 0.08, style === 'B' ? 0 : 0.22);
  m.add(berry);
  return berry;
}

function strawberryPatch(style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  const fruits: THREE.Object3D[] = [];
  const leaves: THREE.Object3D[] = [];
  if (style === 'A') {
    const len = w * 0.9;
    const dep = Math.min(d * 0.5, 1.1);
    box(g, len, 0.2, dep, C.straw);
    for (const z of [-1, 1]) box(g, len + 0.16, 0.3, 0.08, C.wood, 0, 0, (z * (dep + 0.08)) / 2);
    for (const x of [-1, 1]) box(g, 0.08, 0.3, dep, C.wood, (x * (len + 0.08)) / 2, 0, 0);
    for (let i = 0; i < 6; i++) fruits.push(berryMound(g, style, (i / 5 - 0.5) * (len - 0.6), (i % 2 ? 0.15 : -0.15), 0.2));
  } else if (style === 'B') {
    box(g, w * 0.95, 0.06, d * 0.8, C.grass);
    for (let i = 0; i < 6; i++) {
      cyl(g, 0.32, 0.1, C.dirt, ((i % 3) - 1) * w * 0.3, 0.06, (Math.floor(i / 3) - 0.5) * d * 0.4);
      fruits.push(berryMound(g, style, ((i % 3) - 1) * w * 0.3, (Math.floor(i / 3) - 0.5) * d * 0.4, 0.12));
    }
  } else {
    // three-tier vertical planter, like a stepped shelf
    for (let k = 0; k < 3; k++) {
      const y = k * 0.45;
      const z = (1 - k) * 0.42;
      box(g, w * 0.85, 0.3, 0.42, C.pink, 0, y, z);
      box(g, w * 0.8, 0.04, 0.36, C.dirt, 0, y + 0.3, z);
      for (let i = 0; i < 2; i++) fruits.push(berryMound(g, style, (i - 0.5) * w * 0.4, z, y + 0.3));
    }
    for (const x of [-1, 1]) box(g, 0.06, 1.4, 1.3, C.cream, (x * w * 0.43), 0, 0);
  }
  g.traverse((o) => o !== g && leaves.push(o));
  return {
    group: g,
    fruits,
    animate: (_dt, t) => fruits.forEach((f, i) => (f.rotation.z = Math.sin(t * 2 + i) * 0.08 * P.sway)),
  };
}

// ---------- machines (structure fills the back; the front strip is the output pallet)

function counter(g: THREE.Object3D, w: number, d: number, style: Style): number {
  const h = 0.85;
  const c = style === 'A' ? C.wood : style === 'B' ? C.cream : C.mint;
  box(g, w, h, d, c);
  box(g, w + 0.06, 0.06, d + 0.06, style === 'C' ? shiny(C.chrome) : style === 'A' ? C.woodDark : C.butter, 0, h);
  return h + 0.06;
}

function applePress(style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  let anim: Built['animate'];
  if (style === 'A') {
    // cider press: slatted tub, a big screw with a cross handle that turns and lowers the plate
    cyl(g, 0.55, 0.2, C.woodDark);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      box(g, 0.1, 0.55, 0.04, C.wood, Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45).rotation.y = -a + Math.PI / 2;
    }
    torus(g, 0.47, 0.025, C.iron, 0, 0.3);
    torus(g, 0.47, 0.025, C.iron, 0, 0.65);
    for (const x of [-0.6, 0.6]) box(g, 0.12, 1.6, 0.12, C.woodDark, x);
    box(g, 1.35, 0.14, 0.16, C.woodDark, 0, 1.6);
    const screw = new THREE.Group();
    g.add(screw);
    cyl(screw, 0.05, 1.1, C.iron, 0, -0.4);
    box(screw, 0.9, 0.05, 0.05, C.iron, 0, 0.62);
    cyl(screw, 0.4, 0.06, C.wood, 0, -0.42);
    screw.position.y = 1.0;
    const spout = box(g, 0.1, 0.06, 0.3, C.copper, 0, 0.22, 0.6);
    spout.rotation.x = 0.3;
    anim = (dt, _t, wk) => {
      screw.rotation.y += dt * (wk ? 3 * P.spin : 0);
      screw.position.y += ((wk ? 0.85 : 1.0) - screw.position.y) * Math.min(1, dt * 2);
    };
  } else if (style === 'B') {
    // a giant apple machine: the stalk is a crank, the leaf flaps, juice pours from a tap in its cheek
    const body = new THREE.Group();
    g.add(body);
    sph(body, 0.75, C.apple, 0, 0.75, 0, 3);
    sph(body, 0.25, C.appleLight, 0.3, 1.0, 0.55, 2);
    const stalk = cyl(body, 0.06, 0.4, C.trunk, 0, 1.45);
    const leaf = box(body, 0.35, 0.03, 0.18, C.leaf, 0.2, 1.7, 0);
    box(body, 0.14, 0.14, 0.2, C.chrome, 0, 0.45, 0.72);
    anim = (dt, t, wk) => {
      body.scale.set(1 + (wk ? Math.sin(t * 9) * 0.04 * P.shake : 0), 1 - (wk ? Math.sin(t * 9) * 0.04 * P.shake : 0), 1);
      stalk.rotation.y += dt * (wk ? 6 * P.spin : 0.3);
      leaf.rotation.z = Math.sin(t * (wk ? 10 : 2)) * 0.3;
    };
  } else {
    // chrome hydraulic press over a glass tank that fills with juice
    const top = counter(g, w * 0.8, 0.9, style);
    const tank = cyl(g, 0.28, 0.6, clear(C.glass), -0.3, top, 0);
    const juice = cyl(g, 0.25, 0.01, mat(C.appleJuice), -0.3, top + 0.02, 0);
    for (const x of [0.15, 0.65]) cyl(g, 0.04, 1.1, shiny(C.chrome), x, top, 0);
    box(g, 0.7, 0.1, 0.35, shiny(C.chrome), 0.4, top + 1.1);
    const ram = cyl(g, 0.18, 0.08, shiny(C.chrome), 0.4, top + 0.85);
    cyl(g, 0.2, 0.06, C.cream, 0.4, top);
    anim = (dt, t, wk) => {
      ram.position.y = top + 0.5 + (wk ? (Math.sin(t * 5 * P.spin) * 0.5 + 0.5) * 0.4 : 0.4);
      const want = wk ? 0.55 : 0.1;
      juice.scale.y += ((want / 0.01) - juice.scale.y) * Math.min(1, dt * 0.6);
      juice.position.y = top + 0.02 + (juice.scale.y * 0.01) / 2;
      tank.rotation.y = t;
    };
  }
  return { group: g, animate: anim, inputs: { at: slotsLeft(w, d), colour: C.apple }, output: C.appleJuice };
}

function squeezer(style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  let anim: Built['animate'];
  if (style === 'A') {
    // hand-lever citrus press on a wooden counter: the long lever pumps down
    const top = counter(g, w * 0.8, 0.9, style);
    box(g, 0.5, 0.08, 0.5, C.iron, 0, top);
    cyl(g, 0.16, 0.12, shiny(C.chrome), 0, top + 0.08);
    box(g, 0.08, 0.8, 0.08, C.iron, 0, top, -0.2);
    const pivot = new THREE.Group();
    pivot.position.set(0, top + 0.8, -0.2);
    g.add(pivot);
    box(pivot, 0.06, 0.06, 0.9, C.iron, 0, 0, 0.35);
    sph(pivot, 0.07, C.ink, 0, 0, 0.8);
    cyl(pivot, 0.17, 0.08, shiny(C.chrome), 0, -0.2, 0.2);
    anim = (_dt, t, wk) => (pivot.rotation.x = wk ? 0.25 + Math.sin(t * 6 * P.spin) * 0.25 : -0.35);
  } else if (style === 'B') {
    // a giant half-orange: the reamer cone spins on top, peel segments pulse
    const half = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.orange));
    put(g, half, 0, 0.1);
    cyl(g, 0.73, 0.1, C.butter, 0, 0.0);
    const ream = new THREE.Group();
    g.add(ream);
    ream.position.y = 0.85;
    cone(ream, 0.3, 0.5, C.butter, 0, 0, 0, 8);
    for (let i = 0; i < 8; i++) box(ream, 0.02, 0.4, 0.62, C.orange, 0, 0.05, 0).rotation.y = (i / 8) * Math.PI;
    anim = (dt, t, wk) => {
      ream.rotation.y += dt * (wk ? 9 * P.spin : 0.4);
      half.scale.setScalar(1 + (wk ? Math.sin(t * 12) * 0.03 * P.shake : 0));
    };
  } else {
    // auto juicer: oranges roll down a chute into a glass-fronted machine, a wheel turns behind the glass
    const top = counter(g, w * 0.85, 0.9, style);
    box(g, 0.9, 0.9, 0.6, C.orange, 0, top, -0.05);
    box(g, 0.6, 0.5, 0.02, clear(C.glass, 0.5), 0, top + 0.25, 0.26);
    const wheel = new THREE.Group();
    wheel.position.set(0, top + 0.5, 0.15);
    g.add(wheel);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sph(wheel, 0.08, C.orange, Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0, 1);
    }
    const chute = box(g, 0.25, 0.04, 0.8, shiny(C.chrome), 0, top + 1.05, -0.2);
    chute.rotation.x = -0.35;
    const rolling = [0, 1, 2].map((i) => sph(g, 0.09, C.orange, 0, top + 1.2 - i * 0.1, -0.5 + i * 0.25, 1));
    anim = (dt, t, wk) => {
      wheel.rotation.z -= dt * (wk ? 5 * P.spin : 0);
      rolling.forEach((o, i) => {
        const k = ((t * (wk ? 0.6 : 0) + i / 3) % 1);
        o.position.set(0, top + 1.25 - k * 0.3, -0.55 + k * 0.6);
        o.rotation.x = k * 10;
      });
    };
  }
  return { group: g, animate: anim, inputs: { at: slotsLeft(w, d), colour: C.orange }, output: C.orangeJuice };
}

function sugarMill(style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  let anim: Built['animate'];
  const rollers: THREE.Object3D[] = [];
  if (style === 'A') {
    // old cane crusher: two upright iron rollers turned by a long wooden sweep beam, juice trough below
    box(g, 1.5, 0.3, 1.2, C.brick);
    for (const x of [-0.18, 0.18]) {
      const r = cyl(g, 0.17, 0.8, C.iron, x, 0.3, 0);
      for (let i = 0; i < 6; i++) box(r, 0.02, 0.8, 0.36, C.ink, 0, -0.4, 0).rotation.y = (i / 6) * Math.PI;
      rollers.push(r);
    }
    box(g, 0.7, 0.12, 0.4, C.iron, 0, 1.1);
    const beam = new THREE.Group();
    beam.position.y = 1.25;
    g.add(beam);
    box(beam, 2.2, 0.1, 0.1, C.woodDark, 0.7);
    cyl(beam, 0.06, 0.3, C.woodDark, 0, -0.1);
    anim = (dt, _t, wk) => {
      beam.rotation.y += dt * (wk ? 1.2 * P.spin : 0);
      rollers.forEach((r, i) => (r.rotation.y += dt * (wk ? 4 : 0) * (i ? -1 : 1)));
    };
  } else if (style === 'B') {
    // a toy factory: a big funnel on top, a sugar-cube conveyor sliding out the front, a chimney that puffs
    box(g, 1.2, 1.0, 1.0, C.cream);
    cone(g, 0.45, 0.6, C.sky, 0, 1.0, 0, 10).rotation.x = Math.PI;
    cyl(g, 0.12, 0.6, C.pink, 0.4, 1.0, -0.3);
    box(g, 0.5, 0.06, 0.8, C.ink, 0, 0.3, 0.7);
    const cubes = [0, 1, 2].map((i) => box(g, 0.14, 0.14, 0.14, C.sugar, 0, 0.36, 0.4 + i * 0.25));
    const puff = sph(g, 0.15, C.steam, 0.4, 1.7, -0.3);
    anim = (_dt, t, wk) => {
      cubes.forEach((c, i) => (c.position.z = 0.35 + ((t * (wk ? 0.4 * P.spin : 0) + i / 3) % 1) * 0.75));
      const k = (t * 0.8) % 1;
      puff.visible = wk;
      puff.position.y = 1.7 + k * 0.6;
      puff.scale.setScalar(0.5 + k);
    };
  } else {
    // pastel steel grinder with a crank wheel and a steaming chimney, sugar sack under the chute
    box(g, 1.0, 1.1, 0.9, C.sky);
    box(g, 1.04, 0.08, 0.94, shiny(C.chrome), 0, 1.1);
    const wheel = new THREE.Group();
    wheel.position.set(0.55, 0.7, 0);
    g.add(wheel);
    torus(wheel, 0.3, 0.03, shiny(C.chrome)).rotation.set(0, Math.PI / 2, 0);
    for (let i = 0; i < 4; i++) box(wheel, 0.03, 0.6, 0.03, shiny(C.chrome)).rotation.x = (i / 4) * Math.PI;
    cyl(g, 0.1, 0.7, shiny(C.chrome), -0.3, 1.18, -0.2);
    cyl(g, 0.22, 0.4, C.cream, 0, 0, 0.6, 0.26);
    const puff = sph(g, 0.14, C.steam, -0.3, 2.0, -0.2);
    anim = (dt, t, wk) => {
      wheel.rotation.x += dt * (wk ? 4 * P.spin : 0);
      const k = (t * 0.9) % 1;
      puff.visible = wk;
      puff.position.y = 1.95 + k * 0.6;
      puff.scale.setScalar(0.5 + k);
    };
  }
  return { group: g, animate: anim, inputs: { at: slotsLeft(w, d), colour: C.cane }, output: C.sugar };
}

function candyPot(style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  const bubbles: THREE.Mesh[] = [];
  let lid: THREE.Object3D | null = null;
  const dipper = new THREE.Group();
  let potTop = 0;
  if (style === 'A') {
    // copper cauldron over a brick fire ring, an apple on a stick dips in and out
    cyl(g, 0.6, 0.35, C.brick, 0, 0, 0, 0.65);
    cone(g, 0.25, 0.35, C.fire, 0, 0.2, 0, 6);
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, Math.PI / 2.6, Math.PI / 1.6), mat(C.copper, { side: THREE.DoubleSide }));
    put(g, pot, 0, 0.95);
    pot.rotation.x = Math.PI;
    potTop = 0.95;
    cyl(g, 0.5, 0.03, C.candy, 0, potTop - 0.05);
  } else if (style === 'B') {
    // the pot IS a candy apple: glossy red ball with a cut top, a giant stick handle, caramel drips
    sph(g, 0.7, mat(C.candy, { roughness: 0.2 }), 0, 0.7, 0, 3);
    cyl(g, 0.55, 0.05, C.butter, 0, 1.15);
    cyl(g, 0.08, 1.0, C.cream, 0.5, 1.0, 0).rotation.z = -0.5;
    for (let i = 0; i < 5; i++) cyl(g, 0.05, 0.25, C.candy, Math.cos(i * 1.3) * 0.62, 0.9, Math.sin(i * 1.3) * 0.62);
    potTop = 1.18;
  } else {
    // diner kettle on a stove counter: chrome pot, lid that rattles, pressure dial whose needle wiggles
    const top = counter(g, w * 0.8, 0.9, style);
    cyl(g, 0.38, 0.5, shiny(C.chrome), 0, top);
    lid = cyl(g, 0.4, 0.05, shiny(C.chrome), 0, top + 0.5);
    sph(lid, 0.05, C.ink, 0, 0.08, 0);
    const dial = cyl(g, 0.12, 0.03, C.cream, 0.45, top + 0.3, 0.25);
    dial.rotation.x = Math.PI / 2;
    const needle = box(g, 0.015, 0.1, 0.01, C.candy, 0.45, top + 0.3, 0.27);
    needle.userData.needle = true;
    lid.userData.needle = needle;
    potTop = top + 0.5;
  }
  if (style !== 'C')
    for (let i = 0; i < 5; i++) bubbles.push(sph(g, 0.06, mat(C.candy, { roughness: 0.2 }), Math.cos(i * 2) * 0.25, potTop, Math.sin(i * 2) * 0.25, 0));
  sph(dipper, 0.12, C.apple, 0, 0, 0, 2);
  cyl(dipper, 0.015, 0.45, C.cream, 0, 0.05);
  dipper.position.set(0.15, potTop + 0.3, 0);
  g.add(dipper);
  return {
    group: g,
    inputs: { at: slotsLeft(w, d), colour: C.apple },
    output: C.candy,
    animate: (_dt, t, wk) => {
      bubbles.forEach((b, i) => {
        const k = (t * 1.2 * P.bubbles + i / 5) % 1;
        b.visible = wk;
        b.position.y = potTop + k * 0.15;
        b.scale.setScalar(0.4 + k * 0.8 * P.bubbles);
      });
      dipper.position.y = potTop + (wk ? 0.15 + Math.max(0, Math.sin(t * 2)) * 0.35 : 0.5);
      dipper.rotation.y = t * (wk ? 2 : 0);
      if (lid) {
        lid.position.y = potTop + (wk ? Math.abs(Math.sin(t * 18)) * 0.04 * P.shake : 0);
        (lid.userData.needle as THREE.Object3D).rotation.z = wk ? -0.8 + Math.sin(t * 7) * 0.2 : 0.8;
      }
    },
  };
}

function smoothieBlender(style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  let anim: Built['animate'];
  if (style === 'A') {
    // a big wooden-base blender with a glass jug of pink swirling smoothie
    const top = counter(g, w * 0.8, 0.9, style);
    box(g, 0.5, 0.25, 0.5, C.woodDark, 0, top);
    const jug = new THREE.Group();
    jug.position.y = top + 0.25;
    g.add(jug);
    cyl(jug, 0.24, 0.7, clear(C.glass), 0, 0, 0, 0.18);
    const fill = cyl(jug, 0.2, 0.5, C.smoothie, 0, 0.02, 0, 0.16);
    cyl(jug, 0.26, 0.06, C.ink, 0, 0.7);
    anim = (_dt, t, wk) => {
      jug.rotation.z = wk ? Math.sin(t * 33) * 0.05 * P.shake : 0;
      fill.rotation.y = t * (wk ? 12 : 0);
      fill.scale.x = fill.scale.z = 1 + (wk ? Math.sin(t * 20) * 0.04 : 0);
    };
  } else if (style === 'B') {
    // a giant strawberry cup with a whipped-cream top that wobbles and a bendy straw that twirls
    cyl(g, 0.55, 1.1, C.pink, 0, 0, 0, 0.42);
    cyl(g, 0.56, 0.08, C.cream, 0, 1.1);
    const cream = new THREE.Group();
    cream.position.y = 1.18;
    g.add(cream);
    sph(cream, 0.4, C.cream, 0, 0.1, 0, 2);
    sph(cream, 0.25, C.cream, 0, 0.4, 0, 2);
    berryMound(cream, 'A', -0.1, 0, 0.45);
    const straw = new THREE.Group();
    straw.position.set(0.25, 1.2, 0);
    g.add(straw);
    cyl(straw, 0.04, 0.9, C.sky, 0, 0);
    cyl(straw, 0.04, 0.35, C.sky, 0.12, 0.85).rotation.z = -1;
    anim = (dt, t, wk) => {
      cream.scale.set(1 + (wk ? Math.sin(t * 8) * 0.08 * P.shake : 0), 1 - (wk ? Math.sin(t * 8) * 0.08 * P.shake : 0), 1);
      straw.rotation.y += dt * (wk ? 4 * P.spin : 0.2);
    };
  } else {
    // slushie machine: two glass drums of pink and white turning, a tap each
    const top = counter(g, w * 0.85, 0.9, style);
    box(g, 1.1, 0.3, 0.6, C.cream, 0, top);
    const drums: THREE.Object3D[] = [];
    for (const [x, c] of [[-0.27, C.smoothie], [0.27, C.milk]] as const) {
      cyl(g, 0.24, 0.7, clear(C.glass), x, top + 0.3);
      const swirl = new THREE.Group();
      swirl.position.set(x, top + 0.3, 0);
      g.add(swirl);
      cyl(swirl, 0.2, 0.55, c, 0, 0);
      for (let i = 0; i < 3; i++) box(swirl, 0.02, 0.5, 0.42, C.cream, 0, 0.02).rotation.y = (i / 3) * Math.PI;
      drums.push(swirl);
      box(g, 0.08, 0.1, 0.1, shiny(C.chrome), x, top + 0.18, 0.32);
    }
    box(g, 1.1, 0.14, 0.6, C.pink, 0, top + 1.0);
    anim = (dt, _t, wk) => drums.forEach((dr, i) => (dr.rotation.y += dt * (wk ? 3 * P.spin : 0.3) * (i ? -1 : 1)));
  }
  return { group: g, animate: anim, inputs: { at: slotsLeft(w, d), colour: C.strawberry }, output: C.smoothie };
}

/** Input queue spots on the structure's left, like the Corner Shop's. */
const slotsLeft = (w: number, _d: number) =>
  [0, 1, 2, 3].map((i) => new THREE.Vector3(-w / 2 + 0.25 + (i % 2) * 0.28, 0.02, -0.2 + Math.floor(i / 2) * 0.32));

const BUILDERS: Record<string, (s: Style, w: number, d: number) => Built> = {
  apple_tree: (s, w, d) => fruitTree(s, w, d, C.apple, C.leaf, 1),
  orange_tree: (s, w, d) => fruitTree(s, w, d, C.orange, C.leafDark, 1.15),
  sugar_cane_field: caneField,
  strawberry_patch: strawberryPatch,
  apple_press: applePress,
  squeezer,
  sugar_mill: sugarMill,
  candy_pot: candyPot,
  smoothie_blender: smoothieBlender,
};

// ---------- the showroom

applyCssPalette(document.documentElement);
const stage = new Stage(document.getElementById('scene') as HTMLCanvasElement);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat('#e8dccb'));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
stage.scene.add(floor);

interface Placed {
  id: string;
  root: THREE.Group;
  built: Built;
  centre: THREE.Vector3;
  phase: number;
  regrow: number[];
  outCount: number;
  outItems: THREE.Mesh[];
  inItems: THREE.Mesh[];
  label: HTMLDivElement;
}
let placed: Placed[] = [];
const itemGeo = new THREE.SphereGeometry(ITEM_SIZE * 0.35, 12, 8);
const bottleGeo = new THREE.CylinderGeometry(ITEM_SIZE * 0.18, ITEM_SIZE * 0.22, ITEM_SIZE * 0.8, 10);

function rebuild(): void {
  for (const p of placed) {
    stage.scene.remove(p.root);
    p.label.remove();
  }
  placed = [];
  const rows: string[][] = [
    ['apple_tree', 'orange_tree', 'sugar_cane_field', 'strawberry_patch'],
    ['apple_press', 'squeezer', 'sugar_mill', 'candy_pot', 'smoothie_blender'],
    ['ref_mill', 'ref_oven'],
  ];
  let z = 0;
  for (const row of rows) {
    let x = 0;
    let depth = 0;
    for (const id of row) {
      const [w, d] = id.startsWith('ref_') ? (id === 'ref_mill' ? [2.4, 3.5] : [2.2, 3.3]) : P.footprints[id];
      const root = new THREE.Group();
      root.position.set(x + w / 2, 0, z + d / 2);
      stage.scene.add(root);
      let built: Built;
      if (id.startsWith('ref_')) {
        const v = buildStation(id.slice(4), [-w / 2, -d / 2, w, d], 0);
        root.add(v.root);
        built = { group: v.root, animate: (dt, _t, wk) => v.animate(dt, wk) };
      } else {
        const kind = PRODUCERS.find((p) => p.id === id)!.kind;
        const strip = kind === 'machine' ? 1.1 : 0;
        built = BUILDERS[id](P.style, w, d - strip);
        built.group.position.z = -strip / 2;
        root.add(built.group);
        if (strip) {
          box(root, 1.46, 0.1, 0.99, C.woodDark, 0, 0, d / 2 - strip / 2);
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
      const label = document.createElement('div');
      label.className = 'lbl';
      const meta = PRODUCERS.find((p) => p.id === id);
      label.textContent = meta?.name ?? (id === 'ref_mill' ? 'Mill (Corner Shop, for scale)' : 'Oven (Corner Shop, for scale)');
      label.onclick = () => focusOn(id);
      document.getElementById('labels')!.append(label);
      placed.push({
        id, root, built, centre: root.position.clone(), phase: Math.random() * 5, regrow: (built.fruits ?? []).map(() => 1),
        outCount: 0, outItems: [], inItems: [], label,
      });
      x += w + 1.5;
      depth = Math.max(depth, d);
    }
    z += depth + 2;
  }
  // output pallet items and input items
  for (const p of placed) {
    if (!p.built.output) continue;
    const [, d] = P.footprints[p.id];
    const bottle = p.built.output === C.appleJuice || p.built.output === C.orangeJuice || p.built.output === C.smoothie;
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(bottle ? bottleGeo : itemGeo, mat(p.built.output));
      const row = i < 3 ? 0 : i < 5 ? 1 : 2;
      const k = i < 3 ? i - 1 : i < 5 ? i - 3.5 : 0;
      m.position.set(k * 0.42, 0.1 + ITEM_SIZE * (0.35 + row * 0.5), d / 2 - 0.55);
      m.castShadow = true;
      m.visible = false;
      p.root.add(m);
      p.outItems.push(m);
    }
    for (const at of p.built.inputs?.at ?? []) {
      const m = new THREE.Mesh(itemGeo, mat(p.built.inputs!.colour));
      m.position.copy(at).add(new THREE.Vector3(0, ITEM_SIZE * 0.35, -0.55));
      m.castShadow = true;
      p.root.add(m);
      p.inItems.push(m);
    }
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
    stage.zoomTo(innerWidth < innerHeight ? 28 : 20);
  }
  const meta = PRODUCERS.find((q) => q.id === id);
  document.getElementById('cap')!.textContent = meta
    ? `${meta.name} — ${meta.recipe} · footprint ${P.footprints[id].join(' × ')} m`
    : 'All nine — tap a name to look closer';
  for (const q of placed) q.label.classList.toggle('on', q.id === id);
}

// ---------- panel

const gui = new GUI({ title: 'Juice Bar Producers' });
if (innerWidth < 700) gui.close();
gui.add(P, 'style', { 'A — Orchard stand': 'A', 'B — Fruit gadgets': 'B', 'C — Retro juice bar': 'C' }).name('Preset').onChange(() => setStyle(P.style));
gui
  .add(P, 'focus', { Overview: 'overview', ...Object.fromEntries(PRODUCERS.map((p) => [p.name, p.id])), 'Mill (ref)': 'ref_mill', 'Oven (ref)': 'ref_oven' })
  .name('Look at')
  .onChange((v: string) => focusOn(v));
gui.add(P, 'working', ['cycle', 'on', 'off']).name('Working');
gui.add(P, 'harvest').name('Crops harvest');
gui.add(P, 'showItems').name('Show Items');
gui.add(P, 'showFootprints').name('Footprints').onChange(rebuild);
gui.add(P, 'zoom', 4, 14, 0.5).name('Close-up zoom m').onChange(() => focusOn(P.focus));
const look = gui.addFolder('Look');
look.add(P, 'fruitSize', 0.6, 1.8, 0.05).name('Fruit size').onFinishChange(rebuild);
look.add(P, 'treeHeight', 0.6, 1.6, 0.05).name('Tree height').onFinishChange(rebuild);
const motion = gui.addFolder('Motion');
motion.add(P, 'sway', 0, 3, 0.1).name('Sway');
motion.add(P, 'shake', 0, 3, 0.1).name('Shake');
motion.add(P, 'spin', 0, 3, 0.1).name('Spin');
motion.add(P, 'bubbles', 0, 3, 0.1).name('Bubbles');
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

const KEYS: Style[] = ['A', 'B', 'C'];
function setStyle(s: Style): void {
  P.style = s;
  const u = new URL(location.href);
  u.searchParams.set('variant', s);
  history.replaceState(null, '', u);
  document.getElementById('vname')!.textContent = `${s} — ${STYLE_NAMES[s]}`;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  rebuild();
}
const step = (k: number) => setStyle(KEYS[(KEYS.indexOf(P.style) + k + 3) % 3]);
document.getElementById('prev')!.onclick = () => step(-1);
document.getElementById('next')!.onclick = () => step(1);
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
// tap empty floor to go back to the overview
document.getElementById('scene')!.addEventListener('click', () => focusOn('overview'));

setStyle(KEYS.includes(P.style) ? P.style : 'A');

// ---------- loop

const clock = new THREE.Clock();
let t = 0;
const screen = new THREE.Vector2();
function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  for (const p of placed) {
    const wk = P.working === 'on' || (P.working === 'cycle' && (t + p.phase) % 5 < 3.2);
    p.built.animate(dt, t, wk);
    // crops: a fruit is picked every few seconds and regrows
    const fr = p.built.fruits ?? [];
    fr.forEach((f, i) => {
      if (P.harvest && p.regrow[i] >= 1 && Math.random() < dt * 0.12) p.regrow[i] = 0;
      p.regrow[i] = Math.min(1, p.regrow[i] + dt / 6);
      const g = p.regrow[i];
      f.scale.setScalar(g < 1 ? g * 0.9 : 1 + Math.sin(t * 3 + i) * 0.03);
    });
    // machines: Items arrive on the pallet while working
    if (p.outItems.length) {
      if (wk) p.outCount = Math.min(6, p.outCount + dt * 0.6);
      else if (p.outCount >= 6) p.outCount = 0;
      p.outItems.forEach((m, i) => (m.visible = P.showItems && i < Math.floor(p.outCount)));
      p.inItems.forEach((m, i) => (m.visible = P.showItems && (wk ? i < 2 : i < 4)));
    }
    stage.toScreen(p.root.position.clone().add(new THREE.Vector3(0, 2.6, 0)), screen);
    p.label.style.left = `${screen.x}px`;
    p.label.style.top = `${screen.y}px`;
  }
  stage.render(dt);
}
frame();
