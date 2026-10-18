// Editor-owned: the layout editor rewrites this file whole on Save (hand comments are lost).
import type { MapLayout } from '../../src/sim/map';

export const layout: MapLayout = {
  size: [40, 30],
  areas: { area_1: [[4, 4, 26, 22]], area_2: [[30, 4, 8, 22]] },
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
