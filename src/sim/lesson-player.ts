// A player who follows the Lesson arrows, as Intents: it drives the Lesson tests and the bot's Tutorial Map run.
// Screens the real app owns (Edit Layout, Logbook, the Delivery card) are reported the way the app reports them.
import type { Intents, World } from './world';
import { lessonGhost, lessonTarget, type LessonUiFact } from './lessons';
import { moveIntent } from './bot';
import { payMoves, place } from './layout';

export class LessonPlayer {
  /** Reported facts waiting to be sent, one per step. */
  private facts: LessonUiFact[] = [];
  /** Things already done in a step, by Lesson, step and replay. */
  private done = new Set<string>();
  private replays = 0;

  intents(w: World): Intents {
    const L = w.lesson;
    const intents: Intents = { move: { x: 0, z: 0 }, grab: false };
    if (!L) return intents;
    if (w.events.some((e) => e.type === 'lessonReplay')) this.replays++;
    if (L.phase === 'card') return { ...intents, lessonNext: true };
    const once = (fn: () => void): void => {
      const key = `${L.index}.${L.step}.${this.replays}`;
      if (this.done.has(key)) return;
      this.done.add(key);
      fn();
    };
    const target = lessonTarget(w);
    if (target) intents.move = moveIntent(w, target) ?? intents.move;
    intents.sprint = (L.index === 1 && L.step === 1) || (L.index === 7 && L.step === 0);
    if (L.phase === 'play') {
      const at = `${L.index}.${L.step}`;
      if (at === '8.1' && w.atOffice) intents.buyUpgrade = 'stack_cap';
      if (at === '9.0' && w.atOffice) once(() => this.facts.push('layoutOpen'));
      if (at === '9.1')
        once(() => {
          const ghost = lessonGhost(w);
          if (ghost) place(w, ghost.station, ghost.spot);
          payMoves(w, 1);
          this.facts.push('layoutClosed');
        });
      if (at === '10.2' && w.atOffice && w.stockers[0]) intents.assign = { stocker: w.stockers[0].id, role: 'goods' };
      if (at === '11.0' && target) once(() => this.facts.push('deliveryCard'));
      if (at === '12.0' && w.atOffice) intents.setClosed = true;
      if (at === '12.1' && w.atOffice) intents.setClosed = false;
      if (at === '13.1') once(() => this.facts.push('logbookOpen'));
      if (at === '13.2') once(() => this.facts.push('logbookClosed'));
    }
    intents.ui = this.facts.shift();
    return intents;
  }
}
