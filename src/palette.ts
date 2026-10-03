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

export const DERIVED = { dirtDark: ['dirt', 0.75], woodDark: ['wood', 0.75] } as const;

export const LIGHT = { sun: '#ffcf8a', sunIntensity: 3.0, hemiIntensity: 0.9, shadowRadius: 3, exposure: 1 };

export function applyCssPalette(root: HTMLElement): void {
  for (const [k, v] of Object.entries(PALETTE)) root.style.setProperty(`--${k}`, v);
}
