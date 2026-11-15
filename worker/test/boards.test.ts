import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { expect, test } from 'vitest';
import { fixedMaxScore, maxScoreRate } from '../../src/sim/score';
import { SIM_VERSION } from '../../src/sim/version';
import { cornerShop } from '../../maps/corner-shop';
import { dairyFarm } from '../../maps/dairy-farm';
import type { ApiError, BoardResponse, CloudCodeResponse, RankResponse, RunResponse } from '../api';
import { dailyDay } from '../../src/sim/daily';
import { nowSeconds } from '../time';

let ip = 0;
function call(method: string, path: string, opts: { code?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'CF-Connecting-IP': `192.0.2.${++ip}` };
  if (opts.code) headers.Authorization = `Bearer ${opts.code}`;
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return exports.default.fetch(new Request(`https://api.test${path}`, { method, headers, body }));
}

async function newDevice(nickname: string): Promise<string> {
  const res = await call('POST', '/v1/device', { body: { nickname } });
  return ((await res.json()) as CloudCodeResponse).cloudCode;
}

/** Seeds `n` other Devices with Scores 1000, 990, 980… on Corner Shop; the best Streak's last Shift was long ago. */
async function seedScores(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    const { meta } = await env.BOARD.prepare(
      'INSERT INTO `device` (`token_hash`, `nickname`, `created_at`, `last_seen_at`, `streak_best`, `streak_current`, `streak_last_day`) VALUES (?, ?, 0, 0, ?, ?, ?)',
    )
      .bind(new Uint8Array([i, 7]), `Seed ${i}`, i + 1, i % 3, dailyDay(Date.now()) - (i === n - 1 ? 5 : 0))
      .run();
    await env.BOARD.prepare(
      "INSERT INTO `board_entry` (`kind`, `map`, `day`, `sim_version`, `id_device`, `score`, `play_time`, `updated_at`) VALUES ('score', 'corner-shop', 0, ?, ?, ?, 100, 0)",
    )
      .bind(SIM_VERSION, meta.last_row_id, 1000 - i * 10)
      .run();
  }
}

test('Score Board: submits are checked, ranked, and read back with Around you', async () => {
  await seedScores(60);
  const code = await newDevice('Score Climber');

  // Anonymous read: top 50 with ranks, total, no "you".
  let res = await call('GET', '/v1/boards/score/corner-shop');
  let board = (await res.json()) as BoardResponse;
  expect(board.total).toBe(60);
  expect(board.top).toHaveLength(50);
  expect(board.top[0]).toEqual({ rank: 1, nickname: 'Seed 0', value: 1000 });
  expect(board.top[49]).toEqual({ rank: 50, nickname: 'Seed 49', value: 510 });
  expect(board.you).toBeUndefined();
  expect(JSON.stringify(board)).not.toMatch(/id_device|token/);

  // Unknown kinds, Maps and the Tutorial are refused before any query.
  for (const path of ['/v1/boards/fastest/corner-shop', '/v1/boards/score/tutorial', '/v1/boards/score/nope']) {
    expect(((await (await call('GET', path)).json()) as ApiError).error).toBe('bad_request');
  }

  // A first submit: 755 sits between Seed 24 (760, 25th) and Seed 25 (750).
  res = await call('PUT', '/v1/scores/corner-shop', {
    code,
    body: { score: 755, playTime: 600, simVersion: SIM_VERSION },
  });
  expect(await res.json()).toEqual({ rank: 26, total: 61, improved: true } satisfies RankResponse);

  // Read with the Cloud Code: your row is marked, Around you is ±2 by the index.
  board = (await (await call('GET', '/v1/boards/score/corner-shop', { code })).json()) as BoardResponse;
  expect(board.top[25]).toEqual({ rank: 26, nickname: 'Score Climber', value: 755, you: true });
  expect(board.you).toEqual({
    rank: 26,
    around: [
      { rank: 24, nickname: 'Seed 23', value: 770 },
      { rank: 25, nickname: 'Seed 24', value: 760 },
      { rank: 26, nickname: 'Score Climber', value: 755, you: true },
      { rank: 27, nickname: 'Seed 25', value: 750 },
      { rank: 28, nickname: 'Seed 26', value: 740 },
    ],
  });

  // Sanity checks: another sim version, a Score past the cap, play time going back or racing the clock.
  const put = (body: Record<string, number>) => call('PUT', '/v1/scores/corner-shop', { code, body });
  const err = async (r: Response) => ((await r.json()) as ApiError).error;
  expect(await err(await put({ score: 800, playTime: 700, simVersion: SIM_VERSION + 1 }))).toBe('update');
  const cap = Math.floor(fixedMaxScore(cornerShop) + 700 * maxScoreRate());
  expect(await err(await put({ score: cap + 1, playTime: 700, simVersion: SIM_VERSION }))).toBe('implausible');
  expect(await err(await put({ score: 800, playTime: 500, simVersion: SIM_VERSION }))).toBe('implausible');
  expect(await err(await put({ score: 800, playTime: 600 + 120, simVersion: SIM_VERSION }))).toBe('implausible');
  expect(await err(await put({ score: -1, playTime: 600, simVersion: SIM_VERSION }))).toBe('bad_request');

  // Within a minute of slack: the row keeps the latest Score.
  res = await put({ score: 1005, playTime: 650, simVersion: SIM_VERSION });
  expect(await res.json()).toEqual({ rank: 1, total: 61, improved: true });
  const row = await env.BOARD.prepare(
    'SELECT `score`, `play_time`, `updated_at` FROM `board_entry` WHERE `score` = 1005',
  ).first();
  expect(row).toMatchObject({ score: 1005, play_time: 650 });
  expect(Math.abs((row?.updated_at as number) - nowSeconds())).toBeLessThan(5);

  // A lower Score (a reset save that played past the stored play time) never lowers the row.
  res = await put({ score: 900, playTime: 655, simVersion: SIM_VERSION });
  expect(await res.json()).toEqual({ rank: 1, total: 61, improved: false });
  expect(await env.BOARD.prepare('SELECT COUNT(*) AS n FROM `board_entry` WHERE `score` = 1005').first('n')).toBe(1);

  // A tie: Twin's 750 shares rank 27 with Seed 25, who shows below Twin; the next row skips to 29.
  const twin = await newDevice('Tie Twin');
  await call('PUT', '/v1/scores/corner-shop', {
    code: twin,
    body: { score: 750, playTime: 60, simVersion: SIM_VERSION },
  });
  board = (await (await call('GET', '/v1/boards/score/corner-shop', { code: twin })).json()) as BoardResponse;
  expect(board.you).toEqual({
    rank: 27,
    around: [
      { rank: 25, nickname: 'Seed 23', value: 770 },
      { rank: 26, nickname: 'Seed 24', value: 760 },
      { rank: 27, nickname: 'Tie Twin', value: 750, you: true },
      { rank: 27, nickname: 'Seed 25', value: 750 },
      { rank: 29, nickname: 'Seed 26', value: 740 },
    ],
  });

  // A stale Cloud Code still reads the public Board.
  res = await call('GET', '/v1/boards/score/corner-shop', { code: 'WBLY-0000-0000-0000-0000' });
  board = (await res.json()) as BoardResponse;
  expect([res.status, board.total, board.you]).toEqual([200, 62, undefined]);

  // Streak Board reads from Devices: seeds have best Streaks 1..60; the climber has none, so no "you".
  // The best one missed days, so its current 🔥 shows 0.
  const streak = (await (await call('GET', '/v1/boards/streak/-', { code })).json()) as BoardResponse;
  expect(streak.total).toBe(60);
  expect(streak.top.slice(0, 3).map((r) => [r.rank, r.value, r.streak])).toEqual([
    [1, 60, 0],
    [2, 59, 1],
    [3, 58, 0],
  ]);
  expect(streak.you).toBeUndefined();

  // Past the rank cap (100): 50 more seeds at 405, 400 … 160 put 112 rows on the Board.
  for (let i = 0; i < 50; i++) {
    const { meta } = await env.BOARD.prepare(
      'INSERT INTO `device` (`token_hash`, `nickname`, `created_at`, `last_seen_at`) VALUES (?, ?, 0, 0)',
    )
      .bind(new Uint8Array([i, 8]), `Low ${i}`)
      .run();
    await env.BOARD.prepare(
      "INSERT INTO `board_entry` (`kind`, `map`, `day`, `sim_version`, `id_device`, `score`, `play_time`, `updated_at`) VALUES ('score', 'corner-shop', 0, ?, ?, ?, 100, 0)",
    )
      .bind(SIM_VERSION, meta.last_row_id, 405 - i * 5)
      .run();
  }
  const submit = async (nickname: string, score: number) => {
    const who = await newDevice(nickname);
    await call('PUT', '/v1/scores/corner-shop', { code: who, body: { score, playTime: 60, simVersion: SIM_VERSION } });
    return (await (await call('GET', '/v1/boards/score/corner-shop', { code: who })).json()) as BoardResponse;
  };
  // 99 rows beat 221: ranks above come from one count, those past 100 show as 101 ("100+"); so does the total.
  board = await submit('Near Cap', 221);
  expect([board.total, board.you?.rank, board.you?.around.map((r) => [r.rank, r.value])]).toEqual([
    101,
    100,
    [
      [98, 230],
      [99, 225],
      [100, 221],
      [101, 220],
      [101, 215],
    ],
  ]);
  // Last place: every rank around it is past the cap.
  board = await submit('Last One', 1);
  expect(board.you?.around.map((r) => [r.rank, r.value])).toEqual([
    [101, 165],
    [101, 160],
    [101, 1],
  ]);

  // Daily needs a day; other Boards start empty.
  expect((await call('GET', '/v1/boards/daily/daily')).status).toBe(400);
  expect(await (await call('GET', '/v1/boards/daily/daily?day=310')).json()).toEqual({ top: [], total: 0 });
  expect(await (await call('GET', '/v1/boards/speed/juice-bar')).json()).toEqual({ top: [], total: 0 });
});

test('Speedrun Board: a Run past the floor ranks, and only a faster one replaces it', async () => {
  const floor = cornerShop.speedrunFloorTicks ?? 0;
  const [fast, slow] = [await newDevice('Fast Hands'), await newDevice('Slow Poke')];
  const run = (code: string, body: Record<string, unknown>) => call('POST', '/v1/runs', { code, body });
  const err = async (r: Response) => ((await r.json()) as ApiError).error;
  const ok = (ticks: number) => ({ map: 'corner-shop', ticks, simVersion: SIM_VERSION });

  // Refused: under the floor, the Tutorial, another sim version, no Device.
  expect(await err(await run(fast, ok(floor - 1)))).toBe('implausible');
  expect(await err(await run(fast, { ...ok(floor), map: 'tutorial' }))).toBe('bad_request');
  expect(await err(await run(fast, { ...ok(floor), simVersion: SIM_VERSION + 1 }))).toBe('update');
  expect((await call('POST', '/v1/runs', { body: ok(floor) })).status).toBe(401);

  const answer = async (code: string, ticks: number) => (await (await run(code, ok(ticks))).json()) as RunResponse;
  expect(await answer(slow, floor + 5000)).toMatchObject({ rank: 1, total: 1, improved: true });
  expect(await answer(fast, floor + 3000)).toMatchObject({ rank: 1, total: 2, improved: true });
  // A slower Run keeps the best; a faster one replaces it. The answer carries Around you.
  expect(await answer(fast, floor + 9000)).toMatchObject({ rank: 1, total: 2, improved: false });
  expect(await answer(slow, floor + 1000)).toEqual({
    rank: 1,
    total: 2,
    improved: true,
    around: [
      { rank: 1, nickname: 'Slow Poke', value: floor + 1000, you: true },
      { rank: 2, nickname: 'Fast Hands', value: floor + 3000 },
    ],
  });

  const board = (await (await call('GET', '/v1/boards/speed/corner-shop', { code: fast })).json()) as BoardResponse;
  expect(board.top).toEqual([
    { rank: 1, nickname: 'Slow Poke', value: floor + 1000 },
    { rank: 2, nickname: 'Fast Hands', value: floor + 3000, you: true },
  ]);
  expect(board.you?.rank).toBe(2);
});

test('Boards ignore the sim version: older rows stay on the Wall and a newer best replaces them', async () => {
  const seed = async (nickname: string, kind: string, map: string, day: number, value: number) => {
    const { meta } = await env.BOARD.prepare(
      'INSERT INTO `device` (`token_hash`, `nickname`, `created_at`, `last_seen_at`) VALUES (?, ?, 0, 0)',
    )
      .bind(new TextEncoder().encode(nickname), nickname)
      .run();
    await env.BOARD.prepare(
      'INSERT INTO `board_entry` (`kind`, `map`, `day`, `sim_version`, `id_device`, `ticks`, `score`, `play_time`, `updated_at`) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)',
    )
      .bind(kind, map, day, SIM_VERSION - 1, meta.last_row_id, value, value)
      .run();
  };
  const top = async (path: string) =>
    ((await (await call('GET', path)).json()) as BoardResponse).top.map((r) => [r.nickname, r.value]);

  await seed('Old Timer', 'daily', 'daily', 3, 9000);
  await seed('Old Pal', 'daily', 'daily', 3, 8000);
  expect(await top('/v1/boards/daily/daily?day=3')).toEqual([
    ['Old Pal', 8000],
    ['Old Timer', 9000],
  ]);

  // A Run on today's version beats the older-version best in place: still one row for the Device.
  const floor = dairyFarm.speedrunFloorTicks ?? 0;
  const hopper = await newDevice('Version Hopper');
  await env.BOARD.prepare(
    'INSERT INTO `board_entry` (`kind`, `map`, `day`, `sim_version`, `id_device`, `ticks`, `updated_at`) ' +
      "SELECT 'speed', 'dairy-farm', 0, ?, `id_device`, ?, 0 FROM `device` WHERE `nickname` = 'Version Hopper'",
  )
    .bind(SIM_VERSION - 1, floor + 5000)
    .run();
  expect(await top('/v1/boards/speed/dairy-farm')).toEqual([['Version Hopper', floor + 5000]]);
  const run = (ticks: number) =>
    call('POST', '/v1/runs', { code: hopper, body: { map: 'dairy-farm', ticks, simVersion: SIM_VERSION } });
  expect(((await (await run(floor + 9000)).json()) as RunResponse).improved).toBe(false);
  expect(((await (await run(floor + 1000)).json()) as RunResponse).improved).toBe(true);
  expect(await top('/v1/boards/speed/dairy-farm')).toEqual([['Version Hopper', floor + 1000]]);
});
