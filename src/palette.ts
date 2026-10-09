// "Golden Storybook" — the one source of colour for 3D materials and CSS variables.
export const PALETTE = {
  sky: '#7ec8e3',
  grass: '#a3c94a',
  leaf: '#5e9e3a',
  path: '#e8c48a',
  dirt: '#9c5b3a',
  road: '#5d5a63',
  wood: '#c17a43',
  ink: '#3a2416',
  cream: '#fff1d0',
  pad: '#ffe066',
  money: '#2f9e4f',
  orange: '#f26b1d',
} as const;

export type PaletteName = keyof typeof PALETTE;

/** Supporting colours: splats, effects, tints. Kept here so every colour lives in one file. */
export const SHADES = {
  white: '#ffffff',
  angry: '#d63c2f',
  warn: '#f5c518',
  glass: '#bfe6f2',
  glow: '#ff7a1a',
  wheat: '#e8b84a',
  wheatHead: '#f2cc63',
  flourBag: '#fff8ec',
  steam: '#e8e8e8',
  thumbGround: '#b9a77f',
  floor: { light: '#ece3d4', dark: '#c2b6ab', grout: '#b3a79c' },
  splat: {
    tomato: '#d63c2f',
    egg: '#ffd54a',
    ketchup: '#b3261e',
    wheat: '#e8b84a',
    milk: '#ffffff',
    flour: '#f4ead8',
    bread: '#c98b4a',
  } as Record<string, string>,
  /** Stocker caps by role; the Office role chips match. */
  roleCaps: { auto: '#e0453a', goods: '#8e5cc4', machines: '#3f7fd6' },
  /** Cleaning fixtures: janitor cart, its posts and spray bottle, WET sign, mop clamp, clean ring, stink, pedal bin. */
  cleaning: {
    cart: '#3d7fd6',
    metal: '#9aa3ad',
    spray: '#2bb3a3',
    sign: '#f2c230',
    ring: '#7fc7e8',
    stink: '#7fae3a',
    bin: '#e86aa6',
  },
  cleanerCap: '#f2c230',
  customerTints: ['#ffffff', '#ffe3d6', '#e3f0ff', '#f0ffe3', '#fff4d6', '#f3e3ff'],
} as const;

/** `#rrggbb` + alpha → rgba() for canvas drawing. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const DERIVED = { dirtDark: ['dirt', 0.75], woodDark: ['wood', 0.75] } as const;

export const LIGHT = { sun: '#ffcf8a', sunIntensity: 3.0, hemiIntensity: 0.9, shadowRadius: 3, exposure: 1 };

export function applyCssPalette(root: HTMLElement): void {
  for (const [k, v] of Object.entries(PALETTE)) root.style.setProperty(`--${k}`, v);
  root.style.setProperty('--angry', SHADES.angry);
  for (const [k, v] of Object.entries(SHADES.roleCaps)) root.style.setProperty(`--role-${k}`, v);
}
