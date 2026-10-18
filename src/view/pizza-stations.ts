// The Pizza Place's code-built Producers and Items (Napoli tiles look): white tile, cobalt majolica and gold.
import * as THREE from 'three';
import { SHADES } from '../palette';
import { ITEM_SIZE } from '../../catalog/assets';
import { dynamic, moving } from './merge';
import { box, cone, cyl, put, sph, torus, withTray, type JuiceStation } from './juice-stations';

const Z = SHADES.pizza;

const gloss = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 });
const gold = new THREE.MeshStandardMaterial({ color: Z.gold, roughness: 0.3, metalness: 0.25 });
const glow = (c: string) =>
  new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, roughness: 0.6 });
const smoke = new THREE.MeshStandardMaterial({ color: Z.smoke, transparent: true, opacity: 0.7, roughness: 0.9 });
const TRAY = { base: Z.wood, top: Z.woodDark };

const group = (p: THREE.Object3D, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  return g;
};

/** Rising puffs over a spot; returns the per-frame update. */
function puffs(p: THREE.Object3D, x: number, y: number, z: number, rise = 0.8, n = 4) {
  const ps = Array.from({ length: n }, () => dynamic(sph(p, 0.09, smoke, x, y, z, 1)));
  return (t: number, on: boolean) =>
    ps.forEach((m, i) => {
      const k = (t * 0.6 + i / n) % 1;
      m.visible = on;
      m.position.set(x + Math.sin(t * 2 + i) * 0.08, y + k * rise, z);
      m.scale.setScalar(0.5 + k * 1.6);
    });
}

/** Licking flames: cones that flicker in height. */
function flames(p: THREE.Object3D, spots: [number, number][], y: number, r: number) {
  const f = spots.map(([x, z], i) => dynamic(cone(p, r, 0.3, glow(i % 2 ? Z.fire : Z.fireCore), x, y, z, 6)));
  return (t: number, on: boolean) =>
    f.forEach((m, i) => (m.scale.y = (on ? 1 : 0.4) * (0.75 + Math.sin(t * 13 + i * 2) * 0.25)));
}

/** A tiled counter with cobalt diamonds on its front; returns its top. */
function counter(g: THREE.Object3D, w: number, d: number, h: number): number {
  box(g, w, h, d, Z.tile);
  box(g, w + 0.06, 0.06, d + 0.06, Z.cobalt, 0, h);
  for (let i = 0; i < 4; i++)
    box(g, w * 0.22, 0.22, 0.01, Z.cobalt, -w * 0.33 + i * w * 0.22, h * 0.35, d / 2 + 0.005).rotation.z = Math.PI / 4;
  return h + 0.06;
}

/** A pizza disc; `raw` is pale dough before the oven, `veggie` swaps pepperoni for pepper rings, olives and mushroom. */
function pizza(p: THREE.Object3D, veggie: boolean, raw = false): THREE.Group {
  const g = group(p);
  cyl(g, 0.24, 0.05, raw ? Z.crustRaw : Z.crust, 0, 0, 0, 0.24, 24);
  torus(g, 0.22, 0.03, raw ? Z.crustRaw : Z.crust, 0, 0.05);
  cyl(g, 0.2, 0.012, gloss(Z.sauce), 0, 0.05, 0, 0.2, 24);
  if (!raw) cyl(g, 0.18, 0.012, Z.cheese, 0, 0.06, 0, 0.18, 18);
  const spots: [number, number][] = [
    [0.1, 0.02],
    [-0.07, 0.09],
    [-0.05, -0.1],
    [0.04, -0.12],
    [-0.12, -0.01],
    [0.09, 0.11],
  ];
  spots.forEach(([x, z], i) => {
    if (!veggie) cyl(g, 0.04, 0.015, Z.pepperoni, x, 0.07, z, 0.04, 12);
    else if (i % 3 === 0) torus(g, 0.05, 0.014, gloss(Z.pepper), x, 0.08, z);
    else if (i % 3 === 1) torus(g, 0.025, 0.012, Z.oliveDark, x, 0.08, z);
    else box(g, 0.06, 0.015, 0.04, Z.mushroom, x, 0.07, z);
  });
  if (veggie) sph(g, 0.03, Z.basil, 0, 0.08, 0, 0).scale.set(1.4, 0.4, 1);
  return g;
}

// ---------- the olive tree (Crop)

/** The Palestinian flag on a pole, flying clear over the canopy; returns its rippling segments. */
function palestineFlag(g: THREE.Object3D, x: number, y: number, z: number, pole: number): THREE.Group[] {
  cyl(g, 0.025, pole, gloss(Z.white), x, y, z);
  sph(g, 0.045, gold, x, y + pole + 0.03, z, 1);
  const len = 1.04;
  const hgt = len / 2;
  const n = 4;
  const segW = len / n;
  const segs: THREE.Group[] = [];
  const cloth = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide });
  let parent: THREE.Object3D = group(g, x, y + pole - hgt - 0.02, z);
  for (let i = 0; i < n; i++) {
    // each segment hangs off the last so the cloth ripples
    const seg = group(parent, i ? segW : 0, 0, 0);
    [Z.flagGreen, Z.white, Z.ink].forEach((c, k) =>
      box(seg, segW, hgt / 3, 0.012, cloth(c), segW / 2, (k * hgt) / 3, 0),
    );
    if (i === 0) {
      const tri = new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0, hgt),
        new THREE.Vector2(len / 3, hgt / 2),
      ]);
      put(
        seg,
        new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false }), cloth(Z.flagRed)),
        0,
        0,
        -0.01,
      );
    }
    segs.push(seg);
    parent = seg;
  }
  // innermost first, so each segment merges only its own cloth
  for (const seg of [...segs].reverse()) moving(seg);
  return segs;
}

/** The keffiyeh's look: white cloth, black fishnet weave, black border bands with a row of olive-leaf marks. */
function keffiyehTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const x = cv.getContext('2d') as CanvasRenderingContext2D;
  x.fillStyle = Z.white;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = Z.ink;
  x.lineWidth = 3;
  for (let i = -256; i < 512; i += 22) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 256, 256);
    x.moveTo(i, 256);
    x.lineTo(i + 256, 0);
    x.stroke();
  }
  x.fillStyle = Z.ink;
  for (const y of [0, 236]) x.fillRect(0, y, 256, 20);
  for (const y of [32, 214])
    for (let i = 8; i < 256; i += 20) {
      x.beginPath();
      x.ellipse(i, y, 7, 3.5, 0.6, 0, Math.PI * 2);
      x.fill();
    }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A keffiyeh lying folded on the ground: a square with one half folded over, tassels on two edges. */
function keffiyeh(g: THREE.Object3D, x: number, y: number, z: number): void {
  const k = group(g, x, y, z);
  k.rotation.y = 0.3;
  const cloth = new THREE.MeshStandardMaterial({ map: keffiyehTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const w = 0.46;
  box(k, w, 0.012, w, cloth);
  const tri = new THREE.Shape([
    new THREE.Vector2(-w / 2, -w / 2),
    new THREE.Vector2(w / 2, -w / 2),
    new THREE.Vector2(w / 2, w / 2),
  ]);
  const geo = new THREE.ShapeGeometry(tri);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / w + 0.5);
  put(k, new THREE.Mesh(geo, cloth), 0, 0.016, 0).rotation.x = -Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const u = -w / 2 + 0.03 + (i * (w - 0.06)) / 7;
    cyl(k, 0.012, 0.012, Z.ink, u, 0, w / 2 + 0.03).rotation.x = Math.PI / 2;
    cyl(k, 0.012, 0.012, Z.ink, w / 2 + 0.03, 0, u).rotation.z = Math.PI / 2;
  }
}

/** A gnarled twin trunk in a square tiled planter under a wide flat canopy; ripe olives lie in the soil (the plants). */
function oliveTree(w: number, d: number): JuiceStation {
  const g = new THREE.Group();
  const s = Math.min(w, d);
  const h = 1.1;
  box(g, s * 0.62, 0.45, s * 0.62, Z.tile);
  box(g, s * 0.66, 0.06, s * 0.66, Z.cobalt, 0, 0.45);
  for (const z of [-1, 1])
    for (let i = 0; i < 3; i++)
      box(g, 0.2, 0.2, 0.01, Z.cobalt, (i - 1) * 0.42, 0.12, (z * s * 0.62) / 2 + z * 0.006).rotation.z = Math.PI / 4;
  const soil = 0.51;
  const trunk = group(g, 0, soil, 0);
  cyl(trunk, 0.09, h * 0.6, Z.trunk, 0, 0, 0, 0.14, 7).rotation.z = 0.25;
  cyl(trunk, 0.08, h * 0.55, Z.trunk, 0.1, 0, 0, 0.12, 7).rotation.z = -0.3;
  cyl(trunk, 0.07, h * 0.5, Z.trunk, 0, h * 0.4, 0, 0.09, 7).rotation.z = 0.15;
  const top = group(g, 0, soil + h + 0.25, 0);
  for (const [x, y, z, r] of [
    [0, 0, 0, 0.55],
    [0.45, -0.05, 0.15, 0.4],
    [-0.45, 0, -0.1, 0.42],
    [0.1, 0.1, -0.42, 0.38],
    [-0.15, -0.05, 0.42, 0.38],
  ])
    sph(top, r, x + z > 0 ? Z.leaf : Z.leafDark, x, y, z).scale.set(1, 0.6, 1);
  // olives ripening on the branches, pale to olive green, as a lively touch
  const ripe = new THREE.Color(Z.olive);
  const pale = new THREE.Color(Z.olivePale);
  const hanging = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + 1.2;
    const m = gloss(Z.olivePale);
    const o = group(top, Math.cos(a) * 0.55, -0.36, Math.sin(a) * 0.55);
    for (let k = 0; k < 3; k++)
      sph(o, 0.07, m, Math.cos(k * 2.1) * 0.06, -0.05, Math.sin(k * 2.1) * 0.06, 1).scale.set(1, 1.3, 1);
    return { o: moving(o), m };
  });
  moving(top);
  // where ripe olives lie to be picked: the soil under the canopy
  const plants = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const o = new THREE.Object3D();
    o.position.set(Math.cos(a) * 0.42, soil, Math.sin(a) * 0.42);
    g.add(o);
    return o;
  });
  const flag = palestineFlag(g, -s * 0.29, soil, s * 0.29, 2.9);
  keffiyeh(g, s * 0.2, soil, s * 0.2);
  return {
    group: g,
    plants,
    animate: (_dt, t) => {
      top.rotation.z = Math.sin(t * 1.1) * 0.03;
      top.rotation.x = Math.sin(t * 0.8 + 1) * 0.02;
      flag.forEach((seg, i) => (seg.rotation.y = Math.sin(t * 3 - i * 0.9) * 0.25));
      hanging.forEach(({ o, m }, i) => {
        const k = ((t / 6 + i / 4) % 1) / 0.8;
        o.scale.setScalar(Math.min(1, Math.max(0.05, k)));
        m.color.copy(pale).lerp(ripe, Math.min(1, k));
      });
    },
  };
}

// ---------- Machines (the structure fills the back; the front strip is the output pallet)

/** A white-and-cobalt ceramic pot on a tiled stove, full of red sauce; a wooden spoon stirs, bubbles and steam rise. */
function saucePot(): JuiceStation {
  const g = new THREE.Group();
  counter(g, 1.2, 1.0, 0.5);
  const fire = flames(g, [[0, 0]], 0.56, 0.12);
  cyl(g, 0.48, 0.6, gloss(Z.tile), 0, 0.62, 0, 0.38, 20);
  torus(g, 0.46, 0.03, gloss(Z.cobalt), 0, 0.82);
  torus(g, 0.44, 0.03, gloss(Z.cobalt), 0, 1.0);
  torus(g, 0.48, 0.04, gold, 0, 1.22);
  const top = 1.22;
  cyl(g, 0.44, 0.02, gloss(Z.sauce), 0, top);
  const bubbles = [0, 1, 2, 3, 4].map((i) =>
    dynamic(sph(g, 0.06, gloss(Z.sauceDark), Math.cos(i * 2) * 0.25, top, Math.sin(i * 2) * 0.25, 0)),
  );
  const stir = group(g, 0, top, 0);
  const arm = group(stir, 0.18, 0, 0);
  cyl(arm, 0.025, 0.75, Z.wood, 0, -0.1, 0).rotation.z = -0.35;
  sph(arm, 0.08, Z.wood, -0.05, -0.08, 0, 1).scale.set(1, 0.5, 1);
  moving(stir);
  const puff = puffs(g, 0, top + 0.1, 0);
  return {
    group: g,
    animate: (dt, t, wk) => {
      stir.rotation.y += dt * (wk ? 2.5 : 0);
      bubbles.forEach((b, i) => {
        const k = (t * 1.2 + i / 5) % 1;
        b.visible = wk;
        b.position.y = top + 0.01 + k * 0.1;
        b.scale.setScalar(0.4 + k * 0.8);
      });
      fire(t, wk);
      puff(t, wk);
    },
  };
}

/** A tiled spiral mixer: the gold bowl of dough turns while a gold spiral hook spins against it. */
function doughMixer(): JuiceStation {
  const g = new THREE.Group();
  counter(g, 1.2, 1.0, 0.6);
  const bowl = group(g, 0, 0.66, 0.05);
  cyl(bowl, 0.45, 0.4, gold, 0, 0, 0, 0.35, 20);
  sph(bowl, 0.3, Z.dough, 0.08, 0.34, 0, 2).scale.set(1, 0.5, 1);
  moving(bowl);
  box(g, 0.25, 1.0, 0.3, gloss(Z.tile), 0, 0.6, -0.45);
  box(g, 0.3, 0.25, 0.75, gloss(Z.cobalt), 0, 1.5, -0.15);
  const hook = group(g, 0.1, 1.5, 0.12);
  for (let i = 0; i < 4; i++) torus(hook, 0.07, 0.022, gold, 0, -0.15 - i * 0.12);
  cyl(hook, 0.025, 0.55, gold, 0.07, -0.55);
  moving(hook);
  return {
    group: g,
    animate: (dt, _t, wk) => {
      bowl.rotation.y -= dt * (wk ? 2 : 0);
      hook.rotation.y += dt * (wk ? 9 : 0);
    },
  };
}

/** A pizza on a peel that slides into the mouth raw and back out baked. */
function peel(g: THREE.Object3D, veggie: boolean, y: number, zIn: number, zOut: number) {
  const pl = group(g, 0, y, zOut);
  box(pl, 0.5, 0.02, 0.45, Z.wood);
  box(pl, 0.06, 0.03, 0.4, Z.wood, 0, 0, 0.42);
  const raw = pizza(pl, veggie, true);
  const baked = pizza(pl, veggie);
  raw.position.y = baked.position.y = 0.02;
  raw.scale.setScalar(0.9);
  baked.scale.setScalar(0.9);
  moving(raw);
  moving(baked);
  moving(pl);
  return (t: number, on: boolean) => {
    const k = on ? (t * 0.35) % 1 : 0;
    pl.position.z = zOut + (zIn - zOut) * Math.sin(k * Math.PI);
    raw.visible = on && k < 0.5;
    baked.visible = on && k >= 0.5;
  };
}

/** A tiled dome oven with an arched mouth set into its front; the veggie one wears green and its own pizza sign. */
function pizzaOven(veggie: boolean): JuiceStation {
  const g = new THREE.Group();
  const band = gloss(veggie ? Z.veggie : Z.gold);
  box(g, 1.6, 0.8, 1.5, gloss(Z.tile));
  box(g, 1.66, 0.08, 1.56, gloss(Z.cobalt), 0, 0.8);
  const domeY = 0.88;
  put(
    g,
    new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gloss(Z.tile)),
    0,
    domeY,
    -0.1,
  );
  for (let i = 0; i < 3; i++)
    torus(g, 0.69 - i * 0.12, 0.035, i % 2 ? gold : gloss(Z.cobalt), 0, domeY + 0.18 + i * 0.18, -0.1);
  // the arched mouth: dark inside, a coloured arched rim and sill, embers and flames in the doorway
  const face = 0.66;
  const half = 0.26;
  const rise = 0.12;
  const arch = new THREE.Shape();
  arch.moveTo(-half, 0);
  arch.lineTo(half, 0);
  arch.lineTo(half, rise);
  arch.absarc(0, rise, half, 0, Math.PI, false);
  arch.lineTo(-half, 0);
  put(
    g,
    new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 0.45, bevelEnabled: false }), gloss(Z.hole)),
    0,
    domeY,
    face - 0.45,
  );
  put(g, new THREE.Mesh(new THREE.TorusGeometry(half + 0.04, 0.05, 8, 20, Math.PI), band), 0, domeY + rise, face);
  for (const x of [-1, 1]) box(g, 0.1, rise, 0.1, band, x * (half + 0.04), domeY, face);
  box(g, half * 2 + 0.3, 0.06, 0.22, band, 0, domeY - 0.06, face + 0.02);
  const ember = dynamic(box(g, half * 1.6, 0.03, 0.02, glow(Z.fire), 0, domeY + 0.005, face + 0.005));
  const fire = flames(
    g,
    [-0.12, 0, 0.12].map((x) => [x, face + 0.01]),
    domeY + 0.02,
    0.06,
  );
  cyl(g, 0.1, 0.5, gloss(Z.cobalt), 0, domeY + 0.65, 0.2);
  const puff = puffs(g, 0, domeY + 1.2, 0.2, 1);
  const slide = peel(g, veggie, domeY + 0.01, face - 0.15, face + 0.3);
  // the pizza sign on a post
  const sign = group(g, 0.62, domeY + 0.6, -0.1);
  box(sign, 0.12, 0.3, 0.12, Z.woodDark);
  const disc = pizza(sign, veggie);
  disc.rotation.x = Math.PI / 2 - 0.25;
  disc.position.set(0, 0.55, 0.06);
  disc.scale.setScalar(1.4);
  torus(sign, 0.36, 0.03, band, 0, 0.55, 0.05).rotation.x = -0.25;
  return {
    group: g,
    animate: (_dt, t, wk) => {
      fire(t, wk);
      (ember.material as THREE.MeshStandardMaterial).emissiveIntensity = (wk ? 1.2 : 0.4) + Math.sin(t * 9) * 0.2;
      puff(t, wk);
      slide(t, wk);
    },
  };
}

/** By model name; `w` × `d` is the structure's footprint (without the output strip). */
export const PIZZA_STATIONS: Record<string, (w: number, d: number) => JuiceStation> = {
  'olive-tree': oliveTree,
  'sauce-pot': (w) => withTray(saucePot(), w, [Z.tomato], TRAY),
  'dough-mixer': (w) => withTray(doughMixer(), w, [Z.flour, Z.milk], TRAY),
  'pizza-oven': (w) => withTray(pizzaOven(false), w, [Z.dough, Z.sauce, Z.cheese], TRAY),
  'veggie-pizza-oven': (w) => withTray(pizzaOven(true), w, [Z.dough, Z.sauce, Z.olive], TRAY),
};

// ---------- Items

/** Pizza Items share one look per Product, scaled to the game's Item size. */
const K = ITEM_SIZE / 0.34;
const ITEMS: Record<string, (g: THREE.Group) => void> = {
  // a jar: red body, white lid, a mini tomato on the lid
  'pizza-sauce': (g) => {
    cyl(g, 0.12, 0.22, gloss(Z.sauce), 0, 0, 0, 0.12, 16);
    cyl(g, 0.125, 0.06, Z.white, 0, 0.22);
    sph(g, 0.05, gloss(Z.tomato), 0, 0.32, 0, 1);
    box(g, 0.2, 0.08, 0.01, Z.white, 0, 0.07, 0.12);
  },
  // a pale dough ball with a dusting of flour
  dough: (g) => {
    sph(g, 0.16, Z.dough, 0, 0.11, 0, 2).scale.set(1, 0.7, 1);
    sph(g, 0.06, Z.flour, 0.05, 0.2, 0.04, 0).scale.set(1, 0.2, 1);
  },
  // a glass jar of green olives with a green lid
  olives: (g) => {
    cyl(
      g,
      0.11,
      0.22,
      new THREE.MeshStandardMaterial({ color: Z.glass, transparent: true, opacity: 0.5, roughness: 0.1 }),
      0,
      0,
      0,
      0.11,
      14,
    );
    for (let i = 0; i < 6; i++)
      sph(g, 0.045, gloss(Z.olive), Math.cos(i * 2.1) * 0.05, 0.05 + (i % 3) * 0.06, Math.sin(i * 2.1) * 0.05, 1);
    cyl(g, 0.115, 0.05, Z.leafDark, 0, 0.22);
  },
  pizza: (g) => void pizza(g, false).scale.setScalar(0.75),
  'veggie-pizza': (g) => void pizza(g, true).scale.setScalar(0.75),
};

/** The code-built Pizza Place Item for this model name, or null. */
export function pizzaItem(name: string): THREE.Group | null {
  const make = ITEMS[name];
  if (!make) return null;
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(K);
  make(inner);
  g.add(inner);
  return g;
}
