import type { MapDef } from '../../src/sim/map';
import { PRODUCTS } from '../../catalog/products';
import { PRODUCERS } from '../../catalog/producers';
import { pick } from '../../catalog/pick';
import { layout } from './layout';
import { events, freeStations, movePrices, pads, start } from './unlocks';
import { upgrades } from './upgrades';
import { tutorial } from './tutorial';
import { objectives } from './objectives';

export const pizzaPlace: MapDef = {
  id: 'pizza-place',
  name: 'Pizza Place',
  layout,
  products: pick(PRODUCTS, [
    'tomato',
    'pizza_sauce',
    'wheat',
    'flour',
    'milk',
    'dough',
    'cheese',
    'olives',
    'pizza',
    'veggie_pizza',
  ]),
  producers: pick(PRODUCERS, [
    'tomato_bed',
    'sauce_pot',
    'wheat_field',
    'mill',
    'cow_pen',
    'dough_mixer',
    'cheese_press',
    'olive_tree',
    'pizza_oven',
    'veggie_pizza_oven',
  ]),
  pads,
  freeStations,
  upgrades,
  start,
  tutorial,
  objectives,
  movePrices,
  events,
};
