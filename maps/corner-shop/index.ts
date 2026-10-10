import type { MapDef } from '../../src/sim/map';
import { PRODUCTS } from '../../catalog/products';
import { PRODUCERS } from '../../catalog/producers';
import { pick } from '../../catalog/pick';
import { layout } from './layout';
import { events, freeStations, movePrices, pads, start } from './unlocks';
import { upgrades } from './upgrades';
import { tutorial } from './tutorial';

export const cornerShop: MapDef = {
  id: 'corner-shop',
  name: 'Corner shop',
  layout,
  products: pick(PRODUCTS, ['tomato', 'egg', 'ketchup', 'wheat', 'milk', 'flour', 'bread']),
  producers: pick(PRODUCERS, ['tomato_bed', 'chicken_coop', 'blender', 'wheat_field', 'cow_pen', 'mill', 'oven']),
  pads,
  freeStations,
  upgrades,
  start,
  tutorial,
  movePrices,
  events,
};
