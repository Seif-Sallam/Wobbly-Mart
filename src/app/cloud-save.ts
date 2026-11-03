// Cloud save (spec §10): the save goes up gzipped as an Opening ends, at most every 5 min; last write wins. Entering a
// Cloud Code fetches it back for the restore choice.
import { fromBase64, gunzip, gzipBase64 } from '../../worker/gzip';
import { SAVE_UNZIPPED_MAX } from '../../worker/api';
import { isTutorialMap, mapById } from '../../maps';
import { savedCompletion } from '../sim/economy';
import { parseSave, type SaveFile } from '../sim/save';
import type { SaveSummary } from '../ui/online';
import { api } from './api';
import { read, write } from './storage';

const UPLOADED = 'wobbly-mart.cloud-save-at';
const EVERY_MS = 5 * 60_000;
/** An Opening end twice in a row (hidden, then the title) sends once. */
let uploading = false;

/** At most every 5 min unless `now` (the restore choice kept this browser's save). A failed upload isn't retried: the
 *  next Opening end sends the newer save anyway. */
export async function uploadSave(code: string, save: SaveFile, now = false): Promise<void> {
  if (uploading || (!now && Date.now() - (Number(read(UPLOADED)) || 0) < EVERY_MS)) return;
  uploading = true;
  // no CompressionStream (an old browser): no cloud save
  const saveCode = await gzipBase64(JSON.stringify(save)).catch(() => null);
  const r = saveCode && (await api.putSave(code, saveCode));
  if (r && r.ok) write(UPLOADED, String(Date.now()));
  uploading = false;
}

/** The Device's cloud save, or null when there is none or it can't be fetched or read. */
export async function fetchCloudSave(code: string): Promise<{ save: SaveFile; at: number } | null> {
  const r = await api.getSave(code);
  if (!r.ok) return null;
  const bytes = fromBase64(r.data.saveCode);
  const text = bytes && (await gunzip(bytes, SAVE_UNZIPPED_MAX));
  try {
    return text === null ? null : { save: parseSave(text), at: r.data.saveAt };
  } catch {
    return null;
  }
}

/** Anything worth asking about before it's replaced: a Map with something bought, or the Tutorial done. */
export const hasProgress = (save: SaveFile): boolean =>
  save.tutorialDone || Object.values(save.maps).some((m) => m.owned.length > 0);

/** What the restore choice shows of a save: each Map it reached with its Completion. */
export function summary(save: SaveFile, when: string): SaveSummary {
  const maps = Object.entries(save.maps).flatMap(([id, m]) => {
    const map = mapById(id);
    if (!map || isTutorialMap(map)) return [];
    return [{ name: map.name, completion: Math.floor(savedCompletion(map, m) * 100) }];
  });
  return { when, maps };
}
