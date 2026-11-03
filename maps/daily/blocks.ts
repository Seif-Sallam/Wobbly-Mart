// The Daily Map generator's block geometry (src/sim/daily-map.ts). Every Area is a shop block with its farm yard
// behind, drawn in a local frame whose front (the Street side) is z = 0 and x runs across the front.
import type { Box, Point, Rot } from '../../src/sim/map';

export type Facing = 'N' | 'S' | 'W' | 'E';
export type Format = 'row' | 'column' | 'corner' | 'split' | 'courtyard' | 'kit';
export type Interior = 'aisles' | 'market' | 'columns' | 'staggered';

export const INTERIORS: Interior[] = ['aisles', 'market', 'columns', 'staggered'];

export const BLOCK = {
  shopDepth: 22,
  /** Shop + yard. */
  depth: 48,
  wall: 0.3,
  street: 4,
  /** Grass round the outermost block, road or Street. */
  margin: 4,
  /** Width across the front: Area 1, then the rest. */
  width: [16, 14],
  frontDoor: { x: [7, 3.5], w: 3 },
  backDoor: { x: [12.5, 6], w: 2.5 },
  /** A side door opens where a shop meets another Area's yard over at least `minOverlap`. */
  sideDoor: { w: 2.5, minOverlap: 4 },
  /** Yard packing: a half-metre scan from just behind the shop, keeping `clear` round everything. */
  yard: { from: 2.5, step: 0.5, edge: 0.5, clear: 1.6 },
  /** Road beside Area 1's yard: `gap` off the yard, `overhang` past each side. */
  road: { gap: 2, w: 4, overhang: 3 },
  carSpots: { n: 3, step: 3, pickup: 1.5, car: [3, 1.8] as Point, van: [3, 1.6] as Point },
};

/** Where each Area's unit sits per Format, in Area order. `kit` takes the facing the seed picks. */
export const FORMATS: Record<Format, { x: number; z: number; facing: Facing | null }[]> = {
  row: [
    { x: 0, z: 0, facing: 'N' },
    { x: 16, z: 0, facing: 'N' },
    { x: 30, z: 0, facing: 'N' },
  ],
  column: [
    { x: 0, z: 0, facing: 'W' },
    { x: 0, z: 16, facing: 'W' },
    { x: 0, z: 30, facing: 'W' },
  ],
  // shops along the north and down the west, yards in the inside corner
  corner: [
    { x: 0, z: 48, facing: 'W' },
    { x: 0, z: 0, facing: 'N' },
    { x: 14, z: 0, facing: 'N' },
  ],
  // Areas 1 and 2 face north onto a Street through the middle; Area 3 faces south from across it
  split: [
    { x: 0, z: 52, facing: 'N' },
    { x: 16, z: 52, facing: 'N' },
    { x: 0, z: 0, facing: 'S' },
  ],
  // a U of west, north and east shops round a shared yard
  courtyard: [
    { x: 0, z: 48, facing: 'W' },
    { x: 22, z: 0, facing: 'N' },
    { x: 48, z: 48, facing: 'E' },
  ],
  kit: [{ x: 0, z: 0, facing: null }],
};

/** Shelf slots by interior; all stay at z ≤ 13.5 (the strip behind is for Pads). */
export function shelfSlots(interior: Interior, w: number, first: boolean): { box: Box; rot: Rot }[] {
  const s = (x: number, z: number, rot: Rot = 0): { box: Box; rot: Rot } => ({
    box: rot === 90 || rot === 270 ? [x, z, 1, 3] : [x, z, 3, 1],
    rot,
  });
  const wide = w > BLOCK.width[1] ? 1 : 0;
  switch (interior) {
    case 'aisles':
      return [3.5, 8.5].flatMap((z) => [1, 5.5, 10].map((x) => s(x + wide, z)));
    case 'market':
      return [
        ...[3, 7.5, ...(first ? [] : [12])].map((z) => s(0.5, z, 90)),
        ...[3, 7.5, 12].map((z) => s(w - 1.5, z, 270)),
        s(w / 2 - 1.5, 5),
        s(w / 2 - 1.5, 10),
      ];
    case 'columns':
      return [3, 8.5].flatMap((z) => [1.5, 5, 8.5, 12].map((x) => s(x, z, 90)));
    case 'staggered':
      return [...[1, 5.5, 10].map((x) => s(x + wide, 3)), ...[3.25, 7.75].map((x) => s(x + wide, 8.5))];
  }
}

/** Area 1 keeps the Corner Shop's Register, Office and Mop Stand corner (local boxes). */
export const AREA_1 = {
  places: {
    register: { box: [8, 18.5, 2.6, 1] as Box, rot: 180 as Rot },
    cashier_1: { box: [8.8, 20.2, 1, 1] as Box, rot: 180 as Rot },
    office: { box: [2.5, 17.5, 1.5, 1] as Box, rot: 180 as Rot },
    mop_stand: { box: [5.5, 14.55, 1, 1] as Box, rot: 0 as Rot },
  },
  partitions: {
    partition_office_n1: [0.3, 14.2, 2.7, 0.3] as Box,
    partition_office_n2: [5, 14.2, 2.6, 0.3] as Box,
    partition_office_e: [7.3, 14.5, 0.3, 7.2] as Box,
  },
  officeDoor: [3, 14.2, 2, 0.3] as Box,
  props: {
    prop_bookshelf: { model: 'bookshelf', box: [0.4, 17, 0.5, 3] as Box, rot: 90 as Rot },
    prop_sofa: { model: 'sofa', box: [5.8, 17.8, 1.2, 2.6] as Box, rot: 270 as Rot },
    prop_rug: { model: 'rug', box: [2, 19, 3, 1.8] as Box, rot: 0 as Rot, flat: true },
  },
  waitingSpots: [
    [8.5, 12.8],
    [7.5, 12.8],
    [6.5, 12.8],
    [5.5, 12.8],
  ] as Point[],
  playerStart: [4, 12] as Point,
  /** Kit only: its one Stocker Pad, beside the Register. */
  kitStocker: [12.5, 20.3, 1, 1] as Box,
};

/** Pad spots in a shop's service strip: the next Area's Pad (from the right edge) and Area 2's Stocker. */
export const STRIP = {
  areaPad: { fromRight: 2, z: 16.5 },
  stocker: [2, 16.5, 1, 1] as Box,
  trash: { fromRight: 1.5, z: 0.5 },
};

/** Props: trees and bushes on grass, pots and coolers in shop corners, flowers in yards. */
export const PROPS = {
  treeGap: 1,
  propGap: 0.5,
  bigShare: 0.6,
  tries: 400,
  indoorGap: 0.8,
  doorGap: 1.5,
  plantShare: 0.65,
  bushShare: 0.6,
  /** Corner spots, local; `w` is the shop's width. */
  corners: (w: number): Box[] => [
    [0.4, 0.4, 0.6, 0.6],
    [w - 1, 14.5, 0.6, 0.6],
    [w - 1, BLOCK.shopDepth - 1, 0.6, 0.6],
    [0.4, BLOCK.shopDepth - 1, 0.6, 0.6],
    [w / 2 - 0.3, BLOCK.shopDepth - 1, 0.6, 0.6],
  ],
  flower: 0.6,
  flowerClear: 1.2,
};
