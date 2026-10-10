// Bot-measured pacing: plays a Map with the CI bot over several seeds and logs when each Pad / Upgrade level is bought.
// Run from the repo root: npx tsx .scratch/maps-2-4/juice-bar-price-table/bot-table.ts <map-id> [seeds] [--juice-events] [--table]
import { MAPS } from '../../../maps';
import { createWorld, step } from '../../../src/sim/world';
import { Bot } from '../../../src/sim/bot';
import { completion } from '../../../src/sim/economy';
import { TUNING } from '../../../src/sim/tuning';

const [id, seedsArg, ...flags] = process.argv.slice(2);
const flag = flags.includes('--juice-events') ? '--juice-events' : '';
const seeds = Number(seedsArg ?? 3);
const map = MAPS.find((m) => m.id === id);
if (!map) throw new Error(`no map ${id}; have ${MAPS.map((m) => m.id).join(', ')}`);

// #40's Juice Bar numbers, until per-Map Event timing is built; visits ≈ two kinds at 600–900 s each
if (flag === '--juice-events') {
  const E = TUNING.events as unknown as Record<string, unknown>;
  Object.assign(E, { deliveryGap: [110, 150], carStockers: [1, 3, 5], extraCarChance: 0.5, visitGap: [300, 450] });
}

const times: Record<string, number[]> = {};
const totals: number[] = [];
const delivered: number[] = [];
for (let seed = 1; seed <= seeds; seed++) {
  const w = createWorld(map, null, seed);
  const bot = new Bot();
  const seen = new Set<string>();
  let pay = 0;
  while (completion(w) < 1 && w.t < 4 * 3600) {
    step(w, bot.intents(w));
    for (const e of w.events) if (e.type === 'deliveryDone') pay += e.amount + e.tip;
    for (const o of w.owned) if (!seen.has(o)) (seen.add(o), (times[o] ??= []).push(w.t));
    for (const [u, l] of Object.entries(w.levels))
      for (let i = 1; i <= l; i++) {
        const key = `${u} L${i}`;
        if (!seen.has(key)) (seen.add(key), (times[key] ??= []).push(w.t));
      }
  }
  totals.push(w.t);
  delivered.push(pay);
}
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
if (!flags.includes('--table'))
  for (const [k, v] of Object.entries(times).sort((a, b) => avg(a[1]) - avg(b[1]))) console.log(`${mmss(avg(v)).padStart(6)}  ${k}`);
else {
  const at = (k: string) => (times[k] ? mmss(avg(times[k])) : '—');
  const areaOf = (pid: string): number => {
    const m = /^area_(\d)$/.exec(pid);
    if (m) return Number(m[1]);
    return Math.max(1, ...(map.pads[pid]?.requires ?? []).map((r) => (r in map.pads ? areaOf(r) : 1)));
  };
  console.log('## Pads (bot buy order)\n\n| Area | Pad | Cost | Requires | Bought at |\n|---|---|---|---|---|');
  for (const [pid, pad] of Object.entries(map.pads).sort((a, b) => avg(times[a[0]] ?? [0]) - avg(times[b[0]] ?? [0])))
    console.log(`| ${areaOf(pid)} | ${pid} | $${pad.cost} | ${pad.requires.join(', ') || '—'} | ${at(pid)} |`);
  console.log('\n## Upgrades\n\n| Upgrade | Appears after | Level costs (bought at) | Values |\n|---|---|---|---|');
  for (const [uid, up] of Object.entries(map.upgrades)) {
    const costs = up.levels.map((l, i) => `$${l.cost} (${at(`${uid} L${i + 1}`)})`).join(' / ');
    console.log(`| ${uid} | ${up.requires.join(', ')} | ${costs} | ${up.levels.map((l) => l.value).join(' → ')} |`);
  }
  console.log(`\n## Moves\n\n| Move | ${map.movePrices.map((_, i) => i + 1).join(' | ')} |\n|---|${'---|'.repeat(map.movePrices.length)}`);
  console.log(`| Price | ${map.movePrices.map((p) => `$${p}`).join(' | ')} |`);
}
console.log(`\n${id}: 100% after ${totals.map((t) => (t / 60).toFixed(1)).join(' / ')} min (mean ${(avg(totals) / 60).toFixed(1)}); Delivery pay $${Math.round(avg(delivered))}`);
