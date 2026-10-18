// Builds the Logbook's view from a Map's progress (the live World or a save): Objective tiles and Stats cards.
import type { MapDef } from '../sim/map';
import type { MapSave } from '../sim/save';
import { objectiveProgress } from '../sim/objectives';
import { objectiveId, type ObjectiveDef } from '../../catalog/objectives';
import { restoreStats, sumStats, type Stats } from '../sim/stats';
import { TUNING } from '../sim/tuning';
import { formatMoney } from '../format';
import { emojiUrl, iconUrl } from '../view/thumbs';
import type { LogbookView, StatGroup } from '../ui/logbook';

/** What the Logbook reads of a Map: a World has all of it. */
export interface MapProgress {
  stats: Stats;
  owned: Set<string>;
  objectivesDone: Set<string>;
  score: number;
}

export const progressOfSave = (m: MapSave | undefined): MapProgress => ({
  stats: restoreStats(m?.stats),
  owned: new Set(m?.owned),
  objectivesDone: new Set(m?.objectives),
  score: m?.score ?? 0,
});

/** An Objective's icon and name, as the Logbook and the "Objective done!" card show them. */
export function objectiveInfo(map: MapDef, o: ObjectiveDef): { icon: string; name: string } {
  switch (o.kind) {
    case 'sell': {
      const p = map.products[o.product];
      return { icon: iconUrl(p?.model ?? ''), name: `Sell ${o.n} ${p?.name ?? o.product}` };
    }
    case 'earn':
      return { icon: emojiUrl('💵'), name: `Earn ${formatMoney(o.n)}` };
    case 'deliveries':
      return { icon: iconUrl('van'), name: `Fill ${o.n} ${o.n > 1 ? 'Deliveries' : 'Delivery'} completely` };
    case 'own': {
      if (o.id in map.layout.areas) return { icon: emojiUrl('🔑'), name: `Own Area ${o.id.replace(/\D/g, '')}` };
      const def = map.pads[o.id]?.unlocks;
      const type = def?.kind === 'producer' ? map.producers[def.type] : undefined;
      return { icon: iconUrl(type?.model ?? ''), name: `Own ${type?.name ?? o.id}` };
    }
  }
}

const sum = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0);

function playTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function statGroups(s: Stats): StatGroup[] {
  const n = (v: number): string => v.toLocaleString('en-US');
  return [
    {
      icon: '📦',
      name: 'Items',
      rows: [
        ['Made', n(sum(s.made))],
        ['Sold', n(sum(s.sold))],
        ['Trashed', n(s.trashed)],
        ['Fell off', n(s.fellLoose)],
      ],
    },
    {
      icon: '🧽',
      name: 'Messes',
      rows: [
        ['Made', n(s.messesMade)],
        ['Cleaned', n(s.messesCleaned)],
      ],
    },
    {
      icon: '💵',
      name: 'Money',
      rows: [
        ['Earned', formatMoney(s.moneyEarned)],
        ['Fines', formatMoney(s.moneyFined)],
      ],
    },
    {
      icon: '🛒',
      name: 'Customers',
      rows: [
        ['Served', n(s.served)],
        ['Gave up', n(s.gaveUp)],
      ],
    },
    {
      icon: '🚚',
      name: 'Deliveries',
      rows: [
        ['Filled', n(s.deliveriesFull)],
        ['Partly', n(s.deliveriesPartly)],
        ['Missed', n(s.deliveriesMissed)],
      ],
    },
    {
      icon: '🦹',
      name: 'Robbery',
      rows: [
        ['Caught', n(s.thievesCaught)],
        ['Escaped', n(s.thievesEscaped)],
      ],
    },
    {
      icon: '🧐',
      name: 'Inspector',
      rows: [
        ['Spotless', n(s.spotless)],
        ['Fined', n(s.inspectionsFined)],
        ['Bad Review', n(s.badReviews)],
      ],
    },
    {
      icon: '⏱',
      name: 'Challenges',
      rows: [
        ['Won', n(s.challengesWon)],
        ['Failed', n(s.challengesFailed)],
      ],
    },
    {
      icon: '🕒',
      name: 'Play time',
      rows: [
        ['Played', playTime(s.playTime)],
        ['Times closed', n(s.timesClosed)],
      ],
    },
  ];
}

/** `mine` is the Map the Logbook is about; `all` is every Map's progress, `mine` included. */
export function logbookView(map: MapDef, mine: MapProgress, all: MapProgress[]): LogbookView {
  return {
    mapName: map.name,
    score: mine.score,
    total: all.reduce((t, p) => t + p.score, 0),
    points: TUNING.score.objective,
    objectives: map.objectives.map((o) => ({
      ...objectiveInfo(map, o),
      ...objectiveProgress(mine, o),
      done: mine.objectivesDone.has(objectiveId(o)),
    })),
    thisMap: statGroups(mine.stats),
    whole: statGroups(sumStats(all.map((p) => p.stats))),
  };
}
