// Today's Daily Shift: its input log, kept locally so a reload re-sims to the exact moment, its finish and Replay,
// and the Board's last answer for the title's ticket.
import type { ShiftBody, ShiftResponse } from '../../worker/api';
import type { InputLog, Replay } from '../sim/replay';
import { InputRecorder, replayIntents } from '../sim/replay';
import { SIM_VERSION } from '../sim/version';
import type { ShiftDay } from './shift-day';
import { read, write } from './storage';

const KEY = 'wobbly-mart.shift';
const RESULT = 'wobbly-mart.shift-result';

interface Stored {
  day: number;
  log: InputLog;
  /** Ticks to the goal; null until it is done. */
  doneTicks: number | null;
  /** Played with `?debug` (its cheats): never ranked. */
  debug?: true;
}

/** The last accepted Shift's place and Streak. */
export interface ShiftResult {
  day: number;
  rank: number;
  streak: number;
}

export class Shift {
  recorder = new InputRecorder();
  doneTicks: number | null = null;
  debug: boolean;
  /** The finished attempt's submit (its Replay gzips in the background). */
  pending: Promise<ShiftBody> | null = null;

  constructor(readonly day: ShiftDay) {
    this.debug = import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
    try {
      const s = JSON.parse(read(KEY) ?? 'null') as Stored | null;
      // a stored Shift of another day (or sim) is just dropped
      if (s?.day === day.day) {
        for (const i of replayIntents(s.log)) this.recorder.record(i);
        this.doneTicks = s.doneTicks;
        this.debug ||= !!s.debug;
      }
    } catch {
      // a broken record starts the Shift fresh
    }
  }

  reset(): void {
    this.recorder = new InputRecorder();
    this.doneTicks = null;
    this.save();
  }

  save(): void {
    const s: Stored = { day: this.day.day, log: this.recorder.log, doneTicks: this.doneTicks };
    if (this.debug) s.debug = true;
    write(KEY, JSON.stringify(s));
  }

  /** The goal is done now: keeps the time and builds the submit, its Replay ending at this tick. */
  finish(score: number, money: number): void {
    const { log } = this.recorder;
    this.doneTicks = log.ticks;
    this.save();
    const claim = { day: this.day.day, ticks: log.ticks, score: Math.floor(score), money: Math.floor(money) };
    const replay: Replay = {
      header: { simVersion: SIM_VERSION, seed: this.day.seed, ...claim },
      log: { ticks: log.ticks, entries: log.entries.slice() },
    };
    this.pending = gzipBase64(JSON.stringify(replay)).then((r) => ({ ...claim, simVersion: SIM_VERSION, replay: r }));
  }

  /** The last accepted Shift, if it is today's or yesterday's (an older Streak is already broken). */
  static result(today: number): ShiftResult | null {
    try {
      const r = JSON.parse(read(RESULT) ?? 'null') as ShiftResult | null;
      return r && r.day >= today - 1 ? r : null;
    } catch {
      return null;
    }
  }

  static keepResult(day: number, r: ShiftResponse): void {
    write(RESULT, JSON.stringify({ day, rank: r.rank, streak: r.streak } satisfies ShiftResult));
  }
}

async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
