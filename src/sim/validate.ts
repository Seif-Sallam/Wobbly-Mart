// Map validator: runs in CI and live in the layout editor. Returns problems; an empty list means the map is valid.
import type { Box, MapDef, StationDef } from './map';
import { stationModel } from './map';
import { boxGap, boxesOverlap, frontPoint } from './geometry';
import { TUNING } from './tuning';

export interface Problem {
  id: string;
  message: string;
}

const FIXED_TARGETS = new Set(['player', 'cashier', 'stocker']);

/** Ids that, once released, must never disappear from a map. */
export function releasableIds(map: MapDef): string[] {
  return [
    ...Object.keys(map.layout.areas),
    ...Object.keys(map.pads),
    ...Object.keys(map.freeStations),
    ...Object.keys(map.upgrades),
    ...Object.keys(map.products),
  ];
}

const solidStation = (def: StationDef): boolean => !['cashier', 'stocker', 'area'].includes(def.kind);

/** Per map in `maps/released-ids.json`: ids shipped in a release, and ids retired for good. */
export interface ReleasedIds {
  released: string[];
  retired: string[];
}

export function validateMap(
  map: MapDef,
  assets: Record<string, unknown>,
  history: ReleasedIds = { released: [], retired: [] },
): Problem[] {
  const out: Problem[] = [];
  const L = map.layout;
  const areas = new Set(Object.keys(L.areas));
  const stations: Record<string, StationDef> = {
    ...Object.fromEntries(Object.entries(map.pads).map(([id, p]) => [id, p.unlocks])),
    ...Object.fromEntries(Object.entries(map.freeStations).map(([id, f]) => [id, f.unlocks])),
  };
  const ids = new Set([...areas, ...Object.keys(stations)]);

  const checkReq = (owner: string, req: string) => {
    const [id, level] = req.split(':');
    if (level === undefined) {
      if (!ids.has(id)) out.push({ id: owner, message: `requires unknown id "${id}"` });
      return;
    }
    const up = map.upgrades[id];
    if (!up) out.push({ id: owner, message: `requires unknown Upgrade "${id}"` });
    else if (!(Number(level) >= 1 && Number(level) <= up.levels.length))
      out.push({ id: owner, message: `requires level ${level} of "${id}", which has ${up.levels.length} levels` });
  };

  // dangling ids
  for (const id of map.start.owned) if (!ids.has(id)) out.push({ id, message: 'start owns an unknown id' });
  for (const [id, pad] of Object.entries(map.pads)) pad.requires.forEach((r) => checkReq(id, r));
  for (const [id, f] of Object.entries(map.freeStations)) f.requires.forEach((r) => checkReq(id, r));
  for (const [id, up] of Object.entries(map.upgrades)) {
    up.requires.forEach((r) => checkReq(id, r));
    if (!FIXED_TARGETS.has(up.target) && !map.producers[up.target])
      out.push({ id, message: `targets unknown "${up.target}"` });
  }
  for (const [id, def] of Object.entries(stations)) {
    if (!L.places[id]) out.push({ id, message: 'has no place in layout.ts' });
    if (def.kind === 'shelf' && !map.products[def.product])
      out.push({ id, message: `sells unknown Product "${def.product}"` });
    if (def.kind === 'producer' && !map.producers[def.type])
      out.push({ id, message: `is unknown Producer "${def.type}"` });
    if (def.kind === 'cashier' && stations[def.register]?.kind !== 'register')
      out.push({ id, message: `works unknown Register "${def.register}"` });
    if (def.kind === 'area' && !areas.has(def.area)) out.push({ id, message: `opens unknown Area "${def.area}"` });
  }
  for (const [i, step] of map.tutorial.entries()) {
    const ref = step.pad ?? step.station;
    if (ref && !ids.has(ref)) out.push({ id: `tutorial[${i}]`, message: `points at unknown id "${ref}"` });
  }

  // unlock cycles and unreachable items
  const owned = new Set(map.start.owned);
  const levels: Record<string, number> = {};
  const met = (req: string) => {
    const [id, level] = req.split(':');
    return level === undefined ? owned.has(id) : (levels[id] ?? 0) >= Number(level);
  };
  for (let grew = true; grew;) {
    grew = false;
    for (const [id, pad] of Object.entries(map.pads)) {
      if (owned.has(id) || !pad.requires.every(met)) continue;
      owned.add(id);
      if (pad.unlocks.kind === 'area') owned.add(pad.unlocks.area);
      grew = true;
    }
    for (const [id, up] of Object.entries(map.upgrades)) {
      if ((levels[id] ?? 0) < up.levels.length && up.requires.every(met)) {
        levels[id] = up.levels.length;
        grew = true;
      }
    }
  }
  for (const id of Object.keys(map.pads))
    if (!owned.has(id)) out.push({ id, message: 'can never be unlocked (cycle or unreachable requirement)' });
  for (const [id, up] of Object.entries(map.upgrades))
    if (!levels[id] && up.levels.length) out.push({ id, message: 'Upgrade can never appear' });

  // Shelves need something that makes their Product
  const made = new Set(
    Object.values(stations).flatMap((d) => (d.kind === 'producer' ? [map.producers[d.type]?.output] : [])),
  );
  for (const [id, def] of Object.entries(stations))
    if (def.kind === 'shelf' && !made.has(def.product))
      out.push({ id, message: `nothing on this map produces ${def.product}` });

  // overlaps
  const solids: [string, Box][] = [
    ...Object.entries(L.walls).map(([id, w]): [string, Box] => [id, w.box]),
    ...Object.entries(L.props)
      .filter(([, p]) => p.solid)
      .map(([id, p]): [string, Box] => [id, p.box]),
  ];
  const placed = Object.keys(stations).filter((id) => L.places[id] && solidStation(stations[id]));
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i];
    for (let j = i + 1; j < placed.length; j++) {
      const b = placed[j];
      if (boxesOverlap(L.places[a].box, L.places[b].box)) out.push({ id: a, message: `overlaps Station ${b}` });
    }
    for (const [sid, box] of solids)
      if (boxesOverlap(L.places[a].box, box)) out.push({ id: a, message: `overlaps ${sid}` });
  }

  // clearance: every Station/Pad footprint pair, except a Register and its own Cashier spot
  const footprints = Object.keys(stations).filter((id) => L.places[id]);
  const ownCashier = (a: string, b: string) => {
    const d = stations[a];
    return d.kind === 'cashier' && d.register === b;
  };
  for (let i = 0; i < footprints.length; i++)
    for (let j = i + 1; j < footprints.length; j++) {
      const [a, b] = [footprints[i], footprints[j]];
      if (ownCashier(a, b) || ownCashier(b, a)) continue;
      const gap = boxGap(L.places[a].box, L.places[b].box);
      if (gap < TUNING.clearance - 1e-6)
        out.push({ id: a, message: `only ${gap.toFixed(2)} m from ${b} (needs ${TUNING.clearance} m)` });
    }

  // queues
  const r = TUNING.characterRadius;
  for (const [id, def] of Object.entries(stations)) {
    if (def.kind !== 'register' || !L.places[id]) continue;
    const { box, rot } = L.places[id];
    for (let i = 0; i < def.queueLength; i++) {
      const [x, z] = frontPoint(box, rot, TUNING.queueFirstOffset + i * TUNING.queueGap);
      const spot: Box = [x - r, z - r, 2 * r, 2 * r];
      const hit = [...placed.filter((s) => s !== id).map((s): [string, Box] => [s, L.places[s].box]), ...solids].find(
        ([, b]) => boxesOverlap(spot, b),
      );
      if (hit) out.push({ id, message: `Queue Spot ${i + 1} collides with ${hit[0]}` });
    }
  }

  // released ids never disappear unless retired, and retired ids never come back
  const now = new Set(releasableIds(map));
  const retired = new Set(history.retired);
  for (const id of history.released)
    if (!now.has(id) && !retired.has(id)) out.push({ id, message: 'was released and must not be removed or renamed' });
  for (const id of retired) if (now.has(id)) out.push({ id, message: 'was retired and must never come back' });

  // models
  const models = new Set<string>(Object.values(L.props).map((p) => p.model));
  for (const p of Object.values(map.products)) {
    models.add(p.model);
    models.add(p.shelf);
  }
  for (const def of Object.values(stations)) {
    const m = stationModel(map, def);
    if (m) models.add(m);
  }
  for (const m of models) if (!(m in assets)) out.push({ id: m, message: 'model name missing from the asset table' });

  return out;
}
