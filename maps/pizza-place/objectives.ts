import { deliveries, earn, own, sell } from '../../catalog/objectives';

export const objectives = [
  sell('tomato', 75),
  sell('pizza_sauce', 125),
  sell('olives', 75),
  sell('pizza', 75),
  sell('veggie_pizza', 50),
  earn(5000),
  earn(20000),
  deliveries(2),
  own('veggie_pizza_oven'),
  own('area_3'),
];
