import type { MapDef } from '../../src/sim/map';
import { PRODUCTS } from '../../catalog/products';
import { PRODUCERS } from '../../catalog/producers';
import { pick } from '../../catalog/pick';
import { layout } from './layout';
import { events, freeStations, movePrices, pads, start } from './unlocks';
import { upgrades } from './upgrades';
import { lessons } from './lessons';
import { objectives } from './objectives';

export const tutorialMap: MapDef = {
  id: 'tutorial',
  name: 'Tutorial',
  layout,
  products: pick(PRODUCTS, ['tomato', 'egg', 'ketchup']),
  // fast, so no Lesson waits on a timer
  producers: {
    tomato_bed: { ...PRODUCERS.tomato_bed, workTime: 2 },
    chicken_coop: { ...PRODUCERS.chicken_coop, workTime: 1.5 },
    blender: { ...PRODUCERS.blender, workTime: 1.5 },
  },
  pads,
  freeStations,
  upgrades,
  start,
  tutorial: [],
  lessons,
  objectives,
  challenges: false,
  movePrices,
  events,
};
