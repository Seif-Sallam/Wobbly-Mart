// Stockers (and the bot) pick carrying jobs: most urgent Shelf or Producer input that something can fill right now.
import type { Job, ProducerStation, Station, Stocker, StockerRole, World } from './world';
import { accepts, availableCount, transferTick } from './carry';
import { stockerCarry, stockerSpeed } from './economy';
import { walkAgent, walkDistance } from './walk';
import { DT } from './world';
import { TUNING } from './tuning';

/** Which sinks a role fills: Goods only Shelves, Machines only Animal and Machine inputs, Auto both. */
function inRole(st: Station, role: StockerRole): boolean {
  if (role === 'goods') return st.kind === 'shelf';
  if (role === 'machines') return st.kind === 'producer';
  return true;
}

/** Whether a Station ever takes this product, full or not. */
function takes(w: World, st: Station, product: string): boolean {
  if (st.kind === 'shelf') return st.product === product;
  return st.kind === 'producer' && w.map.producers[st.type].inputs.includes(product);
}

function shelfUrgency(w: World, st: Station): number {
  if (st.kind !== 'shelf') return Infinity;
  const waiting = w.customers.some((c) => c.state === 'shop' && c.list[c.li]?.shelf === st.id);
  return st.items === 0 && waiting ? 0 : 1 + st.items / TUNING.shelfCap;
}

/** Lower is more urgent: empty Shelf with waiting Customers → lowest Shelf → empty Producer input. */
function urgency(w: World, st: Station, product: string): number {
  if (st.kind === 'shelf') return shelfUrgency(w, st);
  if (st.kind !== 'producer') return Infinity;
  const U = TUNING.urgency;
  const type = w.map.producers[st.type];
  if (st.tray >= (type.trayCap ?? 0)) return U.trayFull;
  const have = st.input[product] ?? 0;
  // a Producer whose own Shelf has Customers waiting at it empty is as urgent as that Shelf
  for (const s of w.stations.values())
    if (s.kind === 'shelf' && s.product === type.output && shelfUrgency(w, s) === 0) return U.feedsUrgentShelf;
  return have === 0 ? U.inputEmpty : U.inputPartial + have / (type.inputCap ?? 1);
}

function freeSpace(w: World, st: Station, product: string): number {
  if (st.kind === 'shelf') return TUNING.shelfCap - st.items;
  if (st.kind === 'producer') return (w.map.producers[st.type].inputCap ?? 0) - (st.input[product] ?? 0);
  return 0;
}

function sinksFor(w: World, product: string, role: StockerRole, taken: Set<string>): Station[] {
  return [...w.stations.values()]
    .filter((st) => !taken.has(st.id) && inRole(st, role) && st.kind !== 'trash' && accepts(w, st, product))
    .sort((a, b) => urgency(w, a, product) - urgency(w, b, product));
}

/** Best job for an empty-handed carrier at (x, z), skipping Stations other carriers already serve. */
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
    const sink = sinksFor(w, product, role, taken)[0];
    if (!sink) continue;
    const score =
      urgency(w, sink, product) + walkDistance(w, 'walker', pos, { station: src.id }) * TUNING.urgency.distanceWeight;
    if (best && score >= best.score) continue;
    const demand = sinksFor(w, product, role, taken).reduce((sum, st) => sum + freeSpace(w, st, product), 0);
    best = { job: { sink: sink.id, source: src.id, product, need: Math.min(cap, demand) }, score };
  }
  return best?.job ?? null;
}

/** A Station that takes one of the carried products, for a carrier whose job's sink filled up. */
export function sinkForStack(w: World, stack: string[], role: StockerRole, taken: Set<string>): Job | null {
  for (const product of new Set(stack)) {
    const sink = sinksFor(w, product, role, taken)[0];
    if (sink) return { sink: sink.id, source: null, product, need: 0 };
  }
  return null;
}

function updateStocker(w: World, s: Stocker): void {
  const taken = new Set(w.stockers.filter((o) => o !== s && o.job).map((o) => o.job?.sink ?? ''));
  const cap = stockerCarry(w);
  s.rethink -= DT;
  if (!s.job && s.rethink <= 0) {
    // leftovers nothing in the role could ever take (after a role change) may go anywhere, or it stays stuck
    const stranded = s.stack.filter(
      (p) => ![...w.stations.values()].some((st) => inRole(st, s.role) && takes(w, st, p)),
    );
    s.job = s.stack.length
      ? (sinkForStack(w, s.stack, s.role, taken) ?? sinkForStack(w, stranded, 'auto', taken))
      : chooseJob(w, s, s.role, cap, taken);
    s.rethink = TUNING.stockerRethink;
  }
  const job = s.job;
  if (!job) {
    s.vx = s.vz = 0;
    transferTick(w, s, null, { agent: 'stocker', id: s.id }, { drop: () => false, pick: () => false, cap });
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
  if (!walkAgent(w, 'walker', s, { station: target }, stockerSpeed(w))) {
    transferTick(w, s, null, { agent: 'stocker', id: s.id }, { drop: () => false, pick: () => false, cap });
    return;
  }
  const moved = transferTick(
    w,
    s,
    st,
    { agent: 'stocker', id: s.id },
    {
      drop: (_, p) => !fetching && p === job.product,
      pick: () => fetching,
      cap,
      pickLimit: job.need,
    },
  );
  if (moved.dropped || moved.picked) return;
  if (fetching) {
    if (st.kind !== 'producer' || availableCount(st) > 0) return; // still filling
    if (s.stack.length) job.source = null;
    else s.job = null;
    return;
  }
  // Sink can't take more: leftovers go to another sink, or wait.
  if (s.stack.includes(job.product) && accepts(w, st, job.product)) return;
  s.job = null;
  s.rethink = 0;
}

export function updateStaff(w: World): void {
  for (const s of w.stockers) updateStocker(w, s);
}
