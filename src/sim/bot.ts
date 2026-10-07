// A greedy bot that plays a map through the same Intents as a human; CI uses it to prove 100% is reachable.
import type { Point } from './map';
import type { Intents, Job, World } from './world';
import { DT } from './world';
import {
  cashPilePoint,
  canBuyUpgrade,
  nextLevelCost,
  padRemaining,
  stackCap,
  upgradeVisible,
  visiblePads,
} from './economy';
import { boxCentre, distToBox } from './geometry';
import { headingFor, type Target } from './walk';
import { chooseJob, sinkForStack } from './staff';
import { accepts, availableCount } from './carry';
import { nextRandom } from './rng';
import { TUNING } from './tuning';

// How the bot plays, not game rules.
const ARRIVE = 0.3;
const SLOW_DOWN_DISTANCE = 1.2;
const MIN_PUSH = 0.25;
const THINK_EVERY = 0.25;
const STUCK_MOVE = 0.002;
const STUCK_AFTER = 1.5;
const WIGGLE_FOR = 0.4;

function resolve(w: World, target: string | Point): Target {
  if (typeof target !== 'string') return { point: target };
  if (target.startsWith('cash:')) return { point: cashPilePoint(w, target.slice(5)) };
  if (w.stations.has(target)) return { station: target };
  return { point: boxCentre(w.map.layout.places[target].box) };
}

/** Move intent toward a Station id, Pad id, `cash:<register>` or point; null once there. */
export function moveIntent(w: World, target: string | Point): { x: number; z: number } | null {
  const t = resolve(w, target);
  const p = w.player;
  if (
    'point' in t
      ? Math.hypot(p.x - t.point[0], p.z - t.point[1]) < ARRIVE
      : distToBox(p.x, p.z, w.stations.get(t.station)?.box ?? [0, 0, 0, 0]) <= TUNING.reach * TUNING.arriveReachShare
  )
    return null;
  const to = headingFor(w, 'walker', p, t);
  if (!to) return null;
  const dx = to[0] - p.x;
  const dz = to[1] - p.z;
  const d = Math.hypot(dx, dz);
  const end = 'point' in t ? Math.hypot(t.point[0] - p.x, t.point[1] - p.z) : d;
  const k = Math.min(1, end / SLOW_DOWN_DISTANCE + MIN_PUSH) / Math.max(d, 1e-6);
  return { x: dx * k, z: dz * k };
}

export class Bot {
  private target: string | Point | null = null;
  private job: Job | null = null;
  private think = 0;
  private stuckFor = 0;
  private last: Point = [0, 0];
  private wiggle = 0;
  private wiggleDir = { x: 0, z: 0 };

  intents(w: World): Intents {
    const idle: Intents = { move: { x: 0, z: 0 }, grab: false, manualGrab: true };
    if (w.pan) return idle;
    if (w.atOffice) {
      const up = this.cheapestUpgrade(w);
      if (up && canBuyUpgrade(w, up)) return { ...idle, buyUpgrade: up };
    }
    this.think -= DT;
    if (this.think <= 0 || !this.target) {
      this.target = this.decide(w);
      this.think = THINK_EVERY;
    }
    if (!this.target) return idle;
    const p = w.player;
    // Manual Grab: only transfer at the Station it means to use, not at every one it brushes past
    const station = typeof this.target === 'string' ? w.stations.get(this.target) : undefined;
    idle.manualGrab = true;
    idle.grab = !!station && distToBox(p.x, p.z, station.box) <= TUNING.reach;
    if (this.wiggle > 0) {
      this.wiggle -= DT;
      return { ...idle, move: this.wiggleDir };
    }
    const move = moveIntent(w, this.target);
    if (!move) {
      this.stuckFor = 0;
      return idle;
    }
    this.stuckFor = Math.hypot(p.x - this.last[0], p.z - this.last[1]) < STUCK_MOVE ? this.stuckFor + DT : 0;
    this.last = [p.x, p.z];
    if (this.stuckFor > STUCK_AFTER) {
      const a = nextRandom(w) * Math.PI * 2;
      this.wiggleDir = { x: Math.cos(a), z: Math.sin(a) };
      this.wiggle = WIGGLE_FOR;
      this.stuckFor = 0;
    }
    return { ...idle, move };
  }

  private cheapestUpgrade(w: World): string | null {
    let best: string | null = null;
    let bestCost = Infinity;
    for (const id of Object.keys(w.map.upgrades)) {
      const cost = upgradeVisible(w, id) ? nextLevelCost(w, id) : null;
      if (cost !== null && cost < bestCost) {
        best = id;
        bestCost = cost;
      }
    }
    return best;
  }

  private decide(w: World): string | Point | null {
    const pads = visiblePads(w).sort((a, b) => padRemaining(w, a) - padRemaining(w, b));
    const pad = pads[0];
    if (pad && padRemaining(w, pad) <= w.money + 1e-6) return pad;
    const up = this.cheapestUpgrade(w);
    const upCost = up ? (nextLevelCost(w, up) ?? Infinity) : Infinity;
    if (up && upCost <= w.money) return 'office';

    const registers = [...w.stations.values()].filter((s) => s.kind === 'register');
    for (const reg of registers) {
      if (reg.kind === 'register' && reg.queue.length && !w.cashiers.some((c) => c.register === reg.id)) return reg.id;
    }
    const need = Math.min(pad ? padRemaining(w, pad) : Infinity, upCost);
    let cashReg: string | null = null;
    let cash = 0;
    for (const reg of registers) {
      if (reg.kind === 'register' && reg.cash > cash) {
        cash = reg.cash;
        cashReg = reg.id;
      }
    }
    if (cashReg && w.money + cash >= need) return `cash:${cashReg}`;

    const carry = this.carryTarget(w);
    if (carry) return carry;
    if (cashReg) return `cash:${cashReg}`;
    if (pad && w.money > 0) return pad;
    return registers[0]?.id ?? null;
  }

  /** Same job logic as a Stocker: fetch from a source until enough, then deliver; leftovers find another sink. */
  private carryTarget(w: World): string | null {
    const p = w.player;
    const count = (product: string) => p.stack.filter((x) => x === product).length;
    const taken = new Set(w.stockers.map((s) => s.job?.sink ?? ''));
    let job = this.job;
    const sink = job ? w.stations.get(job.sink) : undefined;
    if (job && (!sink || (!accepts(w, sink, job.product) && count(job.product) > 0))) job = null;
    if (job && !job.source && count(job.product) === 0) job = null;
    if (!job) {
      job = sinkForStack(w, p.stack, 'auto', taken) ?? chooseJob(w, p, 'auto', stackCap(w) - p.stack.length, taken);
      if (job?.source) job.need += count(job.product);
    }
    this.job = job;
    if (!job) return null;
    const src = job.source ? w.stations.get(job.source) : undefined;
    const fetching =
      src?.kind === 'producer' &&
      availableCount(src) > 0 &&
      count(job.product) < job.need &&
      p.stack.length < stackCap(w);
    if (!fetching && job.source && count(job.product) === 0) {
      this.job = null;
      return null;
    }
    if (!fetching) job.source = null;
    return fetching ? (src?.id ?? null) : job.sink;
  }
}
