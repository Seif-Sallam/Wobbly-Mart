import type { UpgradeDef } from '../../src/sim/map';

const levels = (costs: number[], values: number[]) => costs.map((cost, i) => ({ cost, value: values[i] }));

export const upgrades: Record<string, UpgradeDef> = {
  player_speed: {
    name: 'Walk speed',
    family: 'player',
    target: 'player',
    stat: 'speed',
    levels: levels([10], [6.5]),
    requires: ['office'],
  },
  stack_cap: {
    name: 'Stack size',
    family: 'player',
    target: 'player',
    stat: 'stack',
    levels: levels([10], [12]),
    requires: ['office'],
  },
};
