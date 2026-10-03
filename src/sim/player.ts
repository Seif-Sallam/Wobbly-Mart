import type { Intents, Station, World } from './world';
import { DT } from './world';
import { cashPilePoint, own, padRemaining, playerSpeed, stackCap, visiblePads } from './economy';
import { transferTick } from './carry';
import { boxCentre, distToBox, pushOutOfBox } from './geometry';
import { inOwnedAreas } from './walk';
import { TUNING } from './tuning';
import { FEEL } from '../feel';

const R = TUNING.playerRadius;

function confined(w: World, x: number, z: number): boolean {
  return (
    inOwnedAreas(w, x, z) &&
    inOwnedAreas(w, x - R, z) &&
    inOwnedAreas(w, x + R, z) &&
    inOwnedAreas(w, x, z - R) &&
    inOwnedAreas(w, x, z + R)
  );
}

function move(w: World, intents: Intents): void {
  const p = w.player;
  const top = playerSpeed(w);
  const fullness = p.stack.length / stackCap(w);
  let mx = intents.move.x;
  let mz = intents.move.z;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  if (w.pan) mx = mz = 0;
  const speed = top * (1 - TUNING.fullStackSlowdown * fullness);
  const dx = mx * speed - p.vx;
  const dz = mz * speed - p.vz;
  const speeding = Math.hypot(mx * speed, mz * speed) >= Math.hypot(p.vx, p.vz);
  const maxDelta = (top / (speeding ? FEEL.accelTime : FEEL.stopTime)) * DT;
  const d = Math.hypot(dx, dz);
  if (d <= maxDelta) {
    p.vx += dx;
    p.vz += dz;
  } else {
    p.vx += (dx / d) * maxDelta;
    p.vz += (dz / d) * maxDelta;
  }
  const ox = p.x;
  const oz = p.z;
  p.x += p.vx * DT;
  if (!confined(w, p.x, p.z)) {
    p.x = ox;
    p.vx = 0;
  }
  p.z += p.vz * DT;
  if (!confined(w, p.x, p.z)) {
    p.z = oz;
    p.vz = 0;
  }
  for (const b of w.nav.solids) pushOutOfBox(p, b, R);
  const others = [...w.customers, ...w.stockers, ...w.cashiers];
  for (const o of others) {
    const ex = p.x - o.x;
    const ez = p.z - o.z;
    const dist = Math.hypot(ex, ez);
    const min = R + TUNING.characterRadius;
    if (dist >= min || dist < 1e-6) continue;
    p.x = o.x + (ex / dist) * min;
    p.z = o.z + (ez / dist) * min;
  }
  if (!confined(w, p.x, p.z) || w.nav.solids.some((b) => distToBox(p.x, p.z, b) < R - TUNING.collisionSlack)) {
    p.x = ox;
    p.z = oz;
  }
}

function payPads(w: World): void {
  const p = w.player;
  for (const id of visiblePads(w)) {
    const [cx, cz] = boxCentre(w.map.layout.places[id].box);
    if (Math.abs(p.x - cx) > TUNING.padHalfSize || Math.abs(p.z - cz) > TUNING.padHalfSize) continue;
    if (w.money <= 0) return;
    const cost = w.map.pads[id].cost;
    const pay = Math.min((cost / TUNING.padDrainTime) * DT, padRemaining(w, id), w.money);
    w.money -= pay;
    w.paid[id] = (w.paid[id] ?? 0) + pay;
    w.events.push({ type: 'padPaying', pad: id });
    if (padRemaining(w, id) <= 1e-6) {
      w.money = Math.round(w.money * 1e6) / 1e6;
      own(w, id, true);
    }
    return;
  }
}

function collectCash(w: World): void {
  const p = w.player;
  for (const st of w.stations.values()) {
    if (st.kind !== 'register' || st.cash <= 0) continue;
    const [x, z] = cashPilePoint(w, st.id);
    if (Math.hypot(p.x - x, p.z - z) > TUNING.cashPileRadius) continue;
    const bills = Math.min(FEEL.cashBillsMax, Math.ceil(st.cash / TUNING.billValue));
    const duration = FEEL.cashDrainMin + ((FEEL.cashDrainMax - FEEL.cashDrainMin) * bills) / FEEL.cashBillsMax;
    w.drains.push({ register: st.id, amount: st.cash, given: 0, t: 0, duration });
    w.events.push({ type: 'cashCollect', register: st.id, amount: st.cash, duration });
    w.tutorial.actions.add(`collect:${st.id}`);
    st.cash = 0;
  }
  for (const d of w.drains) {
    d.t += DT;
    const due = d.amount * Math.min(1, d.t / d.duration) - d.given;
    d.given += due;
    w.money += due;
  }
  w.drains = w.drains.filter((d) => d.t < d.duration);
}

function clearMesses(w: World): void {
  const p = w.player;
  w.messes = w.messes.filter((m) => {
    if (Math.hypot(p.x - m.x, p.z - m.z) > TUNING.messClearRadius) return true;
    w.events.push({ type: 'messCleared', mess: m.id });
    return false;
  });
}

const INTERACTIVE = new Set(['shelf', 'producer', 'trash']);

export function stationAt(w: World, x: number, z: number, test: (st: Station) => boolean): Station | null {
  let best: Station | null = null;
  let bestD = TUNING.reach;
  for (const st of w.stations.values()) {
    if (!test(st)) continue;
    const d = distToBox(x, z, st.box);
    if (d <= bestD) {
      bestD = d;
      best = st;
    }
  }
  return best;
}

export function updatePlayer(w: World, intents: Intents): void {
  const p = w.player;
  move(w, intents);
  payPads(w);
  collectCash(w);
  clearMesses(w);
  const st = stationAt(w, p.x, p.z, (s) => INTERACTIVE.has(s.kind));
  const allowed = !intents.manualGrab || intents.grab;
  const moved = transferTick(
    w,
    p,
    allowed ? st : null,
    { agent: 'player' },
    {
      drop: () => true,
      pick: () => true,
      cap: stackCap(w),
    },
  );
  if (st && moved.picked) w.tutorial.actions.add(`pick:${st.id}`);
  if (st && moved.dropped) w.tutorial.actions.add(`drop:${st.id}`);
  const office = w.stations.get('office');
  w.atOffice = !!office && distToBox(p.x, p.z, office.box) <= TUNING.reach + TUNING.officeReachExtra;
  const exit = w.stations.get('exit');
  w.atExit = !!exit && distToBox(p.x, p.z, exit.box) <= TUNING.exitPickRadius;
}
