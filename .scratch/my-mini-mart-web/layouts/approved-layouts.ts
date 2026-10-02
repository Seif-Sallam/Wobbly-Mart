// Approved map layouts, saved from the layout prototype (branch prototype/first-map-layout, commit b647c7b).
// Map 1 = D "Corner shop". E "Long hall", F "L-shaped store" and G "Little n" are approved for later maps
// (G will get more Products). Format and building conventions are documented in the header below.

// PROTOTYPE — radically different first-map layouts. Units: metres, x east, z south, origin top-left.
// Box = [x, z, w, d] (top-left corner + size). Floor-only Pads are 1×1.
// Box ids starting wall_ (tall, far side), lowwall_ (knee-high, camera side), partition_ (office), door_ (sliding
// doors), window_ (drive-through counter), prop_ (decor; prop_rug* is walk-over) or event_ (car-event spots, usable
// from the start: event_car_N is where a car parks, event_pickup_N where the Player hands it the order) are part of the map.

export type Box = [number, number, number, number];
export type Dir = 'N' | 'S' | 'E' | 'W';
export type Layout = {
  name: string;
  idea: string;
  size: [number, number];
  areas: Record<1 | 2 | 3, Box[]>;
  boxes: Record<string, Box>;
  queues: Record<string, Dir>;
  street: Box[]; // customers only — the Player stays inside the Areas
  floors: Box[]; // indoor shop floor — Customers never leave it (or the street)
  spawns: [number, number][]; // where Customers appear and leave
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
  D: {
    name: 'Corner shop',
    idea: 'Walled shop, customer doors on the top and left, Registers at the back; back doors lead out to the farm yard; big Office room.',
    size: [42, 46],
    areas: { 1: [[4, 4, 14, 18], [4, 22, 14, 24]], 2: [[18, 4, 11, 18], [18, 22, 11, 24]], 3: [[29, 4, 12, 18], [29, 22, 12, 24]] },
    boxes: {
      wall_n1: [4, 4, 7, 0.3], door_n1: [11, 4, 3, 0.3], wall_n2: [14, 4, 19, 0.3], door_n2: [33, 4, 3, 0.3], wall_n3: [36, 4, 5, 0.3],
      wall_w1: [4, 4.3, 0.3, 5.7], door_w1: [4, 10, 0.3, 3], wall_w2: [4, 13, 0.3, 9],
      lowwall_e: [40.7, 4.3, 0.3, 17.7],
      lowwall_s1: [4.3, 21.7, 11.7, 0.3], door_back1: [16, 21.7, 2.5, 0.3], lowwall_s2: [18.5, 21.7, 4, 0.3], door_back2: [22.5, 21.7, 2.5, 0.3],
      lowwall_s3: [25, 21.7, 8, 0.3], door_back3: [33, 21.7, 2.5, 0.3], lowwall_s4: [35.5, 21.7, 5.2, 0.3],
      partition_office_n1: [4.3, 14.7, 2.7, 0.3], door_office: [7, 14.7, 2, 0.3], partition_office_n2: [9, 14.7, 3.6, 0.3], partition_office_e: [12.3, 15, 0.3, 6.7],
      office: [7.5, 18.5, 1.5, 1], prop_bookshelf: [4.4, 15.5, 0.5, 3], prop_sofa: [10.6, 17, 1.2, 2.6], prop_rug: [6.5, 16, 3, 1.8],
      prop_plant_1: [4.6, 20.8, 0.6, 0.6], prop_plant_2: [11.5, 15.3, 0.6, 0.6], prop_cooler: [4.6, 19.2, 0.6, 0.6], prop_table: [9.5, 20.4, 1.2, 0.8],
      tomato_shelf: [6, 7, 3, 1], egg_shelf: [14.5, 7, 3, 1], ketchup_shelf: [14.5, 11, 3, 1],
      register: [14, 18.5, 2, 1], cashier_1: [14.5, 20.3, 1, 1], area_2: [16.5, 14.5, 1, 1],
      trash: [9.5, 23.5, 1, 1], tomato_bed: [6, 26, 3, 3], tomato_plots: [6, 31, 3, 2], blender: [12, 24.5, 1.5, 1],
      chicken_coop: [12, 28, 2, 2], chicken_2: [15, 28, 2, 2],
      wheat_shelf: [20, 7, 3, 1], milk_fridge: [24.5, 7, 3, 1], flour_shelf: [20, 11, 3, 1], stocker_1: [25, 15, 1, 1], area_3: [27.5, 12, 1, 1],
      mill: [25, 24, 2, 2], wheat_field: [20, 27, 3, 3], wheat_plots: [20, 32, 3, 2], cow_pen: [25, 28, 3, 2], cow_2: [25, 31.5, 3, 2],
      bread_shelf: [30.5, 9, 3, 1], register_2: [36, 18.5, 2, 1], cashier_2: [36.5, 20.3, 1, 1], stocker_2: [38, 12, 1, 1],
      oven: [31, 25, 2, 2], oven_2: [35, 25, 2, 2], blender_2: [31, 30, 1.5, 1], mill_2: [35, 29.5, 2, 2],
      exit: [37, 43, 1, 1],
      event_car_1: [4.6, 46.6, 3.4, 1.8], event_car_2: [9.2, 46.6, 3.4, 1.8], event_car_3: [13.8, 46.6, 3.4, 1.8],
      event_pickup_1: [5.55, 43.3, 1.5, 1.5], event_pickup_2: [10.15, 43.3, 1.5, 1.5], event_pickup_3: [14.75, 43.3, 1.5, 1.5],
    },
    queues: { register: 'N', register_2: 'N' },
    street: [[0, 0, 42, 4], [0, 4, 4, 18]],
    floors: [[4, 4, 37, 18]],
    spawns: [[2, 2], [41, 2], [2, 20]],
    van: [36, 46.6, 3, 1.6],
  },
  E: {
    name: 'Long hall',
    idea: 'A long walled hall along the street: two customer doors on top, one on the left, Registers along the back, a back door per Area to its farm strip.',
    size: [50, 40],
    areas: { 1: [[4, 4, 16, 13], [4, 17, 16, 23]], 2: [[20, 4, 15, 13], [20, 17, 15, 23]], 3: [[35, 4, 14, 13], [35, 17, 14, 23]] },
    boxes: {
      wall_n1: [4, 4, 5, 0.3], door_n1: [9, 4, 3, 0.3], wall_n2: [12, 4, 15, 0.3], door_n2: [27, 4, 3, 0.3], wall_n3: [30, 4, 19, 0.3],
      wall_w1: [4, 4.3, 0.3, 2.7], door_w1: [4, 7, 0.3, 3], wall_w2: [4, 10, 0.3, 7],
      lowwall_e: [48.7, 4.3, 0.3, 12.7],
      lowwall_s1: [4.3, 16.7, 13.7, 0.3], door_back1: [18, 16.7, 2.5, 0.3], lowwall_s2: [20.5, 16.7, 3.5, 0.3], door_back2: [24, 16.7, 2.5, 0.3],
      lowwall_s3: [26.5, 16.7, 11.5, 0.3], door_back3: [38, 16.7, 2.5, 0.3], lowwall_s4: [40.5, 16.7, 8.2, 0.3],
      partition_office_n1: [4.3, 10, 2.7, 0.3], door_office: [7, 10, 2, 0.3], partition_office_n2: [9, 10, 3.6, 0.3], partition_office_e: [12.3, 10.3, 0.3, 6.4],
      office: [7.5, 13.5, 1.5, 1], prop_bookshelf: [4.4, 10.8, 0.5, 3], prop_sofa: [10.6, 12, 1.2, 2.6], prop_rug: [6.5, 11, 3, 1.6],
      prop_plant_1: [4.6, 15.8, 0.6, 0.6], prop_plant_2: [11.5, 15.8, 0.6, 0.6], prop_cooler: [4.6, 14.4, 0.6, 0.6],
      tomato_shelf: [12.8, 6.5, 3, 1], ketchup_shelf: [16.8, 6.5, 3, 1], egg_shelf: [12.8, 9.5, 3, 1],
      register: [16, 13.5, 2, 1], cashier_1: [16.5, 15.2, 1, 1], area_2: [18.8, 10.5, 1, 1],
      tomato_bed: [6, 21, 3, 3], tomato_plots: [6, 26, 3, 2], chicken_coop: [12, 21, 2, 2], chicken_2: [12, 25, 2, 2],
      blender: [16.5, 20, 1.5, 1], trash: [17, 25, 1, 1],
      wheat_shelf: [22, 6.5, 3, 1], milk_fridge: [31, 6.5, 3, 1], flour_shelf: [22, 10, 3, 1], stocker_1: [31, 12, 1, 1], area_3: [33.5, 9.5, 1, 1],
      wheat_field: [22, 21, 3, 3], wheat_plots: [22, 26, 3, 2], cow_pen: [27, 21, 3, 2], cow_2: [27, 25, 3, 2], mill: [31.5, 20, 2, 2],
      bread_shelf: [38, 6.5, 3, 1], register_2: [42, 13.5, 2, 1], cashier_2: [42.5, 15.2, 1, 1], stocker_2: [46, 9, 1, 1],
      oven: [37, 21, 2, 2], oven_2: [42, 21, 2, 2], blender_2: [37, 26, 1.5, 1], mill_2: [42, 26, 2, 2],
      exit: [46, 37, 1, 1],
      event_car_1: [5, 40.6, 3.4, 1.8], event_car_2: [10, 40.6, 3.4, 1.8], event_car_3: [15, 40.6, 3.4, 1.8],
      event_pickup_1: [5.95, 37, 1.5, 1.5], event_pickup_2: [10.95, 37, 1.5, 1.5], event_pickup_3: [15.95, 37, 1.5, 1.5],
    },
    queues: { register: 'N', register_2: 'N' },
    street: [[0, 0, 50, 4], [0, 4, 4, 13]],
    floors: [[4, 4, 45, 13]],
    spawns: [[2, 2], [48, 2], [2, 15]],
    van: [45, 40.6, 3, 1.6],
  },
  F: {
    name: 'L-shaped store',
    idea: 'The shop wraps the top and left like an L; the farm is the courtyard inside it, reached through back doors; Registers face the courtyard.',
    size: [46, 46],
    areas: {
      1: [[4, 4, 22, 10], [4, 14, 12, 10], [16, 14, 14, 16]],
      2: [[26, 4, 19, 10], [30, 14, 15, 32]],
      3: [[4, 24, 12, 21], [16, 30, 14, 16]],
    },
    boxes: {
      wall_n1: [4, 4, 8, 0.3], door_n1: [12, 4, 3, 0.3], window_1: [15, 4, 11, 0.3], wall_n2: [26, 4, 7, 0.3], door_n2: [33, 4, 3, 0.3], wall_n3: [36, 4, 9, 0.3],
      wall_w1: [4, 4.3, 0.3, 11.7], door_w1: [4, 16, 0.3, 3], wall_w2: [4, 19, 0.3, 15], door_w2: [4, 34, 0.3, 3], wall_w3: [4, 37, 0.3, 8],
      lowwall_e: [44.7, 4.3, 0.3, 9.7],
      lowwall_ns1: [16, 13.7, 6.5, 0.3], door_back1: [22.5, 13.7, 2.5, 0.3], lowwall_ns2: [25, 13.7, 7.5, 0.3], door_back2: [32.5, 13.7, 2.5, 0.3], lowwall_ns3: [35, 13.7, 9.7, 0.3],
      lowwall_we1: [15.7, 14, 0.3, 5], door_back3: [15.7, 19, 0.3, 2.5], lowwall_we2: [15.7, 21.5, 0.3, 10], door_back4: [15.7, 31.5, 0.3, 2.5], lowwall_we3: [15.7, 34, 0.3, 10.7],
      lowwall_ws: [4.3, 44.7, 11.7, 0.3],
      partition_office_e: [12, 4.3, 0.3, 6.7], partition_office_s1: [4.3, 11, 3, 0.3], door_office: [7.3, 11, 2, 0.3], partition_office_s2: [9.3, 11, 3, 0.3],
      office: [7, 5, 1.5, 1], prop_bookshelf: [4.4, 6.5, 0.5, 3], prop_sofa: [10.5, 6, 1.2, 2.6], prop_rug: [6.5, 7, 3, 1.8],
      prop_plant_1: [4.6, 4.6, 0.6, 0.6], prop_plant_2: [11.1, 4.6, 0.6, 0.6], prop_cooler: [4.6, 10, 0.6, 0.6],
      event_car_1: [15.2, 0.6, 3.4, 1.8], event_car_2: [18.8, 0.6, 3.4, 1.8], event_car_3: [22.4, 0.6, 3.4, 1.8],
      event_pickup_1: [16.15, 4.6, 1.5, 1.5], event_pickup_2: [19.75, 4.6, 1.5, 1.5], event_pickup_3: [23.35, 4.6, 1.5, 1.5],
      tomato_shelf: [16, 8, 3, 1], egg_shelf: [21.5, 8, 3, 1], ketchup_shelf: [8, 21, 3, 1],
      register: [20, 11, 2, 1], cashier_1: [20.5, 12.6, 1, 1], area_2: [24.5, 11, 1, 1],
      trash: [28, 27, 1, 1], tomato_bed: [19, 17, 3, 3], tomato_plots: [19, 22, 3, 2], blender: [25, 16.5, 1.5, 1],
      chicken_coop: [25, 20, 2, 2], chicken_2: [25, 24, 2, 2], area_3: [22, 28.5, 1, 1],
      wheat_shelf: [28, 7, 3, 1], milk_fridge: [38, 7, 3, 1], flour_shelf: [28, 10.5, 3, 1], stocker_1: [40, 11, 1, 1],
      wheat_field: [33, 18, 3, 3], wheat_plots: [33, 23, 3, 2], cow_pen: [39, 18, 3, 2], cow_2: [39, 22, 3, 2], mill: [34, 28, 2, 2],
      bread_shelf: [7, 27, 3, 1], register_2: [9, 40, 2, 1], cashier_2: [9.5, 41.7, 1, 1], stocker_2: [12, 30, 1, 1],
      oven: [19, 33, 2, 2], oven_2: [24, 33, 2, 2], blender_2: [19, 38, 1.5, 1], mill_2: [24, 38, 2, 2],
      exit: [27, 43, 1, 1],
    },
    queues: { register: 'W', register_2: 'N' },
    street: [[0, 0, 46, 4], [0, 4, 4, 41]],
    floors: [[4, 4, 41, 10], [4, 14, 12, 31]],
    spawns: [[2, 2], [44, 2], [2, 44]],
    van: [26, 46.6, 3, 1.6],
  },
  G: {
    name: 'Little n',
    idea: 'The shop is an n around the farm: customers come from 3 corners (top-left, top-right, bottom-left — that door opens with Area 3) and walk the left wing past the Office; drive-through on the front.',
    size: [42, 40],
    areas: {
      1: [[4, 4, 17, 10], [4, 14, 10, 10], [14, 14, 8, 13]],
      2: [[21, 4, 17, 10], [30, 14, 8, 22], [22, 14, 8, 13]],
      3: [[4, 24, 10, 12], [14, 27, 16, 13]],
    },
    boxes: {
      wall_n1: [4, 4, 2, 0.3], door_n1: [6, 4, 3, 0.3], window_1: [9, 4, 12, 0.3], wall_n2: [21, 4, 12, 0.3], door_n2: [33, 4, 3, 0.3], wall_n3: [36, 4, 2, 0.3],
      wall_w1: [4, 4.3, 0.3, 26.7], door_w1: [4, 31, 0.3, 3], wall_w2: [4, 34, 0.3, 2],
      lowwall_e: [37.7, 4.3, 0.3, 31.7], lowwall_ls: [4.3, 35.7, 9.7, 0.3], lowwall_rs: [30, 35.7, 7.7, 0.3],
      lowwall_ts1: [14, 13.7, 1, 0.3], door_back1: [15, 13.7, 2.5, 0.3], lowwall_ts2: [17.5, 13.7, 5.5, 0.3], door_back2: [23, 13.7, 2.5, 0.3], lowwall_ts3: [25.5, 13.7, 4.5, 0.3],
      lowwall_le1: [13.7, 14, 0.3, 15], door_back3: [13.7, 29, 0.3, 2.5], lowwall_le2: [13.7, 31.5, 0.3, 4.2],
      lowwall_re1: [30, 14, 0.3, 9], door_back4: [30, 23, 0.3, 2.5], lowwall_re2: [30, 25.5, 0.3, 10.2],
      partition_office_n1: [7, 14, 2, 0.3], door_office: [9, 14, 2, 0.3], partition_office_n2: [11, 14, 2.7, 0.3],
      partition_office_w: [7, 14.3, 0.3, 7.7], partition_office_s: [7, 21.7, 6.7, 0.3],
      office: [9.5, 18, 1.5, 1], prop_bookshelf: [13.1, 15, 0.5, 3], prop_sofa: [7.4, 16.5, 1.2, 2.6], prop_rug: [9, 15, 2.5, 1.5],
      prop_plant_1: [7.5, 20.8, 0.6, 0.6], prop_plant_2: [13, 20.8, 0.6, 0.6], prop_cooler: [13, 18.8, 0.6, 0.6], prop_table: [10.5, 20.4, 1.2, 0.8],
      event_car_1: [9.3, 0.6, 3.4, 1.8], event_car_2: [12.9, 0.6, 3.4, 1.8], event_car_3: [16.5, 0.6, 3.4, 1.8],
      event_pickup_1: [10.25, 4.6, 1.5, 1.5], event_pickup_2: [13.85, 4.6, 1.5, 1.5], event_pickup_3: [17.45, 4.6, 1.5, 1.5],
      tomato_shelf: [10, 7.5, 3, 1], egg_shelf: [15, 7.5, 3, 1], ketchup_shelf: [9.5, 10.5, 3, 1],
      register: [17, 11, 2, 1], cashier_1: [17.5, 12.6, 1, 1], area_2: [19.8, 8.5, 1, 1],
      tomato_bed: [15.5, 16.5, 3, 3], tomato_plots: [15.5, 21.5, 3, 2], chicken_coop: [19.5, 16.5, 2, 2], chicken_2: [19.5, 20.5, 2, 2],
      blender: [19.5, 24.5, 1.5, 1], trash: [15.5, 25, 1, 1],
      wheat_shelf: [23, 7, 3, 1], flour_shelf: [23, 10, 3, 1], milk_fridge: [33.5, 17, 3, 1], stocker_1: [35, 10, 1, 1],
      wheat_field: [23, 15.5, 3, 3], wheat_plots: [23, 20, 3, 2], mill: [23, 24, 2, 2], cow_pen: [27, 15.5, 2.5, 2], cow_2: [27, 19.5, 2.5, 2],
      area_3: [27, 25.8, 1, 1],
      bread_shelf: [6, 26.5, 3, 1], register_2: [9, 32, 2, 1], cashier_2: [9.5, 33.7, 1, 1], stocker_2: [5.5, 29.5, 1, 1],
      oven: [16, 29, 2, 2], oven_2: [20, 29, 2, 2], blender_2: [16, 33.5, 1.5, 1], mill_2: [20, 33, 2, 2],
      exit: [27, 37, 1, 1],
    },
    queues: { register: 'W', register_2: 'N' },
    street: [[0, 0, 42, 4], [0, 4, 4, 34]],
    floors: [[4, 4, 34, 10], [4, 14, 10, 22], [30, 14, 8, 22]],
    spawns: [[2, 2], [37, 2], [2, 37]],
    van: [26, 40.6, 3, 1.6],
  },

};
