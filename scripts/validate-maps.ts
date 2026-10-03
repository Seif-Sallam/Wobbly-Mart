// CI gate: every map must validate. `--record` adds the current ids to maps/released-ids.json (run before a release).
import { readFileSync, writeFileSync } from 'node:fs';
import { MAPS } from '../maps';
import { ASSETS } from '../catalog/assets';
import { releasableIds, validateMap } from '../src/sim/validate';

const FILE = 'maps/released-ids.json';
const released: Record<string, string[]> = JSON.parse(readFileSync(FILE, 'utf8'));

if (process.argv.includes('--record')) {
  for (const map of MAPS) released[map.id] = [...new Set([...(released[map.id] ?? []), ...releasableIds(map)])].sort();
  writeFileSync(FILE, JSON.stringify(released, null, 2) + '\n');
}

let problems = 0;
for (const map of MAPS) {
  for (const p of validateMap(map, ASSETS, released[map.id] ?? [])) {
    console.error(`${map.id} › ${p.id}: ${p.message}`);
    problems++;
  }
}
console.log(problems ? `${problems} problem(s)` : `${MAPS.length} map(s) valid`);
process.exit(problems ? 1 : 0);
