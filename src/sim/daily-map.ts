// The Daily Shift's Map, generated from the day's seed. Each Area is a block (shop + yard, maps/daily/blocks.ts)
// turned to face N/S/W/E and placed by a Format; walls, doors, Street, road and Car Spots follow from where the
// blocks land. A day that fails a check rerolls on a derived seed. Part of SIM_VERSION.
import type { Box, MapDef, MapLayout, PadDef, Point, PropDef, Rot, StationDef } from './map';
import { PRODUCTS, type Product } from '../../catalog/products';
import { PRODUCERS, type ProducerType } from '../../catalog/producers';
import { ASSETS } from '../../catalog/assets';
import { AREA_1, BLOCK, FORMATS, INTERIORS, PROPS, STRIP, shelfSlots } from '../../maps/daily/blocks';
import type { Facing, Format, Interior } from '../../maps/daily/blocks';
import { dailyEvents, dailyUpgrades } from '../../maps/daily/economy';
import { nextRandom, randomBetween, randomInt, shuffle, weighted } from './rng';
import { boxGap, boxesOverlap, inBox } from './geometry';
import { validateMap } from './validate';
import { cutOff } from './layout';
import { makeField, seedCells } from './nav';
import { rebuildNav } from './walk';
import { createWorld, type World } from './world';
import { TUNING } from './tuning';

export interface DailyMap {
  map: MapDef;
  format: Format;
  interiors: Interior[];
  /** Rerolls before the day passed every check. */
  rerolls: number;
}

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

const K = TUNING.dailyMap;
const PROD = PRODUCERS as Record<string, ProducerType>;
const PRODS = PRODUCTS as Record<string, Product>;
const TURN: Record<Facing, Rot> = { N: 0, W: 90, S: 180, E: 270 };
const BACK: Record<Facing, Facing> = { N: 'S', S: 'N', W: 'E', E: 'W' };
const SIDES: Facing[] = ['N', 'S', 'W', 'E'];

const producerOf = (product: string): string | undefined => Object.keys(PROD).find((id) => PROD[id].output === product);

/** The Producers that make `product`, inputs first. */
function chainOf(product: string, out: string[] = []): string[] {
  const id = producerOf(product);
  if (!id || out.includes(id)) return out;
  for (const input of PROD[id].inputs) chainOf(input, out);
  out.push(id);
  return out;
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Local box (front at z = 0) → world. */
function toWorld(u: Unit, [x, z, w, d]: Box): Box {
  switch (u.facing) {
    case 'N':
      return [u.x + x, u.z + z, w, d];
    case 'S':
      return [u.x + u.w - x - w, u.z + BLOCK.depth - z - d, w, d];
    case 'W':
      return [u.x + z, u.z + u.w - x - w, d, w];
    case 'E':
      return [u.x + BLOCK.depth - z - d, u.z + x, d, w];
  }
}
const ptWorld = (u: Unit, [x, z]: Point): Point => {
  const [wx, wz] = toWorld(u, [x, z, 0, 0]);
  return [wx, wz];
};
const rotWorld = (u: Unit, r: Rot): Rot => ((r + TURN[u.facing]) % 360) as Rot;
const unitBox = (u: Unit): Box => toWorld(u, [0, 0, u.w, BLOCK.depth]);
const shopBox = (u: Unit): Box => toWorld(u, [0, 0, u.w, BLOCK.shopDepth]);
const yardBox = (u: Unit): Box => toWorld(u, [0, BLOCK.shopDepth, u.w, BLOCK.depth - BLOCK.shopDepth]);

/** Throws when no reroll passes; the calendar CI proof makes sure that never ships. */
export function generateDailyMap(seed: number): DailyMap {
  let last = '';
  for (let attempt = 0; attempt < K.rerolls; attempt++) {
    const g = attemptDaily((seed + Math.imul(attempt, 0x9e3779b1)) | 0);
    const problem = typeof g === 'string' ? g : checkDaily(g.map);
    if (!problem && typeof g !== 'string') return { ...g, rerolls: attempt };
    last = problem ?? '';
  }
  throw new Error(`Daily seed ${seed}: no valid Map in ${K.rerolls} tries (last: ${last})`);
}

/** The validator, then every Station reachable and every shop within a short walk, with everything bought. */
function checkDaily(map: MapDef): string | null {
  const problem = validateMap(map, ASSETS)[0];
  if (problem) return `${problem.id}: ${problem.message}`;
  const w = builtOut(map);
  const cut = cutOff(w);
  if (cut) return cut;
  const d = shopWalks(w);
  for (let a = 0; a < d.length; a++)
    for (let b = a + 1; b < d.length; b++)
      if (d[a][b] > K.shopWalk) return `shops ${a + 1} and ${b + 1} are ${d[a][b].toFixed(1)} m apart`;
  return null;
}

/** A World on `map` with every Area and Pad owned. */
export const builtOut = (map: MapDef): World =>
  createWorld({ ...map, start: { ...map.start, owned: ['area_1', ...Object.keys(map.pads)] } }, null, 0);

/** Shortest walks (m) between shop floors on the walker grid; walking through a third shop costs nothing. */
export function shopWalks(w: World): number[][] {
  rebuildNav(w);
  const grid = w.nav.walker;
  const cells = w.map.layout.floors.map((f) => seedCells(grid, (x, z) => inBox(x, z, f)));
  const d = cells.map((from) => {
    const field = makeField(grid, from);
    return cells.map((to) => to.reduce((best, c) => Math.min(best, field[c]), Infinity));
  });
  for (let k = 0; k < d.length; k++)
    for (const row of d) for (let b = 0; b < d.length; b++) row[b] = Math.min(row[b], row[k] + d[k][b]);
  return d;
}

function attemptDaily(seed: number): Omit<DailyMap, 'rerolls'> | string {
  const rng = { rng: seed };
  const formats = Object.keys(K.formats) as Format[];
  const format = formats[weighted(rng, Object.values(K.formats))];
  const facing = SIDES[randomInt(rng, 0, 3)];
  const kit = format === 'kit';
  const count = kit ? 1 : randomInt(rng, ...K.slabsAreas);
  const tops = Object.keys(PRODS).filter((p) => producerOf(p));
  const have = new Set<string>();
  const units: Unit[] = FORMATS[format].slice(0, count).map((f, a) => ({
    x: f.x,
    z: f.z,
    facing: f.facing ?? facing,
    w: BLOCK.width[a === 0 ? 0 : 1],
    area: `area_${a + 1}`,
    interior: INTERIORS[randomInt(rng, 0, INTERIORS.length - 1)],
    producers: [],
    sold: [],
  }));

  // Chains: Kit packs two into its one Area, Slabs one per Area (a second when the first is tiny)
  const chainMax = K.chainProducers - (kit ? 1 : 0);
  const areaMax = kit ? K.areaProducers.kit : K.areaProducers.slabs;
  for (const u of units) {
    for (let c = 0; c < (kit ? 2 : 1) || u.producers.length < 2; c++) {
      const chain = shuffle(rng, tops)
        .map((t) => chainOf(t).filter((p) => !have.has(p)))
        .find((n) => n.length && n.length <= chainMax);
      if (!chain || u.producers.length + chain.length > areaMax) break;
      chain.forEach((p) => have.add(p));
      u.producers.push(...chain);
    }
    // end Products first, then the in-between ones, as far as the Shelf slots go
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

  // Area 1's fixed corner, and the road beside its yard
  const a1 = units[0];
  for (const [id, p] of Object.entries(AREA_1.places)) put(a1, id, p.box, p.rot);
  freeStations.mop_stand = { requires: [], unlocks: { kind: 'mopStand' } };
  for (const [id, b] of Object.entries(AREA_1.partitions)) walls[id] = { kind: 'partition', box: toWorld(a1, b) };
  doors.door_office = { kind: 'office', box: toWorld(a1, AREA_1.officeDoor) };
  for (const [id, p] of Object.entries(AREA_1.props))
    props[id] = {
      model: p.model,
      box: toWorld(a1, p.box),
      rot: rotWorld(a1, p.rot),
      solid: !('flat' in p),
      area: a1.area,
    };

  const yard1 = yardBox(a1);
  const R = BLOCK.road;
  const blocked = (b: Box) => units.some((u) => boxesOverlap(b, unitBox(u)));
  const south = yard1[1] + yard1[3];
  const roadS: Box = [yard1[0] - R.overhang, south + R.gap, yard1[2] + 2 * R.overhang, R.w];
  const roadN: Box = [yard1[0] - R.overhang, yard1[1] - R.gap - R.w, yard1[2] + 2 * R.overhang, R.w];
  const road = !blocked(roadS) ? roadS : !blocked(roadN) ? roadN : null;
  if (!road) return 'no free yard edge for the road';
  const roadSouth = road === roadS;
  const C = BLOCK.carSpots;
  const carSpots = [...Array(C.n)].map((_, i) => {
    const px = yard1[0] + C.inset + i * C.step;
    const pickup: Box = [px, roadSouth ? south - (C.pickup + C.edgeGap) : yard1[1] + C.edgeGap, C.pickup, C.pickup];
    taken.push(pickup);
    const car: Box = [px + (C.pickup - C.car[0]) / 2, road[1] + (roadSouth ? C.carIn : C.carInNorth), ...C.car];
    return { car, pickup };
  });

  // the Pad chain, Area by Area
  let areaSum = 0;
  for (const [a, u] of units.entries()) {
    let i = 0;
    const cost = () => K.padBase[Math.min(a, K.padBase.length - 1)] * K.padGrowth ** i++;
    const first = a === 0;
    if (first) pad('register', { kind: 'register', queueLength: 6 }, cost());
    else {
      // this Area's Pad stands in the previous Area's service strip
      const p = units[a - 1];
      put(p, u.area, [p.w - STRIP.areaPad.fromRight, STRIP.areaPad.z, 1, 1]);
      pad(u.area, { kind: 'area', area: u.area }, areaSum * K.areaPadShare);
      if (a <= 2) {
        const sid = `stocker_${a}`;
        put(u, sid, STRIP.stocker);
        pad(sid, { kind: 'stocker' }, cost() * K.staffCost.stocker);
      }
    }
    const trash = first ? 'trash' : `trash_${a + 1}`;
    put(u, trash, [u.w - STRIP.trash.fromRight, STRIP.trash.z, 1, 1]);
    freeStations[trash] = { requires: first ? [] : [u.area], unlocks: { kind: 'trash' } };

    const slots = shelfSlots(u.interior, u.w, first);
    let si = 0;
    const Y = BLOCK.yard;
    const yardSpot = (w: number, d: number): Box | null => {
      for (let z = BLOCK.shopDepth + Y.from; z + d <= BLOCK.depth - Y.edge; z += Y.step)
        for (let x = Y.edge; x + w <= u.w - Y.edge; x += Y.step)
          if (clearOf(toWorld(u, [x, z, w, d]), Y.clear)) return [x, z, w, d];
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
      const spot = yardSpot(...PROD[p].footprint);
      if (!spot) return `yard of ${u.area} is full`;
      const pid = uid(p);
      put(u, pid, spot, 180);
      pad(pid, { kind: 'producer', type: p }, cost());
      if (first && order.length === K.officeAfter) pad('office', { kind: 'office' }, cost());
    }
    if (first && !pads.office) pad('office', { kind: 'office' }, cost());
    if (first) {
      pad('cashier_1', { kind: 'cashier', register: 'register' }, cost() * K.staffCost.cashier);
      if (kit) {
        put(u, 'stocker_1', AREA_1.kitStocker);
        pad('stocker_1', { kind: 'stocker' }, cost() * K.staffCost.stocker);
      }
    }
    areaSum = order.slice(-(i + 1)).reduce((t, id) => t + pads[id].cost, 0);
  }
  const lastU = units[units.length - 1];
  for (let z = BLOCK.depth - 2.5; z > BLOCK.shopDepth + 2; z -= BLOCK.yard.step) {
    const b = toWorld(lastU, [lastU.w - 3.5, z, 1, 1]);
    if (clearOf(b, BLOCK.yard.clear)) {
      places.exit = { box: b, rot: 0 };
      taken.push(b);
      break;
    }
  }
  if (!places.exit) return 'no room for the Exit Pad';
  pad('exit', { kind: 'exit' }, areaSum * K.exitShare);

  // map bounds, then the Street: a strip outside every shop front, run edge to edge of the map
  const all = units.map(unitBox);
  const m = BLOCK.margin;
  const minX = Math.min(...all.map((b) => b[0]), road[0]) - m;
  const minZ = Math.min(...all.map((b) => b[1]), road[1]) - m;
  const maxX = Math.max(...all.map((b) => b[0] + b[2]), road[0] + road[2]) + m;
  const maxZ = Math.max(...all.map((b) => b[1] + b[3]), road[1] + road[3]) + m;
  const S = BLOCK.street;
  const street: Box[] = [];
  const streetSpots: Point[] = [];
  const areas: MapLayout['areas'] = {};
  const streetOf = (u: Unit): Box => {
    const [sx, sz, sw, sd] = shopBox(u);
    return u.facing === 'N'
      ? [minX, sz - S, maxX - minX, S]
      : u.facing === 'S'
        ? [minX, sz + sd, maxX - minX, S]
        : u.facing === 'W'
          ? [sx - S, minZ, S, maxZ - minZ]
          : [sx + sw, minZ, S, maxZ - minZ];
  };
  for (const u of units) {
    const s = streetOf(u);
    if (!street.some((o) => o.every((v, i) => Math.abs(v - s[i]) < 1e-6))) street.push(s);
  }

  // each shop's four edges: open where they meet another shop, a Back Door where they meet another Area's yard
  const t = BLOCK.wall;
  for (const [a, u] of units.entries()) {
    const [sx, sz, sw, sd] = shopBox(u);
    const edges: Record<Facing, Box> = {
      N: [sx, sz, sw, t],
      S: [sx, sz + sd - t, sw, t],
      W: [sx, sz + t, t, sd - 2 * t],
      E: [sx + sw - t, sz + t, t, sd - 2 * t],
    };
    const holes: Record<Facing, Box[]> = { N: [], S: [], W: [], E: [] };
    const di = a === 0 ? 0 : 1;
    const front = toWorld(u, [BLOCK.frontDoor.x[di], 0, BLOCK.frontDoor.w, t]);
    doors[`door_front_${a + 1}`] = { kind: 'customer', box: front };
    holes[u.facing].push(front);
    const backDoor = toWorld(u, [BLOCK.backDoor.x[di], BLOCK.shopDepth - t, BLOCK.backDoor.w, t]);
    doors[`door_back_${a + 1}`] = { kind: 'back', box: backDoor };
    holes[BACK[u.facing]].push(backDoor);
    for (const side of SIDES) {
      if (side === u.facing || side === BACK[u.facing]) continue;
      const e = edges[side];
      const p = BLOCK.sideDoor.probe;
      const probe: Box =
        side === 'N'
          ? [e[0], e[1] - p, e[2], p]
          : side === 'S'
            ? [e[0], e[1] + t, e[2], p]
            : side === 'W'
              ? [e[0] - p, e[1], p, e[3]]
              : [e[0] + t, e[1], p, e[3]];
      if (units.some((o) => o !== u && boxesOverlap(probe, shopBox(o)))) {
        holes[side].push(e);
        continue;
      }
      if (street.some((s) => boxesOverlap(probe, s))) {
        const C = BLOCK.cornerDoor;
        const d = [toWorld(u, [0, C.from, t, C.w]), toWorld(u, [u.w - t, C.from, t, C.w])].find((b) =>
          boxesOverlap(b, e),
        );
        if (d) {
          doors[`door_corner_${a + 1}`] = { kind: 'customer', box: d };
          holes[side].push(d);
        }
      }
      for (const o of units) {
        if (o === u || !boxesOverlap(probe, yardBox(o))) continue;
        const y = yardBox(o);
        const horiz = side === 'N' || side === 'S';
        const lo = Math.max(horiz ? e[0] : e[1], horiz ? y[0] : y[1]);
        const hi = Math.min(horiz ? e[0] + e[2] : e[1] + e[3], horiz ? y[0] + y[2] : y[1] + y[3]);
        if (hi - lo < BLOCK.sideDoor.minOverlap) continue;
        const mid = (lo + hi - BLOCK.sideDoor.w) / 2;
        const d: Box = horiz ? [mid, e[1], BLOCK.sideDoor.w, t] : [e[0], mid, t, BLOCK.sideDoor.w];
        doors[`door_side_${a + 1}_${o.area}`] = { kind: 'back', box: d };
        holes[side].push(d);
      }
    }
    for (const side of SIDES) {
      const e = edges[side];
      const horiz = side === 'N' || side === 'S';
      const [p0, len] = horiz ? [e[0], e[2]] : [e[1], e[3]];
      const cuts = holes[side]
        .map((h) => (horiz ? [h[0], h[0] + h[2]] : [h[1], h[1] + h[3]]))
        .sort((p, q) => p[0] - q[0]);
      let at = p0;
      const segs: [number, number][] = [];
      for (const [c0, c1] of cuts) {
        if (c0 > at + BLOCK.wallMin) segs.push([at, c0]);
        at = Math.max(at, c1);
      }
      if (p0 + len > at + BLOCK.wallMin) segs.push([at, p0 + len]);
      const kind = side === 'N' || side === 'W' ? 'tall' : 'low';
      segs.forEach(([s0, s1], n) => {
        walls[`wall_${a + 1}${side}${n}`] = { kind, box: horiz ? [s0, e[1], s1 - s0, t] : [e[0], s0, t, s1 - s0] };
      });
    }
  }

  for (const u of units) {
    if (units.some((o) => boxesOverlap(streetOf(u), unitBox(o)))) return `Street of ${u.area} runs through a block`;
    areas[u.area] = [shopBox(u), yardBox(u)];
  }
  if (street.some((s) => boxesOverlap(s, road))) return 'road crosses the Street';
  for (const s of street) {
    const horiz = s[2] > s[3];
    streetSpots.push(
      [s[0] + S / 2, s[1] + S / 2],
      horiz ? [s[0] + s[2] - S / 2, s[1] + S / 2] : [s[0] + S / 2, s[1] + s[3] - S / 2],
    );
  }
  // a Street running between shops (split, corner, courtyard) is Area 1 ground, so the Player walks it
  const floors = units.map(shopBox);
  const x0 = Math.min(...floors.map((b) => b[0]));
  const z0 = Math.min(...floors.map((b) => b[1]));
  const x1 = Math.max(...floors.map((b) => b[0] + b[2]));
  const z1 = Math.max(...floors.map((b) => b[1] + b[3]));
  for (const s of street) {
    const cx0 = Math.max(x0, s[0]);
    const cz0 = Math.max(z0, s[1]);
    const cx1 = Math.min(x1, s[0] + s[2]);
    const cz1 = Math.min(z1, s[1] + s[3]);
    if (cx1 > cx0 && cz1 > cz0) areas.area_1.push([cx0, cz0, cx1 - cx0, cz1 - cz0]);
  }

  // Props: trees and bushes on open grass, pots and coolers in shop corners, flowers in yards
  const ground = [...all, ...street, road];
  const nTrees = randomInt(rng, ...K.trees);
  for (let n = 0, tries = 0; n < nTrees && tries < PROPS.tries; tries++) {
    const big = nextRandom(rng) < PROPS.bigShare;
    const size = big ? 2 : 1;
    const b: Box = [
      minX + nextRandom(rng) * (maxX - minX - size),
      minZ + nextRandom(rng) * (maxZ - minZ - size),
      size,
      size,
    ];
    if (!ground.every((g) => boxGap(b, g) >= PROPS.treeGap)) continue;
    if (!Object.values(props).every((p) => boxGap(b, p.box) >= PROPS.propGap)) continue;
    const model = big
      ? nextRandom(rng) < 0.5
        ? 'tree'
        : 'tree-oak'
      : nextRandom(rng) < PROPS.bushShare
        ? 'bush'
        : 'flower';
    props[`prop_out_${n++}`] = { model, box: b, rot: (randomInt(rng, 0, 3) * 90) as Rot, solid: model !== 'flower' };
  }
  const doorBoxes = Object.values(doors).map((d) => d.box);
  for (const u of units) {
    let n = 0;
    for (const c of shuffle(rng, PROPS.corners(u.w))) {
      if (n >= K.indoorProps) break;
      const b = toWorld(u, c);
      if (!clearOf(b, PROPS.indoorClear) || !clearOf(b, PROPS.doorGap, doorBoxes)) continue;
      if (!Object.values(props).every((p) => boxGap(b, p.box) >= PROPS.indoorGap)) continue;
      if (Object.values(walls).some((w) => w.kind === 'partition' && boxGap(b, w.box) < PROPS.indoorGap)) continue;
      const model = nextRandom(rng) < PROPS.plantShare ? 'plant' : 'cooler';
      props[`prop_in_${u.area}_${n++}`] = { model, box: b, rot: rotWorld(u, 0), solid: true, area: u.area };
    }
    const yardD = BLOCK.depth - BLOCK.shopDepth;
    const F = PROPS.flowerMargin;
    for (let f = 0; f < K.yardFlowers; f++) {
      const local: Box = [
        F.left + nextRandom(rng) * (u.w - F.left - F.right),
        BLOCK.shopDepth + F.front + nextRandom(rng) * (yardD - F.front - F.back),
        PROPS.flower,
        PROPS.flower,
      ];
      const b = toWorld(u, local);
      if (clearOf(b, PROPS.flowerClear))
        props[`prop_flower_${u.area}_${f}`] = { model: 'flower', box: b, rot: 0, solid: false, area: u.area };
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
    streetSpots: streetSpots.slice(0, 3).map(sp),
    waitingSpots: AREA_1.waitingSpots.map((p) => sp(ptWorld(a1, p))),
    carSpots: carSpots.map((c) => ({ car: sh(c.car), pickup: sh(c.pickup) })),
    van: sh([road[0] + road[2] - C.vanFromEnd, carSpots[0].car[1], ...C.van]),
    playerStart: sp(ptWorld(a1, AREA_1.playerStart)),
  };

  // the Opening: Area 1 plus a share of the Pad chain, never past Area 1 and never a Stocker
  const share = randomBetween(rng, K.startShare);
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
    id: `daily-${(seed >>> 0).toString(16)}`,
    name: 'Daily Shift',
    layout,
    products,
    producers,
    pads,
    freeStations,
    upgrades: dailyUpgrades(producers),
    start: { owned, money: K.startMoney },
    objectives: [],
    challenges: false,
    shift: true,
    look: K.looks[randomInt(rng, 0, K.looks.length - 1)],
    movePrices: [],
    events: dailyEvents(order[1]),
  };
  return { map, format, interiors: units.map((u) => u.interior) };
}
