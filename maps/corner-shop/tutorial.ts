import type { TutorialStep } from '../../src/sim/map';

export const tutorial: TutorialStep[] = [
  { pad: 'register', text: 'Stand on the price tag to buy a Register. Customers pay for their shopping here.' },
  { pad: 'tomato_shelf', text: 'Now buy a Tomato Shelf. Customers only come once there is something to buy.' },
  { pad: 'tomato_bed', text: 'Buy a Tomato Bed. It grows the tomatoes you will sell.' },
  { action: 'pick', station: 'tomato_bed', text: 'Walk over the Tomato Bed to pick the ripe tomatoes.' },
  { action: 'drop', station: 'tomato_shelf', text: 'Carry them to the Tomato Shelf. Walking up to it puts them out.' },
  {
    action: 'checkout',
    station: 'register',
    text: 'A customer is waiting! Stand behind the Register to check them out.',
  },
  {
    action: 'collect',
    station: 'register',
    text: 'Walk over the cash by the Register. Money only counts once you collect it.',
  },
  { pad: 'egg_shelf', text: 'Buy an Egg Shelf. More Products bring more customers.' },
  { pad: 'chicken_coop', text: 'Buy a Chicken Coop. Chickens eat tomatoes and lay eggs.' },
  { action: 'drop', station: 'chicken_coop', text: 'Bring tomatoes to the Chicken Coop to feed the chickens.' },
  { action: 'drop', station: 'egg_shelf', text: 'Pick up the eggs at the coop and put them on the Egg Shelf.' },
  { pad: 'office', text: 'Buy the Office. That is where you buy Upgrades.' },
  {
    action: 'upgrade',
    station: 'office',
    text: 'Walk into the Office and buy your first Upgrade. You are on your own after this!',
  },
];
