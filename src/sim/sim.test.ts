import { describe, expect, test } from 'vitest';
import { cornerShop } from '../../maps/corner-shop';
import { createWorld, step, type Intents } from './world';
import { completion, customerCap, padVisible } from './economy';
import { moveIntent } from './bot';
import { snapshot } from './save';
import type { World } from './world';

const idle = (): Intents => ({ move: { x: 0, z: 0 }, grab: false });

function run(w: World, seconds: number, intents: (w: World) => Intents = idle): void {
  for (let i = 0; i < seconds * 60; i++) step(w, intents(w));
}

/** Walks the Player to a point or a Station, giving up after `limit` seconds. */
function walk(w: World, target: string | [number, number], limit = 20): void {
  for (let i = 0; i < limit * 60; i++) {
    const move = moveIntent(w, target);
    if (!move) return;
    step(w, { move, grab: false });
  }
  throw new Error(`Player never reached ${String(target)} (at ${w.player.x.toFixed(1)}, ${w.player.z.toFixed(1)})`);
}

const padCentre = (w: World, id: string): [number, number] => {
  const [x, z, bw, bd] = w.map.layout.places[id].box;
  return [x + bw / 2, z + bd / 2];
};

function buy(w: World, id: string): void {
  expect(padVisible(w, id)).toBe(true);
  walk(w, padCentre(w, id));
  run(w, 2);
  expect(w.owned.has(id)).toBe(true);
}

describe('Map 1 opening loop', () => {
  test('buy, grow, stock, sell, collect — the first minute of the game', () => {
    const w = createWorld(cornerShop, null, 1);
    expect(w.money).toBe(50);
    expect(w.pan?.area).toBe('area_1');

    // Area Pan blocks movement
    const before = w.player.x;
    run(w, 1, () => ({ move: { x: 1, z: 0 }, grab: false }));
    expect(w.player.x).toBe(before);
    run(w, 1.5);
    expect(w.pan).toBeNull();

    // Only the Register Pad is revealed at the start; the rest open one at a time
    expect(padVisible(w, 'register')).toBe(true);
    expect(padVisible(w, 'tomato_shelf')).toBe(false);

    // Standing on a Pad drains Money in ~1.5 s
    walk(w, padCentre(w, 'register'));
    run(w, 0.75);
    expect(w.owned.has('register')).toBe(false);
    expect(w.paid.register).toBeGreaterThan(3);
    run(w, 1);
    expect(w.owned.has('register')).toBe(true);
    expect(w.money).toBeCloseTo(40);
    expect(w.events.some((e) => e.type === 'padBought' && e.pad === 'register')).toBe(false); // events are per step

    // Walking off keeps a partial payment
    walk(w, padCentre(w, 'tomato_shelf'));
    run(w, 0.3);
    walk(w, [12, 14]);
    const partial = w.paid.tomato_shelf;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(15);
    run(w, 1);
    expect(w.paid.tomato_shelf).toBe(partial);
    buy(w, 'tomato_shelf');
    buy(w, 'tomato_bed');
    expect(w.money).toBe(0);
    expect(customerCap(w)).toBe(3);

    // No Customers before the first shelved Item
    run(w, 7);
    expect(w.customers.length).toBe(0);

    // Crops ripen, picking fills the Stack, the Shelf takes only matching Items
    walk(w, 'tomato_bed');
    run(w, 2);
    expect(w.player.stack.length).toBe(4);
    expect(w.player.stack.every((p) => p === 'tomato')).toBe(true);
    walk(w, 'tomato_shelf');
    run(w, 2);
    const shelf = w.stations.get('tomato_shelf');
    expect(shelf?.kind === 'shelf' && shelf.items).toBe(4);
    expect(w.player.stack.length).toBe(0);

    // Customers arrive, shop and queue; the Player checks them out at the Register
    run(w, 4);
    expect(w.customers.length).toBeGreaterThan(0);
    walk(w, 'register');
    let paid = 0;
    for (let i = 0; i < 60 * 40 && paid === 0; i++) {
      step(w, idle());
      paid += w.events.filter((e) => e.type === 'paid').length;
    }
    expect(paid).toBe(1);
    const register = w.stations.get('register');
    expect(register?.kind === 'register' && register.cash).toBeGreaterThan(0);
    expect(w.money).toBe(0);

    // Walking over the Cash Pile drains it into Money over ~1 s
    const cash = register?.kind === 'register' ? register.cash : 0;
    walk(w, 'cash:register');
    run(w, 1.2);
    expect(w.money).toBeCloseTo(cash);

    // Completion counts bought Pads and Upgrade levels: 3 of 79
    expect(completion(w)).toBe(3 / 79);

    // The tutorial follows along without blocking anything
    expect(w.tutorial.done).toBe(false);
  });

  test('a save keeps purchases and money, and a reload is a fresh Opening', () => {
    const w = createWorld(cornerShop, null, 2);
    run(w, 2.5);
    walk(w, padCentre(w, 'register'));
    run(w, 2);
    const register = w.stations.get('register');
    if (register?.kind === 'register') register.cash = 12;
    w.paid.tomato_shelf = 5;

    const save = snapshot(w);
    expect(save.money).toBeCloseTo(52);
    expect(save.owned).toEqual(['area_1', 'register']);

    const reloaded = createWorld(cornerShop, save, 3);
    expect(reloaded.money).toBeCloseTo(52);
    expect(reloaded.owned.has('register')).toBe(true);
    expect(reloaded.paid.tomato_shelf).toBe(5);
    expect(reloaded.customers.length).toBe(0);
    expect(reloaded.pan).toBeNull();
    const reg = reloaded.stations.get('register');
    expect(reg?.kind === 'register' && reg.cash).toBe(0);

    // Content changes need no migration: unknown ids dropped, overpaid Pads count as bought
    const odd = createWorld(cornerShop, { ...save, owned: [...save.owned, 'gone_pad'], paid: { tomato_shelf: 99 } }, 4);
    expect(odd.owned.has('gone_pad')).toBe(false);
    expect(odd.owned.has('tomato_shelf')).toBe(true);
  });
});
