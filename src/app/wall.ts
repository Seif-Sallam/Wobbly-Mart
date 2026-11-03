// The Wall of Fame's data: Board reads kept 60 s in memory.
import type { BoardKind, BoardResponse } from '../../worker/api';
import { api } from './api';

const CACHE_MS = 60_000;

const cache = new Map<string, { at: number; data: BoardResponse }>();

/** Drops cached reads under `kind/map/` once a submit changed that Board. */
export const forgetBoards = (prefix: string): void => {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
};

/** A Board, or null when it is out of reach. Cached per Board and Device for 60 s. */
export async function readBoard(
  kind: BoardKind,
  map: string,
  day: number,
  code: string | null,
): Promise<BoardResponse | null> {
  const key = `${kind}/${map}/${day}/${code ?? ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const r = await api.board(kind, map, day, code);
  if (!r.ok) return null;
  cache.set(key, { at: Date.now(), data: r.data });
  return r.data;
}
