// PROTOTYPE — throwaway (branch prototype/dairy-models). The Dairy Farm's new Producers in the owner's pick, preset B
// "Creamery" (white tile, steel & glass), in the game's own camera and light; a lil-gui panel and a value dump.
import * as THREE from 'three';
import GUI from 'lil-gui';
import { Stage } from './stage';
import { buildStation } from './stations';
import { loadAssets } from './assets';
import { ITEM_SIZE } from '../../catalog/assets';
import { applyCssPalette } from '../palette';

type IceLook = 'softServe' | 'gelato';
const ICE_NAMES: Record<IceLook, string> = {
  softServe: 'Ice cream maker: soft-serve machine',
  gelato: 'Ice cream maker: gelato counter',
};

// prototype-only colours (would move to palette.ts)
const C = {
  trim: '#fff6e6', iron: '#3a3a40', hay: '#e8c46a', stone: '#9a9a96',
  steel: '#c9d2da', steelDark: '#9aa5ae', tile: '#f4f6f8', blue: '#6fa8dc', glass: '#bfe6f2', rubber: '#4a4f57',
  pink: '#f7a8c4', lilac: '#c7b3f0', goat: '#f2efe8', goatDark: '#cfc8bb', horn: '#b8a98a', nose: '#e8a0a0',
  bell: '#e0b030', milk: '#ffffff', cream: '#fff1d0', butter: '#ffe39a', foil: '#d9dde2', cheese: '#f5c542',
  cheeseRind: '#e0a92e', goatCheese: '#f4f1e8', ash: '#6b6b6b', teal: '#3aa39a', iceCream: '#f7a8c4',
  vanilla: '#fff3d6', waffle: '#d99a4e', cherry: '#d63c2f', strawberry: '#e0453a', pudding: '#e9c27a',
  caramel: '#a8601c', egg: '#fff8ea', steam: '#f0f0f0', wheat: '#e8c46a', ink: '#3a2416',
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
  iceLook: (Q.get('ice') ?? 'softServe') as IceLook,
  focus: Q.get('focus') ?? 'overview',
  working: 'cycle' as 'cycle' | 'on' | 'off',
  showFootprints: true,
  showItems: true,
  zoom: 7,
  goatSize: 1.4,
  goatAccent: (Q.get('accent') ?? 'both') as 'sign' | 'ash' | 'both',
  spin: 1,
  steam: 1,
  footprints: {
    goat_pen: [3, 4.1],
    butter_churn: [2, 2.8],
    cheese_press: [2.2, 3.3],
    goat_cheese_press: [2.2, 3.3],
    ice_cream_maker: [2.2, 3.3],
    pudding_pot: [2.2, 3.3],
  } as Record<string, [number, number]>,
};

type ItemKind = 'goatMilk' | 'butter' | 'cheese' | 'goatCheese' | 'iceCream' | 'pudding';

interface Built {
  group: THREE.Group;
  animate: (dt: number, t: number, working: boolean) => void;
  output: ItemKind;
  /** Where input Items sit (the game's input tray: one column of 3 painted spots per Recipe input). */
  inputs: { at: THREE.Vector3; colour: string }[];
}

const PRODUCERS: { id: string; name: string; recipe: string }[] = [
  { id: 'goat_pen', name: 'Goat pen', recipe: 'wheat → goat milk (5.5 s)' },
  { id: 'butter_churn', name: 'Butter churn', recipe: 'milk → butter (4 s)' },
  { id: 'cheese_press', name: 'Cheese press', recipe: 'milk → cheese (5 s)' },
  { id: 'goat_cheese_press', name: 'Goat cheese press', recipe: 'goat milk → goat cheese (5.5 s)' },
  { id: 'ice_cream_maker', name: 'Ice cream maker', recipe: 'milk + strawberry → ice cream (6 s)' },
  { id: 'pudding_pot', name: 'Pudding pot', recipe: 'milk + egg → pudding (6 s)' },
];

// ---------- Items (outputs on the pallet, inputs on the tray)

const IS = ITEM_SIZE / 0.544;
function item(kind: ItemKind | 'milk' | 'wheat' | 'strawberry' | 'egg'): THREE.Group {
  const g = new THREE.Group();
  g.scale.setScalar(IS);
  switch (kind) {
    case 'goatMilk':
    case 'milk':
      // a squat glass bottle; goat milk gets a lilac cap
      cyl(g, 0.09, 0.24, C.milk, 0, 0, 0, 0.1);
      cyl(g, 0.05, 0.06, C.milk, 0, 0.24);
      cyl(g, 0.055, 0.03, kind === 'goatMilk' ? C.lilac : C.blue, 0, 0.3);
      break;
    case 'butter':
      // a long flat brick, half wrapped in foil
      box(g, 0.42, 0.12, 0.2, C.butter);
      box(g, 0.2, 0.125, 0.205, mat(C.foil, { roughness: 0.35, metalness: 0.4 }), 0.11);
      break;
    case 'cheese':
      // a round wheel with a darker rind edge
      cyl(g, 0.2, 0.12, C.cheeseRind, 0, 0, 0, 0.2, 20);
      cyl(g, 0.185, 0.005, C.cheese, 0, 0.12, 0, 0.185, 20);
      break;
    case 'goatCheese':
      box(g, 0.24, 0.16, 0.24, C.goatCheese);
      break;
    case 'iceCream':
      // a tub with a scoop domed on top
      cyl(g, 0.14, 0.15, C.pink, 0, 0, 0, 0.11, 16);
      sph(g, 0.13, gloss(C.vanilla), 0, 0.16, 0, 2).scale.set(1, 0.7, 1);
      sph(g, 0.03, gloss(C.cherry), 0, 0.26, 0, 1);
      break;
    case 'pudding':
      // a white ramekin cup, pudding inside with a caramel pool
      cyl(g, 0.13, 0.17, C.tile, 0, 0, 0, 0.1, 18);
      cyl(g, 0.12, 0.01, gloss(C.pudding), 0, 0.165, 0, 0.12, 18);
      cyl(g, 0.07, 0.012, gloss(C.caramel), 0, 0.17, 0, 0.07, 14);
      break;
    case 'wheat':
      cyl(g, 0.08, 0.28, C.wheat, 0, 0, 0, 0.06, 8);
      torus(g, 0.075, 0.015, C.hay, 0, 0.12);
      break;
    case 'strawberry':
      sph(g, 0.11, gloss(C.strawberry), 0, 0.11, 0, 1).scale.set(1, 1.15, 1);
      break;
    case 'egg':
      sph(g, 0.09, C.egg, 0, 0.11, 0, 2).scale.set(1, 1.3, 1);
      break;
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}
const INPUT_ITEM: Record<string, Parameters<typeof item>[0]> = {
  [C.milk]: 'milk',
  [C.wheat]: 'wheat',
  [C.strawberry]: 'strawberry',
  [C.egg]: 'egg',
  [C.goat]: 'goatMilk',
};

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

/** The game's input tray: a low tiled stand, steel top, one column of 3 painted spots per Recipe input. */
function tray(g: THREE.Object3D, x0: number, z0: number, colours: string[]): Built['inputs'] {
  const cols = colours.length === 1 ? [colours[0], colours[0]] : colours;
  const wide = cols.length * 0.27 + 0.12;
  box(g, wide, 0.32, 0.92, C.tile, x0 + (cols.length - 1) * 0.135, 0, z0);
  box(g, wide + 0.04, 0.04, 0.96, shiny(C.steel), x0 + (cols.length - 1) * 0.135, 0.32, z0);
  return cols.flatMap((colour, k) =>
    [0, 1, 2].map((r) => {
      const x = x0 + k * 0.27;
      const z = z0 + (r - 1) * 0.27;
      box(g, 0.22, 0.012, 0.22, new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity: 0.55 }), x, 0.36, z);
      return { at: new THREE.Vector3(x, 0.372, z), colour };
    }),
  );
}

/** A floor Machine shifted right to make room for its input tray on the left. */
function withTray(b: Omit<Built, 'inputs'>, w: number, colours: string[]): Built {
  for (const c of b.group.children) c.position.x += 0.3;
  return { ...b, inputs: tray(b.group, -w / 2 + 0.2, 0, colours) };
}

/** A blocky goat to sit beside the Kenney cow: box body, horns, a beard and a bell. */
function goat(p: THREE.Object3D) {
  const root = group(p);
  root.scale.setScalar(P.goatSize);
  box(root, 0.36, 0.34, 0.68, C.goat, 0, 0.38, 0);
  box(root, 0.3, 0.02, 0.3, C.goatDark, 0, 0.72, -0.1);
  for (const [x, z] of [
    [-0.12, -0.25],
    [0.12, -0.25],
    [-0.12, 0.25],
    [0.12, 0.25],
  ])
    box(root, 0.09, 0.38, 0.09, C.goat, x, 0, z);
  const tail = box(root, 0.06, 0.14, 0.05, C.goat, 0, 0.68, -0.36);
  const head = group(root, 0, 0.72, 0.36);
  box(head, 0.24, 0.26, 0.3, C.goat, 0, -0.05, 0.08);
  box(head, 0.14, 0.1, 0.1, C.nose, 0, -0.05, 0.25);
  for (const x of [-0.07, 0.07]) {
    cone(head, 0.035, 0.22, C.horn, x, 0.18, 0, 6).rotation.x = -0.5;
    box(head, 0.14, 0.05, 0.06, C.goat, x * 2.4, 0.05, 0).rotation.z = x > 0 ? -0.4 : 0.4;
    sph(head, 0.025, C.ink, x * 1.3, 0.04, 0.2, 0);
  }
  cone(head, 0.04, 0.12, C.goatDark, 0, -0.3, 0.18, 6).rotation.x = Math.PI;
  const bell = sph(root, 0.06, shiny(C.bell), 0, 0.5, 0.42, 1);
  return { root, head, tail, bell };
}

// ---------- the goat pen (Animal)

/** Rubber-matted pen with white rails, a steel milking stand and water bucket; the goat stays put and chews. */
function goatPen(w: number, d: number): Built {
  const g = new THREE.Group();
  box(g, w, 0.04, d, C.rubber);
  const posts: [number, number][] = [];
  for (let i = 0; i <= 4; i++) posts.push([-w / 2 + (i / 4) * w, -d / 2]);
  for (let i = 1; i <= 3; i++) posts.push([-w / 2, -d / 2 + (i / 3) * d], [w / 2, -d / 2 + (i / 3) * d]);
  for (const [x, z] of posts) box(g, 0.1, 0.85, 0.1, C.trim, x, 0, z);
  for (const y of [0.35, 0.7]) {
    box(g, w, 0.07, 0.05, C.trim, 0, y, -d / 2);
    box(g, 0.05, 0.07, d, C.trim, -w / 2, y, 0);
    box(g, 0.05, 0.07, d, C.trim, w / 2, y, 0);
  }
  // milking stand at the back, water bucket in the corner
  const sx = w * 0.15;
  const sz = -d * 0.3;
  box(g, 0.9, 0.3, 0.55, shiny(C.steel), sx, 0.04, sz);
  for (const x of [-0.4, 0.4]) box(g, 0.05, 0.6, 0.05, shiny(C.steel), sx + x, 0.34, sz - 0.25);
  box(g, 0.85, 0.05, 0.05, shiny(C.steel), sx, 0.94, sz - 0.25);
  cyl(g, 0.14, 0.3, shiny(C.steel), w * 0.36, 0.04, -d * 0.36, 0.11);
  cyl(g, 0.12, 0.01, clear(C.glass, 0.8), w * 0.36, 0.32, -d * 0.36);
  // the goat stands by its feed, chewing; it grazes with its head down when idle
  const gt = goat(g);
  gt.root.position.set(w * 0.1, 0.04, d * 0.05);
  gt.root.rotation.y = -0.5;
  return {
    group: g,
    output: 'goatMilk',
    inputs: tray(g, -w / 2 + 0.35, d * 0.22, [C.wheat]),
    animate: (_dt, t, wk) => {
      gt.head.rotation.x = wk ? Math.sin(t * 7) * 0.08 : 0.5 + Math.sin(t * 2.5) * 0.1;
      gt.head.rotation.y = wk ? Math.sin(t * 1.3) * 0.25 : 0;
      gt.tail.rotation.x = Math.sin(t * (wk ? 16 : 5)) * 0.4;
      gt.bell.rotation.z = Math.sin(t * (wk ? 9 : 3)) * 0.4;
    },
  };
}

// ---------- machines (structure fills the back; the front strip is the output pallet)

/** Stainless barrel churn on an A-frame, turned by a crank wheel; a glass porthole shows the cream. */
function butterChurn(w: number): Built {
  const g = new THREE.Group();
  box(g, 1.2, 0.2, 1.0, C.tile);
  for (const x of [-0.42, 0.42])
    for (const s of [-1, 1]) box(g, 0.07, 1.05, 0.07, shiny(C.steel), x, 0.2, s * 0.25).rotation.x = s * 0.22;
  const top = 1.2;
  const drum = group(g, 0, top, 0);
  cyl(drum, 0.4, 0.8, shiny(C.steel), 0, -0.4, 0, 0.4, 20).rotation.z = Math.PI / 2;
  for (const x of [-0.3, 0.3]) torus(drum, 0.41, 0.02, C.steelDark, x).rotation.set(0, Math.PI / 2, 0);
  cyl(drum, 0.15, 0.03, clear(C.glass, 0.6), 0, 0, 0.4).rotation.x = Math.PI / 2;
  sph(drum, 0.12, C.cream, 0, 0, 0.36, 1).scale.set(1, 1, 0.3);
  const wheel = group(g, 0.5, top, 0);
  torus(wheel, 0.26, 0.03, C.blue).rotation.set(0, Math.PI / 2, 0);
  for (let i = 0; i < 4; i++) box(wheel, 0.02, 0.52, 0.02, C.blue, 0, -0.26, 0).rotation.x = (i * Math.PI) / 4;
  return withTray(
    {
      group: g,
      output: 'butter',
      animate: (dt, _t, wk) => {
        const sp = wk ? 4 * P.spin : 0;
        drum.rotation.x += dt * sp;
        wheel.rotation.x += dt * sp;
      },
    },
    w,
    [C.milk],
  );
}

/** Cheese and goat cheese share this steel press; `goatish` adds the goat cheese accent. */
function cheesePress(w: number, goatish: boolean): Built {
  const g = new THREE.Group();
  const wheel = goatish ? C.goatCheese : C.cheese;
  const showSign = goatish && P.goatAccent !== 'ash';
  const showAsh = goatish && P.goatAccent !== 'sign';
  const band = goatish ? C.teal : C.blue;
  box(g, 1.4, 0.8, 1.0, C.tile);
  box(g, 1.44, 0.06, 1.04, shiny(C.steel), 0, 0.8);
  const top = 0.86;
  for (const x of [-0.45, 0.45]) cyl(g, 0.04, 1.1, shiny(C.steel), x, top, -0.25);
  box(g, 1.0, 0.12, 0.25, shiny(C.steel), 0, top + 1.1, -0.25);
  const ram = group(g, 0, top + 1.1, 0);
  cyl(ram, 0.06, 0.6, shiny(C.steel), 0, -0.6);
  cyl(ram, 0.26, 0.05, mat(band), 0, -0.65);
  cyl(g, 0.28, 0.28, shiny(C.steel), 0, top, 0);
  cyl(g, 0.24, 0.02, wheel, 0, top + 0.28, 0);
  if (showAsh) cyl(g, 0.245, 0.02, C.ash, 0, top + 0.3, 0);
  cyl(g, 0.12, 0.4, clear(C.glass), 0.5, top, 0.25);
  const whey = cyl(g, 0.1, 0.01, mat(C.cream), 0.5, top + 0.02, 0.25);
  box(g, 0.5, 0.25, 0.02, mat(band), 0, top - 0.5, 0.51);
  if (showSign) {
    // a little goat-head sign so the twin presses read apart at a glance
    const sign = group(g, 0, top + 1.25, -0.25);
    box(sign, 0.42, 0.32, 0.04, C.trim);
    box(sign, 0.18, 0.16, 0.05, C.goat, 0, 0.06);
    for (const x of [-0.06, 0.06]) cone(sign, 0.025, 0.12, C.horn, x, 0.2, 0, 5);
    box(sign, 0.44, 0.03, 0.05, C.teal, 0, -0.01);
  }
  const dripsOf = drips(g, [[0.2, 0.2]], top + 0.25, top);
  return withTray(
    {
      group: g,
      output: goatish ? 'goatCheese' : 'cheese',
      animate: (dt, t, wk) => {
        ram.position.y = top + 1.1 - (wk ? (Math.sin(t * 3 * P.spin) * 0.5 + 0.5) * 0.35 : 0);
        const want = wk ? 30 : 4;
        whey.scale.y += (want - whey.scale.y) * Math.min(1, dt * 0.5);
        whey.position.y = top + 0.02 + (whey.scale.y * 0.01) / 2;
        dripsOf(t, wk);
      },
    },
    w,
    [goatish ? C.goat : C.milk],
  );
}

/** Soft-serve machine: two hoppers on top, a three-tap head with pink lever knobs; a cone fills with a pink-and-white twist. */
function softServe(g: THREE.Group): Built['animate'] {
  box(g, 1.4, 0.8, 1.0, C.tile);
  box(g, 1.44, 0.06, 1.04, shiny(C.steel), 0, 0.8);
  const top = 0.86;
  // cabinet: white with a steel front and a blue stripe
  box(g, 0.9, 0.85, 0.55, C.tile, 0, top, -0.2);
  box(g, 0.92, 0.5, 0.02, shiny(C.steel), 0, top + 0.1, 0.08);
  box(g, 0.92, 0.06, 0.57, C.blue, 0, top + 0.85, -0.2);
  for (const x of [-0.22, 0.22]) {
    cyl(g, 0.16, 0.12, shiny(C.steel), x, top + 0.91, -0.22);
    cyl(g, 0.17, 0.03, shiny(C.steelDark), x, top + 1.03, -0.22);
  }
  // a little cone sign on top
  const sign = group(g, 0, top + 1.06, -0.22);
  cone(sign, 0.09, 0.22, C.waffle, 0, 0.22, 0, 10).rotation.x = Math.PI;
  sph(sign, 0.1, gloss(C.pink), 0, 0.34, 0, 2);
  // dispensing head with three taps; the middle lever pulls while working
  box(g, 0.6, 0.18, 0.2, shiny(C.steel), 0, top + 0.6, 0.17);
  const levers: THREE.Group[] = [];
  for (const x of [-0.18, 0, 0.18]) {
    cone(g, 0.035, 0.08, shiny(C.steelDark), x, top + 0.52, 0.22, 8).rotation.x = Math.PI;
    const lv = group(g, x, top + 0.78, 0.25);
    box(lv, 0.03, 0.18, 0.03, C.ink, 0, 0, 0);
    sph(lv, 0.045, gloss(C.pink), 0, 0.2, 0, 1);
    levers.push(lv);
  }
  // drip tray and the cone holder
  box(g, 0.6, 0.03, 0.22, shiny(C.steelDark), 0, top + 0.02, 0.2);
  const cup = group(g, 0, top + 0.05, 0.22);
  cone(cup, 0.07, 0.22, C.waffle, 0, 0, 0, 10).rotation.x = Math.PI;
  const swirl: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++)
    swirl.push(torus(cup, 0.065 - i * 0.011, 0.032, gloss(i % 2 ? C.vanilla : C.pink), 0, 0.25 + i * 0.045));
  const tip = cone(cup, 0.025, 0.06, gloss(C.pink), 0, 0.46, 0, 8);
  let fill = 0;
  return (dt, t, wk) => {
    fill = wk ? Math.min(1, fill + dt * 0.35) : fill >= 1 ? 0 : fill;
    swirl.forEach((s, i) => (s.visible = fill * (swirl.length + 1) > i));
    tip.visible = fill >= 1;
    cup.rotation.y = wk ? t * 2 * P.spin : 0;
    levers[1].rotation.x = wk && fill < 1 ? 0.6 : 0;
  };
}

/** Gelato counter: a glass case of three heaped tubs, a batch freezer whose paddle churns pink behind a round window. */
function gelato(g: THREE.Group): Built['animate'] {
  box(g, 1.4, 0.8, 1.0, C.tile);
  box(g, 1.44, 0.06, 1.04, shiny(C.steel), 0, 0.8);
  const top = 0.86;
  // batch freezer at the back left
  box(g, 0.5, 0.7, 0.45, shiny(C.steel), -0.4, top, -0.25);
  const win = cyl(g, 0.16, 0.03, clear(C.glass, 0.5), -0.4, top + 0.35, -0.02);
  win.rotation.x = Math.PI / 2;
  const paddle = group(g, -0.4, top + 0.35, -0.04);
  cyl(paddle, 0.14, 0.02, gloss(C.pink), 0, -0.01, 0).rotation.x = Math.PI / 2;
  box(paddle, 0.26, 0.03, 0.03, C.vanilla, 0, -0.015, 0.01);
  // glass display case with three tubs
  const cx = 0.2;
  box(g, 0.9, 0.06, 0.6, shiny(C.steel), cx, top, 0.1);
  box(g, 0.9, 0.35, 0.02, clear(C.glass, 0.4), cx, top + 0.06, 0.39);
  box(g, 0.9, 0.02, 0.6, clear(C.glass, 0.3), cx, top + 0.41, 0.1);
  for (const x of [-0.43, 0.43]) box(g, 0.02, 0.35, 0.6, clear(C.glass, 0.4), cx + x, top + 0.06, 0.1);
  [C.pink, C.vanilla, C.strawberry].forEach((c, i) => {
    const x = cx - 0.27 + i * 0.27;
    box(g, 0.24, 0.1, 0.42, shiny(C.steelDark), x, top + 0.06, 0.1);
    sph(g, 0.13, gloss(c), x, top + 0.16, 0.05, 1).scale.set(0.9, 0.55, 1.4);
  });
  // a scoop dips into the pink tub while working
  const scoop = group(g, cx - 0.27, top + 0.55, 0.1);
  box(scoop, 0.03, 0.3, 0.03, shiny(C.steel), 0, 0, 0);
  sph(scoop, 0.06, gloss(C.pink), 0, 0, 0, 1);
  return (dt, t, wk) => {
    paddle.rotation.z += dt * (wk ? 5 * P.spin : 0);
    scoop.position.y = top + (wk ? 0.3 + Math.abs(Math.sin(t * 2.5)) * 0.25 : 0.55);
  };
}

function iceCreamMaker(w: number): Built {
  const g = new THREE.Group();
  const animate = P.iceLook === 'gelato' ? gelato(g) : softServe(g);
  return withTray({ group: g, output: 'iceCream', animate }, w, [C.milk, C.strawberry]);
}

/** Tilting steam kettle on legs: a whisk spins inside, it tips forward now and then to pour. */
function puddingPot(w: number): Built {
  const g = new THREE.Group();
  box(g, 1.2, 0.25, 1.0, C.tile);
  const top = 0.25;
  for (const x of [-0.45, 0.45]) box(g, 0.08, 0.7, 0.08, shiny(C.steel), x, top, 0);
  const kettle = group(g, 0, top + 0.75, 0);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    mat(C.steel, { roughness: 0.3, metalness: 0.25, side: THREE.DoubleSide }),
  );
  put(kettle, bowl, 0, 0.1);
  cyl(kettle, 0.39, 0.02, C.pudding, 0, -0.02);
  box(kettle, 0.9, 0.06, 0.06, shiny(C.steel), 0, 0.05);
  const whisk = group(kettle, 0, 0, 0);
  cyl(whisk, 0.02, 0.5, C.ink, 0, 0);
  for (let i = 0; i < 3; i++) torus(whisk, 0.07, 0.008, shiny(C.steel), 0, 0.02).rotation.set(0, (i * Math.PI) / 3, 0);
  const puff = steam(g, 0, top + 1.0, 0);
  return withTray(
    {
      group: g,
      output: 'pudding',
      animate: (_dt, t, wk) => {
        whisk.rotation.y = wk ? t * 8 * P.spin : 0;
        kettle.rotation.x = wk ? Math.max(0, Math.sin(t * 0.8)) * 0.35 : 0;
        puff(t, wk);
      },
    },
    w,
    [C.milk, C.egg],
  );
}

const BUILDERS: Record<string, (w: number, d: number) => Built> = {
  goat_pen: goatPen,
  butter_churn: butterChurn,
  cheese_press: (w) => cheesePress(w, false),
  goat_cheese_press: (w) => cheesePress(w, true),
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
      const label = document.createElement('div');
      label.className = 'lbl';
      label.textContent = PRODUCERS.find((p) => p.id === id)?.name ?? ref?.label ?? id;
      label.onclick = (e) => (e.stopPropagation(), focusOn(id));
      document.getElementById('labels')!.append(label);
      const p: Placed = {
        id, root, built: null, centre: root.position.clone(), phase: Math.random() * 5,
        outCount: 0, outItems: [], inItems: [], label,
      };
      if (ref) {
        const v = buildStation(ref.name, [-w / 2, -d / 2, w, d], 0);
        root.add(v.root);
        p.animateRef = v.animate;
      } else {
        const strip = 1.1;
        const built = BUILDERS[id](w, d - strip);
        built.group.position.z = -strip / 2;
        root.add(built.group);
        box(root, 1.46, 0.1, 0.99, C.steelDark, 0, 0, d / 2 - strip / 2);
        p.built = built;
        // output pallet: 3 + 2 + 1 Items; inputs on the tray spots
        for (let i = 0; i < 6; i++) {
          const m = item(built.output);
          const row = i < 3 ? 0 : i < 5 ? 1 : 2;
          const k = i < 3 ? i - 1 : i < 5 ? i - 3.5 : 0;
          m.position.set(k * 0.42, 0.1 + row * 0.22, d / 2 - 0.55);
          m.visible = false;
          root.add(m);
          p.outItems.push(m);
        }
        for (const s of built.inputs) {
          const m = item(INPUT_ITEM[s.colour] ?? 'milk');
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
    stage.zoomTo(innerWidth < innerHeight ? 26 : 18);
  }
  const meta = PRODUCERS.find((q) => q.id === id);
  document.getElementById('cap')!.textContent = meta
    ? `${meta.name} — ${meta.recipe} · footprint ${P.footprints[id].join(' × ')} m`
    : 'Creamery look — tap a name to look closer';
  for (const q of placed) q.label.classList.toggle('on', q.id === id);
}

// ---------- panel

const gui = new GUI({ title: 'Dairy Farm Producers — B' });
if (innerWidth < 700) gui.close();
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
look.add(P, 'iceLook', { 'Soft-serve machine': 'softServe', 'Gelato counter': 'gelato' }).name('Ice cream maker').onChange(() => setIce(P.iceLook));
look
  .add(P, 'goatAccent', { 'Goat-head sign': 'sign', 'Ash-grey rind': 'ash', 'Sign + ash rind': 'both' })
  .name('Goat cheese accent')
  .onChange(rebuild);
look.add(P, 'goatSize', 0.6, 2, 0.05).name('Goat size').onFinishChange(rebuild);
const motion = gui.addFolder('Motion');
motion.add(P, 'spin', 0, 3, 0.1).name('Spin / crank');
motion.add(P, 'steam', 0, 3, 0.1).name('Steam');
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

// the bottom bar flips between the two ice cream maker looks
const KEYS: IceLook[] = ['softServe', 'gelato'];
function setIce(s: IceLook): void {
  P.iceLook = s;
  const u = new URL(location.href);
  u.searchParams.set('ice', s);
  history.replaceState(null, '', u);
  document.getElementById('vname')!.textContent = ICE_NAMES[s];
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  rebuild();
}
const stepIce = (k: number) => setIce(KEYS[(KEYS.indexOf(P.iceLook) + k + KEYS.length) % KEYS.length]);
document.getElementById('prev')!.onclick = () => stepIce(-1);
document.getElementById('next')!.onclick = () => stepIce(1);
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') stepIce(-1);
  if (e.key === 'ArrowRight') stepIce(1);
});
// tap empty floor to go back to the overview
document.getElementById('scene')!.addEventListener('click', () => focusOn('overview'));

setIce(KEYS.includes(P.iceLook) ? P.iceLook : 'softServe');

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
    if (p.animateRef) p.animateRef(dt, wk);
    if (p.built) {
      p.built.animate(dt, t, wk);
      // Items arrive on the pallet while working; inputs get used up
      if (wk) p.outCount = Math.min(6, p.outCount + dt * 0.6);
      else if (p.outCount >= 6) p.outCount = 0;
      p.outItems.forEach((m, i) => (m.visible = P.showItems && i < Math.floor(p.outCount)));
      p.inItems.forEach((m, i) => (m.visible = P.showItems && i % 3 < (wk ? 1 : 2)));
    }
    stage.toScreen(p.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), screen);
    p.label.style.left = `${screen.x}px`;
    p.label.style.top = `${screen.y}px`;
  }
  stage.render(dt);
}
frame();
