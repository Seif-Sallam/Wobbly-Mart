// POST /v1/shifts — the Daily Board keeps each Device's fastest finished Shift of the day, and every finished Shift
// counts for the Streak. The Worker never re-sims: the Replay is only checked for size and against the claim.
import calendar from '../maps/daily-calendar.json';
import type { DailyCalendar } from '../src/sim/daily-goal';
import { dailyDate, dailyDay, dailySeed, shiftCaps } from '../src/sim/daily';
import type { Replay, ReplayHeader } from '../src/sim/replay';
import { SIM_VERSION } from '../src/sim/version';
import type { ShiftResponse } from './api';
import { around, boardOf, DAILY_MAP, forgetBoard, rankOf } from './boards';
import { requireDevice } from './device';
import type { Env } from './env';
import { fromBase64, gunzip } from './gzip';
import { HttpError, json, KB, readJson } from './http';
import { limitWrite } from './limits';
import { checkSimVersion, int } from './scores';
import { nowSeconds } from './time';

const DAYS = (calendar as unknown as DailyCalendar).days;
/** Day D is taken until 00:15 UTC on D+1. */
const LATE_MS = 15 * 60_000;
const REPLAY_MAX = 64 * KB;
const UNZIPPED_MAX = 1024 * KB;

export async function submitShift(req: Request, env: Env): Promise<Response> {
  const id = await requireDevice(req, env);
  const body = (await readJson(req, 96 * KB)) as Record<string, unknown> | null;
  const claim: ReplayHeader = {
    simVersion: SIM_VERSION,
    day: int(body?.day),
    seed: 0,
    ticks: int(body?.ticks),
    score: int(body?.score),
    money: int(body?.money),
  };
  checkSimVersion(body?.simVersion);
  const { day, ticks } = claim;
  const now = Date.now();
  if (day !== dailyDay(now) && day !== dailyDay(now - LATE_MS)) throw new HttpError('implausible');
  claim.seed = dailySeed(day);
  const entry = DAYS[dailyDate(day)];
  if (!entry || ticks < entry.floorTicks) throw new HttpError('implausible');
  const caps = shiftCaps(entry.goal, ticks);
  if (claim.score > caps.score || claim.money > caps.money) throw new HttpError('implausible');
  await limitWrite(env, 'shift', id);

  // the Streak counts any finished Shift, even one whose Replay is refused below
  await env.BOARD.prepare(
    'UPDATE `device` SET ' +
      '`streak_current` = CASE WHEN `streak_last_day` = ? THEN `streak_current` + 1 ELSE 1 END, ' +
      '`streak_best` = MAX(`streak_best`, CASE WHEN `streak_last_day` = ? THEN `streak_current` + 1 ELSE 1 END), ' +
      '`streak_last_day` = ? ' +
      'WHERE `id_device` = ? AND (`streak_last_day` IS NULL OR `streak_last_day` < ?)',
  )
    .bind(day - 1, day - 1, day, id, day)
    .run();
  const data = await replayOf(body?.replay, claim);
  if (!data) throw new HttpError('implausible');

  const board = boardOf('daily', DAILY_MAP, day);
  const at = nowSeconds();
  const stored = await env.BOARD.prepare(
    'SELECT `ticks` FROM `board_entry` ' +
      "WHERE `kind` = 'daily' AND `map` = 'daily' AND `day` = ? AND `sim_version` = ? AND `id_device` = ?",
  )
    .bind(day, SIM_VERSION, id)
    .first<{ ticks: number }>();
  await env.BOARD.batch([
    env.BOARD.prepare(
      'INSERT INTO `board_entry` (`kind`, `map`, `day`, `sim_version`, `id_device`, `ticks`, `score`, `money`, `updated_at`) ' +
        "VALUES ('daily', 'daily', ?, ?, ?, ?, ?, ?, ?) " +
        'ON CONFLICT (`kind`, `map`, `day`, `sim_version`, `id_device`) ' +
        'DO UPDATE SET `ticks` = excluded.`ticks`, `score` = excluded.`score`, `money` = excluded.`money`, ' +
        '`updated_at` = excluded.`updated_at` WHERE excluded.`ticks` < `board_entry`.`ticks`',
    ).bind(day, SIM_VERSION, id, ticks, claim.score, claim.money, at),
    env.BOARD.prepare('UPDATE `device` SET `last_seen_at` = ? WHERE `id_device` = ?').bind(at, id),
  ]);
  forgetBoard(board);
  forgetBoard(boardOf('streak', '-', 0));
  const improved = !stored || ticks < stored.ticks;
  if (improved) await storeReplay(env, day, id, ticks, data);

  const [{ rank, total }, you, streak] = await Promise.all([
    rankOf(env, board, improved ? ticks : stored.ticks),
    around(env, board, id),
    env.BOARD.prepare('SELECT `streak_current` AS n FROM `device` WHERE `id_device` = ?')
      .bind(id)
      .first<{ n: number }>(),
  ]);
  return json({
    rank,
    total,
    improved,
    streak: streak?.n ?? 0,
    around: you?.around ?? [],
  } satisfies ShiftResponse);
}

/** The gzipped Replay, or null when it is missing, over 64 KB, unreadable or claims something else than the submit. */
async function replayOf(value: unknown, claim: ReplayHeader): Promise<Uint8Array | null> {
  if (typeof value !== 'string' || value.length > Math.ceil(REPLAY_MAX / 3) * 4) return null;
  const bytes = fromBase64(value);
  const text = bytes && (await gunzip(bytes, UNZIPPED_MAX));
  if (text === null) return null;
  try {
    const r = JSON.parse(text) as Replay;
    const h = r.header as unknown as Record<string, unknown>;
    const same = (Object.keys(claim) as (keyof ReplayHeader)[]).every((k) => h[k] === claim[k]);
    return same && r.log.ticks === claim.ticks && Array.isArray(r.log.entries) ? bytes : null;
  } catch {
    return null;
  }
}

/** Called when the Board row improved (this sim's), so it replaces any older Replay. A failed insert never fails
 *  the submit. */
async function storeReplay(env: Env, day: number, id: number, ticks: number, data: Uint8Array): Promise<void> {
  try {
    await env.REPLAY.prepare(
      'INSERT INTO `replay` (`day`, `id_device`, `ticks`, `data`) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT (`day`, `id_device`) DO UPDATE SET `ticks` = excluded.`ticks`, `data` = excluded.`data`',
    )
      .bind(day, id, ticks, data)
      .run();
  } catch (e) {
    console.error('Replay insert failed:', e instanceof Error ? e.message : 'unknown');
  }
}
