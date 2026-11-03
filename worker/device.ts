// Device routes: create, check, rename, rotate the Cloud Code, delete everything.
import type { CloudCodeResponse, DeviceResponse } from './api';
import { isBlocked } from './blocklist';
import { hashCloudCode, newCloudCode } from './cloud-code';
import type { Env } from './env';
import { HttpError, json, KB, noContent, readJson } from './http';
import { claimNewDevice, clientIp, limit, limitWrite } from './limits';
import { cleanNickname } from './nickname';
import { dayOf, nowSeconds } from './time';

const BODY_CAP = 2 * KB;

/** The verified Device behind `Authorization: Bearer <Cloud Code>`, or null without the header. Callers limit by IP first. */
export async function findDevice(req: Request, env: Env): Promise<number | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const hash = auth.startsWith('Bearer ') ? await hashCloudCode(auth.slice(7)) : null;
  if (!hash) throw new HttpError('unknown_device');
  const row = await env.BOARD.prepare('SELECT `id_device` FROM `device` WHERE `token_hash` = ?')
    .bind(hash)
    .first<{ id_device: number }>();
  if (!row) throw new HttpError('unknown_device');
  return row.id_device;
}

export async function requireDevice(req: Request, env: Env): Promise<number> {
  await limit(env.READ_LIMIT, clientIp(req));
  const id = await findDevice(req, env);
  if (id === null) throw new HttpError('unknown_device');
  return id;
}

async function readNickname(req: Request): Promise<string> {
  const body = await readJson(req, BODY_CAP);
  const nickname = cleanNickname((body as { nickname?: unknown } | null)?.nickname);
  if (!nickname || isBlocked(nickname)) throw new HttpError('name_blocked');
  return nickname;
}

export async function createDevice(req: Request, env: Env): Promise<Response> {
  const nickname = await readNickname(req);
  await limit(env.DEVICE_LIMIT, clientIp(req));
  await limit(env.GLOBAL_WRITE_LIMIT, 'global:write');
  const now = nowSeconds();
  await claimNewDevice(env, dayOf(now));
  const cloudCode = newCloudCode();
  await env.BOARD.prepare(
    'INSERT INTO `device` (`token_hash`, `nickname`, `created_at`, `last_seen_at`) VALUES (?, ?, ?, ?)',
  )
    .bind(await hashCloudCode(cloudCode), nickname, now, now)
    .run();
  return json({ cloudCode } satisfies CloudCodeResponse);
}

export async function getDevice(req: Request, env: Env): Promise<Response> {
  const id = await requireDevice(req, env);
  const [device, save] = await Promise.all([
    env.BOARD.prepare('SELECT `nickname` FROM `device` WHERE `id_device` = ?').bind(id).first<{ nickname: string }>(),
    env.SAVE.prepare('SELECT `save_at` FROM `device_save` WHERE `id_device` = ?').bind(id).first<{ save_at: number }>(),
  ]);
  if (!device) throw new HttpError('unknown_device');
  return json({ nickname: device.nickname, ...(save && { cloudSaveAt: save.save_at }) } satisfies DeviceResponse);
}

export async function renameDevice(req: Request, env: Env): Promise<Response> {
  const id = await requireDevice(req, env);
  const nickname = await readNickname(req);
  await limitWrite(env, 'nickname', id);
  await env.BOARD.prepare('UPDATE `device` SET `nickname` = ?, `last_seen_at` = ? WHERE `id_device` = ?')
    .bind(nickname, nowSeconds(), id)
    .run();
  return noContent();
}

/** The old Cloud Code stops working at once. */
export async function rotateCloudCode(req: Request, env: Env): Promise<Response> {
  const id = await requireDevice(req, env);
  await limitWrite(env, 'rotate', id);
  const cloudCode = newCloudCode();
  await env.BOARD.prepare('UPDATE `device` SET `token_hash` = ?, `last_seen_at` = ? WHERE `id_device` = ?')
    .bind(await hashCloudCode(cloudCode), nowSeconds(), id)
    .run();
  return json({ cloudCode } satisfies CloudCodeResponse);
}

/** Hard delete across all three databases; the `device` rows go last so a failed delete can be retried. */
export async function deleteDevices(env: Env, ids: number[]): Promise<void> {
  const list = JSON.stringify(ids);
  await Promise.all([
    env.REPLAY.prepare('DELETE FROM `replay` WHERE `id_device` IN (SELECT `value` FROM json_each(?))').bind(list).run(),
    env.SAVE.prepare('DELETE FROM `device_save` WHERE `id_device` IN (SELECT `value` FROM json_each(?))')
      .bind(list)
      .run(),
  ]);
  await env.BOARD.batch([
    env.BOARD.prepare('DELETE FROM `board_entry` WHERE `id_device` IN (SELECT `value` FROM json_each(?))').bind(list),
    env.BOARD.prepare('DELETE FROM `device` WHERE `id_device` IN (SELECT `value` FROM json_each(?))').bind(list),
  ]);
}

export async function deleteDeviceRoute(req: Request, env: Env): Promise<Response> {
  const id = await requireDevice(req, env);
  await limitWrite(env, 'delete', id);
  await deleteDevices(env, [id]);
  return noContent();
}
