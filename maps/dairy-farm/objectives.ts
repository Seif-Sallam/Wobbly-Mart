import { deliveries, earn, own, sell } from '../../catalog/objectives';

export const objectives = [
  sell('milk', 100),
  sell('butter', 150),
  sell('cheese', 125),
  sell('ice_cream', 75),
  sell('pudding', 50),
  earn(8000),
  earn(30000),
  deliveries(3),
  own('pudding_pot'),
  own('area_3'),
];
