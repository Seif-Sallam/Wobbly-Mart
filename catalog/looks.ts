// The Player's Wardrobe: every Kenney mini-rig look. Each extra pack lives in its own `chars-<pack>` folder (own colormap).
import type { AssetDef } from './assets';

export interface Look {
  id: string;
  name: string;
  /** GLB path under public/models without `.glb`. */
  path: string;
  /** Fun looks wear no cap. */
  fun?: boolean;
  /** Also walks the shop as a Customer: its tile says so. */
  customer?: boolean;
  /** Cap fit [up, forward, size, tilt°] from the model's top; omitted = [0, 0, 1, 0]. */
  cap?: [number, number, number, number];
}

const fit = (up: number): [number, number, number, number] => [up, 0, 1, 0];

export const LOOKS: Look[] = [
  { id: 'male-a', name: 'Sam', path: 'chars/character-male-a' },
  { id: 'female-a', name: 'Ava', path: 'chars/character-female-a', customer: true, cap: fit(-0.155) },
  { id: 'female-b', name: 'Bea', path: 'chars/character-female-b', customer: true, cap: fit(-0.075) },
  { id: 'female-c', name: 'Cleo', path: 'chars/character-female-c', customer: true, cap: fit(-0.155) },
  { id: 'female-d', name: 'Dot', path: 'chars/character-female-d', customer: true, cap: fit(-0.17) },
  { id: 'female-e', name: 'Eve', path: 'chars/character-female-e', cap: fit(-0.075) },
  { id: 'female-f', name: 'Fay', path: 'chars/character-female-f', cap: fit(0.015) },
  { id: 'male-b', name: 'Ben', path: 'chars/character-male-b', customer: true },
  { id: 'male-c', name: 'Cal', path: 'chars/character-male-c', customer: true, cap: fit(-0.035) },
  { id: 'male-d', name: 'Dan', path: 'chars/character-male-d', customer: true, cap: fit(-0.075) },
  { id: 'male-e', name: 'Eli', path: 'chars/character-male-e' },
  { id: 'male-f', name: 'Finn', path: 'chars/character-male-f', customer: true },
  { id: 'gamer', name: 'Gamer', path: 'chars-arcade/character-gamer' },
  { id: 'arcade', name: 'Arcade kid', path: 'chars-arcade/character-employee', cap: fit(-0.095) },
  { id: 'skate-boy', name: 'Skater', path: 'chars-skate/character-skate-boy' },
  { id: 'skate-girl', name: 'Skater girl', path: 'chars-skate/character-skate-girl', cap: fit(-0.075) },
  { id: 'human', name: 'Adventurer', path: 'chars-dungeon/character-human', fun: true },
  { id: 'orc', name: 'Orc', path: 'chars-dungeon/character-orc', fun: true },
  { id: 'soldier', name: 'Soldier', path: 'chars-arena/character-soldier', fun: true },
  { id: 'archer', name: 'Archer', path: 'chars-forest/character-archer', fun: true },
];

export const DEFAULT_LOOK = 'male-a';

export const lookById = (id: string): Look => LOOKS.find((l) => l.id === id) ?? LOOKS[0];

/** Asset-table rows, one per look, named `look-<id>`. */
export const LOOK_ASSETS: Record<string, AssetDef> = Object.fromEntries(
  LOOKS.map((l) => [`look-${l.id}`, { path: l.path, height: 1.25, cap: l.cap }]),
);
