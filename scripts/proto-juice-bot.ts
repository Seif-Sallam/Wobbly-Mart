// PROTOTYPE: the bot on the Juice Bar for the shape in JLAYOUT; prints minutes to 100% and the mean trip length.
import { juiceBar } from '../maps/juice-bar';
import { SHAPE_NAME } from '../maps/juice-bar/shapes';
import { createWorld, step } from '../src/sim/world';
import { Bot } from '../src/sim/bot';
import { completion } from '../src/sim/economy';

const w = createWorld(juiceBar, null, 1);
const bot = new Bot();
let walked = 0;
let px = w.player.x;
let pz = w.player.z;
const marks: string[] = [];
while (completion(w) < 1 && w.t < 4 * 3600) {
  step(w, bot.intents(w));
  walked += Math.hypot(w.player.x - px, w.player.z - pz);
  px = w.player.x;
  pz = w.player.z;
  for (const a of ['area_2', 'area_3', 'exit'])
    if (w.owned.has(a) && !marks.some((m) => m.startsWith(a))) marks.push(`${a} @ ${(w.t / 60).toFixed(1)} min`);
}
console.log(
  `${process.env.JLAYOUT ?? 'A'} ${SHAPE_NAME}: ${(completion(w) * 100).toFixed(0)}% in ${(w.t / 60).toFixed(1)} min; Player walked ${(walked / 1000).toFixed(2)} km; ${marks.join(', ')}`,
);
