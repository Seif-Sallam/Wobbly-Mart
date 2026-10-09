import { describe, expect, test } from 'vitest';
import { cornerShop } from '../../maps/corner-shop';
import { createWorld, step, type Intents } from './world';
import { completion, customerCap, own, padVisible, refreshFreeStations } from './economy';
import { moveIntent } from './bot';
import { snapshot } from './save';
import type { Customer, ShelfStation, World } from './world';
import { distToBox } from './geometry';
import { TUNING } from './tuning';

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

    // Completion counts bought Pads and Upgrade levels: 3 of 80
    expect(completion(w)).toBe(3 / 80);

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

const shelvesOf = (w: World, product: string): ShelfStation[] =>
  [...w.stations.values()].filter((s): s is ShelfStation => s.kind === 'shelf' && s.product === product);
const stock = (w: World, product: string, items: number) => shelvesOf(w, product).forEach((s) => (s.items = items));

/** Steps until a new Customer walks in, returning it. */
function nextCustomer(w: World): Customer {
  const seen = new Set(w.customers.map((c) => c.id));
  for (let i = 0; i < 60 * 30; i++) {
    step(w, idle());
    const c = w.customers.find((o) => !seen.has(o.id));
    if (c) return c;
  }
  throw new Error('No Customer arrived');
}

describe('Map 1 fully built', () => {
  test('two Shelves, patience, Messes, the Trash hold, Stack tipping and Stocker roles', () => {
    const w = createWorld(cornerShop, null, 5, true);
    for (const id of Object.keys(cornerShop.pads)) own(w, id, false);
    refreshFreeStations(w);
    const staff = w.stockers;
    w.stockers = [];
    const products = Object.keys(cornerShop.products);
    expect(products.every((p) => shelvesOf(w, p).length === 2)).toBe(true);

    // 1. A Customer heads for the fuller of a Product's two Shelves; on a tie, the nearer one
    for (const p of products) {
      const [a, b] = shelvesOf(w, p);
      a.items = 2;
      b.items = 5;
    }
    let c = nextCustomer(w);
    const first = c.list[0];
    expect(w.stations.get(first.shelf)?.kind === 'shelf' && w.stations.get(first.shelf)).toBe(
      shelvesOf(w, first.product)[1],
    );
    for (const p of products) stock(w, p, 3);
    c = nextCustomer(w);
    const [near, far] = shelvesOf(w, c.list[0].product).sort(
      (a, b) => distToBox(c.x, c.z, a.box) - distToBox(c.x, c.z, b.box),
    );
    expect(c.list[0].shelf).toBe(near.id);

    // … and, waiting at an empty one, walks over once its twin gets Items
    near.items = far.items = 0;
    for (let i = 0; i < 60 * 40 && c.patience === 0; i++) step(w, idle());
    expect(c.patience).toBeGreaterThan(0);
    expect(c.list[c.li].shelf).toBe(near.id);
    far.items = 4;
    step(w, idle());
    expect(c.list[c.li].shelf).toBe(far.id);

    // 2. A never-give-up Customer waits past 90 + 15 s, never angry, then finishes once stocked
    c.patienceLimit = Infinity;
    far.items = 0;
    run(w, 90 + 15 + 5);
    expect(w.customers).toContain(c);
    expect(c.state).toBe('shop');
    expect(c.angry).toBe(false);
    for (let i = 0; i < 60 * 60 && c.state === 'shop'; i++) {
      for (const e of c.list) stock(w, e.product, 10);
      step(w, idle());
    }
    expect(c.state).not.toBe('shop');

    // 3. A normal Customer's patience runs out → 15 s angry → their basket spills a Mess
    for (const p of products) stock(w, p, 10);
    const angry = nextCustomer(w);
    angry.patienceLimit = 45;
    angry.cart = ['tomato', 'egg'];
    const wanted = angry.list[angry.li].product;
    for (let i = 0; i < 60 * 90 && !angry.angry; i++) {
      stock(w, wanted, 0);
      step(w, idle());
    }
    expect(angry.angry).toBe(true);
    expect(angry.state).toBe('shop');
    for (let i = 0; i < 60 * (TUNING.patienceLeave + 1) && angry.state === 'shop'; i++) {
      stock(w, wanted, 0);
      step(w, idle());
    }
    expect(angry.state).toBe('leave');
    const mess = w.messes.find((m) => m.items.join() === 'tomato,egg');
    expect(mess).toBeDefined();

    // the Player clears it by walking over it, then trashes Items only after standing on the Trash Bin for 1.5 s
    walk(w, [mess?.x ?? 0, mess?.z ?? 0], 40);
    expect(w.messes).not.toContain(mess);
    w.player.stack = ['wheat', 'wheat'];
    walk(w, 'trash', 40);
    run(w, 1);
    expect(w.player.stack.length).toBe(2);
    run(w, 1);
    expect(w.player.stack.length).toBeLessThan(2);
    w.customers = [];
    w.arrivalTimer = Infinity;

    // 4. Above the safe count the top Item tips off behind the Player: an egg breaks into a 1-Item Mess …
    const shuttle = (seconds: number, sprint: boolean, until = () => false) => {
      let i = 0;
      for (; i < seconds * 60 && !until(); i++)
        step(w, { move: { x: Math.floor(i / 60) % 2 ? 1 : -1, z: 0 }, grab: false, sprint });
      return i / 60;
    };
    const { egg, wheat } = cornerShop.products;
    w.map = {
      ...w.map,
      products: { ...w.map.products, egg: { ...egg, breakChance: 1 }, wheat: { ...wheat, breakChance: 0 } },
    };
    walk(w, [26, 16], 40);
    w.player.stack = [...Array(7).fill('tomato'), 'egg'];
    const nextId = w.nextId;
    shuttle(60, true, () => w.player.stack.length < 8);
    expect(w.player.stack.length).toBe(7);
    expect(w.loose.length).toBe(0);
    const broken = w.messes.find((m) => m.id >= nextId);
    expect(broken?.items).toEqual(['egg']);
    expect(Math.hypot((broken?.x ?? 0) - w.player.x, (broken?.z ?? 0) - w.player.z)).toBeGreaterThan(1);

    // … while unbreakable wheat lands as a Loose Item, not a Mess: nobody is slowed by it
    w.player.stack = [...Array(7).fill('tomato'), 'wheat'];
    const messes = w.messes.length;
    shuttle(60, true, () => w.player.stack.length < 8);
    expect(w.loose.length).toBe(1);
    const [loose] = w.loose;
    expect(loose.product).toBe('wheat');
    expect(w.player.stack.length).toBe(7);
    expect(Math.hypot(loose.x - w.player.x, loose.z - w.player.z)).toBeGreaterThan(1);
    expect(w.messes.length).toBe(messes);

    // with a full Stack the Player walks over it; with room, takes it back
    w.player.stack.push('tomato');
    walk(w, [loose.x, loose.z]);
    expect(w.loose.length).toBe(1);
    w.player.stack.pop();
    run(w, 0.1);
    expect(w.loose.length).toBe(0);
    expect(w.player.stack.at(-1)).toBe('wheat');

    // walking tips too, only less often; standing still never does
    w.player.stack = Array(8).fill('wheat');
    run(w, 30);
    expect(w.player.stack.length).toBe(8);
    const walked = shuttle(600, false, () => w.player.stack.length < 8);
    expect(w.player.stack.length).toBe(7);
    expect(walked).toBeGreaterThan(5);

    // at or below the safe count nothing drops, and Steady hands raises the safe count
    w.loose = [];
    w.player.stack = Array(3).fill('tomato');
    shuttle(30, true);
    w.levels.steady_hands = 3;
    w.player.stack = Array(6).fill('tomato');
    shuttle(30, true);
    expect(w.loose.length).toBe(0);
    expect(w.player.stack.length).toBe(6);

    // 5. A Goods Stocker only fills Shelves, a Machines Stocker only Animal and Machine inputs; neither covers the other
    w.player.stack = [];
    w.stockers = staff.slice(0, 2);
    const [goods, machines] = w.stockers;
    goods.role = 'goods';
    machines.role = 'machines';
    const fillInputs = () => {
      for (const st of w.stations.values()) {
        if (st.kind !== 'producer') continue;
        const type = w.map.producers[st.type];
        for (const p of type.inputs) st.input[p] = type.inputCap ?? 0;
        if (type.inputs.length) st.tray = type.trayCap ?? 0; // a full output stops Machines eating their inputs
      }
    };
    for (const p of products) stock(w, p, 10);
    stock(w, 'tomato', 0);
    const sinks = { goods: new Set<string>(), machines: new Set<string>() };
    const watch = (seconds: number, refill: () => void) => {
      for (let i = 0; i < seconds * 60; i++) {
        refill();
        step(w, idle());
        if (goods.job) sinks.goods.add(w.stations.get(goods.job.sink)?.kind ?? '');
        if (machines.job) sinks.machines.add(w.stations.get(machines.job.sink)?.kind ?? '');
      }
    };
    watch(20, fillInputs);
    expect([...sinks.goods]).toEqual(['shelf']);
    expect(sinks.machines.size).toBe(0);
    expect(shelvesOf(w, 'tomato').some((s) => s.items > 0)).toBe(true);

    for (const p of products) stock(w, p, 10);
    sinks.goods.clear();
    const coop = w.stations.get('chicken_coop');
    if (coop?.kind === 'producer') coop.input.tomato = 0;
    watch(20, () => {
      for (const p of products) stock(w, p, 10);
    });
    expect(sinks.goods.has('producer')).toBe(false); // it may finish a Shelf job, never take a Machine one
    expect([...sinks.machines]).toEqual(['producer']);
  });
});
