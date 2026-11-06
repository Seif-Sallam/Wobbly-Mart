// Knob sweep: when does the no-goal bot reach the last Area (its Area Pad) and finish its Pads, over many days?
// npx tsx sweep.ts '<json knobs>' [days]   knobs: any TUNING.dailyMap field, plus upScale (× every Upgrade cost)
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateDailyMap } from '../../src/sim/daily-map';
import { createWorld, step } from '../../src/sim/world';
import { Bot } from '../../src/sim/bot';
import { fnv1a } from '../../src/sim/rng';
import { TUNING } from '../../src/sim/tuning';
import { dailyDate } from '../../src/sim/daily';

type Knobs = Record<string, unknown> & { upScale?: number };
interface R { date: string; format: string; areas: number; lastArea: number | null; lateHalf: number | null; all: number | null; earned15: number }

function run(date: string, knobs: Knobs): R {
  const { upScale = 1, ...k } = knobs;
  Object.assign(TUNING.dailyMap, k);
  const seed = fnv1a(date);
  const g = generateDailyMap(seed);
  for (const u of Object.values(g.map.upgrades)) for (const l of u.levels) l.cost = Math.round(l.cost * upScale);
  const chain = Object.keys(g.map.pads).filter((id) => !g.map.start.owned.includes(id) && id !== 'exit');
  const areaPads = chain.filter((id) => g.map.pads[id].unlocks.kind === 'area');
  const last = areaPads.at(-1) ?? null;
  const half = chain[Math.floor(chain.length / 2)];
  const w = createWorld(g.map, null, seed);
  const bot = new Bot();
  const r: R = { date, format: g.format, areas: areaPads.length + 1, lastArea: null, lateHalf: null, all: null, earned15: 0 };
  for (let i = 1; i <= 25 * 3600; i++) {
    step(w, bot.intents(w));
    const m = i / 3600;
    if (r.lastArea === null && last && w.owned.has(last)) r.lastArea = m;
    if (r.lateHalf === null && half && w.owned.has(half)) r.lateHalf = m;
    if (i === 15 * 3600) r.earned15 = w.stats.moneyEarned;
    if (chain.every((id) => w.owned.has(id))) { r.all = m; break; }
  }
  return r;
}

const q = (xs: (number | null)[]) => {
  const n = xs.length, ok = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  const p = (f: number) => (ok[Math.floor(f * (ok.length - 1))] ?? NaN).toFixed(1);
  return `n${n} miss ${n - ok.length} min ${p(0)} med ${p(0.5)} p90 ${p(0.9)} max ${p(1)}`;
};

const args = process.argv.slice(2);
if (args[0] === '--part') {
  const knobs = JSON.parse(args[1]);
  process.send?.(args[2].split(',').map((d) => run(d, knobs)), () => process.disconnect?.());
} else {
  const knobs = args[0] ?? '{}';
  const dates = [...Array(Number(args[1] ?? 60))].map((_, i) => dailyDate(i + 1));
  const P = 15;
  const res = (await Promise.all([...Array(P)].map((_, p) => new Promise<R[]>((ok) => {
    const c = fork(fileURLToPath(import.meta.url), ['--part', knobs, dates.filter((_, i) => i % P === p).join(',')]);
    c.on('message', (m) => ok(m as R[]));
  })))).flat();
  console.log('knobs', knobs);
  for (const a of [1, 2, 3]) {
    const rs = res.filter((r) => r.areas === a);
    if (!rs.length) continue;
    console.log(` ${a}-Area  lastArea ${a > 1 ? q(rs.map((r) => r.lastArea)) : '-'}\n          lateHalf ${q(rs.map((r) => r.lateHalf))}\n          allPads  ${q(rs.map((r) => r.all))}`);
  }
}
