// Run and Score submits, and the queue that keeps what couldn't post yet (offline, a 429, no Device) until the
// next app start, Wall open, accepted submit or new Device (spec §12). One entry per Board: a Map's best Run and
// its latest Score.
import type { ErrorCode, RankResponse, RunResponse } from '../../worker/api';
import { fnv1a } from '../sim/rng';
import { SIM_VERSION } from '../sim/version';
import { api, type ApiResult } from './api';
import { read, write } from './storage';
import { forgetBoards } from './wall';

const QUEUE = 'wobbly-mart.pending';
const SENT = 'wobbly-mart.score-sent';
/** Worth another try later; any other error (another sim version, an implausible time) drops the submit. */
const RETRY = new Set<ErrorCode | 'offline'>(['offline', 'slow_down', 'unknown_device']);

interface Queue {
  simVersion: number;
  /** Map → ticks */
  runs: Record<string, number>;
  scores: Record<string, { score: number; playTime: number }>;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(read(key) ?? 'null') as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

/** A queue from another sim version is dropped: its Boards no longer show those rows. */
function queue(): Queue {
  const q = readJson<Queue | null>(QUEUE, null);
  return q?.simVersion === SIM_VERSION ? q : { simVersion: SIM_VERSION, runs: {}, scores: {} };
}

function change(edit: (q: Queue) => void): void {
  const q = queue();
  edit(q);
  write(QUEUE, JSON.stringify(q));
}

const settled = <T>(r: ApiResult<T>): boolean => r.ok || !RETRY.has(r.error);

async function postRun(code: string, map: string, ticks: number): Promise<ApiResult<RunResponse>> {
  const r = await api.postRun(code, { map, ticks, simVersion: SIM_VERSION });
  if (r.ok) forgetBoards(`speed/${map}/`);
  // a better Run queued meanwhile stays
  if (settled(r)) change((q) => q.runs[map] === ticks && delete q.runs[map]);
  return r;
}

/** Scores are sent once per rise, per Cloud Code and sim version (keyed by a hash of the code, never the code). */
const sentKey = (code: string, map: string): string => `${SIM_VERSION}/${fnv1a(code)}/${map}`;

async function postScore(code: string, map: string, s: Queue['scores'][string]): Promise<ApiResult<RankResponse>> {
  const r = await api.putScore(code, map, { ...s, simVersion: SIM_VERSION });
  if (r.ok) {
    write(SENT, JSON.stringify({ ...readJson<Record<string, number>>(SENT, {}), [sentKey(code, map)]: s.score }));
    forgetBoards(`score/${map}/`);
  }
  if (settled(r)) change((q) => q.scores[map]?.score === s.score && delete q.scores[map]);
  return r;
}

let flushing = false;

/** Posts everything queued, Runs first; stops at the first error worth a retry (likely still offline).
 * Resolves to how many were accepted. */
export async function flushPending(code: string): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let posted = 0;
  try {
    const q = queue();
    const sends = [
      ...Object.entries(q.runs).map(
        ([map, ticks]) =>
          () =>
            postRun(code, map, ticks),
      ),
      ...Object.entries(q.scores).map(
        ([map, s]) =>
          () =>
            postScore(code, map, s),
      ),
    ];
    for (const send of sends) {
      const r = await send();
      if (!settled(r)) break;
      if (r.ok) posted++;
    }
  } finally {
    flushing = false;
  }
  return posted;
}

/** Queues a finished Run, then posts it; null without a Device (it waits in the queue for one). */
export async function submitRun(
  code: string | null,
  map: string,
  ticks: number,
): Promise<ApiResult<RunResponse> | null> {
  change((q) => {
    if (!(map in q.runs) || ticks < q.runs[map]) q.runs[map] = ticks;
  });
  if (!code) return null;
  const r = await postRun(code, map, ticks);
  if (r.ok) void flushPending(code);
  return r;
}

/** Score only goes up within a save, so it's queued and sent only when it rose since the last accepted one. */
export async function submitScore(code: string, map: string, score: number, playTime: number): Promise<void> {
  if (score <= (readJson<Record<string, number>>(SENT, {})[sentKey(code, map)] ?? 0)) return;
  const s = { score, playTime: Math.floor(playTime) };
  change((q) => (q.scores[map] = s));
  if ((await postScore(code, map, s)).ok) void flushPending(code);
}
