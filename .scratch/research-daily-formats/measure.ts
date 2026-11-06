// Throwaway: shop-to-shop distances per Daily Format. `npx tsx .scratch/research-daily-formats/measure.ts [seeds]`
import { generateDailyMap } from '../../src/sim/daily-map';
import { createWorld } from '../../src/sim/world';
import { rebuildNav } from '../../src/sim/walk';
import { makeField, seedCells } from '../../src/sim/nav';
import { boxGap, inBox } from '../../src/sim/geometry';
import { TUNING } from '../../src/sim/tuning';

const N = Number(process.argv[2] ?? 200);
const formats = TUNING.dailyMap.formats as Record<string, number>;
const all = { ...formats };
for (const f of Object.keys(all).filter((f) => f !== 'kit')) {
  for (const k of Object.keys(formats)) formats[k] = k === f ? 1 : 0;
  let worstWalk = 0, worstGap = 0, fails = 0, made = 0, rerolls = 0;
  const byCount: Record<number, number> = {};
  for (let s = 1; s <= N; s++) {
    let g;
    try { g = generateDailyMap(s * 7919); } catch (e) { fails++; continue; }
    if (g.format !== f) continue;
    made++; rerolls += g.rerolls;
    const map = g.map;
    const w = createWorld({ ...map, start: { ...map.start, owned: ['area_1', ...Object.keys(map.pads)] } }, null, 0);
    rebuildNav(w);
    const fl = map.layout.floors;
    byCount[fl.length] = (byCount[fl.length] ?? 0) + 1;
    const n = fl.length;
    const d = [...Array(n)].map(() => Array(n).fill(0));
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        const grid = w.nav.walker;
        const field = makeField(grid, seedCells(grid, (x, z) => inBox(x, z, fl[b])));
        let best = Infinity;
        for (const c of seedCells(grid, (x, z) => inBox(x, z, fl[a]))) best = Math.min(best, field[c]);
        d[a][b] = d[b][a] = best;
        worstGap = Math.max(worstGap, boxGap(fl[a], fl[b]));
      }
    // walking through a third shop costs nothing
    for (let k = 0; k < n; k++) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) d[a][b] = Math.min(d[a][b], d[a][k] + d[k][b]);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) worstWalk = Math.max(worstWalk, d[a][b]);
    if (s <= 3 * N / N && f !== 'row') {}
  }
  console.log(`${f.padEnd(10)} days ${made} (areas ${JSON.stringify(byCount)}) rerolls ${rerolls} fails ${fails}  worst walk ${worstWalk.toFixed(1)} m  worst box gap ${worstGap.toFixed(1)} m`);
}
