import type { FreeStationDef, MapEvents, PadDef } from '../../src/sim/map';
import type { ProductId } from '../../catalog/products';
import type { ProducerTypeId } from '../../catalog/producers';

const shelf = (product: ProductId) => ({ kind: 'shelf', product }) as const;
const producer = (type: ProducerTypeId) => ({ kind: 'producer', type }) as const;

// Costs and requirements from the price table (.scratch/playtest-2/price-table/price-table.md).
export const pads: Record<string, PadDef> = {
  register: { cost: 10, requires: [], unlocks: { kind: 'register', queueLength: 6 } },
  tomato_shelf: { cost: 15, requires: ['register'], unlocks: shelf('tomato') },
  tomato_bed: { cost: 25, requires: ['tomato_shelf'], unlocks: producer('tomato_bed') },
  egg_shelf: { cost: 10, requires: ['tomato_bed'], unlocks: shelf('egg') },
  chicken_coop: { cost: 15, requires: ['egg_shelf'], unlocks: producer('chicken_coop') },
  office: { cost: 20, requires: ['chicken_coop'], unlocks: { kind: 'office' } },
  ketchup_shelf: { cost: 25, requires: ['office'], unlocks: shelf('ketchup') },
  blender: { cost: 25, requires: ['ketchup_shelf'], unlocks: producer('blender') },
  cashier_1: { cost: 25, requires: ['blender'], unlocks: { kind: 'cashier', register: 'register' } },
  chicken_2: { cost: 25, requires: ['blender'], unlocks: producer('chicken_coop') },
  tomato_plots: { cost: 20, requires: ['blender'], unlocks: producer('tomato_bed') },
  area_2: { cost: 125, requires: ['cashier_1'], unlocks: { kind: 'area', area: 'area_2' } },
  stocker_1: { cost: 175, requires: ['area_2'], unlocks: { kind: 'stocker' } },
  wheat_shelf: { cost: 50, requires: ['stocker_1'], unlocks: shelf('wheat') },
  wheat_field: { cost: 65, requires: ['wheat_shelf'], unlocks: producer('wheat_field') },
  milk_fridge: { cost: 80, requires: ['wheat_field'], unlocks: shelf('milk') },
  cow_pen: { cost: 100, requires: ['milk_fridge'], unlocks: producer('cow_pen') },
  flour_shelf: { cost: 100, requires: ['cow_pen'], unlocks: shelf('flour') },
  mill: { cost: 125, requires: ['flour_shelf'], unlocks: producer('mill') },
  wheat_plots: { cost: 125, requires: ['mill'], unlocks: producer('wheat_field') },
  cow_2: { cost: 150, requires: ['mill'], unlocks: producer('cow_pen') },
  area_3: { cost: 1100, requires: ['mill'], unlocks: { kind: 'area', area: 'area_3' } },
  bread_shelf: { cost: 450, requires: ['area_3'], unlocks: shelf('bread') },
  oven: { cost: 675, requires: ['bread_shelf'], unlocks: producer('oven') },
  register_2: { cost: 600, requires: ['oven'], unlocks: { kind: 'register', queueLength: 6, cashPileFlipped: true } },
  cashier_2: { cost: 750, requires: ['register_2'], unlocks: { kind: 'cashier', register: 'register_2' } },
  stocker_2: { cost: 900, requires: ['mill_2'], unlocks: { kind: 'stocker' } },
  blender_2: { cost: 525, requires: ['oven'], unlocks: producer('blender') },
  mill_2: { cost: 750, requires: ['oven'], unlocks: producer('mill') },
  chicken_3: { cost: 750, requires: ['oven'], unlocks: producer('chicken_coop') },
  oven_2: { cost: 1100, requires: ['mill_2', 'chicken_3'], unlocks: producer('oven') },
  exit: { cost: 2250, requires: ['oven_2'], unlocks: { kind: 'exit' } },
  // second Shelves (optional leaves), Stockers 3–6 and the Cleaner
  tomato_shelf_2: { cost: 20, requires: ['tomato_plots'], unlocks: shelf('tomato') },
  egg_shelf_2: { cost: 25, requires: ['chicken_2'], unlocks: shelf('egg') },
  ketchup_shelf_2: { cost: 525, requires: ['blender_2'], unlocks: shelf('ketchup') },
  wheat_shelf_2: { cost: 125, requires: ['wheat_plots'], unlocks: shelf('wheat') },
  milk_fridge_2: { cost: 150, requires: ['cow_2'], unlocks: shelf('milk') },
  flour_shelf_2: { cost: 750, requires: ['mill_2'], unlocks: shelf('flour') },
  bread_shelf_2: { cost: 1100, requires: ['oven_2'], unlocks: shelf('bread') },
  stocker_3: { cost: 175, requires: ['wheat_field'], unlocks: { kind: 'stocker' } },
  stocker_4: { cost: 200, requires: ['cow_pen'], unlocks: { kind: 'stocker' } },
  stocker_5: { cost: 900, requires: ['oven'], unlocks: { kind: 'stocker' } },
  stocker_6: { cost: 1100, requires: ['oven_2'], unlocks: { kind: 'stocker' } },
  cleaner: { cost: 900, requires: ['oven'], unlocks: { kind: 'cleaner' } },
};

export const freeStations: Record<string, FreeStationDef> = {
  trash: { requires: [], unlocks: { kind: 'trash' } },
  trash_2: { requires: ['area_2'], unlocks: { kind: 'trash' } },
  trash_3: { requires: ['area_3'], unlocks: { kind: 'trash' } },
  mop_stand: { requires: [], unlocks: { kind: 'mopStand' } },
};

export const start = { owned: ['area_1'], money: 50 };

export const movePrices = [40, 60, 90, 150, 200, 275, 400, 525, 650];

// Event amounts from the price table's Events section.
export const events: MapEvents = {
  delivery: { requires: ['tomato_shelf'] },
  robbery: {
    requires: ['area_2'],
    byArea: { area_2: { bounty: 40, cashOver: 150 }, area_3: { bounty: 120, cashOver: 400 } },
  },
  inspector: {
    requires: ['area_2'],
    byArea: {
      area_2: { reward: [100, 200], perDirt: 20, review: 150 },
      area_3: { reward: [300, 600], perDirt: 60, review: 450 },
    },
  },
};
