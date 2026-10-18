// The Dairy Farm's code-built Producers and Items (Creamery look): white tile, steel and glass, each lively at work.
import * as THREE from 'three';
import { SHADES } from '../palette';
import { ITEM_SIZE } from '../../catalog/assets';
import { glassMaterial, glossMaterial } from './materials';
import { dynamic, moving } from './merge';
import { box, cone, cyl, inputSpots, put, sph, torus, withTray, type JuiceStation } from './juice-stations';

const D = SHADES.dairy;

const steel = new THREE.MeshStandardMaterial({ color: D.steel, roughness: 0.3, metalness: 0.25 });
const steelDark = new THREE.MeshStandardMaterial({ color: D.steelDark, roughness: 0.3, metalness: 0.25 });
const glass = (opacity = 0.45) => glassMaterial(D.glass, opacity);
const foil = new THREE.MeshStandardMaterial({ color: D.foil, roughness: 0.35, metalness: 0.4 });
const steelBowl = new THREE.MeshStandardMaterial({
  color: D.steel,
  roughness: 0.3,
  metalness: 0.25,
  side: THREE.DoubleSide,
});
const steam = new THREE.MeshStandardMaterial({ color: D.steam, transparent: true, opacity: 0.7, roughness: 0.9 });
const TRAY = { base: D.tile, top: steel };

const group = (p: THREE.Object3D, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  return g;
};

/** Rising steam puffs over a spot; returns the per-frame update. */
function puffs(p: THREE.Object3D, x: number, y: number, z: number, n = 4) {
  const ps = Array.from({ length: n }, () => dynamic(sph(p, 0.09, steam, x, y, z, 1)));
  return (t: number, on: boolean) =>
    ps.forEach((m, i) => {
      const k = (t * 0.6 + i / n) % 1;
      m.visible = on;
      m.position.set(x + Math.sin(t * 2 + i) * 0.08, y + k * 0.8, z);
      m.scale.setScalar(0.5 + k * 1.6);
    });
}

/** A blocky goat beside the Kenney cow: box body, horns, a beard and a bell. */
function goat(p: THREE.Object3D, size: number) {
  const root = group(p);
  root.scale.setScalar(size);
  box(root, 0.36, 0.34, 0.68, D.goat, 0, 0.38, 0);
  box(root, 0.3, 0.02, 0.3, D.goatDark, 0, 0.72, -0.1);
  for (const [x, z] of [
    [-0.12, -0.25],
    [0.12, -0.25],
    [-0.12, 0.25],
    [0.12, 0.25],
  ])
    box(root, 0.09, 0.38, 0.09, D.goat, x, 0, z);
  const tail = dynamic(box(root, 0.06, 0.14, 0.05, D.goat, 0, 0.68, -0.36));
  const head = group(root, 0, 0.72, 0.36);
  box(head, 0.24, 0.26, 0.3, D.goat, 0, -0.05, 0.08);
  box(head, 0.14, 0.1, 0.1, D.nose, 0, -0.05, 0.25);
  for (const x of [-0.07, 0.07]) {
    cone(head, 0.035, 0.22, D.horn, x, 0.18, 0, 6).rotation.x = -0.5;
    box(head, 0.14, 0.05, 0.06, D.goat, x * 2.4, 0.05, 0).rotation.z = x > 0 ? -0.4 : 0.4;
    sph(head, 0.025, D.ink, x * 1.3, 0.04, 0.2, 0);
  }
  cone(head, 0.04, 0.12, D.goatDark, 0, -0.3, 0.18, 6).rotation.x = Math.PI;
  moving(head);
  const bell = dynamic(sph(root, 0.06, glossMaterial(D.bell), 0, 0.5, 0.42, 1));
  return { root, head, tail, bell };
}

/** Rubber-matted pen with white rails, a steel milking stand and bucket; the goat stays by its feed and chews. */
function goatPen(w: number, d: number): JuiceStation {
  const g = new THREE.Group();
  box(g, w, 0.04, d, D.rubber);
  const posts: [number, number][] = [];
  for (let i = 0; i <= 4; i++) posts.push([-w / 2 + (i / 4) * w, -d / 2]);
  for (let i = 1; i <= 3; i++) posts.push([-w / 2, -d / 2 + (i / 3) * d], [w / 2, -d / 2 + (i / 3) * d]);
  for (const [x, z] of posts) box(g, 0.1, 0.85, 0.1, D.trim, x, 0, z);
  for (const y of [0.35, 0.7]) {
    box(g, w, 0.07, 0.05, D.trim, 0, y, -d / 2);
    box(g, 0.05, 0.07, d, D.trim, -w / 2, y, 0);
    box(g, 0.05, 0.07, d, D.trim, w / 2, y, 0);
  }
  const sx = w * 0.15;
  const sz = -d * 0.3;
  box(g, 0.9, 0.3, 0.55, steel, sx, 0.04, sz);
  for (const x of [-0.4, 0.4]) box(g, 0.05, 0.6, 0.05, steel, sx + x, 0.34, sz - 0.25);
  box(g, 0.85, 0.05, 0.05, steel, sx, 0.94, sz - 0.25);
  cyl(g, 0.14, 0.3, steel, w * 0.36, 0.04, -d * 0.36, 0.11);
  // the wheat tray inside the pen, front-left
  const tx = -w / 2 + 0.35;
  const tz = d * 0.22;
  box(g, 0.66, 0.32, 0.92, D.tile, tx + 0.13, 0, tz);
  box(g, 0.7, 0.04, 0.96, steel, tx + 0.13, 0.32, tz);
  const inputs = inputSpots(g, tx, 0.36, [D.wheat]).map((v) => v.setZ(v.z + tz));
  const gt = goat(g, 1.4);
  gt.root.position.set(w * 0.1, 0.04, d * 0.05);
  gt.root.rotation.y = -0.5;
  return {
    group: g,
    inputs,
    animate: (_dt, t, wk) => {
      gt.head.rotation.x = wk ? Math.sin(t * 7) * 0.08 : 0.5 + Math.sin(t * 2.5) * 0.1;
      gt.head.rotation.y = wk ? Math.sin(t * 1.3) * 0.25 : 0;
      gt.tail.rotation.x = Math.sin(t * (wk ? 16 : 5)) * 0.4;
      gt.bell.rotation.z = Math.sin(t * (wk ? 9 : 3)) * 0.4;
    },
  };
}

/** Stainless barrel churn on an A-frame, turned by a crank wheel; a glass porthole shows the cream. */
function butterChurn(): JuiceStation {
  const g = new THREE.Group();
  box(g, 1.2, 0.2, 1.0, D.tile);
  for (const x of [-0.42, 0.42])
    for (const s of [-1, 1]) box(g, 0.07, 1.05, 0.07, steel, x, 0.2, s * 0.25).rotation.x = s * 0.22;
  const top = 1.2;
  const drum = group(g, 0, top, 0);
  cyl(drum, 0.4, 0.8, steel, 0, -0.4, 0, 0.4, 20).rotation.z = Math.PI / 2;
  for (const x of [-0.3, 0.3]) torus(drum, 0.41, 0.02, steelDark, x).rotation.set(0, Math.PI / 2, 0);
  cyl(drum, 0.15, 0.03, glass(0.6), 0, 0, 0.4).rotation.x = Math.PI / 2;
  sph(drum, 0.12, D.cream, 0, 0, 0.36, 1).scale.set(1, 1, 0.3);
  moving(drum);
  const wheel = group(g, 0.5, top, 0);
  torus(wheel, 0.26, 0.03, D.blue).rotation.set(0, Math.PI / 2, 0);
  for (let i = 0; i < 4; i++) box(wheel, 0.02, 0.52, 0.02, D.blue, 0, -0.26, 0).rotation.x = (i * Math.PI) / 4;
  moving(wheel);
  return {
    group: g,
    animate: (dt, _t, wk) => {
      const sp = wk ? 4 : 0;
      drum.rotation.x += dt * sp;
      wheel.rotation.x += dt * sp;
    },
  };
}

/** Cheese and goat cheese share this steel press; the goat one gets a teal plate, an ash rind and a goat-head sign. */
function cheesePress(goatish: boolean): JuiceStation {
  const g = new THREE.Group();
  const band = goatish ? D.teal : D.blue;
  box(g, 1.4, 0.8, 1.0, D.tile);
  box(g, 1.44, 0.06, 1.04, steel, 0, 0.8);
  const top = 0.86;
  for (const x of [-0.45, 0.45]) cyl(g, 0.04, 1.1, steel, x, top, -0.25);
  box(g, 1.0, 0.12, 0.25, steel, 0, top + 1.1, -0.25);
  const ram = group(g, 0, top + 1.1, 0);
  cyl(ram, 0.06, 0.6, steel, 0, -0.6);
  cyl(ram, 0.26, 0.05, band, 0, -0.65);
  moving(ram);
  cyl(g, 0.28, 0.28, steel, 0, top, 0);
  cyl(g, 0.24, 0.02, goatish ? D.goatCheese : D.cheese, 0, top + 0.28, 0);
  cyl(g, 0.12, 0.4, glass(), 0.5, top, 0.25);
  const whey = dynamic(cyl(g, 0.1, 0.01, D.cream, 0.5, top + 0.02, 0.25));
  box(g, 0.5, 0.25, 0.02, band, 0, top - 0.5, 0.51);
  if (goatish) {
    cyl(g, 0.245, 0.02, D.ash, 0, top + 0.3, 0);
    const sign = group(g, 0, top + 1.25, -0.25);
    box(sign, 0.42, 0.32, 0.04, D.trim);
    box(sign, 0.18, 0.16, 0.05, D.goat, 0, 0.06);
    for (const x of [-0.06, 0.06]) cone(sign, 0.025, 0.12, D.horn, x, 0.2, 0, 5);
    box(sign, 0.44, 0.03, 0.05, D.teal, 0, -0.01);
  }
  const drip = dynamic(sph(g, 0.035, glass(0.8), 0.2, top + 0.25, 0.2, 0));
  return {
    group: g,
    animate: (dt, t, wk) => {
      ram.position.y = top + 1.1 - (wk ? (Math.sin(t * 3) * 0.5 + 0.5) * 0.35 : 0);
      const want = wk ? 30 : 4;
      whey.scale.y += (want - whey.scale.y) * Math.min(1, dt * 0.5);
      whey.position.y = top + 0.02 + (whey.scale.y * 0.01) / 2;
      const k = (t * 1.4) % 1;
      drip.visible = wk;
      drip.position.y = top + 0.25 - 0.25 * k * k;
    },
  };
}

/** Soft-serve machine on a tiled counter: two hoppers, a three-tap head, a cone filling with a pink-and-white twist. */
function iceCreamMaker(): JuiceStation {
  const g = new THREE.Group();
  box(g, 1.4, 0.8, 1.0, D.tile);
  box(g, 1.44, 0.06, 1.04, steel, 0, 0.8);
  const top = 0.86;
  box(g, 0.9, 0.85, 0.55, D.tile, 0, top, -0.2);
  box(g, 0.92, 0.5, 0.02, steel, 0, top + 0.1, 0.08);
  box(g, 0.92, 0.06, 0.57, D.blue, 0, top + 0.85, -0.2);
  for (const x of [-0.22, 0.22]) {
    cyl(g, 0.16, 0.12, steel, x, top + 0.91, -0.22);
    cyl(g, 0.17, 0.03, steelDark, x, top + 1.03, -0.22);
  }
  const sign = group(g, 0, top + 1.06, -0.22);
  cone(sign, 0.09, 0.22, D.waffle, 0, 0.22, 0, 10).rotation.x = Math.PI;
  sph(sign, 0.1, glossMaterial(D.pink), 0, 0.34, 0, 2);
  box(g, 0.6, 0.18, 0.2, steel, 0, top + 0.6, 0.17);
  const levers: THREE.Group[] = [];
  for (const x of [-0.18, 0, 0.18]) {
    cone(g, 0.035, 0.08, steelDark, x, top + 0.52, 0.22, 8).rotation.x = Math.PI;
    const lv = group(g, x, top + 0.78, 0.25);
    box(lv, 0.03, 0.18, 0.03, D.ink);
    sph(lv, 0.045, glossMaterial(D.pink), 0, 0.2, 0, 1);
    levers.push(lv);
  }
  moving(levers[1]);
  box(g, 0.6, 0.03, 0.22, steelDark, 0, top + 0.02, 0.2);
  const cup = group(g, 0, top + 0.05, 0.22);
  cone(cup, 0.07, 0.22, D.waffle, 0, 0, 0, 10).rotation.x = Math.PI;
  const swirl = [0, 1, 2, 3, 4].map((i) =>
    dynamic(torus(cup, 0.065 - i * 0.011, 0.032, glossMaterial(i % 2 ? D.vanilla : D.pink), 0, 0.25 + i * 0.045)),
  );
  const tip = dynamic(cone(cup, 0.025, 0.06, glossMaterial(D.pink), 0, 0.46, 0, 8));
  moving(cup);
  let fill = 0;
  return {
    group: g,
    animate: (dt, t, wk) => {
      fill = wk ? Math.min(1, fill + dt * 0.35) : fill >= 1 ? 0 : fill;
      swirl.forEach((s, i) => (s.visible = fill * (swirl.length + 1) > i));
      tip.visible = fill >= 1;
      cup.rotation.y = wk ? t * 2 : 0;
      levers[1].rotation.x = wk && fill < 1 ? 0.6 : 0;
    },
  };
}

/** Tilting steam kettle on legs: a whisk spins inside, it tips forward now and then to pour. */
function puddingPot(): JuiceStation {
  const g = new THREE.Group();
  box(g, 1.2, 0.25, 1.0, D.tile);
  const top = 0.25;
  for (const x of [-0.45, 0.45]) box(g, 0.08, 0.7, 0.08, steel, x, top, 0);
  const kettle = group(g, 0, top + 0.75, 0);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    steelBowl,
  );
  put(kettle, bowl, 0, 0.1);
  cyl(kettle, 0.39, 0.02, D.pudding, 0, -0.02);
  box(kettle, 0.9, 0.06, 0.06, steel, 0, 0.05);
  const whisk = group(kettle);
  cyl(whisk, 0.02, 0.5, D.ink);
  for (let i = 0; i < 3; i++) torus(whisk, 0.07, 0.008, steel, 0, 0.02).rotation.set(0, (i * Math.PI) / 3, 0);
  moving(whisk);
  moving(kettle);
  const puff = puffs(g, 0, top + 1.0, 0);
  return {
    group: g,
    animate: (_dt, t, wk) => {
      whisk.rotation.y = wk ? t * 8 : 0;
      kettle.rotation.x = wk ? Math.max(0, Math.sin(t * 0.8)) * 0.35 : 0;
      puff(t, wk);
    },
  };
}

/** By model name; `w` × `d` is the structure's footprint (without the output strip). */
export const DAIRY_STATIONS: Record<string, (w: number, d: number) => JuiceStation> = {
  'goat-pen': goatPen,
  'butter-churn': (w) => withTray(butterChurn(), w, [D.milk], TRAY),
  'cheese-press': (w) => withTray(cheesePress(false), w, [D.milk], TRAY),
  'goat-cheese-press': (w) => withTray(cheesePress(true), w, [D.goat], TRAY),
  'ice-cream-maker': (w) => withTray(iceCreamMaker(), w, [D.milk, D.strawberry], TRAY),
  'pudding-pot': (w) => withTray(puddingPot(), w, [D.milk, D.egg], TRAY),
};

// ---------- Items

/** Dairy Items share one look per Product, scaled to the game's Item size. */
const K = ITEM_SIZE / 0.34;
const ITEMS: Record<string, (g: THREE.Group) => void> = {
  // a squat glass bottle with a lilac cap
  'goat-milk': (g) => {
    cyl(g, 0.09, 0.24, D.milk, 0, 0, 0, 0.1);
    cyl(g, 0.05, 0.06, D.milk, 0, 0.24);
    cyl(g, 0.055, 0.03, D.lilac, 0, 0.3);
  },
  // a long flat brick, half wrapped in foil
  butter: (g) => {
    box(g, 0.42, 0.12, 0.2, D.butter);
    box(g, 0.2, 0.125, 0.205, foil, 0.11);
  },
  // a round wheel with a darker rind
  cheese: (g) => {
    cyl(g, 0.2, 0.12, D.cheeseRind, 0, 0, 0, 0.2, 20);
    cyl(g, 0.185, 0.005, D.cheese, 0, 0.12, 0, 0.185, 20);
  },
  'goat-cheese': (g) => {
    box(g, 0.24, 0.16, 0.24, D.goatCheese);
  },
  // a tub with a scoop and a cherry
  'ice-cream': (g) => {
    cyl(g, 0.14, 0.15, D.pink, 0, 0, 0, 0.11, 16);
    sph(g, 0.13, glossMaterial(D.vanilla), 0, 0.16, 0, 2).scale.set(1, 0.7, 1);
    sph(g, 0.03, glossMaterial(D.cherry), 0, 0.26, 0, 1);
  },
  // a white ramekin with pudding and a caramel pool
  pudding: (g) => {
    cyl(g, 0.13, 0.17, D.tile, 0, 0, 0, 0.1, 18);
    cyl(g, 0.12, 0.01, glossMaterial(D.pudding), 0, 0.165, 0, 0.12, 18);
    cyl(g, 0.07, 0.012, glossMaterial(D.caramel), 0, 0.17, 0, 0.07, 14);
  },
};

/** The code-built Dairy Item for this model name, or null. */
export function dairyItem(name: string): THREE.Group | null {
  const make = ITEMS[name];
  if (!make) return null;
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(K);
  make(inner);
  g.add(inner);
  return g;
}
