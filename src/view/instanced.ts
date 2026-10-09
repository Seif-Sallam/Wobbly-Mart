// Draws many copies of models: all Items, bills and baskets in one BatchedMesh per material (ModelBatch), or one
// InstancedMesh per model and material where the browser can't multi-draw. Animals keep their own animation (LiveInstances).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { model } from './assets';
import { ITEM_SIZE } from '../../catalog/assets';
import { bakePalette, paletteMaterial } from './materials';
import { SHADES } from '../palette';

export class InstancedModel {
  private parts: { mesh: THREE.InstancedMesh; local: THREE.Matrix4 }[] = [];
  private count = 0;
  private readonly tmp = new THREE.Matrix4();

  constructor(
    source: THREE.Object3D,
    private readonly max: number,
    parent: THREE.Object3D,
    shadows = true,
  ) {
    for (const m of byMaterial(source)) {
      const mesh = new THREE.InstancedMesh(m.geometry, m.material, max);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      parent.add(mesh);
      this.parts.push({ mesh, local: m.matrixWorld.clone() });
    }
  }

  begin(): void {
    this.count = 0;
  }

  add(matrix: THREE.Matrix4): void {
    if (this.count >= this.max) return;
    for (const p of this.parts) p.mesh.setMatrixAt(this.count, this.tmp.multiplyMatrices(matrix, p.local));
    this.count++;
  }

  end(): void {
    for (const p of this.parts) {
      p.mesh.count = this.count;
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

/** Draws copies of several models by name, each frame between begin() and end(). */
export interface ModelDrawer {
  begin(): void;
  add(name: string, matrix: THREE.Matrix4): void;
  end(): void;
}

/** One draw call per material for every copy of every model (needs WEBGL_multi_draw; without it each copy is a draw). */
class ModelBatch implements ModelDrawer {
  private batches: { mesh: THREE.BatchedMesh; ids: number[]; used: number; shown: number }[] = [];
  private parts = new Map<string, { batch: number; geometry: number; local: THREE.Matrix4 }[]>();
  private readonly tmp = new THREE.Matrix4();

  constructor(
    models: Map<string, THREE.Object3D>,
    private readonly max: number,
    parent: THREE.Object3D,
  ) {
    const buckets = new Map<
      string,
      { material: THREE.Material; list: { name: string; geometry: THREE.BufferGeometry; local: THREE.Matrix4 }[] }
    >();
    for (const [name, source] of models)
      for (const m of byMaterial(source)) {
        const { geometry, material } = bakePalette(m.geometry.clone(), m.material as THREE.Material);
        const key = `${material.uuid}|${Object.keys(geometry.attributes).sort().join()}|${geometry.index ? 'i' : 'n'}`;
        if (!buckets.has(key)) buckets.set(key, { material, list: [] });
        buckets.get(key)?.list.push({ name, geometry, local: m.matrixWorld.clone() });
      }
    for (const { material, list } of buckets.values()) {
      const verts = list.reduce((n, p) => n + p.geometry.attributes.position.count, 0);
      const indices = list.reduce((n, p) => n + (p.geometry.index?.count ?? 0), 0);
      const mesh = new THREE.BatchedMesh(max, verts, Math.max(1, indices), material);
      mesh.perObjectFrustumCulled = false;
      mesh.sortObjects = false;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      const batch = this.batches.push({ mesh, ids: [], used: 0, shown: 0 }) - 1;
      for (const p of list)
        this.parts.set(p.name, [
          ...(this.parts.get(p.name) ?? []),
          { batch, geometry: mesh.addGeometry(p.geometry), local: p.local },
        ]);
    }
  }

  begin(): void {
    for (const b of this.batches) b.used = 0;
  }

  add(name: string, matrix: THREE.Matrix4): void {
    for (const p of this.parts.get(name) ?? []) {
      const b = this.batches[p.batch];
      let id = b.ids[b.used];
      if (id === undefined) {
        if (b.ids.length >= this.max) continue;
        id = b.mesh.addInstance(p.geometry);
        b.ids.push(id);
      } else b.mesh.setGeometryIdAt(id, p.geometry);
      b.used++;
      b.mesh.setMatrixAt(id, this.tmp.multiplyMatrices(matrix, p.local));
      b.mesh.setVisibleAt(id, true);
    }
  }

  end(): void {
    for (const b of this.batches) {
      for (let i = b.used; i < b.shown; i++) b.mesh.setVisibleAt(b.ids[i], false);
      b.shown = b.used;
    }
  }
}

/** Fallback: one InstancedModel per model. */
class PerModel implements ModelDrawer {
  private models = new Map<string, InstancedModel>();

  constructor(models: Map<string, THREE.Object3D>, max: number, parent: THREE.Object3D) {
    for (const [name, source] of models) this.models.set(name, new InstancedModel(source, max, parent));
  }

  begin(): void {
    for (const m of this.models.values()) m.begin();
  }

  add(name: string, matrix: THREE.Matrix4): void {
    this.models.get(name)?.add(matrix);
  }

  end(): void {
    for (const m of this.models.values()) m.end();
  }
}

/** Up to `max` copies of each model: batched when the browser can multi-draw, else instanced per model. */
export function modelDrawer(
  models: Map<string, THREE.Object3D>,
  max: number,
  parent: THREE.Object3D,
  multiDraw: boolean,
): ModelDrawer {
  return multiDraw ? new ModelBatch(models, max * models.size, parent) : new PerModel(models, max, parent);
}

/** A model's sub-meshes with the same material merged into one (fewer draw calls per copy). */
function byMaterial(source: THREE.Object3D): THREE.Mesh[] {
  source.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  source.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const attrs = Object.keys(m.geometry.attributes).sort().join();
    const key = `${m.material.uuid}|${attrs}|${m.geometry.index ? 'i' : 'n'}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  });
  return [...groups.values()].flatMap((list) => {
    if (list.length === 1) return list;
    const merged = mergeGeometries(list.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld)));
    return merged ? [new THREE.Mesh(merged, list[0].material)] : list;
  });
}

/** Animated copies (each moved by its own mixer, hidden) drawn from their parts' live matrices: one entry per part. */
export class LiveInstances {
  private drawer: ModelDrawer;
  private sources: { key: string; mesh: THREE.Mesh }[] = [];

  /** `templates`: one copy of each model that may be adopted, so its parts are known up front. */
  constructor(templates: THREE.Object3D[], max: number, parent: THREE.Object3D, multiDraw: boolean) {
    const parts = new Map<string, THREE.Object3D>();
    for (const t of templates)
      t.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !Array.isArray(m.material)) parts.set(partKey(m), new THREE.Mesh(m.geometry, m.material));
      });
    this.drawer = modelDrawer(parts, max, parent, multiDraw);
  }

  /** Takes over drawing every mesh under `obj`; it keeps animating, hidden. */
  adopt(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      this.sources.push({ key: partKey(m), mesh: m });
      m.visible = false;
    });
  }

  clear(): void {
    this.sources = [];
    this.update();
  }

  update(): void {
    this.drawer.begin();
    for (const { key, mesh } of this.sources) {
      mesh.updateWorldMatrix(true, false);
      this.drawer.add(key, mesh.matrixWorld);
    }
    this.drawer.end();
  }
}

const partKey = (m: THREE.Mesh): string => `${m.geometry.uuid}|${(m.material as THREE.Material).uuid}`;

/** Procedural Wheat: a gold bundle of stalks with a tie. */
export function wheatSheaf(height: number): THREE.Group {
  const g = new THREE.Group();
  const stalk = new THREE.CylinderGeometry(0.035, 0.03, height, 5);
  const gold = paletteMaterial(SHADES.wheat);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.06;
    const m = new THREE.Mesh(stalk, gold);
    m.position.set(Math.cos(a) * r, height / 2, Math.sin(a) * r);
    m.rotation.set(Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12);
    g.add(m);
  }
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, height * 0.35, 7), paletteMaterial(SHADES.wheatHead));
  head.position.y = height * 0.92;
  head.rotation.x = Math.PI;
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), paletteMaterial('wood'));
  tie.position.y = height * 0.4;
  g.add(head, tie);
  return g;
}

/** Procedural Money: a green bill with a cream band. */
export function billModel(): THREE.Group {
  const g = new THREE.Group();
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.26), paletteMaterial('money'));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.065, 0.27), paletteMaterial('cream'));
  g.add(bill, band);
  return g;
}

/** The model an Item of this product is drawn with. */
export function itemModel(name: string): THREE.Group {
  return name === 'wheat' ? wheatSheaf(ITEM_SIZE * 1.24) : model(name);
}
