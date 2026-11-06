import { expect, test } from 'vitest';
import { builtOut, generateDailyMap, shopWalks } from './daily-map';
import { TUNING } from './tuning';

test('generated Daily Maps: every Format, shops within a short walk of each other', () => {
  const formats = new Set<string>();
  for (let s = 1; s <= 60; s++) {
    const { map, format } = generateDailyMap(s * 7919);
    formats.add(format);
    const walks = shopWalks(builtOut(map)).flat();
    expect(walks.every(Number.isFinite), `${map.id}: a shop can't be walked to`).toBe(true);
    expect(Math.max(...walks), `${map.id} (${format})`).toBeLessThanOrEqual(TUNING.dailyMap.shopWalk);
  }
  expect([...formats].sort()).toEqual(Object.keys(TUNING.dailyMap.formats).sort());
});
