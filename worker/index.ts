// The Board API Worker: router, CORS and the error boundary.
import type { Env } from './env';
import { createDevice, deleteDeviceRoute, getDevice, renameDevice, rotateCloudCode } from './device';
import { errorResponse, HttpError, preflight, withCors } from './http';
import { readBoard } from './boards';
import { submitRun } from './runs';
import { submitScore } from './scores';

type Handler = (req: Request, env: Env) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  '/v1/device': { POST: createDevice, GET: getDevice, DELETE: deleteDeviceRoute },
  '/v1/device/nickname': { PUT: renameDevice },
  '/v1/device/rotate': { POST: rotateCloudCode },
  '/v1/runs': { POST: submitRun },
};

/** Routes with a path parameter: /v1/boards/:kind/:map and /v1/scores/:map. */
const BOARD_PATH = /^\/v1\/boards\/([a-z]+)\/([a-z0-9-]+)$/;
const SCORE_PATH = /^\/v1\/scores\/([a-z0-9-]+)$/;

async function route(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight();
  const path = new URL(req.url).pathname;
  const board = BOARD_PATH.exec(path);
  if (board && req.method === 'GET') return readBoard(req, env, board[1], board[2]);
  const score = SCORE_PATH.exec(path);
  if (score && req.method === 'PUT') return submitScore(req, env, score[1]);
  const handlers = ROUTES[path];
  const handler = handlers && Object.hasOwn(handlers, req.method) ? handlers[req.method] : undefined;
  return handler ? handler(req, env) : errorResponse('not_found');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    let res: Response;
    try {
      res = await route(req, env);
    } catch (e) {
      if (e instanceof HttpError) res = errorResponse(e.code);
      else {
        // Message only: never the request, its headers or a D1 meta object.
        console.error('Unhandled error:', e instanceof Error ? e.message : 'unknown');
        res = errorResponse('server');
      }
    }
    return withCors(res, req.headers.get('Origin'), env);
  },
} satisfies ExportedHandler<Env>;
