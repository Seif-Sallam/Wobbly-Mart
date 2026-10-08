// Item transfers between a Carrier's Stack and Stations, with the pick-up / drop-off pacing.
import type { Carrier, ProducerStation, Ref, Station, World } from './world';
import { DT } from './world';
import { workMultiplier } from './economy';
import { TUNING } from './tuning';

export function accepts(w: World, st: Station, product: string): boolean {
  if (st.kind === 'shelf') return st.product === product && st.items < TUNING.shelfCap;
  if (st.kind === 'trash') return true;
  if (st.kind !== 'producer') return false;
  const type = w.map.producers[st.type];
  return type.inputs.includes(product) && (st.input[product] ?? 0) < (type.inputCap ?? 0);
}

/** Product a Station can hand over right now, or null. */
export function available(w: World, st: Station): string | null {
  if (st.kind !== 'producer') return null;
  return availableCount(st) > 0 ? w.map.producers[st.type].output : null;
}

export const availableCount = (st: ProducerStation): number =>
  st.plants.length ? st.plants.filter((p) => p <= 0).length : st.tray;

export function take(w: World, st: ProducerStation): void {
  if (!st.plants.length) {
    st.tray--;
    return;
  }
  const i = st.plants.findIndex((p) => p <= 0);
  st.plants[i] = w.map.producers[st.type].workTime * workMultiplier(w, st.type);
}

export function put(st: Station, product: string): void {
  if (st.kind === 'shelf') st.items++;
  else if (st.kind === 'producer') st.input[product] = (st.input[product] ?? 0) + 1;
}

export interface TransferRules {
  /** May drop this product here. */
  drop: (st: Station, product: string) => boolean;
  /** May pick up from here. */
  pick: (st: Station) => boolean;
  cap: number;
  /** Stop picking once the Stack holds this many. */
  pickLimit?: number;
}

/**
 * One tick of transfers between `c` and the Station it stands at. Drop-offs come first and speed up per Item;
 * pick-ups slow down as the Stack fills. Returns what moved, if anything.
 */
export function transferTick(
  w: World,
  c: Carrier,
  st: Station | null,
  who: Ref,
  rules: TransferRules,
): { dropped?: string; picked?: string } {
  if ((st?.id ?? null) !== c.at) {
    c.at = st?.id ?? null;
    c.dropInterval = TUNING.dropInterval;
    c.timer = Infinity;
    c.fullWarned = false;
  }
  if (!st) return {};
  c.timer += DT;
  for (let i = c.stack.length - 1; i >= 0; i--) {
    const product = c.stack[i];
    if (!rules.drop(st, product) || !accepts(w, st, product)) continue;
    if (c.timer < c.dropInterval) return {};
    c.stack.splice(i, 1);
    c.timer = 0;
    c.dropInterval = Math.max(TUNING.dropIntervalMin, c.dropInterval * TUNING.dropSpeedup);
    if (st.kind === 'trash') w.events.push({ type: 'trashed', product, from: who, station: st.id });
    else {
      put(st, product);
      w.events.push({ type: 'transfer', product, from: who, to: { station: st.id } });
    }
    return { dropped: product };
  }
  const product = rules.pick(st) ? available(w, st) : null;
  if (!product || st.kind !== 'producer' || c.stack.length >= (rules.pickLimit ?? rules.cap)) {
    if (product && c.stack.length >= rules.cap && !c.fullWarned) {
      c.fullWarned = true;
      if ('agent' in who && who.agent === 'player') w.events.push({ type: 'stackFull' });
    }
    return {};
  }
  const [slow, full] = TUNING.pickInterval;
  if (c.timer < slow + (full - slow) * (c.stack.length / rules.cap)) return {};
  take(w, st);
  c.stack.push(product);
  c.timer = 0;
  w.events.push({ type: 'transfer', product, from: { station: st.id }, to: who });
  return { picked: product };
}
