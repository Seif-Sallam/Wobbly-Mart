import type { Box, MapDef, Point, Rot } from './map';
import type { Grid } from './nav';
import type { MapSave } from './save';
import { TUNING } from './tuning';
import { FEEL } from '../feel';
import { applySave, own, refreshFreeStations, applyCommands, updateTutorial, checkCompletion } from './economy';
import { updatePlayer } from './player';
import { updateProducers } from './producers';
import { updateCustomers } from './customers';
import { updateStaff } from './staff';
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
}

export type Player = Mover & Carrier;

export interface Job {
  sink: string;
  source: string | null;
  product: string;
  need: number;
}

export interface Stocker extends Mover, Carrier {
  id: string;
  assignment: string | null;
  job: Job | null;
  rethink: number;
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
  kind: 'office' | 'trash' | 'exit';
}

export type Station = ShelfStation | ProducerStation | RegisterStation | SimpleStation;

export interface Mess {
  id: number;
  x: number;
  z: number;
  items: string[];
}

export interface Drain {
  register: string;
  amount: number;
  given: number;
  t: number;
  duration: number;
}

export type Ref = { agent: 'player' } | { agent: 'stocker'; id: string } | { station: string } | { customer: number };

export type SimEvent =
  | { type: 'transfer'; product: string; from: Ref; to: Ref }
  | { type: 'trashed'; product: string; from: Ref }
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
  | { type: 'customerLeft'; customer: number }
  | { type: 'tutorialDone' }
  | { type: 'complete' };

export interface Intents {
  /** World-space direction, length ≤ 1. */
  move: { x: number; z: number };
  /** Manual Grab Mode: transfers only while held. */
  grab: boolean;
  manualGrab?: boolean;
  buyUpgrade?: string;
  assign?: { stocker: string; product: string | null };
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
  messes: Mess[];
  drains: Drain[];
  events: SimEvent[];
  pan: { area: string; t: number; duration: number } | null;
  arrivalTimer: number;
  tutorial: { done: boolean; actions: Set<string> };
  complete: boolean;
  atOffice: boolean;
  atExit: boolean;
  nav: Nav;
  navDirty: boolean;
}

export const DT = 1 / TUNING.tickRate;

export const newCarrier = (): Carrier => ({
  stack: [],
  timer: 0,
  dropInterval: TUNING.dropInterval,
  at: null,
  fullWarned: false,
});

/** An Opening: fresh from a save (or a new game when `save` is null). */
export function createWorld(map: MapDef, save: MapSave | null, seed: number, tutorialDone = false): World {
  const [px, pz] = map.layout.playerStart;
  const w: World = {
    map,
    t: 0,
    rng: seed,
    money: map.start.money,
    owned: new Set(),
    paid: {},
    levels: {},
    player: { x: px, z: pz, vx: 0, vz: 0, ...newCarrier() },
    stations: new Map(),
    customers: [],
    nextId: 1,
    stockers: [],
    cashiers: [],
    messes: [],
    drains: [],
    events: [],
    pan: null,
    arrivalTimer: 0,
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
  if (save) applySave(w, save);
  else w.pan = { area: map.start.owned[0], t: 0, duration: 2 * FEEL.panGlide + FEEL.panHold };
  refreshFreeStations(w);
  w.complete = checkCompletion(w, false);
  w.events = [];
  rebuildNav(w);
  return w;
}

/** One fixed timestep. `w.events` holds only this step's events afterwards. */
export function step(w: World, intents: Intents): void {
  w.events = [];
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
  updateTutorial(w);
  w.complete = checkCompletion(w, true);
  if (w.navDirty) rebuildNav(w);
}
