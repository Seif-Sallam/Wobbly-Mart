// Lessons 0–7 as data: card copy, setup, steps (target + goal) and what counts as going wrong. The runner is
// src/sim/lessons.ts; later Lessons are more entries in this list.
import type { Point } from '../../src/sim/map';
import type { ProducerStation, ShelfStation, World } from '../../src/sim/world';
import type { LessonDef, LessonDevice } from '../../src/sim/lessons';
import { near, saw } from '../../src/sim/lessons';
import { callCustomer } from '../../src/sim/customers';
import { addMess } from '../../src/sim/cleaning';
import { shed } from '../../src/sim/carry';
import { cashPilePoint } from '../../src/sim/economy';
import { TUNING } from '../../src/sim/tuning';

const shelf = (w: World, id: string): ShelfStation => w.stations.get(id) as ShelfStation;
const producer = (w: World, id: string): ProducerStation => w.stations.get(id) as ProducerStation;
const count = (w: World, product: string): number => w.player.stack.filter((p) => p === product).length;
const give = (w: World, product: string, n: number): void => {
  w.player.stack = Array<string>(n).fill(product);
};
const loosePoint = (w: World): Point | null => (w.loose[0] ? [w.loose[0].x, w.loose[0].z] : null);
const messPoint = (w: World): Point | null => (w.messes[0] ? [w.messes[0].x, w.messes[0].z] : null);

// Lesson 1: two spots on the shop floor, clear of every Pad
const WALK_TO: Point = [13, 9.5];
const SPRINT_TO: Point = [25, 9.5];
// Lesson 7: where the scripted Mess lands
const MESS_AT: Point = [20, 9.5];

const stick = (d: LessonDevice): string =>
  d.joystick === 'off'
    ? 'Tap the floor and you walk there on your own. Double-tap to run.'
    : d.joystick === 'free'
      ? 'Touch the screen and drag: the joystick appears under your thumb (in landscape, start on the left side). Push past the dashed ring to sprint.'
      : 'Drag the joystick to walk (in landscape it sits bottom-left). Push past the dashed ring to sprint.';

export const lessons: LessonDef[] = [
  {
    title: 'The goal',
    card: () => [
      'Grow your mart. Sell goods, earn Money and spend it on Pads to unlock new Stations.',
      'Buy the Pad of a new Area to open it up. Own everything and you hit 100% Completion.',
      'Then the Exit Pad finishes the Map and takes you to the next one.',
      'A few short Lessons show you how. Let’s go!',
    ],
    steps: [],
    nice: '',
  },
  {
    title: 'Move',
    card: (d) => [
      ...(d.touch
        ? [
            stick(d),
            'All ways to play are in Settings. Joystick: Fixed, Free or Off (Off means tap to walk, double-tap to run). Manual grab: in landscape, hold the right side of the screen to move Items; off, and it all happens on its own.',
          ]
        : [
            'Walk with WASD or the arrow keys. Hold Shift to sprint. You can also click the floor to walk there on your own, and double-click to run.',
            'Items move on their own when you stand near a Station. Prefer to do it yourself? Turn on Manual grab in Settings and hold Space.',
          ]),
      'Sprinting is fast, but a tall Stack wobbles when you run.',
    ],
    steps: [
      { line: 'Walk to the ring', target: WALK_TO, done: (w) => near(w, WALK_TO) },
      {
        line: (d) =>
          !d.touch
            ? 'Hold Shift and sprint to the ring'
            : d.joystick === 'off'
              ? 'Double-tap the floor and run to the ring'
              : 'Push past the dashed ring and sprint to the ring',
        target: SPRINT_TO,
        done: (w) => near(w, SPRINT_TO) && saw(w, 'sprinted'),
      },
    ],
    nice: 'You can move. On to the goods!',
  },
  {
    title: 'Crop to Shelf',
    card: () => [
      'Crops grow on their own. Walk up to the Tomato Bed to pick tomatoes onto your Stack.',
      'Then walk up to the Tomato Shelf to put them down. Customers only buy what is on the Shelves.',
    ],
    setup: (w) => {
      producer(w, 'tomato_bed').plants.fill(0);
      shelf(w, 'tomato_shelf').items = 0;
      w.money = 0;
    },
    steps: [
      { line: 'Pick up 3 tomatoes', target: 'tomato_bed', done: (w) => count(w, 'tomato') >= 3 },
      {
        line: 'Put them on the Tomato Shelf',
        target: 'tomato_shelf',
        done: (w) => shelf(w, 'tomato_shelf').items >= 3,
      },
    ],
    nice: 'The Shelf is stocked.',
  },
  {
    title: 'Register',
    card: () => [
      'A Customer is coming to shop. When they line up at the Register, stand behind it to check them out.',
      'Their payment lands in a Cash Pile beside the Register. Walk onto it to collect the Money.',
    ],
    setup: (w) => {
      shelf(w, 'tomato_shelf').items = 4;
      w.money = 0;
      callCustomer(w, 'tomato', 2);
    },
    steps: [
      { line: 'Stand behind the Register and check out the Customer', target: 'register', done: (w) => saw(w, 'paid') },
      {
        line: 'Collect the Cash Pile',
        target: (w) => cashPilePoint(w, 'register'),
        done: (w) => saw(w, 'cashCollect'),
      },
    ],
    // the Customer is gone and never paid
    fail: (w) => w.lesson?.step === 0 && !w.customers.length,
    nice: 'That is how Money comes in.',
  },
  {
    title: 'Pads',
    card: () => [
      'A yellow Pad is something you can buy. Stand on it and your Money drains into it until it is paid.',
      'Walk off and what you paid is kept. Buy the Egg Shelf now: you have just enough Money.',
    ],
    setup: (w) => {
      w.money = 10;
    },
    steps: [{ line: 'Stand on the Egg Shelf Pad', target: 'egg_shelf', done: (w) => w.owned.has('egg_shelf') }],
    nice: 'A new Shelf!',
  },
  {
    title: 'Animals',
    card: () => [
      'Animals need feeding. The Chicken Coop takes tomatoes and, after a few seconds, lays eggs on its Tray beside it.',
      'Buy the Coop, walk up to put your tomatoes in, then walk up again to take the eggs from the Tray.',
    ],
    setup: (w) => {
      w.money = 15;
      give(w, 'tomato', 3);
    },
    steps: [
      { line: 'Buy the Chicken Coop', target: 'chicken_coop', done: (w) => w.owned.has('chicken_coop') },
      { line: 'Put the tomatoes in the Coop', target: 'chicken_coop', done: (w) => saw(w, 'to:chicken_coop') },
      { line: 'Take the eggs from the Tray', target: 'chicken_coop', done: (w) => count(w, 'egg') > 0 },
    ],
    nice: 'Fresh eggs.',
  },
  {
    title: 'Machines',
    card: () => [
      'Machines turn one Product into another. The Blender turns tomatoes into ketchup, and the ketchup sells on its own Shelf.',
      'Buy the Ketchup Shelf and the Blender, load the Blender with tomatoes and take the ketchup.',
    ],
    setup: (w) => {
      w.money = 40;
      give(w, 'tomato', 4);
    },
    steps: [
      { line: 'Buy the Ketchup Shelf', target: 'ketchup_shelf', done: (w) => w.owned.has('ketchup_shelf') },
      { line: 'Buy the Blender', target: 'blender', done: (w) => w.owned.has('blender') },
      { line: 'Put the tomatoes in the Blender', target: 'blender', done: (w) => saw(w, 'to:blender') },
      { line: 'Take the ketchup', target: 'blender', done: (w) => count(w, 'ketchup') > 0 },
    ],
    nice: 'Ketchup is a good seller.',
  },
  {
    title: 'Tipping',
    card: () => [
      'A tall Stack wobbles, most of all when you sprint: Items fall off. One that survives is a Loose Item. Walk over it to pick it up again.',
      'One that breaks leaves a Mess. A Mess slows everyone and makes Customers lose patience.',
      'Empty your Stack into the Trash Bin by standing on it. Then take the Mop from the Mop Stand (it needs an empty Stack), clean the Mess and walk the Mop back.',
    ],
    setup: (w) => {
      w.money = 0;
      give(w, 'tomato', 8);
    },
    steps: [
      {
        line: 'Sprint with the full Stack until an Item falls',
        target: (w) => (w.player.x < (WALK_TO[0] + SPRINT_TO[0]) / 2 ? SPRINT_TO : WALK_TO),
        // a Lesson never waits on a random tip
        tick: (w, t) => {
          if (w.player.sprinting && t >= TUNING.lesson.tipAfter && w.loose.length + w.messes.length === 0)
            shed(w, w.player, { agent: 'player' }, true);
        },
        done: (w) => w.loose.length + w.messes.length > 0,
      },
      {
        line: 'Pick up the Loose Item',
        target: loosePoint,
        enter: (w) => {
          if (!w.loose.length) shed(w, w.player, { agent: 'player' }, true);
        },
        done: (w) => w.loose.length === 0,
      },
      { line: 'Empty your Stack into the Trash Bin', target: 'trash', done: (w) => w.player.stack.length === 0 },
      {
        line: 'Take the Mop from the Mop Stand',
        target: 'mop_stand',
        enter: (w) => {
          if (!w.messes.length) addMess(w, w.nextId++, MESS_AT[0], MESS_AT[1], ['tomato'], -1);
        },
        done: (w) => w.player.mop,
      },
      { line: 'Mop up the Mess', target: messPoint, done: (w) => w.messes.length === 0 },
      { line: 'Walk the Mop back to its stand', target: 'mop_stand', done: (w) => !w.player.mop },
    ],
    nice: 'Spotless.',
  },
];
