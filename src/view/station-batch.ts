// Every Station's static parts in one mesh per material (draw-call budget). A per-vertex Station index lets each
// Station still spring up and bounce: the vertex shader scales its vertices about the Station's centre.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX_STATIONS = 48;

interface Part {
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
  cast: boolean;
}

export class StationBatch {
  readonly group = new THREE.Group();
  private slots = new Map<string, number>();
  private parts = new Map<string, Part[]>();
  private patched = new Map<string, THREE.Material>();
  private scale = Array.from({ length: MAX_STATIONS }, () => new THREE.Vector4(1, 1, 0, 0));
  private centre = Array.from({ length: MAX_STATIONS }, () => new THREE.Vector3());

  /** Takes over the static meshes under `body` (everything not marked dynamic). */
  add(id: string, body: THREE.Object3D, centre: THREE.Vector3): void {
    if (this.slots.size >= MAX_STATIONS) return;
    const slot = this.slots.get(id) ?? this.slots.size;
    this.slots.set(id, slot);
    this.centre[slot].copy(centre);
    (body.parent ?? body).updateMatrixWorld(true);
    const parts: Part[] = [];
    const taken: THREE.Mesh[] = [];
    for (const o of body.children) {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.dynamic || Array.isArray(m.material)) continue;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      for (const name of Object.keys(g.attributes))
        if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      g.setAttribute(
        'aStation',
        new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(slot), 1),
      );
      parts.push({ material: m.material, geometry: g.index ? g.toNonIndexed() : g, cast: m.castShadow });
      taken.push(m);
    }
    for (const m of taken) m.removeFromParent();
    this.parts.set(id, parts);
    this.rebuild();
  }

  /** Scale a Station's baked parts (spring-up, bounce). */
  setScale(id: string, xz: number, y: number): void {
    const slot = this.slots.get(id);
    if (slot !== undefined) this.scale[slot].set(xz, y, 0, 0);
  }

  clear(): void {
    this.slots.clear();
    this.parts.clear();
    for (const s of this.scale) s.set(1, 1, 0, 0);
    this.rebuild();
  }

  private rebuild(): void {
    for (const c of [...this.group.children]) {
      c.removeFromParent();
      (c as THREE.Mesh).geometry.dispose();
    }
    const buckets = new Map<string, Part[]>();
    for (const list of this.parts.values())
      for (const p of list) {
        const key = `${p.material.uuid}|${Object.keys(p.geometry.attributes).sort().join()}`;
        buckets.set(key, [...(buckets.get(key) ?? []), p]);
      }
    for (const list of buckets.values()) {
      const geometry = mergeGeometries(list.map((p) => p.geometry));
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, this.material(list[0].material));
      mesh.castShadow = list.some((p) => p.cast);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  private material(src: THREE.Material): THREE.Material {
    let m = this.patched.get(src.uuid);
    if (m) return m;
    m = src.clone();
    const uniforms = { uStationScale: { value: this.scale }, uStationCentre: { value: this.centre } };
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aStation;
uniform vec4 uStationScale[${MAX_STATIONS}];
uniform vec3 uStationCentre[${MAX_STATIONS}];`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
int si = int(aStation + 0.5);
vec3 sc = uStationCentre[si];
transformed = sc + (transformed - sc) * vec3(uStationScale[si].x, uStationScale[si].y, uStationScale[si].x);`,
        );
    };
    this.patched.set(src.uuid, m);
    return m;
  }
}
