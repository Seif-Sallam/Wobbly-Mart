import type { MapDef } from '../../src/sim/map';
import { PRODUCTS } from '../../catalog/products';
import { PRODUCERS } from '../../catalog/producers';
import { pick } from '../../catalog/pick';
import { layout } from './layout';
import { events, freeStations, movePrices, pads, start } from './unlocks';
import { upgrades } from './upgrades';
import { objectives } from './objectives';

export const tutorialMap: MapDef = {
  id: 'tutorial',
  name: 'Tutorial',
  layout,
  products: pick(PRODUCTS, ['tomato', 'egg', 'ketchup']),
  producers: pick(PRODUCERS, ['tomato_bed', 'chicken_coop', 'blender']),
  pads,
  freeStations,
  upgrades,
  start,
  tutorial: [],
  objectives,
  challenges: false,
  movePrices,
  events,
};
