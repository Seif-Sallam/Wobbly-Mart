// Earlier layouts A "Main street", B "Central market", C "Store front, farm behind" — open-plan, no walls.
// Kept as good alternatives; saved from branch prototype/first-map-layout, commit de07bc1 (older format: entrance/exit points, no street).

// PROTOTYPE — three radically different first-map layouts. Units: metres, x east, z south, origin top-left.
// Box = [x, z, w, d] (top-left corner + size). Floor-only Pads are 1×1.

export type Box = [number, number, number, number];
export type Dir = 'N' | 'S' | 'E' | 'W';
export type Layout = {
  name: string;
  idea: string;
  size: [number, number];
  areas: Record<1 | 2 | 3, Box[]>;
  boxes: Record<string, Box>;
  queues: Record<string, Dir>;
  entrance: [number, number];
  exit: [number, number];
  van: Box;
};

// Pad unlock order and requirements, from price-table/price-table.md.
export const PADS: { id: string; area: 1 | 2 | 3; cost: number; req: string[] }[] = [
  { id: 'register', area: 1, cost: 10, req: [] },
  { id: 'tomato_shelf', area: 1, cost: 15, req: ['register'] },
  { id: 'tomato_bed', area: 1, cost: 25, req: ['tomato_shelf'] },
  { id: 'egg_shelf', area: 1, cost: 20, req: ['tomato_bed'] },
  { id: 'chicken_coop', area: 1, cost: 25, req: ['egg_shelf'] },
  { id: 'office', area: 1, cost: 35, req: ['chicken_coop'] },
  { id: 'ketchup_shelf', area: 1, cost: 40, req: ['office'] },
  { id: 'blender', area: 1, cost: 40, req: ['ketchup_shelf'] },
  { id: 'cashier_1', area: 1, cost: 45, req: ['blender'] },
  { id: 'chicken_2', area: 1, cost: 40, req: ['blender'] },
  { id: 'tomato_plots', area: 1, cost: 35, req: ['blender'] },
  { id: 'area_2', area: 1, cost: 150, req: ['cashier_1'] },
  { id: 'stocker_1', area: 2, cost: 200, req: ['area_2'] },
  { id: 'wheat_shelf', area: 2, cost: 60, req: ['stocker_1'] },
  { id: 'wheat_field', area: 2, cost: 80, req: ['wheat_shelf'] },
  { id: 'milk_fridge', area: 2, cost: 100, req: ['wheat_field'] },
  { id: 'cow_pen', area: 2, cost: 125, req: ['milk_fridge'] },
  { id: 'flour_shelf', area: 2, cost: 125, req: ['cow_pen'] },
  { id: 'mill', area: 2, cost: 150, req: ['flour_shelf'] },
  { id: 'wheat_plots', area: 2, cost: 150, req: ['mill'] },
  { id: 'cow_2', area: 2, cost: 175, req: ['mill'] },
  { id: 'area_3', area: 2, cost: 1050, req: ['mill'] },
  { id: 'bread_shelf', area: 3, cost: 425, req: ['area_3'] },
  { id: 'oven', area: 3, cost: 625, req: ['bread_shelf'] },
  { id: 'register_2', area: 3, cost: 550, req: ['oven'] },
  { id: 'cashier_2', area: 3, cost: 700, req: ['register_2'] },
  { id: 'stocker_2', area: 3, cost: 850, req: ['oven'] },
  { id: 'blender_2', area: 3, cost: 500, req: ['oven'] },
  { id: 'mill_2', area: 3, cost: 700, req: ['oven'] },
  { id: 'oven_2', area: 3, cost: 1050, req: ['mill_2', 'blender_2'] },
  { id: 'exit', area: 3, cost: 2100, req: ['oven_2'] },
];

// Pads that place a solid Station (the rest are floor-only: staff, Area and Exit Pads).
export const SOLID = new Set([
  'register', 'register_2', 'office', 'trash',
  'tomato_shelf', 'egg_shelf', 'ketchup_shelf', 'wheat_shelf', 'milk_fridge', 'flour_shelf', 'bread_shelf',
  'tomato_bed', 'tomato_plots', 'chicken_coop', 'chicken_2', 'blender', 'blender_2',
  'wheat_field', 'wheat_plots', 'cow_pen', 'cow_2', 'mill', 'mill_2', 'oven', 'oven_2',
]);

// Player carrying legs (one way). Each end is a group: a 2nd producer counts, the nearest one wins.
export const LEGS: [string[], string[]][] = [
  [['tomato_bed', 'tomato_plots'], ['tomato_shelf']],
  [['tomato_bed', 'tomato_plots'], ['chicken_coop', 'chicken_2']],
  [['tomato_bed', 'tomato_plots'], ['blender', 'blender_2']],
  [['chicken_coop', 'chicken_2'], ['egg_shelf']],
  [['blender', 'blender_2'], ['ketchup_shelf']],
  [['wheat_field', 'wheat_plots'], ['wheat_shelf']],
  [['wheat_field', 'wheat_plots'], ['cow_pen', 'cow_2']],
  [['wheat_field', 'wheat_plots'], ['mill', 'mill_2']],
  [['cow_pen', 'cow_2'], ['milk_fridge']],
  [['mill', 'mill_2'], ['flour_shelf']],
  [['mill', 'mill_2'], ['oven', 'oven_2']],
  [['chicken_coop', 'chicken_2'], ['oven', 'oven_2']],
  [['oven', 'oven_2'], ['bread_shelf']],
];

export const LAYOUTS: Record<string, Layout> = {
  A: {
    name: 'Main street',
    idea: 'Areas side by side along the road (Area 2 | Area 1 | Area 3). Farm at the back, shelves in one long aisle, Registers by the road.',
    size: [48, 25],
    areas: { 1: [[16, 0, 16, 25]], 2: [[0, 0, 16, 25]], 3: [[32, 0, 16, 25]] },
    boxes: {
      tomato_bed: [18, 2, 3, 3], tomato_plots: [18, 6, 3, 2], blender: [23.5, 3, 1.5, 1],
      chicken_coop: [27, 2, 2, 2], chicken_2: [27, 5.5, 2, 2],
      tomato_shelf: [17.5, 12, 3, 1], ketchup_shelf: [22.5, 12, 3, 1], egg_shelf: [27.5, 12, 3, 1],
      office: [18, 17, 2, 2], trash: [22.5, 17.5, 1, 1],
      register: [27, 17, 2, 1], cashier_1: [27.5, 15.3, 1, 1], area_2: [16.6, 9, 1, 1],
      cow_pen: [1.5, 2, 3, 2], cow_2: [1.5, 5.5, 3, 2], mill: [7, 3, 2, 2],
      wheat_field: [12, 2, 3, 3], wheat_plots: [12, 6, 3, 2], stocker_1: [8, 17, 1, 1],
      milk_fridge: [1.5, 12, 3, 1], flour_shelf: [6.5, 12, 3, 1], wheat_shelf: [11.5, 12, 3, 1], area_3: [30.4, 9, 1, 1],
      oven: [34, 2, 2, 2], oven_2: [38, 2, 2, 2], blender_2: [34, 7, 1.5, 1], mill_2: [38, 6.5, 2, 2],
      bread_shelf: [34, 12, 3, 1], register_2: [37, 17, 2, 1], cashier_2: [37.5, 15.3, 1, 1],
      stocker_2: [43, 9, 1, 1], exit: [44, 20, 1, 1],
    },
    queues: { register: 'S', register_2: 'S' },
    entrance: [17.5, 24.6],
    exit: [31, 24.6],
    van: [43, 25.6, 3, 1.6],
  },
  B: {
    name: 'Central market',
    idea: 'All shelves in one hub in the middle; each Area is a block of producers around it. Short trips.',
    size: [36, 37],
    areas: { 1: [[0, 16, 20, 21]], 2: [[0, 0, 20, 16]], 3: [[20, 0, 16, 37]] },
    boxes: {
      tomato_bed: [3, 18, 3, 3], tomato_plots: [3, 22.5, 3, 2], chicken_coop: [8.5, 18, 2, 2], chicken_2: [8.5, 21.5, 2, 2],
      blender: [8.5, 25.5, 1.5, 1],
      tomato_shelf: [13.5, 18, 3, 1], egg_shelf: [13.5, 21, 3, 1], ketchup_shelf: [13.5, 24, 3, 1],
      office: [3, 29, 2, 2], trash: [8.5, 30, 1, 1],
      register: [14, 29, 2, 1], cashier_1: [14.5, 27.3, 1, 1], area_2: [11, 16.3, 1, 1],
      wheat_field: [3, 3, 3, 3], wheat_plots: [3, 7.5, 3, 2], cow_pen: [9, 3, 3, 2], cow_2: [9, 6.5, 3, 2], mill: [15, 4, 2, 2],
      milk_fridge: [8, 12, 3, 1], wheat_shelf: [13, 12, 3, 1], flour_shelf: [16, 8.5, 3, 1],
      stocker_1: [3, 12.5, 1, 1], area_3: [18.6, 14, 1, 1],
      bread_shelf: [22, 18, 3, 1], oven: [23, 12.5, 2, 2], oven_2: [27.5, 12.5, 2, 2],
      blender_2: [27.5, 8.5, 1.5, 1], mill_2: [31.5, 12.5, 2, 2],
      register_2: [22, 29, 2, 1], cashier_2: [22.5, 27.3, 1, 1], stocker_2: [30, 22, 1, 1], exit: [32, 31, 1, 1],
    },
    queues: { register: 'S', register_2: 'S' },
    entrance: [6, 36.6],
    exit: [19, 36.6],
    van: [31, 37.6, 3, 1.6],
  },
  C: {
    name: 'Store front, farm behind',
    idea: 'One shop strip by the road; each new Area farms further back, so trips grow with every Area.',
    size: [30, 42],
    areas: {
      1: [[0, 20, 30, 10], [0, 30, 14, 12]],
      2: [[0, 10, 30, 10], [14, 30, 8, 12]],
      3: [[0, 0, 30, 10], [22, 30, 8, 12]],
    },
    boxes: {
      tomato_bed: [2, 21.5, 3, 3], tomato_plots: [2, 26, 3, 2], chicken_coop: [8, 21.5, 2, 2], chicken_2: [11.5, 21.5, 2, 2],
      blender: [8.5, 26, 1.5, 1], office: [24, 22, 2, 2], trash: [17, 26, 1, 1],
      tomato_shelf: [1.5, 32, 3, 1], egg_shelf: [6, 32, 3, 1], ketchup_shelf: [10.5, 32, 3, 1],
      register: [9, 36.5, 2, 1], cashier_1: [9.5, 34.8, 1, 1], area_2: [16, 20.6, 1, 1],
      wheat_field: [2, 11.5, 3, 3], wheat_plots: [2, 16, 3, 2], cow_pen: [8, 11.5, 3, 2], cow_2: [8, 15, 3, 2], mill: [15, 12, 2, 2],
      stocker_1: [21, 15, 1, 1],
      wheat_shelf: [15, 32, 3, 1], milk_fridge: [15, 35, 3, 1], flour_shelf: [15, 38, 3, 1], area_3: [19, 10.6, 1, 1],
      oven: [3, 2, 2, 2], oven_2: [7, 2, 2, 2], blender_2: [12, 3, 1.5, 1], mill_2: [16, 2, 2, 2], stocker_2: [22, 4, 1, 1],
      bread_shelf: [23.5, 32, 3, 1], register_2: [24, 36.5, 2, 1], cashier_2: [24.5, 34.8, 1, 1], exit: [27.5, 39.5, 1, 1],
    },
    queues: { register: 'S', register_2: 'S' },
    entrance: [1.5, 41.6],
    exit: [13, 41.6],
    van: [26, 42.6, 3, 1.6],
  },
};
