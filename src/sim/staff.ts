// Stockers (and the bot) pick carrying jobs by tier; demand runs from the Shelves back down the Producer chain.
import type { Job, PickupStation, ProducerStation, ShelfStation, Station, Stocker, StockerRole, World } from './world';
import { accepts, availableCount, tipDrops, transferTick, trayRoom } from './carry';
import { stockerCarry, stockerSpeed } from './economy';
import { walkAgent, walkDistance } from './walk';
import { messSlowdown } from './cleaning';
import { DT } from './world';
import { TUNING } from './tuning';

/** Which sinks a role fills: Goods Shelves and car orders, Machines Animal and Machine inputs, Auto all. */
function inRole(st: Station, role: StockerRole): boolean {
  if (role === 'goods') return st.kind === 'shelf' || st.kind === 'pickup';
  if (role === 'machines') return st.kind === 'producer';
  return true;
}

/** Job tiers, lower first; distance only breaks ties within one. */
const TIER = { urgentShelf: 0, bottleneck: 1, lowShelf: 2, input: 3 };

/** Final demand at a Shelf, lower first: 0 Customers waiting at it empty, 1 heading to it, 2–3 by fill. */
function shelfDemand(w: World, st: ShelfStation): number {
  if (st.items >= TUNING.shelfCap) return Infinity;
  const heading = w.customers.some((c) => c.state === 'shop' && c.list[c.li]?.shelf === st.id);
  if (heading) return st.items === 0 ? 0 : 1;
  return 2 + st.items / TUNING.shelfCap;
}

/** A car order's share still missing, 0–1: ranks with low Shelves by fill. */
function orderGap(st: PickupStation): number {
  const order = st.delivery?.order ?? [];
  return (
    order.reduce((sum, l) => sum + l.want - l.got, 0) /
    Math.max(
      1,
      order.reduce((sum, l) => sum + l.want, 0),
    )
  );
}

/** A Producer wants this input now: room on its Tray and in that input, and it is the bottleneck (fewest held). */
function wantsInput(w: World, st: ProducerStation, product: string): boolean {
  const type = w.map.producers[st.type];
  if (!type.inputs.includes(product) || st.tray >= (type.trayCap ?? 0)) return false;
  const have = st.input[product] ?? 0;
  return have < (type.inputCap ?? 0) && type.inputs.every((p) => (st.input[p] ?? 0) >= have);
}

/** A Product's final demand: its own Shelves, or inherited from what the Producers it feeds make, at any depth. */
function demand(w: World, product: string, seen: string[] = []): number {
  if (seen.includes(product)) return Infinity;
  let best = Infinity;
  for (const st of w.stations.values()) {
    if (st.kind === 'shelf' && st.product === product) best = Math.min(best, shelfDemand(w, st));
    if (st.kind === 'pickup' && accepts(w, st, product)) best = Math.min(best, 3 - orderGap(st));
    if (st.kind === 'producer' && wantsInput(w, st, product))
      best = Math.min(best, demand(w, w.map.producers[st.type].output, [...seen, product]));
  }
  return best;
}

/** Lower is more urgent; Infinity means nobody downstream needs it from this sink. */
function urgency(w: World, st: Station, product: string): number {
  const gap = TUNING.urgency.tierGap;
  if (st.kind === 'shelf') {
    return shelfDemand(w, st) === 0 ? TIER.urgentShelf * gap : TIER.lowShelf * gap + st.items / TUNING.shelfCap;
  }
  if (st.kind === 'pickup') return TIER.lowShelf * gap + 1 - orderGap(st);
  if (st.kind !== 'producer' || !wantsInput(w, st, product)) return Infinity;
  const type = w.map.producers[st.type];
  const d = demand(w, type.output);
  if (d === Infinity) return Infinity;
  return d === 0 ? TIER.bottleneck * gap + (st.input[product] ?? 0) / (type.inputCap ?? 1) : TIER.input * gap + d / 3; // d < 3
}

function freeSpace(w: World, st: Station, product: string): number {
  if (st.kind === 'shelf') return TUNING.shelfCap - st.items;
  if (st.kind === 'producer') return (w.map.producers[st.type].inputCap ?? 0) - (st.input[product] ?? 0);
  if (st.kind === 'pickup')
    return (st.delivery?.order ?? []).reduce((n, l) => n + (l.product === product ? l.want - l.got : 0), 0);
  return 0;
}

/** Sinks that need this product, most urgent first. */
function sinksFor(
  w: World,
  product: string,
  role: StockerRole,
  taken: Set<string>,
): { st: Station; urgency: number }[] {
  return [...w.stations.values()]
    .filter((st) => !taken.has(st.id) && inRole(st, role) && st.kind !== 'trash' && accepts(w, st, product))
    .map((st) => ({ st, urgency: urgency(w, st, product) }))
    .filter((s) => s.urgency < Infinity)
    .sort((a, b) => a.urgency - b.urgency);
}

/** Best job for a carrier at (x, z) with `cap` free Stack room, skipping Stations other carriers already serve. */
export function chooseJob(
  w: World,
  pos: { x: number; z: number },
  role: StockerRole,
  cap: number,
  taken: Set<string>,
): Job | null {
  let best: { job: Job; score: number } | null = null;
  const sources = [...w.stations.values()].filter(
    (s): s is ProducerStation => s.kind === 'producer' && availableCount(s) > 0,
  );
  for (const src of sources) {
    const product = w.map.producers[src.type].output;
    const sinks = sinksFor(w, product, role, taken);
    if (!sinks.length) continue;
    const score =
      sinks[0].urgency + walkDistance(w, 'walker', pos, { station: src.id }) * TUNING.urgency.distanceWeight;
    if (best && score >= best.score) continue;
    const demand = sinks.reduce((sum, s) => sum + freeSpace(w, s.st, product), 0);
    best = { job: { sink: sinks[0].st.id, source: src.id, product, need: Math.min(cap, demand) }, score };
  }
  return best?.job ?? null;
}

/** The most urgent Station that needs one of the carried products, or null if they are all leftovers. */
export function sinkForStack(w: World, stack: string[], role: StockerRole, taken: Set<string>): Job | null {
  let best: { job: Job; urgency: number } | null = null;
  for (const product of new Set(stack)) {
    const [sink] = sinksFor(w, product, role, taken);
    if (sink && (!best || sink.urgency < best.urgency))
      best = { job: { sink: sink.st.id, source: null, product, need: 0 }, urgency: sink.urgency };
  }
  return best?.job ?? null;
}

/** Leftovers held too long: back onto the nearest Tray of that Product with room, else the nearest Trash Bin. */
function putBack(w: World, s: Stocker): Job | null {
  const near = (sts: Station[]) =>
    sts.sort(
      (a, b) => walkDistance(w, 'walker', s, { station: a.id }) - walkDistance(w, 'walker', s, { station: b.id }),
    )[0];
  const stations = [...w.stations.values()];
  const tray = near(stations.filter((st) => s.stack.some((p) => trayRoom(w, st, p))));
  if (tray?.kind === 'producer')
    return { sink: tray.id, source: null, product: w.map.producers[tray.type].output, need: 0, tray: true };
  const bin = near(stations.filter((st) => st.kind === 'trash'));
  return bin ? { sink: bin.id, source: null, product: s.stack[0], need: 0 } : null;
}

/** Deliver what is needed; else ride leftovers along on another job; after a while put them back. */
function nextJob(w: World, s: Stocker, cap: number, taken: Set<string>): Job | null {
  if (!s.stack.length) return chooseJob(w, s, s.role, cap, taken);
  const deliver = sinkForStack(w, s.stack, s.role, taken);
  if (deliver) {
    s.leftover = null;
    return deliver;
  }
  s.leftover ??= 0;
  if (s.leftover >= TUNING.leftoverTime) return putBack(w, s);
  const ride = s.stack.length < cap ? chooseJob(w, s, s.role, cap - s.stack.length, taken) : null;
  if (ride) ride.need += s.stack.length;
  return ride;
}

function updateStocker(w: World, s: Stocker): void {
  const taken = new Set(w.stockers.filter((o) => o !== s && o.job).map((o) => o.job?.sink ?? ''));
  const cap = stockerCarry(w);
  const who = { agent: 'stocker', id: s.id } as const;
  s.rethink -= DT;
  if (!s.stack.length) s.leftover = null;
  if (s.leftover !== null) s.leftover += DT;
  if (!s.job && s.rethink <= 0) {
    s.job = nextJob(w, s, cap, taken);
    s.rethink = TUNING.stockerRethink;
  }
  const job = s.job;
  if (!job) {
    s.vx = s.vz = 0;
    transferTick(w, s, null, who, { drop: () => false, pick: () => false, cap });
    return;
  }
  if (job.source && s.stack.length >= job.need) job.source = null;
  const fetching = job.source !== null;
  const target = fetching ? (job.source as string) : job.sink;
  const st = w.stations.get(target);
  if (!st) {
    s.job = null;
    return;
  }
  if (!walkAgent(w, 'walker', s, { station: target }, stockerSpeed(w) * messSlowdown(w, s))) {
    // walking tips a Stocker's Stack just as it does the Player's (they never sprint or jolt)
    tipDrops(w, s, who, { cap, safe: TUNING.base.safe, share: TUNING.tip.walkShare, jolt: 0 });
    transferTick(w, s, null, who, { drop: () => false, pick: () => false, cap });
    return;
  }
  // anything the Station takes drops off, even mid-fetch; the Trash only on a put-back job
  const moved = transferTick(w, s, st, who, {
    drop: (at) => (at.kind === 'trash' ? at.id === job.sink : inRole(at, s.role) || !!job.tray),
    pick: () => fetching,
    cap,
    pickLimit: job.need,
    toTray: job.tray,
  });
  if (moved.picked) s.leftover = null;
  if (moved.dropped || moved.picked || moved.waiting) return;
  if (fetching) {
    if (st.kind !== 'producer' || availableCount(st) > 0) return; // still filling
    if (s.stack.length) job.source = null;
    else s.job = null;
    return;
  }
  s.job = null;
  s.rethink = 0;
}

export function updateStaff(w: World): void {
  for (const s of w.stockers) updateStocker(w, s);
}
