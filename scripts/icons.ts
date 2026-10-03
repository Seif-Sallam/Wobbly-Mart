// Offline: writes the favicon and Home Screen icons from the stack icon (src/ui/icon-svg.ts).
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { appIconSvg } from '../src/ui/icon-svg';

const svg = appIconSvg();
writeFileSync('public/icon.svg', svg);
for (const size of [180, 192, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/icon-${size}.png`, png);
}
console.log('icons written');
