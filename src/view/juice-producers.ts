// PROTOTYPE — the Juice Bar's Producers, code-built (preset A is the pick). Shared by the showroom and the game.
import * as THREE from 'three';

export type Style = 'A' | 'B' | 'C';
export const STYLE_NAMES: Record<Style, string> = {
  A: 'Orchard stand — rustic wood & copper',
  B: 'Fruit gadgets — giant fruit-shaped toys',
  C: 'Retro juice bar — pastel chrome & glass',
};

// prototype-only colours (would move to palette.ts)
export const C = {
  apple: '#d63c2f', appleLight: '#e86a4a', orange: '#f28a1d', leaf: '#5e9e3a', leafDark: '#3f7a2a', leafLight: '#8bc34a',
  trunk: '#7a4a2a', wood: '#c17a43', woodDark: '#8a5530', copper: '#c46a3a', brick: '#a8553a', iron: '#3a3a40',
  cane: '#9ccc4a', caneNode: '#6f9a2e', straw: '#e8c46a', dirt: '#9c5b3a', dirtDark: '#7a4530', strawberry: '#e0453a',
  seed: '#ffe066', cream: '#fff1d0', ink: '#3a2416', chrome: '#c9d2da', mint: '#9fe0c9', pink: '#f7a8c4', sky: '#9ad3ec',
  butter: '#ffe39a', glass: '#bfe6f2', appleJuice: '#e8d24a', orangeJuice: '#f5a623', sugar: '#ffffff', candy: '#b3261e',
  smoothie: '#e86aa6', milk: '#ffffff', terracotta: '#d0784a', fire: '#ff7a1a', steam: '#f0f0f0', grass: '#a3c94a',
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
export function mat(c: string, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
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
export const box = (p: THREE.Object3D, w: number, h: number, d: number, c: string | THREE.Material, x = 0, y = 0, z = 0) =>
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
export const P = {
  style: (new URLSearchParams(location.search).get('variant') ?? 'A') as Style,
  focus: new URLSearchParams(location.search).get('focus') ?? 'overview',
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
  berryLook: (new URLSearchParams(location.search).get('berry') ?? 'rows') as 'rows' | 'barrels' | 'pyramid',
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

export interface Built {
  group: THREE.Group;
  animate: (dt: number, t: number, working: boolean) => void;
  fruits?: THREE.Object3D[];
  /** In the game, the Crop's output Item is drawn this much bigger at each plant spot. */
  plantScale?: number;
  inputs?: { at: THREE.Vector3[]; colour: string };
  output?: string;
}

export const PRODUCERS: { id: string; name: string; kind: 'crop' | 'machine'; recipe: string }[] = [
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
  const clumps: THREE.Group[] = [];
  const clump = (x: number, z: number, n: number, hgt: number) => {
    const cg = new THREE.Group();
    cg.position.set(x, 0, z);
    g.add(cg);
    clumps.push(cg);
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
      st.position.set(Math.cos(i * 2.4) * 0.12, 0, Math.sin(i * 2.4) * 0.12);
      cg.add(st);
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
      clumps[clumps.length - 1].position.y = 0.48;
      void before;
    }
  }
  return {
    group: g,
    // each clump is one plant: in the game it is drawn as a growing cane bundle, small after a harvest
    fruits: clumps.slice(0, 6),
    plantScale: 2.2,
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

/** A readable strawberry: a fat red cone pointing down, yellow seeds, a green star cap and a stalk. */
function berry(size: number): THREE.Group {
  const b = new THREE.Group();
  const r = size * P.fruitSize;
  const body = cone(b, r, r * 1.5, C.strawberry, 0, -r * 1.5, 0, 10);
  body.rotation.x = Math.PI;
  body.position.y = -r * 0.75;
  sph(b, r * 0.98, C.strawberry, 0, -r * 0.05, 0, 1).scale.y = 0.55;
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4;
    const k = (i % 3) / 3;
    sph(b, r * 0.09, C.seed, Math.cos(a) * r * (0.85 - k * 0.4), -r * (0.2 + k * 0.7), Math.sin(a) * r * (0.85 - k * 0.4), 0);
  }
  for (let i = 0; i < 5; i++) {
    const l = box(b, r * 0.9, r * 0.08, r * 0.3, C.leafDark, 0, r * 0.2, 0);
    l.geometry.translate(r * 0.45, 0, 0);
    l.rotation.set(0, (i / 5) * Math.PI * 2, -0.25);
  }
  cyl(b, r * 0.08, r * 0.5, C.leafDark, 0, r * 0.2, 0);
  return b;
}

/** Flat rosette of leaves with a white flower; its berries lie outside the leaves where the camera sees them. */
function rosette(p: THREE.Object3D, x: number, z: number, y: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  for (let i = 0; i < 6; i++) {
    const l = box(g, 0.34, 0.035, 0.2, i % 2 ? C.leaf : C.leafDark, 0, 0.05 + (i % 2) * 0.03, 0);
    l.geometry.translate(0.17, 0, 0);
    l.rotation.set(0, (i / 6) * Math.PI * 2, 0.35);
  }
  for (let i = 0; i < 5; i++) sph(g, 0.03, C.cream, 0.05 + Math.cos(i * 1.26) * 0.05, 0.18, Math.sin(i * 1.26) * 0.05, 0);
  sph(g, 0.025, C.seed, 0.05, 0.2, 0, 0);
  return g;
}

/** A berry resting on top of a rosette's leaves, a little off centre, tipped over. */
function onLeaves(g: THREE.Object3D, plant: THREE.Group, i: number): THREE.Group {
  const b = berry(0.15);
  const a = 0.8 + i * 2.1;
  b.position.set(plant.position.x + Math.cos(a) * 0.12, plant.position.y + 0.27, plant.position.z + Math.abs(Math.sin(a)) * 0.12);
  b.rotation.set(0.5, a, 0.6);
  g.add(b);
  return b;
}

function strawberryPatch(_style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  const fruits: THREE.Object3D[] = [];
  const sway: THREE.Object3D[] = [];
  const look = P.berryLook;
  if (look === 'rows') {
    // A: straw-mulched raised bed, low leaf rosettes, fat berries lying on the straw in front of each plant
    const len = w * 0.9;
    const dep = Math.min(d * 0.55, 1.2);
    box(g, len, 0.22, dep, C.straw);
    for (const z of [-1, 1]) box(g, len + 0.16, 0.32, 0.08, C.wood, 0, 0, (z * (dep + 0.08)) / 2);
    for (const x of [-1, 1]) box(g, 0.08, 0.32, dep, C.wood, (x * (len + 0.08)) / 2, 0, 0);
    for (let i = 0; i < 6; i++) {
      const x = (i / 5 - 0.5) * (len - 0.5);
      const z = i % 2 ? 0.18 : -0.18;
      const plant = rosette(g, x, z, 0.22);
      sway.push(plant);
      fruits.push(onLeaves(g, plant, i));
    }
  } else if (look === 'barrels') {
    // half-barrel planters in a row, berries spilling over the rims on their stalks
    const n = 3;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * (w - 1);
      cyl(g, 0.45, 0.5, C.wood, x, 0, 0, 0.4);
      for (const y of [0.1, 0.4]) torus(g, 0.43 + y * 0.1, 0.025, C.iron, x, y);
      cyl(g, 0.42, 0.04, C.dirt, x, 0.48);
      const plant = rosette(g, x, 0, 0.5);
      sway.push(plant);
      for (const k of [0, 1]) fruits.push(onLeaves(g, plant, i * 2 + k));
    }
  } else {
    // stepped wooden pyramid: plants on each tier, berries dangling over every edge
    for (let k = 0; k < 3; k++) {
      const s = 1.6 - k * 0.5;
      box(g, s * (w / 2.4), 0.3, s, C.wood, 0, k * 0.3, 0);
      box(g, s * (w / 2.4) - 0.1, 0.04, s - 0.1, C.dirt, 0, k * 0.3 + 0.3, 0);
    }
    const tiers: [number, number, number][] = [
      [-0.55, 0.3, 0.62], [0.55, 0.3, 0.62], [0, 0.3, 0.7], [-0.35, 0.6, 0.38], [0.35, 0.6, 0.38], [0, 0.9, 0.12],
    ];
    for (const [x, y, z] of tiers) {
      const plant = rosette(g, x * (w / 2.4), z - 0.15, y + 0.04);
      sway.push(plant);
      fruits.push(onLeaves(g, plant, fruits.length));
    }
  }
  return {
    group: g,
    fruits,
    animate: (_dt, t) => {
      sway.forEach((s, i) => (s.rotation.y = Math.sin(t * 1.5 + i) * 0.12 * P.sway));
      fruits.forEach((f, i) => (f.rotation.x = Math.sin(t * 2 + i) * 0.1 * P.sway));
    },
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
  return { group: g, animate: anim, inputs: { at: frontLeft(w, d), colour: C.apple }, output: C.appleJuice };
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
  return { group: g, animate: anim, inputs: { at: style === 'A' ? onCounter(w, 0.91) : slotsLeft(w, d), colour: C.orange }, output: C.orangeJuice };
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
  return { group: g, animate: anim, inputs: { at: frontLeft(w, d), colour: C.cane }, output: C.sugar };
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
    // open pot: tapered copper body, a rolled rim, two handles
    cyl(g, 0.5, 0.55, C.copper, 0, 0.35, 0, 0.36);
    torus(g, 0.5, 0.05, C.copper, 0, 0.9);
    for (const k of [-1, 1]) torus(g, 0.09, 0.025, C.iron, k * 0.56, 0.75).rotation.set(0, Math.PI / 2, 0);
    potTop = 0.9;
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
    inputs: { at: frontLeft(w, d), colour: C.apple },
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
  return { group: g, animate: anim, inputs: { at: style === 'A' ? onCounter(w, 0.91) : slotsLeft(w, d), colour: C.strawberry }, output: C.smoothie };
}

/** Input spots on a counter top's left end (x from the left edge), visible from the camera. */
const onCounter = (w: number, top: number) =>
  [0, 1, 2, 3].map((i) => new THREE.Vector3(-w * 0.4 + 0.22 + (i % 2) * 0.26, top, -0.14 + Math.floor(i / 2) * 0.28));
/** Input spots on the floor at the structure's front-left corner, clear of its body. */
const frontLeft = (w: number, d: number) =>
  [0, 1, 2, 3].map((i) => new THREE.Vector3(-w / 2 + 0.25 + (i % 2) * 0.28, 0.02, d / 2 - 0.45 + Math.floor(i / 2) * 0.28));
/** Input queue spots on the structure's left, like the Corner Shop's. */
const slotsLeft = (w: number, _d: number) =>
  [0, 1, 2, 3].map((i) => new THREE.Vector3(-w / 2 + 0.25 + (i % 2) * 0.28, 0.02, -0.2 + Math.floor(i / 2) * 0.32));

export const BUILDERS: Record<string, (s: Style, w: number, d: number) => Built> = {
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

