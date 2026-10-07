// Draws many copies of a (multi-mesh) model with one InstancedMesh per sub-mesh: Items and Money bills.
import * as THREE from 'three';
import { model } from './assets';
import { ITEM_SIZE } from '../../catalog/assets';
import { paletteMaterial } from './materials';
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
    source.updateMatrixWorld(true);
    source.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mesh = new THREE.InstancedMesh(m.geometry, m.material, max);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      parent.add(mesh);
      this.parts.push({ mesh, local: m.matrixWorld.clone() });
    });
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
