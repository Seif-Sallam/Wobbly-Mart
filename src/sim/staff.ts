// Stockers (and the bot) pick carrying jobs: most urgent Shelf or Producer input that something can fill right now.
import type { Job, ProducerStation, Station, Stocker, World } from './world';
import { accepts, availableCount, transferTick } from './carry';
import { shelfCap, stockerCarry, stockerSpeed } from './economy';
import { walkAgent, walkDistance } from './walk';
import { DT } from './world';

/** Products in a Product's chain: itself plus everything upstream of it. */
export function chainOf(w: World, product: string): Set<string> {
  const out = new Set([product]);
  for (let grew = true; grew;) {
    grew = false;
    for (const type of Object.values(w.map.producers)) {
      if (!out.has(type.output)) continue;
      for (const p of type.inputs) if (!out.has(p)) grew = !!out.add(p);
    }
  }
  return out;
}

function inScope(w: World, st: Station, assignment: string | null): boolean {
  if (!assignment) return true;
  if (st.kind === 'shelf') return st.product === assignment;
  return st.kind === 'producer' && chainOf(w, assignment).has(w.map.producers[st.type].output);
}

function shelfUrgency(w: World, st: Station): number {
  if (st.kind !== 'shelf') return Infinity;
  const waiting = w.customers.some((c) => c.state === 'shop' && c.list[c.li]?.shelf === st.id);
  return st.items === 0 && waiting ? 0 : 1 + st.items / shelfCap(w);
}

/** Lower is more urgent. A Producer's input is as urgent as the Shelf its output feeds. */
function urgency(w: World, st: Station, product: string): number {
  if (st.kind === 'shelf') return shelfUrgency(w, st);
  if (st.kind !== 'producer') return Infinity;
  const type = w.map.producers[st.type];
  if (st.tray >= (type.trayCap ?? 0)) return 3;
  const have = st.input[product] ?? 0;
  const own = have === 0 ? 1.5 : 2 + have / (type.inputCap ?? 1);
  let downstream = Infinity;
  for (const s of w.stations.values())
    if (s.kind === 'shelf' && s.product === type.output) downstream = Math.min(downstream, shelfUrgency(w, s));
  return Math.min(own, downstream + 0.25 + have / (type.inputCap ?? 1));
}

function freeSpace(w: World, st: Station, product: string): number {
  if (st.kind === 'shelf') return shelfCap(w) - st.items;
  if (st.kind === 'producer') return (w.map.producers[st.type].inputCap ?? 0) - (st.input[product] ?? 0);
  return 0;
}

function sinksFor(w: World, product: string, assignment: string | null, taken: Set<string>): Station[] {
  return [...w.stations.values()]
    .filter((st) => !taken.has(st.id) && inScope(w, st, assignment) && st.kind !== 'trash' && accepts(w, st, product))
    .sort((a, b) => urgency(w, a, product) - urgency(w, b, product));
}

/** Best job for an empty-handed carrier at (x, z), skipping Stations other carriers already serve. */
export function chooseJob(
  w: World,
  pos: { x: number; z: number },
  assignment: string | null,
  cap: number,
  taken: Set<string>,
): Job | null {
  let best: { job: Job; score: number } | null = null;
  const sources = [...w.stations.values()].filter(
    (s): s is ProducerStation => s.kind === 'producer' && availableCount(s) > 0 && inScope(w, s, assignment),
  );
  for (const src of sources) {
    const product = w.map.producers[src.type].output;
    const sink = sinksFor(w, product, assignment, taken)[0];
    if (!sink) continue;
    const score = urgency(w, sink, product) * 100 + walkDistance(w, 'walker', pos, { station: src.id });
    if (best && score >= best.score) continue;
    const demand = sinksFor(w, product, assignment, taken).reduce((sum, st) => sum + freeSpace(w, st, product), 0);
    best = { job: { sink: sink.id, source: src.id, product, need: Math.min(cap, demand) }, score };
  }
  return best?.job ?? null;
}

/** A Station that takes one of the carried products, for a carrier whose job's sink filled up. */
export function sinkForStack(w: World, stack: string[], assignment: string | null, taken: Set<string>): Job | null {
  for (const product of new Set(stack)) {
    const sink = sinksFor(w, product, assignment, taken)[0];
    if (sink) return { sink: sink.id, source: null, product, need: 0 };
  }
  return null;
}

function updateStocker(w: World, s: Stocker): void {
  const taken = new Set(w.stockers.filter((o) => o !== s && o.job).map((o) => o.job?.sink ?? ''));
  const cap = stockerCarry(w);
  s.rethink -= DT;
  if (!s.job && s.rethink <= 0) {
    s.job = s.stack.length ? sinkForStack(w, s.stack, s.assignment, taken) : chooseJob(w, s, s.assignment, cap, taken);
    s.rethink = 0.5;
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
