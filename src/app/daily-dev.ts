// Dev `?daily=YYYY-MM-DD`: that day's Daily Map with its calendar goal (none if the date isn't in the calendar).
// A Shift never touches the save.
import type { MapDef } from '../sim/map';
import type { DailyCalendar } from '../sim/daily-goal';
import { generateDailyMap } from '../sim/daily-map';
import { fnv1a } from '../sim/rng';
import calendar from '../../maps/daily-calendar.json';

export function dailyDevMap(date: string): MapDef {
  const { map } = generateDailyMap(fnv1a(date));
  return { ...map, objectives: (calendar as unknown as DailyCalendar).days[date]?.goal ?? [] };
}
