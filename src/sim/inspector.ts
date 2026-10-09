// The Health Inspector: a warning, a random route through the shop with the Player escorting, then the dirt is scored.
import type { Point } from './map';
import type { Inspector, World } from './world';
import { DT } from './world';
import { boxCentre, distToBox, inBox } from './geometry';
import { skirtMesses } from './cleaning';
import { areaOwned, walkAgent, walkDistance, type Target } from './walk';
import { nextRandom, randomInt, shuffle } from './rng';
import { byArea } from './events';
import { TUNING } from './tuning';

const I = TUNING.events.inspector;

const onFloor = (w: World, [x, z]: Point): boolean => w.map.layout.floors.some((f) => inBox(x, z, f));

export function startInspector(w: World): boolean {
  const doors = Object.values(w.map.layout.doors).filter((d) => d.kind === 'customer' && areaOwned(w, d.box));
  if (!doors.length) return false;
  const door = boxCentre(doors[Math.floor(nextRandom(w.eventRng) * doors.length)].box);
  const from = { x: door[0], z: door[1] };
  const shop = [...w.stations.values()].filter(
    (s) =>
      (s.kind === 'shelf' || s.kind === 'register' || s.kind === 'producer') &&
      onFloor(w, boxCentre(s.box)) &&
      Number.isFinite(walkDistance(w, 'shopper', from, { station: s.id })),
  );
  if (!shop.length) return false;
  const home = w.map.layout.streetSpots.reduce((a, b) =>
    Math.hypot(b[0] - door[0], b[1] - door[1]) < Math.hypot(a[0] - door[0], a[1] - door[1]) ? b : a,
  );
  const count = randomInt(w.eventRng, I.stops[0], I.stops[1]);
  w.inspector = {
    x: home[0],
    z: home[1],
    vx: 0,
    vz: 0,
    state: 'warn',
    t: I.warning,
    door,
    home,
    stops: shuffle(w.eventRng, shop)
      .slice(0, count)
      .map((s) => s.id),
    stop: 0,
    clean: null,
    alone: 0,
    review: false,
  };
  w.events.push({ type: 'inspectorWarning' });
  return true;
}

/** Walks toward `target`, stepping around Messes until close to it (a Mess right there must not keep them out). */
function walk(w: World, ins: Inspector, target: Target, speed: number): boolean {
  if (walkAgent(w, 'shopper', ins, target, speed)) return true;
  const left =
    'point' in target
      ? Math.hypot(target.point[0] - ins.x, target.point[1] - ins.z)
      : distToBox(ins.x, ins.z, w.stations.get(target.station)?.box ?? [ins.x, ins.z, 0, 0]);
  if (left > I.skirtUntil) skirtMesses(w, ins);
  return false;
}

const dirtNear = (w: World, [x, z]: Point): boolean =>
  [...w.messes, ...w.loose].some((d) => Math.hypot(d.x - x, d.z - z) <= I.dirtRadius);

/** Spotless: a random reward; else a fine per Mess and Loose Item, plus the review fine (never below $0). */
function score(w: World, ins: Inspector): void {
  const a = w.map.events.inspector ? byArea(w, w.map.events.inspector.byArea) : null;
  const messes = w.messes.length;
  const loose = w.loose.length;
  const fine = a ? (messes + loose) * a.perDirt + (ins.review ? a.review : 0) : 0;
  const amount = fine === 0 && a ? randomInt(w.eventRng, a.reward[0], a.reward[1]) : -Math.min(w.money, fine);
  w.money += amount;
  w.events.push({ type: 'inspection', review: ins.review, messes, loose, amount });
  ins.state = 'leave';
  ins.clean = null;
}

function visit(w: World, ins: Inspector): void {
  const far = Math.hypot(w.player.x - ins.x, w.player.z - ins.z) > I.escort;
  ins.alone = Math.max(0, ins.alone + (far ? DT : -DT));
  if (ins.alone >= I.alone) {
    ins.review = true;
    return score(w, ins);
  }
  if (far) {
    ins.vx = ins.vz = 0;
    return;
  }
  const id = ins.stops[ins.stop];
  const st = w.stations.get(id);
  if (ins.clean === null) {
    if (st && !walk(w, ins, { station: id }, TUNING.customerSpeed)) return;
    ins.clean = !st || !dirtNear(w, boxCentre(st.box));
    ins.t = I.stopTime;
    w.events.push({ type: 'inspectorMark', clean: ins.clean });
    return;
  }
  ins.t -= DT;
  if (ins.t > 0) return;
  ins.clean = null;
  if (++ins.stop >= ins.stops.length) score(w, ins);
}

export function updateInspector(w: World, ins: Inspector): void {
  switch (ins.state) {
    case 'warn':
      ins.t -= DT;
      if (ins.t <= 0) ins.state = 'enter';
      return;
    case 'enter':
      if (walk(w, ins, { point: ins.door }, TUNING.customerSpeed)) ins.state = 'visit';
      return;
    case 'visit':
      return visit(w, ins);
    case 'leave':
      if (walk(w, ins, { point: ins.home }, ins.review ? I.stormSpeed : TUNING.customerSpeed)) w.inspector = null;
  }
}
