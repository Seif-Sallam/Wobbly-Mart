// PUT /v1/scores/:map — the Score Board keeps each Device's latest Score, inside what the Map could have paid.
import { mapById } from '../maps';
import type { MapDef } from '../src/sim/map';
import { fixedMaxScore, maxScoreRate } from '../src/sim/score';
import { SIM_VERSION } from '../src/sim/version';
import type { RankResponse } from './api';
import { boardOf, forgetBoard, rankOf } from './boards';
import { requireDevice } from './device';
import type { Env } from './env';
import { HttpError, json, KB, readJson } from './http';
import { limitWrite } from './limits';
import { nowSeconds } from './time';

/** No first submit can claim more play time than saves have counted it: since release-02 went live (#110). */
const RELEASE_LAUNCH_DATE = Date.UTC(2026, 9, 18) / 1000;
/** Play time may grow 10% faster than the wall clock, plus a minute of slack. */
const PLAY_TIME_SLACK = 1.1;
const PLAY_TIME_GRACE = 60;

/** A whole number in 0..max, or a 400. */
export function int(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max)
    throw new HttpError('bad_request');
  return value;
}

/** A submit from another sim version can't be compared: the client must reload. */
export function checkSimVersion(simVersion: unknown): void {
  if (int(simVersion) !== SIM_VERSION) throw new HttpError('update');
}

export async function submitScore(req: Request, env: Env, mapId: string): Promise<Response> {
  const id = await requireDevice(req, env);
  const board = boardOf('score', mapId, 0);
  // boardOf already refused an unknown or Tutorial Map
  const map = mapById(mapId) as MapDef;
  const body = (await readJson(req, 2 * KB)) as Record<string, unknown> | null;
  const score = int(body?.score);
  const playTime = int(body?.playTime);
  checkSimVersion(body?.simVersion);
  await limitWrite(env, 'score', id);

  const now = nowSeconds();
  const stored = await env.BOARD.prepare(
    'SELECT `score`, `play_time`, `updated_at` FROM `board_entry` ' +
      "WHERE `kind` = 'score' AND `map` = ? AND `day` = 0 AND `sim_version` = ? AND `id_device` = ?",
  )
    .bind(mapId, SIM_VERSION, id)
    .first<{ score: number; play_time: number; updated_at: number }>();
  const plausible =
    score <= fixedMaxScore(map) + playTime * maxScoreRate() &&
    (stored
      ? playTime >= stored.play_time &&
        playTime <= stored.play_time + (now - stored.updated_at) * PLAY_TIME_SLACK + PLAY_TIME_GRACE
      : playTime <= now - RELEASE_LAUNCH_DATE);
  if (!plausible) throw new HttpError('implausible');

  await env.BOARD.batch([
    env.BOARD.prepare(
      'INSERT INTO `board_entry` (`kind`, `map`, `day`, `sim_version`, `id_device`, `score`, `play_time`, `updated_at`) ' +
        "VALUES ('score', ?, 0, ?, ?, ?, ?, ?) " +
        'ON CONFLICT (`kind`, `map`, `day`, `sim_version`, `id_device`) ' +
        'DO UPDATE SET `score` = excluded.`score`, `play_time` = excluded.`play_time`, `updated_at` = excluded.`updated_at`',
    ).bind(mapId, SIM_VERSION, id, score, playTime, now),
    env.BOARD.prepare('UPDATE `device` SET `last_seen_at` = ? WHERE `id_device` = ?').bind(now, id),
  ]);
  forgetBoard(board);
  const { rank, total } = await rankOf(env, board, score);
  return json({ rank, total, improved: !stored || score > stored.score } satisfies RankResponse);
}
