import type { MapDef } from '../../src/sim/map';
import { PRODUCTS } from '../../catalog/products';
import { PRODUCERS } from '../../catalog/producers';
import { layout } from './layout';
import { freeStations, pads, start } from './unlocks';
import { upgrades } from './upgrades';
import { tutorial } from './tutorial';

export const cornerShop: MapDef = {
  id: 'corner-shop',
  name: 'Corner shop',
  layout,
  products: PRODUCTS,
  producers: PRODUCERS,
  pads,
  freeStations,
  upgrades,
  start,
  tutorial,
};
