// The lazy Daily chunk: a day's Daily Map with its calendar goal, kept out of the first load.
import type { MapDef } from '../sim/map';
import type { DailyCalendar } from '../sim/daily-goal';
import { generateDailyMap } from '../sim/daily-map';
import { dailyDate, dailySeed } from '../sim/daily';
import calendar from '../../maps/daily-calendar.json';

export interface ShiftDay {
  day: number;
  /** The Map's and the World's seed. */
  seed: number;
  /** The Map, its goal as its `objectives`. */
  map: MapDef;
  floorTicks: number;
}

/** Null when the calendar has no such day (the Shift is hidden). */
export function shiftDay(day: number): ShiftDay | null {
  const entry = (calendar as unknown as DailyCalendar).days[dailyDate(day)];
  if (!entry) return null;
  const seed = dailySeed(day);
  const { map } = generateDailyMap(seed);
  return { day, seed, map: { ...map, objectives: entry.goal }, floorTicks: entry.floorTicks };
}
