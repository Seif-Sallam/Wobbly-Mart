import type { MapDef } from '../../src/sim/map';
import { PRODUCTS } from '../../catalog/products';
import { PRODUCERS } from '../../catalog/producers';
import { pick } from '../../catalog/pick';
import { layout } from './layout';
import { events, freeStations, movePrices, pads, start } from './unlocks';
import { upgrades } from './upgrades';
import { tutorial } from './tutorial';

export const dairyFarm: MapDef = {
  id: 'dairy-farm',
  name: 'Dairy Farm',
  layout,
  products: {
    ...pick(PRODUCTS, [
      'wheat',
      'butter',
      'goat_milk',
      'cheese',
      'goat_cheese',
      'strawberry',
      'egg',
      'ice_cream',
      'pudding',
    ]),
    milk: { ...PRODUCTS.milk, breakChance: 0.5 },
  },
  producers: {
    ...pick(PRODUCERS, [
      'wheat_field',
      'cow_pen',
      'butter_churn',
      'goat_pen',
      'cheese_press',
      'goat_cheese_press',
      'strawberry_patch',
      'ice_cream_maker',
      'pudding_pot',
    ]),
    chicken_coop: { ...PRODUCERS.chicken_coop, inputs: ['wheat'] },
  },
  pads,
  freeStations,
  upgrades,
  start,
  tutorial,
  movePrices,
  events,
};
