// Item transfers between a Carrier's Stack and Stations, with the pick-up / drop-off pacing, and Stack tipping.
import type { Carrier, Mover, ProducerStation, Ref, Station, World } from './world';
import { DT } from './world';
import { workMultiplier } from './economy';
import { TUNING } from './tuning';
import { orderLine } from './events';
import { addMess } from './cleaning';
import { walkable } from './walk';
import { nextRandom } from './rng';

export function accepts(w: World, st: Station, product: string): boolean {
  if (st.kind === 'shelf') return st.product === product && st.items < TUNING.shelfCap;
  if (st.kind === 'trash') return true;
  if (st.kind === 'pickup') return !!orderLine(st, product);
  if (st.kind !== 'producer') return false;
  const type = w.map.producers[st.type];
  return type.inputs.includes(product) && (st.input[product] ?? 0) < (type.inputCap ?? 0);
}

/** A Producer's Tray has room for its own output, counting the batch in the works (a Stocker putting leftovers back). */
export function trayRoom(w: World, st: Station, product: string): boolean {
  if (st.kind !== 'producer') return false;
  const type = w.map.producers[st.type];
  return type.output === product && st.tray + (st.work > 0 ? 1 : 0) < (type.trayCap ?? 0);
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
  else if (st.kind === 'pickup') {
    const line = orderLine(st, product);
    if (line) line.got++;
  } else if (st.kind === 'producer') st.input[product] = (st.input[product] ?? 0) + 1;
}

export interface TransferRules {
  /** May drop this product here. */
  drop: (st: Station, product: string) => boolean;
  /** May pick up from here. */
  pick: (st: Station) => boolean;
  cap: number;
  /** Stop picking once the Stack holds this many. */
  pickLimit?: number;
  /** Drop onto the Producer's Tray instead of into its inputs. */
  toTray?: boolean;
}

/**
 * One tick of transfers between `c` and the Station it stands at. Drop-offs come first and speed up per Item;
 * pick-ups slow down as the Stack fills. Returns what moved, or `waiting` while a drop-off is due.
 */
export function transferTick(
  w: World,
  c: Carrier,
  st: Station | null,
  who: Ref,
  rules: TransferRules,
): { dropped?: string; picked?: string; waiting?: boolean } {
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
    const fits = rules.toTray ? trayRoom(w, st, product) : accepts(w, st, product);
    if (!rules.drop(st, product) || !fits) continue;
    if (c.timer < c.dropInterval) return { waiting: true };
    c.stack.splice(i, 1);
    c.timer = 0;
    c.dropInterval = Math.max(TUNING.dropIntervalMin, c.dropInterval * TUNING.dropSpeedup);
    if (st.kind === 'trash') w.events.push({ type: 'trashed', product, from: who, station: st.id });
    else {
      if (rules.toTray && st.kind === 'producer') st.tray++;
      else put(st, product);
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

/**
 * Tipping (Player and Stockers): above the safe count a moving Stack now and then drops its top Item behind the
 * carrier, as a Mess when it breaks, else a Loose Item. `share`: 1 sprinting, walkShare walking, 0 standing.
 */
export function tipDrops(
  w: World,
  c: Carrier & Mover,
  who: Ref,
  o: { cap: number; safe: number; share: number; jolt: number },
): void {
  const T = TUNING.tip;
  c.dropCooldown = Math.max(0, c.dropCooldown - DT);
  const n = c.stack.length;
  if (o.share === 0 || n <= o.safe || c.dropCooldown > 0) return;
  const k = (n - o.safe) / Math.max(1, o.cap - o.safe);
  const jolt = 1 + T.joltBoost * Math.min(1, o.jolt);
  if (nextRandom(w) >= T.maxRate * o.share * jolt * k ** T.curve * DT) return;
  const dir = Math.hypot(c.vx, c.vz) || 1;
  const side = (nextRandom(w) - 0.5) * T.dropSide;
  // lands where someone can stand, so its Mess can be mopped
  const [x, z] = walkable(
    w,
    c.x - (c.vx / dir) * T.dropBehind - (c.vz / dir) * side,
    c.z - (c.vz / dir) * T.dropBehind + (c.vx / dir) * side,
  );
  const product = c.stack[n - 1];
  c.stack.pop();
  c.dropCooldown = T.cooldown;
  const id = w.nextId++;
  const breakChance = w.map.products[product]?.breakChance ?? 0;
  if (breakChance > 0 && nextRandom(w) < breakChance) {
    addMess(w, id, x, z, [product], -1);
    return;
  }
  w.events.push({ type: 'transfer', product, from: who, to: { loose: id } });
  w.loose.push({ id, x, z, product });
}
