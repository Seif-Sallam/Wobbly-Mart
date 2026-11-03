// The Wall of Fame's data: Board reads kept 60 s in memory, and the Score submit at the end of an Opening.
import type { BoardKind, BoardResponse } from '../../worker/api';
import { fnv1a } from '../sim/rng';
import { SIM_VERSION } from '../sim/version';
import { api } from './api';
import { read, write } from './storage';

const CACHE_MS = 60_000;
const SENT = 'wobbly-mart.score-sent';

const cache = new Map<string, { at: number; data: BoardResponse }>();

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

/** Score only goes up within a save, so a Map's Score is sent only when it rose since the last accepted one
 * for this Cloud Code and sim version (a hash of the code keys the record, never the code). */
export async function submitScore(code: string, map: string, score: number, playTime: number): Promise<void> {
  const key = `${SIM_VERSION}/${fnv1a(code)}/${map}`;
  let sent: Record<string, number> = {};
  try {
    sent = JSON.parse(read(SENT) ?? '{}') as Record<string, number>;
  } catch {
    // a broken record just sends again
  }
  if (score <= (sent[key] ?? 0)) return;
  const r = await api.putScore(code, map, { score, playTime: Math.floor(playTime), simVersion: SIM_VERSION });
  if (!r.ok) return;
  write(SENT, JSON.stringify({ ...sent, [key]: score }));
  for (const key of cache.keys()) if (key.startsWith(`score/${map}/`)) cache.delete(key);
}
