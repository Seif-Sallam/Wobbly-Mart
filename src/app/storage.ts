// localStorage under `wobbly-mart.*`; every access guarded. Saving may fail — the game still plays.
import { DEFAULT_SETTINGS, emptySave, validFrameCap, migrate, type SaveFile, type Settings } from '../sim/save';

const KEY = 'wobbly-mart.save';
const BACKUP = 'wobbly-mart.save-backup';
const SETTINGS = 'wobbly-mart.settings';
const TAB = 'wobbly-mart.tab';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Whether saving works at all here (private mode, blocked storage…). */
export const storageWorks = (): boolean => write('wobbly-mart.probe', '1');

export interface Loaded {
  save: SaveFile;
  /** Set when an old save couldn't be read: it was kept under a backup key. */
  problem?: string;
}

export function loadSave(firstMap: string): Loaded {
  const raw = read(KEY);
  if (!raw) return { save: emptySave(firstMap) };
  try {
    return { save: migrate(JSON.parse(raw)) };
  } catch (e) {
    write(BACKUP, raw);
    return { save: emptySave(firstMap), problem: (e as Error).message };
  }
}

export const writeSave = (save: SaveFile): boolean => write(KEY, JSON.stringify(save));

export function wipeSave(firstMap: string): SaveFile {
  const fresh = emptySave(firstMap);
  writeSave(fresh);
  return fresh;
}

export function loadSettings(): Settings {
  try {
    const s: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(read(SETTINGS) ?? '{}') };
    return validFrameCap(s.frameCap) ? s : { ...s, frameCap: DEFAULT_SETTINGS.frameCap };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const writeSettings = (s: Settings): boolean => write(SETTINGS, JSON.stringify(s));

/** Ask the browser not to evict the save (once the player has bought something). */
export function persistStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // not supported
  }
}

/** The newest tab owns the save; older ones are told to pause. */
export function claimTab(onLost: () => void): () => void {
  const id = `${performance.timeOrigin}-${Math.random()}`;
  const claim = () => write(TAB, id);
  claim();
  const listener = (e: StorageEvent) => {
    if (e.key === TAB && e.newValue && e.newValue !== id) onLost();
  };
  addEventListener('storage', listener);
  return claim;
}

/** One-time flags (e.g. the iPhone Add-to-Home-Screen card). */
export const seen = (flag: string): boolean => read(`wobbly-mart.seen.${flag}`) === '1';
export const markSeen = (flag: string): boolean => write(`wobbly-mart.seen.${flag}`, '1');
