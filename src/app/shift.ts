// Today's Daily Shift: its input log, kept locally so a reload re-sims to the exact moment, and its finish.
import type { InputLog } from '../sim/replay';
import { InputRecorder, replayIntents } from '../sim/replay';
import type { ShiftDay } from './shift-day';
import { read, write } from './storage';

const KEY = 'wobbly-mart.shift';

interface Stored {
  day: number;
  log: InputLog;
  /** Ticks to the goal; null until it is done. */
  doneTicks: number | null;
  /** Played with `?debug` (its cheats): never ranked. */
  debug?: true;
}

export class Shift {
  recorder = new InputRecorder();
  doneTicks: number | null = null;
  debug: boolean;
  constructor(readonly day: ShiftDay) {
    this.debug = new URLSearchParams(location.search).has('debug');
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
}
