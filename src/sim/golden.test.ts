import { expect, test } from 'vitest';
import { cornerShop } from '../../maps/corner-shop';
import { Bot } from './bot';
import { generateDailyMap } from './daily-map';
import { quantize } from './intents';
import { fnv1a } from './rng';
import { snapshot } from './save';
import { SIM_VERSION } from './version';
import { createWorld, step } from './world';

/** Refresh with the printed fingerprint whenever SIM_VERSION is bumped. */
const GOLDEN = { simVersion: 3, fingerprint: 3464646828 };

test('golden run: the bot plays 4 sim minutes, a Daily Map is generated, and both match SIM_VERSION', () => {
  const w = createWorld(cornerShop, null, 20261102);
  const bot = new Bot();
  for (let i = 0; i < 4 * 60 * 60; i++) step(w, bot.intents(w));
  const { player: p } = w;
  const fingerprint = fnv1a(
    JSON.stringify({
      save: snapshot(w),
      t: w.t,
      rng: w.rng,
      player: [p.x, p.z, p.stack.length],
      customers: w.customers.length,
      daily: generateDailyMap(20261102).map,
    }),
  );
  expect(w.money + snapshot(w).owned.length).toBeGreaterThan(0);
  expect(
    { simVersion: SIM_VERSION, fingerprint },
    `Sim behaviour changed: bump SIM_VERSION in src/sim/version.ts and set GOLDEN to { simVersion: ${SIM_VERSION + 1}, fingerprint: ${fingerprint} }`,
  ).toEqual(GOLDEN);
});

test('quantized Intents: int8 move steps, a no-op when applied twice', () => {
  const q = quantize({ move: { x: 0.70710678, z: -2 }, grab: true, sprint: true });
  expect(q).toEqual({ move: { x: 90 / 127, z: -1 }, grab: true, sprint: true });
  expect(quantize(q)).toEqual(q);
});
