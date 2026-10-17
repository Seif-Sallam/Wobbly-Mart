// PROTOTYPE (prototype/tutorial-layout): three Tutorial Map shapes, picked by ?tlayout=A|B|C|saved (TLAYOUT=… in
// scripts). `saved` is whatever the layout editor last wrote to layout.ts; the editor refines any shape from here.
import type { MapLayout } from '../../src/sim/map';
import { layout as saved } from './layout';

/** A — Lesson Trail: one long shop strip; each Lesson's Station sits a few steps east of the last. */
const trail: MapLayout = {
  size: [40, 30],
  areas: {
    area_1: [[4, 4, 26, 22]],
    area_2: [[30, 4, 8, 22]],
  },
  places: {
    register: { box: [5, 9, 2.6, 1], rot: 180 },
    cashier_1: { box: [5.8, 10.7, 1, 1], rot: 180 },
    tomato_shelf: { box: [9.5, 6, 3, 1], rot: 0 },
    egg_shelf: { box: [17.5, 6, 3, 1], rot: 0 },
    blender: { box: [22.5, 5.5, 2, 2.5], rot: 0 },
    ketchup_shelf: { box: [26, 6, 3, 1], rot: 0 },
    mop_stand: { box: [13.5, 12.5, 1, 1], rot: 0 },
    trash: { box: [17, 12.5, 1, 1], rot: 0 },
    stocker_1: { box: [21, 11.5, 1, 1], rot: 0 },
    office: { box: [24.5, 12, 1.5, 1], rot: 180 },
    area_2: { box: [28.5, 10, 1, 1], rot: 0 },
    tomato_bed: { box: [5, 15.5, 4, 2.4], rot: 180 },
    chicken_coop: { box: [16, 15.5, 3, 4.1], rot: 180 },
    exit: { box: [34, 21, 1, 1], rot: 0 },
  },
  walls: {
    wall_n1: { kind: 'tall', box: [4, 4, 9, 0.3] },
    wall_n2: { kind: 'tall', box: [16, 4, 14, 0.3] },
    wall_w: { kind: 'tall', box: [4, 4.3, 0.3, 9.4] },
    lowwall_s1: { kind: 'low', box: [4.3, 13.7, 4.7, 0.3] },
    lowwall_s2: { kind: 'low', box: [11.5, 13.7, 18.5, 0.3] },
  },
  doors: {
    door_n1: { kind: 'customer', box: [13, 4, 3, 0.3] },
    door_back1: { kind: 'back', box: [9, 13.7, 2.5, 0.3] },
  },
  props: {
    prop_rug: { model: 'rug', box: [23.8, 11.4, 3, 1.8], rot: 0, solid: false, area: 'area_1' },
    prop_plant_1: { model: 'plant', box: [27, 12.9, 0.6, 0.6], rot: 0, solid: true, area: 'area_1' },
    prop_tree_1: { model: 'tree-oak', box: [32, 8, 2, 2], rot: 0, solid: true, area: 'area_2' },
    prop_tree_2: { model: 'tree', box: [35, 13, 2, 2], rot: 90, solid: true, area: 'area_2' },
    prop_flower_1: { model: 'flower', box: [31.5, 18, 1, 1], rot: 0, solid: false, area: 'area_2' },
    prop_bush_1: { model: 'bush', box: [1, 18, 1, 1], rot: 0, solid: true },
    party_flag_1: { model: 'flag', box: [36, 20, 1, 1], rot: 0, solid: false, party: true },
    party_banner_1: { model: 'banner-red', box: [8, 4.3, 1, 0.4], rot: 0, solid: false, party: true },
  },
  floors: [[4, 4, 26, 10]],
  street: [[0, 0, 40, 4]],
  roads: [[0, 26, 40, 4]],
  streetSpots: [
    [2, 2],
    [38, 2],
  ],
  waitingSpots: [
    [9, 9.5],
    [10, 9.5],
    [11, 9.5],
    [12, 9.5],
  ],
  carSpots: [
    { car: [3, 26.6, 3, 1.8], pickup: [3.8, 22, 1.5, 1.5] },
    { car: [7, 26.6, 3, 1.8], pickup: [7.8, 22, 1.5, 1.5] },
  ],
  van: [22, 26.6, 3, 1.6],
  playerStart: [9, 9],
};

/** B — Open Plaza: one small square with low walls only, so every Station is on screen from anywhere. */
const plaza: MapLayout = {
  size: [28, 26],
  areas: {
    area_1: [[4, 4, 16, 18]],
    area_2: [[20, 4, 6, 18]],
  },
  places: {
    tomato_shelf: { box: [5.5, 5.5, 3, 1], rot: 0 },
    egg_shelf: { box: [10, 5.5, 3, 1], rot: 0 },
    ketchup_shelf: { box: [14.5, 5.5, 3, 1], rot: 0 },
    trash: { box: [19, 4.5, 1, 1], rot: 0 },
    blender: { box: [15, 9, 2, 2.5], rot: 0 },
    register: { box: [5.5, 10, 2.6, 1], rot: 180 },
    cashier_1: { box: [6.3, 11.7, 1, 1], rot: 180 },
    mop_stand: { box: [19, 7.5, 1, 1], rot: 0 },
    stocker_1: { box: [13, 13, 1, 1], rot: 0 },
    office: { box: [18, 13.5, 1.5, 1], rot: 180 },
    tomato_bed: { box: [5, 16, 4, 2.4], rot: 180 },
    chicken_coop: { box: [11, 16, 3, 4.1], rot: 180 },
    area_2: { box: [18.5, 17, 1, 1], rot: 0 },
    exit: { box: [23, 18, 1, 1], rot: 0 },
  },
  walls: {
    lowwall_n: { kind: 'low', box: [4, 4, 16, 0.3] },
    lowwall_w1: { kind: 'low', box: [4, 4.3, 0.3, 1.7] },
    lowwall_w2: { kind: 'low', box: [4, 9, 0.3, 13] },
  },
  doors: {
    door_w1: { kind: 'customer', box: [4, 6, 0.3, 3] },
  },
  props: {
    prop_plant_1: { model: 'plant', box: [19.2, 12, 0.6, 0.6], rot: 0, solid: true, area: 'area_1' },
    prop_tree_1: { model: 'tree-oak', box: [22, 7, 2, 2], rot: 0, solid: true, area: 'area_2' },
    prop_flower_1: { model: 'flower', box: [24, 12, 1, 1], rot: 0, solid: false, area: 'area_2' },
    prop_bush_1: { model: 'bush', box: [26.5, 2, 1, 1], rot: 0, solid: true },
    party_flag_1: { model: 'flag', box: [21, 15, 1, 1], rot: 0, solid: false, party: true },
  },
  floors: [[4, 4, 16, 9]],
  street: [[0, 0, 4, 22]],
  roads: [[0, 22, 28, 4]],
  streetSpots: [
    [2, 2],
    [2, 20],
  ],
  waitingSpots: [
    [9.5, 8.5],
    [10.5, 8.5],
    [11.5, 8.5],
    [12.5, 8.5],
  ],
  carSpots: [
    { car: [5, 22.6, 3, 1.8], pickup: [5.5, 20, 1.5, 1.5] },
    { car: [15, 22.6, 3, 1.8], pickup: [15.5, 20.2, 1.5, 1.5] },
  ],
  van: [22, 22.6, 3, 1.6],
  playerStart: [9, 8.5],
};

/** C — Courtyard: a U of shop wings around a farm courtyard; you go out the back from any wing. */
const courtyard: MapLayout = {
  size: [36, 32],
  areas: {
    area_1: [[4, 4, 26, 24]],
    area_2: [[30, 4, 6, 24]],
  },
  places: {
    tomato_shelf: { box: [6, 5, 3, 1], rot: 0 },
    egg_shelf: { box: [10.5, 5, 3, 1], rot: 0 },
    ketchup_shelf: { box: [20, 5, 3, 1], rot: 0 },
    register: { box: [24.5, 5.6, 2.6, 1], rot: 0 },
    cashier_1: { box: [25.3, 4.5, 1, 1], rot: 0 },
    trash: { box: [4.5, 12, 1, 1], rot: 0 },
    mop_stand: { box: [7.5, 12, 1, 1], rot: 0 },
    stocker_1: { box: [7.5, 16, 1, 1], rot: 0 },
    office: { box: [5, 19.5, 1.5, 1], rot: 0 },
    blender: { box: [26, 12, 2, 2.5], rot: 0 },
    area_2: { box: [26, 19.5, 1, 1], rot: 0 },
    tomato_bed: { box: [17.5, 12, 4, 2.4], rot: 180 },
    chicken_coop: { box: [12, 15, 3, 4.1], rot: 180 },
    exit: { box: [33, 24, 1, 1], rot: 0 },
  },
  walls: {
    wall_n1: { kind: 'tall', box: [4, 4, 11.5, 0.3] },
    wall_n2: { kind: 'tall', box: [18.5, 4, 11.5, 0.3] },
    wall_w: { kind: 'tall', box: [4, 4.3, 0.3, 17.7] },
    wall_e1: { kind: 'tall', box: [29.7, 4.3, 0.3, 13.7] },
    wall_e2: { kind: 'tall', box: [29.7, 20.5, 0.3, 1.5] },
    lowwall_cn1: { kind: 'low', box: [10.3, 9.7, 4.2, 0.3] },
    lowwall_cn2: { kind: 'low', box: [17, 9.7, 6.7, 0.3] },
    lowwall_cw1: { kind: 'low', box: [9.7, 9.7, 0.3, 6.3] },
    lowwall_cw2: { kind: 'low', box: [9.7, 18.5, 0.3, 3.5] },
    lowwall_ce: { kind: 'low', box: [23.7, 10, 0.3, 12] },
    lowwall_sw: { kind: 'low', box: [4.3, 21.7, 5.4, 0.3] },
    lowwall_se: { kind: 'low', box: [24, 21.7, 5.7, 0.3] },
  },
  doors: {
    door_n1: { kind: 'customer', box: [15.5, 4, 3, 0.3] },
    door_back_n: { kind: 'back', box: [14.5, 9.7, 2.5, 0.3] },
    door_back_w: { kind: 'back', box: [9.7, 16, 0.3, 2.5] },
    door_back_e: { kind: 'back', box: [29.7, 18, 0.3, 2.5] },
  },
  props: {
    prop_sofa: { model: 'sofa', box: [4.4, 15.8, 1.2, 2.6], rot: 90, solid: true, area: 'area_1' },
    prop_plant_1: { model: 'plant', box: [8.8, 21, 0.6, 0.6], rot: 0, solid: true, area: 'area_1' },
    prop_tree_1: { model: 'tree-oak', box: [32, 8, 2, 2], rot: 0, solid: true, area: 'area_2' },
    prop_flower_1: { model: 'flower', box: [31, 14, 1, 1], rot: 0, solid: false, area: 'area_2' },
    prop_tree_2: { model: 'tree', box: [20, 18, 2, 2], rot: 90, solid: true, area: 'area_1' },
    party_flag_1: { model: 'flag', box: [34, 18, 1, 1], rot: 0, solid: false, party: true },
    party_banner_1: { model: 'banner-red', box: [8, 4.3, 1, 0.4], rot: 0, solid: false, party: true },
  },
  floors: [
    [4, 4, 26, 6],
    [4, 10, 6, 12],
    [24, 10, 6, 12],
  ],
  street: [[0, 0, 36, 4]],
  roads: [[0, 28, 36, 4]],
  streetSpots: [
    [2, 2],
    [34, 2],
  ],
  waitingSpots: [
    [22, 8.5],
    [21, 8.5],
    [20, 8.5],
    [19, 8.5],
  ],
  carSpots: [
    { car: [11.5, 28.6, 3, 1.8], pickup: [12, 24, 1.5, 1.5] },
    { car: [16.5, 28.6, 3, 1.8], pickup: [17, 24, 1.5, 1.5] },
  ],
  van: [26, 28.6, 3, 1.6],
  playerStart: [12, 7.5],
};

export const SHAPES: Record<string, { name: string; layout: MapLayout }> = {
  A: { name: 'A Lesson Trail', layout: trail },
  B: { name: 'B Open Plaza', layout: plaza },
  C: { name: 'C Courtyard', layout: courtyard },
  saved: { name: 'Editor save', layout: saved },
};

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const picked =
  (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tlayout') : env?.TLAYOUT) ?? 'A';
export const layout: MapLayout = (SHAPES[picked] ?? SHAPES.A).layout;
