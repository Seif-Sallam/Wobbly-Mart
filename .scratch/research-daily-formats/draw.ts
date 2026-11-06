// Throwaway: top-down SVG of a format's 3-Area day. `npx tsx draw.ts <format> <out.svg>`
import { writeFileSync } from 'node:fs';
import { generateDailyMap } from '../../src/sim/daily-map';
import { TUNING } from '../../src/sim/tuning';
const K = TUNING.dailyMap as { formats: Record<string, number>; slabsAreas: number[] };
const [f, out] = process.argv.slice(2);
for (const k of Object.keys(K.formats)) K.formats[k] = k === f ? 1 : 0;
K.slabsAreas = [3, 3];
const L = generateDailyMap(7919).map.layout;
const S = 6;
const r = (b: number[], fill: string, extra = '') =>
  `<rect x="${b[0] * S}" y="${b[1] * S}" width="${b[2] * S}" height="${b[3] * S}" fill="${fill}" ${extra}/>`;
const parts: string[] = [r([0, 0, ...L.size], '#9c6')];
for (const s of L.street) parts.push(r(s, '#bbb'));
for (const s of L.roads) parts.push(r(s, '#555'));
for (const [a, boxes] of Object.entries(L.areas))
  boxes.forEach((b, i) => parts.push(r(b, i === 0 ? '#f4e3c1' : i === 1 ? '#c9a86b' : 'rgba(255,200,0,.35)', 'stroke="#000" stroke-width="0.5"')));
for (const w of Object.values(L.walls)) parts.push(r(w.box, '#333'));
for (const [id, d] of Object.entries(L.doors)) parts.push(r(d.box, d.kind === 'customer' ? (id.includes('corner') ? '#e00' : '#06f') : '#0a0'));
L.floors.forEach((b, i) => parts.push(`<text x="${(b[0] + 2) * S}" y="${(b[1] + 4) * S}" font-size="20">Area ${i + 1}</text>`));
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${L.size[0] * S}" height="${L.size[1] * S}">${parts.join('')}</svg>`);
