// Prices: the Dairy Farm price table (#50), measured with the CI bot.
import type { FreeStationDef, MapEvents, PadDef } from '../../src/sim/map';
import type { ProductId } from '../../catalog/products';
import type { ProducerTypeId } from '../../catalog/producers';

const shelf = (product: ProductId) => ({ kind: 'shelf', product }) as const;
const producer = (type: ProducerTypeId) => ({ kind: 'producer', type }) as const;

export const pads: Record<string, PadDef> = {
  register: { cost: 10, requires: [], unlocks: { kind: 'register', queueLength: 6 } },
  wheat_shelf: { cost: 15, requires: ['register'], unlocks: shelf('wheat') },
  wheat_field: { cost: 25, requires: ['wheat_shelf'], unlocks: producer('wheat_field') },
  milk_fridge: { cost: 15, requires: ['wheat_field'], unlocks: shelf('milk') },
  cow_pen: { cost: 25, requires: ['milk_fridge'], unlocks: producer('cow_pen') },
  office: { cost: 20, requires: ['cow_pen'], unlocks: { kind: 'office' } },
  butter_shelf: { cost: 25, requires: ['office'], unlocks: shelf('butter') },
  butter_churn: { cost: 30, requires: ['butter_shelf'], unlocks: producer('butter_churn') },
  cashier_1: { cost: 25, requires: ['butter_churn'], unlocks: { kind: 'cashier', register: 'register' } },
  wheat_field_2: { cost: 25, requires: ['butter_churn'], unlocks: producer('wheat_field') },
  area_2: { cost: 175, requires: ['cashier_1'], unlocks: { kind: 'area', area: 'area_2' } },
  stocker_1: { cost: 225, requires: ['area_2'], unlocks: { kind: 'stocker' } },
  goat_milk_fridge: { cost: 80, requires: ['stocker_1'], unlocks: shelf('goat_milk') },
  goat_pen: { cost: 100, requires: ['goat_milk_fridge'], unlocks: producer('goat_pen') },
  cheese_shelf: { cost: 150, requires: ['goat_pen'], unlocks: shelf('cheese') },
  cheese_press: { cost: 200, requires: ['cheese_shelf'], unlocks: producer('cheese_press') },
  goat_cheese_shelf: { cost: 200, requires: ['cheese_press'], unlocks: shelf('goat_cheese') },
  goat_cheese_press: { cost: 275, requires: ['goat_cheese_shelf'], unlocks: producer('goat_cheese_press') },
  cow_2: { cost: 200, requires: ['cheese_press'], unlocks: producer('cow_pen') },
  area_3: { cost: 1300, requires: ['goat_cheese_press'], unlocks: { kind: 'area', area: 'area_3' } },
  // the west wing: a third Register, second presses, third cheese Shelves and two more Stockers
  cheese_press_2: { cost: 225, requires: ['cow_2'], unlocks: producer('cheese_press') },
  goat_cheese_press_2: { cost: 275, requires: ['goat_cheese_press'], unlocks: producer('goat_cheese_press') },
  register_3: { cost: 375, requires: ['goat_cheese_press'], unlocks: { kind: 'register', queueLength: 6 } },
  cashier_3: { cost: 450, requires: ['register_3'], unlocks: { kind: 'cashier', register: 'register_3' } },
  cheese_shelf_3: { cost: 200, requires: ['cheese_press_2'], unlocks: shelf('cheese') },
  goat_cheese_shelf_3: { cost: 250, requires: ['goat_cheese_press_2'], unlocks: shelf('goat_cheese') },
  stocker_8: { cost: 225, requires: ['register_3'], unlocks: { kind: 'stocker' } },
  stocker_9: { cost: 250, requires: ['stocker_8'], unlocks: { kind: 'stocker' } },
  strawberry_shelf: { cost: 300, requires: ['area_3'], unlocks: shelf('strawberry') },
  strawberry_patch: { cost: 350, requires: ['strawberry_shelf'], unlocks: producer('strawberry_patch') },
  ice_cream_shelf: { cost: 400, requires: ['strawberry_patch'], unlocks: shelf('ice_cream') },
  ice_cream_maker: { cost: 600, requires: ['ice_cream_shelf'], unlocks: producer('ice_cream_maker') },
  egg_shelf: { cost: 450, requires: ['ice_cream_maker'], unlocks: shelf('egg') },
  chicken_coop: { cost: 500, requires: ['egg_shelf'], unlocks: producer('chicken_coop') },
  pudding_shelf: { cost: 500, requires: ['chicken_coop'], unlocks: shelf('pudding') },
  pudding_pot: { cost: 700, requires: ['pudding_shelf'], unlocks: producer('pudding_pot') },
  register_2: {
    cost: 600,
    requires: ['pudding_pot'],
    unlocks: { kind: 'register', queueLength: 6, cashPileFlipped: true },
  },
  cashier_2: { cost: 750, requires: ['register_2'], unlocks: { kind: 'cashier', register: 'register_2' } },
  wheat_field_3: { cost: 750, requires: ['pudding_pot'], unlocks: producer('wheat_field') },
  cow_3: { cost: 750, requires: ['pudding_pot'], unlocks: producer('cow_pen') },
  chicken_2: { cost: 750, requires: ['pudding_pot'], unlocks: producer('chicken_coop') },
  ice_cream_maker_2: { cost: 1100, requires: ['cow_3'], unlocks: producer('ice_cream_maker') },
  pudding_pot_2: { cost: 1100, requires: ['chicken_2', 'wheat_field_3'], unlocks: producer('pudding_pot') },
  exit: { cost: 2250, requires: ['ice_cream_maker_2', 'pudding_pot_2'], unlocks: { kind: 'exit' } },
  // second Shelves (optional leaves), Stockers and the Cleaner
  wheat_shelf_2: { cost: 20, requires: ['wheat_field_2'], unlocks: shelf('wheat') },
  milk_fridge_2: { cost: 25, requires: ['cow_pen'], unlocks: shelf('milk') },
  butter_shelf_2: { cost: 60, requires: ['butter_churn'], unlocks: shelf('butter') },
  goat_milk_fridge_2: { cost: 150, requires: ['goat_pen'], unlocks: shelf('goat_milk') },
  cheese_shelf_2: { cost: 225, requires: ['cheese_press'], unlocks: shelf('cheese') },
  goat_cheese_shelf_2: { cost: 275, requires: ['goat_cheese_press'], unlocks: shelf('goat_cheese') },
  strawberry_shelf_2: { cost: 500, requires: ['ice_cream_maker'], unlocks: shelf('strawberry') },
  ice_cream_shelf_2: { cost: 900, requires: ['ice_cream_maker_2'], unlocks: shelf('ice_cream') },
  egg_shelf_2: { cost: 600, requires: ['chicken_coop'], unlocks: shelf('egg') },
  pudding_shelf_2: { cost: 1100, requires: ['pudding_pot_2'], unlocks: shelf('pudding') },
  stocker_3: { cost: 225, requires: ['goat_pen'], unlocks: { kind: 'stocker' } },
  stocker_4: { cost: 250, requires: ['cheese_press'], unlocks: { kind: 'stocker' } },
  cleaner: { cost: 600, requires: ['cheese_press'], unlocks: { kind: 'cleaner' } },
  stocker_5: { cost: 900, requires: ['ice_cream_maker'], unlocks: { kind: 'stocker' } },
  stocker_2: { cost: 900, requires: ['cow_3'], unlocks: { kind: 'stocker' } },
  stocker_6: { cost: 1100, requires: ['pudding_pot_2'], unlocks: { kind: 'stocker' } },
  stocker_7: { cost: 1300, requires: ['stocker_6'], unlocks: { kind: 'stocker' } },
};

export const freeStations: Record<string, FreeStationDef> = {
  trash: { requires: [], unlocks: { kind: 'trash' } },
  trash_2: { requires: ['area_2'], unlocks: { kind: 'trash' } },
  trash_3: { requires: ['area_3'], unlocks: { kind: 'trash' } },
  mop_stand: { requires: [], unlocks: { kind: 'mopStand' } },
};

export const start = { owned: ['area_1'], money: 50 };

export const movePrices = [40, 60, 90, 150, 200, 275, 400, 525, 650];

// #40: every Event from the first Opening; the Inspector comes every 2–4 min here (gap applied once per-Map timing is built).
export const events: MapEvents = {
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
