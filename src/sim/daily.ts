// The Daily Shift's day: a UTC date, its number counted from launch (day 1), and its seed.
import { fnv1a } from './rng';
import { TUNING } from './tuning';

const DAY_MS = 86_400_000;

/** The day number of a moment (ms since the epoch, passed in: the sim has no clock). */
export const dailyDay = (utcMs: number): number => Math.floor((utcMs - TUNING.daily.launch) / DAY_MS) + 1;

/** `YYYY-MM-DD` of a day number. */
export const dailyDate = (day: number): string => new Date(TUNING.daily.launch + (day - 1) * DAY_MS).toISOString().slice(0, 10);

export const dailySeed = (day: number): number => fnv1a(dailyDate(day));
