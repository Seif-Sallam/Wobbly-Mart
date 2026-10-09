import type { Box, MapDef, Placement, Point, Rot } from './map';
import type { Grid } from './nav';
import type { MapSave } from './save';
import { TUNING } from './tuning';
import {
  applySave,
  panDuration,
  own,
  refreshFreeStations,
  applyCommands,
  updateTutorial,
  checkCompletion,
} from './economy';
import { updatePlayer } from './player';
import { updateProducers } from './producers';
import { updateCustomers } from './customers';
import { updateStaff } from './staff';
import { updateCleaners } from './cleaning';
import { addPickups, thiefFreeze, updateEvents } from './events';
import { rebuildNav } from './walk';

export interface Mover {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

/** Anything that carries a Stack and moves Items by proximity. */
export interface Carrier {
  stack: string[];
  timer: number;
  dropInterval: number;
  at: string | null;
  fullWarned: boolean;
  /** Seconds before the Stack may tip again. */
  dropCooldown: number;
}

export type Player = Mover &
  Carrier & {
    trashHold: number;
    sprinting: boolean;
    jolt: number;
    /** Holding the Mop: nothing transfers until it is walked back to the Mop Stand. */
    mop: boolean;
    atMopStand: boolean;
  };

export interface Job {
  sink: string;
  source: string | null;
  product: string;
  need: number;
  /** Put leftovers back on the sink's Tray. */
  tray?: boolean;
}

export type StockerRole = 'auto' | 'goods' | 'machines';
export const STOCKER_ROLES: StockerRole[] = ['auto', 'goods', 'machines'];

export interface Stocker extends Mover, Carrier {
  id: string;
  role: StockerRole;
  job: Job | null;
  rethink: number;
  /** Seconds the whole Stack has been leftovers nothing needs, or null. */
  leftover: number | null;
}

/** Staff with its own mop: wanders the shop floors, rushes to Messes. */
export interface Cleaner extends Mover {
  id: string;
  /** A wander spot, while no Mess waits. */
  spot: Point | null;
  /** Seconds left mopping a spot for show. */
  show: number;
  mopping: boolean;
}

export interface Cashier {
  id: string;
  register: string;
  x: number;
  z: number;
}

export interface ListEntry {
  product: string;
  shelf: string;
  want: number;
  got: number;
}

export type CustomerState = 'shop' | 'queue' | 'leave' | 'gone';

export interface Customer extends Mover {
  id: number;
  state: CustomerState;
  list: ListEntry[];
  li: number;
  cart: string[];
  spot: Point;
  home: Point;
  register: string | null;
  waiting: boolean;
  takeTimer: number;
  patience: number;
  patienceLimit: number;
  angry: boolean;
  happy: boolean;
  look: number;
}

interface StationBase {
  id: string;
  box: Box;
  rot: Rot;
}

export interface ShelfStation extends StationBase {
  kind: 'shelf';
  product: string;
  items: number;
}

export interface ProducerStation extends StationBase {
  kind: 'producer';
  type: string;
  input: Record<string, number>;
  tray: number;
  work: number;
  /** Crop plants: seconds until ripe (0 = ripe). */
  plants: number[];
}

export interface RegisterStation extends StationBase {
  kind: 'register';
  cash: number;
  queue: number[];
  queueLength: number;
  progress: number;
}

export interface SimpleStation extends StationBase {
  kind: 'office' | 'trash' | 'exit' | 'mopStand';
}

export interface OrderLine {
  product: string;
  want: number;
  got: number;
}

/** A car parked at a Car Spot with its order; `t` counts up to `time`. */
export interface Delivery {
  order: OrderLine[];
  t: number;
  time: number;
  /** 0–1: the car's colour and wonk. */
  look: number;
  honked: boolean;
}

/** A Car Spot's pickup tile: walkable, takes the waiting car's wanted Items like a Shelf. */
export interface PickupStation extends StationBase {
  kind: 'pickup';
  /** The Car Spot's bay, where the car parks. */
  car: Box;
  delivery: Delivery | null;
}

export type Station = ShelfStation | ProducerStation | RegisterStation | SimpleStation | PickupStation;

export interface Mess {
  id: number;
  x: number;
  z: number;
  items: string[];
  /** Mopped so far, 0–1; walking off keeps it. */
  progress: number;
}

/** An Item dropped while sprinting: lies where it landed until the Player walks over it. */
export interface LooseItem {
  id: number;
  x: number;
  z: number;
  product: string;
}

export type ThiefState = 'enter' | 'grab' | 'run' | 'leave';

/** A Robbery's Thief: walks in like a Customer, grabs from `target`, runs for `door`. */
export interface Thief extends Mover {
  state: ThiefState;
  /** A Shelf, or a Register whose Cash Pile they rob. */
  target: string;
  carry: string[];
  cash: number;
  t: number;
  door: Point;
  home: Point;
  look: number;
  caught: boolean;
}

export type InspectorState = 'warn' | 'enter' | 'visit' | 'leave';

/** The Health Inspector: a warning, then 4–6 stops; `alone` counts up while the Player is too far. */
export interface Inspector extends Mover {
  state: InspectorState;
  /** Seconds left: of the warning, or at the current stop. */
  t: number;
  door: Point;
  home: Point;
  stops: string[];
  stop: number;
  /** At a stop: whether it looked clean, null while walking. */
  clean: boolean | null;
  alone: number;
  review: boolean;
}

export interface Drain {
  register: string;
  amount: number;
  given: number;
  t: number;
  duration: number;
}

export type Ref =
  | { agent: 'player' }
  | { agent: 'thief' }
  | { agent: 'stocker'; id: string }
  | { station: string }
  | { customer: number }
  | { loose: number };

export type SimEvent =
  | { type: 'transfer'; product: string; from: Ref; to: Ref }
  | { type: 'trashed'; product: string; from: Ref; station: string }
  | { type: 'stackFull' }
  | { type: 'padPaying'; pad: string }
  | { type: 'padBought'; pad: string }
  | { type: 'areaBought'; area: string }
  | { type: 'upgradeBought'; upgrade: string }
  | { type: 'produced'; station: string }
  | { type: 'paid'; register: string; customer: number; amount: number }
  | { type: 'cashCollect'; register: string; amount: number; duration: number }
  | { type: 'angry'; customer: number }
  | { type: 'mess'; mess: number; customer: number }
  | { type: 'messCleared'; mess: number }
  | { type: 'mop'; taken: boolean }
  | { type: 'customerLeft'; customer: number }
  | { type: 'deliveryArrived'; station: string }
  | { type: 'deliveryHonk'; station: string }
  | { type: 'deliveryDone'; station: string; amount: number; tip: number; complete: boolean }
  | { type: 'thiefGrab' }
  /** `amount`: the bounty, or what got away; `cash`: Cash Pile money returned or lost. */
  | { type: 'robberyDone'; caught: boolean; amount: number; cash: number }
  | { type: 'inspectorWarning' }
  | { type: 'inspectorMark'; clean: boolean }
  | { type: 'inspection'; review: boolean; messes: number; loose: number; amount: number }
  | { type: 'tutorialDone' }
  | { type: 'complete' };

export interface Intents {
  /** World-space direction, length ≤ 1. */
  move: { x: number; z: number };
  /** Manual Grab Mode: transfers only while held. */
  grab: boolean;
  manualGrab?: boolean;
  sprint?: boolean;
  buyUpgrade?: string;
  assign?: { stocker: string; role: StockerRole };
}

export interface Nav {
  walker: Grid;
  shopper: Grid;
  fields: Map<string, Float32Array>;
  solids: Box[];
}

export interface World {
  map: MapDef;
  t: number;
  rng: number;
  /** Events roll on their own stream, so they never shift Customers, tipping or Staff. */
  eventRng: { rng: number };
  money: number;
  owned: Set<string>;
  paid: Record<string, number>;
  levels: Record<string, number>;
  player: Player;
  stations: Map<string, Station>;
  customers: Customer[];
  nextId: number;
  stockers: Stocker[];
  cashiers: Cashier[];
  cleaners: Cleaner[];
  /** Edit Layout: places moved away from the map's, and Moves bought so far. */
  placed: Record<string, Placement>;
  movesUsed: number;
  messes: Mess[];
  loose: LooseItem[];
  drains: Drain[];
  events: SimEvent[];
  pan: { area: string; t: number; duration: number } | null;
  arrivalTimer: number;
  /** Seconds until the next Delivery car; null until Deliveries unlock (rolled then). */
  carWait: number | null;
  /** Seconds until the next Robbery or Inspector visit; null while one runs or before they unlock. */
  visitWait: number | null;
  thief: Thief | null;
  inspector: Inspector | null;
  /** Thief Pan: the game freezes while the camera glides to the Thief and holds. */
  thiefPan: { t: number; duration: number } | null;
  tutorial: { done: boolean; actions: Set<string> };
  complete: boolean;
  atOffice: boolean;
  atExit: boolean;
  nav: Nav;
  navDirty: boolean;
}

export const DT = 1 / TUNING.tickRate;
const EVENT_SEED = 0x5eed;

export const newCarrier = (): Carrier => ({
  stack: [],
  timer: 0,
  dropInterval: TUNING.dropInterval,
  at: null,
  fullWarned: false,
  dropCooldown: 0,
});

/** An Opening: fresh from a save (or a new game when `save` is null). */
export function createWorld(map: MapDef, save: MapSave | null, seed: number, tutorialDone = false): World {
  const [px, pz] = map.layout.playerStart;
  const w: World = {
    // the World's own places: Edit Layout moves fixtures without touching the map data
    map: { ...map, layout: { ...map.layout, places: { ...map.layout.places } } },
    t: 0,
    rng: seed,
    eventRng: { rng: seed ^ EVENT_SEED },
    money: map.start.money,
    owned: new Set(),
    paid: {},
    levels: {},
    player: {
      x: px,
      z: pz,
      vx: 0,
      vz: 0,
      trashHold: 0,
      sprinting: false,
      jolt: 0,
      mop: false,
      atMopStand: false,
      ...newCarrier(),
    },
    stations: new Map(),
    customers: [],
    nextId: 1,
    stockers: [],
    cashiers: [],
    cleaners: [],
    placed: {},
    movesUsed: 0,
    messes: [],
    loose: [],
    drains: [],
    events: [],
    pan: null,
    arrivalTimer: 0,
    carWait: null,
    visitWait: null,
    thief: null,
    inspector: null,
    thiefPan: null,
    tutorial: { done: tutorialDone || map.tutorial.length === 0, actions: new Set() },
    complete: false,
    atOffice: false,
    atExit: false,
    nav: {
      walker: { cell: 1, w: 0, h: 0, free: new Uint8Array() },
      shopper: { cell: 1, w: 0, h: 0, free: new Uint8Array() },
      fields: new Map(),
      solids: [],
    },
    navDirty: true,
  };
  for (const id of map.start.owned) own(w, id, false);
  addPickups(w);
  if (save) applySave(w, save);
  else w.pan = { area: map.start.owned[0], t: 0, duration: panDuration() };
  refreshFreeStations(w);
  w.complete = checkCompletion(w, false);
  w.events = [];
  rebuildNav(w);
  return w;
}

/** One fixed timestep. `w.events` holds only this step's events afterwards. */
export function step(w: World, intents: Intents): void {
  w.events = [];
  if (w.thiefPan) {
    w.thiefPan.t += DT;
    const frozen = w.thiefPan.t < thiefFreeze();
    if (w.thiefPan.t >= w.thiefPan.duration) w.thiefPan = null;
    if (frozen) return;
  }
  w.t += DT;
  applyCommands(w, intents);
  if (w.pan) {
    w.pan.t += DT;
    if (w.pan.t >= w.pan.duration) w.pan = null;
  }
  updatePlayer(w, intents);
  updateProducers(w);
  updateCustomers(w);
  updateStaff(w);
  updateCleaners(w);
  updateEvents(w);
  updateTutorial(w);
  w.complete = checkCompletion(w, true);
  if (w.navDirty) rebuildNav(w);
}
