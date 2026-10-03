// The static map: ground, Street, road, shop floor, walls, doors, locked Areas, Props, Car Spots and the van.
import * as THREE from 'three';
import type { Box, MapLayout, Point } from '../sim/map';
import { boxCentre, inBox } from '../sim/geometry';
import { model } from './assets';
import { paletteMaterial } from './materials';
import { FEEL } from '../feel';
import { dynamic, mergeStatic } from './merge';

const WALL_HEIGHT = { tall: 2.4, low: 0.6, partition: 1.2, window: 1 };
const DOOR_HEIGHT = 2.2;

function slab(token: string, b: Box, y: number, thick = 0.02): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b[2], thick, b[3]), paletteMaterial(token));
  m.position.set(b[0] + b[2] / 2, y - thick / 2, b[1] + b[3] / 2);
  m.receiveShadow = true;
  return m;
}

function block(token: string, b: Box, h: number, y = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b[2], h, b[3]), paletteMaterial(token));
  m.position.set(b[0] + b[2] / 2, y + h / 2, b[1] + b[3] / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

interface Door {
  box: Box;
  area: string | null;
  panels: THREE.Mesh[];
  open: number;
  axis: 'x' | 'z';
}

interface AreaLook {
  dirt: THREE.Mesh[];
  ropes: THREE.Object3D[];
  floorCells: number[];
}

export class Level {
  readonly group = new THREE.Group();
  readonly partyProps: THREE.Object3D[] = [];
  private doors: Door[] = [];
  private areas = new Map<string, AreaLook>();
  private floor: THREE.InstancedMesh[] = [];
  private props: { obj: THREE.Object3D; area?: string; party: boolean }[] = [];

  constructor(
    private readonly L: MapLayout,
    private readonly areaOf: (b: Box) => string | null,
    alwaysOwned: string[],
  ) {
    const [W, H] = L.size;
    this.group.add(slab('grass', [0, 0, W, H], 0, 0.2));
    for (const b of L.street) this.group.add(slab('path', b, 0.004));
    for (const b of L.roads) this.group.add(slab('road', b, 0.004));
    this.buildCarSpots();
    this.buildFloor();
    for (const [id, rects] of Object.entries(L.areas)) {
      const look: AreaLook = { dirt: [], ropes: [], floorCells: [] };
      for (const r of rects) {
        const dirt = slab('dirt', r, 0.006);
        (dirt.material as THREE.Material) = paletteMaterial('dirt').clone();
        this.group.add(dynamic(dirt));
        look.dirt.push(dirt);
      }
      look.ropes = this.buildRopes(rects);
      this.areas.set(id, look);
    }
    for (const w of Object.values(L.walls)) {
      const h = WALL_HEIGHT[w.kind];
      this.group.add(block(w.kind === 'window' ? 'wood' : 'cream', w.box, h));
      this.group.add(block('wood', [w.box[0] - 0.02, w.box[1] - 0.02, w.box[2] + 0.04, w.box[3] + 0.04], 0.12, h));
    }
    for (const d of Object.values(L.doors)) this.buildDoor(d.kind, d.box);
    for (const p of Object.values(L.props)) {
      const fit: [number, number] = p.rot % 180 === 0 ? [p.box[2], p.box[3]] : [p.box[3], p.box[2]];
      const obj = model(p.model, { fit });
      const [x, z] = boxCentre(p.box);
      obj.position.set(x, 0, z);
      obj.rotation.y = THREE.MathUtils.degToRad(p.rot);
      if (p.party) obj.visible = false;
      // Props of Areas that can be locked toggle; the rest merge into the static batch
      if (p.party || (p.area && !alwaysOwned.includes(p.area))) dynamic(obj);
      this.group.add(obj);
      this.props.push({ obj, area: p.area, party: !!p.party });
      if (p.party) this.partyProps.push(obj);
    }
    const van = model('van', { fit: [L.van[2], L.van[3]] });
    const [vx, vz] = boxCentre(L.van);
    van.position.set(vx, 0, vz);
    this.group.add(dynamic(van));
    this.van = van;
    mergeStatic(this.group);
  }

  readonly van: THREE.Object3D;

  private buildCarSpots(): void {
    const line = paletteMaterial('cream');
    for (const s of this.L.carSpots) {
      const [x, , w, d] = s.car;
      for (const lx of [x, x + w]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, d), line);
        m.position.set(lx, 0.01, s.car[1] + d / 2);
        this.group.add(m);
      }
      const p = s.pickup;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(p[2], 0.01, p[3]), paletteMaterial('path'));
      tile.position.set(p[0] + p[2] / 2, 0.012, p[1] + p[3] / 2);
      tile.receiveShadow = true;
      this.group.add(tile);
    }
  }

  private buildFloor(): void {
    const cells: Point[] = [];
    for (const f of this.L.floors)
      for (let x = Math.floor(f[0]); x < f[0] + f[2]; x++)
        for (let z = Math.floor(f[1]); z < f[1] + f[3]; z++) cells.push([x + 0.5, z + 0.5]);
    const tile = model('market-floor', { fit: [1, 1] });
    tile.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    tile.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, cells.length);
      inst.receiveShadow = true;
      cells.forEach(([x, z], i) => {
        m.makeTranslation(x, 0.01, z).multiply(mesh.matrixWorld);
        inst.setMatrixAt(i, m);
        inst.setColorAt(i, new THREE.Color(1, 1, 1));
      });
      this.floor.push(inst);
      this.group.add(inst);
    });
    this.floorCells = cells;
  }

  private floorCells: Point[] = [];

  /** One merged rope group per Area. */
  private buildRopes(rects: Box[]): THREE.Object3D[] {
    const ropes = dynamic(new THREE.Group());
    const wallBoxes = Object.values(this.L.walls).map((w) => w.box);
    const nearWall = (x: number, z: number) =>
      wallBoxes.some((b) => inBox(x, z, [b[0] - 0.3, b[1] - 0.3, b[2] + 0.6, b[3] + 0.6]));
    const inOther = (x: number, z: number) => rects.some((r) => inBox(x, z, r, 0.01));
    for (const r of rects) {
      const edges: [number, number, number, number, boolean][] = [
        [r[0], r[1], r[2], 0, true],
        [r[0], r[1] + r[3], r[2], 0, true],
        [r[0], r[1], r[3], 0, false],
        [r[0] + r[2], r[1], r[3], 0, false],
      ];
      for (const [x0, z0, len, , alongX] of edges) {
        for (let i = 0; i < Math.round(len); i++) {
          const x = alongX ? x0 + i + 0.5 : x0;
          const z = alongX ? z0 : z0 + i + 0.5;
          const [W, H] = this.L.size;
          if (nearWall(x, z) || x <= 0.1 || z <= 0.1 || x >= W - 0.1 || z >= H - 0.1) continue;
          // skip edges shared with another rect of the same Area
          if (
            inOther(x + (alongX ? 0 : 0.2), z + (alongX ? 0.2 : 0)) &&
            inOther(x - (alongX ? 0 : 0.2), z - (alongX ? 0.2 : 0))
          )
            continue;
          const rope = model('rope', { fit: [1, 0.3] });
          rope.position.set(x, 0, z);
          if (!alongX) rope.rotation.y = Math.PI / 2;
          ropes.add(rope);
        }
      }
    }
    mergeStatic(ropes);
    this.group.add(ropes);
    return [ropes];
  }

  private buildDoor(kind: string, box: Box): void {
    const axis = box[2] >= box[3] ? 'x' : 'z';
    const len = axis === 'x' ? box[2] : box[3];
    const door: Door = { box, area: this.areaOf(box), panels: [], open: 0, axis };
    if (kind !== 'office') {
      const mat =
        kind === 'customer'
          ? new THREE.MeshStandardMaterial({ color: '#bfe6f2', transparent: true, opacity: 0.55, roughness: 0.1 })
          : paletteMaterial('woodDark');
      for (const side of [-1, 1]) {
        const w = len / 2;
        const g = new THREE.BoxGeometry(axis === 'x' ? w : 0.08, DOOR_HEIGHT, axis === 'x' ? 0.08 : w);
        const p = new THREE.Mesh(g, mat);
        p.castShadow = kind !== 'customer';
        p.userData.side = side;
        this.group.add(dynamic(p));
        door.panels.push(p);
      }
      const [cx, cz] = boxCentre(box);
      const lintel = block('wood', [box[0], box[1], box[2], box[3]], 0.2, DOOR_HEIGHT);
      lintel.position.set(cx, DOOR_HEIGHT + 0.1, cz);
      this.group.add(lintel);
    }
    this.doors.push(door);
  }

  /** Locked Areas: dirt, rope, darker floor; bought ones pave in. */
  setOwned(owned: Set<string>, animate: boolean): void {
    for (const [id, look] of this.areas) {
      const isOwned = owned.has(id);
      for (const d of look.dirt) {
        const mat = d.material as THREE.MeshStandardMaterial;
        const target = isOwned ? 0 : 1;
        mat.transparent = true;
        if (!animate) mat.opacity = target;
        d.userData.target = target;
        d.visible = !isOwned || animate;
      }
      for (const r of look.ropes) {
        r.userData.target = isOwned ? 0 : 1;
        if (!animate) r.scale.y = r.userData.target;
        r.visible = r.scale.y > 0.01 || !isOwned;
      }
    }
    const locked = new THREE.Color(0.62, 0.55, 0.48);
    const white = new THREE.Color(1, 1, 1);
    this.floorCells.forEach(([x, z], i) => {
      const area = this.areaOf([x - 0.5, z - 0.5, 1, 1]);
      for (const inst of this.floor) inst.setColorAt(i, area && !owned.has(area) ? locked : white);
    });
    for (const inst of this.floor) if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    for (const p of this.props) if (p.area && !p.party) p.obj.visible = owned.has(p.area);
    this.owned = owned;
  }

  private owned = new Set<string>();

  showParty(on: boolean): void {
    for (const p of this.partyProps) p.visible = on;
  }

  /** Door slides and Area paving, each frame. `near` = characters' positions. */
  update(dt: number, near: Point[]): void {
    for (const d of this.doors) {
      const [cx, cz] = boxCentre(d.box);
      const shut = d.area !== null && !this.owned.has(d.area);
      const want = !shut && near.some(([x, z]) => Math.hypot(x - cx, z - cz) < FEEL.doorOpenRadius) ? 1 : 0;
      d.open += (want - d.open) * Math.min(1, dt * 8);
      const len = d.axis === 'x' ? d.box[2] : d.box[3];
      for (const p of d.panels) {
        const off = (p.userData.side as number) * (len / 4 + (d.open * len) / 2.2);
        p.position.set(cx + (d.axis === 'x' ? off : 0), DOOR_HEIGHT / 2, cz + (d.axis === 'z' ? off : 0));
      }
    }
    for (const look of this.areas.values()) {
      for (const dirt of look.dirt) {
        const mat = dirt.material as THREE.MeshStandardMaterial;
        mat.opacity += ((dirt.userData.target ?? 1) - mat.opacity) * Math.min(1, dt * 2);
        dirt.visible = mat.opacity > 0.01;
      }
      for (const r of look.ropes) {
        r.scale.y += ((r.userData.target ?? 1) - r.scale.y) * Math.min(1, dt * 5);
        r.visible = r.scale.y > 0.02;
      }
    }
  }
}
