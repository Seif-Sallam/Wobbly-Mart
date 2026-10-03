// What survives an Opening, and the versioned save file around it. Pure data — storage lives in src/app.
import type { World } from './world';

export interface MapSave {
  money: number;
  owned: string[];
  paid: Record<string, number>;
  levels: Record<string, number>;
  assignments: Record<string, string | null>;
}

export interface Settings {
  music: boolean;
  sounds: boolean;
  manualGrab: boolean;
}

export const DEFAULT_SETTINGS: Settings = { music: true, sounds: true, manualGrab: false };

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  currentMap: string;
  visited: string[];
  tutorialDone: boolean;
  /** First unfinished tutorial step (-1 when done); purchase steps re-derive from the save on load. */
  tutorialStep: number;
  maps: Record<string, MapSave>;
}

export const emptySave = (firstMap: string): SaveFile => ({
  version: SAVE_VERSION,
  currentMap: firstMap,
  visited: [firstMap],
  tutorialDone: false,
  tutorialStep: 0,
  maps: {},
});

/** Money includes uncollected Cash Piles and unfinished drains. */
export function snapshot(w: World): MapSave {
  let money = w.money;
  for (const s of w.stations.values()) if (s.kind === 'register') money += s.cash;
  for (const d of w.drains) money += d.amount - d.given;
  return {
    money,
    owned: [...w.owned],
    paid: { ...w.paid },
    levels: { ...w.levels },
    assignments: Object.fromEntries(w.stockers.map((s) => [s.id, s.assignment])),
  };
}

/** One step per version bump: MIGRATIONS[n] turns a version-n save into version n+1. */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

/** Brings any older save up to date; throws with a clear message when it can't. */
export function migrate(raw: unknown): SaveFile {
  if (!raw || typeof raw !== 'object') throw new Error('Save is not an object');
  let save = raw as Record<string, unknown>;
  let version = Number(save.version);
  if (!Number.isInteger(version) || version < 1 || version > SAVE_VERSION)
    throw new Error(`Unknown save version ${String(save.version)}`);
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from save version ${version}`);
    save = step(save);
    version++;
  }
  const s = save as unknown as SaveFile;
  if (typeof s.currentMap !== 'string' || !Array.isArray(s.visited) || typeof s.maps !== 'object' || !s.maps)
    throw new Error('Save is missing currentMap, visited or maps');
  for (const [id, m] of Object.entries(s.maps)) {
    if (!Array.isArray(m.owned) || typeof m.money !== 'number') throw new Error(`Save for map ${id} is malformed`);
  }
  return { ...s, version: SAVE_VERSION, tutorialDone: !!s.tutorialDone, tutorialStep: Number(s.tutorialStep) || 0 };
}

export function encodeSaveCode(save: SaveFile): string {
  let bin = '';
  for (const b of new TextEncoder().encode(JSON.stringify(save))) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeSaveCode(code: string): SaveFile {
  const bin = atob(code.trim());
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return migrate(JSON.parse(new TextDecoder().decode(bytes)));
}
