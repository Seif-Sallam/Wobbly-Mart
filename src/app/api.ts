// The Board API client. A build without VITE_API_URL has API_URL null: every online feature hides.
import type {
  ApiError,
  BoardKind,
  BoardResponse,
  CloudCodeResponse,
  DeviceResponse,
  ErrorCode,
  RankResponse,
  RunBody,
  RunResponse,
  SaveResponse,
  ScoreBody,
  ShiftBody,
  ShiftResponse,
} from '../../worker/api';

const DEV_PORT = 8787;
/** A call that hangs this long counts as out of reach. */
const TIMEOUT_MS = 10_000;

export const API_URL: string | null =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? `http://${location.hostname}:${DEV_PORT}` : null);

/** `offline` covers no network, a timeout, a 5xx and an unreadable reply. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ErrorCode | 'offline' };

async function call<T>(
  method: string,
  path: string,
  opts: { code?: string | null; body?: unknown; keepalive?: boolean } = {},
): Promise<ApiResult<T>> {
  if (!API_URL) return { ok: false, error: 'offline' };
  const headers: Record<string, string> = {};
  if (opts.code) headers.Authorization = `Bearer ${opts.code}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      keepalive: opts.keepalive,
    });
    if (res.status >= 500) return { ok: false, error: 'offline' };
    if (!res.ok) return { ok: false, error: ((await res.json()) as ApiError).error };
    return { ok: true, data: (res.status === 204 ? undefined : await res.json()) as T };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export const api = {
  createDevice: (nickname: string) => call<CloudCodeResponse>('POST', '/v1/device', { body: { nickname } }),
  checkDevice: (code: string) => call<DeviceResponse>('GET', '/v1/device', { code }),
  rename: (code: string, nickname: string) =>
    call<undefined>('PUT', '/v1/device/nickname', { code, body: { nickname } }),
  rotate: (code: string) => call<CloudCodeResponse>('POST', '/v1/device/rotate', { code }),
  deleteDevice: (code: string) => call<undefined>('DELETE', '/v1/device', { code }),
  /** `code` (optional) adds your rank and Around you. */
  board: (kind: BoardKind, map: string, day: number, code: string | null) =>
    call<BoardResponse>('GET', `/v1/boards/${kind}/${map}${kind === 'daily' ? `?day=${day}` : ''}`, { code }),
  /** keepalive: it may be sent as the page is hidden. */
  putScore: (code: string, map: string, body: ScoreBody) =>
    call<RankResponse>('PUT', `/v1/scores/${map}`, { code, body, keepalive: true }),
  postRun: (code: string, body: RunBody) => call<RunResponse>('POST', '/v1/runs', { code, body }),
  postShift: (code: string, body: ShiftBody) => call<ShiftResponse>('POST', '/v1/shifts', { code, body }),
  /** keepalive, like the Score: both go up as an Opening ends. */
  putSave: (code: string, saveCode: string) =>
    call<undefined>('PUT', '/v1/save', { code, body: { saveCode }, keepalive: true }),
  getSave: (code: string) => call<SaveResponse>('GET', '/v1/save', { code }),
};
