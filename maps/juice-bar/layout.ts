// PROTOTYPE (prototype/juice-layout): three store shapes for the Juice Bar, picked by ?jlayout=A|B|C (or JLAYOUT=…
// in scripts). Walls, doors and Station spots are generated from a short shape description; the editor can refine.
import type { Box, MapLayout, Point, Rot } from '../../src/sim/map';
import { TUNING } from '../../src/sim/tuning';

type Item = { id: string; w: number; d: number; rot: Rot; kind?: 'register' };
const shelf = (id: string): Item => ({ id, w: 3, d: 1, rot: 0 });
const pad = (id: string): Item => ({ id, w: 1, d: 1, rot: 0 });
const yard = (id: string, w: number, d: number): Item => ({ id, w, d, rot: 180 });
const machine = (id: string, w: number, d: number): Item => ({ id, w, d, rot: 0 });
const register = (id: string): Item => ({ id, w: 2.6, d: 1, rot: 180, kind: 'register' });
const QUEUE = TUNING.queueFirstOffset + 5 * TUNING.queueGap + 0.8;

const SIZES = {
  tree: [2.5, 2.5],
  cane: [3, 3],
  berry: [4, 2.4],
  press: [2.2, 3.3],
  squeezer: [2, 2.6],
  mill: [2.4, 3.5],
  pot: [2.2, 3.3],
  blender: [2, 2.8],
  cow: [3, 4.1],
} as const;

/** What each zone holds, in packing order. */
const A1_SHOP = [
  register('register'),
  pad('office'),
  pad('mop_stand'),
  shelf('apple_shelf'),
  shelf('orange_shelf'),
  shelf('apple_juice_shelf'),
  shelf('orange_juice_shelf'),
  shelf('apple_shelf_2'),
  shelf('orange_shelf_2'),
  shelf('apple_juice_shelf_2'),
  shelf('orange_juice_shelf_2'),
  pad('trash'),
  pad('area_2'),
];
const A1_YARD = [
  yard('apple_tree', ...SIZES.tree),
  yard('orange_tree', ...SIZES.tree),
  yard('apple_tree_2', ...SIZES.tree),
  yard('orange_tree_2', ...SIZES.tree),
  yard('apple_press', ...SIZES.press),
  yard('squeezer', ...SIZES.squeezer),
];
const A2_SHOP = [
  shelf('sugar_shelf'),
  shelf('candy_apple_shelf'),
  shelf('sugar_shelf_2'),
  shelf('candy_apple_shelf_2'),
  machine('candy_pot', ...SIZES.pot),
  pad('stocker_1'),
  pad('stocker_3'),
  pad('stocker_4'),
  pad('trash_2'),
  pad('area_3'),
];
const A2_YARD = [
  yard('sugar_cane_field', ...SIZES.cane),
  yard('cane_field_2', ...SIZES.cane),
  yard('sugar_mill', ...SIZES.mill),
];
const A3_SHOP = [
  register('register_2'),
  shelf('strawberry_shelf'),
  shelf('milk_fridge'),
  shelf('smoothie_shelf'),
  shelf('strawberry_shelf_2'),
  shelf('milk_fridge_2'),
  shelf('smoothie_shelf_2'),
  machine('smoothie_blender', ...SIZES.blender),
  machine('smoothie_blender_2', ...SIZES.blender),
  pad('stocker_2'),
  pad('stocker_5'),
  pad('stocker_6'),
  pad('cleaner'),
  pad('trash_3'),
];
const A3_YARD = [
  yard('strawberry_patch', ...SIZES.berry),
  yard('cow_pen', ...SIZES.cow),
  yard('cow_2', ...SIZES.cow),
  yard('cane_field_3', ...SIZES.cane),
  pad('exit'),
];

interface Shape {
  name: string;
  size: [number, number];
  shops: Record<string, Box[]>;
  yards: Record<string, Box[]>;
  /** Zone boxes for the packer, each with its items (defaults: first shop / yard box of each Area). */
  zones?: [Box, Item[]][];
  customerDoors: Box[];
  backDoors: Box[];
  windows?: Box[];
  street: Box[];
  streetSpots: Point[];
  roads: Box[];
  carSpots: { car: Box; pickup: Box }[];
  van: Box;
}

const cars = (x0: number, z: number, pickupAt: (i: number) => Box): Shape['carSpots'] =>
  [0, 1, 2, 3].map((i) => ({ car: [x0 + i * 3.6, z, 3, 1.8] as Box, pickup: pickupAt(i) }));

const SHAPES: Record<string, Shape> = {
  // A: a corner bar — an L of shop along two streets, a drive-through window with four Car Spots in Area 1,
  // the orchard filling the elbow.
  A: {
    name: 'Corner L + drive-through',
    size: [54, 56],
    shops: { area_1: [[4, 7, 20, 19]], area_2: [[24, 7, 26, 13]], area_3: [[4, 26, 16, 24]] },
    yards: {
      area_1: [
        [24, 20, 14, 14],
        [20, 26, 4, 8],
      ],
      area_2: [[38, 20, 14, 17]],
      area_3: [[20, 34, 18, 18]],
    },
    zones: [
      [[4, 10, 20, 16], A1_SHOP],
      [[24, 20, 14, 14], A1_YARD],
      [[24, 7, 26, 13], A2_SHOP],
      [[38, 20, 14, 17], A2_YARD],
      [[4, 26, 16, 24], A3_SHOP],
      [[20, 34, 18, 18], A3_YARD],
    ],
    customerDoors: [
      [20, 7, 3, 0.3],
      [4, 18, 0.3, 3],
      [40, 7, 3, 0.3],
      [4, 36, 0.3, 3],
    ],
    backDoors: [
      [23.7, 22, 0.3, 2.5],
      [42, 19.7, 2.5, 0.3],
      [19.7, 40, 0.3, 2.5],
    ],
    windows: [[4, 7, 16, 0.3]],
    street: [
      [0, 3, 54, 4],
      [0, 7, 4, 49],
    ],
    streetSpots: [
      [2, 5],
      [52, 5],
      [2, 54],
    ],
    roads: [
      [0, 0, 54, 3],
      [20, 52, 34, 4],
    ],
    carSpots: cars(4.6, 0.6, (i) => [5.4 + i * 3.6, 8, 1.5, 1.5]),
    van: [40, 52.6, 3, 1.6],
  },
  // B: an orchard island — one long shop on the street, wrapped on three sides by the farm yards.
  B: {
    name: 'Orchard island',
    size: [62, 54],
    shops: { area_1: [[10, 5, 16, 20]], area_2: [[26, 5, 12, 20]], area_3: [[38, 5, 16, 20]] },
    yards: {
      area_1: [
        [1, 5, 9, 43],
        [10, 25, 16, 23],
      ],
      area_2: [[26, 25, 12, 23]],
      area_3: [
        [54, 5, 8, 43],
        [38, 25, 16, 23],
      ],
    },
    zones: [
      [[10, 5, 16, 20], A1_SHOP],
      [[10, 25, 16, 19], A1_YARD],
      [[26, 5, 12, 20], A2_SHOP],
      [[26, 25, 12, 23], A2_YARD],
      [[38, 5, 16, 20], A3_SHOP],
      [[38, 25, 16, 23], A3_YARD.slice(0, 3)],
      [[54, 5, 8, 43], A3_YARD.slice(3)],
    ],
    customerDoors: [
      [18, 5, 3, 0.3],
      [30.5, 5, 3, 0.3],
      [44.5, 5, 3, 0.3],
    ],
    backDoors: [
      [10, 13, 0.3, 2.5],
      [16, 24.7, 2.5, 0.3],
      [30.75, 24.7, 2.5, 0.3],
      [44.75, 24.7, 2.5, 0.3],
      [53.7, 13, 0.3, 2.5],
    ],
    street: [[0, 0, 62, 5]],
    streetSpots: [
      [2, 2],
      [60, 2],
      [31, 2],
    ],
    roads: [[0, 48, 62, 6]],
    carSpots: cars(2, 48.8, (i) => [2.75 + i * 3.6, 45, 1.5, 1.5]),
    van: [54, 48.8, 3, 1.6],
  },
  // C: a staircase — three shops stepping down the hill, each with its own street front and its yard below.
  C: {
    name: 'Staircase',
    size: [58, 56],
    shops: { area_1: [[4, 4, 16, 18]], area_2: [[20, 12, 16, 18]], area_3: [[36, 20, 18, 18]] },
    yards: { area_1: [[4, 22, 16, 16]], area_2: [[20, 30, 16, 16]], area_3: [[36, 38, 18, 14]] },
    customerDoors: [
      [9, 4, 3, 0.3],
      [4, 10, 0.3, 3],
      [26.5, 12, 3, 0.3],
      [43.5, 20, 3, 0.3],
    ],
    backDoors: [
      [10.75, 21.7, 2.5, 0.3],
      [26.75, 29.7, 2.5, 0.3],
      [43.75, 37.7, 2.5, 0.3],
    ],
    street: [
      [0, 0, 58, 4],
      [20, 4, 38, 8],
      [36, 12, 22, 8],
      [0, 4, 4, 36],
    ],
    streetSpots: [
      [2, 2],
      [56, 2],
      [56, 16],
      [2, 38],
    ],
    roads: [
      [0, 40, 20, 4],
      [36, 52, 22, 4],
    ],
    carSpots: cars(1.2, 41, (i) => [1.95 + i * 3.6 + 3, 36, 1.5, 1.5]),
    van: [46, 52.6, 3, 1.6],
  },
};

/** Rows left to right, top to bottom, 2 m apart, 1.2 m in from the zone's edges. A Register (with its Cashier spot
 * behind and its queue in front) takes the zone's bottom-right corner; the rest pack beside it. */
function pack(zone: Box, items: Item[], places: MapLayout['places'], waiting: Point[]): void {
  const [zx, zz, zd0] = [zone[0], zone[1], zone[3]];
  let zw = zone[2];
  const m = 1.2;
  const gap = 2;
  const reg = items.find((it) => it.kind === 'register');
  if (reg) {
    const x = zx + zw - m - reg.w;
    const rz = zz + zd0 - m - 2.7;
    places[reg.id] = { box: [x, rz, reg.w, reg.d], rot: 180 };
    places[reg.id === 'register' ? 'cashier_1' : 'cashier_2'] = { box: [x + 0.8, rz + 1.7, 1, 1], rot: 180 };
    waiting.push(...[0, 1, 2, 3].map((i): Point => [x - 0.7 - i * 0.9, rz - QUEUE + 0.6]));
    zw -= reg.w + gap;
  }
  let x = zx + m;
  let z = zz + m;
  let row = 0;
  for (const it of items) {
    if (it === reg) continue;
    if (x + it.w > zx + zw - m + 1e-6) {
      x = zx + m;
      z += row + gap;
      row = 0;
    }
    if (z + it.d > zz + zd0 - m + 0.4) throw new Error(`Juice Bar layout: ${it.id} does not fit in zone ${zone}`);
    places[it.id] = { box: [x, z, it.w, it.d], rot: it.rot };
    x += it.w + gap;
    row = Math.max(row, it.d);
  }
}

type Edge = { horiz: boolean; at: number; from: number; to: number; side: 'n' | 's' | 'w' | 'e' };

const edgesOf = ([x, z, w, d]: Box): Edge[] => [
  { horiz: true, at: z, from: x, to: x + w, side: 'n' },
  { horiz: true, at: z + d, from: x, to: x + w, side: 's' },
  { horiz: false, at: x, from: z, to: z + d, side: 'w' },
  { horiz: false, at: x + w, from: z, to: z + d, side: 'e' },
];

/** Cuts [from, to] by the given intervals. */
function subtract(from: number, to: number, cuts: [number, number][]): [number, number][] {
  let out: [number, number][] = [[from, to]];
  for (const [a, b] of cuts)
    out = out.flatMap(([f, t]): [number, number][] =>
      b <= f || a >= t ? [[f, t]] : ([[f, Math.min(a, t)], [Math.max(b, f), t]] as [number, number][]).filter(([p, q]) => q - p > 0.05),
    );
  return out;
}

function build(s: Shape): MapLayout {
  const shopBoxes = Object.values(s.shops).flat();
  const walls: MapLayout['walls'] = {};
  const doors: MapLayout['doors'] = {};
  const T = 0.3;
  const doorBoxes = [...s.customerDoors.map((b) => ['customer', b] as const), ...s.backDoors.map((b) => ['back', b] as const)];
  doorBoxes.forEach(([kind, b], i) => (doors[`door_${kind}_${i + 1}`] = { kind, box: b }));
  let n = 0;
  for (const box of shopBoxes)
    for (const e of edgesOf(box)) {
      // drop stretches shared with a neighbouring shop box, and door openings on this edge
      const shared = shopBoxes
        .filter((o) => o !== box)
        .flatMap((o) => edgesOf(o))
        .filter((o) => o.horiz === e.horiz && Math.abs(o.at - e.at) < 1e-6 && o.side !== e.side)
        .map((o): [number, number] => [o.from, o.to]);
      const inner = e.side === 's' || e.side === 'e' ? e.at - T : e.at;
      const onLine = (b: Box) => (e.horiz ? Math.abs(b[1] - inner) < 0.31 && b[3] <= T + 1e-6 : Math.abs(b[0] - inner) < 0.31 && b[2] <= T + 1e-6);
      const cuts = doorBoxes
        .map(([, b]) => b)
        .filter(onLine)
        .map((b): [number, number] => (e.horiz ? [b[0], b[0] + b[2]] : [b[1], b[1] + b[3]]));
      const isWindow = (s.windows ?? []).some((b) => onLine(b));
      for (const [f, t] of subtract(e.from, e.to, [...shared, ...cuts])) {
        const kind = isWindow ? 'window' : e.side === 'n' || e.side === 'w' ? 'tall' : 'low';
        walls[`wall_${++n}`] = { kind, box: e.horiz ? [f, inner, t - f, T] : [inner, f, T, t - f] };
      }
    }
  const places: MapLayout['places'] = {};
  const waiting: Point[] = [];
  const zones: [Box, Item[]][] = s.zones ?? [
    [s.shops.area_1[0], A1_SHOP],
    [s.yards.area_1[0], A1_YARD],
    [s.shops.area_2[0], A2_SHOP],
    [s.yards.area_2[0], A2_YARD],
    [s.shops.area_3[0], A3_SHOP],
    [s.yards.area_3[0], A3_YARD],
  ];
  for (const [zone, items] of zones) pack(zone, items, places, waiting);
  const a1 = s.shops.area_1[0];
  return {
    size: s.size,
    areas: Object.fromEntries(Object.keys(s.shops).map((a) => [a, [...s.shops[a], ...s.yards[a]]])),
    places,
    walls,
    doors,
    props: {},
    floors: shopBoxes,
    street: s.street,
    roads: s.roads,
    streetSpots: s.streetSpots,
    waitingSpots: waiting.slice(0, 4),
    carSpots: s.carSpots,
    van: s.van,
    playerStart: [a1[0] + a1[2] / 2, a1[1] + a1[3] - 3],
  };
}

const pick =
  (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('jlayout') : (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.JLAYOUT) ?? 'A';
export const SHAPE_NAME = SHAPES[pick]?.name ?? SHAPES.A.name;
export const layout: MapLayout = build(SHAPES[pick] ?? SHAPES.A);
