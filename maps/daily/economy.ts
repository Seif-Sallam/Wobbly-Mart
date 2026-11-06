// The Daily Map's Upgrades and Events, for whichever Producers and Areas the seed picked.
import type { MapEvents, UpgradeDef } from '../../src/sim/map';
import type { ProducerType } from '../../catalog/producers';

const levels = (costs: number[], values: number[]) => costs.map((cost, i) => ({ cost, value: values[i] }));

export function dailyUpgrades(producers: Record<string, ProducerType>): Record<string, UpgradeDef> {
  const ups: Record<string, UpgradeDef> = {
    player_speed: {
      name: 'Walk speed',
      family: 'player',
      target: 'player',
      stat: 'speed',
      levels: levels([15, 30, 55], [6, 6.5, 7]),
      requires: ['office'],
    },
    stack_cap: {
      name: 'Stack size',
      family: 'player',
      target: 'player',
      stat: 'stack',
      levels: levels([20, 40, 75], [10, 12, 14]),
      requires: ['office'],
    },
    cashier_speed: {
      name: 'Cashier speed',
      family: 'staff',
      target: 'cashier',
      stat: 'checkoutTime',
      levels: levels([40, 75], [1.6, 1.3]),
      requires: ['cashier_1'],
    },
  };
  for (const [id, p] of Object.entries(producers))
    ups[`speed_${id}`] = {
      name: `${p.name} speed`,
      family: 'station',
      target: id,
      stat: 'workTime',
      levels: levels([20, 40], [0.8, 0.64]),
      requires: [id],
    };
  return ups;
}

/** Deliveries start once the second Pad is bought. */
export const dailyEvents = (deliveryPad: string): MapEvents => ({
  delivery: { requires: [deliveryPad] },
  robbery: {
    requires: ['office'],
    byArea: { area_1: { bounty: 30, cashOver: 120 }, area_2: { bounty: 60, cashOver: 250 } },
  },
  inspector: {
    requires: ['office'],
    byArea: {
      area_1: { reward: [60, 120], perDirt: 10, review: 80 },
      area_2: { reward: [150, 300], perDirt: 30, review: 200 },
    },
  },
});
