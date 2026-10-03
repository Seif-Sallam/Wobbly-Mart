// Station visuals: one builder per model name. Each knows where its Items sit and how it moves while working.
import * as THREE from 'three';
import type { Box, Rot } from '../sim/map';
import { clipsOf, model, naturalSize } from './assets';
import { paletteMaterial } from './materials';

export interface StationVisual {
  /** At the box centre, rotated; children are in local metres with the front at +z. */
  root: THREE.Group;
  /** Scaled for spring-up and per-Item bounces. */
  body: THREE.Group;
  /** Local positions for displayed Items (Shelf stock or Tray). */
  slots: THREE.Vector3[];
  /** Local positions for Recipe inputs waiting to be used. */
  inputSlots: THREE.Vector3[];
  /** Local positions of Crop plants. */
  plants: THREE.Vector3[];
  plantVisuals: THREE.Object3D[];
  mixers: THREE.AnimationMixer[];
  /** Per-frame motion; `working` while a Machine/Animal is busy. */
  animate: (dt: number, working: boolean) => void;
}

const ITEM_GAP = 0.36;

function footprint(box: Box, rot: Rot): [number, number] {
  return rot % 180 === 0 ? [box[2], box[3]] : [box[3], box[2]];
}

function grid(cols: number, rows: number, w: number, d: number, y: number, cx = 0, cz = 0): THREE.Vector3[] {
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

function playIdle(obj: THREE.Object3D, name: string, mixers: THREE.AnimationMixer[], clip = 'idle'): void {
  const c = clipsOf(name).find((a) => a.name === clip);
  if (!c) return;
  const mixer = new THREE.AnimationMixer(obj);
  const action = mixer.clipAction(c);
  action.time = Math.random() * c.duration;
  action.play();
  mixers.push(mixer);
}

function tray(body: THREE.Group, x: number, z: number): THREE.Vector3[] {
  const t = model('tray');
  t.position.set(x, 0, z);
  body.add(t);
  return grid(3, 2, 0.36, 0.22, 0.12, x, z)
    .concat(grid(3, 2, 0.36, 0.22, 0.42, x, z))
    .slice(0, 6);
}

function fence(body: THREE.Group, w: number, d: number): void {
  const post = naturalSize('fence-post');
  const add = (x: number, z: number, along: 'x' | 'z', len: number) => {
    const n = Math.max(1, Math.round(len / 1));
    for (let i = 0; i < n; i++) {
      const f = model('fence-post', { height: 0.55 });
      const k = (i + 0.5) / n - 0.5;
      f.scale.x *= len / n / (post.x * (0.55 / post.y));
      if (along === 'x') f.position.set(x + k * len, 0, z);
      else {
        f.position.set(x, 0, z + k * len);
        f.rotation.y = Math.PI / 2;
      }
      body.add(f);
    }
  };
  add(0, -d / 2, 'x', w);
  add(-w / 2, 0, 'z', d);
  add(w / 2, 0, 'z', d);
  add(-w / 4 - 0.15, d / 2, 'x', w / 2 - 0.3);
}

function shelf(name: string, w: number, d: number, v: StationVisual): void {
  const m = model(name, { fit: [w, d] });
  v.body.add(m);
  const h = new THREE.Box3().setFromObject(m).max.y;
  const cols = Math.max(1, Math.floor((w - 0.2) / ITEM_GAP));
  if (h < 1.3) {
    v.slots = [...grid(cols, 2, w - 0.5, d * 0.4, h + 0.02), ...grid(cols, 2, w - 0.5, d * 0.4, h + 0.34)];
  } else {
    const fz = d / 2 - 0.2;
    v.slots = [0.22, 0.5, 0.78].flatMap((f) => grid(cols, 1, w - 0.5, 0, h * f, 0, fz));
    v.slots.push(...grid(cols, 1, w - 0.5, 0, h + 0.02, 0, 0));
  }
}

function crop(kind: 'tomato' | 'wheat', w: number, d: number, plants: number, v: StationVisual): void {
  const rows = Math.max(1, Math.round(w / 1));
  for (let i = 0; i < rows; i++) {
    const row = model('crops-row', { fit: [w / rows, d] });
    row.position.x = (i / rows - 0.5) * w + w / rows / 2;
    v.body.add(row);
  }
  const cols = plants <= 4 ? 2 : 4;
  v.plants = grid(cols, Math.ceil(plants / cols), w * 0.55, d * 0.55, 0.12).slice(0, plants);
  for (const p of v.plants) {
    const plant = kind === 'tomato' ? model('tomato-bush') : model('wheat-plant');
    plant.position.copy(p);
    plant.rotation.y = Math.random() * Math.PI * 2;
    v.body.add(plant);
    v.plantVisuals.push(plant);
  }
}

function coop(name: 'chick' | 'cow', w: number, d: number, v: StationVisual): void {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), paletteMaterial(name === 'cow' ? 'dirt' : 'path'));
  ground.position.y = 0.02;
  ground.receiveShadow = true;
  v.body.add(ground);
  fence(v.body, w, d);
  const hut = new THREE.Group();
  const walls = model('wall-wood', { height: 0.7 });
  const roof = model('roof', { height: 0.5 });
  roof.position.y = 0.7;
  hut.add(walls, roof);
  hut.scale.setScalar(name === 'cow' ? 1 : 0.8);
  hut.position.set(-w / 2 + 0.5, 0, -d / 2 + 0.45);
  v.body.add(hut);
  const animals = name === 'cow' ? 1 : 3;
  for (let i = 0; i < animals; i++) {
    const a = model(name);
    a.position.set((i - (animals - 1) / 2) * 0.5 + 0.1, 0.04, 0.1 + (i % 2) * 0.2);
    a.rotation.y = (Math.random() - 0.5) * 1.5;
    v.body.add(a);
    playIdle(a, name, v.mixers);
  }
  const trough = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.32), paletteMaterial('woodDark'));
  trough.position.set(w / 2 - 0.55, 0.09, -d / 2 + 0.35);
  trough.castShadow = true;
  v.body.add(trough);
  v.inputSlots = grid(3, 2, 0.45, 0.12, 0.2, w / 2 - 0.55, -d / 2 + 0.35);
  v.slots = tray(v.body, w / 2 - 0.35, d / 2 - 0.3);
}

function counter(w: number, d: number, v: StationVisual): number {
  const bar = model('kitchen-bar', { fit: [w * 0.75, d * 0.9] });
  bar.position.x = -w * 0.12;
  v.body.add(bar);
  return new THREE.Box3().setFromObject(bar).max.y;
}

function build(name: string, w: number, d: number, v: StationVisual): void {
  switch (name) {
    case 'display-fruit':
    case 'shelf-boxes':
    case 'shelf-bags':
    case 'freezers-standing':
    case 'display-bread':
      return shelf(name, w, d, v);
    case 'tomato-bed':
      return crop('tomato', w, d, 4, v);
    case 'wheat-field':
      return crop('wheat', w, d, 4, v);
    case 'chicken-coop':
      return coop('chick', w, d, v);
    case 'cow-pen':
      return coop('cow', w, d, v);
    case 'blender': {
      const top = counter(w, d, v);
      const b = model('kitchen-blender');
      b.position.set(-w * 0.12, top, 0);
      v.body.add(b);
      v.inputSlots = grid(3, 2, 0.4, 0.2, top, -w * 0.32, 0);
      v.slots = tray(v.body, w / 2 - 0.2, 0.1);
      let t = 0;
      v.animate = (dt, working) => {
        t += dt;
        b.rotation.z = working ? Math.sin(t * 33) * 0.08 : 0;
        b.position.x = -w * 0.12 + (working ? Math.sin(t * 43) * 0.02 : 0);
      };
      return;
    }
    case 'mill': {
      const hut = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 1.3, d * 0.6), paletteMaterial('wood'));
      hut.position.set(0, 0.65, -d * 0.1);
      hut.castShadow = hut.receiveShadow = true;
      const roof = model('roof', { fit: [w * 0.75, d * 0.75] });
      roof.position.set(0, 1.3, -d * 0.1);
      const sails = model('windmill');
      sails.rotation.y = Math.PI / 2;
      sails.position.sub(new THREE.Box3().setFromObject(sails).getCenter(new THREE.Vector3()));
      const hub = new THREE.Group();
      hub.position.set(0, 1.55, d * 0.22);
      hub.add(sails);
      v.body.add(hut, roof, hub);
      v.inputSlots = grid(3, 2, 0.45, 0.15, 0.02, -w / 2 + 0.35, d / 2 - 0.25);
      v.slots = tray(v.body, w / 2 - 0.3, d / 2 - 0.25);
      let spin = 0;
      v.animate = (dt, working) => {
        spin += dt * (working ? 4 : 0.3);
        hub.rotation.z = spin;
      };
      return;
    }
    case 'oven': {
      const stove = model('stove', { fit: [w * 0.7, d * 0.7] });
      stove.position.z = -d * 0.12;
      v.body.add(stove);
      const glowMat = new THREE.MeshStandardMaterial({ color: '#3a2416', emissive: '#ff7a1a', emissiveIntensity: 0 });
      const glow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, 0.25, 0.04), glowMat);
      glow.position.set(0, 0.35, d * 0.24);
      v.body.add(glow);
      v.inputSlots = grid(4, 2, 0.6, 0.15, 0.02, -w / 2 + 0.45, d / 2 - 0.2);
      v.slots = tray(v.body, w / 2 - 0.3, d / 2 - 0.25);
      let t = 0;
      v.animate = (dt, working) => {
        t += dt;
        const target = working ? 1.5 + Math.sin(t * 8) * 0.5 : 0;
        glowMat.emissiveIntensity += (target - glowMat.emissiveIntensity) * Math.min(1, dt * 6);
      };
      return;
    }
    case 'register': {
      const top = counter(w, d, v);
      const till = model('cash-register');
      till.position.set(-w * 0.12, top, 0);
      till.rotation.y = Math.PI;
      v.body.add(till);
      return;
    }
    case 'office': {
      const desk = model('desk', { fit: [w, d] });
      const top = new THREE.Box3().setFromObject(desk).max.y;
      const screen = model('computer-screen');
      screen.position.set(0, top, -0.15);
      const chair = model('chair-desk');
      chair.position.set(0, 0, -d / 2 - 0.35);
      v.body.add(desk, screen, chair);
      return;
    }
    case 'trash':
      v.body.add(model('trash'));
      return;
    case 'exit': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), paletteMaterial('wood'));
      pole.position.y = 0.8;
      const sign = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 3), paletteMaterial('orange'));
      sign.rotation.set(0, 0, -Math.PI / 2);
      sign.position.set(0.15, 1.45, 0);
      pole.castShadow = sign.castShadow = true;
      v.body.add(pole, sign);
      return;
    }
  }
}

export function buildStation(name: string, box: Box, rot: Rot): StationVisual {
  const [w, d] = footprint(box, rot);
  const root = new THREE.Group();
  root.position.set(box[0] + box[2] / 2, 0, box[1] + box[3] / 2);
  root.rotation.y = THREE.MathUtils.degToRad(rot);
  const body = new THREE.Group();
  root.add(body);
  const v: StationVisual = {
    root,
    body,
    slots: [],
    inputSlots: [],
    plants: [],
    plantVisuals: [],
    mixers: [],
    animate: () => {},
  };
  build(name, w, d, v);
  return v;
}

/** Semi-transparent copy for Pad previews and Area Pan ghosts. */
export function ghostify(obj: THREE.Object3D, opacity = 0.45): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    const g = src.clone();
    g.transparent = true;
    g.opacity = opacity;
    g.depthWrite = false;
    m.material = g;
    m.castShadow = false;
  });
}
