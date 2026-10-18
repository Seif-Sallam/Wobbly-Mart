// Score: points for achievements, per Map. It never goes down; fines and failures never touch it.
import type { World } from './world';
import { TUNING } from './tuning';
import { completion } from './economy';

const S = TUNING.score;

/** Quarters of Completion (0–4) reached. */
export const quartersOf = (c: number): number => Math.floor(c * 4 + 1e-9);

function pointsFor(e: World['events'][number]): number {
  switch (e.type) {
    case 'objectiveDone':
      return S.objective;
    case 'challengeWon':
      return S.challenge;
    case 'deliveryDone':
      return e.complete ? S.delivery : 0;
    case 'robberyDone':
      return e.caught ? S.thief : 0;
    case 'inspection':
      return !e.review && e.messes + e.loose === 0 ? S.spotless : 0;
    default:
      return 0;
  }
}

/** Adds this step's points; each new quarter of Completion pays once and raises `quarterScored`. */
export function updateScore(w: World): void {
  for (const e of w.events) w.score += pointsFor(e);
  const quarters = quartersOf(completion(w));
  while (w.quarters < quarters) {
    w.quarters++;
    w.score += S.quarter;
    w.events.push({ type: 'quarterScored', quarter: w.quarters });
  }
}
