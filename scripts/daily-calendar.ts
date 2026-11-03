// The Daily calendar: each day's goal and Daily floor, read by the client and the Worker (the Map itself comes from
// the seed). `npm run daily:calendar [-- 2026-11-01 365]` generates and bot-calibrates every day across 12 processes
// and rewrites maps/daily-calendar.json; it fails if any day can't be generated or the bot can't finish it.
// `npm run daily:check` (CI, no bot) regenerates every listed day and fails if the calendar no longer matches the
// generator or SIM_VERSION, or ends within 30 days.
import { fork } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateDailyMap } from '../src/sim/daily-map';
import { calibrateDaily, type DailyCalendar as Calendar, type DailyDay as Day } from '../src/sim/daily-goal';
import { fnv1a } from '../src/sim/rng';
import { SIM_VERSION } from '../src/sim/version';
import { TUNING } from '../src/sim/tuning';

const FILE = 'maps/daily-calendar.json';
const PROCESSES = 12;
const AHEAD_DAYS = 30;
const DAY_MS = 86_400_000;

interface Result {
  date: string;
  day?: Day;
  error?: string;
  format?: string;
  rerolls?: number;
  botTicks?: number | null;
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY_MS).toISOString().slice(0, 10);
const mapPrint = (date: string) => {
  const g = generateDailyMap(fnv1a(date));
  return { g, print: fnv1a(JSON.stringify(g.map)) };
};

function calibrateDay(date: string): Result {
  try {
    const { g, print } = mapPrint(date);
    const { goal, botTicks, floorTicks } = calibrateDaily(g.map, fnv1a(date));
    return { date, day: { map: print, goal, floorTicks }, format: g.format, rerolls: g.rerolls, botTicks };
  } catch (e) {
    return { date, error: (e as Error).message };
  }
}

function check(): number {
  const cal: Calendar = JSON.parse(readFileSync(FILE, 'utf8'));
  const problems: string[] = [];
  if (cal.simVersion !== SIM_VERSION)
    problems.push(`calendar is for SIM_VERSION ${cal.simVersion}, the sim is ${SIM_VERSION}`);
  for (const [date, day] of Object.entries(cal.days)) {
    try {
      if (mapPrint(date).print !== day?.map) problems.push(`${date}: the generator now makes a different Map`);
    } catch (e) {
      problems.push(`${date}: ${(e as Error).message}`);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const last = addDays(today, AHEAD_DAYS);
  if (!cal.days[last]) problems.push(`calendar ends before ${last}`);
  for (const p of problems) console.log(p);
  console.log(
    problems.length
      ? `\n${problems.length} problem(s): run npm run daily:calendar and commit ${FILE}`
      : `${Object.keys(cal.days).length} days match`,
  );
  return problems.length ? 1 : 0;
}

async function calendar(from: string, count: number): Promise<number> {
  const dates = [...Array(count)].map((_, i) => addDays(from, i));
  const t0 = performance.now();
  const parts = await Promise.all(
    [...Array(PROCESSES)].map(
      (_, p) =>
        new Promise<Result[]>((resolve, reject) => {
          const child = fork(fileURLToPath(import.meta.url), [
            '--part',
            dates.filter((_, i) => i % PROCESSES === p).join(','),
          ]);
          child.on('message', (m) => resolve(m as Result[]));
          child.on('exit', (code) => code && reject(new Error(`part ${p} exited ${code}`)));
        }),
    ),
  );
  const results = parts.flat().sort((a, b) => a.date.localeCompare(b.date));
  const failed = results.filter((r) => r.error || r.botTicks === null);
  for (const r of failed)
    console.log(`${r.date}: ${r.error ?? `bot didn't finish in ${TUNING.dailyMap.capMinutes} min`}`);

  const minutes = results.flatMap((r) => (r.botTicks ? [r.botTicks / TUNING.tickRate / 60] : [])).sort((a, b) => a - b);
  const q = (p: number) => minutes[Math.floor(p * (minutes.length - 1))]?.toFixed(1);
  const formats: Record<string, number> = {};
  for (const r of results) if (r.format) formats[r.format] = (formats[r.format] ?? 0) + 1;
  const rerolls = results.reduce((t, r) => t + (r.rerolls ?? 0), 0);
  console.log(
    `${count} days from ${from}: ${failed.length} failed, ${rerolls} rerolls; formats ${JSON.stringify(formats)}\n` +
      `bot minutes min ${q(0)} p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)} max ${q(1)}; ${((performance.now() - t0) / 1000).toFixed(0)} s`,
  );
  if (failed.length) return 1;
  const cal: Calendar = { simVersion: SIM_VERSION, days: {} };
  for (const r of results) if (r.day) cal.days[r.date] = r.day;
  writeFileSync(FILE, JSON.stringify(cal, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
  return 0;
}

const args = process.argv.slice(2);
if (args[0] === '--part') {
  process.send?.(args[1].split(',').filter(Boolean).map(calibrateDay), () => process.disconnect?.());
} else if (args[0] === '--check') {
  process.exit(check());
} else {
  process.exit(await calendar(args[0] ?? '2026-11-01', Number(args[1] ?? 365)));
}
