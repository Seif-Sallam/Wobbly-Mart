// The stack icon (crate, tomato, egg): sits on the logo's "M", and on a sky square it is the app icon.
import { PALETTE, SHADES } from '../palette';

const { ink, wood, money, cream, sky } = PALETTE;

/** Icon shapes in a 100×100 box, no background. */
export const STACK_SHAPES = `
<g stroke="${ink}" stroke-width="5" stroke-linejoin="round">
  <g transform="rotate(-8 50 74)">
    <rect x="22" y="58" width="56" height="34" rx="6" fill="${wood}"/>
    <path d="M24 70 H76 M24 81 H76" stroke-width="3.5" fill="none"/>
  </g>
  <g transform="rotate(10 52 46)">
    <circle cx="52" cy="46" r="17" fill="${SHADES.splat.tomato}"/>
    <path d="M44 30 q8 -6 16 0 q-8 6 -16 0z" fill="${money}" stroke-width="3.5"/>
  </g>
  <ellipse cx="46" cy="17" rx="11" ry="14" fill="${cream}" transform="rotate(-14 46 17)"/>
</g>`;

export const appIconSvg = (): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${sky}"/><g transform="translate(9 7) scale(0.82)">${STACK_SHAPES}</g></svg>`;
