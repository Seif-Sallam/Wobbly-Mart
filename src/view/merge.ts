// Merges static meshes under a root into one mesh per material (draw-call budget). Skips anything marked dynamic.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Mark a node (and everything under it) as moving/toggling so it stays its own mesh. */
export function dynamic<T extends THREE.Object3D>(o: T): T {
  o.userData.dynamic = true;
  return o;
}

function isDynamic(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n && n !== root; n = n.parent) if (n.userData.dynamic) return true;
  return false;
}

export function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean }>();
  const merged: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (
      !m.isMesh ||
      (m as unknown as THREE.SkinnedMesh).isSkinnedMesh ||
      (m as unknown as THREE.InstancedMesh).isInstancedMesh
    )
      return;
    if (Array.isArray(m.material) || isDynamic(m, root) || !m.visible) return;
    const g = m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    for (const name of Object.keys(g.attributes))
      if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    const attrs = Object.keys(g.attributes)
      .sort()
      .map((n) => `${n}${g.attributes[n].itemSize}${g.attributes[n].normalized}`)
      .join();
    const key = `${m.material.uuid}|${attrs}|${g.index ? 'i' : 'n'}|${g.attributes.position.array.constructor.name}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material: m.material, geos: [], cast: false }));
    b.geos.push(g);
    b.cast ||= m.castShadow;
    merged.push(m);
  });
  for (const m of merged) m.removeFromParent();
  for (const b of buckets.values()) {
    const geometry = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos);
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  // drop groups left empty
  const empty: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && !(o as THREE.Mesh).isMesh && o.children.length === 0 && !isDynamic(o, root) && o.type === 'Group')
      empty.push(o);
  });
  for (const o of empty) o.removeFromParent();
}
