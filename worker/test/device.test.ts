import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { expect, test } from 'vitest';
import type { ApiError, CloudCodeResponse, DeviceResponse } from '../api';
import { isBlocked } from '../blocklist';
import { dayOf, nowSeconds } from '../time';

const BASE = 'https://api.test';
let ipSeq = 0;

/** Each call comes from a new IP unless one is given, so the per-IP Device limit only bites where tested. */
function call(
  method: string,
  path: string,
  opts: { code?: string; body?: unknown; raw?: string; ip?: string; origin?: string } = {},
) {
  const headers: Record<string, string> = { 'CF-Connecting-IP': opts.ip ?? `198.51.100.${++ipSeq}` };
  if (opts.code) headers.Authorization = `Bearer ${opts.code}`;
  if (opts.origin) headers.Origin = opts.origin;
  const body = opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return exports.default.fetch(new Request(`${BASE}${path}`, { method, headers, body }));
}

const count = async (db: D1Database, table: string): Promise<number | undefined> =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n;

test('a Device lives, renames, rotates its Cloud Code and is deleted everywhere', async () => {
  // Create: the Nickname is cleaned and a Cloud Code comes back once.
  let res = await call('POST', '/v1/device', { body: { nickname: '  Speedy   Cashier ' } });
  expect(res.status).toBe(200);
  const { cloudCode } = (await res.json()) as CloudCodeResponse;
  expect(cloudCode).toMatch(/^WBLY(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);

  // Only the hash is stored, never the code.
  const stored = await env.BOARD.prepare('SELECT * FROM `device`').all<Record<string, unknown>>();
  expect(stored.results).toHaveLength(1);
  expect(stored.results[0].nickname).toBe('Speedy Cashier');
  expect(JSON.stringify(stored.results)).not.toContain(cloudCode.slice(5, 9));

  // Check the code, in any case and without dashes.
  res = await call('GET', '/v1/device', { code: cloudCode.toLowerCase().replaceAll('-', '') });
  expect(await res.json()).toEqual({ nickname: 'Speedy Cashier' } satisfies DeviceResponse);

  // A wrong or malformed code is the same 401, with the fixed message.
  for (const code of ['WBLY-0000-0000-0000-0000', 'nonsense']) {
    res = await call('GET', '/v1/device', { code });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unknown_device', message: 'Unknown Cloud Code' } satisfies ApiError);
  }
  expect((await call('PUT', '/v1/device/nickname', { body: { nickname: 'Nobody' } })).status).toBe(401);

  // Rename (6 a minute per Device): rule breaks and blocked words are refused, a clean name sticks.
  for (const nickname of ['ab', 'x'.repeat(17), 'emoji 🙂', 'sh1t head', 42]) {
    res = await call('PUT', '/v1/device/nickname', { code: cloudCode, body: { nickname } });
    expect(res.status).toBe(422);
    expect(((await res.json()) as ApiError).error).toBe('name_blocked');
  }
  res = await call('PUT', '/v1/device/nickname', { code: cloudCode, body: { nickname: 'Spicy Chef' } });
  expect(res.status).toBe(204);
  expect(await (await call('GET', '/v1/device', { code: cloudCode })).json()).toEqual({ nickname: 'Spicy Chef' });

  // Bad bodies: broken JSON, and anything over the 2 KB cap, are refused before any query.
  res = await call('POST', '/v1/device', { raw: '{nickname:' });
  expect(((await res.json()) as ApiError).error).toBe('bad_request');
  res = await call('POST', '/v1/device', { raw: JSON.stringify({ nickname: 'a'.repeat(3000) }) });
  expect(res.status).toBe(400);

  // A cloud save shows up in the check.
  const id = (await env.BOARD.prepare('SELECT `id_device` FROM `device`').first<{ id_device: number }>())?.id_device;
  await env.SAVE.prepare('INSERT INTO `device_save` VALUES (?, ?, ?)')
    .bind(id, new Uint8Array([1, 2]), 1_700_000_000)
    .run();
  expect(await (await call('GET', '/v1/device', { code: cloudCode })).json()).toEqual({
    nickname: 'Spicy Chef',
    cloudSaveAt: 1_700_000_000,
  });

  // Rotate: the old code dies at once, the new one works.
  res = await call('POST', '/v1/device/rotate', { code: cloudCode });
  const rotated = ((await res.json()) as CloudCodeResponse).cloudCode;
  expect(rotated).not.toBe(cloudCode);
  expect((await call('GET', '/v1/device', { code: cloudCode })).status).toBe(401);
  expect((await call('GET', '/v1/device', { code: rotated })).status).toBe(200);

  // Delete: every row of the Device goes, in all three databases.
  await env.BOARD.prepare(
    "INSERT INTO `board_entry` (`kind`, `map`, `sim_version`, `id_device`, `score`, `updated_at`) VALUES ('score', 'corner-shop', 1, ?, 10, 0)",
  )
    .bind(id)
    .run();
  await env.REPLAY.prepare('INSERT INTO `replay` VALUES (1, ?, 100, ?)')
    .bind(id, new Uint8Array([1]))
    .run();
  expect((await call('DELETE', '/v1/device', { code: rotated })).status).toBe(204);
  expect([
    await count(env.BOARD, 'device'),
    await count(env.BOARD, 'board_entry'),
    await count(env.REPLAY, 'replay'),
    await count(env.SAVE, 'device_save'),
  ]).toEqual([0, 0, 0, 0]);
  expect((await call('GET', '/v1/device', { code: rotated })).status).toBe(401);
});

test('limits: per-IP Device creation, per-Device writes and the daily cap', async () => {
  const ip = '203.0.113.7';
  const created = [];
  for (let i = 0; i < 4; i++) created.push(await call('POST', '/v1/device', { ip, body: { nickname: 'Same Place' } }));
  expect(created.map((r) => r.status)).toEqual([200, 200, 200, 429]);
  expect(await created[3].json()).toEqual({ error: 'slow_down', message: 'Too many requests' } satisfies ApiError);

  const { cloudCode } = (await created[0].json()) as CloudCodeResponse;
  const renames = [];
  for (let i = 0; i < 7; i++) {
    renames.push(
      (await call('PUT', '/v1/device/nickname', { code: cloudCode, body: { nickname: `Name ${i}` } })).status,
    );
  }
  expect(renames).toEqual([204, 204, 204, 204, 204, 204, 429]);

  // The daily cap on new Devices holds whatever the rate limiter says.
  await env.BOARD.prepare('UPDATE `quota` SET `count` = 2000 WHERE `day` = ?').bind(dayOf(nowSeconds())).run();
  expect((await call('POST', '/v1/device', { body: { nickname: 'Too Late' } })).status).toBe(429);
});

test('CORS answers listed origins only, and unknown routes are 404', async () => {
  let res = await call('OPTIONS', '/v1/device', { origin: 'http://192.168.1.20:5173' });
  expect(res.status).toBe(204);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://192.168.1.20:5173');
  expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  expect(res.headers.get('Vary')).toBe('Origin');

  res = await call('OPTIONS', '/v1/device', { origin: 'https://evil.example' });
  expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();

  res = await call('GET', '/v1/nope', { origin: 'http://localhost:5173' });
  expect(res.status).toBe(404);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
});

test('the blocklist catches leetspeak and spacing but not innocent short words', () => {
  expect(['F u c k', 'Sh1tShow', 'b1tch', 'mod', 'Admin', 'Wobbly-Mart', 'Seif Fan'].map(isBlocked)).toEqual(
    Array(7).fill(true),
  );
  expect(['Spicy Chef', 'Peacock', 'Button Masher', 'Cucumber', 'Classy Bass', 'Modern'].map(isBlocked)).toEqual(
    Array(6).fill(false),
  );
});
