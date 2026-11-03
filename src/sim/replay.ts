// A Daily Shift's input log: the Intents, logged only when they change. Re-simmed from the day's seed it rebuilds the
// exact World (reload resume), and gzipped it is the Shift's Replay.
import type { Intents } from './world';
import { MOVE_STEPS, toMoveStep } from './intents';

/** One-tick commands; everything else holds until the next entry. */
export type LogCommand = Pick<Intents, 'buyUpgrade' | 'assign' | 'setClosed'>;
/** [ticks since the previous entry, move x step, move z step, flags (grab 1, sprint 2, grabPaused 4, manualGrab 8),
 *  command?] */
export type LogEntry = [number, number, number, number] | [number, number, number, number, LogCommand];

/** What a finished Shift claims; the Worker checks it against the submit. The seed stands for the Map. */
export interface ReplayHeader {
  simVersion: number;
  day: number;
  seed: number;
  /** Ticks to the goal: the log ends there. */
  ticks: number;
  score: number;
  money: number;
}

/** A Shift's Replay, gzipped JSON on the wire. */
export interface Replay {
  header: ReplayHeader;
  log: InputLog;
}

export interface InputLog {
  /** Ticks stepped so far. */
  ticks: number;
  entries: LogEntry[];
}

const FLAGS = ['grab', 'sprint', 'grabPaused', 'manualGrab'] as const;

export class InputRecorder {
  readonly log: InputLog = { ticks: 0, entries: [] };
  private at = 0;
  private held = [0, 0, 0];

  /** Call once per sim step, with the Intents that step got. */
  record(i: Intents): void {
    const now = [toMoveStep(i.move.x), toMoveStep(i.move.z), FLAGS.reduce((f, k, b) => f | (i[k] ? 1 << b : 0), 0)];
    const command: LogCommand = {};
    if (i.buyUpgrade) command.buyUpgrade = i.buyUpgrade;
    if (i.assign) command.assign = i.assign;
    if (i.setClosed !== undefined) command.setClosed = i.setClosed;
    const hasCommand = Object.keys(command).length > 0;
    if (hasCommand || now.some((v, k) => v !== this.held[k])) {
      const gap = this.log.ticks - this.at;
      this.log.entries.push(hasCommand ? [gap, now[0], now[1], now[2], command] : [gap, now[0], now[1], now[2]]);
      this.at = this.log.ticks;
      this.held = now;
    }
    this.log.ticks++;
  }
}

/** The Intents of every logged tick, in order. */
export function* replayIntents(log: InputLog): Generator<Intents> {
  let held: Intents = { move: { x: 0, z: 0 }, grab: false };
  let next = 0;
  let at = log.entries[0]?.[0] ?? Infinity;
  for (let t = 0; t < log.ticks; t++) {
    if (t !== at) {
      yield held;
      continue;
    }
    const [, x, z, flags, command] = log.entries[next];
    held = { move: { x: x / MOVE_STEPS, z: z / MOVE_STEPS }, grab: false };
    FLAGS.forEach((k, b) => flags & (1 << b) && (held[k] = true));
    yield command ? { ...held, ...command } : held;
    next++;
    at = next < log.entries.length ? at + log.entries[next][0] : Infinity;
  }
}
