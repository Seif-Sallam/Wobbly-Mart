// Edit Layout rules: which fixtures move, where they may go, and what Moves cost. The paused World changes in place.
import type { Box, Placement, Rot } from './map';
import type { Station, World } from './world';
import { boxCentre, boxGap, boxesOverlap, footprint, frontDir, frontPoint, inBox } from './geometry';
import { inOwnedAreas, rebuildNav, walkable, walkDistance } from './walk';
import { queueSpot, rehomeCustomers } from './customers';
import { TUNING } from './tuning';

const MOVABLE = new Set<Station['kind']>(['shelf', 'register', 'producer']);
export const movable = (st: Station): boolean => MOVABLE.has(st.kind);

/** A fixture's name in reasons and the Edit Layout panel. */
export const fixtureName = (id: string): string => id.replace(/_/g, ' ');

/** The same box turned 90° about its centre. */
export function turned(b: Box): Box {
  const [cx, cz] = boxCentre(b);
  return [cx - b[3] / 2, cz - b[2] / 2, b[3], b[2]];
}

export const nextRot = (rot: Rot): Rot => ((rot + 90) % 360) as Rot;

/** The Cashier Pad that works this Register, if any. */
export function cashierOf(w: World, register: string): string | undefined {
  return Object.keys(w.map.pads).find((id) => {
    const u = w.map.pads[id].unlocks;
    return u.kind === 'cashier' && u.register === register;
  });
}

/** Where a Register's Cashier spot goes when the Register moves `from` → `to`: same offset in its own frame. */
export function cashierBox(w: World, register: string, from: Placement, to: Placement): Box | null {
  const cid = cashierOf(w, register);
  const place = cid ? w.map.layout.places[cid] : undefined;
  if (!place) return null;
  const cb = place.box;
  const [rx, rz] = boxCentre(from.box);
  const [cx, cz] = boxCentre(cb);
  const [fx, fz] = frontDir(from.rot);
  const out = (cx - rx) * fx + (cz - rz) * fz - footprint(from.box, from.rot)[1] / 2;
  const side = -(cx - rx) * fz + (cz - rz) * fx;
  const [nx, nz] = frontPoint(to.box, to.rot, out, side);
  return [nx - cb[2] / 2, nz - cb[3] / 2, cb[2], cb[3]];
}

const isShop = (w: World, x: number, z: number): boolean => w.map.layout.floors.some((f) => inBox(x, z, f));

const corners = (b: Box): [number, number][] => {
  const e = 0.01;
  return [
    [b[0] + e, b[1] + e],
    [b[0] + b[2] - e, b[1] + e],
    [b[0] + e, b[1] + b[3] - e],
    [b[0] + b[2] - e, b[1] + b[3] - e],
  ];
};

/** Why a Station can't stand at `spot` (its current place is where it starts from), or null. */
export function spotProblem(w: World, id: string, spot: Placement): string | null {
  const st = w.stations.get(id);
  if (!st) return 'Not bought';
  const L = w.map.layout;
  const b = spot.box;
  if (!corners(b).every(([x, z]) => inOwnedAreas(w, x, z))) return 'Outside the bought Areas';
  const shop = isShop(w, ...boxCentre(st.box));
  if (!corners(b).every(([x, z]) => isShop(w, x, z) === shop))
    return shop ? 'Shop fixtures stay in the shop' : 'Farm fixtures stay in the yard';
  const cid = cashierOf(w, id);
  const cb = cashierBox(w, id, st, spot);
  const mine = cb ? [b, cb] : [b];
  for (const wall of Object.values(L.walls)) if (mine.some((m) => boxesOverlap(m, wall.box))) return 'Hits a wall';
  const k = TUNING.doorKeepClear;
  for (const door of Object.values(L.doors)) {
    const zone: Box = [door.box[0] - k, door.box[1] - k, door.box[2] + 2 * k, door.box[3] + 2 * k];
    if (mine.some((m) => boxesOverlap(m, zone))) return 'Blocks a door';
  }
  for (const [pid, p] of Object.entries(L.props))
    if (p.solid && !p.party && (!p.area || w.owned.has(p.area)) && mine.some((m) => boxesOverlap(m, p.box)))
      return `Hits the ${fixtureName(pid.replace(/^prop_/, ''))}`;
  // every other Station and Pad footprint, bought or not
  for (const other of [...Object.keys(w.map.pads), ...Object.keys(w.map.freeStations)]) {
    if (other === id || other === cid) continue;
    const ob = w.stations.get(other)?.box ?? L.places[other]?.box;
    if (!ob) continue;
    for (const m of mine) {
      if (boxesOverlap(m, ob)) return `Overlaps the ${fixtureName(other)}`;
      const gap = boxGap(m, ob);
      if (gap < TUNING.clearance - 1e-6)
        return `Too close to the ${fixtureName(other)}: ${gap.toFixed(1)} m, needs ${TUNING.clearance} m`;
    }
  }
  // Register queues stay clear, and a moved Register's own queue must fit
  const r = TUNING.characterRadius;
  for (const reg of w.stations.values()) {
    if (reg.kind !== 'register') continue;
    const at = reg.id === id ? { ...reg, ...spot } : reg;
    for (let i = 0; i < reg.queueLength; i++) {
      const [x, z] = queueSpot(at, i);
      const q: Box = [x - r, z - r, 2 * r, 2 * r];
      if (reg.id !== id) {
        if (boxesOverlap(b, q)) return `Blocks the queue at the ${fixtureName(reg.id)}`;
        continue;
      }
      for (const o of w.stations.values())
        if (o.id !== id && boxesOverlap(q, o.box)) return `Its queue would run into the ${fixtureName(o.id)}`;
      for (const wall of Object.values(L.walls)) if (boxesOverlap(q, wall.box)) return 'Its queue would hit a wall';
    }
  }
  return null;
}

/** Puts a Station at a spot, with its Cashier spot (and Cashier) if it is a Register. */
export function place(w: World, id: string, spot: Placement): void {
  const st = w.stations.get(id);
  if (!st) return;
  const cid = cashierOf(w, id);
  const cb = cashierBox(w, id, st, spot);
  st.box = spot.box;
  st.rot = spot.rot;
  w.map.layout.places[id] = { box: spot.box, rot: spot.rot };
  w.placed[id] = w.map.layout.places[id];
  if (!cid || !cb) return;
  w.map.layout.places[cid] = { ...w.map.layout.places[cid], box: cb };
  w.placed[cid] = w.map.layout.places[cid];
  const cashier = w.cashiers.find((c) => c.id === cid);
  if (cashier) [cashier.x, cashier.z] = boxCentre(cb);
}

/** After a drop: every Station reachable on foot, and Shelves and Registers by Customers from the Street. */
export function cutOff(w: World): string | null {
  rebuildNav(w);
  const street = w.map.layout.streetSpots[0];
  const from = { x: street[0], z: street[1] };
  // from the walk-grid cell nearest the Player (they can stand a little closer to things than the grid allows)
  const [px, pz] = walkable(w, w.player.x, w.player.z);
  const player = { x: px, z: pz };
  for (const st of w.stations.values()) {
    if (st.kind === 'trash' || st.kind === 'exit') continue;
    if (!Number.isFinite(walkDistance(w, 'walker', player, { station: st.id })))
      return `Cuts off the ${fixtureName(st.id)}`;
    if (
      (st.kind === 'shelf' || st.kind === 'register') &&
      !Number.isFinite(walkDistance(w, 'shopper', from, { station: st.id }))
    )
      return `Customers can't reach the ${fixtureName(st.id)}`;
  }
  return null;
}

export function movesLeft(w: World): number {
  const areas = Object.keys(w.map.layout.areas).filter((a) => w.owned.has(a)).length;
  return TUNING.movesPerArea * areas - w.movesUsed;
}

/** Prices of the next `n` Moves, their total, and the one after them. */
export function moveBill(w: World, n: number): { prices: number[]; total: number; next: number | null } {
  const prices = w.map.movePrices.slice(w.movesUsed, w.movesUsed + n);
  return { prices, total: prices.reduce((a, b) => a + b, 0), next: w.map.movePrices[w.movesUsed + n] ?? null };
}

export const canPayMoves = (w: World, n: number): boolean => n <= movesLeft(w) && moveBill(w, n).total <= w.money;

/** Done: charges `n` Moves and sends everyone on new routes. */
export function payMoves(w: World, n: number): void {
  w.money -= moveBill(w, n).total;
  w.movesUsed += n;
  finishLayout(w);
}

/** After the layout changed (or was put back): new walk grids and routes. */
export function finishLayout(w: World): void {
  rebuildNav(w);
  rehomeCustomers(w);
  for (const s of w.stockers) s.job = null;
}
