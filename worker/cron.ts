// Daily cron (wrangler.toml `crons`): prune Replays, delete idle Devices, drop old quota rows.
import { dailyDay } from '../src/sim/daily';
import { deleteDevices } from './device';
import type { Env } from './env';
import { dayOf } from './time';

/** Replays kept per Daily Board: the top 100 for 30 days, then the top 10. */
const REPLAYS_FRESH = 100;
const REPLAYS_KEPT = 10;
const FRESH_DAYS = 30;
const IDLE_SECONDS = 730 * 86_400;
/** Idle Devices deleted per night; any left over go the next night. */
const IDLE_BATCH = 2000;
const QUOTA_DAYS = 7;

/** `at`: the scheduled time in Unix seconds. Runs at 00:30 UTC+2 (22:30 UTC), after the late window, so every day before today is closed. */
export async function dailyCleanup(env: Env, at: number): Promise<void> {
  const today = dailyDay(at * 1000);
  await env.REPLAY.prepare(
    'DELETE FROM `replay` WHERE `rowid` IN (' +
      'SELECT `rowid` FROM (' +
      'SELECT `rowid`, `day`, ROW_NUMBER() OVER (PARTITION BY `day` ORDER BY `ticks`, `id_device`) AS `place` ' +
      'FROM `replay` WHERE `day` < ?) ' +
      'WHERE `place` > CASE WHEN `day` < ? THEN ? ELSE ? END)',
  )
    .bind(today, today - FRESH_DAYS, REPLAYS_KEPT, REPLAYS_FRESH)
    .run();

  const idle = await env.BOARD.prepare('SELECT `id_device` FROM `device` WHERE `last_seen_at` < ? LIMIT ?')
    .bind(at - IDLE_SECONDS, IDLE_BATCH)
    .all<{ id_device: number }>();
  if (idle.results.length)
    await deleteDevices(
      env,
      idle.results.map((r) => r.id_device),
    );

  await env.BOARD.prepare('DELETE FROM `quota` WHERE `day` < ?')
    .bind(dayOf(at) - QUOTA_DAYS)
    .run();
}
