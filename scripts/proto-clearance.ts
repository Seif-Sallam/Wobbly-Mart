// PROTOTYPE (prototype/relayout-2m): list every pair of Station/Pad footprints closer than 2.0 m.
import { layout } from '../maps/corner-shop/layout';
import { pads } from '../maps/corner-shop/unlocks';
const GAP = 2.0;
const gap = (a: number[], b: number[]) => {
  const dx = Math.max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2]), 0);
  const dz = Math.max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3]), 0);
  return Math.max(dx, dz);
};
const ids = Object.keys(layout.places);
const owner = (id: string) => (pads[id]?.unlocks as { register?: string })?.register;
let bad = 0;
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i],
      b = ids[j];
    if (owner(a) === b || owner(b) === a) continue;
    const g = gap(layout.places[a].box, layout.places[b].box);
    if (g < GAP - 1e-6) {
      bad++;
      console.log(`${a} ↔ ${b}: ${g.toFixed(2)} m`);
    }
  }
console.log(`${bad} pairs under ${GAP} m`);
