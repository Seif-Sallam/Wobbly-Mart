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
