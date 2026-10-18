// Objectives: fixed goals per Map, progress read from Stats and ownership, done once and kept.
import type { ObjectiveDef } from '../../catalog/objectives';
import { objectiveId } from '../../catalog/objectives';
import type { World } from './world';

/** How far an Objective is: `got` is capped at `want`. */
export function objectiveProgress(w: Pick<World, 'stats' | 'owned'>, o: ObjectiveDef): { got: number; want: number } {
  switch (o.kind) {
    case 'sell':
      return { got: Math.min(o.n, w.stats.sold[o.product] ?? 0), want: o.n };
    case 'earn':
      return { got: Math.min(o.n, w.stats.moneyEarned), want: o.n };
    case 'deliveries':
      return { got: Math.min(o.n, w.stats.deliveriesFull), want: o.n };
    case 'own':
      return { got: w.owned.has(o.id) ? 1 : 0, want: 1 };
  }
}

/** Marks Objectives that are met and raises `objectiveDone` for each, once. */
export function updateObjectives(w: World): void {
  for (const o of w.map.objectives) {
    const id = objectiveId(o);
    if (w.objectivesDone.has(id)) continue;
    const { got, want } = objectiveProgress(w, o);
    if (got < want) continue;
    w.objectivesDone.add(id);
    w.events.push({ type: 'objectiveDone', objective: id });
  }
}
