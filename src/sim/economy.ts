// Ownership, prices, Upgrades, Completion — everything about what is bought.
import type { MapDef, Placement, Point, StationDef } from './map';
import type { Intents, Station, World } from './world';
import { newCarrier, STOCKER_ROLES } from './world';
import type { MapSave } from './save';
import { objectiveId } from '../../catalog/objectives';
import { restoreStats } from './stats';
import { boxCentre, boxesOverlap, footprint, frontPoint } from './geometry';
import { TUNING } from './tuning';
import { FEEL } from '../feel';

/** Area Pan: glide there, hold, glide back. */
export const panDuration = (): number => 2 * FEEL.panGlide + FEEL.panHold;

export function requirementMet(w: World, req: string): boolean {
  const [id, level] = req.split(':');
  return level === undefined ? w.owned.has(id) : (w.levels[id] ?? 0) >= Number(level);
}

export const padVisible = (w: World, id: string): boolean => {
  const pad = w.map.pads[id];
  return !!pad && !w.owned.has(id) && pad.requires.every((r) => requirementMet(w, r));
};

export const visiblePads = (w: World): string[] => Object.keys(w.map.pads).filter((id) => padVisible(w, id));

export const padRemaining = (w: World, id: string): number => w.map.pads[id].cost - (w.paid[id] ?? 0);

function createStation(w: World, id: string, def: StationDef): void {
  const place = w.map.layout.places[id];
  const base = { id, box: place.box, rot: place.rot };
  let st: Station | null = null;
  switch (def.kind) {
    case 'shelf':
      st = { ...base, kind: 'shelf', product: def.product, items: 0 };
      break;
    case 'producer': {
      const type = w.map.producers[def.type];
      const plants = Array.from({ length: type.plants ?? 0 }, () => type.workTime * workMultiplier(w, def.type));
      st = { ...base, kind: 'producer', type: def.type, input: {}, tray: 0, work: 0, plants };
      break;
    }
    case 'register':
      st = { ...base, kind: 'register', cash: 0, queue: [], queueLength: def.queueLength, progress: 0 };
      break;
    case 'office':
    case 'trash':
    case 'exit':
    case 'mopStand':
      st = { ...base, kind: def.kind };
      break;
    case 'cashier': {
      const [x, z] = boxCentre(place.box);
      w.cashiers.push({ id, register: def.register, x, z });
      break;
    }
    case 'stocker': {
      const [x, z] = boxCentre(place.box);
      w.stockers.push({
        id,
        x,
        z,
        vx: 0,
        vz: 0,
        ...newCarrier(),
        role: 'auto',
        job: null,
        rethink: 0,
        spot: null,
        leftover: null,
      });
      break;
    }
    case 'cleaner': {
      const [x, z] = boxCentre(place.box);
      w.cleaners.push({ id, x, z, vx: 0, vz: 0, spot: null, show: 0, mopping: false });
      break;
    }
    case 'area':
      w.owned.add(def.area);
      break;
  }
  if (st) w.stations.set(id, st);
}

/** Marks an id owned and puts its Station/Staff/Area into the world. */
export function own(w: World, id: string, announce: boolean): void {
  if (w.owned.has(id)) return;
  w.owned.add(id);
  delete w.paid[id];
  const pad = w.map.pads[id];
  if (pad) createStation(w, id, pad.unlocks);
  w.navDirty = true;
  if (!announce) return;
  w.events.push({ type: 'padBought', pad: id });
  if (pad?.unlocks.kind === 'area') {
    w.events.push({ type: 'areaBought', area: pad.unlocks.area });
    w.pan = { area: pad.unlocks.area, t: 0, duration: panDuration() };
  }
  refreshFreeStations(w);
}

export function refreshFreeStations(w: World): void {
  for (const [id, def] of Object.entries(w.map.freeStations)) {
    if (w.stations.has(id) || !def.requires.every((r) => requirementMet(w, r))) continue;
    createStation(w, id, def.unlocks);
    w.navDirty = true;
  }
}

/** Saved Edit Layout moves that still fit: a map update may have put walls or other fixtures on an old spot.
 *  A dropped move puts the fixture back at the map's own place (a Cashier follows its Register). */
function keptMoves(map: MapDef, moves: Record<string, Placement>): Record<string, Placement> {
  const L = map.layout;
  const known = Object.entries(moves).filter(([id]) => id in map.pads && L.places[id]);
  const spotOf = (id: string): Placement | undefined => moves[id] ?? L.places[id];
  const fits = (id: string, p: Placement): boolean =>
    !Object.keys(L.places).some((o) => o !== id && !!spotOf(o) && boxesOverlap(p.box, (spotOf(o) as Placement).box)) &&
    !Object.values(L.walls).some((wall) => boxesOverlap(p.box, wall.box));
  const kept = Object.fromEntries(known.filter(([id, p]) => fits(id, p)));
  for (const id of Object.keys(kept)) {
    const def = map.pads[id].unlocks;
    if (def.kind === 'cashier' && moves[def.register] && !kept[def.register]) delete kept[id];
  }
  return kept;
}

/** Restores what a save keeps; drops unknown ids, clamps values. */
export function applySave(w: World, save: MapSave): void {
  w.money = Number(save.money) || 0; // below 0 = Debt
  w.badReviewStreak = Math.max(0, Math.floor(Number(save.badReviewStreak) || 0));
  // moved places first, so Stations are created where they were left
  for (const [id, p] of Object.entries(keptMoves(w.map, save.layout ?? {}))) w.placed[id] = w.map.layout.places[id] = p;
  w.movesUsed = Math.max(0, Math.floor(Number(save.movesUsed) || 0));
  const known = (id: string) => id in w.map.pads || Object.keys(w.map.layout.areas).includes(id);
  // Pads first in map order so Staff find their Registers
  const owned = new Set(save.owned.filter(known));
  for (const id of [...Object.keys(w.map.layout.areas), ...Object.keys(w.map.pads)])
    if (owned.has(id)) own(w, id, false);
  for (const [id, paid] of Object.entries(save.paid ?? {})) {
    const pad = w.map.pads[id];
    if (!pad || w.owned.has(id)) continue;
    if (paid >= pad.cost) own(w, id, false);
    else if (paid > 0) w.paid[id] = paid;
  }
  for (const [id, level] of Object.entries(save.levels ?? {})) {
    const up = w.map.upgrades[id];
    if (up) w.levels[id] = Math.max(0, Math.min(up.levels.length, Math.floor(level)));
  }
  for (const s of w.stockers) {
    const role = save.roles?.[s.id];
    if (role && STOCKER_ROLES.includes(role)) s.role = role;
  }
  w.stats = restoreStats(save.stats);
  const objectives = new Set(w.map.objectives.map(objectiveId));
  for (const id of save.objectives ?? []) if (objectives.has(id)) w.objectivesDone.add(id);
  w.score = Math.max(0, Math.floor(Number(save.score) || 0));
  w.quarters = Math.min(4, Math.max(0, Math.floor(Number(save.quarters) || 0)));
}

// ---------- stats and Upgrades

export function upgradeValue(w: World, target: string, stat: string, base: number): number {
  for (const [id, up] of Object.entries(w.map.upgrades)) {
    if (up.target !== target || up.stat !== stat) continue;
    const lvl = w.levels[id] ?? 0;
    if (lvl > 0) return up.levels[lvl - 1].value;
  }
  return base;
}

export const workMultiplier = (w: World, type: string): number => upgradeValue(w, type, 'workTime', 1);
export const stackCap = (w: World): number => upgradeValue(w, 'player', 'stack', TUNING.base.stack);
export const safeCount = (w: World): number => upgradeValue(w, 'player', 'safe', TUNING.base.safe);
export const playerSpeed = (w: World): number => upgradeValue(w, 'player', 'speed', TUNING.base.playerSpeed);
export const checkoutTime = (w: World): number => upgradeValue(w, 'cashier', 'checkoutTime', TUNING.base.checkoutTime);
export const stockerSpeed = (w: World): number => upgradeValue(w, 'stocker', 'speed', TUNING.base.stockerSpeed);
export const stockerCarry = (w: World): number => upgradeValue(w, 'stocker', 'carry', TUNING.base.stockerCarry);
export const cleanTime = (w: World): number => upgradeValue(w, 'player', 'cleanTime', TUNING.base.cleanTime);

export const upgradeVisible = (w: World, id: string): boolean => {
  const up = w.map.upgrades[id];
  return w.owned.has('office') && up.requires.every((r) => requirementMet(w, r));
};

/** Cost of the next level, or null when maxed. */
export function nextLevelCost(w: World, id: string): number | null {
  const lvl = w.levels[id] ?? 0;
  const up = w.map.upgrades[id];
  return lvl < up.levels.length ? up.levels[lvl].cost : null;
}

export function canBuyUpgrade(w: World, id: string): boolean {
  if (!w.map.upgrades[id] || !upgradeVisible(w, id)) return false;
  const cost = nextLevelCost(w, id);
  return cost !== null && w.money >= cost;
}

export function applyCommands(w: World, intents: Intents): void {
  const id = intents.buyUpgrade;
  if (id && w.atOffice && canBuyUpgrade(w, id)) {
    w.money -= nextLevelCost(w, id) ?? 0;
    w.levels[id] = (w.levels[id] ?? 0) + 1;
    w.events.push({ type: 'upgradeBought', upgrade: id });
  }
  if (intents.setClosed !== undefined && w.atOffice && intents.setClosed !== w.closed && w.closedWait <= 0) {
    w.closed = intents.setClosed;
    w.closedWait = w.closed ? TUNING.closed.reopenWait : TUNING.closed.closeWait;
    if (w.closed) w.stats.timesClosed++;
  }
  if (intents.assign) {
    const s = w.stockers.find((x) => x.id === intents.assign?.stocker);
    if (s) {
      s.role = intents.assign.role;
      s.job = null;
    }
  }
}

// ---------- Customers' view of the store

/** Products with a Shelf and something that makes them. */
export function productsForSale(w: World): string[] {
  const made = new Set<string>();
  for (const s of w.stations.values()) if (s.kind === 'producer') made.add(w.map.producers[s.type].output);
  const out: string[] = [];
  for (const s of w.stations.values())
    if (s.kind === 'shelf' && made.has(s.product) && !out.includes(s.product)) out.push(s.product);
  return out;
}

export const customerCap = (w: World): number =>
  Math.floor((TUNING.capBase + productsForSale(w).length) * TUNING.capCashierFactor ** w.cashiers.length);

export function cashPilePoint(w: World, register: string): Point {
  const place = w.stations.get(register) ?? w.map.layout.places[register];
  const [long, depth] = footprint(place.box, place.rot);
  const def = w.map.pads[register]?.unlocks;
  const end = def?.kind === 'register' && def.cashPileFlipped ? -1 : 1;
  return frontPoint(place.box, place.rot, -depth / 2, end * (long / 2 + TUNING.cashPileOffset));
}

// ---------- Completion

/** Bought Pads + Upgrade levels + Objectives done over everything, equally weighted (works on a save too). */
export function completionOf(
  map: MapDef,
  owned: { has: (id: string) => boolean },
  levels: Record<string, number>,
  objectivesDone: { has: (id: string) => boolean },
): number {
  let done = 0;
  let total = 0;
  for (const id of Object.keys(map.pads)) {
    total++;
    if (owned.has(id)) done++;
  }
  for (const [id, up] of Object.entries(map.upgrades)) {
    total += up.levels.length;
    done += Math.min(up.levels.length, levels[id] ?? 0);
  }
  for (const o of map.objectives) {
    total++;
    if (objectivesDone.has(objectiveId(o))) done++;
  }
  return total ? done / total : 1;
}

export const completion = (w: World): number => completionOf(w.map, w.owned, w.levels, w.objectivesDone);

export function checkCompletion(w: World, announce: boolean): boolean {
  const full = completion(w) >= 1;
  if (full && !w.complete && announce) w.events.push({ type: 'complete' });
  return full;
}
