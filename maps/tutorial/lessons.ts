// The Lessons as data, then the closing card: card copy, setup, steps (target + goal) and what counts as going wrong.
// The runner is src/sim/lessons.ts.
import type { Placement, Point } from '../../src/sim/map';
import type { PickupStation, ProducerStation, ShelfStation, World } from '../../src/sim/world';
import type { LessonDef, LessonDevice } from '../../src/sim/lessons';
import { near, saw } from '../../src/sim/lessons';
import { callCustomer } from '../../src/sim/customers';
import { addMess } from '../../src/sim/cleaning';
import { shed } from '../../src/sim/carry';
import { cashPilePoint } from '../../src/sim/economy';
import { callDelivery } from '../../src/sim/events';
import { startRobbery } from '../../src/sim/robbery';
import { startInspector } from '../../src/sim/inspector';
import { callChallenge } from '../../src/sim/challenges';
import { boxCentre } from '../../src/sim/geometry';
import { TUNING } from '../../src/sim/tuning';
import { layout } from './layout';

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
// Lesson 9: the outline Edit Layout shows, just inside the back door on the way to the Chicken Coop
const EGG_SPOT: Placement = { box: [10, 10, 3, 1], rot: 0 };
// Lesson 13: the scripted Challenge (each Customer buys `buys` tomatoes) and the Objective's head start
const CHALLENGE = { goal: 3, time: 60, buys: 2 };
const OBJECTIVE_HEAD_START = 8;

const noTarget = (): null => null;
const eggMoved = (w: World): boolean => {
  const egg = w.stations.get('egg_shelf');
  const home = layout.places.egg_shelf;
  return !!egg && (egg.rot !== home.rot || egg.box.some((v, i) => v !== home.box[i]));
};
const pickupPoint = (w: World): Point | null => {
  const car = [...w.stations.values()].find((s): s is PickupStation => s.kind === 'pickup' && !!s.delivery);
  return car ? boxCentre(car.box) : null;
};
const thiefPoint = (w: World): Point | null => (w.thief ? [w.thief.x, w.thief.z] : null);
const inspectorPoint = (w: World): Point | null => {
  const ins = w.inspector;
  return ins ? (ins.state === 'warn' ? ins.door : [ins.x, ins.z]) : null;
};

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
      'Buy the Coop and walk up: your tomatoes go in. When you come back, you take the eggs from the Tray first (if your Stack has room), and only then does it take more tomatoes.',
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
  {
    title: 'Office',
    card: () => [
      'The Office is where you run the mart. Buy it, then stand beside it: its panel opens.',
      'Upgrades last for good: walk faster, carry more. Buy one with the Money you have.',
    ],
    setup: (w) => {
      w.money = 30;
    },
    steps: [
      { line: 'Buy the Office', target: 'office', done: (w) => w.owned.has('office') },
      { line: 'Buy an Upgrade in the Office panel', target: 'office', done: (w) => saw(w, 'upgradeBought') },
    ],
    nice: 'Stronger already.',
  },
  {
    title: 'Edit Layout',
    card: () => [
      'Edit Layout lets you move Shelves, Registers and machines. Open it from the Office panel.',
      'Tap a fixture to pick it up, drag it or tap a new spot, then press Done. Green means it fits; red says why not.',
      'Moves are free here. On real Maps every Move costs Money, and each Area allows only a few.',
    ],
    steps: [
      { line: 'Open Edit Layout from the Office panel', target: 'office', done: (w) => saw(w, 'ui:layoutOpen') },
      {
        line: 'Move the Egg Shelf (the outline is a good spot), then press Done',
        target: boxCentre(EGG_SPOT.box),
        ghost: { station: 'egg_shelf', spot: EGG_SPOT },
        done: (w) => eggMoved(w) && saw(w, 'ui:layoutClosed'),
      },
    ],
    // left Edit Layout without moving the Egg Shelf
    fail: (w) => w.lesson?.step === 1 && saw(w, 'ui:layoutClosed') && !eggMoved(w),
    nice: 'Everything has its place.',
  },
  {
    title: 'Staff',
    card: () => [
      'Staff work for you. A Cashier checks Customers out at the Register. A Stocker carries goods from crops and machines to the Shelves.',
      'In the Office panel you give each Stocker a job: Auto, Goods or Machines.',
    ],
    setup: (w) => {
      w.money = 65;
    },
    steps: [
      { line: 'Hire the Cashier', target: 'cashier_1', done: (w) => w.owned.has('cashier_1') },
      { line: 'Hire the Stocker', target: 'stocker_1', done: (w) => w.owned.has('stocker_1') },
      {
        line: 'In the Office panel, give the Stocker a job other than Auto',
        target: 'office',
        done: (w) => !!w.stockers[0] && w.stockers[0].role !== 'auto',
      },
    ],
    nice: 'Two helping hands.',
  },
  {
    title: 'Events',
    card: () => [
      'Now and then something happens. Each Event is a chance to earn, and missing one costs you nothing here.',
      'A Delivery car parks out back with an order. A Thief grabs goods and runs for the door. The Health Inspector walks the shop and wants to find it clean.',
      'We will try them one at a time.',
    ],
    steps: [
      {
        line: 'A Delivery! Tap its card to walk to the car',
        target: pickupPoint,
        hud: 'delivery',
        enter: (w) => callDelivery(w, 'tomato', 2),
        done: (w) => saw(w, 'ui:deliveryCard'),
      },
      {
        line: 'Hand the order over at the car',
        target: pickupPoint,
        enter: (w) => give(w, 'tomato', 2),
        done: (w) => saw(w, 'deliveryDone'),
      },
      {
        line: 'A Thief! Catch them before they reach the door',
        target: thiefPoint,
        enter: (w) => {
          shelf(w, 'tomato_shelf').items = 6;
          startRobbery(w);
        },
        done: (w) => saw(w, 'robberyDone') && !w.thief,
      },
      {
        line: 'The Inspector is coming. Stay close as they look around',
        target: inspectorPoint,
        enter: (w) => startInspector(w),
        done: (w) => saw(w, 'inspection') && !w.inspector,
      },
    ],
    // the car left unfilled, the Thief got away, the Inspector was left alone
    fail: (w) =>
      w.events.some(
        (e) =>
          (e.type === 'deliveryDone' && !e.complete) ||
          (e.type === 'robberyDone' && !e.caught) ||
          (e.type === 'inspection' && e.review),
      ),
    nice: 'You handled them all.',
  },
  {
    title: 'Closed',
    card: () => [
      'The Office can close the store. While it is closed no new Customers come in, so you can catch up. Those inside finish shopping.',
      `Once closed, you can reopen after ${TUNING.closed.reopenWait} seconds. Once open, you can close again after ${TUNING.closed.closeWait / 60} minutes.`,
    ],
    setup: (w) => {
      w.closed = false;
      w.closedWait = 0;
    },
    steps: [
      { line: 'Close the store in the Office panel', target: 'office', done: (w) => w.closed },
      { line: 'Wait for the timer, then open the store again', target: 'office', done: (w) => !w.closed },
    ],
    nice: 'Open for business.',
  },
  {
    title: 'Objectives & Challenges',
    card: () => [
      'Every Map has Objectives: goals like “Sell 100 Eggs”. Each one done earns ⭐ Score and counts toward Completion, so 100% needs them all.',
      'Now and then a Challenge pops up: a quick task against the clock. Win it for ⭐ Score and a little Money. Miss it and you lose nothing. Score never goes down.',
      'Tap 🏆 (desktop: click) any time to see your Objectives and Stats.',
      'Here it is practice: the tutorial keeps no Score. On every real Map your Score is saved and adds up to your 🏆 total on the title screen.',
    ],
    setup: (w) => {
      w.money = 0;
      shelf(w, 'tomato_shelf').items += CHALLENGE.goal * CHALLENGE.buys;
      // the Objective "Sell 10 Tomatoes" starts two sales from done
      w.stats.sold.tomato = Math.max(w.stats.sold.tomato ?? 0, OBJECTIVE_HEAD_START);
    },
    steps: [
      {
        line: 'Win the Challenge, then open 🏆',
        target: 'register',
        enter: (w) => callChallenge(w, 'checkout', CHALLENGE.goal, CHALLENGE.time),
        // the Lesson sends the Customers
        tick: (w) => {
          const c = w.challenge;
          if (c && c.progress + w.customers.length < c.goal) callCustomer(w, 'tomato', CHALLENGE.buys);
        },
        done: (w) => saw(w, 'challengeWon'),
      },
      { line: 'Tap 🏆 to open the Logbook', target: noTarget, hud: 'trophy', done: (w) => saw(w, 'ui:logbookOpen') },
      { line: 'Look around, then close the Logbook', target: noTarget, done: (w) => saw(w, 'ui:logbookClosed') },
    ],
    fail: (w) => saw(w, 'challengeFailed'),
    retry: 'Time up, try again',
    nice: 'That’s how you climb the 🏆 total on the title screen.',
  },
  {
    title: 'The finish',
    card: () => [
      'Buy the Area 2 Pad: the camera shows what you opened up. Watch your Completion bar jump, the Objective included.',
      'When the whole Map is yours, the Exit Pad finishes it. Buy the Exit Pad and the car drives off.',
    ],
    setup: (w) => {
      w.money = 80;
    },
    steps: [
      { line: 'Buy Area 2', target: 'area_2', done: (w) => w.owned.has('area_2') },
      { line: 'Watch your Completion jump', target: 'area_2', done: (w) => !w.pan },
      { line: 'Buy the Exit Pad', target: 'exit', done: (w) => w.owned.has('exit') },
    ],
    nice: 'Off you go!',
  },
  {
    title: 'Tutorial complete',
    card: () => ['You know the ropes. Time to run a real mart!', 'From here on your progress and Score are saved.'],
    steps: [],
    nice: '',
  },
];
