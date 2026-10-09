// What survives an Opening, and the versioned save file around it. Pure data — storage lives in src/app.
import type { Placement } from './map';
import type { StockerRole, World } from './world';

export interface MapSave {
  money: number;
  owned: string[];
  paid: Record<string, number>;
  levels: Record<string, number>;
  roles: Record<string, StockerRole>;
  /** Edit Layout: places moved away from the map's, and Moves bought. */
  layout?: Record<string, Placement>;
  movesUsed?: number;
}

/** Lowest frame cap offered, and the one Battery saver uses (fps). */
const MIN_FRAME_CAP = 30;
export const SAVER_FRAME_CAP = 45;

/** Evenly paced frame rates on a screen ticking at `hz`: a frame every 1st, 2nd, 3rd… tick, down to 30 fps. */
export function frameSteps(hz: number): number[] {
  const steps: number[] = [];
  for (let n = 1; hz / n >= MIN_FRAME_CAP - 0.5; n++) steps.push(Math.round(hz / n));
  return steps;
}

/** Screen ticks per drawn frame for a cap: the nearest evenly paced rate. */
export const ticksPerFrame = (hz: number, cap: Settings['frameCap']): number =>
  cap === 'screen' ? 1 : Math.max(1, Math.round(hz / cap));

export const validFrameCap = (cap: unknown): cap is Settings['frameCap'] =>
  cap === 'screen' || (typeof cap === 'number' && cap >= MIN_FRAME_CAP);

export interface Settings {
  music: boolean;
  sounds: boolean;
  manualGrab: boolean;
  /** Metres across the screen's short side; null = the device default. */
  zoom: number | null;
  /** Frame cap: the screen's own rate, or a lower fps (drawn at the nearest evenly paced rate, see frameSteps). */
  frameCap: 'screen' | number;
  /** Forces the 45 fps cap, pixel ratio 1 and hard shadows. */
  batterySaver: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  music: true,
  sounds: true,
  manualGrab: false,
  zoom: null,
  frameCap: 'screen',
  batterySaver: false,
};

export const SAVE_VERSION = 3;

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
    roles: Object.fromEntries(w.stockers.map((s) => [s.id, s.role])),
    layout: { ...w.placed },
    movesUsed: w.movesUsed,
  };
}

/** One step per version bump: MIGRATIONS[n] turns a version-n save into version n+1. */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // playtest pass 1: only the owner had a save, so it starts fresh instead of migrating
  1: (old) => ({ ...emptySave(String(old.currentMap)) }),
  // Edit Layout: maps gain an optional layout and Moves used; older ones load with the map's layout
  2: (old) => old,
};

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
