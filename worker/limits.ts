// Rate limits (per Cloudflare location, best effort) and the hard daily cap on new Devices.
import type { Env } from './env';
import { HttpError } from './http';

const NEW_DEVICES_PER_DAY = 2000;

export async function limit(binding: RateLimit, key: string): Promise<void> {
  const { success } = await binding.limit({ key });
  if (!success) throw new HttpError('slow_down');
}

export const clientIp = (req: Request): string => req.headers.get('CF-Connecting-IP') ?? 'unknown';

/** Every write: per Device and route, and the global write budget that keeps D1 under its daily row writes. */
export async function limitWrite(env: Env, route: string, idDevice: number): Promise<void> {
  await limit(env.WRITE_LIMIT, `${route}:${idDevice}`);
  await limit(env.GLOBAL_WRITE_LIMIT, 'global:write');
}

/** Counts one new Device against today's cap; 429 once the cap is reached. */
export async function claimNewDevice(env: Env, day: number): Promise<void> {
  const row = await env.BOARD.prepare(
    'INSERT INTO `quota` (`day`, `count`) VALUES (?, 1) ' +
      'ON CONFLICT (`day`) DO UPDATE SET `count` = `count` + 1 WHERE `count` < ? RETURNING `count`',
  )
    .bind(day, NEW_DEVICES_PER_DAY)
    .first();
  if (!row) throw new HttpError('slow_down');
}
