import type { TutorialStep } from '../../src/sim/map';

export const tutorial: TutorialStep[] = [
  { pad: 'register' },
  { pad: 'tomato_shelf' },
  { pad: 'tomato_bed' },
  { action: 'pick', station: 'tomato_bed' },
  { action: 'drop', station: 'tomato_shelf' },
  { action: 'checkout', station: 'register' },
  { action: 'collect', station: 'register' },
  { pad: 'egg_shelf' },
  { pad: 'chicken_coop' },
  { action: 'drop', station: 'chicken_coop' },
  { action: 'drop', station: 'egg_shelf' },
  { pad: 'office' },
  { action: 'upgrade', station: 'office' },
];
