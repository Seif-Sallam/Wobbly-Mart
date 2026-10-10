import type { MapDef } from '../src/sim/map';
import { cornerShop } from './corner-shop';
import { juiceBar } from './juice-bar';

/** Play order. */
export const MAPS: MapDef[] = [cornerShop, juiceBar];

export const mapById = (id: string): MapDef | undefined => MAPS.find((m) => m.id === id);
