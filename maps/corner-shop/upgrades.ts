import type { UpgradeDef } from '../../src/sim/map';
import type { ProducerTypeId } from '../../catalog/producers';

const levels = (costs: number[], values: number[]) => costs.map((cost, i) => ({ cost, value: values[i] }));
const WORK = [0.8, 0.64, 0.512];
const producerSpeed = (name: string, target: ProducerTypeId, costs: number[]): UpgradeDef => ({
  name,
  family: 'station',
  target,
  stat: 'workTime',
  levels: levels(costs, WORK),
  requires: [target],
});

export const upgrades: Record<string, UpgradeDef> = {
  player_speed: {
    name: 'Walk speed',
    family: 'player',
    target: 'player',
    stat: 'speed',
    levels: levels([15, 30, 55, 100], [6, 6.5, 7, 7.5]),
    requires: ['office'],
  },
  stack_cap: {
    name: 'Stack size',
    family: 'player',
    target: 'player',
    stat: 'stack',
    levels: levels([20, 40, 75, 125], [10, 12, 14, 16]),
    requires: ['office'],
  },
  steady_hands: {
    name: 'Steady hands',
    family: 'player',
    target: 'player',
    stat: 'safe',
    levels: levels([25, 45, 80], [4, 5, 6]),
    requires: ['office'],
  },
  mop_speed: {
    name: 'Mop speed',
    family: 'player',
    target: 'player',
    stat: 'cleanTime',
    levels: levels([100, 175], [1.5, 1]),
    requires: ['area_2'],
  },
  speed_tomato_bed: producerSpeed('Tomato growth', 'tomato_bed', [15, 25, 45]),
  speed_chicken_coop: producerSpeed('Chicken laying', 'chicken_coop', [15, 30]),
  speed_blender: producerSpeed('Blender speed', 'blender', [20, 35]),
  speed_wheat_field: producerSpeed('Wheat growth', 'wheat_field', [50, 90, 150]),
  speed_cow_pen: producerSpeed('Cow milking', 'cow_pen', [60, 100]),
  speed_mill: producerSpeed('Mill speed', 'mill', [65]),
  speed_oven: producerSpeed('Oven speed', 'oven', [225, 400]),
  cashier_speed: {
    name: 'Cashier speed',
    family: 'staff',
    target: 'cashier',
    stat: 'checkoutTime',
    levels: levels([40, 75, 125], [1.6, 1.3, 1]),
    requires: ['cashier_1'],
  },
  stocker_speed: {
    name: 'Stocker speed',
    family: 'staff',
    target: 'stocker',
    stat: 'speed',
    levels: levels([65, 125, 225, 375], [4.5, 5, 5.5, 6]),
    requires: ['stocker_1'],
  },
  stocker_carry: {
    name: 'Stocker carry',
    family: 'staff',
    target: 'stocker',
    stat: 'carry',
    levels: levels([65, 125, 225, 375], [8, 10, 12, 14]),
    requires: ['stocker_1'],
  },
};
