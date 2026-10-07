import type { Point } from './map';
import type { Customer, RegisterStation, ShelfStation, World } from './world';
import { DT } from './world';
import { checkoutTime, customerCap, productsForSale } from './economy';
import { distToBox, footprint, frontPoint } from './geometry';
import { nextRandom, shuffle, weighted } from './rng';
import { walkAgent } from './walk';
import { TUNING } from './tuning';

const registers = (w: World): RegisterStation[] =>
  [...w.stations.values()].filter((s): s is RegisterStation => s.kind === 'register');

const shelfFor = (w: World, product: string): ShelfStation | undefined =>
  [...w.stations.values()].find((s): s is ShelfStation => s.kind === 'shelf' && s.product === product);

export const queueSpot = (reg: RegisterStation, i: number): Point =>
  frontPoint(reg.box, reg.rot, TUNING.queueFirstOffset + i * TUNING.queueGap);

function shelfSpot(w: World, shelf: ShelfStation): Point {
  const [long] = footprint(shelf.box, shelf.rot);
  const n = Math.max(1, Math.floor(long / TUNING.shelfSpotGap));
  const spots = Array.from({ length: n }, (_, i) =>
    frontPoint(shelf.box, shelf.rot, TUNING.shelfSpotOffset, (i - (n - 1) / 2) * TUNING.shelfSpotGap),
  );
  const used = (p: Point) => w.customers.filter((c) => c.spot[0] === p[0] && c.spot[1] === p[1]).length;
  return spots.reduce((best, p) => (used(p) < used(best) ? p : best));
}

function spawn(w: World): void {
  const forSale = productsForSale(w);
  const n = weighted(w, TUNING.listProducts.slice(0, forSale.length)) + 1;
  const want = weighted(w, TUNING.listUnits[n - 1]) + 1;
  const list = shuffle(w, forSale)
    .slice(0, n)
    .map((product) => ({
      product,
      shelf: shelfFor(w, product)?.id ?? '',
      want,
      got: 0,
    }));
  const spots = w.map.layout.streetSpots;
  const home = spots[Math.floor(nextRandom(w) * spots.length)];
  const c: Customer = {
    id: w.nextId++,
    x: home[0],
    z: home[1],
    vx: 0,
    vz: 0,
    state: 'shop',
    list,
    li: 0,
    cart: [],
    spot: home,
    home,
    register: null,
    waiting: false,
    takeTimer: 0,
    patience: 0,
    patienceLimit:
      nextRandom(w) < TUNING.neverGiveUp
        ? Infinity
        : TUNING.patienceAngry[0] + nextRandom(w) * (TUNING.patienceAngry[1] - TUNING.patienceAngry[0]),
    angry: false,
    happy: false,
    look: nextRandom(w),
  };
  const shelf = w.stations.get(list[0].shelf);
  if (shelf?.kind === 'shelf') c.spot = shelfSpot(w, shelf);
  w.customers.push(c);
}

function speedOf(w: World, c: Customer): number {
  const slowed = w.messes.some((m) => Math.hypot(m.x - c.x, m.z - c.z) < TUNING.messRadius);
  return TUNING.customerSpeed * (slowed ? TUNING.messSlowdown : 1);
}

function leave(c: Customer): void {
  c.state = 'leave';
  c.spot = c.home;
}

function shop(w: World, c: Customer): void {
  const entry = c.list[c.li];
  const shelf = w.stations.get(entry.shelf);
  if (shelf?.kind !== 'shelf') return leave(c);
  if (!walkAgent(w, 'shopper', c, { point: c.spot }, speedOf(w, c))) return;
  c.takeTimer += DT;
  if (shelf.items > 0) {
    if (c.takeTimer < TUNING.customerTakeTime) return;
    c.takeTimer = 0;
    shelf.items--;
    c.cart.push(entry.product);
    entry.got++;
    w.events.push({ type: 'transfer', product: entry.product, from: { station: shelf.id }, to: { customer: c.id } });
    c.patience = 0;
    c.angry = false;
    if (entry.got < entry.want) return;
    c.li++;
    if (c.li >= c.list.length) {
      c.state = 'queue';
      return;
    }
    const next = w.stations.get(c.list[c.li].shelf);
    if (next?.kind === 'shelf') c.spot = shelfSpot(w, next);
    return;
  }
  if (!w.tutorial.done) return;
  c.patience += DT;
  if (c.patience >= c.patienceLimit && !c.angry) {
    c.angry = true;
    w.events.push({ type: 'angry', customer: c.id });
  }
  if (c.patience < c.patienceLimit + TUNING.patienceLeave) return;
  if (c.cart.length) {
    const id = w.nextId++;
    w.messes.push({ id, x: c.x, z: c.z, items: c.cart });
    w.events.push({ type: 'mess', mess: id, customer: c.id });
    c.cart = [];
  }
  leave(c);
}

function joinQueue(w: World, c: Customer): void {
  const open = registers(w).filter((r) => r.queue.length < r.queueLength);
  if (!open.length) {
    c.waiting = true;
    return;
  }
  const reg = open.reduce((a, b) => (b.queue.length < a.queue.length ? b : a));
  reg.queue.push(c.id);
  c.register = reg.id;
  c.waiting = false;
}

function queue(w: World, c: Customer): void {
  if (!c.register && !c.waiting) joinQueue(w, c);
  if (c.register) {
    const reg = w.stations.get(c.register) as RegisterStation;
    c.spot = queueSpot(reg, reg.queue.indexOf(c.id));
  } else {
    const spots = w.map.layout.waitingSpots;
    const i = w.customers.filter((o) => o.waiting && o.id < c.id).length;
    c.spot = spots[Math.min(i, spots.length - 1)];
  }
  walkAgent(w, 'shopper', c, { point: c.spot }, speedOf(w, c));
}

function checkout(w: World, reg: RegisterStation): void {
  const front = w.customers.find((c) => c.id === reg.queue[0]);
  if (!front) return;
  const [sx, sz] = queueSpot(reg, 0);
  if (Math.hypot(front.x - sx, front.z - sz) > TUNING.queueFrontTolerance) return;
  const playerNear = distToBox(w.player.x, w.player.z, reg.box) <= TUNING.reach + TUNING.registerReachExtra;
  const cashier = w.cashiers.some((c) => c.register === reg.id);
  const time = Math.min(playerNear ? TUNING.playerCheckoutTime : Infinity, cashier ? checkoutTime(w) : Infinity);
  if (time === Infinity) return;
  reg.progress += DT / time;
  if (reg.progress < 1) return;
  reg.progress = 0;
  const amount = front.cart.reduce((sum, p) => sum + w.map.products[p].price, 0);
  reg.cash += amount;
  reg.queue.shift();
  front.cart = [];
  front.happy = true;
  front.register = null;
  leave(front);
  w.events.push({ type: 'paid', register: reg.id, customer: front.id, amount });
  w.tutorial.actions.add(`checkout:${reg.id}`);
}

export function updateCustomers(w: World): void {
  w.arrivalTimer -= DT;
  const stocked = [...w.stations.values()].some((s) => s.kind === 'shelf' && s.items > 0);
  if (stocked && w.arrivalTimer <= 0 && w.customers.length < customerCap(w)) {
    spawn(w);
    w.arrivalTimer = TUNING.arrivalInterval;
  }
  for (const c of w.customers) {
    if (c.state === 'shop') shop(w, c);
    else if (c.state === 'queue') queue(w, c);
    else if (walkAgent(w, 'shopper', c, { point: c.home }, speedOf(w, c))) c.state = 'gone';
  }
  for (const c of w.customers.filter((o) => o.waiting)) joinQueue(w, c);
  for (const reg of registers(w)) checkout(w, reg);
  w.customers = w.customers.filter((c) => {
    const gone = c.state === 'gone';
    if (gone) w.events.push({ type: 'customerLeft', customer: c.id });
    return !gone;
  });
}
