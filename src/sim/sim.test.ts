import { describe, expect, test } from 'vitest';
import { cornerShop } from '../../maps/corner-shop';
import { createWorld, DT, step, type Intents } from './world';
import { completion, customerCap, own, padVisible, refreshFreeStations, visiblePads } from './economy';
import { moveIntent } from './bot';
import { snapshot } from './save';
import type { Customer, PickupStation, ProducerStation, ShelfStation, SimEvent, World } from './world';
import { distToBox } from './geometry';
import { TUNING } from './tuning';
import { addMess, messSlowdown } from './cleaning';
import { canPayMoves, cutOff, moveBill, movesLeft, nextRot, payMoves, place, spotProblem, turned } from './layout';
import { rebuildNav } from './walk';
import { boxCentre, frontDir } from './geometry';
import type { Box, Placement } from './map';

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

    // Completion counts bought Pads and Upgrade levels: 3 of 83
    expect(completion(w)).toBe(3 / 83);

    // The tutorial follows along without blocking anything
    expect(w.tutorial.done).toBe(false);

    // Buying the Blender while standing right of its Pad's centre, by the locked Area's edge, doesn't trap the Player
    while (!padVisible(w, 'blender')) own(w, visiblePads(w)[0], false);
    w.money = 100;
    Object.assign(w.player, { x: 18.7, z: 19.8, vx: 0, vz: 0, stack: [] });
    run(w, 3);
    expect(w.owned.has('blender')).toBe(true);
    walk(w, 'tomato_shelf');
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
const producerAt = (w: World, id: string): ProducerStation => {
  const st = w.stations.get(id);
  if (st?.kind !== 'producer') throw new Error(`${id} is not a bought Producer`);
  return st;
};

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
  test('two Shelves, patience, Messes and the Mop, the Trash hold, Stack tipping, Stocker roles and priorities, everything at once', () => {
    const w = createWorld(cornerShop, null, 5, true);
    w.map.events = {}; // Deliveries have their own test
    for (const id of Object.keys(cornerShop.pads)) own(w, id, false);
    refreshFreeStations(w);
    const staff = w.stockers;
    const [cleaner] = w.cleaners;
    w.stockers = [];
    w.cleaners = [];
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

    // a waiting Mess underfoot drains patience 1.5× faster
    let before = angry.patience;
    step(w, idle());
    const calm = angry.patience - before;
    const underfoot = w.nextId++;
    addMess(w, underfoot, angry.x, angry.z, [], -1);
    before = angry.patience;
    step(w, idle());
    expect(angry.patience - before).toBeCloseTo(calm * TUNING.messPatience);
    w.messes = w.messes.filter((m) => m.id !== underfoot);
    for (let i = 0; i < 60 * (TUNING.patienceLeave + 1) && angry.state === 'shop'; i++) {
      stock(w, wanted, 0);
      step(w, idle());
    }
    expect(angry.state).toBe('leave');
    const mess = w.messes.find((m) => m.items.join() === 'tomato,egg');
    expect(mess).toBeDefined();

    // walking over it no longer cleans it: that needs the Mop, which the Mop Stand gives only to an empty Stack
    const spill: [number, number] = [mess?.x ?? 0, mess?.z ?? 0];
    // the Mop Stand backs onto the Office partition: reach it from inside the room
    const toMop = () => {
      walk(w, [10, 21], 40);
      walk(w, 'mop_stand', 40);
    };
    walk(w, spill, 40);
    run(w, 3);
    expect(w.messes).toContain(mess);
    expect(messSlowdown(w, w.player)).toBe(TUNING.messSlowdownStaff); // and it slows whoever walks through
    w.player.stack = ['wheat'];
    toMop();
    expect(w.player.mop).toBe(false);
    walk(w, spill, 40);
    w.player.stack = [];
    toMop();
    expect(w.player.mop).toBe(true);

    // 2 s of mopping clears it; walking off keeps the progress
    walk(w, spill, 40);
    run(w, 0.5);
    const part = mess?.progress ?? 0;
    expect(part).toBeGreaterThan(0.2);
    expect(part).toBeLessThan(1);
    toMop();
    expect(w.player.mop).toBe(false); // walking back to the stand returns it
    const kept = mess?.progress ?? 0;
    expect(kept).toBeGreaterThanOrEqual(part);
    expect(w.messes).toContain(mess);
    toMop(); // walking off and back takes it again
    expect(w.player.mop).toBe(true);
    walk(w, spill, 40);
    run(w, 2 * (1 - kept));
    expect(w.messes).not.toContain(mess);

    // the Mop speed Upgrade's top level halves it to 1 s
    w.levels.mop_speed = 2;
    const quick = w.nextId++;
    addMess(w, quick, w.player.x, w.player.z, ['milk'], -1);
    run(w, 0.8);
    expect(w.messes.some((m) => m.id === quick)).toBe(true);
    run(w, 0.3);
    expect(w.messes.some((m) => m.id === quick)).toBe(false);
    w.levels.mop_speed = 0;

    // with the Mop in hand nothing is picked up, not even a Loose Item underfoot
    const dropped = { id: w.nextId++, x: w.player.x, z: w.player.z, product: 'egg' };
    w.loose.push(dropped);
    run(w, 0.5);
    expect(w.player.stack).toEqual([]);
    toMop();
    expect(w.player.mop).toBe(false);
    walk(w, [dropped.x, dropped.z], 40);
    run(w, 0.2);
    expect(w.player.stack).toEqual(['egg']);

    // the Player trashes Items only after standing on the Trash Bin for 1.5 s
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

    // 5. A Goods Stocker only fills Shelves (and car orders), a Machines Stocker only Animal and Machine inputs
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
    expect(sinks.goods.has('shelf')).toBe(true);
    expect([...sinks.goods].every((k) => k === 'shelf' || k === 'pickup')).toBe(true);
    expect(sinks.machines.size).toBe(0);
    expect(shelvesOf(w, 'tomato').some((s) => s.items > 0)).toBe(true);

    // eggs are wanted, so the Machines Stocker feeds the empty Coop; the Goods Stocker never takes a Machine job
    const coop = producerAt(w, 'chicken_coop');
    coop.input.tomato = coop.tray = 0;
    sinks.goods.clear();
    watch(20, () => {
      for (const p of products) stock(w, p, p === 'egg' ? 3 : 10);
    });
    expect(sinks.goods.has('producer')).toBe(false); // it may finish a Shelf job, never take a Machine one
    expect([...sinks.machines]).toEqual(['producer']);

    // 6. The Oven full of eggs and no flour: an Auto Stocker holding an egg fetches flour instead of freezing
    const [auto] = w.stockers;
    w.stockers = [auto];
    Object.assign(auto, { role: 'auto', job: null, stack: ['egg'], leftover: null });
    fillInputs();
    for (const p of products) stock(w, p, p === 'bread' ? 0 : 10);
    const oven = producerAt(w, 'oven');
    Object.assign(oven, { input: { egg: 4, flour: 0 }, tray: 0, work: 0 });
    producerAt(w, 'mill').tray = 4;
    let held = 0;
    let maxHeld = 0;
    let flourAt = -1;
    const follow = (seconds: number) => {
      for (let i = 0; i < seconds * 60; i++) {
        step(w, idle());
        held = auto.stack.length && !auto.job ? held + DT : 0;
        maxHeld = Math.max(maxHeld, held);
        const flour = w.events.some((e) => e.type === 'transfer' && e.product === 'flour' && 'station' in e.to);
        if (flour && flourAt < 0) flourAt = i / 60;
      }
    };
    follow(60);
    expect(flourAt).toBeGreaterThan(0);
    expect(flourAt).toBeLessThan(30);
    expect(maxHeld).toBeLessThan(12);

    // leftovers nothing needs go back on a Tray with room after 10 s, or in the Trash if no Tray takes them
    fillInputs();
    for (const p of products) stock(w, p, 10);
    Object.assign(coop, { input: { tomato: 0 }, tray: 0, work: 0 });
    auto.stack = ['egg', 'egg', 'tomato'];
    auto.job = null;
    let trashed: string[] = [];
    for (let i = 0; i < 60 * 30 && auto.stack.length; i++) {
      step(w, idle());
      held = auto.stack.length && !auto.job ? held + DT : 0;
      maxHeld = Math.max(maxHeld, held);
      for (const e of w.events) if (e.type === 'trashed') trashed = [...trashed, e.product];
    }
    expect(auto.stack).toEqual([]);
    expect(coop.tray).toBe(2);
    expect(trashed).toEqual(['tomato']);
    expect(w.loose.length).toBe(0);
    expect(maxHeld).toBeLessThan(12);

    // walking tips a Stocker's Stack like the Player's: above the safe count of 3 it drops now and then, never below
    const shuttleStocker = (seconds: number): number => {
      let drops = 0;
      let leg = 0;
      for (let i = 0; i < seconds * 60; i++) {
        auto.job ??= { sink: leg++ % 2 ? 'tomato_shelf' : 'milk_fridge', source: null, product: 'bread', need: 0 };
        step(w, idle());
        for (const e of w.events)
          if ((e.type === 'transfer' && 'agent' in e.from && e.from.agent === 'stocker') || e.type === 'mess') drops++;
      }
      return drops;
    };
    w.messes = [];
    w.loose = [];
    Object.assign(auto, { job: null, stack: Array(6).fill('bread'), leftover: null });
    expect(shuttleStocker(300)).toBeGreaterThan(0);
    expect(auto.stack.length).toBeGreaterThanOrEqual(3);
    expect(w.loose.length + w.messes.length).toBe(6 - auto.stack.length);
    auto.stack = Array(3).fill('bread');
    expect(shuttleStocker(120)).toBe(0);
    w.loose = [];

    // 7. The Cleaner clears every waiting Mess, then wanders the shop floor mopping for show …
    w.stockers = [];
    w.cleaners = [cleaner];
    for (let i = 0; i < 60 * 120 && w.messes.length; i++) step(w, idle());
    expect(w.messes.length).toBe(0);
    const start: [number, number] = [cleaner.x, cleaner.z];
    let shows = 0;
    for (let i = 0; i < 60 * 30; i++) {
      step(w, idle());
      if (cleaner.mopping) shows++;
    }
    expect(Math.hypot(cleaner.x - start[0], cleaner.z - start[1])).toBeGreaterThan(1);
    expect(shows).toBeGreaterThan(0);

    // … and rushes to a new Mess at 4 m/s, mopping it in 1.5 × the Player's 2 s
    addMess(w, w.nextId++, cleaner.x + 2, cleaner.z, ['milk'], -1);
    let took = 0;
    while (w.messes.length && took < 20) {
      step(w, idle());
      took += DT;
    }
    expect(w.messes.length).toBe(0);
    expect(took).toBeGreaterThan(3);
    expect(took).toBeLessThan(5);

    // 8. Everything at once for 20 min, the Player idle: Staff fill car orders, every Event plays out, the Cleaner keeps up
    w.map.events = cornerShop.events;
    w.stockers = staff;
    for (const s of staff) Object.assign(s, { role: 'auto', job: null, stack: [], leftover: null });
    w.arrivalTimer = 0;
    const seen: Record<string, number> = {};
    let maxMesses = 0;
    for (let i = 0; i < 60 * 60 * 20; i++) {
      step(w, idle());
      for (const e of w.events) {
        const done = e.type === 'deliveryDone' && e.complete ? 'deliveryFilled' : e.type;
        seen[done] = (seen[done] ?? 0) + 1;
      }
      maxMesses = Math.max(maxMesses, w.messes.length);
    }
    expect(seen.deliveryFilled).toBeGreaterThan(0);
    expect(seen.robberyDone).toBeGreaterThan(0);
    expect(seen.inspection).toBeGreaterThan(0);
    expect(seen.paid).toBeGreaterThan(50);
    expect(maxMesses).toBeLessThan(5);
  });
});

describe('Deliveries', () => {
  test('cars come after the quiet start, take only wanted Items, pay 1.5× plus a tip or plain price on timeout; Stockers fill them', () => {
    const w = createWorld(cornerShop, null, 7, true);
    for (const id of ['register', 'tomato_shelf', 'tomato_bed', 'egg_shelf', 'chicken_coop']) own(w, id, false);
    refreshFreeStations(w);
    const cars = () => [...w.stations.values()].filter((s): s is PickupStation => s.kind === 'pickup');
    expect(cars().length).toBe(3);
    let maxParked = 0;
    const tick = () => {
      step(w, idle());
      maxParked = Math.max(maxParked, cars().filter((s) => s.delivery).length);
    };
    const until = (seconds: number, done: (e: SimEvent) => boolean): SimEvent | undefined => {
      for (let i = 0; i < seconds * 60; i++) {
        tick();
        const e = w.events.find(done);
        if (e) return e;
      }
    };
    const standAt = (st: PickupStation) => {
      const [x, , bw] = st.box;
      Object.assign(w.player, { x: x + bw / 2, z: 51.5, vx: 0, vz: 0 });
    };

    // nothing parks in the first 3 min; then a car every 3–4 min
    expect(until(300, (e) => e.type === 'deliveryArrived')).toBeDefined();
    expect(w.t).toBeGreaterThanOrEqual(180);
    expect(w.t).toBeLessThanOrEqual(241);

    // the order: 1–3 Products on sale, the same count each, 3–6 Items with one Area; 90 s + 10 s per Item
    const car = cars().find((s) => s.delivery) as PickupStation;
    const order = car.delivery?.order ?? [];
    const items = order.reduce((n, l) => n + l.want, 0);
    expect(items).toBeGreaterThanOrEqual(3);
    expect(items).toBeLessThanOrEqual(6);
    expect(order.every((l) => ['tomato', 'egg'].includes(l.product) && l.want === order[0].want)).toBe(true);
    expect(car.delivery?.time).toBe(90 + 10 * items);

    // standing on the pickup tile drains only the wanted Items; a fast full order pays 1.5× and a tip
    w.player.stack = ['wheat', ...order.flatMap((l) => Array<string>(l.want).fill(l.product))];
    standAt(car);
    const money = w.money;
    const done = until(10, (e) => e.type === 'deliveryDone');
    expect(w.player.stack).toEqual(['wheat']);
    const value = order.reduce((n, l) => n + l.want * w.map.products[l.product].price, 0);
    expect(done?.type === 'deliveryDone' && done.complete).toBe(true);
    const paid = done?.type === 'deliveryDone' ? done : { amount: 0, tip: 0 };
    expect(paid.amount).toBe(Math.round(value * 1.5));
    expect(paid.tip).toBeGreaterThan(0);
    expect(paid.tip).toBeLessThanOrEqual(Math.round(paid.amount * 0.25));
    expect(w.money).toBe(money + paid.amount + paid.tip);
    expect(car.delivery).toBeNull();

    // a partial order waits, honks at 15 s left, then pays plain Sale Price for what it got
    for (let i = 0; i < 60 * 300 && !cars().some((s) => s.delivery); i++) tick();
    const late = cars().find((s) => s.delivery) as PickupStation;
    const line = late.delivery?.order[0] ?? { product: '', want: 0 };
    w.player.stack = [line.product];
    standAt(late);
    expect(until(200, (e) => e.type === 'deliveryHonk' && e.station === late.id)).toBeDefined();
    const left = until(20, (e) => e.type === 'deliveryDone' && e.station === late.id);
    expect(left?.type === 'deliveryDone' && left.amount).toBe(w.map.products[line.product].price);
    expect(left?.type === 'deliveryDone' && !left.complete && left.tip === 0).toBe(true);
    expect(maxParked).toBe(1); // no Stockers: one car at a time

    // a Goods Stocker fills an order by itself while the Shelves stay full
    w.player.stack = [];
    Object.assign(w.player, { x: 8, z: 16 });
    own(w, 'area_2', false);
    own(w, 'stocker_1', false);
    const [stocker] = w.stockers;
    stocker.role = 'goods';
    const coop = producerAt(w, 'chicken_coop');
    const bed = producerAt(w, 'tomato_bed');
    let filled: SimEvent | undefined;
    for (let i = 0; i < 60 * 600 && !filled; i++) {
      stock(w, 'tomato', 10);
      stock(w, 'egg', 10);
      coop.tray = 4;
      bed.plants.fill(0);
      tick();
      filled = w.events.find((e) => e.type === 'deliveryDone' && e.complete);
    }
    expect(filled).toBeDefined();
    expect(maxParked).toBeLessThanOrEqual(2); // one Stocker: a second car may come

    // three Stockers: now and then a car follows soon after the last (before the usual 3 min), never every time
    own(w, 'stocker_3', false);
    own(w, 'stocker_4', false);
    maxParked = 0;
    const arrivals: number[] = [];
    for (let i = 0; i < 60 * 3600; i++) {
      tick();
      if (w.events.some((e) => e.type === 'deliveryArrived')) arrivals.push(w.t);
    }
    const soon = arrivals.filter((t, i) => i > 0 && t - arrivals[i - 1] < 180).length;
    expect(arrivals.length).toBeGreaterThan(10);
    expect(soon).toBeGreaterThan(0);
    expect(soon).toBeLessThan(arrivals.length / 2);
    expect(maxParked).toBeLessThanOrEqual(3);
  });
});

const inspectorOf = (w: World): NonNullable<World['inspector']> => w.inspector as NonNullable<World['inspector']>;

describe('Robbery and the Health Inspector', () => {
  test('a Thief grabs and freezes the game, is caught or escapes; the Inspector warns, is escorted or left alone, then scores', () => {
    const w = createWorld(cornerShop, null, 11, true);
    for (const id of ['register', 'tomato_shelf', 'tomato_bed', 'egg_shelf', 'chicken_coop', 'area_2'])
      own(w, id, false);
    refreshFreeStations(w);
    const events = cornerShop.events;
    w.map.events = { robbery: events.robbery };
    w.money = 1000;
    const tomato = w.stations.get('tomato_shelf') as ShelfStation;
    const egg = w.stations.get('egg_shelf') as ShelfStation;
    const register = w.stations.get('register');
    const stocked = () => {
      tomato.items = 9;
      egg.items = 3;
    };
    const far = () => Object.assign(w.player, { x: 8, z: 40, vx: 0, vz: 0 });
    const until = (seconds: number, done: (e: SimEvent) => boolean, each = () => {}) => {
      for (let i = 0; i < seconds * 60; i++) {
        each();
        step(w, idle());
        const e = w.events.find(done);
        if (e) return e;
      }
    };
    far();

    // 1. The first Robbery comes 3–5 min in: the Thief walks to the fullest Shelf, and the grab freezes the game
    expect(until(310, (e) => e.type === 'thiefGrab', stocked)).toBeDefined();
    expect(w.t).toBeGreaterThanOrEqual(180);
    expect(w.thief?.target).toBe('tomato_shelf');
    const frozenAt = w.t;
    run(w, 0.5);
    expect(w.t).toBe(frozenAt);
    for (let i = 0; i < 60 * 5 && w.thief?.state === 'grab'; i++) step(w, idle());
    expect(w.thief?.state).toBe('run');
    expect(w.thief?.carry).toEqual(Array(5).fill('tomato'));

    // 2. Caught: the bounty, and the Items go back onto their Shelf; restocked meanwhile, the rest lie Loose beside it
    tomato.items = 7;
    const money = w.money;
    const th = w.thief as NonNullable<World['thief']>;
    Object.assign(w.player, { x: th.x, z: th.z });
    const caught = until(1, (e) => e.type === 'robberyDone');
    expect(caught?.type === 'robberyDone' && caught.caught && caught.amount).toBe(40);
    expect(w.money).toBe(money + 40);
    expect(tomato.items).toBe(10);
    expect(w.loose.length).toBe(2);
    far();
    expect(until(60, () => !w.thief)).toBeUndefined();
    expect(w.thief).toBeNull();

    // 3. A Cash Pile over $150 is robbed of half instead; the Thief escapes through a door with it
    w.loose = [];
    if (register?.kind === 'register') register.cash = 300;
    w.visitWait = 0;
    expect(until(60, (e) => e.type === 'thiefGrab', stocked)).toBeDefined();
    expect(w.thief?.target).toBe('register');
    expect(register?.kind === 'register' && register.cash).toBe(150);
    const away = until(60, (e) => e.type === 'robberyDone', far);
    expect(away?.type === 'robberyDone' && !away.caught && away.amount).toBe(150);
    for (let i = 0; i < 60 * 60 && w.thief; i++) step(w, idle());

    // 4. An empty store: no Thief comes
    tomato.items = egg.items = 0;
    if (register?.kind === 'register') register.cash = 0;
    w.visitWait = 0;
    step(w, idle());
    expect(w.thief).toBeNull();

    // 5. The Inspector: a 15 s warning, then in through a door; escorted, the alone clock drains back; spotless pays
    for (const id of ['office', 'ketchup_shelf', 'blender', 'wheat_shelf', 'milk_fridge']) own(w, id, false);
    w.map.events = { inspector: events.inspector };
    w.visitWait = 0;
    expect(until(1, (e) => e.type === 'inspectorWarning', stocked)).toBeDefined();
    const ins = w.inspector as NonNullable<World['inspector']>;
    expect(ins.stops.length).toBeGreaterThanOrEqual(4);
    expect(ins.stops.length).toBeLessThanOrEqual(6);
    run(w, 14);
    expect(ins.state).toBe('warn');
    for (let i = 0; i < 60 * 30 && ins.state !== 'visit'; i++) step(w, idle());
    expect(ins.state).toBe('visit');
    const escort = () => {
      stocked();
      Object.assign(w.player, { x: ins.x + 1, z: ins.z, vx: 0, vz: 0 });
    };
    until(5, () => false, far);
    expect(ins.alone).toBeGreaterThan(4);
    until(5, () => false, escort);
    expect(ins.alone).toBeCloseTo(0);
    let marks = 0;
    const spotless = until(
      120,
      (e) => {
        if (e.type === 'inspectorMark') marks++;
        return e.type === 'inspection';
      },
      escort,
    );
    expect(marks).toBe(ins.stops.length);
    const reward = spotless?.type === 'inspection' ? spotless.amount : 0;
    expect(spotless?.type === 'inspection' && !spotless.review).toBe(true);
    expect(reward).toBeGreaterThanOrEqual(100);
    expect(reward).toBeLessThanOrEqual(200);
    for (let i = 0; i < 60 * 60 && w.inspector; i++) step(w, idle());

    // 6. Escorted with dirt: $20 per Mess and Loose Item
    addMess(w, w.nextId++, 30, 40, ['milk'], -1);
    addMess(w, w.nextId++, 32, 40, ['milk'], -1);
    w.loose.push({ id: w.nextId++, x: 34, z: 40, product: 'egg' });
    w.visitWait = 0;
    step(w, idle());
    const second = w.inspector as NonNullable<World['inspector']>;
    const dirty = until(
      150,
      (e) => e.type === 'inspection',
      () => {
        stocked();
        Object.assign(w.player, { x: second.x + 1, z: second.z });
      },
    );
    expect(dirty?.type === 'inspection' && [dirty.messes, dirty.loose, dirty.amount]).toEqual([2, 1, -60]);
    for (let i = 0; i < 60 * 60 && w.inspector; i++) step(w, idle());

    // 7. Left alone 15 s: BAD REVIEW, the dirt fine plus $150, even when spotless
    w.messes = [];
    w.loose = [];
    w.visitWait = 0;
    const before = w.money;
    const bad = until(
      60,
      (e) => e.type === 'inspection',
      () => {
        stocked();
        far();
      },
    );
    expect(bad?.type === 'inspection' && bad.review && bad.amount).toBe(-150);
    expect(w.money).toBe(before - 150);
    step(w, idle());
    const stormer = w.inspector as NonNullable<World['inspector']>;
    expect(Math.hypot(stormer.vx, stormer.vz)).toBeCloseTo(TUNING.events.inspector.stormSpeed); // storms out

    // they step around a Mess in their way, so they're never seen standing in one far from a stop
    w.inspector = null;
    w.visitWait = 0;
    step(w, idle());
    const walker = inspectorOf(w);
    addMess(w, w.nextId++, (walker.x + walker.door[0]) / 2, (walker.z + walker.door[1]) / 2, ['milk'], -1);
    let inMess = 0;
    let closest = Infinity;
    for (let i = 0; i < 60 * 40; i++) {
      Object.assign(w.player, { x: walker.x + 1, z: walker.z });
      step(w, idle());
      const m = w.messes[0];
      const d = m ? Math.hypot(walker.x - m.x, walker.z - m.z) : Infinity;
      closest = Math.min(closest, d);
      if (d < TUNING.messRadius - 1e-6) inMess++;
    }
    expect(walker.state).toBe('visit');
    expect(closest).toBeLessThan(TUNING.messRadius + 0.2); // it came right past the Mess …
    expect(inMess).toBe(0); // … and around it
  });
});

describe('Edit Layout', () => {
  test('Moves: where fixtures may go, the Register carries its Cashier, Moves cost money, the layout saves', () => {
    const w = createWorld(cornerShop, null, 7, true);
    for (const id of Object.keys(cornerShop.pads)) own(w, id, false);
    refreshFreeStations(w);
    rebuildNav(w);
    w.money = 10_000;
    const shelf = w.stations.get('egg_shelf');
    if (shelf?.kind !== 'shelf') throw new Error('egg_shelf not bought');
    shelf.items = 4;
    const home: Placement = { box: [...shelf.box], rot: shelf.rot };

    // scanning the floor at 0.5 m finds valid spots and every kind of reason why a spot is red
    const reasons = new Map<string, Placement>();
    const valid: Placement[] = [];
    const [W, H] = w.map.layout.size;
    for (let x = 0; x < W; x += 0.5)
      for (let z = 0; z < H; z += 0.5) {
        const spot: Placement = { box: [x, z, home.box[2], home.box[3]], rot: home.rot };
        const why = spotProblem(w, 'egg_shelf', spot);
        if (why) reasons.set(why, spot);
        else if (Math.hypot(x - home.box[0], z - home.box[1]) > 2) valid.push(spot);
      }
    for (const why of [
      'Outside the bought Areas',
      'Shop fixtures stay in the shop',
      'Hits a wall',
      'Blocks a door',
      'Overlaps the',
      'Too close to the',
    ])
      expect([...reasons.keys()].some((r) => r.startsWith(why))).toBe(true);
    expect(spotProblem(w, 'egg_shelf', home)).toBeNull(); // where it stands is fine
    // standing closer to a fixture than the walk grid allows doesn't make everything look cut off
    const office = w.stations.get('office');
    if (office) [w.player.x, w.player.z] = [office.box[0] + office.box[2] / 2, office.box[1] - 0.35];
    expect(cutOff(w)).toBeNull();
    expect(valid.length).toBeGreaterThan(0);

    // a valid drop moves the Shelf with its Items; everyone can still reach everything
    const to = valid.find((s) => {
      place(w, 'egg_shelf', s);
      const ok = cutOff(w) === null;
      if (!ok) place(w, 'egg_shelf', home);
      return ok;
    });
    expect(to).toBeDefined();
    expect(shelf.box).toEqual(to?.box);
    expect(shelf.items).toBe(4);
    expect(w.map.layout.places.egg_shelf.box).toEqual(to?.box);
    expect(cornerShop.layout.places.egg_shelf.box).toEqual(home.box); // the map data never changes

    // the Register turns with its Cashier spot: same offset in its own frame
    const reg = w.stations.get('register');
    if (reg?.kind !== 'register') throw new Error('register not bought');
    const cashier = w.cashiers.find((c) => c.id === 'cashier_1');
    const before = { ...reg, box: [...reg.box] as Box };
    const turn: Placement = { box: turned(reg.box), rot: nextRot(reg.rot) };
    const offset = (r: Placement, c: { x: number; z: number }) => {
      const [fx, fz] = frontDir(r.rot);
      const [rx, rz] = boxCentre(r.box);
      return [(c.x - rx) * fx + (c.z - rz) * fz, -(c.x - rx) * fz + (c.z - rz) * fx].map((v) => v.toFixed(2));
    };
    const was = offset(before, cashier ?? { x: 0, z: 0 });
    place(w, 'register', turn);
    expect(offset(reg, cashier ?? { x: 0, z: 0 })).toEqual(was);
    place(w, 'register', before);

    // Moves: 3 per Area bought, prices rise; Done charges them, and Customers head for the Shelf's new spot
    expect(movesLeft(w)).toBe(9);
    expect(moveBill(w, 2)).toEqual({ prices: [40, 60], total: 100, next: 90 });
    expect(canPayMoves(w, 10)).toBe(false);
    payMoves(w, 1);
    expect(w.money).toBe(10_000 - 40);
    expect(movesLeft(w)).toBe(8);
    expect(moveBill(w, 1).prices).toEqual([60]);
    w.money = 60;
    expect(canPayMoves(w, 1)).toBe(true);
    expect(canPayMoves(w, 2)).toBe(false);

    // the save keeps the moved place and the Moves used; an older save without them loads the map's layout
    const again = createWorld(cornerShop, snapshot(w), 8, true);
    expect(again.stations.get('egg_shelf')?.box).toEqual(to?.box);
    expect(again.movesUsed).toBe(1);
    const old = snapshot(w);
    delete old.layout;
    delete old.movesUsed;
    const fresh = createWorld(cornerShop, old, 9, true);
    expect(fresh.stations.get('egg_shelf')?.box).toEqual(home.box);
    expect(fresh.movesUsed).toBe(0);
  });
});
