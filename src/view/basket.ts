// Customers' hand baskets: the first Items sit inside, the rest tower out of it and wobble, even standing still.
import * as THREE from 'three';
import { ITEM_SIZE } from '../../catalog/assets';
import { FEEL } from '../feel';

/** Stable per-Customer roll: does this one carry a basket? View only, the sim doesn't know. */
export const hasBasket = (id: number): boolean => ((id * 2654435761) % 1000) / 1000 < FEEL.basketChance;

/** The Stack lean, strengthened, plus an idle sway phase-shifted per Customer. */
export function basketLean(id: number, lean: THREE.Vector2): THREE.Vector2 {
  const t = performance.now() / 1000;
  const a = FEEL.basketSway;
  const k = FEEL.basketLean;
  return new THREE.Vector2(
    lean.x * k + Math.sin(t * FEEL.basketSwaySpeed + id) * a,
    lean.y * k + Math.cos(t * FEEL.basketSwaySpeed * 0.8 + id * 1.7) * a * 0.6,
  );
}

/** Hung from the right hand: beside the Customer and a little ahead. */
export function basketPose(x: number, z: number, facing: number): THREE.Vector3 {
  const side = 0.38;
  const ahead = 0.15;
  return new THREE.Vector3(
    x + Math.sin(facing) * ahead - Math.cos(facing) * side,
    0.42,
    z + Math.cos(facing) * ahead + Math.sin(facing) * side,
  );
}

/** Item `i`'s position: inside the basket, then up the tower, bent by `lean`. */
export function basketSlot(x: number, z: number, facing: number, i: number, lean: THREE.Vector2): THREE.Vector3 {
  const p = basketPose(x, z, facing);
  const item = ITEM_SIZE * FEEL.basketItemScale;
  const floor = 0.08;
  const inside = FEEL.basketInside;
  if (i < inside) {
    const a = (i - (inside - 1) / 2) * item * 0.5;
    return new THREE.Vector3(p.x - Math.cos(facing) * a, p.y + floor, p.z + Math.sin(facing) * a);
  }
  const h = (i - inside + 1) * item * FEEL.basketTowerGap;
  const bend = h ** 1.4 * 0.5;
  return new THREE.Vector3(p.x + lean.x * bend, p.y + floor + h, p.z + lean.y * bend);
}
