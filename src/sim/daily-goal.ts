// A Daily Shift's goal, sized to ~10 minutes: the bot plays the day with no goal for `targetMinutes × botPace`,
// and each goal part is what it had reached by then. A second run with the goal set gives the bot's time and the
// Daily floor. Runs in scripts/daily-calendar.ts (the Worker can't run the bot), never in the game.
import type { MapDef } from './map';
import type { ObjectiveDef } from '../../catalog/objectives';
import { nextRandom, shuffle } from './rng';
import { createWorld, step } from './world';
import { Bot } from './bot';
import { objectiveProgress } from './objectives';
import { TUNING } from './tuning';
import { PRODUCTS } from '../../catalog/products';
import { CASHIER_CHECKOUT, dailyEvents } from '../../maps/daily/economy';
import { fixedMaxScore, maxScoreRate } from './score';

export interface DailyGoal {
  goal: ObjectiveDef[];
  /** Ticks the bot took to finish the goal; null when it didn't within `capMinutes`. */
  botTicks: number | null;
  /** Fewest plausible ticks to the goal: a faster Shift submit is refused. */
  floorTicks: number;
}

/** maps/daily-calendar.json, by `YYYY-MM-DD`. */
export interface DailyCalendar {
  simVersion: number;
  days: Record<string, DailyDay | undefined>;
}
export interface DailyDay {
  /** Fingerprint of the generated Map: a generator change shows up as a mismatch. */
  map: number;
  goal: ObjectiveDef[];
  floorTicks: number;
}

const K = TUNING.dailyMap;
type Part = ObjectiveDef['kind'];

/** Rounded down to a number a player reads at a glance. */
const nice = (n: number) => {
  const step = n < 50 ? 5 : n < 200 ? 10 : n < 1000 ? 50 : 100;
  return Math.max(step, Math.floor(n / step) * step);
};

/** The most a Shift finished in `ticks` can claim; the Worker refuses more. Loose on purpose: every source at its
 *  fastest (a full list at the top price through the one Register, the biggest Delivery, bounty and reward). */
export function shiftCaps(goal: ObjectiveDef[], ticks: number): { score: number; money: number } {
  const seconds = ticks / TUNING.tickRate;
  const E = TUNING.events;
  const price = Math.max(...Object.values(PRODUCTS).map((p) => p.price));
  const listItems = TUNING.listProducts.length * TUNING.listUnits[0].length;
  const checkout = Math.min(TUNING.playerCheckoutTime, ...CASHIER_CHECKOUT);
  const { robbery, inspector } = dailyEvents('');
  const bounty = Math.max(...Object.values(robbery?.byArea ?? {}).map((a) => a.bounty));
  const reward = Math.max(...Object.values(inspector?.byArea ?? {}).map((a) => a.reward[1]));
  const moneyRate =
    (listItems * price) / checkout +
    (E.deliveryItems[E.deliveryItems.length - 1][1] * price * E.deliveryPay * (1 + E.tipMax)) / E.extraCarGap[0] +
    bounty / E.robberyGap[0] +
    reward / E.inspectorGap[0];
  return {
    score: fixedMaxScore({ objectives: goal }) + seconds * maxScoreRate(),
    money: Math.ceil(seconds * moneyRate),
  };
}

/** `seed` is the day's; the Shift's World runs on the same one. */
export function calibrateDaily(map: MapDef, seed: number): DailyGoal {
  const ticks = Math.round(K.targetMinutes * 60 * K.botPace * TUNING.tickRate);
  const w = createWorld(map, null, seed);
  const bot = new Bot();
  const boughtAt = new Map<string, number>();
  for (let i = 0; i < ticks; i++) {
    step(w, bot.intents(w));
    for (const id of w.owned) if (!boughtAt.has(id)) boughtAt.set(id, i);
  }

  const rng = { rng: seed ^ 0x5eed };
  const parts = 1 + [...Array(K.goalParts - 1)].filter(() => nextRandom(rng) < K.extraPartChance).length;
  const goal: ObjectiveDef[] = [];
  for (const kind of shuffle<Part>(rng, ['own', 'earn', 'sell', 'deliveries'])) {
    if (goal.length >= parts) break;
    if (kind === 'earn') goal.push({ kind, n: nice(w.stats.moneyEarned) });
    if (kind === 'deliveries' && w.stats.deliveriesFull >= K.deliveriesMin)
      goal.push({ kind, n: w.stats.deliveriesFull });
    if (kind === 'sell') {
      const best = Object.entries(w.stats.sold)
        .sort((a, b) => map.products[b[0]].price - map.products[a[0]].price)
        .find(([, n]) => n >= K.sellMin);
      if (best) goal.push({ kind, product: best[0], n: nice(best[1]) });
    }
    if (kind === 'own') {
      // the Pad the bot bought nearest the target, never one owned at the Opening
      const near = [...boughtAt].filter(([id]) => map.pads[id] && !map.start.owned.includes(id)).at(-1);
      if (near && near[1] > ticks * K.ownAfter) goal.push({ kind, id: near[0] });
    }
  }
  if (!goal.length) goal.push({ kind: 'earn', n: nice(Math.max(w.stats.moneyEarned, K.earnMin)) });

  const v = createWorld({ ...map, objectives: goal }, null, seed);
  const vb = new Bot();
  const cap = K.capMinutes * 60 * TUNING.tickRate;
  let botTicks: number | null = null;
  for (let i = 1; i <= cap && botTicks === null; i++) {
    step(v, vb.intents(v));
    if (goal.every((o) => objectiveProgress(v, o).got >= objectiveProgress(v, o).want)) botTicks = i;
  }
  return { goal, botTicks, floorTicks: Math.floor((botTicks ?? cap) * K.floorShare) };
}
