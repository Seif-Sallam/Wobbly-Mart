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
  const step = K.goalSteps.find(([below]) => n < below)?.[1] ?? K.goalStepTop;
  return Math.max(step, Math.floor(n / step) * step);
};

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

  const rng = { rng: seed ^ K.goalSalt };
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
