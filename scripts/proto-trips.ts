// PROTOTYPE (prototype/relayout-2m): walk length of every carrying trip on a fully built Map 1.
import { MAPS } from '../maps';
import { createWorld } from '../src/sim/world';
import { own } from '../src/sim/economy';
import { rebuildNav, walkDistance } from '../src/sim/walk';
import { cellCentre, nearestFreeCell } from '../src/sim/nav';

const w = createWorld(MAPS[0], null, 1);
for (const id of Object.keys(w.map.pads)) own(w, id, true);
rebuildNav(w);
const st = [...w.stations.values()];
const edge = (b: number[]) => {
  const [x, z] = cellCentre(w.nav.walker, nearestFreeCell(w.nav.walker, b[0] + b[2] / 2, b[1] + b[3] / 2));
  return { x, z };
};
const trips: Record<string, number> = {};
for (const p of st) {
  if (p.kind !== 'producer') continue;
  const out = w.map.producers[p.type].output;
  // from just outside this Producer to the nearest sink of its output: Shelves and Producers taking it
  const from = edge(p.box);
  const near = (t: { id: string }) => walkDistance(w, 'walker', from, { station: t.id });
  const shelves = st.filter((s) => s.kind === 'shelf' && s.product === out);
  const feeds = st.filter((s) => s.kind === 'producer' && w.map.producers[s.type].inputs.includes(out));
  if (shelves.length) trips[`${p.id} → ${out} Shelf`] = Math.min(...shelves.map(near));
  for (const f of feeds) trips[`${p.id} → ${f.id}`] = near(f);
}
console.log(JSON.stringify(trips));
