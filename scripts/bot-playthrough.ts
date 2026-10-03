// CI gate: a headless bot plays each map at full speed and must reach 100% Completion.
import { MAPS } from '../maps';
import { createWorld, step, type World } from '../src/sim/world';
import { Bot } from '../src/sim/bot';
import { completion } from '../src/sim/economy';

const LIMIT_SECONDS = 4 * 3600;

export function playthrough(w: World, log = false): number {
  const bot = new Bot();
  let lastPct = -1;
  while (completion(w) < 1 && w.t < LIMIT_SECONDS) {
    step(w, bot.intents(w));
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
for (const map of MAPS) {
  const w = createWorld(map, null, 1);
  const t = playthrough(w, true);
  const pct = completion(w) * 100;
  console.log(`${map.id}: ${pct.toFixed(0)}% after ${(t / 60).toFixed(1)} simulated minutes`);
  if (pct < 100) {
    failed = true;
    console.error(`${map.id}: 100% Completion was not reached within ${LIMIT_SECONDS / 3600} h`);
  }
}
process.exit(failed ? 1 : 0);
