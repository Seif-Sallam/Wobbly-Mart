// PROTOTYPE (#138): generates the next N Daily Shift Maps, validates each and bot-calibrates its goal.
// npm run daily -- [slabs|kit] [days=365] [from=YYYY-MM-DD]
import { ASSETS } from '../catalog/assets';
import { validateMap } from '../src/sim/validate';
import { calibrate, dateSeed, generateDaily, goalText, type Variant } from '../src/sim/daily-map.prototype';

const variant = (process.argv[2] ?? 'slabs') as Variant;
const days = Number(process.argv[3] ?? 365);
const from = new Date(process.argv[4] ?? '2027-01-01');
const mins: number[] = [];
let invalid = 0;
let unfinished = 0;
const t0 = Date.now();
for (let d = 0; d < days; d++) {
  const date = new Date(from.getTime() + d * 864e5).toISOString().slice(0, 10);
  const g = generateDaily(dateSeed(date), variant);
  const problems = validateMap(g.map, ASSETS);
  if (problems.length) {
    invalid++;
    console.log(`${date} INVALID ${problems.slice(0, 3).map((p) => `${p.id}: ${p.message}`).join(' | ')}`);
    continue;
  }
  const c = calibrate(g);
  const m = c.botSeconds / 60;
  if (c.botSeconds < 0) unfinished++;
  else mins.push(m);
  const areas = Object.keys(g.map.layout.areas).length;
  console.log(
    `${date} ${g.format}/${g.interiors.join(',')}${g.rerolls ? ' r' + g.rerolls : ''} ${areas}A ${Object.keys(g.map.producers).join(',')} | start ${g.map.start.owned.length - 1}/${g.order.length} | ` +
      `${c.goal.map((o) => goalText(o, g.map)).join(' + ')} | bot ${c.botSeconds < 0 ? 'DNF' : m.toFixed(1) + ' min'}`,
  );
}
mins.sort((a, b) => a - b);
const q = (p: number) => mins[Math.floor(p * (mins.length - 1))]?.toFixed(1);
console.log(
  `\n${variant}: ${days} days, ${invalid} invalid, ${unfinished} DNF; bot minutes min ${q(0)} p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)} max ${q(1)}; ${((Date.now() - t0) / 1000).toFixed(0)} s`,
);
process.exit(invalid || unfinished ? 1 : 0);
