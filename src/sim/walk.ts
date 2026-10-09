// Who may walk where, and agents (Customers, Staff, the bot) following distance fields.
import type { Box, Point } from './map';
import type { Mover, World } from './world';
import { DT } from './world';
import { boxCentre, distToBox, inBox } from './geometry';
import {
  cellCentre,
  cellOf,
  fieldDistance,
  makeField,
  makeGrid,
  nearestFreeCell,
  seedCells,
  waypoint,
  type Grid,
} from './nav';
import { TUNING } from './tuning';

export type Target = { station: string } | { point: Point };
export type Walkers = 'walker' | 'shopper';

export function areaOf(w: World, box: Box): string | null {
  const [x, z] = boxCentre(box);
  for (const [id, rects] of Object.entries(w.map.layout.areas)) if (rects.some((r) => inBox(x, z, r))) return id;
  return null;
}

export const areaOwned = (w: World, box: Box): boolean => {
  const a = areaOf(w, box);
  return a === null || w.owned.has(a);
};

export function inOwnedAreas(w: World, x: number, z: number): boolean {
  for (const [id, rects] of Object.entries(w.map.layout.areas)) {
    if (w.owned.has(id) && rects.some((r) => inBox(x, z, r))) return true;
  }
  return false;
}

function solids(w: World): Box[] {
  const L = w.map.layout;
  const out: Box[] = Object.values(L.walls).map((wall) => wall.box);
  for (const door of Object.values(L.doors)) if (!areaOwned(w, door.box)) out.push(door.box);
  for (const s of w.stations.values()) out.push(s.box);
  for (const p of Object.values(L.props)) if (p.solid && !p.party && (!p.area || w.owned.has(p.area))) out.push(p.box);
  return out;
}

export function rebuildNav(w: World): void {
  const L = w.map.layout;
  const all = solids(w);
  const clear = (x: number, z: number, r: number) => all.every((b) => distToBox(x, z, b) >= r);
  const [W, H] = L.size;
  const walker = makeGrid(W, H, TUNING.navCell, (x, z) => inOwnedAreas(w, x, z) && clear(x, z, TUNING.playerRadius));
  const shopper = makeGrid(W, H, TUNING.navCell, (x, z) => {
    const onStreet = L.street.some((b) => inBox(x, z, b));
    const onFloor = L.floors.some((b) => inBox(x, z, b)) && inOwnedAreas(w, x, z);
    return (onStreet || onFloor) && clear(x, z, TUNING.characterRadius);
  });
  w.nav = { walker, shopper, fields: new Map(), solids: all };
  w.navDirty = false;
}

function stationBox(w: World, id: string): Box {
  return w.stations.get(id)?.box ?? w.map.layout.places[id].box;
}

const pointKey = (who: Walkers, [x, z]: Point): string => `${who}:p:${x},${z}`;

/** Drops a one-off point's walk fields (a cleaned Mess) so they don't pile up. */
export function forgetPoint(w: World, point: Point): void {
  for (const who of ['walker', 'shopper'] as const) w.nav.fields.delete(pointKey(who, point));
}

export function fieldFor(w: World, who: Walkers, target: Target): Float32Array {
  const key = 'station' in target ? `${who}:s:${target.station}` : pointKey(who, target.point);
  let f = w.nav.fields.get(key);
  if (f) return f;
  const g = w.nav[who];
  if ('station' in target) {
    const b = stationBox(w, target.station);
    f = makeField(
      g,
      seedCells(g, (x, z) => distToBox(x, z, b) < TUNING.reach + g.cell * TUNING.seedReachCells, boxCentre(b)),
    );
  } else {
    const [px, pz] = target.point;
    f = makeField(
      g,
      seedCells(g, (x, z) => Math.hypot(x - px, z - pz) < g.cell * TUNING.seedPointCells, target.point),
    );
  }
  w.nav.fields.set(key, f);
  return f;
}

export function arrived(w: World, a: { x: number; z: number }, target: Target): boolean {
  if ('station' in target)
    return distToBox(a.x, a.z, stationBox(w, target.station)) <= TUNING.reach * TUNING.arriveReachShare;
  return Math.hypot(a.x - target.point[0], a.z - target.point[1]) < TUNING.arrivePoint;
}

/** Where to head next for `target`, or null when already there. */
export function headingFor(w: World, who: Walkers, a: { x: number; z: number }, target: Target): Point | null {
  if (arrived(w, a, target)) return null;
  const g: Grid = w.nav[who];
  const wp = waypoint(g, fieldFor(w, who, target), a.x, a.z);
  if (wp) return wp;
  if ('point' in target) return target.point;
  const b = stationBox(w, target.station);
  return [Math.min(Math.max(a.x, b[0]), b[0] + b[2]), Math.min(Math.max(a.z, b[1]), b[1] + b[3])];
}

/** Moves an agent toward its target at `speed`; returns true once arrived. */
export function walkAgent(w: World, who: Walkers, a: Mover, target: Target, speed: number, dt = DT): boolean {
  const to = headingFor(w, who, a, target);
  if (!to) {
    a.vx = a.vz = 0;
    return true;
  }
  const dx = to[0] - a.x;
  const dz = to[1] - a.z;
  const d = Math.hypot(dx, dz);
  const stepLen = Math.min(d, speed * dt);
  a.vx = (dx / d) * speed;
  a.vz = (dz / d) * speed;
  a.x += (dx / d) * stepLen;
  a.z += (dz / d) * stepLen;
  return arrived(w, a, target);
}

export const walkDistance = (w: World, who: Walkers, a: { x: number; z: number }, target: Target): number =>
  fieldDistance(w.nav[who], fieldFor(w, who, target), a.x, a.z);

/** (x, z) if a walker can stand there, else the nearest cell centre where one can. */
export function walkable(w: World, x: number, z: number): Point {
  if (onGrid(w, 'walker', x, z)) return [x, z];
  const c = nearestFreeCell(w.nav.walker, x, z);
  return c < 0 ? [x, z] : cellCentre(w.nav.walker, c);
}

export const onGrid = (w: World, who: Walkers, x: number, z: number): boolean => {
  const c = cellOf(w.nav[who], x, z);
  return c >= 0 && w.nav[who].free[c] === 1;
};
