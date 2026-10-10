// The Juice Bar's code-built Producers (Orchard stand look): rustic wood, iron and copper, each lively while it works.
import * as THREE from 'three';
import { SHADES } from '../palette';
import { paletteMaterial } from './materials';

const J = SHADES.juice;

const glassMat = new THREE.MeshStandardMaterial({ color: J.glass, transparent: true, opacity: 0.45, roughness: 0.1 });
const chromeMat = new THREE.MeshStandardMaterial({ color: J.chrome, roughness: 0.25, metalness: 0.6 });

function put<T extends THREE.Mesh>(parent: THREE.Object3D, m: T, x = 0, y = 0, z = 0): T {
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
const matOf = (c: string | THREE.Material) => (typeof c === 'string' ? paletteMaterial(c) : c);
const box = (p: THREE.Object3D, w: number, h: number, d: number, c: string | THREE.Material, x = 0, y = 0, z = 0) =>
  put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matOf(c)), x, y + h / 2, z);
const cyl = (
  p: THREE.Object3D,
  r: number,
  h: number,
  c: string | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rb = r,
  seg = 16,
) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, rb, h, seg), matOf(c)), x, y + h / 2, z);
const sph = (p: THREE.Object3D, r: number, c: string | THREE.Material, x = 0, y = 0, z = 0, detail = 1) =>
  put(p, new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), matOf(c)), x, y, z);
const cone = (p: THREE.Object3D, r: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 12) =>
  put(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), matOf(c)), x, y + h / 2, z);
const torus = (p: THREE.Object3D, r: number, t: number, c: string, x = 0, y = 0, z = 0) => {
  const m = put(p, new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 24), matOf(c)), x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
};

export interface JuiceStation {
  group: THREE.Group;
  /** `t` is seconds since built; `working` while a Machine is busy. */
  animate: (dt: number, t: number, working: boolean) => void;
  /** Crops: one object per plant; the game draws the growing output Item there. */
  plants?: THREE.Object3D[];
  /** Crops: the output Item is drawn this much bigger at each plant spot. */
  plantScale?: number;
  /** Machines: input spots, one column of 3 per Recipe input. */
  inputs?: THREE.Vector3[];
}

const spot = (parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D => {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};

// ---------- Crops

/** A bumpy round canopy on a trunk in a low wooden-rimmed dirt ring; four fruit grow on the canopy. */
function fruitTree(w: number, d: number, leaves: string, tall: number): JuiceStation {
  const g = new THREE.Group();
  const s = Math.min(w, d);
  const h = 1.25 * tall;
  cyl(g, s * 0.36, 0.12, J.dirt);
  torus(g, s * 0.37, 0.07, J.wood, 0, 0.12, 0);
  cyl(g, 0.12, h, J.trunk, 0, 0, 0, 0.17, 8);
  const r = 0.62;
  const top = new THREE.Group();
  top.position.y = h + r * 0.6;
  g.add(top);
  sph(top, r, leaves);
  for (const [x, y, z, k] of [
    [0.45, 0.15, 0.2, 0.7],
    [-0.4, 0.1, -0.25, 0.75],
    [0.1, 0.4, -0.35, 0.6],
    [-0.2, -0.15, 0.45, 0.6],
  ])
    sph(top, r * k, leaves, x * r, y * r, z * r);
  const plants = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    return spot(top, Math.cos(a) * r * 1.02, (i % 2 ? -0.15 : 0.15) * r, Math.sin(a) * r * 0.95);
  });
  return {
    group: g,
    plants,
    animate: (_dt, t) => {
      top.rotation.z = Math.sin(t * 1.3) * 0.03;
      top.rotation.x = Math.sin(t * 0.9 + 1) * 0.025;
    },
  };
}

/** Furrowed dirt with a split-rail fence front and back; six clumps of cane grow as cane bundles. */
function caneField(w: number, d: number): JuiceStation {
  const g = new THREE.Group();
  const s = Math.min(w, d);
  box(g, s, 0.06, s, J.dirt);
  for (const k of [-1, 0, 1]) box(g, s * 0.85, 0.1, 0.35, J.dirtDark, 0, 0.06, k * s * 0.3);
  for (const z of [-s / 2, s / 2]) {
    box(g, s, 0.05, 0.05, J.wood, 0, 0.35, z);
    for (const x of [-s / 2, 0, s / 2]) box(g, 0.08, 0.45, 0.08, J.woodDark, x, 0, z);
  }
  const plants = [0, 1, 2, 3, 4, 5].map((i) =>
    spot(g, ((i % 3) - 1) * s * 0.28, 0, (Math.floor(i / 3) - 0.5) * s * 0.5),
  );
  return { group: g, plants, plantScale: 2.2, animate: () => {} };
}

/** Flat rosette of leaves with a white flower. */
function rosette(p: THREE.Object3D, x: number, z: number, y: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  for (let i = 0; i < 6; i++) {
    const l = box(g, 0.34, 0.035, 0.2, i % 2 ? J.leaf : J.leafDark, 0, 0.05 + (i % 2) * 0.03, 0);
    l.geometry.translate(0.17, 0, 0);
    l.rotation.set(0, (i / 6) * Math.PI * 2, 0.35);
  }
  for (let i = 0; i < 5; i++)
    sph(g, 0.03, J.flower, 0.05 + Math.cos(i * 1.26) * 0.05, 0.18, Math.sin(i * 1.26) * 0.05, 0);
  sph(g, 0.025, J.seed, 0.05, 0.2, 0, 0);
  return g;
}

/** Straw-mulched raised bed: six leaf rosettes, each berry resting on top of its plant's leaves. */
function strawberryPatch(w: number, d: number): JuiceStation {
  const g = new THREE.Group();
  const len = w * 0.9;
  const dep = Math.min(d * 0.55, 1.2);
  box(g, len, 0.22, dep, J.straw);
  for (const z of [-1, 1]) box(g, len + 0.16, 0.32, 0.08, J.wood, 0, 0, (z * (dep + 0.08)) / 2);
  for (const x of [-1, 1]) box(g, 0.08, 0.32, dep, J.wood, (x * (len + 0.08)) / 2, 0, 0);
  const leaves: THREE.Group[] = [];
  const plants = [0, 1, 2, 3, 4, 5].map((i) => {
    const plant = rosette(g, (i / 5 - 0.5) * (len - 0.5), i % 2 ? 0.18 : -0.18, 0.22);
    leaves.push(plant);
    const a = 0.8 + i * 2.1;
    return spot(
      g,
      plant.position.x + Math.cos(a) * 0.12,
      plant.position.y + 0.18,
      plant.position.z + Math.abs(Math.sin(a)) * 0.12,
    );
  });
  return {
    group: g,
    plants,
    animate: (_dt, t) => leaves.forEach((l, i) => (l.rotation.y = Math.sin(t * 1.5 + i) * 0.12)),
  };
}

// ---------- Machines (the structure fills the back; the front strip is the output pallet)

function counter(g: THREE.Object3D, w: number, d: number): number {
  const h = 0.85;
  box(g, w, h, d, J.wood);
  box(g, w + 0.06, 0.06, d + 0.06, J.woodDark, 0, h);
  return h + 0.06;
}

/** Cider press: slatted tub, a big screw with a cross handle that turns and lowers the plate. */
function applePress(): JuiceStation {
  const g = new THREE.Group();
  cyl(g, 0.55, 0.2, J.woodDark);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    box(g, 0.1, 0.55, 0.04, J.wood, Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45).rotation.y = -a + Math.PI / 2;
  }
  torus(g, 0.47, 0.025, J.iron, 0, 0.3);
  torus(g, 0.47, 0.025, J.iron, 0, 0.65);
  for (const x of [-0.6, 0.6]) box(g, 0.12, 1.6, 0.12, J.woodDark, x);
  box(g, 1.35, 0.14, 0.16, J.woodDark, 0, 1.6);
  const screw = new THREE.Group();
  g.add(screw);
  cyl(screw, 0.05, 1.1, J.iron, 0, -0.4);
  box(screw, 0.9, 0.05, 0.05, J.iron, 0, 0.62);
  cyl(screw, 0.4, 0.06, J.wood, 0, -0.42);
  screw.position.y = 1.0;
  box(g, 0.1, 0.06, 0.3, J.copper, 0, 0.22, 0.6).rotation.x = 0.3;
  return {
    group: g,
    animate: (dt, _t, wk) => {
      screw.rotation.y += dt * (wk ? 3 : 0);
      screw.position.y += ((wk ? 0.85 : 1.0) - screw.position.y) * Math.min(1, dt * 2);
    },
  };
}

/** Hand-lever citrus press on a wooden counter: the long lever pumps down. */
function squeezer(w: number): JuiceStation {
  const g = new THREE.Group();
  const top = counter(g, w * 0.8, 0.9);
  box(g, 0.5, 0.08, 0.5, J.iron, 0, top);
  cyl(g, 0.16, 0.12, chromeMat, 0, top + 0.08);
  box(g, 0.08, 0.8, 0.08, J.iron, 0, top, -0.2);
  const pivot = new THREE.Group();
  pivot.position.set(0, top + 0.8, -0.2);
  g.add(pivot);
  box(pivot, 0.06, 0.06, 0.9, J.iron, 0, 0, 0.35);
  sph(pivot, 0.07, J.knob, 0, 0, 0.8);
  cyl(pivot, 0.17, 0.08, chromeMat, 0, -0.2, 0.2);
  return { group: g, animate: (_dt, t, wk) => (pivot.rotation.x = wk ? 0.25 + Math.sin(t * 6) * 0.25 : -0.35) };
}

/** Cane crusher: two upright grooved iron rollers turned by a long wooden sweep beam. */
function sugarMill(): JuiceStation {
  const g = new THREE.Group();
  box(g, 1.5, 0.3, 1.2, J.brick);
  const rollers = [-0.18, 0.18].map((x) => {
    const r = cyl(g, 0.17, 0.8, J.iron, x, 0.3, 0);
    for (let i = 0; i < 6; i++) box(r, 0.02, 0.8, 0.36, J.knob, 0, -0.4, 0).rotation.y = (i / 6) * Math.PI;
    return r;
  });
  box(g, 0.7, 0.12, 0.4, J.iron, 0, 1.1);
  const beam = new THREE.Group();
  beam.position.y = 1.25;
  g.add(beam);
  box(beam, 2.2, 0.1, 0.1, J.woodDark, 0.7);
  cyl(beam, 0.06, 0.3, J.woodDark, 0, -0.1);
  return {
    group: g,
    animate: (dt, _t, wk) => {
      beam.rotation.y += dt * (wk ? 1.2 : 0);
      rollers.forEach((r, i) => (r.rotation.y += dt * (wk ? 4 : 0) * (i ? -1 : 1)));
    },
  };
}

/** Open copper pot over a brick fire ring: caramel bubbles, an apple on a stick dips in and out. */
function candyPot(): JuiceStation {
  const g = new THREE.Group();
  cyl(g, 0.6, 0.35, J.brick, 0, 0, 0, 0.65);
  cone(g, 0.25, 0.35, J.fire, 0, 0.2, 0, 6);
  cyl(g, 0.5, 0.55, J.copper, 0, 0.35, 0, 0.36);
  torus(g, 0.5, 0.05, J.copper, 0, 0.9);
  for (const k of [-1, 1]) torus(g, 0.09, 0.025, J.iron, k * 0.56, 0.75).rotation.set(0, Math.PI / 2, 0);
  const potTop = 0.9;
  cyl(g, 0.5, 0.03, J.caramel, 0, potTop - 0.05);
  const bubbles = [0, 1, 2, 3, 4].map((i) =>
    sph(g, 0.06, J.caramel, Math.cos(i * 2) * 0.25, potTop, Math.sin(i * 2) * 0.25, 0),
  );
  const dipper = new THREE.Group();
  sph(dipper, 0.12, J.apple, 0, 0, 0, 2);
  cyl(dipper, 0.015, 0.45, J.stick, 0, 0.05);
  dipper.position.set(0.15, potTop + 0.3, 0);
  g.add(dipper);
  return {
    group: g,
    animate: (_dt, t, wk) => {
      bubbles.forEach((b, i) => {
        const k = (t * 1.2 + i / 5) % 1;
        b.visible = wk;
        b.position.y = potTop + k * 0.15;
        b.scale.setScalar(0.4 + k * 0.8);
      });
      dipper.position.y = potTop + (wk ? 0.15 + Math.max(0, Math.sin(t * 2)) * 0.35 : 0.5);
      dipper.rotation.y = t * (wk ? 2 : 0);
    },
  };
}

/** A wooden-base blender on a counter, its glass jug of pink smoothie shaking and swirling. */
function smoothieBlender(w: number): JuiceStation {
  const g = new THREE.Group();
  const top = counter(g, w * 0.8, 0.9);
  box(g, 0.5, 0.25, 0.5, J.woodDark, 0, top);
  const jug = new THREE.Group();
  jug.position.y = top + 0.25;
  g.add(jug);
  cyl(jug, 0.24, 0.7, glassMat, 0, 0, 0, 0.18);
  const fill = cyl(jug, 0.2, 0.5, J.smoothie, 0, 0.02, 0, 0.16);
  cyl(jug, 0.26, 0.06, J.knob, 0, 0.7);
  return {
    group: g,
    animate: (_dt, t, wk) => {
      jug.rotation.z = wk ? Math.sin(t * 33) * 0.05 : 0;
      fill.rotation.y = t * (wk ? 12 : 0);
      fill.scale.x = fill.scale.z = 1 + (wk ? Math.sin(t * 20) * 0.04 : 0);
    },
  };
}

// ---------- input spots

/** One column of 3 per Recipe input, each a painted square in its input's colour so an empty one shows what's missing. */
function inputSpots(g: THREE.Object3D, x0: number, y: number, colours: string[]): THREE.Vector3[] {
  const cols = colours.length === 1 ? [colours[0], colours[0]] : colours;
  return cols.flatMap((c, k) =>
    [0, 1, 2].map((r) => {
      const x = x0 + k * 0.27;
      const z = (r - 1) * 0.27;
      box(
        g,
        0.22,
        0.012,
        0.22,
        new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.55 }),
        x,
        y,
        z,
      );
      return new THREE.Vector3(x, y + 0.012, z);
    }),
  );
}

/** A low wooden tray left of a floor Machine (the Machine shifts right to make room). */
function withTray(s: JuiceStation, w: number, colours: string[]): JuiceStation {
  for (const c of s.group.children) c.position.x += 0.3;
  const x0 = -w / 2 + 0.2;
  box(s.group, 0.66, 0.32, 0.92, J.wood, x0 + 0.13, 0, 0);
  box(s.group, 0.7, 0.04, 0.96, J.woodDark, x0 + 0.13, 0.32, 0);
  return { ...s, inputs: inputSpots(s.group, x0, 0.36, colours) };
}

/** Painted spots on a counter top's left end. */
const onCounter = (s: JuiceStation, w: number, colours: string[]): JuiceStation => ({
  ...s,
  inputs: inputSpots(s.group, -w * 0.4 + 0.18, 0.91, colours),
});

/** By model name; `w` × `d` is the structure's footprint (without the output strip). */
export const JUICE_STATIONS: Record<string, (w: number, d: number) => JuiceStation> = {
  'apple-tree': (w, d) => fruitTree(w, d, J.leaf, 1),
  'orange-tree': (w, d) => fruitTree(w, d, J.leafDark, 1.15),
  'sugar-cane-field': caneField,
  'strawberry-patch': strawberryPatch,
  'apple-press': (w) => withTray(applePress(), w, [J.apple]),
  squeezer: (w) => onCounter(squeezer(w), w, [J.orange]),
  'sugar-mill': (w) => withTray(sugarMill(), w, [J.cane]),
  'candy-pot': (w) => withTray(candyPot(), w, [J.apple, J.sugar]),
  'smoothie-blender': (w) => onCounter(smoothieBlender(w), w, [J.strawberry, J.milk]),
};
