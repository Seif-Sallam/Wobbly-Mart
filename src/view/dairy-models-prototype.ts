// PROTOTYPE — throwaway (branch prototype/dairy-models). The Dairy Farm's new Producers, code-built, in the game's
// own camera and light. Three style presets via ?variant=A|B|C, a lil-gui tuning panel and a value dump.
import * as THREE from 'three';
import GUI from 'lil-gui';
import { Stage } from './stage';
import { buildStation } from './stations';
import { loadAssets } from './assets';
import { ITEM_SIZE } from '../../catalog/assets';
import { applyCssPalette } from '../palette';

type Style = 'A' | 'B' | 'C';
const STYLE_NAMES: Record<Style, string> = {
  A: 'Red barn — painted planks, hay & iron',
  B: 'Creamery — white tile, steel & glass',
  C: 'Storybook farm — chunky pastel toys',
};

// prototype-only colours (would move to palette.ts)
const C = {
  barn: '#b8382e', barnDark: '#8a2a22', trim: '#fff6e6', wood: '#c17a43', woodDark: '#8a5530', iron: '#3a3a40',
  hay: '#e8c46a', hayDark: '#c9a043', straw: '#efd58a', grass: '#a3c94a', dirt: '#9c5b3a', stone: '#9a9a96',
  steel: '#c9d2da', tile: '#f4f6f8', blue: '#6fa8dc', glass: '#bfe6f2', rubber: '#4a4f57',
  mint: '#9fe0c9', pink: '#f7a8c4', lilac: '#c7b3f0', sky: '#9ad3ec', peach: '#ffc59a',
  goat: '#f2efe8', goatDark: '#cfc8bb', horn: '#b8a98a', nose: '#e8a0a0', bell: '#e0b030',
  milk: '#ffffff', cream: '#fff1d0', butter: '#ffe39a', foil: '#d9dde2', cheese: '#f5c542', goatCheese: '#f4f1e8',
  ash: '#6b6b6b', teal: '#3aa39a', iceCream: '#f7a8c4', vanilla: '#fff3d6', waffle: '#d99a4e', cherry: '#d63c2f',
  strawberry: '#e0453a', pudding: '#e9c27a', caramel: '#a8601c', egg: '#fff8ea', fire: '#ff7a1a', steam: '#f0f0f0',
  wheat: '#e8c46a', ink: '#3a2416',
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(c: string, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = c + JSON.stringify(extra);
  let m = mats.get(key);
  if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...extra })));
  return m;
}
const shiny = (c: string) => mat(c, { roughness: 0.3, metalness: 0.25 });
const gloss = (c: string) => mat(c, { roughness: 0.3 });
const clear = (c: string, o = 0.45) => mat(c, { transparent: true, opacity: o, roughness: 0.1 });
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
const group = (p: THREE.Object3D, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  return g;
};

const Q = new URLSearchParams(location.search);
/** Tunable numbers; the panel edits these live and "Show values" dumps them. */
const P = {
  style: (Q.get('variant') ?? 'A') as Style,
  focus: Q.get('focus') ?? 'overview',
  working: 'cycle' as 'cycle' | 'on' | 'off',
  showFootprints: true,
  showItems: true,
  zoom: 7,
  goatSize: 1.4,
  goatAccent: (Q.get('accent') ?? 'both') as 'sign' | 'ash' | 'both',
  plunge: 1,
  spin: 1,
  wobble: 1,
  steam: 1,
  hop: 1,
  footprints: {
    goat_pen: [3, 4.1],
    butter_churn: [2, 2.8],
    cheese_press: [2.2, 3.3],
    goat_cheese_press: [2.2, 3.3],
    ice_cream_maker: [2.2, 3.3],
    pudding_pot: [2.2, 3.3],
  } as Record<string, [number, number]>,
};

interface Built {
  group: THREE.Group;
  animate: (dt: number, t: number, working: boolean) => void;
  inputs?: { at: THREE.Vector3[]; colours: string[] };
  output?: string;
}

const PRODUCERS: { id: string; name: string; recipe: string }[] = [
  { id: 'goat_pen', name: 'Goat pen', recipe: 'wheat → goat milk (5.5 s)' },
  { id: 'butter_churn', name: 'Butter churn', recipe: 'milk → butter (4 s)' },
  { id: 'cheese_press', name: 'Cheese press', recipe: 'milk → cheese (5 s)' },
  { id: 'goat_cheese_press', name: 'Goat cheese press', recipe: 'goat milk → goat cheese (5.5 s)' },
  { id: 'ice_cream_maker', name: 'Ice cream maker', recipe: 'milk + strawberry → ice cream (6 s)' },
  { id: 'pudding_pot', name: 'Pudding pot', recipe: 'milk + egg → pudding (6 s)' },
];

/** Input queue spots on the structure's left, like the Corner Shop's. */
const slotsLeft = (w: number) =>
  [0, 1, 2, 3].map((i) => new THREE.Vector3(-w / 2 + 0.25 + (i % 2) * 0.28, 0.02, -0.2 + Math.floor(i / 2) * 0.32));

const ease = (k: number) => k * k * (3 - 2 * k);

// ---------- shared bits

/** Rising steam puffs over a spot; returns the per-frame update. */
function steam(p: THREE.Object3D, x: number, y: number, z: number, n = 4): (t: number, on: boolean) => void {
  const puffs = Array.from({ length: n }, () => sph(p, 0.09, clear(C.steam, 0.7), x, y, z, 1));
  return (t, on) =>
    puffs.forEach((m, i) => {
      const k = (t * 0.6 * P.steam + i / n) % 1;
      m.visible = on && P.steam > 0;
      m.position.set(x + Math.sin(t * 2 + i) * 0.08, y + k * 0.8, z);
      m.scale.setScalar(0.5 + k * 1.6);
    });
}

/** Whey drips falling from a height onto a tray. */
function drips(p: THREE.Object3D, spots: [number, number][], top: number, bottom: number) {
  const d = spots.map(([x, z]) => sph(p, 0.035, clear(C.cream, 0.8), x, top, z, 0));
  return (t: number, on: boolean) =>
    d.forEach((m, i) => {
      const k = (t * 1.4 + i / d.length) % 1;
      m.visible = on;
      m.position.y = top - (top - bottom) * k * k;
    });
}

/** A blocky goat to sit beside the Kenney cow: box body, horns, a beard and a bell. */
function goat(p: THREE.Object3D, style: Style) {
  const s = P.goatSize;
  const root = group(p);
  root.scale.setScalar(s);
  const coat = C.goat;
  const patch = style === 'A' ? C.woodDark : style === 'B' ? C.goatDark : C.lilac;
  box(root, 0.36, 0.34, 0.68, coat, 0, 0.38, 0);
  box(root, 0.3, 0.02, 0.3, patch, 0, 0.72, -0.1);
  for (const [x, z] of [
    [-0.12, -0.25],
    [0.12, -0.25],
    [-0.12, 0.25],
    [0.12, 0.25],
  ])
    box(root, 0.09, 0.38, 0.09, coat, x, 0, z);
  const tail = box(root, 0.06, 0.14, 0.05, coat, 0, 0.68, -0.36);
  const head = group(root, 0, 0.72, 0.36);
  box(head, 0.24, 0.26, 0.3, coat, 0, -0.05, 0.08);
  box(head, 0.14, 0.1, 0.1, C.nose, 0, -0.05, 0.25);
  for (const x of [-0.07, 0.07]) {
    const h = cone(head, 0.035, 0.22, C.horn, x, 0.18, 0, 6);
    h.rotation.x = -0.5;
    const e = box(head, 0.14, 0.05, 0.06, coat, x * 2.4, 0.05, 0);
    e.rotation.z = x > 0 ? -0.4 : 0.4;
    sph(head, 0.025, C.ink, x * 1.3, 0.04, 0.2, 0);
  }
  const beard = cone(head, 0.04, 0.12, C.goatDark, 0, -0.3, 0.18, 6);
  beard.rotation.x = Math.PI;
  const bell = sph(root, 0.06, shiny(C.bell), 0, 0.5, 0.42, 1);
  return { root, head, tail, bell };
}

/** A machine's counter top for the Creamery look; returns its height. */
function counter(g: THREE.Object3D, w: number, d: number): number {
  box(g, w, 0.8, d, C.tile);
  box(g, w + 0.06, 0.06, d + 0.06, shiny(C.steel), 0, 0.8);
  return 0.86;
}

// ---------- the goat pen (Animal)

function goatPen(style: Style, w: number, d: number): Built {
  const g = new THREE.Group();
  const floorC = style === 'A' ? C.straw : style === 'B' ? C.rubber : C.grass;
  box(g, w, 0.04, d, floorC);
  // fence on the back and sides; the front stays open to the pallet
  const rail = style === 'A' ? C.wood : style === 'B' ? C.trim : C.pink;
  const post = style === 'A' ? C.woodDark : style === 'B' ? C.trim : C.mint;
  const posts: [number, number][] = [];
  for (let i = 0; i <= 4; i++) posts.push([-w / 2 + (i / 4) * w, -d / 2]);
  for (let i = 1; i <= 3; i++) posts.push([-w / 2, -d / 2 + (i / 3) * d], [w / 2, -d / 2 + (i / 3) * d]);
  for (const [x, z] of posts) box(g, 0.1, style === 'C' ? 0.75 : 0.85, 0.1, post, x, 0, z);
  for (const y of style === 'C' ? [0.3, 0.55] : [0.35, 0.7]) {
    box(g, w, 0.07, 0.05, rail, 0, y, -d / 2);
    box(g, 0.05, 0.07, d, rail, -w / 2, y, 0);
    box(g, 0.05, 0.07, d, rail, w / 2, y, 0);
  }
  if (style === 'C') for (const [x, z] of posts) cone(g, 0.07, 0.12, C.mint, x, 0.75, z, 4);
  // the goat climbs its prop when working: a hay bale, a steel milking stand, or a rock
  const propX = w * 0.18;
  const propZ = -d * 0.15;
  let propTop: number;
  if (style === 'A') {
    box(g, 0.9, 0.5, 0.6, C.hay, propX, 0.04, propZ);
    for (const x of [-0.25, 0.25]) box(g, 0.04, 0.51, 0.61, C.hayDark, propX + x, 0.04, propZ);
    box(g, 0.7, 0.4, 0.5, C.hay, -w * 0.3, 0.04, -d * 0.35);
    propTop = 0.54;
  } else if (style === 'B') {
    box(g, 0.9, 0.4, 0.6, shiny(C.steel), propX, 0.04, propZ);
    for (const x of [-0.4, 0.4]) box(g, 0.05, 0.6, 0.05, shiny(C.steel), propX + x, 0.44, propZ - 0.28);
    box(g, 0.85, 0.05, 0.05, shiny(C.steel), propX, 1.0, propZ - 0.28);
    cyl(g, 0.12, 0.3, shiny(C.steel), -w * 0.32, 0.04, -d * 0.35, 0.1);
    propTop = 0.44;
  } else {
    sph(g, 0.5, C.stone, propX, 0.15, propZ, 1).scale.set(1, 0.65, 0.9);
    // a little A-frame goat house with a pink roof
    const hut = group(g, -w * 0.28, 0.04, -d * 0.32);
    box(hut, 0.7, 0.5, 0.6, C.peach);
    for (const s of [-1, 1]) {
      const r = box(hut, 0.48, 0.05, 0.7, C.pink, s * 0.18, 0.62, 0);
      r.rotation.z = -s * 0.75;
    }
    box(hut, 0.25, 0.32, 0.02, C.ink, 0, 0, 0.31);
    propTop = 0.47;
  }
  // feed trough at the front-left
  const trough = style === 'B' ? shiny(C.steel) : style === 'A' ? C.woodDark : C.sky;
  box(g, 0.8, 0.22, 0.3, trough, -w * 0.22, 0.04, d * 0.25);
  box(g, 0.7, 0.03, 0.2, C.wheat, -w * 0.22, 0.25, d * 0.25);
  const gt = goat(g, style);
  gt.bell.visible = style !== 'A';
  const ground: THREE.Vector3 = new THREE.Vector3(-w * 0.2, 0.04, d * 0.02);
  const up: THREE.Vector3 = new THREE.Vector3(propX, propTop, propZ);
  let k = 0;
  return {
    group: g,
    inputs: { at: slotsLeft(w).map((v) => v.setZ(v.z + d * 0.32)), colours: [C.wheat] },
    output: C.milk,
    animate: (dt, t, wk) => {
      k = THREE.MathUtils.clamp(k + (wk ? dt : -dt) * 1.6, 0, 1);
      const e = ease(k);
      gt.root.position.lerpVectors(ground, up, e);
      gt.root.position.y += Math.sin(e * Math.PI) * 0.45 * P.hop;
      gt.root.rotation.y = wk ? 0.3 + Math.sin(t * 0.7) * 0.4 : -0.6;
      // chewing on top, grazing at the trough below
      gt.head.rotation.x = wk ? Math.sin(t * 7) * 0.12 : 0.55 + Math.sin(t * 3) * 0.12;
      gt.tail.rotation.x = Math.sin(t * (wk ? 18 : 6)) * 0.4;
      gt.bell.rotation.z = Math.sin(t * 9) * 0.5;
      if (wk) gt.root.position.y += Math.abs(Math.sin(t * 4)) * 0.05 * P.hop;
    },
  };
}

// ---------- machines (structure fills the back; the front strip is the output pallet)

function butterChurn(style: Style, w: number, _d: number): Built {
  const g = new THREE.Group();
  let anim: Built['animate'];
  if (style === 'A') {
    // tall wooden plunger churn with iron hoops on a little barn-red stand; the dasher plunges
    box(g, 1.0, 0.18, 0.9, C.barn);
    const barrel = group(g, 0, 0.18, 0);
    cyl(barrel, 0.32, 0.95, C.wood, 0, 0, 0, 0.4);
    for (const y of [0.12, 0.5, 0.85]) torus(barrel, 0.4 - y * 0.08, 0.025, C.iron, 0, y);
    cyl(barrel, 0.34, 0.06, C.woodDark, 0, 0.95);
    const dasher = group(barrel, 0, 1.0, 0);
    cyl(dasher, 0.035, 0.75, C.woodDark);
    box(dasher, 0.3, 0.05, 0.05, C.woodDark, 0, 0.72);
    cyl(g, 0.22, 0.04, C.trim, 0.65, 0.18, 0.25);
    box(g, 0.18, 0.08, 0.12, C.butter, 0.65, 0.22, 0.25);
    anim = (_dt, t, wk) => {
      dasher.position.y = 1.0 + (wk ? (Math.sin(t * 6 * P.plunge) * 0.5 + 0.5) * 0.3 : 0.25);
      barrel.rotation.z = wk ? Math.sin(t * 12) * 0.02 * P.wobble : 0;
    };
  } else if (style === 'B') {
    // stainless barrel churn on an A-frame, turned by a crank wheel; a glass porthole shows the cream
    const top = 0.25;
    box(g, w * 0.85, top, 1.0, C.tile);
    for (const x of [-0.6, 0.6]) {
      for (const s of [-1, 1]) {
        const leg = box(g, 0.07, 1.1, 0.07, shiny(C.steel), x, top, s * 0.25);
        leg.rotation.x = s * 0.22;
      }
    }
    const drum = group(g, 0, top + 1.0, 0);
    const body = cyl(drum, 0.42, 1.1, shiny(C.steel), 0, -0.55, 0, 0.42, 20);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0, 0);
    const port = cyl(drum, 0.16, 0.03, clear(C.glass, 0.6), 0, 0, 0.42);
    port.rotation.x = Math.PI / 2;
    sph(drum, 0.13, C.cream, 0, 0, 0.38, 1).scale.set(1, 1, 0.3);
    const wheel = group(g, 0.68, top + 1.0, 0);
    torus(wheel, 0.28, 0.03, C.blue).rotation.set(0, Math.PI / 2, 0);
    for (let i = 0; i < 4; i++) {
      const sp = box(wheel, 0.02, 0.56, 0.02, C.blue, 0, -0.28, 0);
      sp.rotation.x = (i * Math.PI) / 4;
      sp.position.y = 0;
    }
    anim = (dt, _t, wk) => {
      const sp = wk ? 4 * P.spin : 0;
      drum.rotation.x += dt * sp;
      wheel.rotation.x += dt * sp;
    };
  } else {
    // a giant stick of butter in foil, a cow-spot bucket under it; the whole stick squashes as the plunger bobs
    const stick = group(g, 0, 0, -0.05);
    box(stick, 0.75, 0.75, 1.2, C.butter);
    box(stick, 0.77, 0.25, 1.22, mat(C.foil, { roughness: 0.3, metalness: 0.5 }), 0, 0);
    box(stick, 0.2, 0.02, 0.2, C.ink, 0.38, 0.4, 0.1).rotation.z = Math.PI / 2;
    const knob = group(stick, 0, 0.75, 0);
    cyl(knob, 0.05, 0.4, C.pink);
    sph(knob, 0.14, C.pink, 0, 0.45, 0, 2);
    const pail = group(g, 0.55, 0, 0.45);
    cyl(pail, 0.2, 0.32, C.trim, 0, 0, 0, 0.16);
    for (const [x, y, z] of [
      [0.15, 0.15, 0.1],
      [-0.12, 0.08, 0.13],
      [0.02, 0.22, -0.18],
    ])
      sph(pail, 0.06, C.ink, x, y, z, 0).scale.set(1, 1, 0.4);
    anim = (_dt, t, wk) => {
      const k = wk ? Math.sin(t * 6 * P.plunge) : 0;
      knob.position.y = 0.75 + (k * 0.5 + 0.5) * 0.25 * (wk ? 1 : 0);
      stick.scale.set(1 + k * 0.05 * P.wobble, 1 - k * 0.06 * P.wobble, 1 + k * 0.05 * P.wobble);
      pail.rotation.z = wk ? Math.sin(t * 9) * 0.06 : 0;
    };
  }
  return { group: g, animate: anim, inputs: { at: slotsLeft(w), colours: [C.milk] }, output: C.butter };
}

/** Cheese and goat cheese share this press; `goatish` adds the goat cheese accent. */
function cheesePress(style: Style, w: number, _d: number, goatish: boolean): Built {
  const g = new THREE.Group();
  const wheel = goatish ? C.goatCheese : C.cheese;
  const showSign = goatish && P.goatAccent !== 'ash';
  const showAsh = goatish && P.goatAccent !== 'sign';
  const band = goatish ? C.teal : C.barn;
  let anim: Built['animate'];
  let dripsOf: ReturnType<typeof drips>;
  if (style === 'A') {
    // timber frame press: a hoop mould on a drip tray, a screw that turns down, a stone weight on a lever
    box(g, 1.3, 0.35, 0.95, C.woodDark);
    box(g, 1.1, 0.06, 0.8, C.wood, 0, 0.35);
    for (const x of [-0.58, 0.58]) box(g, 0.13, 1.75, 0.13, C.barn, x, 0.35);
    box(g, 1.4, 0.16, 0.18, C.barn, 0, 2.05);
    box(g, 1.46, 0.04, 0.2, band, 0, 1.98);
    cyl(g, 0.3, 0.3, C.wood, 0, 0.41);
    for (const y of [0.45, 0.65]) torus(g, 0.31, 0.02, C.iron, 0, y);
    const screw = group(g, 0, 1.2, 0);
    cyl(screw, 0.045, 0.95, C.iron, 0, -0.1);
    box(screw, 0.7, 0.04, 0.04, C.iron, 0, 0.8);
    cyl(screw, 0.28, 0.06, C.wood, 0, -0.14);
    const lever = group(g, 0.58, 1.6, 0);
    box(lever, 0.9, 0.06, 0.06, C.woodDark, 0.45, 0);
    const stone = cyl(lever, 0.12, 0.2, C.stone, 0.85, -0.3, 0);
    stone.scale.set(1, 1, 0.8);
    // finished wheels on a side shelf
    box(g, 0.4, 0.04, 0.4, C.wood, -0.85 + 0.2, 0.9, 0.3);
    const shown = cyl(g, 0.16, 0.12, wheel, -0.65, 0.94, 0.3);
    if (showAsh) cyl(g, 0.165, 0.03, C.ash, -0.65, 1.04, 0.3);
    shown.visible = true;
    dripsOf = drips(g, [[-0.25, 0.2], [0.25, -0.15], [0.05, 0.28]], 0.42, 0.36);
    anim = (dt, t, wk) => {
      screw.rotation.y += dt * (wk ? 2.5 * P.spin : 0);
      screw.position.y += ((wk ? 0.95 : 1.2) - screw.position.y) * Math.min(1, dt * 2);
      lever.rotation.z = wk ? -0.12 + Math.sin(t * 2) * 0.03 : 0.05;
      dripsOf(t, wk);
    };
  } else if (style === 'B') {
    // steel press: a pneumatic ram over a stainless mould on a tiled counter, a glass whey jar fills
    const top = counter(g, w * 0.85, 1.0);
    for (const x of [-0.45, 0.45]) cyl(g, 0.04, 1.1, shiny(C.steel), x, top, -0.25);
    box(g, 1.0, 0.12, 0.25, shiny(C.steel), 0, top + 1.1, -0.25);
    const ram = group(g, 0, top + 1.1, 0);
    cyl(ram, 0.06, 0.6, shiny(C.steel), 0, -0.6);
    cyl(ram, 0.26, 0.05, mat(band), 0, -0.65);
    cyl(g, 0.28, 0.28, shiny(C.steel), 0, top, 0);
    cyl(g, 0.24, 0.02, wheel, 0, top + 0.28, 0);
    const jar = cyl(g, 0.13, 0.4, clear(C.glass), 0.55, top, 0.25);
    const whey = cyl(g, 0.11, 0.01, mat(C.cream), 0.55, top + 0.02, 0.25);
    box(g, 0.5, 0.25, 0.02, mat(band), 0, top - 0.5, 0.51);
    if (showAsh) cyl(g, 0.245, 0.02, C.ash, 0, top + 0.3, 0);
    jar.visible = true;
    dripsOf = drips(g, [[0.2, 0.2]], top + 0.25, top);
    anim = (dt, t, wk) => {
      ram.position.y = top + 1.1 - (wk ? (Math.sin(t * 3 * P.spin) * 0.5 + 0.5) * 0.35 : 0);
      const want = wk ? 30 : 4;
      whey.scale.y += (want - whey.scale.y) * Math.min(1, dt * 0.5);
      whey.position.y = top + 0.02 + (whey.scale.y * 0.01) / 2;
      dripsOf(t, wk);
    };
  } else {
    // a giant cheese wedge with holes; a big screw on top turns and the wedge squashes as it presses
    const body = group(g, 0, 0, -0.05);
    const shape = new THREE.Shape([new THREE.Vector2(-0.7, 0), new THREE.Vector2(0.7, 0), new THREE.Vector2(-0.7, 1.1)]);
    const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false }), mat(wheel));
    wedge.position.set(0, 0, -0.5);
    wedge.castShadow = true;
    body.add(wedge);
    for (const [x, y] of [
      [-0.35, 0.3],
      [0.15, 0.2],
      [-0.5, 0.7],
    ])
      cyl(body, 0.09, 0.02, mat(goatish ? C.goatDark : C.hayDark), x, y, 0.5).rotation.x = Math.PI / 2;
    if (showAsh) box(body, 1.42, 0.06, 1.02, C.ash, 0, 0, 0);
    const screw = group(body, -0.45, 0.95, 0);
    cyl(screw, 0.05, 0.6, C.lilac);
    sph(screw, 0.12, C.pink, 0, 0.62, 0, 1);
    box(screw, 0.5, 0.06, 0.06, C.pink, 0, 0.62);
    if (goatish && showSign) for (const x of [-0.12, 0.12]) cone(body, 0.05, 0.25, C.horn, -0.45 + x, 0.8, -0.2, 6).rotation.z = x * 2;
    dripsOf = drips(g, [[0.6, 0.4]], 0.15, 0.02);
    anim = (dt, t, wk) => {
      const k = wk ? Math.sin(t * 5 * P.spin) : 0;
      screw.rotation.y += dt * (wk ? 3 * P.spin : 0);
      body.scale.set(1 + k * 0.04 * P.wobble, 1 - k * 0.05 * P.wobble, 1);
      dripsOf(t, wk);
    };
  }
  if (showSign) {
    // a little goat-head sign so the twin presses read apart at a glance
    const sign = group(g, 0, style === 'C' ? 1.25 : style === 'A' ? 2.25 : 2.15, style === 'B' ? -0.25 : 0);
    box(sign, 0.42, 0.32, 0.04, C.trim);
    box(sign, 0.18, 0.16, 0.05, C.goat, 0, 0.06);
    for (const x of [-0.06, 0.06]) cone(sign, 0.025, 0.12, C.horn, x, 0.2, 0, 5);
    box(sign, 0.44, 0.03, 0.05, C.teal, 0, -0.01);
  }
  return {
    group: g,
    animate: anim,
    inputs: { at: slotsLeft(w), colours: [C.milk] },
    output: wheel,
  };
}

function iceCreamMaker(style: Style, w: number, _d: number): Built {
  const g = new THREE.Group();
  let anim: Built['animate'];
  if (style === 'A') {
    // hand-crank ice cream bucket: a hooped wooden pail packed with ice around a steel can, a turning crank
    box(g, 1.1, 0.2, 0.9, C.barn);
    cyl(g, 0.4, 0.75, C.wood, 0, 0.2, 0, 0.34);
    for (const y of [0.3, 0.75]) torus(g, 0.38 - (y - 0.2) * 0.07, 0.02, C.iron, 0, y + 0.2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      box(g, 0.1, 0.1, 0.1, clear(C.glass, 0.7), Math.cos(a) * 0.3, 0.92, Math.sin(a) * 0.3).rotation.y = a;
    }
    cyl(g, 0.17, 0.25, shiny(C.steel), 0, 0.85);
    box(g, 0.9, 0.08, 0.12, C.iron, 0, 1.12);
    const crank = group(g, 0.45, 1.16, 0);
    box(crank, 0.04, 0.04, 0.35, C.iron, 0, 0, 0.17);
    cyl(crank, 0.04, 0.18, C.woodDark, 0, 0, 0.34);
    // a salt sack and a finished tub
    sph(g, 0.22, C.trim, -0.6, 0.35, 0.25, 1).scale.set(1, 1.3, 0.9);
    cyl(g, 0.12, 0.14, C.iceCream, 0.6, 0.2, 0.3);
    anim = (dt, _t, wk) => {
      crank.rotation.x += dt * (wk ? 5 * P.spin : 0);
    };
  } else if (style === 'B') {
    // soft-serve machine: steel cabinet, two taps, a pink swirl rising into a cone that slowly turns
    const top = 0.25;
    box(g, w * 0.85, top, 1.0, C.tile);
    box(g, 1.1, 1.3, 0.7, shiny(C.steel), 0, top, -0.15);
    box(g, 1.12, 0.12, 0.72, C.blue, 0, top + 1.3, -0.15);
    for (const x of [-0.25, 0.25]) {
      cyl(g, 0.06, 0.2, shiny(C.steel), x, top + 0.75, 0.25);
      box(g, 0.04, 0.2, 0.04, C.ink, x, top + 0.95, 0.27);
    }
    const cup = group(g, 0.25, top + 0.25, 0.25);
    const c = cone(cup, 0.1, 0.3, C.waffle, 0, 0, 0, 10);
    c.rotation.x = Math.PI;
    c.position.y = 0.15;
    const swirl: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) swirl.push(torus(cup, 0.09 - i * 0.018, 0.045, gloss(C.iceCream), 0, 0.32 + i * 0.07));
    box(g, 0.5, 0.06, 0.3, shiny(C.steel), 0.25, top, 0.25);
    let fill = 0;
    anim = (dt, t, wk) => {
      fill = wk ? Math.min(1, fill + dt * 0.4) : fill >= 1 ? 0 : fill;
      swirl.forEach((s, i) => (s.visible = fill * swirl.length > i));
      cup.rotation.y = t * (wk ? 2 * P.spin : 0.3);
    };
  } else {
    // a giant cone kiosk: waffle cone, three scoops and a cherry; scoops bob and twist while it works
    const k = group(g, 0, 0, -0.05);
    cyl(k, 0.55, 0.15, C.mint);
    const c = cone(k, 0.42, 1.0, C.waffle, 0, 0.15, 0, 14);
    c.rotation.x = Math.PI;
    c.position.y = 0.65;
    const scoops = [C.iceCream, C.vanilla, C.strawberry].map((col, i) =>
      sph(k, 0.38 - i * 0.05, gloss(col), Math.sin(i * 2) * 0.05, 1.25 + i * 0.4, 0, 2),
    );
    const cherry = sph(k, 0.09, gloss(C.cherry), 0, 2.32, 0, 2);
    for (let i = 0; i < 10; i++)
      box(k, 0.05, 0.015, 0.015, [C.sky, C.lilac, C.mint][i % 3], Math.cos(i) * 0.3, 1.45 + (i % 4) * 0.2, Math.sin(i) * 0.3).rotation.y = i;
    anim = (_dt, t, wk) => {
      scoops.forEach((s, i) => {
        s.position.y = 1.25 + i * 0.4 + (wk ? Math.abs(Math.sin(t * 4 + i)) * 0.06 * P.wobble : 0);
        s.rotation.y = wk ? Math.sin(t * 2 + i) * 0.5 * P.spin : 0;
      });
      cherry.position.y = 2.32 + (wk ? Math.abs(Math.sin(t * 4 + 3)) * 0.12 * P.wobble : 0);
    };
  }
  return {
    group: g,
    animate: anim,
    inputs: { at: slotsLeft(w), colours: [C.milk, C.strawberry] },
    output: C.iceCream,
  };
}

function puddingPot(style: Style, w: number, _d: number): Built {
  const g = new THREE.Group();
  let anim: Built['animate'];
  if (style === 'A') {
    // copper pot on a cast-iron stove with a stovepipe; a wooden spoon stirs, steam curls up
    box(g, 1.1, 0.75, 0.8, C.iron);
    box(g, 0.4, 0.3, 0.02, C.ink, 0, 0.15, 0.41);
    box(g, 0.3, 0.06, 0.03, C.fire, 0, 0.2, 0.42);
    cyl(g, 0.08, 1.2, C.iron, -0.4, 0.75, -0.3);
    cyl(g, 0.35, 0.4, mat(C.wood, { color: '#c46a3a', roughness: 0.4, metalness: 0.4 }), 0.1, 0.75, 0);
    cyl(g, 0.32, 0.02, C.pudding, 0.1, 1.12, 0);
    const spoon = group(g, 0.1, 1.15, 0);
    const handle = cyl(spoon, 0.025, 0.6, C.wood, 0.15, -0.1, 0);
    handle.rotation.z = -0.35;
    const puff = steam(g, 0.1, 1.2, 0);
    anim = (_dt, t, wk) => {
      spoon.rotation.y = wk ? t * 3 * P.spin : 0;
      puff(t, wk);
    };
  } else if (style === 'B') {
    // tilting steam kettle on legs: a whisk spins inside, it tips forward now and then to pour
    const top = 0.25;
    box(g, w * 0.85, top, 1.0, C.tile);
    for (const x of [-0.5, 0.5]) box(g, 0.08, 0.7, 0.08, shiny(C.steel), x, top, 0);
    const kettle = group(g, 0, top + 0.75, 0);
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      mat(C.steel, { roughness: 0.25, metalness: 0.6, side: THREE.DoubleSide }),
    );
    put(kettle, bowl, 0, 0.1);
    cyl(kettle, 0.42, 0.02, C.pudding, 0, -0.02);
    box(kettle, 1.0, 0.06, 0.06, shiny(C.steel), 0, 0.05);
    const whisk = group(kettle, 0, 0, 0);
    cyl(whisk, 0.02, 0.5, C.ink, 0, 0);
    for (let i = 0; i < 3; i++) torus(whisk, 0.07, 0.008, shiny(C.steel), 0, 0.02).rotation.set(0, (i * Math.PI) / 3, 0);
    const puff = steam(g, 0, top + 1.0, 0);
    anim = (_dt, t, wk) => {
      whisk.rotation.y = wk ? t * 8 * P.spin : 0;
      kettle.rotation.x = wk ? Math.max(0, Math.sin(t * 0.8)) * 0.35 : 0;
      puff(t, wk);
    };
  } else {
    // a giant wobbly pudding on a plate: caramel top, a cherry, a spoon bouncing; it jiggles while working
    cyl(g, 0.65, 0.06, C.trim);
    const jelly = group(g, 0, 0.06, 0);
    cyl(jelly, 0.38, 0.75, gloss(C.pudding), 0, 0, 0, 0.5, 20);
    cyl(jelly, 0.39, 0.12, gloss(C.caramel), 0, 0.72);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cyl(jelly, 0.04, 0.18, gloss(C.caramel), Math.cos(a) * 0.4, 0.58, Math.sin(a) * 0.4);
    }
    sph(jelly, 0.09, gloss(C.cherry), 0, 0.9, 0, 2);
    const spoon = group(g, 0.55, 0.1, 0.3);
    sph(spoon, 0.1, shiny(C.steel), 0, 0, 0, 1).scale.set(1, 0.4, 1.3);
    box(spoon, 0.04, 0.03, 0.45, shiny(C.steel), 0, 0, -0.3);
    anim = (_dt, t, wk) => {
      const k = wk ? Math.sin(t * 11) * 0.07 * P.wobble : Math.sin(t * 2) * 0.01;
      jelly.scale.set(1 + k, 1 - k, 1 + k);
      jelly.rotation.z = wk ? Math.sin(t * 7) * 0.05 * P.wobble : 0;
      spoon.position.y = 0.1 + (wk ? Math.abs(Math.sin(t * 5)) * 0.25 : 0);
    };
  }
  return {
    group: g,
    animate: anim,
    inputs: { at: slotsLeft(w), colours: [C.milk, C.egg] },
    output: C.pudding,
  };
}

const BUILDERS: Record<string, (s: Style, w: number, d: number) => Built> = {
  goat_pen: goatPen,
  butter_churn: butterChurn,
  cheese_press: (s, w, d) => cheesePress(s, w, d, false),
  goat_cheese_press: (s, w, d) => cheesePress(s, w, d, true),
  ice_cream_maker: iceCreamMaker,
  pudding_pot: puddingPot,
};

// ---------- the showroom

applyCssPalette(document.documentElement);
await loadAssets(() => {});
const stage = new Stage(document.getElementById('scene') as HTMLCanvasElement);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat('#e8dccb'));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
stage.scene.add(floor);

const REFS: Record<string, { name: string; size: [number, number]; label: string }> = {
  ref_cow: { name: 'cow-pen', size: [3, 4.1], label: 'Cow pen (Corner Shop, for scale)' },
  ref_mill: { name: 'mill', size: [2.4, 3.5], label: 'Mill (Corner Shop, for scale)' },
};

interface Placed {
  id: string;
  root: THREE.Group;
  built: Built;
  centre: THREE.Vector3;
  phase: number;
  outCount: number;
  outItems: THREE.Mesh[];
  inItems: THREE.Mesh[];
  label: HTMLDivElement;
}
let placed: Placed[] = [];
const itemGeo = new THREE.SphereGeometry(ITEM_SIZE * 0.35, 12, 8);
const blockGeo = new THREE.BoxGeometry(ITEM_SIZE * 0.6, ITEM_SIZE * 0.4, ITEM_SIZE * 0.6);

function rebuild(): void {
  for (const p of placed) {
    stage.scene.remove(p.root);
    p.label.remove();
  }
  placed = [];
  const rows: string[][] = [
    ['goat_pen', 'ref_cow', 'butter_churn', 'ice_cream_maker'],
    ['cheese_press', 'goat_cheese_press', 'pudding_pot', 'ref_mill'],
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
      let built: Built;
      if (ref) {
        const v = buildStation(ref.name, [-w / 2, -d / 2, w, d], 0);
        root.add(v.root);
        built = { group: v.root, animate: (dt, _t, wk) => v.animate(dt, wk) };
      } else {
        const strip = 1.1;
        built = BUILDERS[id](P.style, w, d - strip);
        built.group.position.z = -strip / 2;
        root.add(built.group);
        box(root, 1.46, 0.1, 0.99, C.woodDark, 0, 0, d / 2 - strip / 2);
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
      label.textContent = PRODUCERS.find((p) => p.id === id)?.name ?? ref?.label ?? id;
      label.onclick = (e) => (e.stopPropagation(), focusOn(id));
      document.getElementById('labels')!.append(label);
      placed.push({
        id, root, built, centre: root.position.clone(), phase: Math.random() * 5,
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
    const blocky = p.id !== 'goat_pen';
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(blocky ? blockGeo : itemGeo, mat(p.built.output));
      const row = i < 3 ? 0 : i < 5 ? 1 : 2;
      const k = i < 3 ? i - 1 : i < 5 ? i - 3.5 : 0;
      m.position.set(k * 0.42, 0.1 + ITEM_SIZE * (0.35 + row * 0.5), d / 2 - 0.55);
      m.castShadow = true;
      m.visible = false;
      p.root.add(m);
      p.outItems.push(m);
    }
    const ins = p.built.inputs;
    ins?.at.forEach((at, i) => {
      const m = new THREE.Mesh(itemGeo, mat(ins.colours[i % ins.colours.length]));
      m.position.copy(at).add(new THREE.Vector3(0, ITEM_SIZE * 0.35, -0.55));
      m.castShadow = true;
      p.root.add(m);
      p.inItems.push(m);
    });
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
    stage.zoomTo(innerWidth < innerHeight ? 26 : 18);
  }
  const meta = PRODUCERS.find((q) => q.id === id);
  document.getElementById('cap')!.textContent = meta
    ? `${meta.name} — ${meta.recipe} · footprint ${P.footprints[id].join(' × ')} m`
    : 'All six — tap a name to look closer';
  for (const q of placed) q.label.classList.toggle('on', q.id === id);
}

// ---------- panel

const gui = new GUI({ title: 'Dairy Farm Producers' });
if (innerWidth < 700) gui.close();
gui
  .add(P, 'style', { 'A — Red barn': 'A', 'B — Creamery': 'B', 'C — Storybook farm': 'C' })
  .name('Preset')
  .onChange(() => setStyle(P.style));
gui
  .add(P, 'focus', {
    Overview: 'overview',
    ...Object.fromEntries(PRODUCERS.map((p) => [p.name, p.id])),
    'Cow pen (ref)': 'ref_cow',
    'Mill (ref)': 'ref_mill',
  })
  .name('Look at')
  .onChange((v: string) => focusOn(v));
gui.add(P, 'working', ['cycle', 'on', 'off']).name('Working');
gui.add(P, 'showItems').name('Show Items');
gui.add(P, 'showFootprints').name('Footprints').onChange(rebuild);
gui.add(P, 'zoom', 4, 14, 0.5).name('Close-up zoom m').onChange(() => focusOn(P.focus));
const look = gui.addFolder('Look');
look
  .add(P, 'goatAccent', { 'Goat-head sign': 'sign', 'Ash-grey rind': 'ash', 'Sign + ash rind': 'both' })
  .name('Goat cheese accent')
  .onChange(rebuild);
look.add(P, 'goatSize', 0.6, 1.6, 0.05).name('Goat size').onFinishChange(rebuild);
const motion = gui.addFolder('Motion');
motion.add(P, 'plunge', 0, 3, 0.1).name('Churn plunge');
motion.add(P, 'spin', 0, 3, 0.1).name('Spin / crank');
motion.add(P, 'wobble', 0, 3, 0.1).name('Wobble / jiggle');
motion.add(P, 'steam', 0, 3, 0.1).name('Steam');
motion.add(P, 'hop', 0, 3, 0.1).name('Goat hop');
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
const stepStyle = (k: number) => setStyle(KEYS[(KEYS.indexOf(P.style) + k + 3) % 3]);
document.getElementById('prev')!.onclick = () => stepStyle(-1);
document.getElementById('next')!.onclick = () => stepStyle(1);
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') stepStyle(-1);
  if (e.key === 'ArrowRight') stepStyle(1);
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
    const wk = P.working === 'on' || (P.working === 'cycle' && (t + p.phase) % 6 < 3.8);
    p.built.animate(dt, t, wk);
    // Items arrive on the pallet while working
    if (p.outItems.length) {
      if (wk) p.outCount = Math.min(6, p.outCount + dt * 0.6);
      else if (p.outCount >= 6) p.outCount = 0;
      p.outItems.forEach((m, i) => (m.visible = P.showItems && i < Math.floor(p.outCount)));
      p.inItems.forEach((m, i) => (m.visible = P.showItems && (wk ? i < 2 : i < 4)));
    }
    stage.toScreen(p.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), screen);
    p.label.style.left = `${screen.x}px`;
    p.label.style.top = `${screen.y}px`;
  }
  stage.render(dt);
}
frame();
