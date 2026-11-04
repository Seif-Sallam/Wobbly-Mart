import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { expect, test } from 'vitest';
import { emptySave } from '../../src/sim/save';
import { SAVE_CAP, type ApiError, type CloudCodeResponse, type DeviceResponse, type SaveResponse } from '../api';
import { gzipBase64 } from '../gzip';

let ip = 0;
function call(method: string, path: string, opts: { code?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'CF-Connecting-IP': `203.0.113.${++ip}` };
  if (opts.code) headers.Authorization = `Bearer ${opts.code}`;
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return exports.default.fetch(new Request(`https://api.test${path}`, { method, headers, body }));
}

const put = async (code: string | undefined, saveCode: unknown) => {
  const res = await call('PUT', '/v1/save', { code, body: { saveCode } });
  return res.status === 204 ? 204 : ((await res.json()) as ApiError).error;
};

test('Cloud save: one save per Device, last write wins, only real saves under the cap', async () => {
  const res = await call('POST', '/v1/device', { body: { nickname: 'Save Keeper' } });
  const code = ((await res.json()) as CloudCodeResponse).cloudCode;
  const first = emptySave('corner-shop');
  const later = { ...first, currentMap: 'juice-bar', visited: ['corner-shop', 'juice-bar'] };

  // nothing yet: no cloudSaveAt, GET is a 404; no Device, no save
  expect(await (await call('GET', '/v1/device', { code })).json()).toEqual({ nickname: 'Save Keeper' });
  expect((await call('GET', '/v1/save', { code })).status).toBe(404);
  expect(await put(undefined, await gzipBase64(JSON.stringify(first)))).toBe('unknown_device');

  // a save goes up, a newer one replaces it, and it comes back as sent
  expect(await put(code, await gzipBase64(JSON.stringify(first)))).toBe(204);
  const sent = await gzipBase64(JSON.stringify(later));
  expect(await put(code, sent)).toBe(204);
  const got = (await (await call('GET', '/v1/save', { code })).json()) as SaveResponse;
  expect(got.saveCode).toBe(sent);
  const device = (await (await call('GET', '/v1/device', { code })).json()) as DeviceResponse;
  expect(device.cloudSaveAt).toBe(got.saveAt);

  // refused: no saveCode, not base64, not gzip, not a save, a gzip bomb, over the cap; the stored save stays
  expect(await put(code, 42)).toBe('bad_request');
  expect(await put(code, '%%%')).toBe('implausible');
  expect(await put(code, btoa('plain text'))).toBe('implausible');
  expect(await put(code, await gzipBase64('{"version": 99}'))).toBe('implausible');
  const bomb = await gzipBase64(JSON.stringify({ ...later, pad: ' '.repeat(300 * 1024) }));
  expect(await put(code, bomb)).toBe('implausible');
  const noise = Array.from({ length: SAVE_CAP + 1 }, (_, i) => String.fromCharCode((i * 7919) % 256)).join('');
  expect(await put(code, btoa(noise))).toBe('implausible');
  // 6 writes a minute per Device: two saves and three refused unpacks so far
  expect(await put(code, sent)).toBe(204);
  expect(await put(code, sent)).toBe('slow_down');
  expect(((await (await call('GET', '/v1/save', { code })).json()) as SaveResponse).saveCode).toBe(sent);

  // Delete takes the save with it
  expect((await call('DELETE', '/v1/device', { code })).status).toBe(204);
  const left = await env.SAVE.prepare('SELECT COUNT(*) AS n FROM `device_save`').first<{ n: number }>();
  expect(left?.n).toBe(0);
});
