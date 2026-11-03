// Responses, errors, CORS and capped JSON bodies.
import type { ApiError, ErrorCode } from './api';

const ERRORS: Record<ErrorCode, [status: number, message: string]> = {
  bad_request: [400, 'Bad request'],
  unknown_device: [401, 'Unknown Cloud Code'],
  not_found: [404, 'Not found'],
  update: [409, 'A new version is out'],
  name_blocked: [422, 'That name is not allowed'],
  implausible: [422, 'Result not accepted'],
  slow_down: [429, 'Too many requests'],
  server: [500, 'Something went wrong'],
};

/** Thrown anywhere in a route; the router turns it into the fixed error body. */
export class HttpError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const noContent = (): Response => new Response(null, { status: 204 });

export function errorResponse(code: ErrorCode): Response {
  const [status, message] = ERRORS[code];
  return json({ error: code, message } satisfies ApiError, status);
}

export const KB = 1024;

/** Reads at most `cap` bytes of JSON: refuses on Content-Length first, then while streaming (chunked bodies). */
export async function readJson(req: Request, cap: number): Promise<unknown> {
  const length = Number(req.headers.get('Content-Length') ?? 0);
  if (!(length <= cap)) throw new HttpError('bad_request');
  if (!req.body) throw new HttpError('bad_request');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of req.body) {
    size += chunk.byteLength;
    if (size > cap) throw new HttpError('bad_request');
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError('bad_request');
  }
}

const LAN =
  /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/;

/** `CORS_ORIGINS` is a comma list of exact origins; `CORS_LAN = "true"` also allows localhost and private LAN IPs. */
function allowedOrigin(origin: string | null, env: { CORS_ORIGINS: string; CORS_LAN: string }): string | null {
  if (!origin) return null;
  if (env.CORS_ORIGINS.split(',').some((o) => o.trim() === origin)) return origin;
  return env.CORS_LAN === 'true' && LAN.test(origin) ? origin : null;
}

/** Adds CORS headers for a listed Origin only; never reflects an unlisted one, never allows credentials. */
export function withCors(
  res: Response,
  origin: string | null,
  env: { CORS_ORIGINS: string; CORS_LAN: string },
): Response {
  const out = new Response(res.body, res);
  out.headers.append('Vary', 'Origin');
  const allowed = allowedOrigin(origin, env);
  if (allowed) out.headers.set('Access-Control-Allow-Origin', allowed);
  return out;
}

export const preflight = (): Response =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
