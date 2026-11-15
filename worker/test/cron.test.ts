import { createScheduledController, env } from 'cloudflare:test';
import { expect, test } from 'vitest';
import worker from '../index';
import { dailyDay } from '../../src/sim/daily';
import { dayOf, nowSeconds } from '../time';

const at = nowSeconds();
/** Daily days (`replay.day`) count from launch; quota days are Unix days. */
const today = dailyDay(at * 1000);
const unixDay = dayOf(at);

/** `n` Replays on `day` from made-up Devices, ticks 1..n. */
const replays = (day: number, n: number) =>
  env.REPLAY.prepare(
    'WITH RECURSIVE `i` (`n`) AS (SELECT 1 UNION ALL SELECT `n` + 1 FROM `i` WHERE `n` < ?) ' +
      "INSERT INTO `replay` SELECT ?, 100000 + `n`, `n`, x'00' FROM `i`",
  )
    .bind(n, day)
    .run();

const ticksOn = async (day: number): Promise<number[]> =>
  (
    await env.REPLAY.prepare('SELECT `ticks` FROM `replay` WHERE `day` = ? ORDER BY `ticks`')
      .bind(day)
      .all<{ ticks: number }>()
  ).results.map((r) => r.ticks);

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test('the daily cron prunes Replays, deletes idle Devices everywhere and drops old quota rows', async () => {
  await replays(today, 105);
  await replays(today - 1, 105);
  await replays(today - 30, 105);
  await replays(today - 31, 12);

  // Two Devices: one last seen 25 months ago, one yesterday. Each has a Board row, a Replay and a save.
  const device = async (nickname: string, lastSeen: number) => {
    const row = await env.BOARD.prepare(
      'INSERT INTO `device` (`token_hash`, `nickname`, `created_at`, `last_seen_at`) VALUES (randomblob(32), ?, 0, ?) RETURNING `id_device`',
    )
      .bind(nickname, lastSeen)
      .first<{ id_device: number }>();
    const id = row?.id_device ?? 0;
    await env.BOARD.prepare(
      "INSERT INTO `board_entry` (`kind`, `map`, `sim_version`, `id_device`, `score`, `updated_at`) VALUES ('score', 'corner-shop', 1, ?, 10, 0)",
    )
      .bind(id)
      .run();
    await env.REPLAY.prepare("INSERT INTO `replay` VALUES (?, ?, 1, x'00')")
      .bind(today - 2, id)
      .run();
    await env.SAVE.prepare("INSERT INTO `device_save` VALUES (?, x'00', 0)").bind(id).run();
    return id;
  };
  const idle = await device('Long Gone', at - 760 * 86_400);
  const active = await device('Still Here', at - 86_400);

  await env.BOARD.prepare('INSERT INTO `quota` VALUES (?, 5), (?, 5)')
    .bind(unixDay - 8, unixDay - 7)
    .run();

  const controller = createScheduledController({ scheduledTime: at * 1000, cron: '30 22 * * *' });
  await worker.scheduled(controller, env);

  // Today stays whole; finished days keep their top 100 for 30 days, then the top 10.
  expect(await ticksOn(today)).toEqual(range(1, 105));
  expect(await ticksOn(today - 1)).toEqual(range(1, 100));
  expect(await ticksOn(today - 30)).toEqual(range(1, 100));
  expect(await ticksOn(today - 31)).toEqual(range(1, 10));

  const owners = async (db: D1Database, table: string) =>
    (
      await db.prepare(`SELECT \`id_device\` FROM \`${table}\` WHERE \`id_device\` IN (?, ?)`).bind(idle, active).all()
    ).results.map((r) => r.id_device);
  expect(await owners(env.BOARD, 'device')).toEqual([active]);
  expect(await owners(env.BOARD, 'board_entry')).toEqual([active]);
  expect(await owners(env.REPLAY, 'replay')).toEqual([active]);
  expect(await owners(env.SAVE, 'device_save')).toEqual([active]);

  const quota = await env.BOARD.prepare('SELECT `day` FROM `quota` WHERE `day` < ?').bind(unixDay).all();
  expect(quota.results).toEqual([{ day: unixDay - 7 }]);
});
