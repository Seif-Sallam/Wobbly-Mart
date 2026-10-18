import { deliveries, earn, own, sell } from '../../catalog/objectives';

export const objectives = [
  sell('apple', 100),
  sell('apple_juice', 150),
  sell('orange_juice', 150),
  sell('candy_apple', 100),
  sell('smoothie', 50),
  earn(6000),
  earn(24000),
  deliveries(4),
  own('smoothie_blender'),
  own('area_3'),
];
