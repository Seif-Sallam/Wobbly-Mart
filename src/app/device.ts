// This browser's Device: its Cloud Code, Nickname and privacy Accept in localStorage, and the calls that change them.
import { PRIVACY_VERSION } from '../privacy';
import { api, type ApiResult } from './api';
import { forget, read, write } from './storage';

const CODE = 'wobbly-mart.device';
const NICKNAME = 'wobbly-mart.nickname';
const PRIVACY = 'wobbly-mart.privacy';

/** Player-facing text for a failed call. */
function failure(r: ApiResult<unknown>): string {
  if (r.ok) return '';
  switch (r.error) {
    case 'name_blocked':
      return "That name isn't allowed, try another";
    case 'unknown_device':
      return "That Cloud Code doesn't match any Device";
    case 'update':
      return 'A new version is out · Reload';
    default:
      return '📡 out of reach · Try again';
  }
}

export class Device {
  code = read(CODE);
  nickname = read(NICKNAME);
  /** From the last Cloud Code entered here: when its cloud save was made (Unix seconds), null without one. */
  cloudSaveAt: number | null = null;

  /** Also kept in memory, so Accept holds for this visit where storage is blocked. */
  accepted = Number(read(PRIVACY)) === PRIVACY_VERSION;

  accept(): void {
    this.accepted = true;
    write(PRIVACY, String(PRIVACY_VERSION));
  }

  private keep(code: string | null, nickname: string | null): void {
    this.code = code;
    this.nickname = nickname;
    if (code && nickname) {
      write(CODE, code);
      write(NICKNAME, nickname);
    } else {
      forget(CODE);
      forget(NICKNAME);
    }
  }

  /** Each returns null on success, or the text to show inline. */
  async create(nickname: string): Promise<string | null> {
    const r = await api.createDevice(nickname);
    if (r.ok) this.keep(r.data.cloudCode, nickname);
    return failure(r) || null;
  }

  async useCode(code: string): Promise<string | null> {
    const r = await api.checkDevice(code);
    if (r.ok) {
      this.keep(code, r.data.nickname);
      this.cloudSaveAt = r.data.cloudSaveAt ?? null;
    }
    return failure(r) || null;
  }

  async rename(nickname: string): Promise<string | null> {
    if (!this.code) return null;
    const r = await api.rename(this.code, nickname);
    if (r.ok) this.keep(this.code, nickname);
    return failure(r) || null;
  }

  async rotate(): Promise<string | null> {
    if (!this.code) return null;
    const r = await api.rotate(this.code);
    if (r.ok) this.keep(r.data.cloudCode, this.nickname);
    return failure(r) || null;
  }

  /** Forgets the Cloud Code on this browser only: the Device stays on the server. */
  forget(): void {
    this.keep(null, null);
  }

  /** Offline, nothing is wiped: the Device still exists on the server. */
  async remove(): Promise<string | null> {
    if (!this.code) return null;
    const r = await api.deleteDevice(this.code);
    const gone = r.ok || r.error === 'unknown_device';
    // another tab may have rotated the code meanwhile: keep the one it stored
    if (gone && (r.ok || read(CODE) === this.code)) this.keep(null, null);
    return gone ? null : failure(r);
  }
}
