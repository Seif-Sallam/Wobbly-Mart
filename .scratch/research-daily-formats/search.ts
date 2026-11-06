// Throwaway: try every crossroads placement for 3 Areas; print the ones within 10 m (2- and 3-Area days).
import { generateDailyMap } from '../../src/sim/daily-map';
import { BLOCK, FORMATS, type Facing } from '../../maps/daily/blocks';
import { createWorld } from '../../src/sim/world';
import { rebuildNav } from '../../src/sim/walk';
import { makeField, seedCells } from '../../src/sim/nav';
import { inBox } from '../../src/sim/geometry';
import { TUNING } from '../../src/sim/tuning';

const K = TUNING.dailyMap as { formats: Record<string, number>; slabsAreas: number[] };
for (const k of Object.keys(K.formats)) K.formats[k] = k === 'corner' ? 1 : 0;
const door1 = Number(process.argv[2] ?? 7);
BLOCK.frontDoor.x[0] = door1;
const SEEDS = 6;
type Q = 'NW' | 'NE' | 'SW' | 'SE';
const spot = (q: Q, f: Facing, w: number) => {
  const west = q[1] === 'W', north = q[0] === 'N';
  const horiz = f === 'E' || f === 'W';
  const x = west ? (horiz ? 0 : 48 - w) : 52;
  const z = north ? (horiz ? 48 - w : 0) : 52;
  return { x, z, facing: f };
};
const facings: Record<Q, Facing[]> = { NW: ['S', 'E'], NE: ['S', 'W'], SW: ['N', 'E'], SE: ['N', 'W'] };
const qs: Q[] = ['NW', 'NE', 'SW', 'SE'];
function measure(areas: number): number {
  K.slabsAreas = [areas, areas];
  let worst = 0;
  for (let s = 1; s <= SEEDS; s++) {
    let g;
    try { g = generateDailyMap(s * 7919); } catch { return Infinity; }
    const map = g.map;
    const w = createWorld({ ...map, start: { ...map.start, owned: ['area_1', ...Object.keys(map.pads)] } }, null, 0);
    rebuildNav(w);
    const fl = map.layout.floors, n = fl.length, grid = w.nav.walker;
    const d = [...Array(n)].map(() => Array(n).fill(0));
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const field = makeField(grid, seedCells(grid, (x, z) => inBox(x, z, fl[b])));
      let best = Infinity;
      for (const c of seedCells(grid, (x, z) => inBox(x, z, fl[a]))) best = Math.min(best, field[c]);
      d[a][b] = d[b][a] = best;
    }
    for (let k = 0; k < n; k++) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) d[a][b] = Math.min(d[a][b], d[a][k] + d[k][b]);
    for (const r of d) for (const v of r) worst = Math.max(worst, v);
  }
  return worst;
}
const out: string[] = [];
for (const q1 of qs) for (const q2 of qs) for (const q3 of qs) {
  if (new Set([q1, q2, q3]).size < 3) continue;
  for (const f1 of facings[q1]) for (const f2 of facings[q2]) for (const f3 of facings[q3]) {
    FORMATS.corner = [spot(q1, f1, 16), spot(q2, f2, 14), spot(q3, f3, 14)];
    const two = measure(2);
    const three = measure(3);
    out.push([Math.max(two, three), `${q1}-${f1} ${q2}-${f2} ${q3}-${f3}  2 Areas ${two.toFixed(1)} m  3 Areas ${three.toFixed(1)} m`] as never);
  }
}
console.log(`Area 1 door at ${door1}:\n` + (out.join('\n') || 'none'));
