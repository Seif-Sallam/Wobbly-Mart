import * as THREE from 'three';
import { DERIVED, PALETTE } from '../palette';

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared material for a palette colour name (or a derived one like `dirtDark`), or any CSS colour. */
export function paletteMaterial(name: string): THREE.MeshStandardMaterial {
  let m = cache.get(name);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: paletteColor(name), roughness: 0.9 });
  cache.set(name, m);
  return m;
}

export function paletteColor(name: string): THREE.Color {
  if (name in PALETTE) return new THREE.Color(PALETTE[name as keyof typeof PALETTE]);
  if (name in DERIVED) {
    const [base, f] = DERIVED[name as keyof typeof DERIVED];
    return new THREE.Color(PALETTE[base]).multiplyScalar(f);
  }
  return new THREE.Color(name);
}
