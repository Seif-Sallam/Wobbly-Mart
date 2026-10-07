// Small code-built geometry helpers shared by Station and stand builders.
import * as THREE from 'three';
import { paletteMaterial } from './materials';

/** cols × rows positions spanning w × d, centred on (cx, cz) at height y. */
export function grid(cols: number, rows: number, w: number, d: number, y: number, cx = 0, cz = 0): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push(
        new THREE.Vector3(
          cx + (cols > 1 ? (c / (cols - 1) - 0.5) * w : 0),
          y,
          cz + (rows > 1 ? (r / (rows - 1) - 0.5) * d : 0),
        ),
      );
  return out;
}

/** A palette-coloured box standing on `y` at (x, z). */
export function slab(parent: THREE.Object3D, w: number, h: number, d: number, colour: string, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paletteMaterial(colour));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent: THREE.Object3D, r: number, h: number, colour: string, x = 0, y = 0, z = 0, rBottom = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, rBottom, h, 12), paletteMaterial(colour));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
