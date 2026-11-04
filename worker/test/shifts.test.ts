import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { expect, test } from 'vitest';
import calendar from '../../maps/daily-calendar.json';
import type { DailyCalendar } from '../../src/sim/daily-goal';
import { dailyDate, dailyDay, dailySeed } from '../../src/sim/daily';
import type { ReplayHeader } from '../../src/sim/replay';
import { SIM_VERSION } from '../../src/sim/version';
import type { ApiError, BoardResponse, CloudCodeResponse, ShiftResponse } from '../api';

let ip = 0;
function call(method: string, path: string, opts: { code?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'CF-Connecting-IP': `198.51.100.${++ip}` };
  if (opts.code) headers.Authorization = `Bearer ${opts.code}`;
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return exports.default.fetch(new Request(`https://api.test${path}`, { method, headers, body }));
}

async function newDevice(nickname: string): Promise<string> {
  const res = await call('POST', '/v1/device', { body: { nickname } });
  return ((await res.json()) as CloudCodeResponse).cloudCode;
}

async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(String.fromCharCode(...bytes));
}

const today = dailyDay(Date.now());
const floor = (calendar as unknown as DailyCalendar).days[dailyDate(today)]?.floorTicks ?? 0;

/** A Shift submit whose Replay claims exactly what the body does, unless `header` overrides part of it. */
async function shift(ticks: number, over: Partial<ReplayHeader> = {}) {
  const claim = { day: today, ticks, score: 120, money: 300, simVersion: SIM_VERSION };
  const header: ReplayHeader = { ...claim, seed: dailySeed(today), ...over };
  const log = { ticks: header.ticks, entries: [[0, 127, 0, 1]] };
  return { ...claim, replay: await gzipBase64(JSON.stringify({ header, log })) };
}

const post = async (code: string | undefined, body: unknown) => {
  const res = await call('POST', '/v1/shifts', { code, body });
  return { status: res.status, body: (await res.json()) as ShiftResponse & ApiError };
};

test("Daily Board: Shift submits are checked, keep each Device's best, and count the Streak", async () => {
  expect(floor).toBeGreaterThan(0);
  const code = await newDevice('Shift Runner');

  expect((await post(undefined, await shift(floor + 600))).body.error).toBe('unknown_device');

  // A first finished Shift: rank 1 of 1, Streak 1, its row in Around you.
  let r = await post(code, await shift(floor + 600));
  expect(r.status).toBe(200);
  expect(r.body).toEqual({
    rank: 1,
    total: 1,
    improved: true,
    streak: 1,
    around: [{ rank: 1, nickname: 'Shift Runner', value: floor + 600, score: 120, money: 300, you: true }],
  });

  // Slower: the best stays, the Streak doesn't count the same day twice. Faster: the row and Replay move.
  r = await post(code, await shift(floor + 900));
  expect([r.body.improved, r.body.streak, r.body.around[0].value]).toEqual([false, 1, floor + 600]);
  r = await post(code, await shift(floor + 60));
  expect([r.body.improved, r.body.rank, r.body.around[0].value]).toEqual([true, 1, floor + 60]);
  const replay = await env.REPLAY.prepare('SELECT `day`, `ticks` FROM `replay`').all();
  expect(replay.results).toEqual([{ day: today, ticks: floor + 60 }]);

  // Refused: under the Daily floor, another day, Score past the cap, an old sim, a Replay claiming something else,
  // a Replay over 64 KB, none at all.
  const refused = async (body: unknown) => (await post(code, body)).body.error;
  expect(await refused(await shift(floor - 1))).toBe('implausible');
  expect(await refused({ ...(await shift(floor + 60)), day: today + 1 })).toBe('implausible');
  // yesterday is taken only until 00:15 UTC
  if (dailyDay(Date.now() - 15 * 60_000) === today)
    expect(await refused({ ...(await shift(floor + 60)), day: today - 1 })).toBe('implausible');
  expect(await refused({ ...(await shift(floor + 60)), score: 10_000_000 })).toBe('implausible');
  expect(await refused({ ...(await shift(floor + 60)), simVersion: SIM_VERSION + 1 })).toBe('update');
  // Replay checks run after the write limit (6 / 60 s per Device): a second Device takes them
  const checker = await newDevice('Replay Checker');
  const replayRefused = async (body: unknown) => (await post(checker, body)).body.error;
  expect(await replayRefused(await shift(floor + 60, { ticks: floor + 61 }))).toBe('implausible');
  expect(await replayRefused(await shift(floor + 60, { seed: 1 }))).toBe('implausible');
  expect(await replayRefused({ ...(await shift(floor + 60)), replay: btoa('x'.repeat(66 * 1024)) })).toBe(
    'implausible',
  );
  expect(await replayRefused({ ...(await shift(floor + 60)), replay: undefined })).toBe('implausible');
  expect(await refused({ ...(await shift(floor + 60)), ticks: 'fast' })).toBe('bad_request');

  // A refused Replay still counts the Streak: yesterday played makes today the 5th day in a row.
  const streaker = await newDevice('Streak Keeper');
  await env.BOARD.prepare(
    'UPDATE `device` SET `streak_current` = 4, `streak_best` = 4, `streak_last_day` = ? WHERE `nickname` = ?',
  )
    .bind(today - 1, 'Streak Keeper')
    .run();
  expect((await post(streaker, await shift(floor + 60, { money: 1 }))).body.error).toBe('implausible');
  const streaks = (await (await call('GET', '/v1/boards/streak/-', { code: streaker })).json()) as BoardResponse;
  expect(streaks.you?.around.find((row) => row.you)).toMatchObject({ value: 5, streak: 5 });

  // A gap resets it to 1 on the next Shift; the best stays.
  await env.BOARD.prepare('UPDATE `device` SET `streak_last_day` = ? WHERE `nickname` = ?')
    .bind(today - 3, 'Streak Keeper')
    .run();
  r = await post(streaker, await shift(floor + 300));
  expect([r.body.streak, r.body.rank, r.body.total]).toEqual([1, 2, 2]);

  // The Board reads back both, fastest first, with Score and Money.
  const daily = (await (await call('GET', `/v1/boards/daily/daily?day=${today}`)).json()) as BoardResponse;
  expect(daily.top).toEqual([
    { rank: 1, nickname: 'Shift Runner', value: floor + 60, score: 120, money: 300 },
    { rank: 2, nickname: 'Streak Keeper', value: floor + 300, score: 120, money: 300 },
  ]);
});
