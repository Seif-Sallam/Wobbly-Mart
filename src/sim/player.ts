import type { Intents, Station, World } from './world';
import { DT } from './world';
import { cashPilePoint, own, padRemaining, playerSpeed, safeCount, stackCap, visiblePads } from './economy';
import { transferTick } from './carry';
import { boxCentre, distToBox, pushOutOfBox } from './geometry';
import { inOwnedAreas } from './walk';
import { TUNING } from './tuning';
import { nextRandom } from './rng';
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
  p.sprinting = !!intents.sprint && Math.hypot(intents.move.x, intents.move.z) > 0 && !w.pan;
  const top = playerSpeed(w) * (p.sprinting ? TUNING.sprint.speed : 1);
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
  // PROTOTYPE: how hard the Player is turning or stopping, 0 (steady) to 2 (full reverse), as a share of top speed.
  p.jolt = Math.hypot(p.vx, p.vz) > 0.5 ? d / top : 0;
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
  if (!confined(w, p.x, p.z) || w.nav.solids.some((b) => distToBox(p.x, p.z, b) < R - TUNING.collisionSlack)) {
    p.x = ox;
    p.z = oz;
  }
}

function sprintDrops(w: World): void {
  const p = w.player;
  const S = TUNING.sprint;
  const T = TUNING.tip;
  p.dropCooldown = Math.max(0, p.dropCooldown - DT);
  const safe = safeCount(w);
  const n = p.stack.length;
  const moving = Math.hypot(p.vx, p.vz) > 0.5;
  const share = p.sprinting ? 1 : moving ? T.walkShare : 0;
  if (share === 0 || n <= safe || p.dropCooldown > 0) return;
  const k = (n - safe) / Math.max(1, stackCap(w) - safe);
  const jolt = 1 + T.joltBoost * Math.min(1, p.jolt ?? 0);
  if (nextRandom(w) >= S.maxRate * share * jolt * k ** S.curve * DT) return;
  const v = Math.hypot(p.vx, p.vz) || 1;
  const side = (nextRandom(w) - 0.5) * S.dropSide;
  const x = p.x - (p.vx / v) * S.dropBehind - (p.vz / v) * side;
  const z = p.z - (p.vz / v) * S.dropBehind + (p.vx / v) * side;
  const product = p.stack[n - 1];
  p.stack.pop();
  p.dropCooldown = S.cooldown;
  const breakChance = T.breakChance[product] ?? 0;
  if (breakChance > 0 && nextRandom(w) < breakChance) {
    const id = w.nextId++;
    w.messes.push({ id, x, z, items: [product] });
    w.events.push({ type: 'mess', mess: id, customer: -1 });
    return;
  }
  const item = { id: w.nextId++, x, z, product };
  w.events.push({ type: 'transfer', product, from: { agent: 'player' }, to: { loose: item.id } });
  w.loose.push(item);
}

function takeLoose(w: World): void {
  const p = w.player;
  w.loose = w.loose.filter((it) => {
    if (p.stack.length >= stackCap(w) || Math.hypot(p.x - it.x, p.z - it.z) > TUNING.looseTakeRadius) return true;
    p.stack.push(it.product);
    w.events.push({ type: 'transfer', product: it.product, from: { loose: it.id }, to: { agent: 'player' } });
    return false;
  });
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
  sprintDrops(w);
  takeLoose(w);
  payPads(w);
  collectCash(w);
  clearMesses(w);
  const near = stationAt(w, p.x, p.z, (s) => INTERACTIVE.has(s.kind));
  p.trashHold = near?.kind === 'trash' ? p.trashHold + DT : 0;
  const st = near?.kind === 'trash' && p.trashHold < TUNING.trashHoldTime ? null : near;
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
