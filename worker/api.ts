// Request and response bodies of the Board API (/v1). src/app imports this file type-only.

export type ErrorCode =
  'bad_request' | 'unknown_device' | 'not_found' | 'update' | 'name_blocked' | 'implausible' | 'slow_down' | 'server';

/** Every non-2xx body. `message` is a fixed string per code, never internals. */
export interface ApiError {
  error: ErrorCode;
  message: string;
}

/** POST /v1/device and PUT /v1/device/nickname. */
export interface NicknameBody {
  nickname: string;
}

/** POST /v1/device and POST /v1/device/rotate. The Cloud Code is only ever returned here. */
export interface CloudCodeResponse {
  cloudCode: string;
}

/** GET /v1/device. `cloudSaveAt` (Unix seconds) only when a cloud save exists. */
export interface DeviceResponse {
  nickname: string;
  cloudSaveAt?: number;
}

export type BoardKind = 'speed' | 'score' | 'daily' | 'streak';

/** One Wall row. `value` is ticks (speed, daily), Score (score) or the best Streak (streak). Rank 1001 = "1000+". */
export interface Row {
  rank: number;
  nickname: string;
  value: number;
  score?: number;
  money?: number;
  /** Streak Board: the current Streak. */
  streak?: number;
  you?: true;
}

/** GET /v1/boards/:kind/:map?day= (`map` = `-` for streak). `you` only for a verified Device with a row. */
export interface BoardResponse {
  top: Row[];
  you?: { rank: number; around: Row[] };
  total: number;
}

/** PUT /v1/scores/:map */
export interface ScoreBody {
  score: number;
  /** Seconds the sim ran on this Map. */
  playTime: number;
  simVersion: number;
}

/** POST /v1/runs, sent at 100% Completion of a valid Run. */
export interface RunBody {
  map: string;
  ticks: number;
  simVersion: number;
}

/** POST /v1/shifts. `replay`: the gzipped Replay JSON, base64; at most 64 KB before base64. */
export interface ShiftBody {
  day: number;
  /** Sim ticks to the goal. */
  ticks: number;
  score: number;
  /** Money earned in the Shift. */
  money: number;
  simVersion: number;
  replay: string;
}

/** Every submit's answer: where the row stands now. */
export interface RankResponse {
  rank: number;
  total: number;
  improved: boolean;
}

/** A Run's answer also carries Around you, so the end screen needs no Board read. */
export interface RunResponse extends RankResponse {
  around: Row[];
}

/** POST /v1/shifts: the rank of the day, Around you and the Streak after this Shift. */
export interface ShiftResponse extends RunResponse {
  streak: number;
}

/** Gzipped save JSON, before base64: about 4x a full-progress save (the bot keeps that under a quarter of it). */
export const SAVE_CAP = 16 * 1024;

/** PUT /v1/save. `saveCode`: the gzipped save JSON, base64. */
export interface SaveBody {
  saveCode: string;
}

/** GET /v1/save. `saveAt` in Unix seconds. */
export interface SaveResponse {
  saveCode: string;
  saveAt: number;
}
