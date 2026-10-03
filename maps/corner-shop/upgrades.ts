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
    levels: levels([25, 50, 85, 150], [6, 6.5, 7, 7.5]),
    requires: ['office'],
  },
  stack_cap: {
    name: 'Stack size',
    family: 'player',
    target: 'player',
    stat: 'stack',
    levels: levels([35, 65, 125, 200], [20, 24, 28, 32]),
    requires: ['office'],
  },
  shelf_cap: {
    name: 'Shelf size',
    family: 'station',
    target: 'shelf',
    stat: 'capacity',
    levels: levels([45, 80, 150], [12, 16, 20]),
    requires: ['office'],
  },
  speed_tomato_bed: producerSpeed('Tomato growth', 'tomato_bed', [20, 40, 75]),
  speed_chicken_coop: producerSpeed('Chicken laying', 'chicken_coop', [25, 50]),
  speed_blender: producerSpeed('Blender speed', 'blender', [30, 55]),
  speed_wheat_field: producerSpeed('Wheat growth', 'wheat_field', [60, 100, 200]),
  speed_cow_pen: producerSpeed('Cow milking', 'cow_pen', [70, 125]),
  speed_mill: producerSpeed('Mill speed', 'mill', [80]),
  speed_oven: producerSpeed('Oven speed', 'oven', [200, 375]),
  cashier_speed: {
    name: 'Cashier speed',
    family: 'staff',
    target: 'cashier',
    stat: 'checkoutTime',
    levels: levels([70, 125, 225], [1.6, 1.3, 1]),
    requires: ['cashier_1'],
  },
  stocker_speed: {
    name: 'Stocker speed',
    family: 'staff',
    target: 'stocker',
    stat: 'speed',
    levels: levels([80, 150, 250, 475], [4.5, 5, 5.5, 6]),
    requires: ['stocker_1'],
  },
  stocker_carry: {
    name: 'Stocker carry',
    family: 'staff',
    target: 'stocker',
    stat: 'carry',
    levels: levels([80, 150, 250, 475], [8, 10, 12, 14]),
    requires: ['stocker_1'],
  },
};
