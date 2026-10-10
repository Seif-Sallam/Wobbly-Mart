// Code-built Shelf stands (one per Product) and the big checkout counter. Item slots are authored, not raycast.
import * as THREE from 'three';
import { SHELF_CAPS, type ProductId } from '../../catalog/products';
import { ITEM_SIZE } from '../../catalog/assets';
import { centred, model } from './assets';
import { paletteMaterial } from './materials';
import { PALETTE, SHADES } from '../palette';
import { FEEL } from '../feel';
import { dynamic } from './merge';
import { slab } from './shapes';
import type { StationVisual } from './stations';

/** Item height and gap between neighbours on a stand, in base Item sizes. */
const ITEM: Record<string, { h: number; gap: number }> = {
  tomato: { h: 0.92, gap: 0.92 },
  egg: { h: 1, gap: 0.77 },
  ketchup: { h: 1.25, gap: 0.59 },
  wheat: { h: 1.24, gap: 0.55 },
  milk: { h: 1.2, gap: 0.74 },
  flour: { h: 1.2, gap: 0.92 },
  bread: { h: 0.85, gap: 1.14 },
};
/** Loose produce heaps a second layer when its stand has fewer spots than its Shelf holds. */
const HEAPS = new Set<ProductId>(['tomato', 'bread', 'flour']);

/** A surface Items stand on: height, depth row, and the x positions (default: columns across `span`). */
interface Tier {
  y: number;
  z: number;
  span?: number;
  xs?: number[];
}

function stand(product: ProductId, w: number, d: number, v: StationVisual): Tier[] {
  const b = v.body;
  const colour = SHADES.splat[product];
  switch (product) {
    case 'tomato': {
      // low slanted produce bin with a wooden lip
      const tilt = 0.2;
      slab(b, w, 0.55, d, 'woodDark');
      const tray = new THREE.Group();
      slab(tray, w * 0.94, 0.12, d * 0.9, colour);
      tray.position.y = 0.5;
      tray.rotation.x = tilt;
      b.add(tray);
      slab(b, w, 0.25, 0.06, 'wood', 0, 0.55, d / 2 - 0.03);
      v.slotTilt = tilt;
      const top = (z: number) => 0.5 + 0.12 * Math.cos(tilt) - z * Math.sin(tilt);
      return [0.15, -0.25].map((z) => ({ y: top(z), z }));
    }
    case 'egg':
      slab(b, w * 0.85, 0.7, d * 0.75, 'wood');
      slab(b, w * 0.85, 0.1, d * 0.75, 'cream', 0, 0.7);
      return [0.15, -0.15].map((z) => ({ y: 0.8, z, span: w * 0.38 }));
    case 'ketchup':
    case 'flour':
      // three-step riser
      slab(b, w, 0.35, d, 'woodDark');
      slab(b, w, 0.7, d * 0.62, 'wood', 0, 0, -d * 0.19);
      slab(b, w, 1.05, d * 0.3, 'woodDark', 0, 0, -d * 0.35);
      return [
        { y: 0.35, z: d * 0.32 },
        { y: 0.7, z: 0 },
        { y: 1.05, z: -d * 0.35 },
      ];
    case 'milk':
      // open-front cooler: back, sides, top, an ice-blue floor and mid shelf
      slab(b, w, 1.6, 0.1, 'cream', 0, 0, -d / 2 + 0.05);
      slab(b, 0.1, 1.6, d, 'cream', -w / 2 + 0.05);
      slab(b, 0.1, 1.6, d, 'cream', w / 2 - 0.05);
      slab(b, w, 0.1, d, 'cream', 0, 1.5);
      slab(b, w - 0.2, 0.25, d - 0.1, SHADES.glass);
      slab(b, w - 0.2, 0.06, d * 0.7, SHADES.glass, 0, 0.8, -d * 0.12);
      return [0.25, 0.86].map((y) => ({ y, z: 0.05, span: w / 2 - 0.35 }));
    case 'wheat': {
      // three baskets, sheaves standing in them
      const baskets = [-1, 0, 1];
      for (const x of baskets) slab(b, 0.8, 0.45, 0.8, 'wood', x);
      const xs = baskets.flatMap((x) => [x - 0.15, x + 0.15]);
      return [0.15, -0.15].map((z) => ({ y: 0.45, z, xs }));
    }
    case 'bread': {
      // furniture table with a raised bread board
      const table = centred(model('table', { fit: [w, d] }));
      const top = new THREE.Box3().setFromObject(table).max.y;
      b.add(table);
      slab(b, w * 0.8, 0.08, d * 0.75, 'wood', 0, top);
      return [0.12, -0.18].map((z) => ({ y: top + 0.08, z, span: w * 0.32 }));
    }
    default:
      throw new Error(`No stand for ${product}`);
  }
}

/** Lowest tier first, then front row first, then left to right; loose produce heaps when short of spots. */
function slotsFor(product: ProductId, tiers: Tier[], w: number, cap: number): THREE.Vector3[] {
  const it = ITEM[product];
  const gap = it.gap * ITEM_SIZE;
  const spots = tiers.flatMap((t) => {
    const span = t.span ?? w / 2 - gap / 2;
    const cols = Math.max(1, Math.floor((span * 2) / gap) + 1);
    const xs = t.xs ?? [...Array(cols).keys()].map((c) => (cols === 1 ? 0 : -span + (c / (cols - 1)) * span * 2));
    return xs.map((x) => new THREE.Vector3(x, t.y + 0.005, t.z));
  });
  spots.sort((a, b) => a.y - b.y || b.z - a.z || a.x - b.x);
  const out = spots.slice(0, cap);
  for (let i = 0; HEAPS.has(product) && out.length < cap && i < out.length; i++)
    out.push(out[i].clone().setY(out[i].y + it.h * ITEM_SIZE));
  return out;
}

export function buildStand(product: ProductId, w: number, d: number, v: StationVisual): void {
  const tiers = stand(product, w, d, v);
  // Product-coloured sign on a post at the back
  slab(v.body, 0.06, 1.75, 0.06, 'woodDark', 0, 0, -d / 2 - 0.05);
  slab(v.body, 0.9, 0.32, 0.06, SHADES.splat[product], 0, 1.59, -d / 2 - 0.05);
  v.slots = slotsFor(product, tiers, w, SHELF_CAPS[`${product}-stand`]);
}

/** Counter with a moving belt on the Customer side, the till on a riser, a bagging tray and a lane light. */
export function buildCheckout(w: number, d: number, v: StationVisual): void {
  const b = v.body;
  const top = 0.9;
  slab(b, w, top - 0.06, d, 'woodDark');
  slab(b, w + 0.06, 0.06, d + 0.06, 'wood', 0, top - 0.06);
  const beltLen = w * 0.58;
  const bx = -w / 2 + 0.08 + beltLen / 2;
  const bz = d * 0.18;
  slab(b, beltLen, 0.05, d * 0.5, 'ink', bx, top, bz);
  for (const ex of [bx - beltLen / 2, bx + beltLen / 2]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, d * 0.52, 10), paletteMaterial('cream'));
    roller.rotation.x = Math.PI / 2;
    roller.position.set(ex, top + 0.03, bz);
    b.add(roller);
  }
  slab(b, beltLen, 0.08, 0.04, 'cream', bx, top, bz + d * 0.27);
  const STRIPES = 8;
  const stripes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.035, 0.012, d * 0.48),
    paletteMaterial('cream'),
    STRIPES,
  );
  stripes.frustumCulled = false;
  stripes.position.set(bx, top + 0.055, bz);
  const stripe = new THREE.Matrix4();
  b.add(dynamic(stripes));
  // till on a riser at the back, facing the Cashier
  const tx = w / 2 - 0.55;
  slab(b, 0.6, 0.14, 0.55, 'wood', tx, top, -d * 0.2);
  const till = model('cash-register');
  till.position.set(tx, top + 0.14, -d * 0.2);
  till.rotation.y = Math.PI;
  b.add(till);
  // bagging tray past the belt
  const bagX = w / 2 - 0.4;
  const bagZ = d * 0.22;
  slab(b, 0.7, 0.02, 0.5, 'cream', bagX, top, bagZ);
  slab(b, 0.7, 0.12, 0.04, 'wood', bagX, top, bagZ + 0.25);
  slab(b, 0.7, 0.12, 0.04, 'wood', bagX, top, bagZ - 0.25);
  slab(b, 0.04, 0.12, 0.5, 'wood', bagX + 0.35, top, bagZ);
  // lane light on a post behind the till
  const lx = w / 2 - 0.1;
  const lz = -d / 2 + 0.1;
  slab(b, 0.06, 1, 0.06, 'woodDark', lx, top, lz);
  const lampMat = new THREE.MeshStandardMaterial({ color: PALETTE.orange, emissive: PALETTE.orange });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 12), lampMat);
  lamp.position.set(lx, top + 1.05, lz);
  lamp.castShadow = true;
  b.add(dynamic(lamp));
  v.belt = [
    new THREE.Vector3(bx - beltLen / 2 + 0.15, top + 0.05, bz),
    new THREE.Vector3(bx + beltLen / 2 - 0.1, top + 0.05, bz),
    new THREE.Vector3(bagX - 0.1, top + 0.02, bagZ),
  ];
  let shift = 0;
  let glow = FEEL.laneLightIdle;
  v.animate = (dt, working) => {
    if (working) shift = (shift + dt * FEEL.beltSpeed) % (beltLen / STRIPES);
    for (let i = 0; i < STRIPES; i++)
      stripes.setMatrixAt(
        i,
        stripe.makeTranslation(-beltLen / 2 + (((i * beltLen) / STRIPES + shift) % beltLen), 0, 0),
      );
    stripes.instanceMatrix.needsUpdate = true;
    glow += ((working ? FEEL.laneLightScan : FEEL.laneLightIdle) - glow) * Math.min(1, dt * 6);
    lampMat.emissiveIntensity = glow;
  };
}
