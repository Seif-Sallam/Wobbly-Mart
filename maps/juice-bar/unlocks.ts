// PROTOTYPE prices: placeholders shaped like the Corner Shop's; the Juice Bar economy price table sets the real ones.
import type { FreeStationDef, MapEvents, PadDef } from '../../src/sim/map';
import type { ProductId } from '../../catalog/products';
import type { ProducerTypeId } from '../../catalog/producers';

const shelf = (product: ProductId) => ({ kind: 'shelf', product }) as const;
const producer = (type: ProducerTypeId) => ({ kind: 'producer', type }) as const;

export const pads: Record<string, PadDef> = {
  register: { cost: 10, requires: [], unlocks: { kind: 'register', queueLength: 6 } },
  apple_shelf: { cost: 15, requires: ['register'], unlocks: shelf('apple') },
  apple_tree: { cost: 25, requires: ['apple_shelf'], unlocks: producer('apple_tree') },
  orange_shelf: { cost: 15, requires: ['apple_tree'], unlocks: shelf('orange') },
  orange_tree: { cost: 25, requires: ['orange_shelf'], unlocks: producer('orange_tree') },
  office: { cost: 20, requires: ['orange_tree'], unlocks: { kind: 'office' } },
  apple_juice_shelf: { cost: 25, requires: ['office'], unlocks: shelf('apple_juice') },
  apple_press: { cost: 30, requires: ['apple_juice_shelf'], unlocks: producer('apple_press') },
  cashier_1: { cost: 25, requires: ['apple_press'], unlocks: { kind: 'cashier', register: 'register' } },
  apple_tree_2: { cost: 25, requires: ['apple_press'], unlocks: producer('apple_tree') },
  orange_tree_2: { cost: 30, requires: ['apple_press'], unlocks: producer('orange_tree') },
  orange_juice_shelf: { cost: 40, requires: ['cashier_1'], unlocks: shelf('orange_juice') },
  squeezer: { cost: 50, requires: ['orange_juice_shelf'], unlocks: producer('squeezer') },
  area_2: { cost: 150, requires: ['squeezer'], unlocks: { kind: 'area', area: 'area_2' } },
  stocker_1: { cost: 175, requires: ['area_2'], unlocks: { kind: 'stocker' } },
  sugar_cane_field: { cost: 65, requires: ['stocker_1'], unlocks: producer('sugar_cane_field') },
  sugar_shelf: { cost: 80, requires: ['sugar_cane_field'], unlocks: shelf('sugar') },
  sugar_mill: { cost: 110, requires: ['sugar_shelf'], unlocks: producer('sugar_mill') },
  candy_apple_shelf: { cost: 120, requires: ['sugar_mill'], unlocks: shelf('candy_apple') },
  candy_pot: { cost: 150, requires: ['candy_apple_shelf'], unlocks: producer('candy_pot') },
  cane_field_2: { cost: 150, requires: ['candy_pot'], unlocks: producer('sugar_cane_field') },
  sugar_mill_2: { cost: 175, requires: ['cane_field_2'], unlocks: producer('sugar_mill') },
  candy_pot_2: { cost: 225, requires: ['sugar_mill_2'], unlocks: producer('candy_pot') },
  area_3: { cost: 1100, requires: ['cane_field_2'], unlocks: { kind: 'area', area: 'area_3' } },
  strawberry_shelf: { cost: 300, requires: ['area_3'], unlocks: shelf('strawberry') },
  strawberry_patch: { cost: 350, requires: ['strawberry_shelf'], unlocks: producer('strawberry_patch') },
  milk_fridge: { cost: 400, requires: ['strawberry_patch'], unlocks: shelf('milk') },
  cow_pen: { cost: 450, requires: ['milk_fridge'], unlocks: producer('cow_pen') },
  smoothie_shelf: { cost: 450, requires: ['cow_pen'], unlocks: shelf('smoothie') },
  smoothie_blender: { cost: 675, requires: ['smoothie_shelf'], unlocks: producer('smoothie_blender') },
  register_2: { cost: 600, requires: ['smoothie_blender'], unlocks: { kind: 'register', queueLength: 6 } },
  cashier_2: { cost: 750, requires: ['register_2'], unlocks: { kind: 'cashier', register: 'register_2' } },
  cane_field_3: { cost: 750, requires: ['smoothie_blender'], unlocks: producer('sugar_cane_field') },
  cow_2: { cost: 750, requires: ['smoothie_blender'], unlocks: producer('cow_pen') },
  smoothie_blender_2: { cost: 1100, requires: ['cane_field_3', 'cow_2'], unlocks: producer('smoothie_blender') },
  exit: { cost: 2250, requires: ['smoothie_blender_2'], unlocks: { kind: 'exit' } },
  // second Shelves (optional leaves), Stockers 2–6 and the Cleaner
  apple_shelf_2: { cost: 20, requires: ['apple_tree_2'], unlocks: shelf('apple') },
  orange_shelf_2: { cost: 25, requires: ['orange_tree_2'], unlocks: shelf('orange') },
  apple_juice_shelf_2: { cost: 60, requires: ['squeezer'], unlocks: shelf('apple_juice') },
  orange_juice_shelf_2: { cost: 60, requires: ['squeezer'], unlocks: shelf('orange_juice') },
  sugar_shelf_2: { cost: 150, requires: ['cane_field_2'], unlocks: shelf('sugar') },
  candy_apple_shelf_2: { cost: 175, requires: ['cane_field_2'], unlocks: shelf('candy_apple') },
  strawberry_shelf_2: { cost: 500, requires: ['smoothie_blender'], unlocks: shelf('strawberry') },
  milk_fridge_2: { cost: 600, requires: ['cow_2'], unlocks: shelf('milk') },
  smoothie_shelf_2: { cost: 1100, requires: ['smoothie_blender_2'], unlocks: shelf('smoothie') },
  stocker_3: { cost: 175, requires: ['sugar_cane_field'], unlocks: { kind: 'stocker' } },
  stocker_4: { cost: 200, requires: ['sugar_mill'], unlocks: { kind: 'stocker' } },
  stocker_5: { cost: 900, requires: ['smoothie_blender'], unlocks: { kind: 'stocker' } },
  stocker_2: { cost: 900, requires: ['cow_2'], unlocks: { kind: 'stocker' } },
  stocker_6: { cost: 1100, requires: ['smoothie_blender_2'], unlocks: { kind: 'stocker' } },
  stocker_7: { cost: 1300, requires: ['stocker_6'], unlocks: { kind: 'stocker' } },
  cleaner: { cost: 900, requires: ['smoothie_blender'], unlocks: { kind: 'cleaner' } },
};

export const freeStations: Record<string, FreeStationDef> = {
  trash: { requires: [], unlocks: { kind: 'trash' } },
  trash_2: { requires: ['area_2'], unlocks: { kind: 'trash' } },
  trash_3: { requires: ['area_3'], unlocks: { kind: 'trash' } },
  mop_stand: { requires: [], unlocks: { kind: 'mopStand' } },
};

export const start = { owned: ['area_1'], money: 50 };

export const movePrices = [40, 60, 90, 150, 200, 275, 400, 525, 650];

export const events: MapEvents = {
  delivery: { requires: ['apple_shelf'] },
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
