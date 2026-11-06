// One day's Pad chain: cost, kind, and when the no-goal bot bought it (min). npx tsx chain.ts 2026-11-15 [minutes]
import { generateDailyMap } from '../../src/sim/daily-map';
import { createWorld, step } from '../../src/sim/world';
import { Bot } from '../../src/sim/bot';
import { fnv1a } from '../../src/sim/rng';
import { TUNING } from '../../src/sim/tuning';

const date = process.argv[2];
const mins = Number(process.argv[3] ?? 20);
const seed = fnv1a(date);
const g = generateDailyMap(seed);
const w = createWorld(g.map, null, seed);
const bot = new Bot();
const at = new Map<string, number>();
for (let i = 1; i <= mins * 3600; i++) {
  step(w, bot.intents(w));
  for (const id of w.owned) if (!at.has(id)) at.set(id, i / 3600);
  if (i % (5 * 3600) === 0) console.log(`  ${i / 3600}m money ${w.money} earned ${w.stats.moneyEarned}`);
}
console.log(g.format, 'start owned', g.map.start.owned.join(','), 'startMoney', g.map.start.money);
for (const [id, p] of Object.entries(g.map.pads)) {
  if (g.map.start.owned.includes(id)) continue;
  const u = p.unlocks;
  const what = u.kind === 'producer' ? u.type : u.kind === 'shelf' ? `shelf ${u.product}` : u.kind;
  console.log(id.padEnd(18), String(p.cost).padStart(6), what.padEnd(20), at.has(id) ? at.get(id)!.toFixed(1) : '-');
}
void TUNING;
