import type { MapDef } from '../src/sim/map';
import { tutorialMap } from './tutorial';
import { cornerShop } from './corner-shop';
import { juiceBar } from './juice-bar';
import { dairyFarm } from './dairy-farm';
import { pizzaPlace } from './pizza-place';

/** Title order. The Tutorial Map leads, keeps no per-Map save and is skipped by the unlock chain. */
export const MAPS: MapDef[] = [tutorialMap, cornerShop, juiceBar, dairyFarm, pizzaPlace];

export const isTutorialMap = (map: MapDef): boolean => map === tutorialMap;

/** Where a fresh save starts. */
export const FIRST_MAP: MapDef = cornerShop;

export const mapById = (id: string): MapDef | undefined => MAPS.find((m) => m.id === id);
