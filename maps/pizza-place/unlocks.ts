// Prices (#54): the Juice Bar's shape × 0.8 in Area 1, × 0.6 in Area 2, × 0.75 in Area 3.
import type { FreeStationDef, MapEvents, PadDef } from '../../src/sim/map';
import type { ProductId } from '../../catalog/products';
import type { ProducerTypeId } from '../../catalog/producers';

const shelf = (product: ProductId) => ({ kind: 'shelf', product }) as const;
const producer = (type: ProducerTypeId) => ({ kind: 'producer', type }) as const;
const stocker = { kind: 'stocker' } as const;

export const pads: Record<string, PadDef> = {
  // Area 1: tomato, sauce, flour, dough; two Stockers before Area 2
  register: { cost: 10, requires: [], unlocks: { kind: 'register', queueLength: 6 } },
  tomato_shelf: { cost: 10, requires: ['register'], unlocks: shelf('tomato') },
  tomato_bed: { cost: 20, requires: ['tomato_shelf'], unlocks: producer('tomato_bed') },
  sauce_shelf: { cost: 15, requires: ['tomato_bed'], unlocks: shelf('pizza_sauce') },
  sauce_pot: { cost: 25, requires: ['sauce_shelf'], unlocks: producer('sauce_pot') },
  office: { cost: 15, requires: ['sauce_pot'], unlocks: { kind: 'office' } },
  flour_shelf: { cost: 20, requires: ['office'], unlocks: shelf('flour') },
  wheat_field: { cost: 25, requires: ['flour_shelf'], unlocks: producer('wheat_field') },
  mill: { cost: 30, requires: ['wheat_field'], unlocks: producer('mill') },
  cashier_1: { cost: 20, requires: ['mill'], unlocks: { kind: 'cashier', register: 'register' } },
  stocker_1: { cost: 95, requires: ['cashier_1'], unlocks: stocker },
  dough_shelf: { cost: 40, requires: ['stocker_1'], unlocks: shelf('dough') },
  cow_pen: { cost: 50, requires: ['dough_shelf'], unlocks: producer('cow_pen') },
  dough_mixer: { cost: 60, requires: ['cow_pen'], unlocks: producer('dough_mixer') },
  stocker_2: { cost: 120, requires: ['dough_mixer'], unlocks: stocker },
  area_2: { cost: 120, requires: ['dough_mixer', 'stocker_2'], unlocks: { kind: 'area', area: 'area_2' } },
  // Area 2: cheese, both pizzas, olives; every Producer type is bought by its end
  cheese_press: { cost: 90, requires: ['area_2'], unlocks: producer('cheese_press') },
  pizza_shelf: { cost: 105, requires: ['cheese_press'], unlocks: shelf('pizza') },
  pizza_oven: { cost: 150, requires: ['pizza_shelf'], unlocks: producer('pizza_oven') },
  olive_shelf: { cost: 120, requires: ['pizza_oven'], unlocks: shelf('olives') },
  olive_tree: { cost: 135, requires: ['olive_shelf'], unlocks: producer('olive_tree') },
  veggie_pizza_shelf: { cost: 150, requires: ['olive_tree'], unlocks: shelf('veggie_pizza') },
  veggie_pizza_oven: { cost: 195, requires: ['veggie_pizza_shelf'], unlocks: producer('veggie_pizza_oven') },
  register_2: { cost: 240, requires: ['veggie_pizza_oven'], unlocks: { kind: 'register', queueLength: 6 } },
  cashier_2: { cost: 300, requires: ['register_2'], unlocks: { kind: 'cashier', register: 'register_2' } },
  area_3: { cost: 960, requires: ['veggie_pizza_oven'], unlocks: { kind: 'area', area: 'area_3' } },
  // Area 3: speed only, a second of every Producer, Register 3, Stockers 5–8
  tomato_bed_3: { cost: 300, requires: ['area_3'], unlocks: producer('tomato_bed') },
  wheat_field_3: { cost: 340, requires: ['area_3'], unlocks: producer('wheat_field') },
  cow_3: { cost: 375, requires: ['area_3'], unlocks: producer('cow_pen') },
  sauce_pot_2: { cost: 375, requires: ['area_3'], unlocks: producer('sauce_pot') },
  cheese_press_2: { cost: 410, requires: ['area_3'], unlocks: producer('cheese_press') },
  olive_tree_2: { cost: 410, requires: ['area_3'], unlocks: producer('olive_tree') },
  dough_mixer_2: { cost: 525, requires: ['cow_3', 'wheat_field_3'], unlocks: producer('dough_mixer') },
  pizza_oven_2: { cost: 750, requires: ['cheese_press_2', 'dough_mixer_2'], unlocks: producer('pizza_oven') },
  veggie_pizza_oven_2: {
    cost: 750,
    requires: ['olive_tree_2', 'sauce_pot_2'],
    unlocks: producer('veggie_pizza_oven'),
  },
  register_3: { cost: 525, requires: ['area_3'], unlocks: { kind: 'register', queueLength: 6 } },
  cashier_3: { cost: 600, requires: ['register_3'], unlocks: { kind: 'cashier', register: 'register_3' } },
  exit: { cost: 1690, requires: ['pizza_oven_2', 'veggie_pizza_oven_2'], unlocks: { kind: 'exit' } },
  // second Producers and Shelves (optional leaves), Stockers 3–8 and the Cleaner
  tomato_bed_2: { cost: 25, requires: ['sauce_pot'], unlocks: producer('tomato_bed') },
  wheat_field_2: { cost: 50, requires: ['dough_mixer'], unlocks: producer('wheat_field') },
  cow_2: { cost: 120, requires: ['cheese_press'], unlocks: producer('cow_pen') },
  tomato_shelf_2: { cost: 15, requires: ['tomato_bed_2'], unlocks: shelf('tomato') },
  sauce_shelf_2: { cost: 30, requires: ['sauce_pot'], unlocks: shelf('pizza_sauce') },
  flour_shelf_2: { cost: 30, requires: ['mill'], unlocks: shelf('flour') },
  dough_shelf_2: { cost: 65, requires: ['dough_mixer'], unlocks: shelf('dough') },
  olive_shelf_2: { cost: 150, requires: ['olive_tree'], unlocks: shelf('olives') },
  pizza_shelf_2: { cost: 180, requires: ['pizza_oven'], unlocks: shelf('pizza') },
  veggie_pizza_shelf_2: { cost: 210, requires: ['veggie_pizza_oven'], unlocks: shelf('veggie_pizza') },
  pizza_shelf_3: { cost: 675, requires: ['pizza_oven_2'], unlocks: shelf('pizza') },
  veggie_pizza_shelf_3: { cost: 675, requires: ['veggie_pizza_oven_2'], unlocks: shelf('veggie_pizza') },
  stocker_3: { cost: 180, requires: ['pizza_oven'], unlocks: stocker },
  stocker_4: { cost: 240, requires: ['veggie_pizza_oven'], unlocks: stocker },
  stocker_5: { cost: 600, requires: ['area_3'], unlocks: stocker },
  stocker_6: { cost: 675, requires: ['dough_mixer_2'], unlocks: stocker },
  stocker_7: { cost: 825, requires: ['pizza_oven_2'], unlocks: stocker },
  stocker_8: { cost: 975, requires: ['stocker_7'], unlocks: stocker },
  cleaner: { cost: 360, requires: ['pizza_oven'], unlocks: { kind: 'cleaner' } },
};

export const freeStations: Record<string, FreeStationDef> = {
  trash: { requires: [], unlocks: { kind: 'trash' } },
  trash_2: { requires: ['area_2'], unlocks: { kind: 'trash' } },
  trash_3: { requires: ['area_3'], unlocks: { kind: 'trash' } },
  mop_stand: { requires: [], unlocks: { kind: 'mopStand' } },
};

export const start = { owned: ['area_1'], money: 50 };

export const movePrices = [40, 60, 90, 150, 200, 275, 400, 525, 650];

// Robbery is the twist (every 2–4 min); Deliveries at the defaults, the Inspector every 10–15 min (#40). Amounts: the Juice Bar's.
export const events: MapEvents = {
  timing: {
    robberyGap: [120, 240],
    inspectorGap: [600, 900],
  },
  delivery: { requires: [] },
  robbery: {
    requires: [],
    byArea: {
      area_1: { bounty: 15, cashOver: 60 },
      area_2: { bounty: 40, cashOver: 150 },
      area_3: { bounty: 120, cashOver: 400 },
    },
  },
  inspector: {
    requires: [],
    byArea: {
      area_1: { reward: [40, 80], perDirt: 10, review: 60 },
      area_2: { reward: [100, 200], perDirt: 20, review: 150 },
      area_3: { reward: [300, 600], perDirt: 60, review: 450 },
    },
  },
};
