// Stats: per-Map tallies counted from the events the sim already raises. The whole game is the sum over Maps.
import type { World } from './world';
import { DT } from './world';

export interface Stats {
  made: Record<string, number>;
  /** Items checked out, per Product. */
  sold: Record<string, number>;
  trashed: number;
  /** Items that fell off a Stack as Loose Items (a broken one is a Mess instead). */
  fellLoose: number;
  messesMade: number;
  messesCleaned: number;
  /** Checkouts, Deliveries, Event rewards and Challenge bonuses. */
  moneyEarned: number;
  moneyFined: number;
  served: number;
  gaveUp: number;
  deliveriesFull: number;
  deliveriesPartly: number;
  deliveriesMissed: number;
  thievesCaught: number;
  thievesEscaped: number;
  spotless: number;
  inspectionsFined: number;
  badReviews: number;
  challengesWon: number;
  challengesFailed: number;
  timesClosed: number;
  /** Seconds the sim ran. */
  playTime: number;
}

export const emptyStats = (): Stats => ({
  made: {},
  sold: {},
  trashed: 0,
  fellLoose: 0,
  messesMade: 0,
  messesCleaned: 0,
  moneyEarned: 0,
  moneyFined: 0,
  served: 0,
  gaveUp: 0,
  deliveriesFull: 0,
  deliveriesPartly: 0,
  deliveriesMissed: 0,
  thievesCaught: 0,
  thievesEscaped: 0,
  spotless: 0,
  inspectionsFined: 0,
  badReviews: 0,
  challengesWon: 0,
  challengesFailed: 0,
  timesClosed: 0,
  playTime: 0,
});

const count = (r: Record<string, number>, key: string, n = 1): void => {
  r[key] = (r[key] ?? 0) + n;
};

const num = (v: unknown): number => (typeof v === 'number' && v > 0 ? v : 0);

/** Stats from a save: unknown or malformed fields count as 0. */
export function restoreStats(raw: Partial<Stats> | undefined): Stats {
  const out = emptyStats();
  for (const key of Object.keys(out) as (keyof Stats)[]) {
    const v = raw?.[key];
    if (key === 'made' || key === 'sold')
      out[key] = Object.fromEntries(Object.entries(v ?? {}).map(([k, n]) => [k, num(n)]));
    else (out[key] as number) = num(v);
  }
  return out;
}

/** The whole game: every Map's Stats added up. */
export function sumStats(all: Stats[]): Stats {
  const total = emptyStats();
  for (const s of all)
    for (const key of Object.keys(total) as (keyof Stats)[]) {
      if (key === 'made' || key === 'sold') for (const [k, n] of Object.entries(s[key])) count(total[key], k, n);
      else (total[key] as number) += s[key] as number;
    }
  return total;
}

/** Counts this step's events; runs after everything that raises them. */
export function updateStats(w: World): void {
  const s = w.stats;
  s.playTime += DT;
  for (const e of w.events) {
    switch (e.type) {
      case 'produced': {
        const st = w.stations.get(e.station);
        if (st?.kind === 'producer') count(s.made, w.map.producers[st.type].output);
        break;
      }
      case 'paid':
        s.served++;
        s.moneyEarned += e.amount;
        for (const p of e.products) count(s.sold, p);
        break;
      case 'trashed':
        s.trashed++;
        break;
      case 'transfer':
        if ('loose' in e.to && 'agent' in e.from && e.from.agent !== 'thief') s.fellLoose++;
        break;
      case 'mess':
        s.messesMade++;
        break;
      case 'messCleared':
        s.messesCleaned++;
        break;
      case 'customerLeft':
        if (!e.happy) s.gaveUp++;
        break;
      case 'deliveryDone':
        s.moneyEarned += e.amount + e.tip;
        if (e.complete) s.deliveriesFull++;
        else if (e.amount > 0) s.deliveriesPartly++;
        else s.deliveriesMissed++;
        break;
      case 'robberyDone':
        if (e.caught) {
          s.thievesCaught++;
          s.moneyEarned += e.amount;
        } else s.thievesEscaped++;
        break;
      case 'inspection':
        if (e.amount > 0) s.moneyEarned += e.amount;
        else s.moneyFined -= e.amount;
        if (e.review) s.badReviews++;
        if (!e.review && e.messes + e.loose === 0) s.spotless++;
        else s.inspectionsFined++;
        break;
      case 'challengeWon':
        s.challengesWon++;
        s.moneyEarned += e.money;
        break;
      case 'challengeFailed':
        s.challengesFailed++;
        break;
    }
  }
}
