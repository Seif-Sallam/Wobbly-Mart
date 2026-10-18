// PROTOTYPE (throwaway, branch prototype/pizza-shelves): `?pshelf=a|b|c|d` swaps the Pizza Place's pizza, veggie pizza
// and dough Shelves for one of four radically different stands. Each lays its Items side by side, never stacked.
import * as THREE from 'three';
import { PRODUCTS, SHELF_CAPS } from '../../catalog/products';
import { ASSETS } from '../../catalog/assets';
import { SHADES } from '../palette';
import { paletteMaterial } from './materials';
import { dynamic } from './merge';
import { pizzaItem } from './pizza-stations';
import { cyl, slab } from './shapes';

const Z = SHADES.pizza;

export type PizzaProduct = 'pizza' | 'veggie_pizza' | 'dough';
export const PIZZA_PRODUCTS: PizzaProduct[] = ['pizza', 'veggie_pizza', 'dough'];
export const VARIANTS: Record<string, string> = {
  a: 'Warmer: glass-front heated case, pizzas shingled flat, steam and glow',
  b: 'Cubbies: open wall of pizza boxes, the lid colour and topping name the type',
  c: 'Peel rack: pizzas lean upright on wooden peels; dough rests in flour baskets',
  d: 'Portholes: pizzas framed like pictures on a wall; dough on cake stands',
};
/** Sign and trim colour per Product: red pizza, green veggie, gold dough. */
const COLOUR: Record<PizzaProduct, string> = { pizza: Z.sauce, veggie_pizza: Z.veggie, dough: Z.gold };
const MODEL: Record<PizzaProduct, string> = { pizza: 'pizza', veggie_pizza: 'veggie-pizza', dough: 'dough' };

/** Live-tunable numbers (multipliers on each preset's own defaults), kept in localStorage between reloads. */
export const TUNE = { spacing: 1, tilt: 1, tier: 1, sign: 1, glow: 1 };
const STORE = 'pshelf-tune';
try {
  Object.assign(TUNE, JSON.parse(localStorage.getItem(STORE) ?? '{}'));
} catch {
  /* defaults */
}
export const saveTune = (): void => {
  try {
    localStorage.setItem(STORE, JSON.stringify(TUNE));
  } catch {
    /* private window */
  }
};

export interface PizzaShelf {
  /** First `n` spots fill first: lowest and front first. */
  slots: THREE.Vector3[];
  tilt: number;
  animate?: (dt: number, working: boolean) => void;
}

const raw = new URLSearchParams(location.search).get('pshelf') ?? '';
/** The preset this page runs in game, or '' for today's look. */
export const ACTIVE = raw in VARIANTS ? raw : '';

if (ACTIVE) {
  // each Product gets its own stand name (`<product>-stand`), so the hook in buildStand can tell them apart
  for (const p of PIZZA_PRODUCTS) {
    PRODUCTS[p].shelf = `${p}-stand`;
    SHELF_CAPS[`${p}-stand`] = 12;
    ASSETS[`${p}-stand`] = {};
  }
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const at = (i: number, n: number, pitch: number, shift = 0) => (i - (n - 1) / 2) * pitch * TUNE.spacing + shift;

const glassMat = new THREE.MeshStandardMaterial({
  color: Z.glass,
  transparent: true,
  opacity: 0.28,
  roughness: 0.1,
  depthWrite: false,
});
function glass(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}
/** A flat ring or disc facing the front (+z). */
function ring(parent: THREE.Object3D, r: number, tube: number, colour: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24), paletteMaterial(colour));
  m.position.set(x, y, z);
  parent.add(m);
}
function disc(parent: THREE.Object3D, r: number, colour: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 24), paletteMaterial(colour));
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
}

/** Post, board in the Product's colour and a little upright copy of the Item on top. */
function sign(body: THREE.Object3D, p: PizzaProduct, y: number, z: number) {
  const s = TUNE.sign;
  slab(body, 0.06, y, 0.06, Z.woodDark, 0, 0, z);
  slab(body, 0.9 * s, 0.34 * s, 0.06, COLOUR[p], 0, y, z);
  const icon = pizzaItem(MODEL[p]);
  if (!icon) return;
  icon.position.set(0, y + 0.34 * s + 0.1, z + 0.03);
  icon.rotation.x = p === 'dough' ? 0 : 1.1;
  icon.scale.setScalar(0.9 * s);
  body.add(icon);
}

// ---------- A: warmer case, proofing table

function warmer(p: PizzaProduct, w: number, d: number, body: THREE.Object3D): PizzaShelf {
  const c = COLOUR[p];
  const tilt = 0.2 * TUNE.tilt;
  const slots: THREE.Vector3[] = [];
  slab(body, w, 0.42, d, c);
  slab(body, w + 0.06, 0.05, d + 0.06, Z.tile, 0, 0.42);
  slab(body, w, 0.9, 0.04, Z.tile, 0, 0.47, -d / 2 + 0.02);
  for (let r = 0; r < 3; r++) {
    const z = [0.28, 0, -0.28][r];
    const y = 0.5 + r * 0.17 * TUNE.tier;
    slab(body, w * 0.94, y - 0.47, 0.28, Z.woodDark, 0, 0.47, z);
    const tray = new THREE.Group();
    tray.position.set(0, y, z);
    tray.rotation.x = tilt;
    slab(tray, w * 0.94, 0.05, 0.3, Z.tile);
    body.add(tray);
    for (let i = 0; i < 4; i++) slots.push(v3(at(i, 4, 0.7), y + 0.05 * Math.cos(tilt), z + 0.05 * Math.sin(tilt)));
  }
  const pane = glass(body, w, 0.75, 0.03, 0, 0.5, d / 2 - 0.02);
  pane.rotation.x = -0.25;
  for (const s of [-1, 1]) glass(body, 0.03, 0.8, d, (s * w) / 2, 0.47, 0);
  slab(body, w + 0.06, 0.08, d + 0.06, c, 0, 1.27);
  const lampMat = new THREE.MeshStandardMaterial({ color: Z.fire, emissive: Z.fire });
  const lamp = dynamic(new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.04, 0.12), lampMat));
  lamp.position.set(0, 1.23, -0.1);
  body.add(lamp);
  const steam = [-1, -0.3, 0.4, 1.1].map((x, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: Z.smoke, transparent: true, depthWrite: false });
    const m = dynamic(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat));
    body.add(m);
    return { m, mat, x, ph: i / 4 };
  });
  sign(body, p, 1.55, -d / 2 - 0.05);
  let t = 0;
  const animate = (dt: number) => {
    t += dt;
    lampMat.emissiveIntensity = (0.9 + 0.5 * Math.sin(t * 2)) * TUNE.glow;
    for (const s of steam) {
      const k = (t * 0.25 + s.ph) % 1;
      s.m.position.set(s.x + Math.sin(t + s.ph * 9) * 0.08, 1.4 + k * 0.5, -0.1);
      s.m.scale.setScalar(0.6 + k);
      s.mat.opacity = 0.55 * (1 - k) * Math.min(1, TUNE.glow);
    }
  };
  return { slots, tilt, animate };
}

function proofTable(p: PizzaProduct, w: number, d: number, body: THREE.Object3D): PizzaShelf {
  const c = COLOUR[p];
  const slots: THREE.Vector3[] = [];
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1])
    for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) slab(body, 0.1, 0.4, 0.1, Z.woodDark, x, 0, z);
  slab(body, w, 0.08, d, Z.wood, 0, 0.4);
  slab(body, w * 0.96, 0.04, d * 0.9, Z.flour, 0, 0.48);
  slab(body, w, 0.07, 0.04, c, 0, 0.4, d / 2);
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 6; i++) slots.push(v3(at(i, 6, 0.5, r ? 0.12 : -0.12), 0.52, r ? -0.22 : 0.2));
  sign(body, p, 1.2, -d / 2 - 0.05);
  return { slots, tilt: 0.02 * TUNE.tilt };
}

// ---------- B: cubby wall of pizza boxes

function cubbies(p: PizzaProduct, w: number, d: number, body: THREE.Object3D): PizzaShelf {
  const c = COLOUR[p];
  const cols = 4;
  const levels = 3;
  const lh = 0.5;
  const cw = w / cols;
  const slots: THREE.Vector3[] = [];
  slab(body, w, levels * lh + 0.06, 0.05, Z.woodDark, 0, 0, -d / 2 + 0.025);
  for (let i = 0; i <= cols; i++) slab(body, 0.06, levels * lh, d, Z.wood, -w / 2 + i * cw);
  for (let k = 0; k <= levels; k++) slab(body, w + 0.06, 0.06, d, k === levels ? c : Z.wood, 0, k * lh);
  for (let k = 0; k < levels; k++)
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + (i + 0.5) * cw;
      const y = k * lh + 0.06;
      if (p === 'dough') {
        cyl(body, 0.3, 0.12, Z.white, x, y, 0.05);
        cyl(body, 0.31, 0.03, c, x, y + 0.04, 0.05);
      } else {
        slab(body, 0.62, 0.05, 0.62, Z.tile, x, y, 0.05);
      }
      // lid propped up at the back, face out
      const lid = new THREE.Group();
      lid.position.set(x, y + 0.05, -0.28);
      lid.rotation.x = -1.3;
      slab(lid, 0.62, 0.03, 0.36, c, 0, 0, 0.18);
      if (p === 'pizza')
        for (const [dx, dz] of [
          [-0.12, 0.1],
          [0.1, 0.14],
          [0, 0.26],
        ])
          cyl(lid, 0.06, 0.02, Z.pepperoni, dx, -0.025, dz);
      if (p === 'veggie_pizza')
        for (const [dx, dz] of [
          [-0.12, 0.1],
          [0.1, 0.14],
          [0, 0.26],
        ])
          cyl(lid, 0.06, 0.02, dx ? Z.pepper : Z.oliveDark, dx, -0.025, dz);
      if (p === 'dough') cyl(lid, 0.12, 0.02, Z.dough, 0, -0.025, 0.18);
      body.add(lid);
      slots.push(v3(x * TUNE.spacing, y + (p === 'dough' ? 0.12 : 0.05), 0.05));
    }
  slots.sort((a, b) => a.y - b.y || a.x - b.x);
  sign(body, p, levels * lh + 0.2, -d / 2 - 0.05);
  return { slots, tilt: 0.08 * TUNE.tilt };
}

// ---------- C: peel rack, flour baskets

function peelRack(p: PizzaProduct, w: number, d: number, body: THREE.Object3D): PizzaShelf {
  const c = COLOUR[p];
  const tilt = 1.15 * TUNE.tilt;
  const slots: THREE.Vector3[] = [];
  slab(body, w, 0.2, d, Z.woodDark);
  for (const s of [-1, 1]) slab(body, 0.08, 1.8, 0.1, Z.wood, s * (w / 2 - 0.04), 0, -d / 2 + 0.1);
  slab(body, w, 0.07, 0.07, c, 0, 1.75, -d / 2 + 0.12);
  for (let t = 0; t < 3; t++) {
    const z = [0.28, 0, -0.28][t];
    const y = 0.5 + t * 0.35 * TUNE.tier;
    slab(body, w * 0.96, 0.05, 0.1, c, 0, y - 0.3, z + 0.14);
    for (let i = 0; i < 4; i++) {
      const x = at(i, 4, 0.72);
      const peel = new THREE.Group();
      peel.position.set(x, y, z - 0.05);
      peel.rotation.x = tilt;
      cyl(peel, 0.31, 0.03, Z.wood, 0, -0.04, 0);
      slab(peel, 0.07, 0.03, 0.34, Z.woodDark, 0, -0.04, -0.62);
      slab(peel, 0.075, 0.032, 0.1, c, 0, -0.04, -0.82);
      body.add(peel);
      slots.push(v3(x, y, z));
    }
  }
  sign(body, p, 1.95, -d / 2 - 0.05);
  return { slots, tilt };
}

function baskets(p: PizzaProduct, w: number, d: number, body: THREE.Object3D): PizzaShelf {
  const c = COLOUR[p];
  const slots: THREE.Vector3[] = [];
  slab(body, w, 0.28, d * 0.55, Z.woodDark, 0, 0, d * 0.22);
  slab(body, w, 0.55, d * 0.45, Z.wood, 0, 0, -d * 0.27);
  slab(body, w, 0.06, 0.04, c, 0, 0.22, d / 2);
  for (let r = 0; r < 2; r++) {
    const y = r ? 0.55 : 0.28;
    const z = r ? -0.24 : 0.2;
    for (let i = 0; i < 6; i++) {
      const x = at(i, 6, 0.5, r ? 0.12 : -0.12);
      cyl(body, 0.26, 0.14, Z.wood, x, y, z, 0.21);
      cyl(body, 0.22, 0.03, Z.flour, x, y + 0.13, z);
      slots.push(v3(x, y + 0.15, z));
    }
  }
  sign(body, p, 1.3, -d / 2 - 0.05);
  return { slots, tilt: 0 };
}

// ---------- D: porthole wall, cake stands

function portholes(p: PizzaProduct, w: number, d: number, body: THREE.Object3D): PizzaShelf {
  const c = COLOUR[p];
  const tilt = 1.35 * TUNE.tilt;
  const slots: THREE.Vector3[] = [];
  const zWall = -d / 2 + 0.2;
  slab(body, w, 0.14, d * 0.6, Z.woodDark, 0, 0, -d * 0.2);
  slab(body, w, 1.95, 0.1, c, 0, 0.14, zWall - 0.05);
  slab(body, w + 0.08, 0.07, 0.14, Z.woodDark, 0, 2.05, zWall - 0.05);
  for (let r = 0; r < 3; r++) {
    const y = 0.7 + r * 0.52 * TUNE.tier;
    for (let i = 0; i < 4; i++) {
      const x = at(i, 4, 0.72);
      disc(body, 0.33, Z.tile, x, y, zWall + 0.01);
      ring(body, 0.33, 0.04, Z.tile, x, y, zWall + 0.02);
      ring(body, 0.37, 0.025, Z.woodDark, x, y, zWall + 0.02);
      slots.push(v3(x, y, zWall + 0.07));
    }
  }
  sign(body, p, 2.2, -d / 2 - 0.05);
  return { slots, tilt };
}

function cakeStands(p: PizzaProduct, w: number, d: number, body: THREE.Object3D): PizzaShelf {
  const c = COLOUR[p];
  const slots: THREE.Vector3[] = [];
  slab(body, w, 0.1, d * 0.9, c);
  for (let r = 0; r < 2; r++) {
    const y = r ? 0.7 : 0.42;
    const z = r ? -0.22 : 0.2;
    for (let i = 0; i < 6; i++) {
      const x = at(i, 6, 0.5, r ? 0.12 : -0.12);
      cyl(body, 0.1, 0.03, Z.cobalt, x, 0.1, z);
      cyl(body, 0.03, y - 0.13, Z.cobalt, x, 0.1, z);
      cyl(body, 0.26, 0.03, Z.tile, x, y - 0.03, z);
      cyl(body, 0.27, 0.012, Z.gold, x, y - 0.03, z);
      slots.push(v3(x, y, z));
    }
  }
  sign(body, p, 1.4, -d / 2 - 0.05);
  return { slots, tilt: 0 };
}

type Builder = (p: PizzaProduct, w: number, d: number, body: THREE.Object3D) => PizzaShelf;
const BUILDERS: Record<string, { pizza: Builder; dough: Builder }> = {
  a: { pizza: warmer, dough: proofTable },
  b: { pizza: cubbies, dough: cubbies },
  c: { pizza: peelRack, dough: baskets },
  d: { pizza: portholes, dough: cakeStands },
};

export function buildPizzaShelf(
  variant: string,
  p: PizzaProduct,
  w: number,
  d: number,
  body: THREE.Object3D,
): PizzaShelf {
  const b = BUILDERS[variant];
  return (p === 'dough' ? b.dough : b.pizza)(p, w, d, body);
}

/** The hook in buildStand: the active preset's stand for this Product, or null. */
export function pizzaShelfPrototype(product: string, w: number, d: number, body: THREE.Object3D): PizzaShelf | null {
  if (!ACTIVE || !PIZZA_PRODUCTS.includes(product as PizzaProduct)) return null;
  return buildPizzaShelf(ACTIVE, product as PizzaProduct, w, d, body);
}
