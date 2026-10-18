// Challenges: short optional timed tasks, one at a time. A win pays Score and Money; a miss costs nothing.
import type { Challenge, ChallengeKind, PickupStation, ProducerStation, ShelfStation, World } from './world';
import { DT } from './world';
import { productsForSale } from './economy';
import { shelfCap } from './map';
import { nextRandom, randomBetween, weighted } from './rng';
import { TUNING } from './tuning';

const C = TUNING.challenges;
const KINDS = Object.keys(C.kinds) as ChallengeKind[];

/** Areas bought, 1–3: picks the column of the Challenge table. */
const tier = (w: World): number =>
  Math.min(C.bonus.length, Math.max(1, Object.keys(w.map.layout.areas).filter((a) => w.owned.has(a)).length)) - 1;

const pickOne = <T>(w: World, list: T[]): T => list[Math.floor(nextRandom(w.challengeRng) * list.length)];

const shelves = (w: World): ShelfStation[] =>
  [...w.stations.values()].filter((s): s is ShelfStation => s.kind === 'shelf');
const producers = (w: World): ProducerStation[] =>
  [...w.stations.values()].filter((s): s is ProducerStation => s.kind === 'producer');
/** Pickups whose car waits with more than the Challenge's time left. */
const cars = (w: World): PickupStation[] =>
  [...w.stations.values()].filter(
    (s): s is PickupStation =>
      s.kind === 'pickup' && !!s.delivery && s.delivery.time - s.delivery.t > C.kinds.delivery.timeLeft,
  );

/** Whether the kind can be won right now; a Challenge is never offered that can't. */
function possible(w: World, kind: ChallengeKind): boolean {
  switch (kind) {
    case 'checkout':
      return !w.closed && [...w.stations.values()].some((s) => s.kind === 'register');
    case 'noMess':
      return true;
    case 'fillShelf':
      return shelves(w).some((s) => s.items < shelfCap(w.map, s.product));
    case 'make':
      return producers(w).length > 0;
    case 'sell':
      return productsForSale(w).length > 0;
    case 'delivery':
      return cars(w).length > 0;
  }
}

function make(w: World, kind: ChallengeKind): Challenge {
  const i = tier(w);
  const base = { kind, target: null, goal: 0, progress: 0, t: 0, bonus: C.bonus[i] };
  switch (kind) {
    case 'checkout':
      return { ...base, goal: C.kinds.checkout.goal[i], time: C.kinds.checkout.time };
    case 'noMess':
      return { ...base, time: C.kinds.noMess.goal[i] };
    case 'fillShelf': {
      const open = shelves(w).filter((s) => s.items < shelfCap(w.map, s.product));
      return { ...base, target: pickOne(w, open).id, time: C.kinds.fillShelf.time };
    }
    case 'make': {
      const outputs = [...new Set(producers(w).map((s) => w.map.producers[s.type].output))];
      return { ...base, target: pickOne(w, outputs), goal: C.kinds.make.goal[i], time: C.kinds.make.time };
    }
    case 'sell':
      return { ...base, target: pickOne(w, productsForSale(w)), goal: C.kinds.sell.goal[i], time: C.kinds.sell.time };
    case 'delivery': {
      const car = pickOne(w, cars(w));
      const d = car.delivery;
      return { ...base, target: car.id, time: d ? d.time - d.t - C.kinds.delivery.timeLeft : 0 };
    }
  }
}

function offer(w: World): Challenge | null {
  const open = KINDS.filter((k) => possible(w, k));
  if (!open.length) return null;
  return make(
    w,
    open[
      weighted(
        w.challengeRng,
        open.map((k) => C.kinds[k].weight),
      )
    ],
  );
}

const finish = (w: World, c: Challenge, won: boolean): void => {
  w.challenge = null;
  w.challengeWait = randomBetween(w.challengeRng, C.gap);
  if (!won) {
    w.events.push({ type: 'challengeFailed', kind: c.kind });
    return;
  }
  w.money += c.bonus;
  w.events.push({ type: 'challengeWon', kind: c.kind, score: TUNING.score.challenge, money: c.bonus });
};

/** Advances the running Challenge from this step's events, or offers a new one when it is time. */
function run(w: World, c: Challenge): void {
  for (const e of w.events) {
    switch (c.kind) {
      case 'checkout':
        if (e.type === 'paid') c.progress++;
        break;
      case 'sell':
        if (e.type === 'paid') c.progress += e.products.filter((p) => p === c.target).length;
        break;
      case 'make': {
        const st = e.type === 'produced' ? w.stations.get(e.station) : null;
        if (st?.kind === 'producer' && w.map.producers[st.type].output === c.target) c.progress++;
        break;
      }
      case 'noMess':
        if (e.type === 'mess') return finish(w, c, false);
        break;
      case 'delivery':
        if (e.type === 'deliveryDone' && e.station === c.target)
          return finish(w, c, e.complete && e.left >= C.kinds.delivery.timeLeft);
        break;
    }
  }
  if (c.kind === 'fillShelf') {
    const shelf = w.stations.get(c.target ?? '');
    if (shelf?.kind === 'shelf' && shelf.items >= shelfCap(w.map, shelf.product)) return finish(w, c, true);
  }
  if (c.goal && c.progress >= c.goal) return finish(w, c, true);
  if (w.closed) return;
  c.t += DT;
  if (c.t >= c.time) finish(w, c, c.kind === 'noMess');
}

export function updateChallenges(w: World): void {
  if (w.challenge) return run(w, w.challenge);
  if (w.map.challenges === false || w.closed || w.t < TUNING.events.quietStart) return;
  w.challengeWait ??= randomBetween(w.challengeRng, C.gap);
  if ((w.challengeWait -= DT) > 0) return;
  w.challenge = offer(w);
  if (!w.challenge) {
    w.challengeWait = randomBetween(w.challengeRng, C.gap);
    return;
  }
  w.events.push({ type: 'challengeStarted', kind: w.challenge.kind });
}
