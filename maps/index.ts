import type { MapDef } from '../src/sim/map';
import { cornerShop } from './corner-shop';
import { juiceBar } from './juice-bar';
import { dairyFarm } from './dairy-farm';
import { pizzaPlace } from './pizza-place';
import { tutorialMap } from './tutorial';

/** Play order. */
export const MAPS: MapDef[] = [tutorialMap, cornerShop, juiceBar, dairyFarm, pizzaPlace];

export const mapById = (id: string): MapDef | undefined => MAPS.find((m) => m.id === id);
