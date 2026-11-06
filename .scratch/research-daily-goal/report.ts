// Summarise maps/daily-calendar.json: parts per day, late part kind and where it sits, bot minutes by Area count.
// Run after npm run daily:calendar. npx tsx report.ts
import { readFileSync } from 'node:fs';
import { generateDailyMap } from '../../src/sim/daily-map';
import { fnv1a } from '../../src/sim/rng';
import type { DailyCalendar } from '../../src/sim/daily-goal';

const cal: DailyCalendar = JSON.parse(readFileSync('maps/daily-calendar.json', 'utf8'));
const parts: Record<number, number> = {};
const late: Record<string, number> = {};
const mins: Record<number, number[]> = {};
const pos: number[] = [];
for (const [date, day] of Object.entries(cal.days)) {
  if (!day) continue;
  const g = generateDailyMap(fnv1a(date));
  const pads = g.map.pads;
  const chain = Object.keys(pads).filter((id) => !g.map.start.owned.includes(id) && pads[id].unlocks.kind !== 'exit');
  const areas = chain.filter((id) => pads[id].unlocks.kind === 'area');
  const lastArea = areas.at(-1);
  const inLast = (id: string) => !lastArea || chain.indexOf(id) >= chain.indexOf(lastArea);
  parts[day.goal.length] = (parts[day.goal.length] ?? 0) + 1;
  const o = day.goal.at(-1)!;
  const id = o.kind === 'own' ? o.id : o.kind === 'sell' ? chain.find((p) => { const u = pads[p].unlocks; return u.kind === 'shelf' && u.product === o.product; }) : undefined;
  const p = id ? chain.indexOf(id) / chain.length : -1;
  const where = !id || chain.indexOf(id) < Math.floor(chain.length * 0.5) ? 'NOT late' : inLast(id) ? 'last Area' : 'earlier Area';
  late[`${areas.length + 1}A ${o.kind} ${where}`] = (late[`${areas.length + 1}A ${o.kind} ${where}`] ?? 0) + 1;
  pos.push(p);
  (mins[areas.length + 1] ??= []).push(day.botTicks / 3600);
}
const q = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const f = (x: number) => s[Math.floor(x * (s.length - 1))].toFixed(1); return `n${s.length} min ${f(0)} median ${f(0.5)} p90 ${f(0.9)} max ${f(1)}`; };
console.log('parts', parts);
console.log('late part', late);
console.log('late part chain position', q(pos));
for (const [a, xs] of Object.entries(mins)) console.log(`bot minutes ${a}-Area`, q(xs));
console.log('bot minutes all', q(Object.values(mins).flat()));
