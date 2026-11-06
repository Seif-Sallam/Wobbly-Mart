// A Daily Shift's goal: the bot plays the day with no goal until it buys a late Pad (within `targetMinutes × botPace`),
// and each goal part is what it had reached by then. A second run with the goal set gives the bot's time and the
// Daily floor. Runs in scripts/daily-calendar.ts (the Worker can't run the bot), never in the game.
import type { MapDef } from './map';
import type { ObjectiveDef } from '../../catalog/objectives';
import { nextRandom, shuffle } from './rng';
import { createWorld, step } from './world';
import { Bot } from './bot';
import { objectiveProgress } from './objectives';
import { TUNING } from './tuning';

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
  /** The bot's time to the goal, shown on the title's Daily card. */
  botTicks: number;
  floorTicks: number;
}

const K = TUNING.dailyMap;

/** Rounded down to a number a player reads at a glance. */
const nice = (n: number) => {
  const step = K.goalSteps.find(([below]) => n < below)?.[1] ?? K.goalStepTop;
  return Math.max(step, Math.floor(n / step) * step);
};

/** `seed` is the day's; the Shift's World runs on the same one. */
export function calibrateDaily(map: MapDef, seed: number): DailyGoal {
  const [minTicks, maxTicks] = K.targetMinutes.map((m) => Math.round(m * 60 * K.botPace * TUNING.tickRate));
  const chain = Object.keys(map.pads).filter((id) => !map.start.owned.includes(id) && map.pads[id].unlocks.kind !== 'exit');
  const lateIds = chain.slice(Math.floor(chain.length * K.lateFrom));
  const w = createWorld(map, null, seed);
  const bot = new Bot();
  const boughtAt = new Map<string, number>();
  // stop at the first late Pad bought, within the target window
  for (let i = 0; i < maxTicks && (i < minTicks || !lateIds.some((id) => boughtAt.has(id))); i++) {
    step(w, bot.intents(w));
    for (const id of w.owned) if (!boughtAt.has(id)) boughtAt.set(id, i);
  }

  const rng = { rng: seed ^ K.goalSalt };
  const parts = K.goalParts + (nextRandom(rng) < K.extraPartChance ? 1 : 0);
  // the late part: the furthest late Pad the bot bought, or the Items of the furthest late Shelf
  const late = lateIds.filter((id) => boughtAt.has(id));
  const soldOf = (product: string) => w.stats.sold[product] ?? 0;
  const lateShelf = late
    .map((id) => map.pads[id].unlocks)
    .flatMap((u) => (u.kind === 'shelf' && soldOf(u.product) >= K.sellMin ? [u.product] : []))
    .at(-1);
  const latePad = late.at(-1) ?? chain.filter((id) => boughtAt.has(id)).at(-1);
  const lateGoal: ObjectiveDef | null =
    lateShelf && (!latePad || nextRandom(rng) < K.lateSellChance)
      ? { kind: 'sell', product: lateShelf, n: nice(soldOf(lateShelf)) }
      : latePad
        ? { kind: 'own', id: latePad }
        : null;

  const goal: ObjectiveDef[] = [];
  const sells = Object.keys(w.stats.sold)
    .filter((p) => p !== lateShelf && soldOf(p) >= K.sellMin)
    .sort((a, b) => map.products[b].price - map.products[a].price);
  const pool: ObjectiveDef[] = [{ kind: 'earn', n: nice(Math.max(w.stats.moneyEarned, K.earnMin)) }];
  if (w.stats.deliveriesFull >= K.deliveriesMin) pool.push({ kind: 'deliveries', n: w.stats.deliveriesFull });
  for (const p of sells) pool.push({ kind: 'sell', product: p, n: nice(soldOf(p)) });
  // one of each kind first, then more Sells
  const firsts = shuffle(rng, pool.filter((o, i) => pool.findIndex((x) => x.kind === o.kind) === i));
  for (const o of [...firsts, ...pool.filter((o) => !firsts.includes(o))])
    if (goal.length < parts - (lateGoal ? 1 : 0)) goal.push(o);
  if (lateGoal) goal.push(lateGoal);

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
