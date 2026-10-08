// PROTOTYPE (prototype/relayout-2m): top-down SVG plan of the Corner Shop layout, red where pairs break 2 m.
import { writeFileSync } from 'node:fs';
import { layout } from '../maps/corner-shop/layout';
import { pads } from '../maps/corner-shop/unlocks';
const S = 20;
const [W, H] = layout.size;
const gap = (a: number[], b: number[]) =>
  Math.max(
    Math.max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2]), 0),
    Math.max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3]), 0),
  );
const ids = Object.keys(layout.places);
const owner = (id: string) => (pads[id]?.unlocks as { register?: string })?.register;
const bad = new Set<string>();
for (const a of ids)
  for (const b of ids)
    if (a < b && owner(a) !== b && owner(b) !== a && gap(layout.places[a].box, layout.places[b].box) < 2 - 1e-6) {
      bad.add(a);
      bad.add(b);
    }
const r = (b: number[], fill: string, stroke = '#333', sw = 1) =>
  `<rect x="${b[0] * S}" y="${b[1] * S}" width="${b[2] * S}" height="${b[3] * S}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const t = (x: number, y: number, s: string, size = 9) =>
  `<text x="${x * S}" y="${y * S}" font-size="${size}" font-family="sans-serif" text-anchor="middle">${s}</text>`;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}"><rect width="100%" height="100%" fill="#e9f3d8"/>`;
for (const [id, rects] of Object.entries(layout.areas))
  for (const a of rects) svg += r(a, 'none', '#7a7', 2) + t(a[0] + 1.2, a[1] + 0.8, id, 10);
for (const f of layout.floors) svg += r(f, '#f5ead2', '#bbb');
for (const w of Object.values(layout.walls)) svg += r(w.box, w.kind === 'tall' ? '#8a5a3a' : '#c79a6a', 'none');
for (const d of Object.values(layout.doors)) svg += r(d.box, d.kind === 'back' ? '#3a8' : '#38f', 'none');
for (const p of Object.values(layout.props)) if (p.solid) svg += r(p.box, '#ccc', '#999');
for (const c of layout.carSpots) svg += r(c.car, '#ddd') + r(c.pickup, '#ffd');
for (const x of Object.values(layout.waitingSpots ?? []))
  svg += `<circle cx="${x[0] * S}" cy="${x[1] * S}" r="4" fill="#99f"/>`;
for (const id of ids) {
  const { box } = layout.places[id];
  const isPad = !!pads[id] && !['shelf', 'producer', 'register', 'office'].includes(pads[id].unlocks.kind);
  svg += r(box, bad.has(id) ? '#f88' : isPad ? '#ffe680' : '#fff', bad.has(id) ? '#c00' : '#333', bad.has(id) ? 2 : 1);
  svg += t(box[0] + box[2] / 2, box[1] + box[3] / 2 + 0.15, id.replace(/_/g, ' '), 8);
}
for (let x = 0; x <= W; x += 2) svg += `<text x="${x * S}" y="10" font-size="7" fill="#666">${x}</text>`;
for (let z = 0; z <= H; z += 2) svg += `<text x="1" y="${z * S}" font-size="7" fill="#666">${z}</text>`;
svg += '</svg>';
writeFileSync(process.argv[2], svg);
console.log(`${bad.size} Stations/Pads in a too-close pair`);
