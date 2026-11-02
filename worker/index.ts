// The Board API Worker: router, CORS and the error boundary.
import type { Env } from './env';
import { createDevice, deleteDeviceRoute, getDevice, renameDevice, rotateCloudCode } from './device';
import { errorResponse, HttpError, preflight, withCors } from './http';

type Handler = (req: Request, env: Env) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  '/v1/device': { POST: createDevice, GET: getDevice, DELETE: deleteDeviceRoute },
  '/v1/device/nickname': { PUT: renameDevice },
  '/v1/device/rotate': { POST: rotateCloudCode },
};

async function route(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight();
  const handlers = ROUTES[new URL(req.url).pathname];
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
