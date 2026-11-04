import { expect, test } from 'vitest';
import { gzipSync } from 'node:zlib';
import calendar from '../../maps/daily-calendar.json';
import type { DailyCalendar } from './daily-goal';
import { generateDailyMap } from './daily-map';
import { objectiveProgress } from './objectives';
import { dailyDate, dailySeed } from './daily';
import { InputRecorder, replayIntents } from './replay';
import { snapshot } from './save';
import { Bot } from './bot';
import { createWorld, step, type World } from './world';

const print = (w: World) => JSON.stringify({ save: snapshot(w), t: w.t, rng: w.rng, p: [w.player.x, w.player.z] });

test('a recorded Daily Shift re-sims to the exact World and its Replay fits 64 KB', () => {
  const day = 3;
  const seed = dailySeed(day);
  const goal = (calendar as unknown as DailyCalendar).days[dailyDate(day)]?.goal ?? [];
  const map = { ...generateDailyMap(seed).map, objectives: goal };
  const w = createWorld(map, null, seed);
  const bot = new Bot();
  const rec = new InputRecorder();
  const done = () => goal.every((o) => objectiveProgress(w, o).got >= objectiveProgress(w, o).want);
  while (!done()) {
    const i = bot.intents(w);
    rec.record(i);
    step(w, i);
  }
  const again = createWorld(map, null, seed);
  for (const i of replayIntents(rec.log)) step(again, i);
  expect(print(again)).toEqual(print(w));
  const bytes = gzipSync(JSON.stringify(rec.log)).length;
  console.log(`Shift ${day}: ${rec.log.ticks} ticks, ${rec.log.entries.length} entries, ${bytes} B gzipped`);
  expect(bytes).toBeLessThan(64 * 1024);
});
