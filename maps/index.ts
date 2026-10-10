import type { MapDef } from '../src/sim/map';
import { cornerShop } from './corner-shop';
import { juiceBar } from './juice-bar';
import { dairyFarm } from './dairy-farm';
import { pizzaPlace } from './pizza-place';

/** Play order. */
export const MAPS: MapDef[] = [cornerShop, juiceBar, dairyFarm, pizzaPlace];

export const mapById = (id: string): MapDef | undefined => MAPS.find((m) => m.id === id);
