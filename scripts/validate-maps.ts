// CI gate: every map must validate. `--record` adds the current ids to maps/released-ids.json (run before a release).
import { readFileSync, writeFileSync } from 'node:fs';
import { isTutorialMap, MAPS } from '../maps';
import { ASSETS } from '../catalog/assets';
import { releasableIds, validateMap, type ReleasedIds } from '../src/sim/validate';

const FILE = 'maps/released-ids.json';
const released: Record<string, ReleasedIds> = JSON.parse(readFileSync(FILE, 'utf8'));

if (process.argv.includes('--record')) {
  for (const map of MAPS) {
    const ids = released[map.id] ?? { released: [], retired: [] };
    ids.released = [...new Set([...ids.released, ...releasableIds(map)])].sort();
    released[map.id] = ids;
  }
  writeFileSync(FILE, JSON.stringify(released, null, 2) + '\n');
}

let problems = 0;
for (const map of MAPS) {
  for (const p of validateMap(map, ASSETS, released[map.id])) {
    console.error(`${map.id} › ${p.id}: ${p.message}`);
    problems++;
  }
  // released Maps only: a generated Daily Map has no Speedrun Board
  const floor = map.speedrunFloorTicks ?? 0;
  if (!isTutorialMap(map) && !(Number.isInteger(floor) && floor > 0)) {
    console.error(`${map.id}: needs a whole positive speedrunFloorTicks (half the bot's time, npm run bot)`);
    problems++;
  }
}
console.log(problems ? `${problems} problem(s)` : `${MAPS.length} map(s) valid`);
process.exit(problems ? 1 : 0);
