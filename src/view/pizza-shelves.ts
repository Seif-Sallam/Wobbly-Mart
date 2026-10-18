// Pizza Place Shelf stands: pizzas lean upright on peels over a rail, dough rests in flour baskets. Each carries a sign
// and trim in its Product's colour, so the three read apart at a glance. Items sit side by side, never stacked.
import * as THREE from 'three';
import { SHADES } from '../palette';
import { pizzaItem } from './pizza-stations';
import { cyl, slab } from './shapes';
import type { StationVisual } from './stations';

const Z = SHADES.pizza;

export type PizzaShelfProduct = 'pizza' | 'veggie_pizza' | 'dough';
export const PIZZA_SHELF_PRODUCTS: readonly string[] = ['pizza', 'veggie_pizza', 'dough'];

const COLOUR: Record<PizzaShelfProduct, string> = { pizza: Z.sauce, veggie_pizza: Z.veggie, dough: Z.gold };
const ICON: Record<PizzaShelfProduct, string> = { pizza: 'pizza', veggie_pizza: 'veggie-pizza', dough: 'dough' };

/** Peel rack: pitch between pizzas, peel lean (rad from vertical), three rails stepping up and back. */
const RACK = { cols: 4, pitch: 0.72, tilt: 1.15, rails: [0.28, 0, -0.28], rise: 0.35, baseY: 0.5 };
/** Flour baskets: two rows (front low, back raised) of six. */
const BASKETS = {
  cols: 6,
  pitch: 0.5,
  stagger: 0.12,
  rows: [
    { y: 0.28, z: 0.2 },
    { y: 0.55, z: -0.24 },
  ],
};
/** Sign: board size, and the Item icon's lean and scale. */
const SIGN = { w: 0.9, h: 0.34, iconLean: 1.1, iconScale: 0.9 };

const spot = (i: number, n: number, pitch: number, shift = 0) => (i - (n - 1) / 2) * pitch + shift;

/** Post, board in the Product's colour and a small upright copy of the Item on top. */
function sign(body: THREE.Object3D, p: PizzaShelfProduct, y: number, z: number): void {
  slab(body, 0.06, y, 0.06, Z.woodDark, 0, 0, z);
  slab(body, SIGN.w, SIGN.h, 0.06, COLOUR[p], 0, y, z);
  const icon = pizzaItem(ICON[p]);
  if (!icon) return;
  icon.position.set(0, y + SIGN.h + 0.1, z + 0.03);
  icon.rotation.x = p === 'dough' ? 0 : SIGN.iconLean;
  icon.scale.setScalar(SIGN.iconScale);
  body.add(icon);
}

function peelRack(p: PizzaShelfProduct, w: number, d: number, v: StationVisual): void {
  const b = v.body;
  const c = COLOUR[p];
  const slots: THREE.Vector3[] = [];
  slab(b, w, 0.2, d, Z.woodDark);
  for (const s of [-1, 1]) slab(b, 0.08, 1.8, 0.1, Z.wood, s * (w / 2 - 0.04), 0, -d / 2 + 0.1);
  slab(b, w, 0.07, 0.07, c, 0, 1.75, -d / 2 + 0.12);
  RACK.rails.forEach((z, t) => {
    const y = RACK.baseY + t * RACK.rise;
    slab(b, w * 0.96, 0.05, 0.1, c, 0, y - 0.3, z + 0.14);
    for (let i = 0; i < RACK.cols; i++) {
      const x = spot(i, RACK.cols, RACK.pitch);
      const peel = new THREE.Group();
      peel.position.set(x, y, z - 0.05);
      peel.rotation.x = RACK.tilt;
      cyl(peel, 0.31, 0.03, Z.wood, 0, -0.04, 0);
      slab(peel, 0.07, 0.03, 0.34, Z.woodDark, 0, -0.04, -0.62);
      slab(peel, 0.075, 0.032, 0.1, c, 0, -0.04, -0.82);
      b.add(peel);
      slots.push(new THREE.Vector3(x, y, z));
    }
  });
  sign(b, p, 1.95, -d / 2 - 0.05);
  v.slots = slots;
  v.slotTilt = RACK.tilt;
}

function baskets(p: PizzaShelfProduct, w: number, d: number, v: StationVisual): void {
  const b = v.body;
  const slots: THREE.Vector3[] = [];
  slab(b, w, 0.28, d * 0.55, Z.woodDark, 0, 0, d * 0.22);
  slab(b, w, 0.55, d * 0.45, Z.wood, 0, 0, -d * 0.27);
  slab(b, w, 0.06, 0.04, COLOUR[p], 0, 0.22, d / 2);
  BASKETS.rows.forEach(({ y, z }, r) => {
    for (let i = 0; i < BASKETS.cols; i++) {
      const x = spot(i, BASKETS.cols, BASKETS.pitch, r ? BASKETS.stagger : -BASKETS.stagger);
      cyl(b, 0.26, 0.14, Z.wood, x, y, z, 0.21);
      cyl(b, 0.22, 0.03, Z.flour, x, y + 0.13, z);
      slots.push(new THREE.Vector3(x, y + 0.15, z));
    }
  });
  sign(b, p, 1.3, -d / 2 - 0.05);
  v.slots = slots;
}

export function buildPizzaShelf(product: PizzaShelfProduct, w: number, d: number, v: StationVisual): void {
  (product === 'dough' ? baskets : peelRack)(product, w, d, v);
}
