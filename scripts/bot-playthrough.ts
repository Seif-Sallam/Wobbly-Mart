// CI gate: a headless bot plays each map at full speed and must reach 100% Completion.
import { MAPS } from '../maps';
import { createWorld, step, type World } from '../src/sim/world';
import { Bot } from '../src/sim/bot';
import { completion } from '../src/sim/economy';
import { TUNING } from '../src/sim/tuning';

const LIMIT_SECONDS = 4 * 3600;

/** What the bot did while a given number of Areas was bought: seconds, checkouts, Items made and sold per Product. */
interface Tier {
  seconds: number;
  checkouts: number;
  made: Record<string, number>;
  sold: Record<string, number>;
}

const areasBought = (w: World): number => Object.keys(w.map.layout.areas).filter((a) => w.owned.has(a)).length;

/** Each Challenge count must be reachable at the bot's measured rate with this margin. */
const MARGIN = 1.5;

function reachability(tiers: Map<number, Tier>): string[] {
  const C = TUNING.challenges.kinds;
  const lines: string[] = [];
  for (const [areas, t] of [...tiers].sort((a, b) => a[0] - b[0])) {
    const i = Math.min(areas, 3) - 1;
    if (t.seconds < 60) continue;
    const per = (n: number, secs: number) => (n / t.seconds) * secs;
    const slowest = (r: Record<string, number>, secs: number) => Math.min(...Object.values(r).map((n) => per(n, secs)));
    const rows: [string, number, number][] = [
      ['checkout', per(t.checkouts, C.checkout.time), C.checkout.goal[i]],
      ['make', slowest(t.made, C.make.time), C.make.goal[i]],
      ['sell', slowest(t.sold, C.sell.time), C.sell.goal[i]],
    ];
    for (const [kind, got, want] of rows)
      lines.push(
        `  area ${areas} ${kind}: bot ${got.toFixed(1)} vs ${want} x${MARGIN} ${got >= want * MARGIN ? 'ok' : 'SHORT'}`,
      );
  }
  return lines;
}

/** Longest stretch, in seconds, that Money stayed below $0. */
let longestDebt = 0;

export function playthrough(w: World, log = false, tiers = new Map<number, Tier>()): number {
  let debtSince: number | null = null;
  longestDebt = 0;
  const bot = new Bot();
  let lastPct = -1;
  while (completion(w) < 1 && w.t < LIMIT_SECONDS) {
    const areas = areasBought(w);
    const tier = tiers.get(areas) ?? { seconds: 0, checkouts: 0, made: {}, sold: {} };
    tiers.set(areas, tier);
    step(w, bot.intents(w));
    tier.seconds += 1 / TUNING.tickRate;
    for (const e of w.events) {
      if (e.type === 'paid') {
        tier.checkouts++;
        for (const p of e.products) tier.sold[p] = (tier.sold[p] ?? 0) + 1;
      } else if (e.type === 'produced') {
        const st = w.stations.get(e.station);
        if (st?.kind === 'producer') {
          const out = w.map.producers[st.type].output;
          tier.made[out] = (tier.made[out] ?? 0) + 1;
        }
      }
    }
    if (w.money < 0) debtSince ??= w.t;
    else debtSince = null;
    if (debtSince !== null) longestDebt = Math.max(longestDebt, w.t - debtSince);
    const pct = Math.floor(completion(w) * 10);
    if (log && pct !== lastPct) {
      lastPct = pct;
      console.log(
        `${(w.t / 60).toFixed(1).padStart(5)} min  ${pct * 10}%  $${Math.floor(w.money)}  owned ${w.owned.size}`,
      );
    }
  }
  return w.t;
}

let failed = false;
const only = process.argv[2];
for (const map of MAPS.filter((m) => !only || m.id === only)) {
  const w = createWorld(map, null, 1);
  const tiers = new Map<number, Tier>();
  const t = playthrough(w, true, tiers);
  const pct = completion(w) * 100;
  console.log(`${map.id}: ${pct.toFixed(0)}% after ${(t / 60).toFixed(1)} simulated minutes`);
  console.log(`  Longest stretch below $0: ${(longestDebt / 60).toFixed(1)} min`);
  console.log(`  Score ${w.score}, Objectives ${w.objectivesDone.size}/${map.objectives.length}`);
  for (const line of reachability(tiers)) console.log(line);
  if (pct < 100) {
    failed = true;
    console.error(`${map.id}: 100% Completion was not reached within ${LIMIT_SECONDS / 3600} h`);
  }
}
process.exit(failed ? 1 : 0);
