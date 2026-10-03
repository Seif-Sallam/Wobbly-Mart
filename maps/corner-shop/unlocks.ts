import type { FreeStationDef, PadDef } from '../../src/sim/map';
import type { ProductId } from '../../catalog/products';
import type { ProducerTypeId } from '../../catalog/producers';

const shelf = (product: ProductId) => ({ kind: 'shelf', product }) as const;
const producer = (type: ProducerTypeId) => ({ kind: 'producer', type }) as const;

// Costs and requirements from the price table (.scratch/my-mini-mart-web/price-table/price-table.md).
export const pads: Record<string, PadDef> = {
  register: { cost: 10, requires: [], unlocks: { kind: 'register', queueLength: 6 } },
  tomato_shelf: { cost: 15, requires: ['register'], unlocks: shelf('tomato') },
  tomato_bed: { cost: 25, requires: ['tomato_shelf'], unlocks: producer('tomato_bed') },
  egg_shelf: { cost: 20, requires: ['tomato_bed'], unlocks: shelf('egg') },
  chicken_coop: { cost: 25, requires: ['egg_shelf'], unlocks: producer('chicken_coop') },
  office: { cost: 35, requires: ['chicken_coop'], unlocks: { kind: 'office' } },
  ketchup_shelf: { cost: 40, requires: ['office'], unlocks: shelf('ketchup') },
  blender: { cost: 40, requires: ['ketchup_shelf'], unlocks: producer('blender') },
  cashier_1: { cost: 45, requires: ['blender'], unlocks: { kind: 'cashier', register: 'register' } },
  chicken_2: { cost: 40, requires: ['blender'], unlocks: producer('chicken_coop') },
  tomato_plots: { cost: 35, requires: ['blender'], unlocks: producer('tomato_bed') },
  area_2: { cost: 150, requires: ['cashier_1'], unlocks: { kind: 'area', area: 'area_2' } },
  stocker_1: { cost: 200, requires: ['area_2'], unlocks: { kind: 'stocker' } },
  wheat_shelf: { cost: 60, requires: ['stocker_1'], unlocks: shelf('wheat') },
  wheat_field: { cost: 80, requires: ['wheat_shelf'], unlocks: producer('wheat_field') },
  milk_fridge: { cost: 100, requires: ['wheat_field'], unlocks: shelf('milk') },
  cow_pen: { cost: 125, requires: ['milk_fridge'], unlocks: producer('cow_pen') },
  flour_shelf: { cost: 125, requires: ['cow_pen'], unlocks: shelf('flour') },
  mill: { cost: 150, requires: ['flour_shelf'], unlocks: producer('mill') },
  wheat_plots: { cost: 150, requires: ['mill'], unlocks: producer('wheat_field') },
  cow_2: { cost: 175, requires: ['mill'], unlocks: producer('cow_pen') },
  area_3: { cost: 1050, requires: ['mill'], unlocks: { kind: 'area', area: 'area_3' } },
  bread_shelf: { cost: 425, requires: ['area_3'], unlocks: shelf('bread') },
  oven: { cost: 625, requires: ['bread_shelf'], unlocks: producer('oven') },
  register_2: { cost: 550, requires: ['oven'], unlocks: { kind: 'register', queueLength: 6 } },
  cashier_2: { cost: 700, requires: ['register_2'], unlocks: { kind: 'cashier', register: 'register_2' } },
  stocker_2: { cost: 850, requires: ['oven'], unlocks: { kind: 'stocker' } },
  blender_2: { cost: 500, requires: ['oven'], unlocks: producer('blender') },
  mill_2: { cost: 700, requires: ['oven'], unlocks: producer('mill') },
  oven_2: { cost: 1050, requires: ['mill_2', 'blender_2'], unlocks: producer('oven') },
  exit: { cost: 2100, requires: ['oven_2'], unlocks: { kind: 'exit' } },
};

export const freeStations: Record<string, FreeStationDef> = {
  trash: { requires: ['area_2'], unlocks: { kind: 'trash' } },
};

export const start = { owned: ['area_1'], money: 50 };
