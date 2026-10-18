import { deliveries, earn, own, sell } from '../../catalog/objectives';

export const objectives = [
  sell('tomato', 100),
  sell('egg', 150),
  sell('milk', 100),
  sell('ketchup', 150),
  sell('bread', 75),
  earn(5000),
  earn(20000),
  deliveries(4),
  own('oven'),
  own('area_3'),
];
