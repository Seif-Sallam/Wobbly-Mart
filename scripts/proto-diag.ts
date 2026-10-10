import { juiceBar } from '/Users/ssallam/personal/my-mini-mart-jlayout/maps/juice-bar';
import { createWorld, step } from '/Users/ssallam/personal/my-mini-mart-jlayout/src/sim/world';
import { Bot } from '/Users/ssallam/personal/my-mini-mart-jlayout/src/sim/bot';
const w = createWorld(juiceBar, null, 1);
const bot = new Bot();
let last = 0;
let px = w.player.x, pz = w.player.z, still = 0;
while (w.t < 12 * 60) {
  step(w, bot.intents(w));
  if (Math.hypot(w.player.x - px, w.player.z - pz) < 1e-4) still += 1 / 60; px = w.player.x; pz = w.player.z;
  if (w.t - last >= 60) { console.log("target", JSON.stringify((bot as unknown as { target: unknown }).target), "stations", [...w.stations.keys()].join(","), "shelves", [...w.stations.values()].filter((s) => s.kind === "shelf").map((s) => `${s.id}:${(s as { items: number }).items}`).join(" "));
    last = w.t;
    const states: Record<string, number> = {};
    for (const c of w.customers) states[c.state] = (states[c.state] ?? 0) + 1;
    console.log(w.customers.filter(c=>c.state==="leave").slice(0,3).map(c=>`(${c.x.toFixed(1)},${c.z.toFixed(1)})`).join(" "), `${(w.t / 60).toFixed(0)} min $${Math.floor(w.money)} owned ${w.owned.size} player (${w.player.x.toFixed(1)},${w.player.z.toFixed(1)}) still ${still.toFixed(0)}s stack ${w.player.stack.length} customers ${JSON.stringify(states)}`);
  }
}
