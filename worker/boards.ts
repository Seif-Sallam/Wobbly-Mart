// Board reads: top 50 + total (cached 60 s per isolate), and your rank with Around you for a verified Device.
import { isTutorialMap, mapById } from '../maps';
import { SIM_VERSION } from '../src/sim/version';
import type { BoardResponse, Row } from './api';
import { findDevice } from './device';
import type { Env } from './env';
import { HttpError, json } from './http';
import { clientIp, limit } from './limits';

export const DAILY_MAP = 'daily';
const STREAK_MAP = '-';
/** Ranks are counted up to here; anything past it is sent as RANK_CAP + 1 ("1000+"). */
const RANK_CAP = 1000;
const CACHE_MS = 60_000;
const MAX_DAY = 1_000_000;

/** One literal query per Board shape; `scope` binds before any value. Never built from strings. */
interface Shape {
  top: string;
  total: string;
  mine: string;
  better: string;
  above: string;
  below: string;
}

const BY_TICKS: Shape = {
  top:
    'SELECT b.`id_device`, d.`nickname`, b.`ticks` AS value, b.`score`, b.`money` FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? ORDER BY b.`ticks`, b.`updated_at` LIMIT 50',
  total: 'SELECT COUNT(*) AS n FROM `board_entry` WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ?',
  mine:
    'SELECT b.`id_device`, d.`nickname`, b.`ticks` AS value, b.`score`, b.`money` FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`id_device` = ?',
  better:
    'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `ticks` < ? LIMIT 1000)',
  above:
    'SELECT b.`id_device`, d.`nickname`, b.`ticks` AS value, b.`score`, b.`money` FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`ticks` < ? ORDER BY b.`ticks` DESC LIMIT 2',
  below:
    'SELECT b.`id_device`, d.`nickname`, b.`ticks` AS value, b.`score`, b.`money` FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`ticks` > ? ORDER BY b.`ticks` LIMIT 2',
};

const BY_SCORE: Shape = {
  top:
    'SELECT b.`id_device`, d.`nickname`, b.`score` AS value FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? ORDER BY b.`score` DESC, b.`updated_at` LIMIT 50',
  total: 'SELECT COUNT(*) AS n FROM `board_entry` WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ?',
  mine:
    'SELECT b.`id_device`, d.`nickname`, b.`score` AS value FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`id_device` = ?',
  better:
    'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `score` > ? LIMIT 1000)',
  above:
    'SELECT b.`id_device`, d.`nickname`, b.`score` AS value FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`score` > ? ORDER BY b.`score` LIMIT 2',
  below:
    'SELECT b.`id_device`, d.`nickname`, b.`score` AS value FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`score` < ? ORDER BY b.`score` DESC LIMIT 2',
};

const BY_STREAK: Shape = {
  top:
    'SELECT `id_device`, `nickname`, `streak_best` AS value, `streak_current` AS streak FROM `device` ' +
    'WHERE `streak_best` > 0 ORDER BY `streak_best` DESC, `id_device` LIMIT 50',
  total: 'SELECT COUNT(*) AS n FROM `device` WHERE `streak_best` > 0',
  mine:
    'SELECT `id_device`, `nickname`, `streak_best` AS value, `streak_current` AS streak FROM `device` ' +
    'WHERE `streak_best` > 0 AND `id_device` = ?',
  better: 'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `device` WHERE `streak_best` > ? LIMIT 1000)',
  above:
    'SELECT `id_device`, `nickname`, `streak_best` AS value, `streak_current` AS streak FROM `device` ' +
    'WHERE `streak_best` > ? ORDER BY `streak_best` LIMIT 2',
  below:
    'SELECT `id_device`, `nickname`, `streak_best` AS value, `streak_current` AS streak FROM `device` ' +
    'WHERE `streak_best` > 0 AND `streak_best` < ? ORDER BY `streak_best` DESC LIMIT 2',
};

export interface Board {
  shape: Shape;
  /** Binds for kind, map, day, sim_version (empty for the Streak Board). */
  scope: (string | number)[];
}

interface DbRow {
  id_device: number;
  nickname: string;
  value: number;
  score?: number | null;
  money?: number | null;
  streak?: number | null;
}

/** Whitelists kind, map and day before any query. */
export function boardOf(kind: string, map: string, day: number): Board {
  if (kind === 'streak' && map === STREAK_MAP) return { shape: BY_STREAK, scope: [] };
  if (kind === 'daily' && map === DAILY_MAP && Number.isInteger(day) && day > 0 && day < MAX_DAY)
    return { shape: BY_TICKS, scope: ['daily', DAILY_MAP, day, SIM_VERSION] };
  const def = mapById(map);
  if ((kind === 'speed' || kind === 'score') && def && !isTutorialMap(def))
    return { shape: kind === 'speed' ? BY_TICKS : BY_SCORE, scope: [kind, map, 0, SIM_VERSION] };
  throw new HttpError('bad_request');
}

const count = async (env: Env, sql: string, binds: unknown[]): Promise<number> =>
  (
    await env.BOARD.prepare(sql)
      .bind(...binds)
      .first<{ n: number }>()
  )?.n ?? 0;

const rowsOf = async (env: Env, sql: string, binds: unknown[]): Promise<DbRow[]> =>
  (
    await env.BOARD.prepare(sql)
      .bind(...binds)
      .all<DbRow>()
  ).results;

const capRank = (rank: number): number => Math.min(rank, RANK_CAP + 1);

/** Strips the Device id; marks your own row. */
function toRow(r: DbRow, rank: number, me: number | null): Row {
  return {
    rank,
    nickname: r.nickname,
    value: r.value,
    ...(r.score != null && { score: r.score }),
    ...(r.money != null && { money: r.money }),
    ...(r.streak != null && { streak: r.streak }),
    ...(r.id_device === me && { you: true as const }),
  };
}

/** A value's rank on a Board (ties share a rank) and the Board's size. */
export async function rankOf(env: Env, board: Board, value: number): Promise<{ rank: number; total: number }> {
  const [better, total] = await Promise.all([
    count(env, board.shape.better, [...board.scope, value]),
    count(env, board.shape.total, board.scope),
  ]);
  return { rank: capRank(better + 1), total };
}

/** Per isolate, best effort: a Board's top and total for 60 s. */
const cache = new Map<string, { at: number; top: DbRow[]; total: number }>();

/** Submits call this so the writer sees their own row at once (other isolates catch up within 60 s). */
export const forgetBoard = (board: Board): boolean => cache.delete(JSON.stringify(board.scope));

async function topOf(env: Env, board: Board): Promise<{ top: DbRow[]; total: number }> {
  const key = JSON.stringify(board.scope);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const [top, total] = await Promise.all([
    rowsOf(env, board.shape.top, board.scope),
    count(env, board.shape.total, board.scope),
  ]);
  cache.set(key, { at: Date.now(), top, total });
  return { top, total };
}

/** Competition ranking down an ordered list: equal values share a rank. */
function ranked(rows: DbRow[], me: number | null): Row[] {
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.value !== rows[i - 1].value) rank = i + 1;
    return toRow(r, rank, me);
  });
}

async function around(env: Env, board: Board, me: number): Promise<BoardResponse['you']> {
  const mine = await env.BOARD.prepare(board.shape.mine)
    .bind(...board.scope, me)
    .first<DbRow>();
  if (!mine) return undefined;
  const [{ rank }, above, below] = await Promise.all([
    rankOf(env, board, mine.value),
    rowsOf(env, board.shape.above, [...board.scope, mine.value]),
    rowsOf(env, board.shape.below, [...board.scope, mine.value]),
  ]);
  return {
    rank,
    around: [
      ...above.reverse().map((r, i, all) => toRow(r, capRank(Math.max(1, rank - (all.length - i))), me)),
      toRow(mine, rank, me),
      ...below.map((r, i) => toRow(r, capRank(rank + i + 1), me)),
    ],
  };
}

export async function readBoard(req: Request, env: Env, kind: string, map: string): Promise<Response> {
  await limit(env.READ_LIMIT, clientIp(req));
  const dayParam = new URL(req.url).searchParams.get('day');
  const board = boardOf(kind, map, dayParam === null ? 0 : Number(dayParam));
  const me = await findDevice(req, env);
  const { top, total } = await topOf(env, board);
  const you = me === null ? undefined : await around(env, board, me);
  return json({ top: ranked(top, me), total, ...(you && { you }) } satisfies BoardResponse);
}
