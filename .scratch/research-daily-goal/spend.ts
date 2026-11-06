// Where one day's Money goes: Pads, Upgrades, fines. npx tsx spend.ts 2026-11-15 [minutes] ['<knobs>']
import { generateDailyMap } from '../../src/sim/daily-map';
import { createWorld, step } from '../../src/sim/world';
import { Bot } from '../../src/sim/bot';
import { fnv1a } from '../../src/sim/rng';
import { TUNING } from '../../src/sim/tuning';
const [date, mins = '20', kn = '{}'] = process.argv.slice(2);
const { upScale = 1, ...k } = JSON.parse(kn);
Object.assign(TUNING.dailyMap, k);
const seed = fnv1a(date);
const g = generateDailyMap(seed);
for (const u of Object.values(g.map.upgrades)) for (const l of u.levels) l.cost = Math.round(l.cost * upScale);
const w = createWorld(g.map, null, seed);
const bot = new Bot();
const ev: Record<string, number> = {};
let prevMoney = w.money, prevLv = 0, ups = 0, pads = 0, prevOwned = w.owned.size;
for (let i = 1; i <= Number(mins) * 3600; i++) {
  step(w, bot.intents(w));
  for (const e of w.events) ev[e.type] = (ev[e.type] ?? 0) + 1;
  const lv = Object.values(w.levels).reduce((a, b) => a + b, 0);
  if (lv > prevLv) ups += prevMoney - w.money;
  else if (w.owned.size > prevOwned) pads += prevMoney - w.money;
  prevLv = lv; prevOwned = w.owned.size; prevMoney = w.money;
}
console.log(g.format, 'earned', w.stats.moneyEarned, 'money', Math.round(w.money), 'on upgrades ~', Math.round(ups), 'levels', prevLv, 'owned', w.owned.size);
console.log(JSON.stringify(Object.fromEntries(Object.entries(ev).filter(([t]) => /rob|inspect|fine|review|debt|tip|drop|mess/i.test(t)))));
