import { expect, test } from 'vitest';
import { tutorialMap } from '../../maps/tutorial';
import { createWorld, step, type SimEvent, type World } from './world';
import { lessonAim, lessonCard, lessonGhost, lessonHud } from './lessons';
import { LessonPlayer } from './lesson-player';
import { cutOff, spotProblem } from './layout';
import { completion } from './economy';
import { TUNING } from './tuning';
import type { ProducerStation, ShelfStation } from './world';

const device = { touch: false, joystick: 'fixed' } as const;

const player = new LessonPlayer();
/** Every event of every played step, for what a test wants to see afterwards. */
const log: SimEvent[] = [];

/** Plays like a person following the arrow (see LessonPlayer). Stops at "Nice!". */
function playLesson(w: World, index: number, limit = 240): void {
  for (let i = 0; i < limit * 60; i++) {
    const L = w.lesson;
    if (!L || L.index > index || (L.index === index && L.phase === 'nice')) return;
    step(w, player.intents(w));
    log.push(...w.events);
  }
  throw new Error(`Lesson ${index} never finished (step ${w.lesson?.step}, ${w.lesson?.phase})`);
}

/** Lets "Nice!" run out, on to the next card. */
const finish = (w: World): void => {
  for (let i = 0; i < 2 * 60; i++) step(w, { move: { x: 0, z: 0 }, grab: false });
};

const idle = { move: { x: 0, z: 0 }, grab: false };

const shelf = (w: World, id: string) => w.stations.get(id) as ShelfStation;

test('the Tutorial Map runs Lessons 0–14 from frozen cards to goals, scripted and never failed', () => {
  const w = createWorld(tutorialMap, null, 7);
  expect(w.lesson).toMatchObject({ index: 0, phase: 'card' });
  expect(w.pan).toBeNull();
  expect(lessonCard(w, device)?.title).toBe('The goal');

  // a card freezes the whole sim: time, Player and Producers stand still
  for (let i = 0; i < 120; i++) step(w, { move: { x: 1, z: 0 }, grab: false });
  expect(w.t).toBe(0);
  expect(w.player.x).toBe(tutorialMap.layout.playerStart[0]);

  // card-only Lesson 0 goes straight to Lesson 1's card; the copy follows the device
  step(w, { move: { x: 0, z: 0 }, grab: false, lessonNext: true });
  expect(w.lesson).toMatchObject({ index: 1, phase: 'card' });
  expect(lessonCard(w, device)?.body.join(' ')).toContain('WASD');
  const phone = lessonCard(w, { touch: true, joystick: 'off' })?.body.join(' ');
  expect(phone).toContain('Tap the floor');
  expect(phone).not.toContain('WASD');
  expect(lessonCard(w, { touch: true, joystick: 'fixed' })?.body[0]).toContain('joystick');

  // Lesson 1: walk, then sprint; nothing else happens on its own (no Customers, no Events)
  step(w, { move: { x: 0, z: 0 }, grab: false, lessonNext: true });
  expect(w.lesson?.phase).toBe('play');
  expect(lessonHud(w, device)?.line).toBe('Walk to the ring');
  expect(lessonAim(w)).toEqual([13, 9.5]);
  playLesson(w, 1);
  expect(lessonHud(w, device)?.head).toBe('Nice!');
  finish(w);
  expect(w.lesson).toMatchObject({ index: 2, phase: 'card' });
  expect(w.customers).toHaveLength(0);
  expect(w.money).toBe(0);

  // Lesson 2: tomatoes from the bed to the Shelf
  playLesson(w, 2);
  expect(shelf(w, 'tomato_shelf').items).toBeGreaterThanOrEqual(3);
  finish(w);

  // Lesson 3: a called Customer, checkout, Cash Pile
  expect(w.lesson).toMatchObject({ index: 3, phase: 'card' });
  expect(w.customers).toHaveLength(1);
  expect(shelf(w, 'tomato_shelf').items).toBe(4);
  step(w, { move: { x: 0, z: 0 }, grab: false, lessonNext: true });

  // a forced failure (the Customer vanishes unpaid) replays the setup: same Shelf, a new Customer, no Money lost
  w.customers = [];
  const events: string[] = [];
  step(w, { move: { x: 0, z: 0 }, grab: false });
  events.push(...w.events.map((e) => e.type));
  expect(events).toContain('lessonReplay');
  expect(w.lesson).toMatchObject({ index: 3, phase: 'play', step: 0 });
  expect(w.customers).toHaveLength(1);
  expect(w.money).toBe(0);

  playLesson(w, 3);
  for (let i = 0; i < 90; i++) step(w, { move: { x: 0, z: 0 }, grab: false });
  expect(w.money).toBe(6);
  finish(w);

  // Lesson 4: exactly enough Money for the Egg Shelf
  expect(w.lesson).toMatchObject({ index: 4, phase: 'card' });
  expect(w.money).toBe(10);
  playLesson(w, 4);
  expect(w.owned.has('egg_shelf')).toBe(true);
  expect(w.money).toBe(0);
  finish(w);

  // Lesson 5: buy the Coop, feed it, take eggs
  expect(w.money).toBe(15);
  playLesson(w, 5);
  expect(w.owned.has('chicken_coop')).toBe(true);
  expect(w.player.stack).toContain('egg');
  finish(w);

  // Lesson 6: Ketchup Shelf and Blender, then ketchup
  playLesson(w, 6);
  expect(w.owned.has('ketchup_shelf') && w.owned.has('blender')).toBe(true);
  expect(w.player.stack).toContain('ketchup');
  expect((w.stations.get('blender') as ProducerStation).work).toBeLessThan(2);
  finish(w);

  // Lesson 7: sprint, tip, retrieve, trash, mop, put the Mop back
  expect(w.lesson).toMatchObject({ index: 7, phase: 'card' });
  expect(w.player.stack).toHaveLength(8);
  playLesson(w, 7);
  finish(w);
  expect(w.lesson).toMatchObject({ index: 8, phase: 'card' });
  expect(w.player.mop).toBe(false);
  expect(w.messes).toHaveLength(0);
  expect(w.loose).toHaveLength(0);
  expect(w.player.stack).toHaveLength(0);

  // Lesson 8: the Office, then an Upgrade, with exactly the Money for both
  expect(w.money).toBe(30);
  playLesson(w, 8);
  expect(w.owned.has('office')).toBe(true);
  expect(Object.values(w.levels)).toEqual([1]);
  expect(w.money).toBe(0);
  finish(w);

  // Lesson 9: the suggested spot is legal; leaving Edit Layout without moving replays; any drop plus Done counts
  expect(w.lesson).toMatchObject({ index: 9, phase: 'card' });
  const spot = tutorialMap.lessons?.[9].steps[1].ghost?.spot;
  if (!spot) throw new Error('Lesson 9 has no suggested spot');
  expect(spotProblem(w, 'egg_shelf', spot)).toBeNull();
  step(w, { ...idle, lessonNext: true });
  step(w, { ...idle, ui: 'layoutOpen' });
  expect(lessonGhost(w)?.station).toBe('egg_shelf');
  step(w, { ...idle, ui: 'layoutClosed' });
  expect(w.events.map((e) => e.type)).toContain('lessonReplay');
  expect(w.lesson).toMatchObject({ index: 9, phase: 'play', step: 0 });
  expect(lessonGhost(w)).toBeNull();
  playLesson(w, 9);
  expect(w.stations.get('egg_shelf')?.box).toEqual(spot.box);
  expect(cutOff(w)).toBeNull();
  expect([w.movesUsed, w.money]).toEqual([1, 0]);
  finish(w);

  // Lesson 10: a Cashier and a Stocker with a job, exactly the Money for both
  expect(w.money).toBe(65);
  playLesson(w, 10);
  expect(w.cashiers).toHaveLength(1);
  expect(w.stockers.map((s) => s.role)).toEqual(['goods']);
  finish(w);

  // Lesson 11: nothing came by itself so far; now a Delivery, a Thief and the Inspector, one at a time
  expect(log.some((e) => ['deliveryArrived', 'thiefGrab', 'inspectorWarning'].includes(e.type))).toBe(false);
  playLesson(w, 11);
  expect(w.stats).toMatchObject({ deliveriesFull: 1, thievesCaught: 1, spotless: 1, badReviews: 0 });
  expect([w.thief, w.inspector, w.badReviewStreak]).toEqual([null, null, 0]);
  finish(w);

  // Lesson 12: close the store, reopen it once the wait is over
  playLesson(w, 12);
  expect([w.closed, w.stats.timesClosed]).toEqual([false, 1]);
  finish(w);

  // Lesson 13: the scripted Challenge sends 3 Customers; the Objective starts at 8/10
  expect(w.lesson).toMatchObject({ index: 13, phase: 'card' });
  expect(w.stats.sold.tomato).toBe(8);
  step(w, { ...idle, lessonNext: true });
  for (let i = 0; i < 5; i++) step(w, idle);
  expect(w.challenge).toMatchObject({ kind: 'checkout', goal: 3, time: 60, bonus: 60 });
  expect(w.customers).toHaveLength(3);
  // time up: the Lesson says so and replays its setup, with no harm done
  if (!w.challenge) throw new Error('no Challenge');
  w.challenge.t = w.challenge.time - 0.001;
  step(w, idle);
  expect(w.events.map((e) => e.type)).toEqual(expect.arrayContaining(['challengeFailed', 'lessonReplay']));
  expect(w.lesson).toMatchObject({ index: 13, phase: 'play', step: 0 });
  expect(w.customers).toHaveLength(0);
  expect(w.objectivesDone.size).toBe(0);
  playLesson(w, 13);
  expect(log.find((e) => e.type === 'challengeWon')).toMatchObject({ money: 60 });
  expect(w.objectivesDone.has('sell:tomato:10')).toBe(true);
  expect(w.stats).toMatchObject({ challengesWon: 1, challengesFailed: 1 });
  expect(w.score).toBeGreaterThanOrEqual(TUNING.score.objective + TUNING.score.challenge);
  finish(w);

  // Lesson 14: Area 2, the Completion jump, the Exit Pad, then the closing card
  const before = completion(w);
  playLesson(w, 14);
  expect(w.owned.has('area_2') && w.owned.has('exit')).toBe(true);
  expect(completion(w)).toBeGreaterThan(before);
  finish(w);
  expect(lessonCard(w, device)?.title).toBe('Tutorial complete');
  step(w, { ...idle, lessonNext: true });
  expect(w.events.map((e) => e.type)).toContain('tutorialDone');
  expect(w.lesson).toBeNull();

  // the economy takes over afterwards: Customers come on their own again
  for (let i = 0; i < 20 * 60; i++) step(w, idle);
  expect(w.customers.length).toBeGreaterThan(0);
});
