// Robbery: a Thief steals from the fullest Shelf or a rich Cash Pile and runs for a door; only the Player catches them.
import type { Point } from './map';
import type { RegisterStation, ShelfStation, Thief, World } from './world';
import { DT } from './world';
import { cashPilePoint } from './economy';
import { frontPoint } from './geometry';
import { inMess } from './cleaning';
import { areaOwned, walkable, walkAgent, walkDistance } from './walk';
import { nextRandom } from './rng';
import { byArea, thiefFreeze } from './events';
import { FEEL } from '../feel';
import { TUNING } from './tuning';

const R = TUNING.events.robbery;

const cashOver = (w: World): number => (w.map.events.robbery ? byArea(w, w.map.events.robbery.byArea).cashOver : 0);

function loot(w: World, id: string): number {
  const st = w.stations.get(id);
  if (st?.kind === 'register') return st.cash > cashOver(w) ? st.cash : 0;
  return st?.kind === 'shelf' ? st.items : 0;
}

/** A Register whose Cash Pile is over the threshold, else the fullest Shelf, else null (an empty store). */
function pickTarget(w: World): string | null {
  const regs = [...w.stations.values()].filter((s): s is RegisterStation => s.kind === 'register');
  const reg = regs.filter((r) => loot(w, r.id) > 0).sort((a, b) => b.cash - a.cash)[0];
  if (reg) return reg.id;
  const shelves = [...w.stations.values()].filter((s): s is ShelfStation => s.kind === 'shelf' && s.items > 0);
  return shelves.sort((a, b) => b.items - a.items)[0]?.id ?? null;
}

function standPoint(w: World, id: string): Point {
  const st = w.stations.get(id);
  if (!st) return [0, 0];
  return st.kind === 'register' ? cashPilePoint(w, id) : frontPoint(st.box, st.rot, TUNING.shelfSpotOffset);
}

/** The customer door the Thief reaches first. */
function nearestDoor(w: World, th: Thief): Point {
  let best: { at: Point; d: number } | null = null;
  for (const door of Object.values(w.map.layout.doors)) {
    if (door.kind !== 'customer' || !areaOwned(w, door.box)) continue;
    const at: Point = [door.box[0] + door.box[2] / 2, door.box[1] + door.box[3] / 2];
    const d = walkDistance(w, 'shopper', th, { point: at });
    if (!best || d < best.d) best = { at, d };
  }
  return best?.at ?? th.home;
}

export function startRobbery(w: World): boolean {
  const target = pickTarget(w);
  if (!target) return false;
  const spots = w.map.layout.streetSpots;
  const home = spots[Math.floor(nextRandom(w.eventRng) * spots.length)];
  w.thief = {
    x: home[0],
    z: home[1],
    vx: 0,
    vz: 0,
    state: 'enter',
    target,
    carry: [],
    cash: 0,
    t: 0,
    door: home,
    home,
    look: nextRandom(w.eventRng),
    caught: false,
  };
  return true;
}

const speed = (w: World, th: Thief, base: number): number => base * (inMess(w, th.x, th.z) ? TUNING.messSlowdown : 1);

/** The grab starts: the Thief Pan, and half the Cash Pile in one go. */
function grab(w: World, th: Thief): void {
  th.state = 'grab';
  th.t = 0;
  w.thiefPan = { t: 0, duration: thiefFreeze() + FEEL.thiefPanGlide };
  w.events.push({ type: 'thiefGrab' });
  const st = w.stations.get(th.target);
  if (st?.kind !== 'register') return;
  th.cash = Math.round(st.cash / 2);
  st.cash -= th.cash;
}

/** Items back onto their Shelf (the rest Loose beside it when it filled up meanwhile), cash back on its Pile. */
function caught(w: World, th: Thief): void {
  const st = w.stations.get(th.target);
  for (const product of th.carry) {
    if (st?.kind === 'shelf' && st.items < TUNING.shelfCap) {
      st.items++;
      w.events.push({ type: 'transfer', product, from: { agent: 'thief' }, to: { station: st.id } });
      continue;
    }
    const [x, z] = walkable(w, ...standPoint(w, th.target));
    const id = w.nextId++;
    w.loose.push({ id, x, z, product });
    w.events.push({ type: 'transfer', product, from: { agent: 'thief' }, to: { loose: id } });
  }
  if (st?.kind === 'register') st.cash += th.cash;
  const bounty = w.map.events.robbery ? byArea(w, w.map.events.robbery.byArea).bounty : 0;
  w.money += bounty;
  w.events.push({ type: 'robberyDone', caught: true, amount: bounty, cash: th.cash });
  Object.assign(th, { carry: [], cash: 0, caught: true, state: 'leave' });
}

function escaped(w: World, th: Thief): void {
  const value = th.carry.reduce((sum, p) => sum + w.map.products[p].price, 0) + th.cash;
  w.events.push({ type: 'robberyDone', caught: false, amount: value, cash: th.cash });
  th.state = 'leave';
}

export function updateThief(w: World, th: Thief): void {
  const near = Math.hypot(w.player.x - th.x, w.player.z - th.z) <= R.catchRadius;
  switch (th.state) {
    case 'enter': {
      if (!walkAgent(w, 'shopper', th, { point: standPoint(w, th.target) }, speed(w, th, TUNING.customerSpeed))) return;
      if (loot(w, th.target) > 0) return grab(w, th);
      const next = pickTarget(w);
      if (next) th.target = next;
      else th.state = 'leave';
      return;
    }
    case 'grab': {
      if (near) return caught(w, th);
      th.t += DT;
      const st = w.stations.get(th.target);
      const due = Math.min(R.items, Math.ceil((th.t / R.grabTime) * R.items));
      while (st?.kind === 'shelf' && st.items > 0 && th.carry.length < due) {
        st.items--;
        th.carry.push(st.product);
        w.events.push({ type: 'transfer', product: st.product, from: { station: st.id }, to: { agent: 'thief' } });
      }
      if (th.t < R.grabTime) return;
      th.state = 'run';
      th.door = nearestDoor(w, th);
      return;
    }
    case 'run':
      if (near) return caught(w, th);
      if (walkAgent(w, 'shopper', th, { point: th.door }, speed(w, th, R.speed))) escaped(w, th);
      return;
    case 'leave':
      if (walkAgent(w, 'shopper', th, { point: th.home }, speed(w, th, TUNING.customerSpeed))) w.thief = null;
  }
}
