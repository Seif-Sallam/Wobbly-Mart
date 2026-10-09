// The one asset table: every model name maps or composes here. Paths are GLBs under public/models (no extension).

export interface AssetDef {
  /** GLB path under public/models without `.glb`; absent = built in code from other assets. */
  path?: string;
  /** Scale so the model is this tall (m)… */
  height?: number;
  /** …or so its footprint fills the placement box (default when neither is set). */
  fill?: boolean;
  /** Multiplies the model's colours. */
  tint?: string;
  /** Extra yaw (deg) so the model's front faces +z at rotation 0. */
  yaw?: number;
}

import { SHADES } from '../src/palette';

/** Base Item height (m); per-Product ratios below. */
export const ITEM_SIZE = 0.544;
const ITEM = ITEM_SIZE;

export const ASSETS: Record<string, AssetDef> = {
  // characters
  player: { path: 'chars/character-male-a', height: 1.25 },
  'customer-a': { path: 'chars/character-female-a', height: 1.2 },
  'customer-b': { path: 'chars/character-female-b', height: 1.2 },
  'customer-c': { path: 'chars/character-female-c', height: 1.2 },
  'customer-d': { path: 'chars/character-female-d', height: 1.2 },
  'customer-e': { path: 'chars/character-male-b', height: 1.2 },
  'customer-f': { path: 'chars/character-male-c', height: 1.2 },
  'customer-g': { path: 'chars/character-male-d', height: 1.2 },
  'customer-h': { path: 'chars/character-male-f', height: 1.2 },
  employee: { path: 'market/character-employee', height: 1.2 },

  // items
  tomato: { path: 'food/tomato', height: ITEM },
  egg: { path: 'food/egg', height: ITEM },
  ketchup: { path: 'food/bottle-ketchup', height: ITEM * 1.25 },
  milk: { path: 'food/carton', height: ITEM * 1.2 },
  bread: { path: 'food/loaf', height: ITEM * 0.85 },
  flour: { path: 'food/bag', height: ITEM * 1.2, tint: SHADES.flourBag },
  wheat: {},
  coin: { path: 'platformer/coin-gold', height: 0.35 },

  // shelves: code-built stands
  'tomato-stand': {},
  'egg-stand': {},
  'ketchup-stand': {},
  'wheat-stand': {},
  'milk-stand': {},
  'flour-stand': {},
  'bread-stand': {},

  // Station composites and their parts
  register: {},
  'kitchen-bar': { path: 'furn/kitchenBar' },
  'cash-register': { path: 'market/cash-register', height: 0.45 },
  'shopping-basket': { path: 'market/shopping-basket' },
  office: {},
  desk: { path: 'furn/desk' },
  'chair-desk': { path: 'furn/chairDesk', height: 0.9 },
  'computer-screen': { path: 'furn/computerScreen', height: 0.45 },
  trash: { path: 'furn/trashcan', height: 0.95 },
  'mop-stand': {},
  exit: {},
  van: { path: 'car/delivery', yaw: 90 },
  'tomato-bed': {},
  'wheat-field': {},
  'chicken-coop': {},
  'cow-pen': {},
  blender: {},
  mill: {},
  oven: {},
  'wheat-plant': { path: 'nature/crops_wheatStageB', height: 0.9 },
  'wheat-sprout': { path: 'nature/crops_wheatStageA', height: 0.5 },
  'tomato-bush': { path: 'nature/plant_bush', height: 0.55 },
  chick: { path: 'pets/animal-chick', height: 0.45 },
  cow: { path: 'pets/animal-cow', height: 1.1 },
  'fence-post': { path: 'nature/fence_simple' },
  planks: { path: 'town/planks' },
  roof: { path: 'town/roof-high' },
  'wall-wood': { path: 'town/wall-wood' },
  'kitchen-blender': { path: 'furn/kitchenBlender', height: 0.8 },
  rope: { path: 'market/fence' },
  'market-wall': { path: 'market/wall' },
  'market-window': { path: 'market/wall-window' },

  // props
  bookshelf: { path: 'furn/bookcaseOpen' },
  sofa: { path: 'furn/loungeSofa' },
  rug: { path: 'furn/rugRectangle' },
  plant: { path: 'furn/pottedPlant', height: 1.1 },
  cooler: { path: 'furn/kitchenFridgeSmall', height: 1.2 },
  table: { path: 'furn/table' },
  tree: { path: 'nature/tree_default', height: 3.6 },
  'tree-oak': { path: 'nature/tree_oak', height: 4.2 },
  bush: { path: 'nature/plant_bushLarge', height: 1 },
  flower: { path: 'nature/flower_yellowA', height: 0.4 },
  'banner-red': { path: 'town/banner-red', height: 2.2 },
  'banner-green': { path: 'town/banner-green', height: 2.2 },
  flag: { path: 'platformer/flag', height: 1.8 },
};

/** Untextured Kenney materials (Nature, Furniture, Fantasy Town) by name → palette colour. */
export const MATERIAL_PALETTE: Record<string, string> = {
  grass: 'leaf',
  leafsGreen: 'leaf',
  leafsDark: 'leaf',
  dirt: 'dirt',
  dirtDark: 'dirtDark',
  wood: 'wood',
  woodBark: 'wood',
  woodDark: 'woodDark',
};
