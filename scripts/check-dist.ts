// CI gate: the layout editor is dev-only and must never ship.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['__editor/save', 'Layout editor'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const leaks = files('dist')
  .filter((f) => /\.(js|html|css)$/.test(f))
  .filter((f) => MARKERS.some((m) => readFileSync(f, 'utf8').includes(m)));
if (leaks.length) {
  console.error(`Editor code found in the build: ${leaks.join(', ')}`);
  process.exit(1);
}
console.log('No editor code in dist/');
