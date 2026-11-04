// POST /v1/runs — the Speedrun Board keeps each Device's fastest Run of a Map.
import { SIM_VERSION } from '../src/sim/version';
import type { RunResponse } from './api';
import { around, forgetBoard, mapBoardOf, rankOf } from './boards';
import { requireDevice } from './device';
import type { Env } from './env';
import { checkSimVersion, HttpError, int, json, KB, readJson } from './http';
import { limitWrite } from './limits';
import { nowSeconds } from './time';

export async function submitRun(req: Request, env: Env): Promise<Response> {
  const id = await requireDevice(req, env);
  const body = (await readJson(req, 2 * KB)) as Record<string, unknown> | null;
  const mapId = typeof body?.map === 'string' ? body.map : '';
  const { board, map } = mapBoardOf('speed', mapId);
  const ticks = int(body?.ticks);
  checkSimVersion(body?.simVersion);
  if (ticks < (map.speedrunFloorTicks ?? Infinity)) throw new HttpError('implausible');
  await limitWrite(env, 'run', id);

  const stored = await env.BOARD.prepare(
    'SELECT `ticks` FROM `board_entry` ' +
      "WHERE `kind` = 'speed' AND `map` = ? AND `day` = 0 AND `sim_version` = ? AND `id_device` = ?",
  )
    .bind(mapId, SIM_VERSION, id)
    .first<{ ticks: number }>();
  const now = nowSeconds();
  await env.BOARD.batch([
    env.BOARD.prepare(
      'INSERT INTO `board_entry` (`kind`, `map`, `day`, `sim_version`, `id_device`, `ticks`, `updated_at`) ' +
        "VALUES ('speed', ?, 0, ?, ?, ?, ?) " +
        'ON CONFLICT (`kind`, `map`, `day`, `sim_version`, `id_device`) ' +
        'DO UPDATE SET `ticks` = excluded.`ticks`, `updated_at` = excluded.`updated_at` WHERE excluded.`ticks` < `board_entry`.`ticks`',
    ).bind(mapId, SIM_VERSION, id, ticks, now),
    env.BOARD.prepare('UPDATE `device` SET `last_seen_at` = ? WHERE `id_device` = ?').bind(now, id),
  ]);
  forgetBoard(board);
  const improved = !stored || ticks < stored.ticks;
  const [{ rank, total }, you] = await Promise.all([
    rankOf(env, board, improved ? ticks : stored.ticks),
    around(env, board, id),
  ]);
  return json({ rank, total, improved, around: you?.around ?? [] } satisfies RunResponse);
}
