import { expect, test } from 'vitest';
import calendar from '../../maps/daily-calendar.json';
import type { DailyCalendar } from './daily-goal';
import { builtOut, generateDailyMap, shopWalks } from './daily-map';
import { dailyDate, dailySeed } from './daily';
import { safeCount } from './economy';
import { TUNING } from './tuning';

const K = TUNING.dailyMap;

test('generated Daily Maps: every Format, shops within a short walk, free Steady hands, a second Stocker on 3 Areas, every look', () => {
  const formats = new Set<string>();
  const looks = new Set<string | undefined>();
  for (let s = 1; s <= 60; s++) {
    const { map, format } = generateDailyMap(s * 7919);
    formats.add(format);
    looks.add(map.look);
    const w = builtOut(map);
    const walks = shopWalks(w).flat();
    expect(walks.every(Number.isFinite), `${map.id}: a shop can't be walked to`).toBe(true);
    expect(Math.max(...walks), `${map.id} (${format})`).toBeLessThanOrEqual(K.shopWalk);
    expect(safeCount(w)).toBe(K.safe);
    expect(Object.values(map.upgrades).some((u) => u.stat === 'safe')).toBe(false);
    const areas = map.layout.floors.length;
    expect(Object.keys(map.pads).filter((id) => map.pads[id].unlocks.kind === 'stocker')).toEqual(
      areas === 3 ? ['stocker_1', 'stocker_2'] : ['stocker_1'],
    );
  }
  expect([...formats].sort()).toEqual(Object.keys(K.formats).sort());
  expect([...looks].sort()).toEqual([...K.looks].sort());
});

test('the calendar goals: 3 or 4 parts, the last one late (or the furthest Pad bought), the bot within 18 min', () => {
  const days = (calendar as unknown as DailyCalendar).days;
  let late = 0;
  for (let day = 1; day <= 60; day++) {
    const entry = days[dailyDate(day)];
    if (!entry) throw new Error(`no calendar day ${dailyDate(day)}`);
    const { map } = generateDailyMap(dailySeed(day));
    const chain = Object.keys(map.pads).filter(
      (id) => !map.start.owned.includes(id) && map.pads[id].unlocks.kind !== 'exit',
    );
    const lateIds = chain.slice(Math.floor(chain.length * K.lateFrom));
    const last = entry.goal.at(-1);
    expect(entry.goal.length, dailyDate(day)).toBeGreaterThanOrEqual(K.goalParts);
    expect(entry.goal.length, dailyDate(day)).toBeLessThanOrEqual(K.goalParts + 1);
    expect(last?.kind === 'own' || last?.kind === 'sell', dailyDate(day)).toBe(true);
    if (last?.kind === 'own') expect(chain, dailyDate(day)).toContain(last.id);
    const lateShelf = lateIds.some((id) => {
      const u = map.pads[id].unlocks;
      return last?.kind === 'sell' && u.kind === 'shelf' && u.product === last.product;
    });
    if ((last?.kind === 'own' && lateIds.includes(last.id)) || lateShelf) late++;
    expect(entry.botTicks).toBeGreaterThan(0);
    expect(entry.botTicks).toBeLessThanOrEqual(K.targetMinutes[1] * 60 * K.botPace * TUNING.tickRate);
  }
  // the fallback (no late Pad bought in time) is rare
  expect(late).toBeGreaterThan(60 * 0.8);
});
