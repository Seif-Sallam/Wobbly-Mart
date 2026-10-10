// Bot playthrough of one Map: npx tsx .scratch/pizza/bot-pizza.ts [mapId]
import { mapById } from '../../maps';
import { createWorld, step } from '../../src/sim/world';
import { Bot } from '../../src/sim/bot';
import { completion } from '../../src/sim/economy';

const map = mapById(process.argv[2] ?? 'pizza-place');
if (!map) throw new Error('unknown map');
const w = createWorld(map, null, 1);
const bot = new Bot();
let last = -1;
let earned = 0;
let spent = 0;
let nextLog = 600;
while (completion(w) < 1 && w.t < 4 * 3600) {
  const before = w.money;
  const owned = w.owned.size;
  step(w, bot.intents(w));
  const d = w.money - before;
  if (d > 0) earned += d;
  else if (d < 0 && w.owned.size === owned) spent -= d;
  if (w.t >= nextLog) {
    nextLog += 600;
    console.log(`  t ${(w.t / 60).toFixed(0)} min: earned ${earned.toFixed(0)}, lost (not buying Pads) ${spent.toFixed(0)}`);
    earned = spent = 0;
  }
  const pct = Math.floor(completion(w) * 10);
  if (pct !== last) {
    last = pct;
    console.log(`${(w.t / 60).toFixed(1).padStart(5)} min  ${pct * 10}%  $${Math.floor(w.money)}  owned ${w.owned.size}`);
  }
}
console.log(`${map.id}: ${(completion(w) * 100).toFixed(0)}% after ${(w.t / 60).toFixed(1)} min`);
const missing = [...Object.keys(map.pads), ...Object.keys(map.upgrades)].filter((id) => !w.owned.has(id));
console.log('money', Math.floor(w.money), 'not owned:', missing.join(' '));
for (const st of w.stations.values()) {
  if (st.kind === 'shelf') console.log('shelf', st.id, st.items);
  if (st.kind === 'producer') console.log('prod', st.id, JSON.stringify(st.input), 'tray', st.tray, 'plants', st.plants.length);
}
console.log('player', w.player.x.toFixed(1), w.player.z.toFixed(1), 'stack', w.player.stack.join(','));
console.log('customers', w.customers.length, [...new Set(w.customers.map((c) => c.state))].join(','));
for (const st of w.stations.values())
  if (st.kind === 'register') {
    const front = w.customers.find((c) => c.id === st.queue[0]);
    console.log('register', st.id, 'queue', st.queue.length, 'cash', Math.floor(st.cash), 'front at', front?.x.toFixed(1), front?.z.toFixed(1), front?.state);
  }
for (const c of w.customers) console.log('cust', c.id, c.state, c.x.toFixed(1), c.z.toFixed(1), 'reg', c.register, 'li', c.li, '/', c.list.length, JSON.stringify(c.list.map((l) => `${l.product}:${l.got}/${l.want}`)));
console.log('stockers', w.stockers.map((s) => `${s.id}:${s.job?.product ?? '-'}`).join(' '));
