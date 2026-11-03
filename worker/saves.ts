// PUT and GET /v1/save — one cloud save per Device, last write wins. The Worker only checks it decodes as a save.
import { parseSave } from '../src/sim/save';
import { SAVE_CAP, type SaveResponse } from './api';
import { requireDevice } from './device';
import type { Env } from './env';
import { HttpError, json, KB, noContent, readJson } from './http';
import { fromBase64, gunzip, toBase64 } from './gzip';
import { limitWrite } from './limits';
import { nowSeconds } from './time';

/** The base64 body of a capped save, plus the JSON around it. */
const BODY_CAP = Math.ceil(SAVE_CAP / 3) * 4 + KB;
const UNZIPPED_MAX = 256 * KB;

export async function putSave(req: Request, env: Env): Promise<Response> {
  const id = await requireDevice(req, env);
  const body = (await readJson(req, BODY_CAP)) as { saveCode?: unknown } | null;
  if (typeof body?.saveCode !== 'string') throw new HttpError('bad_request');
  const bytes = fromBase64(body.saveCode);
  if (!bytes || bytes.byteLength > SAVE_CAP) throw new HttpError('implausible');
  // before the unpack: a refused save still costs a write slot
  await limitWrite(env, 'save', id);
  const text = await gunzip(bytes, UNZIPPED_MAX);
  if (text === null) throw new HttpError('implausible');
  try {
    parseSave(text);
  } catch {
    throw new HttpError('implausible');
  }
  const now = nowSeconds();
  await env.SAVE.prepare(
    'INSERT INTO `device_save` (`id_device`, `save_code`, `save_at`) VALUES (?, ?, ?) ' +
      'ON CONFLICT (`id_device`) DO UPDATE SET `save_code` = excluded.`save_code`, `save_at` = excluded.`save_at`',
  )
    .bind(id, bytes, now)
    .run();
  await env.BOARD.prepare('UPDATE `device` SET `last_seen_at` = ? WHERE `id_device` = ?').bind(now, id).run();
  return noContent();
}

export async function getSave(req: Request, env: Env): Promise<Response> {
  const id = await requireDevice(req, env);
  const row = await env.SAVE.prepare('SELECT `save_code`, `save_at` FROM `device_save` WHERE `id_device` = ?')
    .bind(id)
    .first<{ save_code: ArrayBuffer; save_at: number }>();
  if (!row) throw new HttpError('not_found');
  return json({ saveCode: toBase64(new Uint8Array(row.save_code)), saveAt: row.save_at } satisfies SaveResponse);
}
