import type { MapDef } from '../src/sim/map';
import { cornerShop } from './corner-shop';

/** Play order. */
export const MAPS: MapDef[] = [cornerShop];

export const mapById = (id: string): MapDef | undefined => MAPS.find((m) => m.id === id);
