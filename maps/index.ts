import type { MapDef } from '../src/sim/map';
import { cornerShop } from './corner-shop';
import { juiceBar } from './juice-bar';
import { dairyFarm } from './dairy-farm';

/** Play order. */
export const MAPS: MapDef[] = [cornerShop, juiceBar, dairyFarm];

export const mapById = (id: string): MapDef | undefined => MAPS.find((m) => m.id === id);
