import { expect, test } from 'vitest';
import { tutorialMap } from '../../maps/tutorial';
import { createWorld, step, type Intents, type World } from './world';
import { lessonAim, lessonCard, lessonHud, lessonTarget } from './lessons';
import { moveIntent } from './bot';
import type { ProducerStation, ShelfStation } from './world';

const device = { touch: false, joystick: 'fixed' } as const;

/** Plays like a person following the arrow: Got it on cards, walk to the target, sprint where a Lesson asks. Stops at "Nice!". */
function playLesson(w: World, index: number, limit = 90): void {
  for (let i = 0; i < limit * 60; i++) {
    const L = w.lesson;
    if (!L || L.index > index || (L.index === index && L.phase === 'nice')) return;
    const intents: Intents = { move: { x: 0, z: 0 }, grab: false };
    if (L.phase === 'card') intents.lessonNext = true;
    const target = lessonTarget(w);
    if (target) intents.move = moveIntent(w, target) ?? intents.move;
    intents.sprint = (L.index === 1 && L.step === 1) || (L.index === 7 && L.step === 0);
    step(w, intents);
  }
  throw new Error(`Lesson ${index} never finished (step ${w.lesson?.step}, ${w.lesson?.phase})`);
}

/** Lets "Nice!" run out, on to the next card. */
const finish = (w: World): void => {
  for (let i = 0; i < 2 * 60; i++) step(w, { move: { x: 0, z: 0 }, grab: false });
};

const shelf = (w: World, id: string) => w.stations.get(id) as ShelfStation;

test('the Tutorial Map runs Lessons 0–7 from frozen cards to goals, scripted and never failed', () => {
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
  expect(w.lesson).toBeNull();
  expect(w.player.mop).toBe(false);
  expect(w.messes).toHaveLength(0);
  expect(w.loose).toHaveLength(0);
  expect(w.player.stack).toHaveLength(0);

  // the economy takes over afterwards: Customers come on their own again
  for (let i = 0; i < 20 * 60; i++) step(w, { move: { x: 0, z: 0 }, grab: false });
  expect(w.customers.length).toBeGreaterThan(0);
});
