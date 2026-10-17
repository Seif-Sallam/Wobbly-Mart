// PROTOTYPE (prototype/tutorial-layout): Pads chained in Lesson order so each Station shows up when its Lesson comes.
// Prices are placeholders; the real Tutorial hands over exactly the Money each Lesson needs.
import type { FreeStationDef, MapEvents, PadDef } from '../../src/sim/map';
import type { ProductId } from '../../catalog/products';
import type { ProducerTypeId } from '../../catalog/producers';

const shelf = (product: ProductId) => ({ kind: 'shelf', product }) as const;
const producer = (type: ProducerTypeId) => ({ kind: 'producer', type }) as const;

export const pads: Record<string, PadDef> = {
  // Lessons 2–3: owned from the start
  tomato_bed: { cost: 0, requires: [], unlocks: producer('tomato_bed') },
  tomato_shelf: { cost: 0, requires: [], unlocks: shelf('tomato') },
  register: { cost: 0, requires: [], unlocks: { kind: 'register', queueLength: 3 } },
  // Lesson 4–6
  egg_shelf: { cost: 10, requires: [], unlocks: shelf('egg') },
  chicken_coop: { cost: 15, requires: ['egg_shelf'], unlocks: producer('chicken_coop') },
  ketchup_shelf: { cost: 20, requires: ['chicken_coop'], unlocks: shelf('ketchup') },
  blender: { cost: 20, requires: ['ketchup_shelf'], unlocks: producer('blender') },
  // Lessons 8–10
  office: { cost: 20, requires: ['blender'], unlocks: { kind: 'office' } },
  cashier_1: { cost: 25, requires: ['office'], unlocks: { kind: 'cashier', register: 'register' } },
  stocker_1: { cost: 40, requires: ['cashier_1'], unlocks: { kind: 'stocker' } },
  // Lesson 13
  area_2: { cost: 30, requires: ['stocker_1'], unlocks: { kind: 'area', area: 'area_2' } },
  exit: { cost: 50, requires: ['area_2'], unlocks: { kind: 'exit' } },
};

export const freeStations: Record<string, FreeStationDef> = {
  trash: { requires: [], unlocks: { kind: 'trash' } },
  mop_stand: { requires: [], unlocks: { kind: 'mopStand' } },
};

export const start = { owned: ['area_1', 'tomato_bed', 'tomato_shelf', 'register'], money: 500 };

/** Moves are free on the Tutorial Map. */
export const movePrices = [0, 0, 0, 0, 0, 0];

export const events: MapEvents = {
  delivery: { requires: ['blender'] },
  robbery: { requires: ['stocker_1'], byArea: { area_1: { bounty: 10, cashOver: 30 } } },
  inspector: { requires: ['stocker_1'], byArea: { area_1: { reward: [20, 40], perDirt: 0, review: 0 } } },
};
