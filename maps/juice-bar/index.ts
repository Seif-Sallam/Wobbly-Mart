import type { MapDef } from '../../src/sim/map';
import { PRODUCTS } from '../../catalog/products';
import { PRODUCERS } from '../../catalog/producers';
import { pick } from '../../catalog/pick';
import { layout } from './layout';
import { events, freeStations, movePrices, pads, start } from './unlocks';
import { upgrades } from './upgrades';
import { tutorial } from './tutorial';

export const juiceBar: MapDef = {
  id: 'juice-bar',
  name: 'Juice Bar',
  layout,
  products: pick(PRODUCTS, [
    'apple',
    'orange',
    'apple_juice',
    'orange_juice',
    'sugar_cane',
    'sugar',
    'candy_apple',
    'strawberry',
    'milk',
    'smoothie',
  ]),
  producers: {
    ...pick(PRODUCERS, [
      'apple_tree',
      'orange_tree',
      'apple_press',
      'squeezer',
      'sugar_cane_field',
      'sugar_mill',
      'candy_pot',
      'strawberry_patch',
      'smoothie_blender',
    ]),
    cow_pen: { ...PRODUCERS.cow_pen, inputs: ['sugar_cane'] },
  },
  pads,
  freeStations,
  upgrades,
  start,
  tutorial,
  movePrices,
  events,
};
