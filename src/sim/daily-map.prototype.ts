// PROTOTYPE (#138 Daily Map generator): throwaway. Builds a Daily Shift Map from a seed, then bot-calibrates its goal.
// Block engine: every Area is a shop block (22 m deep) with its farm yard (26 m) behind, drawn in a local frame whose
// front (the Street side) is z = 0, then turned to face N/S/W/E and placed by a Format. Walls, doors, Street, road and
// car spots are derived from where the blocks land. A day that fails a check rerolls on a derived seed.
import type { Box, MapDef, MapLayout, PadDef, Point, PropDef, Rot, StationDef, UpgradeDef } from './map';
import type { ObjectiveDef } from '../../catalog/objectives';
import { objectiveId } from '../../catalog/objectives';
import { PRODUCTS, type Product } from '../../catalog/products';
import { PRODUCERS, type ProducerType } from '../../catalog/producers';
import { ASSETS } from '../../catalog/assets';
import { nextRandom, randomInt, shuffle, weighted } from './rng';
import { createWorld, step, type World } from './world';
import { Bot } from './bot';
import { objectiveProgress } from './objectives';
import { validateMap } from './validate';
import { boxGap, boxesOverlap } from './geometry';
import { TUNING } from './tuning';

export type Variant = 'slabs' | 'kit';
export type GoalKind = 'own' | 'earn' | 'sell' | 'deliveries';
export type Format = 'row' | 'column' | 'corner' | 'split' | 'courtyard' | 'kit';
export type Interior = 'aisles' | 'market' | 'columns' | 'staggered';
type Facing = 'N' | 'S' | 'W' | 'E';

export const KNOBS = {
  areasMin: 2,
  areasMax: 3,
  /** Format weights (Slabs): row, column, corner, split, courtyard. */
  wRow: 1,
  wColumn: 1,
  wCorner: 1,
  wSplit: 1,
  wCourtyard: 1,
  /** Share of the Pad chain already bought at the Opening (Staff Pads excluded). */
  startShareMin: 0.35,
  startShareMax: 0.55,
  startMoney: 40,
  padBase1: 12,
  padBase2: 60,
  padBase3: 300,
  padGrowth: 1.18,
  areaPadShare: 0.6,
  chainMaxProducers: 4,
  /** Outdoor trees and bushes, and indoor props per shop. */
  treesMin: 8,
  treesMax: 18,
  indoorMax: 3,
  goalPartsMax: 3,
  extraPartChance: 0.45,
  targetMinutes: 10,
  botPace: 1,
  calibrateCapMinutes: 20,
};
export type Knobs = typeof KNOBS;

export function dateSeed(date: string): number {
  let h = 0x811c9dc5;
  for (const c of date) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return h | 0;
}

const FOOT: Record<string, [number, number]> = {
  tomato_bed: [4, 2.4], chicken_coop: [3, 4.1], blender: [2, 2.5], wheat_field: [3, 3], cow_pen: [3, 4.1],
  mill: [2.4, 3.5], oven: [2.2, 3.3], apple_tree: [2.5, 2.5], orange_tree: [2.5, 2.5], apple_press: [2.2, 3.3],
  squeezer: [2, 2.6], sugar_cane_field: [3, 3], sugar_mill: [2.4, 3.5], candy_pot: [2.2, 3.3],
  strawberry_patch: [4, 2.4], smoothie_blender: [2, 2.8], butter_churn: [2, 2.8], goat_pen: [3, 4.1],
  cheese_press: [2.2, 3.3], goat_cheese_press: [2.2, 3.3], ice_cream_maker: [2.2, 3.3], pudding_pot: [2.2, 3.3],
  sauce_pot: [2.2, 3.3], dough_mixer: [2.2, 3.3], pizza_oven: [2.8, 3.5], olive_tree: [2.5, 2.5],
  veggie_pizza_oven: [2.8, 3.5],
};
const PROD = PRODUCERS as Record<string, ProducerType>;
const PRODS = PRODUCTS as Record<string, Product>;
const producerOf = (product: string): string | undefined => Object.keys(PROD).find((id) => PROD[id].output === product);

function tree(product: string, out: string[] = []): string[] {
  const id = producerOf(product);
  if (!id || out.includes(id)) return out;
  for (const input of PROD[id].inputs) tree(input, out);
  out.push(id);
  return out;
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const nice = (n: number) => {
  const step = n < 50 ? 5 : n < 200 ? 10 : n < 1000 ? 50 : 100;
  return Math.max(step, Math.floor(n / step) * step);
};

// ---------- blocks and their frame

const SHOP_D = 22;
const UNIT_D = 48;

interface Unit {
  area: string;
  /** World top-left of the whole unit (shop + yard). */
  x: number;
  z: number;
  facing: Facing;
  /** Width across the front. */
  w: number;
  interior: Interior;
  producers: string[];
  sold: string[];
}

const TURN: Record<Facing, Rot> = { N: 0, W: 90, S: 180, E: 270 };

/** Local box (front at z = 0) → world. */
function toWorld(u: Unit, [x, z, w, d]: Box): Box {
  switch (u.facing) {
    case 'N':
      return [u.x + x, u.z + z, w, d];
    case 'S':
      return [u.x + u.w - x - w, u.z + UNIT_D - z - d, w, d];
    case 'W':
      return [u.x + z, u.z + u.w - x - w, d, w];
    case 'E':
      return [u.x + UNIT_D - z - d, u.z + x, d, w];
  }
}
const ptWorld = (u: Unit, [x, z]: Point): Point => {
  const [wx, wz] = toWorld(u, [x, z, 0, 0]);
  return [wx, wz];
};
const rotWorld = (u: Unit, r: Rot): Rot => ((r + TURN[u.facing]) % 360) as Rot;
const unitBox = (u: Unit): Box => toWorld(u, [0, 0, u.w, UNIT_D]);
const shopBox = (u: Unit): Box => toWorld(u, [0, 0, u.w, SHOP_D]);
const yardBox = (u: Unit): Box => toWorld(u, [0, SHOP_D, u.w, UNIT_D - SHOP_D]);

/** Units per Format, in Area order (Area 1 first, 16 m wide; the rest 14 m). */
function formatUnits(format: Format, facing: Facing): Omit<Unit, 'area' | 'interior' | 'producers' | 'sold'>[] {
  switch (format) {
    case 'row':
      return [
        { x: 0, z: 0, facing: 'N', w: 16 },
        { x: 16, z: 0, facing: 'N', w: 14 },
        { x: 30, z: 0, facing: 'N', w: 14 },
      ];
    case 'column':
      return [
        { x: 0, z: 0, facing: 'W', w: 16 },
        { x: 0, z: 16, facing: 'W', w: 14 },
        { x: 0, z: 30, facing: 'W', w: 14 },
      ];
    case 'corner':
      // shops along the north and down the west, yards in the inside corner
      return [
        { x: 0, z: 48, facing: 'W', w: 16 },
        { x: 0, z: 0, facing: 'N', w: 14 },
        { x: 14, z: 0, facing: 'N', w: 14 },
      ];
    case 'split':
      // a Street through the middle: Area 1 and 2 face north onto it, Area 3 faces south from across
      return [
        { x: 0, z: 52, facing: 'N', w: 16 },
        { x: 16, z: 52, facing: 'N', w: 14 },
        { x: 0, z: 0, facing: 'S', w: 14 },
      ];
    case 'courtyard':
      // a U round a shared yard: west, north and east shops, yards meeting in the middle
      return [
        { x: 0, z: 48, facing: 'W', w: 16 },
        { x: 22, z: 0, facing: 'N', w: 14 },
        { x: 48, z: 48, facing: 'E', w: 14 },
      ];
    case 'kit':
      return [{ x: 0, z: 0, facing, w: 16 }];
  }
}

/** Shelf slots in a shop's local frame, by interior; all stay at z ≤ 13.5 (the service strip below is for Pads). */
function shelfSlots(interior: Interior, w: number, first: boolean): { box: Box; rot: Rot }[] {
  const s = (x: number, z: number, rot: Rot = 0): { box: Box; rot: Rot } => ({
    box: rot === 90 || rot === 270 ? [x, z, 1, 3] : [x, z, 3, 1],
    rot,
  });
  switch (interior) {
    case 'aisles':
      return [3.5, 8.5].flatMap((z) => [1, 5.5, 10].map((x) => s(x + (w > 14 ? 1 : 0), z)));
    case 'market':
      return [
        ...[3, 7.5, ...(first ? [] : [12])].map((z) => s(0.5, z, 90)),
        ...[3, 7.5, 12].map((z) => s(w - 1.5, z, 270)),
        s(w / 2 - 1.5, 5),
        s(w / 2 - 1.5, 10),
      ];
    case 'columns':
      return [3, 8.5].flatMap((z) => [1.5, 5, 8.5, 12].map((x) => s(x, z, 90)));
    case 'staggered':
      return [
        ...[1, 5.5, 10].map((x) => s(x + (w > 14 ? 1 : 0), 3)),
        ...[3.25, 7.75].map((x) => s(x + (w > 14 ? 1 : 0), 8.5)),
      ];
  }
}

export interface Generated {
  map: MapDef;
  order: string[];
  seed: number;
  format: Format;
  interiors: Interior[];
  /** Rerolls before a day passed every check. */
  rerolls: number;
}

export function generateDaily(seed: number, variant: Variant, k: Knobs = KNOBS): Generated {
  let last = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    const g = attemptDaily((seed + Math.imul(attempt, 0x9e3779b1)) | 0, variant, k);
    const problems = typeof g === 'string' ? [g] : validateMap(g.map, ASSETS).map((p) => `${p.id}: ${p.message}`);
    if (!problems.length && typeof g !== 'string') return { ...g, seed, rerolls: attempt };
    last = problems[0];
  }
  throw new Error(`Daily ${seed}: no valid Map in 20 tries (last: ${last})`);
}

export function attemptDaily(seed: number, variant: Variant, k: Knobs): Omit<Generated, 'rerolls'> | string {
  const rng = { rng: seed };
  const formats: Format[] = ['row', 'column', 'corner', 'split', 'courtyard'];
  const format: Format =
    variant === 'kit' ? 'kit' : formats[weighted(rng, [k.wRow, k.wColumn, k.wCorner, k.wSplit, k.wCourtyard])];
  const facing = (['N', 'S', 'W', 'E'] as Facing[])[randomInt(rng, 0, 3)];
  const count = variant === 'kit' ? 1 : randomInt(rng, k.areasMin, k.areasMax);
  const interiors: Interior[] = ['aisles', 'market', 'columns', 'staggered'];
  const tops = Object.keys(PRODS).filter((p) => producerOf(p));
  const have = new Set<string>();
  const units: Unit[] = formatUnits(format, facing)
    .slice(0, count)
    .map((u, a) => ({ ...u, area: `area_${a + 1}`, interior: interiors[randomInt(rng, 0, 3)], producers: [], sold: [] }));

  // Chains: Kit packs two into its one Area, Slabs one per Area (a second when the first is tiny)
  for (const u of units) {
    const max = k.chainMaxProducers - (variant === 'kit' ? 1 : 0);
    for (let c = 0; c < (variant === 'kit' ? 2 : 1) || u.producers.length < 2; c++) {
      const chain = shuffle(rng, tops)
        .map((t) => tree(t).filter((p) => !have.has(p)))
        .find((n) => n.length && n.length <= max);
      if (!chain || u.producers.length + chain.length > (variant === 'kit' ? 6 : 5)) break;
      chain.forEach((p) => have.add(p));
      u.producers.push(...chain);
    }
    const outputs = u.producers.map((p) => PROD[p].output);
    const tip = (o: string) => !u.producers.some((p) => PROD[p].inputs.includes(o));
    const slots = shelfSlots(u.interior, u.w, u.area === 'area_1').length;
    u.sold = [...outputs.filter(tip), ...outputs.filter((o) => !tip(o))].slice(0, slots);
  }

  const places: MapLayout['places'] = {};
  const pads: Record<string, PadDef> = {};
  const freeStations: MapDef['freeStations'] = {};
  const order: string[] = [];
  const props: Record<string, PropDef> = {};
  const doors: MapLayout['doors'] = {};
  const walls: MapLayout['walls'] = {};
  const taken: Box[] = [];
  const put = (u: Unit, id: string, local: Box, rot: Rot = 0) => {
    const box = toWorld(u, local);
    places[id] = { box, rot: rotWorld(u, rot) };
    taken.push(box);
    return box;
  };
  const ids = new Map<string, number>();
  const uid = (base: string) => {
    const n = (ids.get(base) ?? 0) + 1;
    ids.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  };
  let prev: string | null = null;
  const pad = (id: string, unlocks: StationDef, cost: number) => {
    pads[id] = { cost: round5(cost), requires: prev ? [prev] : [], unlocks };
    order.push(id);
    prev = id;
  };
  const clearOf = (b: Box, gap: number, others: Box[] = taken) => others.every((o) => boxGap(b, o) >= gap - 1e-6);

  // Area 1's fixed kit (the Corner Shop's, in local terms) and the road beside its yard
  const a1 = units[0];
  put(a1, 'register', [8, 18.5, 2.6, 1], 180);
  put(a1, 'cashier_1', [8.8, 20.2, 1, 1], 180);
  put(a1, 'office', [2.5, 17.5, 1.5, 1], 180);
  put(a1, 'mop_stand', [5.5, 14.55, 1, 1]);
  freeStations.mop_stand = { requires: [], unlocks: { kind: 'mopStand' } };
  const part = (id: string, b: Box) => (walls[id] = { kind: 'partition', box: toWorld(a1, b) });
  part('partition_office_n1', [0.3, 14.2, 2.7, 0.3]);
  part('partition_office_n2', [5, 14.2, 2.6, 0.3]);
  part('partition_office_e', [7.3, 14.5, 0.3, 7.2]);
  doors.door_office = { kind: 'office', box: toWorld(a1, [3, 14.2, 2, 0.3]) };
  const prop = (id: string, u: Unit, model: string, b: Box, rot: Rot, solid: boolean) =>
    (props[id] = { model, box: toWorld(u, b), rot: rotWorld(u, rot), solid, area: u.area });
  prop('prop_bookshelf', a1, 'bookshelf', [0.4, 17, 0.5, 3], 90, true);
  prop('prop_sofa', a1, 'sofa', [5.8, 17.8, 1.2, 2.6], 270, true);
  prop('prop_rug', a1, 'rug', [2, 19, 3, 1.8], 0, false);

  const yard1 = yardBox(a1);
  const blocked = (b: Box) => units.some((u) => boxesOverlap(b, unitBox(u)));
  const south = yard1[1] + yard1[3];
  const roadS: Box = [yard1[0] - 3, south + 2, yard1[2] + 6, 4];
  const roadN: Box = [yard1[0] - 3, yard1[1] - 6, yard1[2] + 6, 4];
  const road = !blocked(roadS) ? roadS : !blocked(roadN) ? roadN : null;
  if (!road) return 'no free yard edge for the road';
  const roadSouth = road === roadS;
  const carSpots = [0, 1, 2].map((i) => {
    const px = yard1[0] + 0.3 + i * 3;
    const pickup: Box = [px, roadSouth ? south - 2 : yard1[1] + 0.5, 1.5, 1.5];
    taken.push(pickup);
    return { car: [px - 0.75, roadSouth ? road[1] + 0.6 : road[1] + 1.6, 3, 1.8] as Box, pickup };
  });

  const bases = [k.padBase1, k.padBase2, k.padBase3];
  let areaSum = 0;
  for (const [a, u] of units.entries()) {
    let i = 0;
    const cost = () => bases[Math.min(a, 2)] * k.padGrowth ** i++;
    const first = a === 0;
    if (first) pad('register', { kind: 'register', queueLength: 6 }, cost());
    else {
      // this Area's Pad stands in the previous Area's service strip
      put(units[a - 1], u.area, [units[a - 1].w - 2, 16.5, 1, 1]);
      pad(u.area, { kind: 'area', area: u.area }, areaSum * k.areaPadShare);
      if (a === 1) {
        put(u, 'stocker_1', [2, 16.5, 1, 1]);
        pad('stocker_1', { kind: 'stocker' }, cost() * 2);
      }
    }
    const trash = first ? 'trash' : `trash_${a + 1}`;
    put(u, trash, [u.w - 1.5, 0.5, 1, 1]);
    freeStations[trash] = { requires: first ? [] : [u.area], unlocks: { kind: 'trash' } };

    const slots = shelfSlots(u.interior, u.w, first);
    let si = 0;
    // yard packing: scan the yard on a half-metre grid for the first spot clear of everything placed
    const yardSpot = (w: number, d: number): Box | null => {
      for (let z = SHOP_D + 2.5; z + d <= UNIT_D - 0.5; z += 0.5)
        for (let x = 0.5; x + w <= u.w - 0.5; x += 0.5) {
          const b = toWorld(u, [x, z, w, d]);
          if (clearOf(b, 1.6)) return [x, z, w, d];
        }
      return null;
    };
    for (const p of u.producers) {
      const product = PROD[p].output;
      if (u.sold.includes(product) && si < slots.length) {
        const sid = uid(`${product}_shelf`);
        put(u, sid, slots[si].box, slots[si].rot);
        si++;
        pad(sid, { kind: 'shelf', product }, cost());
      }
      const spot = yardSpot(...FOOT[p]);
      if (!spot) return `yard of ${u.area} is full`;
      const pid = uid(p);
      put(u, pid, spot, 180);
      pad(pid, { kind: 'producer', type: p }, cost());
      if (first && order.length === 4) pad('office', { kind: 'office' }, cost());
    }
    if (first && !pads.office) pad('office', { kind: 'office' }, cost());
    if (first) {
      pad('cashier_1', { kind: 'cashier', register: 'register' }, cost() * 1.5);
      if (variant === 'kit') {
        put(u, 'stocker_1', [12.5, 20.3, 1, 1]);
        pad('stocker_1', { kind: 'stocker' }, cost() * 2);
      }
    }
    areaSum = order.slice(-(i + 1)).reduce((t, id) => t + pads[id].cost, 0);
  }
  const lastU = units[units.length - 1];
  for (let z = UNIT_D - 2.5; z > SHOP_D + 2; z -= 0.5) {
    const b = toWorld(lastU, [lastU.w - 3.5, z, 1, 1]);
    if (clearOf(b, 1.6)) {
      places.exit = { box: b, rot: 0 };
      taken.push(b);
      break;
    }
  }
  if (!places.exit) return 'no room for the Exit Pad';
  pad('exit', { kind: 'exit' }, areaSum * 0.5);

  // walls and doors, in world terms: each shop's four edges, opened where they meet another shop,
  // with a Back Door where they meet another Area's yard
  for (const [a, u] of units.entries()) {
    const [sx, sz, sw, sd] = shopBox(u);
    const t = 0.3;
    const edges: Record<Facing, Box> = {
      N: [sx, sz, sw, t],
      S: [sx, sz + sd - t, sw, t],
      W: [sx, sz + t, t, sd - 2 * t],
      E: [sx + sw - t, sz + t, t, sd - 2 * t],
    };
    const back: Record<Facing, Facing> = { N: 'S', S: 'N', W: 'E', E: 'W' };
    const holes: Record<Facing, Box[]> = { N: [], S: [], W: [], E: [] };
    const front = toWorld(u, [a === 0 ? 7 : 3.5, 0, 3, t]);
    doors[`door_front_${a + 1}`] = { kind: 'customer', box: front };
    holes[u.facing].push(front);
    const backDoor = toWorld(u, [a === 0 ? 12.5 : 6, SHOP_D - t, 2.5, t]);
    doors[`door_back_${a + 1}`] = { kind: 'back', box: backDoor };
    holes[back[u.facing]].push(backDoor);
    for (const side of ['N', 'S', 'W', 'E'] as Facing[]) {
      if (side === u.facing || side === back[u.facing]) continue;
      const e = edges[side];
      const probe: Box =
        side === 'N' ? [e[0], e[1] - 0.5, e[2], 0.5]
        : side === 'S' ? [e[0], e[1] + t, e[2], 0.5]
        : side === 'W' ? [e[0] - 0.5, e[1], 0.5, e[3]]
        : [e[0] + t, e[1], 0.5, e[3]];
      if (units.some((o) => o !== u && boxesOverlap(probe, shopBox(o)))) {
        holes[side].push(e);
        continue;
      }
      for (const o of units) {
        if (o === u || !boxesOverlap(probe, yardBox(o))) continue;
        const y = yardBox(o);
        const horiz = side === 'N' || side === 'S';
        const lo = Math.max(horiz ? e[0] : e[1], horiz ? y[0] : y[1]);
        const hi = Math.min(horiz ? e[0] + e[2] : e[1] + e[3], horiz ? y[0] + y[2] : y[1] + y[3]);
        if (hi - lo < 4) continue;
        const mid = (lo + hi) / 2 - 1.25;
        const d: Box = horiz ? [mid, e[1], 2.5, t] : [e[0], mid, t, 2.5];
        doors[`door_side_${a + 1}_${o.area}`] = { kind: 'back', box: d };
        holes[side].push(d);
      }
    }
    for (const side of ['N', 'S', 'W', 'E'] as Facing[]) {
      const e = edges[side];
      const horiz = side === 'N' || side === 'S';
      const [p0, len] = horiz ? [e[0], e[2]] : [e[1], e[3]];
      const cuts = holes[side].map((h) => (horiz ? [h[0], h[0] + h[2]] : [h[1], h[1] + h[3]])).sort((p, q) => p[0] - q[0]);
      let at = p0;
      const segs: [number, number][] = [];
      for (const [c0, c1] of cuts) {
        if (c0 > at + 0.05) segs.push([at, c0]);
        at = Math.max(at, c1);
      }
      if (p0 + len > at + 0.05) segs.push([at, p0 + len]);
      const kind = side === 'N' || side === 'W' ? 'tall' : 'low';
      segs.forEach(([s0, s1], n) => {
        walls[`wall_${a + 1}${side}${n}`] = { kind, box: horiz ? [s0, e[1], s1 - s0, t] : [e[0], s0, t, s1 - s0] };
      });
    }
  }

  // map bounds, then the Street: a strip outside every shop front, run edge to edge of the map
  const all = units.map(unitBox);
  const minX = Math.min(...all.map((b) => b[0]), road[0]) - 4;
  const minZ = Math.min(...all.map((b) => b[1]), road[1]) - 4;
  const maxX = Math.max(...all.map((b) => b[0] + b[2]), road[0] + road[2]) + 4;
  const maxZ = Math.max(...all.map((b) => b[1] + b[3]), road[1] + road[3]) + 4;
  const street: Box[] = [];
  const streetSpots: Point[] = [];
  const areas: MapLayout['areas'] = {};
  for (const u of units) {
    const [sx, sz, sw, sd] = shopBox(u);
    const s: Box =
      u.facing === 'N' ? [minX, sz - 4, maxX - minX, 4]
      : u.facing === 'S' ? [minX, sz + sd, maxX - minX, 4]
      : u.facing === 'W' ? [sx - 4, minZ, 4, maxZ - minZ]
      : [sx + sw, minZ, 4, maxZ - minZ];
    if (!street.some((o) => o.every((v, i) => Math.abs(v - s[i]) < 1e-6))) street.push(s);
    if (units.some((o) => boxesOverlap(s, unitBox(o)))) return `Street of ${u.area} runs through a block`;
    areas[u.area] = [shopBox(u), yardBox(u)];
  }
  if (street.some((s) => boxesOverlap(s, road))) return 'road crosses the Street';
  for (const s of street) {
    const horiz = s[2] > s[3];
    streetSpots.push(horiz ? [s[0] + 2, s[1] + 2] : [s[0] + 2, s[1] + 2], horiz ? [s[0] + s[2] - 2, s[1] + 2] : [s[0] + 2, s[1] + s[3] - 2]);
  }
  // split: the Street between the two rows is Area 1 ground, so the Player walks it from the Opening;
  // Area 3's front door stays shut until Area 3 is bought
  if (format === 'split') {
    const fronts = units.map(shopBox);
    const x0 = Math.min(...fronts.map((b) => b[0]));
    const x1 = Math.max(...fronts.map((b) => b[0] + b[2]));
    areas.area_1.push([x0, shopBox(units[0])[1] - 4, x1 - x0, 4]);
  }

  // Props: trees and bushes on open grass, a few pots and coolers in each shop's corners, flowers in the yards
  const ground = [...all, ...street, road];
  const nTrees = randomInt(rng, k.treesMin, k.treesMax);
  for (let n = 0, tries = 0; n < nTrees && tries < 400; tries++) {
    const big = nextRandom(rng) < 0.6;
    const size = big ? 2 : 1;
    const b: Box = [minX + nextRandom(rng) * (maxX - minX - size), minZ + nextRandom(rng) * (maxZ - minZ - size), size, size];
    if (!ground.every((g) => boxGap(b, g) >= 1)) continue;
    if (!Object.values(props).every((p) => boxGap(b, p.box) >= 0.5)) continue;
    const model = big ? (nextRandom(rng) < 0.5 ? 'tree' : 'tree-oak') : nextRandom(rng) < 0.6 ? 'bush' : 'flower';
    props[`prop_out_${n++}`] = { model, box: b, rot: (randomInt(rng, 0, 3) * 90) as Rot, solid: model !== 'flower' };
  }
  const keepClear = Object.values(doors).map((d) => d.box);
  for (const u of units) {
    const corners: Box[] = [
      [0.4, 0.4, 0.6, 0.6],
      [u.w - 1, 14.5, 0.6, 0.6],
      [u.w - 1, SHOP_D - 1, 0.6, 0.6],
      [0.4, SHOP_D - 1, 0.6, 0.6],
      [u.w / 2 - 0.3, SHOP_D - 1, 0.6, 0.6],
    ];
    let n = 0;
    for (const c of shuffle(rng, corners)) {
      if (n >= k.indoorMax) break;
      const b = toWorld(u, c);
      if (!clearOf(b, 1) || !clearOf(b, 1.5, keepClear)) continue;
      if (!Object.values(props).every((p) => boxGap(b, p.box) >= 0.8)) continue;
      if (Object.values(walls).some((w) => w.kind === 'partition' && boxGap(b, w.box) < 0.8)) continue;
      const model = nextRandom(rng) < 0.65 ? 'plant' : 'cooler';
      props[`prop_in_${u.area}_${n++}`] = { model, box: b, rot: rotWorld(u, 0), solid: true, area: u.area };
    }
    for (let f = 0; f < 3; f++) {
      const local: Box = [0.5 + nextRandom(rng) * (u.w - 1.5), SHOP_D + 1 + nextRandom(rng) * 24, 0.6, 0.6];
      const b = toWorld(u, local);
      if (clearOf(b, 1.2)) props[`prop_flower_${u.area}_${f}`] = { model: 'flower', box: b, rot: 0, solid: false, area: u.area };
    }
  }

  // shift everything so the map starts at (0, 0)
  const sh = (b: Box): Box => [b[0] - minX, b[1] - minZ, b[2], b[3]];
  const sp = (p: Point): Point => [p[0] - minX, p[1] - minZ];
  for (const p of Object.values(places)) p.box = sh(p.box);
  for (const w of Object.values(walls)) w.box = sh(w.box);
  for (const d of Object.values(doors)) d.box = sh(d.box);
  for (const p of Object.values(props)) p.box = sh(p.box);
  for (const a of Object.keys(areas)) areas[a] = areas[a].map(sh);

  const layout: MapLayout = {
    size: [maxX - minX, maxZ - minZ],
    areas,
    places,
    walls,
    doors,
    props,
    floors: units.map((u) => sh(shopBox(u))),
    street: street.map(sh),
    roads: [sh(road)],
    streetSpots: [...streetSpots.slice(0, 2), ...streetSpots.slice(2, 3)].map(sp),
    waitingSpots: ([[8.5, 12.8], [7.5, 12.8], [6.5, 12.8], [5.5, 12.8]] as Point[]).map((p) => sp(ptWorld(a1, p))),
    carSpots: carSpots.map((c) => ({ car: sh(c.car), pickup: sh(c.pickup) })),
    van: sh([road[0] + road[2] - 4, carSpots[0].car[1], 3, 1.6]),
    playerStart: sp(ptWorld(a1, [4, 12])),
  };

  const share = k.startShareMin + nextRandom(rng) * (k.startShareMax - k.startShareMin);
  const area2 = order.indexOf('area_2');
  const cut = Math.min(Math.floor(order.length * share), area2 > 0 ? area2 : order.length - 3);
  const owned = ['area_1', ...order.slice(0, cut).filter((id) => pads[id].unlocks.kind !== 'stocker')];

  const products: Record<string, Product> = {};
  const producers: Record<string, ProducerType> = {};
  for (const u of units)
    for (const p of u.producers) {
      producers[p] = PROD[p];
      for (const id of [...PROD[p].inputs, PROD[p].output]) products[id] = PRODS[id];
    }

  const map: MapDef = {
    id: `daily-${format}-${(seed >>> 0).toString(16)}`,
    name: 'Daily Shift',
    layout,
    products,
    producers,
    pads,
    freeStations,
    upgrades: upgradesFor(Object.keys(producers), units.length),
    start: { owned, money: k.startMoney },
    objectives: [],
    challenges: false,
    music: 'corner-shop',
    movePrices: Array(9).fill(1e9),
    events: {
      delivery: { requires: [order[1]] },
      robbery: { requires: ['office'], byArea: { area_1: { bounty: 30, cashOver: 120 }, area_2: { bounty: 60, cashOver: 250 } } },
      inspector: {
        requires: ['office'],
        byArea: { area_1: { reward: [60, 120], perDirt: 10, review: 80 }, area_2: { reward: [150, 300], perDirt: 30, review: 200 } },
      },
    },
  };
  return { map, order, seed, format, interiors: units.map((u) => u.interior) };
}

function upgradesFor(producers: string[], areas: number): Record<string, UpgradeDef> {
  const L = (costs: number[], values: number[]) => costs.map((cost, i) => ({ cost, value: values[i] }));
  const m = areas > 1 ? 2 : 1;
  const ups: Record<string, UpgradeDef> = {
    player_speed: { name: 'Walk speed', family: 'player', target: 'player', stat: 'speed', levels: L([15, 30, 55].map((c) => c * m), [6, 6.5, 7]), requires: ['office'] },
    stack_cap: { name: 'Stack size', family: 'player', target: 'player', stat: 'stack', levels: L([20, 40, 75].map((c) => c * m), [10, 12, 14]), requires: ['office'] },
    cashier_speed: { name: 'Cashier speed', family: 'staff', target: 'cashier', stat: 'checkoutTime', levels: L([40, 75].map((c) => c * m), [1.6, 1.3]), requires: ['cashier_1'] },
  };
  for (const p of producers)
    ups[`speed_${p}`] = { name: `${PROD[p].name} speed`, family: 'station', target: p, stat: 'workTime', levels: L([20 * m, 40 * m], [0.8, 0.64]), requires: [p] };
  return ups;
}

// ---------- goal calibration: the bot plays the Shift with no goal; each part's size is what it reached by the target

export interface Calibration {
  goal: ObjectiveDef[];
  /** Seconds the bot needed for the whole goal (re-run with the goal set). */
  botSeconds: number;
  /** Seconds when each part was met in the re-run. */
  partSeconds: number[];
  timeline: { t: number; earned: number; owned: number }[];
}

const snapshot = (w: World) => ({
  earned: w.stats.moneyEarned,
  sold: { ...w.stats.sold },
  deliveries: w.stats.deliveriesFull,
  owned: new Set(w.owned),
});

export function calibrate(g: Generated, k: Knobs = KNOBS): Calibration {
  const target = k.targetMinutes * 60 * k.botPace;
  const w = createWorld(g.map, null, g.seed);
  const bot = new Bot();
  const timeline: Calibration['timeline'] = [];
  const boughtAt: [string, number][] = [];
  while (w.t < target) {
    const before = w.owned.size;
    step(w, bot.intents(w));
    if (w.owned.size !== before) for (const id of w.owned) if (!boughtAt.some(([b]) => b === id)) boughtAt.push([id, w.t]);
    if (Math.floor(w.t) % 15 === 0 && Math.floor(w.t - 1 / TUNING.tickRate) % 15 !== 0)
      timeline.push({ t: Math.floor(w.t), earned: Math.floor(w.stats.moneyEarned), owned: w.owned.size });
  }
  const at = snapshot(w);

  // goal parts, picked by the seed
  const rng = { rng: g.seed ^ 0x5eed };
  const parts = 1 + [...Array(k.goalPartsMax - 1)].filter(() => nextRandom(rng) < k.extraPartChance).length;
  const kinds = shuffle<GoalKind>(rng, ['own', 'earn', 'sell', 'deliveries']);
  const goal: ObjectiveDef[] = [];
  for (const kind of kinds) {
    if (goal.length >= parts) break;
    if (kind === 'earn') goal.push({ kind: 'earn', n: nice(at.earned) });
    if (kind === 'deliveries' && at.deliveries >= 2) goal.push({ kind: 'deliveries', n: at.deliveries });
    if (kind === 'sell') {
      const best = Object.entries(at.sold).sort((a, b) => (PRODUCTS as Record<string, Product>)[b[0]].price - (PRODUCTS as Record<string, Product>)[a[0]].price).find(([, n]) => n >= 10);
      if (best) goal.push({ kind: 'sell', product: best[0], n: nice(best[1]) });
    }
    if (kind === 'own') {
      // the Pad bought nearest the target, never one owned at the Opening
      const near = boughtAt.filter(([id]) => g.map.pads[id] && !g.map.start.owned.includes(id)).at(-1);
      if (near && near[1] > target * 0.75) goal.push({ kind: 'own', id: near[0] });
    }
  }
  if (!goal.length) goal.push({ kind: 'earn', n: nice(Math.max(at.earned, 50)) });

  // re-run with the goal: how long the bot really takes, per part
  const m = { ...g.map, objectives: goal };
  const v = createWorld(m, null, g.seed);
  const vb = new Bot();
  const partSeconds = goal.map(() => -1);
  while (v.t < k.calibrateCapMinutes * 60) {
    step(v, vb.intents(v));
    goal.forEach((o, i) => {
      if (partSeconds[i] < 0) {
        const { got, want } = objectiveProgress(v, o);
        if (got >= want) partSeconds[i] = v.t;
      }
    });
    if (partSeconds.every((s) => s >= 0)) break;
  }
  const botSeconds = partSeconds.every((s) => s >= 0) ? Math.max(...partSeconds) : -1;
  return { goal, botSeconds, partSeconds, timeline };
}

export const goalText = (o: ObjectiveDef, map: MapDef): string => {
  switch (o.kind) {
    case 'earn':
      return `Earn $${o.n}`;
    case 'sell':
      return `Sell ${o.n} ${map.products[o.product]?.name ?? o.product}`;
    case 'deliveries':
      return `Fill ${o.n} Deliveries`;
    case 'own': {
      const u = map.pads[o.id]?.unlocks;
      const what =
        u?.kind === 'shelf' ? `${map.products[u.product].name} Shelf`
        : u?.kind === 'producer' ? map.producers[u.type].name
        : u?.kind === 'area' ? `Area ${u.area.slice(5)}`
        : o.id.replace(/_/g, ' ');
      return `Buy the ${what}`;
    }
  }
};

export const goalId = objectiveId;
