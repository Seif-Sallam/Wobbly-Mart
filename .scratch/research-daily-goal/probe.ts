// How far along the Pad chain the no-goal bot gets by 10 / 12 / 15 / 20 min, per Daily format.
// npx tsx .scratch/research-daily-goal/probe.ts [days]
import { generateDailyMap } from '../../src/sim/daily-map';
import { createWorld, step } from '../../src/sim/world';
import { Bot } from '../../src/sim/bot';
import { fnv1a } from '../../src/sim/rng';
import { TUNING } from '../../src/sim/tuning';
import { dailyDate } from '../../src/sim/daily';

const marks = [10, 12, 15, 20];
const days = Number(process.argv[2] ?? 24);
for (let d = 1; d <= days; d++) {
  const date = dailyDate(d);
  const seed = fnv1a(date);
  const g = generateDailyMap(seed);
  const chain = Object.keys(g.map.pads).filter((id) => !g.map.start.owned.includes(id));
  const w = createWorld(g.map, null, seed);
  const bot = new Bot();
  const out: string[] = [];
  for (let i = 1, m = 0; m < marks.length; i++) {
    step(w, bot.intents(w));
    if (i === marks[m] * 60 * TUNING.tickRate) {
      const got = chain.filter((id) => w.owned.has(id)).length;
      const areas = Object.values(g.map.pads).filter((p) => p.unlocks.kind === 'area').length + 1;
      const inArea = [...w.owned].filter((id) => id.startsWith('area_')).length;
      out.push(`${marks[m]}m ${got}/${chain.length} A${inArea}/${areas} $${w.stats.moneyEarned} dl${w.stats.deliveriesFull}`);
      m++;
    }
  }
  console.log(date, g.format.padEnd(9), out.join(' | '));
}
