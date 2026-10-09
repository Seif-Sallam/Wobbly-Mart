// Events: seeded happenings unlocked by purchases. Deliveries: cars park at the Car Spots with an order.
import type { EventKind } from './map';
import type { Delivery, PickupStation, World } from './world';
import { DT } from './world';
import { productsForSale, requirementMet } from './economy';
import { nextRandom, randomInt, shuffle } from './rng';
import { TUNING } from './tuning';

const E = TUNING.events;

/** One pickup tile Station per Car Spot, there from the start (it takes Items only while a car waits). */
export function addPickups(w: World): void {
  w.map.layout.carSpots.forEach((s, i) => {
    const id = `pickup_${i + 1}`;
    w.stations.set(id, { id, kind: 'pickup', box: s.pickup, car: s.car, rot: 0, delivery: null });
  });
}

const unlocked = (w: World, kind: EventKind): boolean =>
  w.map.events[kind]?.requires.every((r) => requirementMet(w, r)) ?? false;

const pickups = (w: World): PickupStation[] =>
  [...w.stations.values()].filter((s): s is PickupStation => s.kind === 'pickup');

const between = (w: World, [lo, hi]: readonly [number, number]): number => lo + nextRandom(w.eventRng) * (hi - lo);

/** Cars that may wait at once: one, plus one per Stocker count reached in carStockers. */
const carCap = (w: World): number => 1 + E.carStockers.filter((n) => w.stockers.length >= n).length;

/** 1–3 Products on sale, the same count of each, the total within the range for the Areas bought. */
function order(w: World): Delivery | null {
  const forSale = productsForSale(w);
  if (!forSale.length) return null;
  const n = randomInt(w.eventRng, 1, Math.min(E.orderProducts, forSale.length));
  const areas = Object.keys(w.map.layout.areas).filter((a) => w.owned.has(a)).length;
  const [lo, hi] = E.deliveryItems[Math.min(Math.max(1, areas), E.deliveryItems.length) - 1];
  const least = Math.max(1, Math.ceil(lo / n));
  const each = randomInt(w.eventRng, least, Math.max(least, Math.floor(hi / n)));
  return {
    order: shuffle(w.eventRng, forSale)
      .slice(0, n)
      .map((product) => ({ product, want: each, got: 0 })),
    t: 0,
    time: E.deliveryTime + E.deliveryPerItem * each * n,
    look: nextRandom(w.eventRng),
    honked: false,
  };
}

/** Full: deliveryPay × Sale Price plus the speed tip; timed out: plain Sale Price for what was delivered. */
function leave(w: World, st: PickupStation, d: Delivery, complete: boolean): void {
  const value = d.order.reduce((sum, l) => sum + l.got * w.map.products[l.product].price, 0);
  const amount = Math.round(complete ? value * E.deliveryPay : value);
  const tip = complete ? Math.round(amount * E.tipMax * Math.max(0, 1 - d.t / (d.time / 2))) : 0;
  w.money += amount + tip;
  w.events.push({ type: 'deliveryDone', station: st.id, amount, tip, complete });
  st.delivery = null;
}

function updateDeliveries(w: World): void {
  const spots = pickups(w);
  for (const st of spots) {
    const d = st.delivery;
    if (!d) continue;
    d.t += DT;
    if (d.order.every((l) => l.got >= l.want)) leave(w, st, d, true);
    else if (d.t >= d.time) leave(w, st, d, false);
    else if (!d.honked && d.time - d.t <= E.honkAt) {
      d.honked = true;
      w.events.push({ type: 'deliveryHonk', station: st.id });
    }
  }
  w.carWait = (w.carWait ?? between(w, E.deliveryGap)) - DT;
  if (w.carWait > 0 || w.t < E.quietStart) return;
  const parked = spots.filter((s) => s.delivery).length;
  const free = spots.find((s) => !s.delivery);
  const cap = Math.min(carCap(w), spots.length);
  w.carWait = between(w, E.deliveryGap);
  if (!free || parked >= cap) return;
  free.delivery = order(w);
  if (!free.delivery) return;
  w.events.push({ type: 'deliveryArrived', station: free.id });
  // now and then another car follows soon, when the Stockers allow one more
  if (parked + 1 < cap && nextRandom(w.eventRng) < E.extraCarChance) w.carWait = between(w, E.extraCarGap);
}

export function updateEvents(w: World): void {
  if (unlocked(w, 'delivery')) updateDeliveries(w);
}

/** The waiting car's line for this Product with room, or undefined. */
export const orderLine = (st: PickupStation, product: string) =>
  st.delivery?.order.find((l) => l.product === product && l.got < l.want);
