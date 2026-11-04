// Board reads: top 50 + total (cached 60 s per isolate), and your rank with Around you for a verified Device.
// Counts stop at RANK_CAP rows, so no read scans a whole Board (D1 Free bills every row read).
import { isTutorialMap, mapById } from '../maps';
import type { MapDef } from '../src/sim/map';
import { dailyDay } from '../src/sim/daily';
import { SIM_VERSION } from '../src/sim/version';
import { RANK_CAP, type BoardResponse, type Row } from './api';
import { findDevice } from './device';
import type { Env } from './env';
import { HttpError, json } from './http';
import { clientIp, limit } from './limits';

export const DAILY_MAP = 'daily';
export const STREAK_MAP = '-';
const CACHE_MS = 60_000;
/** The Board cache holds this many Boards; the oldest goes first. */
const CACHE_BOARDS = 100;
const MAX_DAY = 1_000_000;

/** One literal query per Board shape; `scope` binds before any value. Never built from strings. */
interface Shape {
  top: string;
  total: string;
  mine: string;
  /** Rows better than a value, counted up to a cap; binds scope, the value, the cap. */
  better: string;
  /** Rows better than `a` but not better than `b` (b is the better or equal one); binds scope, a, b. */
  between: string;
  /** The two rows just better than yours; binds scope, scope, your id. */
  above: string;
  /** The two rows tied with or just worse than yours; binds scope, scope, your id, your id. */
  below: string;
}

const BY_TICKS: Shape = {
  top:
    'SELECT b.`id_device`, d.`nickname`, b.`ticks` AS value, b.`score`, b.`money` FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? ORDER BY b.`ticks`, b.`updated_at` LIMIT 50',
  total:
    'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `board_entry` WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? LIMIT ?)',
  mine:
    'SELECT b.`id_device`, d.`nickname`, b.`ticks` AS value, b.`score`, b.`money` FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`id_device` = ?',
  better:
    'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `ticks` < ? LIMIT ?)',
  between:
    'SELECT COUNT(*) AS n FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `ticks` < ? AND `ticks` >= ?',
  above:
    'SELECT b.`id_device`, d.`nickname`, b.`ticks` AS value, b.`score`, b.`money` FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`ticks` < (SELECT `ticks` FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `id_device` = ?) ORDER BY b.`ticks` DESC LIMIT 2',
  below:
    'SELECT b.`id_device`, d.`nickname`, b.`ticks` AS value, b.`score`, b.`money` FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`ticks` >= (SELECT `ticks` FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `id_device` = ?) AND b.`id_device` <> ? ' +
    'ORDER BY b.`ticks`, b.`updated_at` LIMIT 2',
};

const BY_SCORE: Shape = {
  top:
    'SELECT b.`id_device`, d.`nickname`, b.`score` AS value FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? ORDER BY b.`score` DESC, b.`updated_at` LIMIT 50',
  total:
    'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `board_entry` WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? LIMIT ?)',
  mine:
    'SELECT b.`id_device`, d.`nickname`, b.`score` AS value FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`id_device` = ?',
  better:
    'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `score` > ? LIMIT ?)',
  between:
    'SELECT COUNT(*) AS n FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `score` > ? AND `score` <= ?',
  above:
    'SELECT b.`id_device`, d.`nickname`, b.`score` AS value FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`score` > (SELECT `score` FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `id_device` = ?) ORDER BY b.`score` LIMIT 2',
  below:
    'SELECT b.`id_device`, d.`nickname`, b.`score` AS value FROM `board_entry` b ' +
    'JOIN `device` d ON d.`id_device` = b.`id_device` ' +
    'WHERE b.`kind` = ? AND b.`map` = ? AND b.`day` = ? AND b.`sim_version` = ? AND b.`score` <= (SELECT `score` FROM `board_entry` ' +
    'WHERE `kind` = ? AND `map` = ? AND `day` = ? AND `sim_version` = ? AND `id_device` = ?) AND b.`id_device` <> ? ' +
    'ORDER BY b.`score` DESC, b.`updated_at` LIMIT 2',
};

const BY_STREAK: Shape = {
  top:
    'SELECT `id_device`, `nickname`, `streak_best` AS value, `streak_current` AS streak, `streak_last_day` AS last_day FROM `device` ' +
    'WHERE `streak_best` > 0 ORDER BY `streak_best` DESC, `id_device` LIMIT 50',
  total: 'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `device` WHERE `streak_best` > 0 LIMIT ?)',
  mine:
    'SELECT `id_device`, `nickname`, `streak_best` AS value, `streak_current` AS streak, `streak_last_day` AS last_day FROM `device` ' +
    'WHERE `streak_best` > 0 AND `id_device` = ?',
  better: 'SELECT COUNT(*) AS n FROM (SELECT 1 FROM `device` WHERE `streak_best` > ? LIMIT ?)',
  between: 'SELECT COUNT(*) AS n FROM `device` WHERE `streak_best` > ? AND `streak_best` <= ?',
  above:
    'SELECT `id_device`, `nickname`, `streak_best` AS value, `streak_current` AS streak, `streak_last_day` AS last_day FROM `device` ' +
    'WHERE `streak_best` > (SELECT `streak_best` FROM `device` WHERE `id_device` = ?) ORDER BY `streak_best` LIMIT 2',
  below:
    'SELECT `id_device`, `nickname`, `streak_best` AS value, `streak_current` AS streak, `streak_last_day` AS last_day FROM `device` ' +
    'WHERE `streak_best` > 0 AND `streak_best` <= (SELECT `streak_best` FROM `device` WHERE `id_device` = ?) AND `id_device` <> ? ' +
    'ORDER BY `streak_best` DESC, `id_device` LIMIT 2',
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
  last_day?: number | null;
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

/** A submit's Map Board and the Map it ranks; bad_request for an unknown or Tutorial Map. */
export function mapBoardOf(kind: 'speed' | 'score', mapId: string): { board: Board; map: MapDef } {
  const board = boardOf(kind, mapId, 0);
  return { board, map: mapById(mapId) as MapDef };
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

/** The current Streak as of today: a Streak whose last Shift is older than yesterday's has broken. */
const liveStreak = (r: DbRow, today: number): number => ((r.last_day ?? 0) >= today - 1 ? (r.streak ?? 0) : 0);

/** Strips the Device id; marks your own row. */
function toRow(r: DbRow, rank: number, me: number | null): Row {
  return {
    rank,
    nickname: r.nickname,
    value: r.value,
    ...(r.score != null && { score: r.score }),
    ...(r.money != null && { money: r.money }),
    ...(r.streak != null && { streak: liveStreak(r, dailyDay(Date.now())) }),
    ...(r.id_device === me && { you: true as const }),
  };
}

/** A value's rank on a Board (ties share a rank) and the Board's size. */
export async function rankOf(env: Env, board: Board, value: number): Promise<{ rank: number; total: number }> {
  const [better, total] = await Promise.all([
    count(env, board.shape.better, [...board.scope, value, RANK_CAP]),
    count(env, board.shape.total, [...board.scope, RANK_CAP + 1]),
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
    count(env, board.shape.total, [...board.scope, RANK_CAP + 1]),
  ]);
  if (cache.size >= CACHE_BOARDS) cache.delete(cache.keys().next().value as string);
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

/** Your row and ±2 around it, each ranked by its own value (ties share a rank). One capped count ranks you; each
 *  neighbour's rank is yours moved by the few rows between you. Past the cap, a better neighbour counts its own. */
export async function around(env: Env, board: Board, me: number): Promise<BoardResponse['you']> {
  const [mine, above, below] = await Promise.all([
    env.BOARD.prepare(board.shape.mine)
      .bind(...board.scope, me)
      .first<DbRow>(),
    rowsOf(env, board.shape.above, [...board.scope, ...board.scope, me]),
    rowsOf(env, board.shape.below, [...board.scope, ...board.scope, me, me]),
  ]);
  if (!mine) return undefined;
  const { shape, scope } = board;
  const myBetter = await count(env, shape.better, [...scope, mine.value, RANK_CAP]);
  const capped = myBetter >= RANK_CAP;
  const betterOf = new Map([[mine.value, myBetter]]);
  await Promise.all([
    ...[...new Set(above.map((r) => r.value))].map(async (v) =>
      betterOf.set(
        v,
        capped
          ? await count(env, shape.better, [...scope, v, RANK_CAP])
          : myBetter - (await count(env, shape.between, [...scope, mine.value, v])),
      ),
    ),
    ...[...new Set(below.map((r) => r.value))]
      .filter((v) => v !== mine.value)
      .map(async (v) =>
        betterOf.set(v, capped ? RANK_CAP : myBetter + (await count(env, shape.between, [...scope, v, mine.value]))),
      ),
  ]);
  const rank = (r: DbRow): number => capRank((betterOf.get(r.value) ?? RANK_CAP) + 1);
  const rows = [...above.reverse(), mine, ...below];
  return { rank: rank(mine), around: rows.map((r) => toRow(r, rank(r), me)) };
}

/** A stale Cloud Code (rotated or deleted elsewhere) reads the public Board. */
const readerOf = (req: Request, env: Env): Promise<number | null> =>
  findDevice(req, env).catch((e: unknown) => {
    if (e instanceof HttpError && e.code === 'unknown_device') return null;
    throw e;
  });

export async function readBoard(req: Request, env: Env, kind: string, map: string): Promise<Response> {
  await limit(env.READ_LIMIT, clientIp(req));
  const dayParam = new URL(req.url).searchParams.get('day');
  const board = boardOf(kind, map, dayParam === null ? 0 : Number(dayParam));
  const [me, { top, total }] = await Promise.all([readerOf(req, env), topOf(env, board)]);
  const you = me === null ? undefined : await around(env, board, me);
  return json({ top: ranked(top, me), total, ...(you && { you }) } satisfies BoardResponse);
}
