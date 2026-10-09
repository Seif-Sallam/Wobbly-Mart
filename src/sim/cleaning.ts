// Messes and mopping: the Player's Mop, the Cleaner, and how a waiting Mess slows everyone.
import type { Cleaner, Mess, Mover, World } from './world';
import { DT } from './world';
import { cleanTime } from './economy';
import { forgetPoint, inOwnedAreas, onGrid, walkAgent } from './walk';
import { nextRandom } from './rng';
import { TUNING } from './tuning';

/** `customer` is who spilled it, or -1 for an Item tipped off the Player's Stack. */
export function addMess(w: World, id: number, x: number, z: number, items: string[], customer: number): void {
  w.messes.push({ id, x, z, items, progress: 0 });
  w.events.push({ type: 'mess', mess: id, customer });
}

export const inMess = (w: World, x: number, z: number): boolean =>
  w.messes.some((m) => Math.hypot(m.x - x, m.z - z) < TUNING.messRadius);

/** Speed factor for the Player and Staff standing in a waiting Mess. */
export const messSlowdown = (w: World, a: { x: number; z: number }): number =>
  inMess(w, a.x, a.z) ? TUNING.messSlowdownStaff : 1;

/** Keeps a walker out of waiting Messes, sliding it around their edge, wherever it can still stand. */
export function skirtMesses(w: World, a: Mover): void {
  for (const m of w.messes) {
    const dx = a.x - m.x;
    const dz = a.z - m.z;
    const d = Math.hypot(dx, dz);
    if (d >= TUNING.messRadius || d < 1e-6) continue;
    const x = m.x + (dx / d) * TUNING.messRadius - (dz / d) * TUNING.messSkirt;
    const z = m.z + (dz / d) * TUNING.messRadius + (dx / d) * TUNING.messSkirt;
    if (!onGrid(w, 'shopper', x, z)) continue;
    a.x = x;
    a.z = z;
  }
}

function nearestMess(w: World, x: number, z: number): Mess | undefined {
  let best: Mess | undefined;
  for (const m of w.messes) if (!best || Math.hypot(m.x - x, m.z - z) < Math.hypot(best.x - x, best.z - z)) best = m;
  return best;
}

/** Mops the nearest Mess in reach for one step; returns whether there was one. */
export function mopAt(w: World, x: number, z: number, seconds: number): boolean {
  const m = nearestMess(w, x, z);
  if (!m || Math.hypot(m.x - x, m.z - z) > TUNING.messClearRadius) return false;
  m.progress = Math.min(1, m.progress + DT / seconds);
  if (m.progress < 1) return true;
  w.messes = w.messes.filter((o) => o !== m);
  forgetPoint(w, [m.x, m.z]);
  w.events.push({ type: 'messCleared', mess: m.id });
  return true;
}

/** A random wander spot on the bought shop floors, snapped to a coarse grid so walk fields stay few. */
function wanderSpot(w: World): [number, number] | null {
  const g = TUNING.cleaner.wanderGrid;
  const spots: [number, number][] = [];
  for (const f of w.map.layout.floors)
    for (let x = f[0] + g / 2; x < f[0] + f[2]; x += g)
      for (let z = f[1] + g / 2; z < f[1] + f[3]; z += g)
        if (inOwnedAreas(w, x, z) && onGrid(w, 'walker', x, z)) spots.push([x, z]);
  return spots.length ? spots[Math.floor(nextRandom(w) * spots.length)] : null;
}

function updateCleaner(w: World, c: Cleaner): void {
  const C = TUNING.cleaner;
  const mess = nearestMess(w, c.x, c.z);
  c.mopping = false;
  if (mess) {
    c.spot = null;
    const there =
      Math.hypot(mess.x - c.x, mess.z - c.z) <= TUNING.messClearRadius ||
      walkAgent(w, 'walker', c, { point: [mess.x, mess.z] }, C.rushSpeed);
    if (there) {
      c.vx = c.vz = 0;
      c.mopping = mopAt(w, c.x, c.z, cleanTime(w) * C.cleanFactor);
    }
    return;
  }
  if (c.show > 0) {
    c.show -= DT;
    c.mopping = true;
    if (c.show <= 0) c.spot = null;
    return;
  }
  c.spot ??= wanderSpot(w);
  if (c.spot && walkAgent(w, 'walker', c, { point: c.spot }, C.wanderSpeed))
    c.show = C.showMop[0] + nextRandom(w) * (C.showMop[1] - C.showMop[0]);
}

export function updateCleaners(w: World): void {
  for (const c of w.cleaners) updateCleaner(w, c);
}
