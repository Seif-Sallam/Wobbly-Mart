import type { Product } from '../../catalog/products';
import type { ProducerType } from '../../catalog/producers';

/** [x, z, w, d] in metres: top-left corner (x east, z south) and size. */
export type Box = [number, number, number, number];
export type Point = [number, number];
/** Degrees about the vertical axis; 0 = front faces south (+z), 90 = east, 180 = north, 270 = west. */
export type Rot = 0 | 90 | 180 | 270;

export interface Placement {
  box: Box;
  rot: Rot;
}

export type WallKind = 'tall' | 'low' | 'partition' | 'window';
export type DoorKind = 'customer' | 'back' | 'office';

export interface PropDef {
  model: string;
  box: Box;
  rot: Rot;
  solid: boolean;
  area?: string;
  party?: boolean;
}

/** Editor-owned: everything that has a place on the map. */
export interface MapLayout {
  size: [number, number];
  areas: Record<string, Box[]>;
  places: Record<string, Placement>;
  walls: Record<string, { kind: WallKind; box: Box }>;
  doors: Record<string, { kind: DoorKind; box: Box }>;
  props: Record<string, PropDef>;
  floors: Box[];
  street: Box[];
  roads: Box[];
  streetSpots: Point[];
  waitingSpots: Point[];
  carSpots: { car: Box; pickup: Box }[];
  van: Box;
  playerStart: Point;
}

export type StationDef =
  | { kind: 'shelf'; product: string }
  | { kind: 'producer'; type: string }
  /** `cashPileFlipped`: the Cash Pile sits at the counter's other end (when its usual end is against a wall). */
  | { kind: 'register'; queueLength: number; cashPileFlipped?: boolean }
  | { kind: 'office' }
  | { kind: 'trash' }
  | { kind: 'mopStand' }
  | { kind: 'cleaner' }
  | { kind: 'cashier'; register: string }
  | { kind: 'stocker' }
  | { kind: 'area'; area: string }
  | { kind: 'exit' };

export type StationKind = StationDef['kind'];

/** A Pad: bought by standing on it. `requires`: ids that must be owned; `upgradeId:level` names an Upgrade level. */
export interface PadDef {
  cost: number;
  requires: string[];
  unlocks: StationDef;
}

/** A Station that appears for free once its requirements are met (Trash Bin, Mop Stand). */
export interface FreeStationDef {
  requires: string[];
  unlocks: StationDef;
}

export type UpgradeFamily = 'player' | 'station' | 'staff';
export type UpgradeStat = 'speed' | 'stack' | 'checkoutTime' | 'carry' | 'workTime' | 'safe' | 'cleanTime';

export interface UpgradeDef {
  name: string;
  family: UpgradeFamily;
  /** 'player' | 'cashier' | 'stocker' | a Producer type id. */
  target: string;
  stat: UpgradeStat;
  levels: { cost: number; value: number }[];
  requires: string[];
}

export interface TutorialStep {
  /** Done once this id is owned … */
  pad?: string;
  /** … or once this action happened this session. */
  action?: 'pick' | 'drop' | 'checkout' | 'collect' | 'upgrade';
  station?: string;
}

export interface MapDef {
  id: string;
  name: string;
  layout: MapLayout;
  products: Record<string, Product>;
  producers: Record<string, ProducerType>;
  pads: Record<string, PadDef>;
  freeStations: Record<string, FreeStationDef>;
  upgrades: Record<string, UpgradeDef>;
  start: { owned: string[]; money: number };
  tutorial: TutorialStep[];
}

/** Model name a Station is drawn with (asset table key). Staff, Area Pads draw no Station. */
export function stationModel(map: MapDef, def: StationDef): string | null {
  switch (def.kind) {
    case 'shelf':
      return map.products[def.product]?.shelf ?? null;
    case 'producer':
      return map.producers[def.type]?.model ?? null;
    case 'register':
    case 'office':
    case 'trash':
    case 'exit':
      return def.kind;
    case 'mopStand':
      return 'mop-cart';
    default:
      return null;
  }
}
