// PROTOTYPE (throwaway, branch prototype/edit-layout): `?layout=A|B|C` — Edit Layout mode: pick, drag, rotate, drop,
// paid Moves, live panel, value dump. Rules from the Placement upgrade ticket; this only explores the feel.
/* eslint-disable @typescript-eslint/no-non-null-assertion -- throwaway prototype */
import * as THREE from 'three';
import type { Game } from './game';
import type { Input } from '../input/input';
import type { Box, Rot } from '../sim/map';
import { stationModel } from '../sim/map';
import type { Station } from '../sim/world';
import { boxCentre, boxGap, boxesOverlap, footprint, frontDir, frontPoint, inBox } from '../sim/geometry';
import { inOwnedAreas, rebuildNav, walkDistance } from '../sim/walk';
import { TUNING } from '../sim/tuning';
import { buildStation } from '../view/stations';
import { PALETTE } from '../palette';

interface Params {
  /** game: play camera; top: straight down over the bought Areas; tilt: play angle zoomed out over them. */
  camera: 'game' | 'top' | 'tilt';
  ghostLift: number;
  doorKeepClear: number;
  showAllFootprints: boolean;
  tapToPlace: boolean;
}
const BASE: Params = {
  camera: 'game',
  ghostLift: 0.35,
  doorKeepClear: 1.5,
  showAllFootprints: false,
  tapToPlace: true,
};
const PRESETS: Record<string, { name: string; params: Params }> = {
  A: { name: 'Game camera: edit right where you stand, drag empty floor to pan', params: { ...BASE } },
  B: {
    name: 'Top-down: the bought store from straight above',
    params: { ...BASE, camera: 'top', showAllFootprints: true },
  },
  C: { name: 'Tilted overview: the play angle, zoomed out over the bought store', params: { ...BASE, camera: 'tilt' } },
};
const VARIANTS = Object.keys(PRESETS);
/** Placeholder Move prices (the economy work sets the real ones). */
const MOVE_PRICES = [60, 90, 130, 180, 240, 310, 390, 480, 580];
const MOVABLE = new Set(['shelf', 'register', 'producer']);

type Spot = { box: Box; rot: Rot };
type ViewGuts = {
  batch: { setScale: (id: string, xz: number, y: number) => void };
  stations: Map<string, { root: THREE.Object3D }>;
  reset: (w: Game['world']) => void;
};

const turned = (b: Box): Box => {
  const [cx, cz] = boxCentre(b);
  return [cx - b[3] / 2, cz - b[2] / 2, b[3], b[2]];
};
const nice = (id: string) => id.replace(/_/g, ' ');

export async function openEditLayoutPrototype(game: Game, input: Input): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const url = new URL(location.href);
  let variant = url.searchParams.get('layout') ?? 'A';
  if (!PRESETS[variant]) variant = 'A';
  const P: Params = { ...PRESETS[variant].params };
  const view = game.view as unknown as ViewGuts;
  const stage = game.stage;
  const scene = stage.scene;
  let usedMoves = 0;

  // ---------- session state
  let open = false;
  let start = new Map<string, Spot>();
  let picked: { id: string; spot: Spot; problem: string | null } | null = null;
  let ghost: THREE.Object3D | null = null;
  let flash = '';
  let flashUntil = 0;
  const focus = new THREE.Vector3();
  let saved = { viewSize: stage.viewSize };

  const w = () => game.world;
  const L = () => w().map.layout;
  const cashierOf = (reg: string) =>
    Object.keys(w().map.pads).find((id) => {
      const u = w().map.pads[id].unlocks;
      return u.kind === 'cashier' && u.register === reg;
    });
  const movable = (st: Station) => MOVABLE.has(st.kind);
  const isShop = (x: number, z: number) => L().floors.some((f) => inBox(x, z, f));
  const corners = (b: Box): [number, number][] => [
    [b[0] + 0.01, b[1] + 0.01],
    [b[0] + b[2] - 0.01, b[1] + 0.01],
    [b[0] + 0.01, b[1] + b[3] - 0.01],
    [b[0] + b[2] - 0.01, b[1] + b[3] - 0.01],
  ];

  /** Where a Register's Cashier spot goes for a Register spot: same offset in the Register's own frame. */
  const cashierSpot = (reg: string, to: Spot): Box | null => {
    const cid = cashierOf(reg);
    const from = start.get(reg);
    if (!cid || !from || !L().places[cid]) return null;
    const cb = L().places[cid].box;
    const [rx, rz] = boxCentre(from.box);
    const [cx, cz] = boxCentre(cb);
    const [fx, fz] = frontDir(from.rot);
    const half = footprint(from.box, from.rot)[1] / 2;
    const out = (cx - rx) * fx + (cz - rz) * fz - half;
    const side = -(cx - rx) * fz + (cz - rz) * fx;
    const [nx, nz] = frontPoint(to.box, to.rot, out, side);
    return [nx - cb[2] / 2, nz - cb[3] / 2, cb[2], cb[3]];
  };
  const startCashier = new Map<string, Box>();

  /** Why this spot is not allowed, or null. */
  const problem = (id: string, spot: Spot): string | null => {
    const b = spot.box;
    if (!corners(b).every(([x, z]) => inOwnedAreas(w(), x, z))) return 'Outside the bought Areas';
    const wasShop = isShop(...boxCentre(start.get(id)!.box));
    if (!corners(b).every(([x, z]) => isShop(x, z) === wasShop))
      return wasShop ? 'Shop fixtures stay in the shop' : 'Farm fixtures stay in the yard';
    const cid = cashierOf(id);
    const mine = [b, ...(cid ? [cashierSpot(id, spot)!] : [])];
    for (const wall of Object.values(L().walls)) if (mine.some((m) => boxesOverlap(m, wall.box))) return 'Hits a wall';
    for (const door of Object.values(L().doors)) {
      const k = P.doorKeepClear;
      const zone: Box = [door.box[0] - k, door.box[1] - k, door.box[2] + 2 * k, door.box[3] + 2 * k];
      if (mine.some((m) => boxesOverlap(m, zone))) return 'Blocks a door';
    }
    for (const [pid, p] of Object.entries(L().props))
      if (p.solid && !p.party && (!p.area || w().owned.has(p.area)) && mine.some((m) => boxesOverlap(m, p.box)))
        return `Hits the ${nice(pid.replace(/^prop_/, ''))}`;
    // every other Station and Pad footprint, bought or not
    const ids = new Set([...Object.keys(w().map.pads), ...Object.keys(w().map.freeStations)]);
    for (const other of ids) {
      if (other === id || other === cid) continue;
      const ob = w().stations.get(other)?.box ?? L().places[other]?.box;
      if (!ob) continue;
      for (const m of mine) {
        const g = boxGap(m, ob);
        if (boxesOverlap(m, ob)) return `Overlaps the ${nice(other)}`;
        if (g < TUNING.clearance - 1e-6)
          return `Too close to the ${nice(other)}: ${g.toFixed(1)} m, needs ${TUNING.clearance} m`;
      }
    }
    // Register queues stay clear
    const r = TUNING.characterRadius;
    for (const reg of w().stations.values()) {
      if (reg.kind !== 'register') continue;
      const rs = reg.id === id ? spot : { box: reg.box, rot: reg.rot };
      for (let i = 0; i < reg.queueLength; i++) {
        const [x, z] = frontPoint(rs.box, rs.rot, TUNING.queueFirstOffset + i * TUNING.queueGap);
        const q: Box = [x - r, z - r, 2 * r, 2 * r];
        if (reg.id !== id && boxesOverlap(b, q)) return `Blocks the queue at the ${nice(reg.id)}`;
        if (reg.id === id) {
          for (const o of w().stations.values())
            if (o.id !== id && boxesOverlap(q, o.box)) return `Its queue would run into the ${nice(o.id)}`;
          for (const wall of Object.values(L().walls))
            if (boxesOverlap(q, wall.box)) return 'Its queue would hit a wall';
        }
      }
    }
    return null;
  };

  /** Put a Station at a spot in the paused World (with its Cashier spot). */
  const place = (id: string, spot: Spot) => {
    const st = w().stations.get(id)!;
    const cb = cashierSpot(id, spot);
    st.box = spot.box;
    st.rot = spot.rot;
    L().places[id] = { box: spot.box, rot: spot.rot };
    const cid = cashierOf(id);
    if (cid && cb) L().places[cid] = { ...L().places[cid], box: cb };
  };
  /** Everyone can still reach every Station: Player/Staff on foot, Customers from the Street to Shelves and Registers. */
  const cutOff = (): string | null => {
    rebuildNav(w());
    const pl = w().player;
    const street = L().streetSpots[0];
    for (const st of w().stations.values()) {
      if (st.kind === 'trash' || st.kind === 'exit') continue;
      if (!Number.isFinite(walkDistance(w(), 'walker', pl, { station: st.id }))) return `Cuts off the ${nice(st.id)}`;
      if (
        (st.kind === 'shelf' || st.kind === 'register') &&
        !Number.isFinite(walkDistance(w(), 'shopper', { x: street[0], z: street[1] }, { station: st.id }))
      )
        return `Customers can't reach the ${nice(st.id)}`;
    }
    return null;
  };

  // ---------- Moves and the bill
  const movedIds = () =>
    [...start.entries()]
      .filter(([id, s]) => {
        const st = w().stations.get(id)!;
        return st.rot !== s.rot || st.box.some((v, i) => Math.abs(v - s.box[i]) > 1e-6);
      })
      .map(([id]) => id);
  const movesLeft = () => 3 * Object.keys(L().areas).filter((a) => w().owned.has(a)).length - usedMoves;
  const bill = () => {
    const n = movedIds().length;
    const prices = MOVE_PRICES.slice(usedMoves, usedMoves + n);
    return { n, prices, total: prices.reduce((a, b) => a + b, 0) };
  };

  // ---------- ghost
  const hideOriginal = (id: string, hide: boolean) => {
    view.batch.setScale(id, hide ? 0.001 : 1, hide ? 0.001 : 1);
    const v = view.stations.get(id);
    if (v) v.root.visible = !hide;
  };
  const okMat = new THREE.MeshBasicMaterial({
    color: PALETTE.money,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const badMat = new THREE.MeshBasicMaterial({ color: '#d63c2f', transparent: true, opacity: 0.55, depthWrite: false });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), okMat);
  plate.rotation.x = -Math.PI / 2;
  plate.renderOrder = 3;
  const cashPlate = plate.clone();
  const footprints = new THREE.Group();
  scene.add(plate, cashPlate, footprints);
  plate.visible = cashPlate.visible = false;
  const showGhost = () => {
    if (ghost) scene.remove(ghost);
    ghost = null;
    plate.visible = cashPlate.visible = !!picked;
    if (!picked) return;
    const st = w().stations.get(picked.id)!;
    const def = w().map.pads[st.id]?.unlocks ?? w().map.freeStations[st.id]?.unlocks;
    const name = def ? stationModel(w().map, def) : null;
    if (name) {
      ghost = buildStation(name, picked.spot.box, picked.spot.rot).root;
      ghost.position.y = P.ghostLift;
      scene.add(ghost);
    }
    const mat = picked.problem ? badMat : okMat;
    const b = picked.spot.box;
    plate.material = mat;
    plate.position.set(b[0] + b[2] / 2, 0.06, b[1] + b[3] / 2);
    plate.scale.set(b[2], b[3], 1);
    const cb = cashierSpot(picked.id, picked.spot);
    cashPlate.visible = !!cb;
    if (cb) {
      cashPlate.material = mat;
      cashPlate.position.set(cb[0] + cb[2] / 2, 0.06, cb[1] + cb[3] / 2);
      cashPlate.scale.set(cb[2], cb[3], 1);
    }
  };
  const drawFootprints = () => {
    for (const c of [...footprints.children]) footprints.remove(c);
    if (!open || !P.showAllFootprints) return;
    for (const st of w().stations.values()) {
      const b = st.box;
      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(b[2], 0.02, b[3])),
        new THREE.LineBasicMaterial({ color: movable(st) ? PALETTE.cream : PALETTE.ink, depthTest: false }),
      );
      line.position.set(b[0] + b[2] / 2, 0.08, b[1] + b[3] / 2);
      line.renderOrder = 4;
      footprints.add(line);
    }
  };

  // ---------- camera
  const ownedBounds = (): Box => {
    const rects = Object.entries(L().areas)
      .filter(([a]) => w().owned.has(a))
      .flatMap(([, r]) => r);
    const x0 = Math.min(...rects.map((r) => r[0]));
    const z0 = Math.min(...rects.map((r) => r[1]));
    const x1 = Math.max(...rects.map((r) => r[0] + r[2]));
    const z1 = Math.max(...rects.map((r) => r[1] + r[3]));
    return [x0, z0, x1 - x0, z1 - z0];
  };
  const applyCamera = () => {
    stage.topDown = open && P.camera === 'top';
    if (!open) return;
    const b = ownedBounds();
    if (P.camera === 'game') {
      focus.set(w().player.x, 0, w().player.z);
      stage.viewSize = saved.viewSize;
    } else {
      focus.set(b[0] + b[2] / 2, 0, b[1] + b[3] / 2);
      const aspect = innerWidth / innerHeight;
      stage.viewSize = Math.max(b[3], b[2] / Math.max(aspect, 1e-3)) * (P.camera === 'top' ? 1.05 : 0.8);
    }
    stage.resize();
    game.view.cameraOverride = focus;
  };

  // ---------- open / close
  const joy = document.getElementById('joy') as HTMLElement;
  const setOpen = (on: boolean) => {
    open = on;
    game.paused = on;
    input.enabled = !on;
    joy.style.pointerEvents = on ? 'none' : '';
    panel.style.display = on ? 'flex' : 'none';
    if (on) {
      saved = { viewSize: stage.viewSize };
      start = new Map(
        [...w().stations.values()].filter(movable).map((s) => [s.id, { box: [...s.box] as Box, rot: s.rot }]),
      );
      startCashier.clear();
      for (const id of start.keys()) {
        const cid = cashierOf(id);
        if (cid && L().places[cid]) startCashier.set(cid, [...L().places[cid].box] as Box);
      }
    } else {
      picked = null;
      showGhost();
      game.view.cameraOverride = null;
      stage.viewSize = saved.viewSize;
      stage.resize();
    }
    applyCamera();
    drawFootprints();
    render();
  };
  const resetView = () => {
    rebuildNav(w());
    view.reset(w());
    // the batch keeps per-slot scales across a reset: un-hide every slot
    for (const id of w().stations.keys()) view.batch.setScale(id, 1, 1);
    drawFootprints();
  };
  const cancel = () => {
    for (const [id, s] of start) place(id, s);
    for (const [cid, b] of startCashier) L().places[cid] = { ...L().places[cid], box: b };
    resetView();
    setOpen(false);
  };
  const done = () => {
    const b = bill();
    if (b.n > movesLeft()) return say(`Only ${movesLeft()} Moves left`);
    if (b.total > w().money) return say(`Need $${b.total}, you have $${Math.floor(w().money)}`);
    w().money -= b.total;
    usedMoves += b.n;
    w().navDirty = true;
    setOpen(false);
  };
  const say = (text: string) => {
    flash = text;
    flashUntil = performance.now() + 2200;
    render();
  };

  // ---------- picking and dragging
  const ray = new THREE.Raycaster();
  const ground = (e: { clientX: number; clientY: number }) => {
    ray.setFromCamera(
      new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1),
      stage.camera,
    );
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  };
  const stationAtPoint = (x: number, z: number) =>
    [...w().stations.values()]
      .filter((s) => inBox(x, z, s.box, 0.2))
      .sort((a, b) => a.box[2] * a.box[3] - b.box[2] * b.box[3])[0];
  const snap = (v: number) => Math.round(v * 2) / 2;
  const moveTo = (cx: number, cz: number) => {
    if (!picked) return;
    const b = picked.spot.box;
    const box: Box = [snap(cx - b[2] / 2), snap(cz - b[3] / 2), b[2], b[3]];
    picked.spot = { box, rot: picked.spot.rot };
    picked.problem = problem(picked.id, picked.spot);
    showGhost();
    render();
  };
  const pick = (st: Station) => {
    if (picked) drop();
    picked = { id: st.id, spot: { box: [...st.box] as Box, rot: st.rot }, problem: null };
    hideOriginal(st.id, true);
    showGhost();
    render();
  };
  /** Drop the picked fixture: on a valid spot it lands there, otherwise it goes back. */
  const drop = () => {
    if (!picked) return;
    const { id, spot } = picked;
    const st = w().stations.get(id)!;
    const was: Spot = { box: [...st.box] as Box, rot: st.rot };
    let why = picked.problem;
    if (!why) {
      place(id, spot);
      why = cutOff();
      if (why) place(id, was);
    }
    if (why) say(`${why}: it goes back`);
    picked = null;
    showGhost();
    resetView();
    render();
  };
  const rotate = () => {
    if (!picked) return;
    picked.spot = { box: turned(picked.spot.box), rot: ((picked.spot.rot + 90) % 360) as Rot };
    const [cx, cz] = boxCentre(picked.spot.box);
    moveTo(cx, cz);
  };
  const putBack = () => {
    const id = picked?.id;
    if (!id) return;
    picked = null;
    place(id, start.get(id)!);
    const cid = cashierOf(id);
    if (cid && startCashier.has(cid)) L().places[cid] = { ...L().places[cid], box: startCashier.get(cid)! };
    showGhost();
    resetView();
    render();
  };

  let drag: {
    pan: boolean;
    startX: number;
    startY: number;
    from: THREE.Vector3;
    focus: THREE.Vector3;
    offset: [number, number];
    moved: boolean;
  } | null = null;
  const onUi = (e: Event) =>
    !!(e.target as HTMLElement).closest?.('#edit-panel, .lil-gui, #proto-bar, #proto-dump, .office, .overlay');
  addEventListener('pointerdown', (e) => {
    if (!open || onUi(e)) return;
    const p = ground(e);
    if (!p) return;
    const onPicked = picked && inBox(p.x, p.z, picked.spot.box, 0.3);
    const hit = stationAtPoint(p.x, p.z);
    if (!onPicked && hit && movable(hit) && (!picked || hit.id !== picked.id)) pick(hit);
    const [cx, cz] = picked ? boxCentre(picked.spot.box) : [0, 0];
    drag = {
      pan: !picked || (!onPicked && !(hit && movable(hit))),
      startX: e.clientX,
      startY: e.clientY,
      from: p.clone(),
      focus: focus.clone(),
      offset: [cx - p.x, cz - p.z],
      moved: false,
    };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) drag.moved = true;
    const p = ground(e);
    if (!p) return;
    if (drag.pan) {
      focus.copy(drag.focus).sub(p.clone().sub(drag.from));
      drag.focus.copy(focus);
      drag.from.copy(ground(e) ?? p);
      return;
    }
    moveTo(p.x + drag.offset[0], p.z + drag.offset[1]);
  });
  addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!open || !d) return;
    if (!d.pan && d.moved) return drop();
    // a plain tap on empty floor with something picked: place it there
    if (d.pan && !d.moved && picked && P.tapToPlace) {
      const p = ground(e);
      if (p) {
        moveTo(p.x, p.z);
        drop();
      }
    }
  });
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.code === 'KeyR') rotate();
    else if (e.code === 'Escape') (picked ? putBack : cancel)();
    else if (e.code === 'Enter') done();
  });

  // ---------- the Edit Layout panel (the real UI) and prototype chrome
  const style = document.createElement('style');
  style.textContent = `
    #proto-bar{position:fixed;left:12px;bottom:12px;z-index:20;display:flex;gap:6px;
      background:#3a2416e6;padding:6px;border-radius:12px;font:600 13px system-ui;color:#fff1d0}
    #proto-bar button{font:inherit;border:0;border-radius:8px;padding:6px 10px;background:#fff1d0;color:#3a2416;cursor:pointer}
    #proto-bar button.on{background:#f26b1d;color:#fff}
    #proto-label{position:fixed;left:12px;top:12px;z-index:20;background:#3a2416e6;color:#fff1d0;padding:6px 10px;
      border-radius:8px;font:600 12px system-ui;white-space:pre;pointer-events:none}
    #proto-dump{position:fixed;inset:10% 20%;z-index:30;background:#fff1d0;color:#3a2416;padding:16px;border-radius:12px;
      font:12px ui-monospace,monospace;white-space:pre;overflow:auto;display:none}
    #edit-panel{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:25;display:none;flex-direction:column;
      gap:8px;align-items:stretch;width:min(560px,calc(100vw - 32px));font:600 16px Fredoka,system-ui,sans-serif;color:#3a2416}
    #edit-panel .card{background:#fff1d0;border:3px solid #3a2416;border-radius:16px;padding:10px 14px;box-shadow:0 4px 0 #3a2416}
    #edit-panel .row{display:flex;gap:8px;flex-wrap:wrap}
    #edit-panel button{flex:1;font:inherit;border:3px solid #3a2416;border-radius:12px;padding:8px 10px;background:#fff1d0;
      color:#3a2416;box-shadow:0 3px 0 #3a2416;cursor:pointer;min-width:90px}
    #edit-panel button.go{background:#2f9e4f;color:#fff1d0}
    #edit-panel button:disabled{opacity:.45}
    #edit-panel .why{background:#d63c2f;color:#fff1d0;border-color:#3a2416}
    #edit-panel small{font-weight:500;opacity:.8}`;
  document.head.append(style);
  const panel = document.createElement('div');
  panel.id = 'edit-panel';
  for (const ev of ['pointerdown', 'pointerup']) panel.addEventListener(ev, (e) => e.stopPropagation());
  const bar = document.createElement('div');
  bar.id = 'proto-bar';
  const label = document.createElement('div');
  label.id = 'proto-label';
  const dump = document.createElement('div');
  dump.id = 'proto-dump';
  dump.onclick = () => (dump.style.display = 'none');
  document.body.append(panel, bar, label, dump);
  for (const el of [bar, dump]) el.addEventListener('pointerdown', (e) => e.stopPropagation());

  const render = () => {
    const b = bill();
    const left = movesLeft();
    const why = picked?.problem ?? (performance.now() < flashUntil ? flash : '');
    const head = picked
      ? `<b>${nice(picked.id)}</b> <small>— drag it${P.tapToPlace ? ' or tap a spot' : ''}, ⟲ to turn</small>`
      : `<b>Edit Layout</b> <small>— tap a fixture to pick it up</small>`;
    const priceText = b.n
      ? `${b.n} Move${b.n > 1 ? 's' : ''}: ${b.prices.map((p) => '$' + p).join(' + ')} = <b>$${b.total}</b>`
      : 'No Moves yet';
    const canDone = b.n <= left && b.total <= w().money;
    panel.innerHTML = `
      ${why ? `<div class="card why">✋ ${why}</div>` : ''}
      <div class="card">${head}<br><small>Moves left: <b>${left}</b> · ${priceText} · next Move $${MOVE_PRICES[usedMoves + b.n] ?? '—'}</small></div>
      <div class="row">
        ${picked ? `<button data-a="rotate">⟲ Turn</button><button data-a="putback">↩ Put back</button>` : ''}
        <button data-a="cancel">✕ Cancel</button>
        <button data-a="done" class="go" ${canDone ? '' : 'disabled'}>✓ Done${b.total ? ` · $${b.total}` : ''}</button>
      </div>`;
    for (const btn of panel.querySelectorAll('button'))
      btn.onclick = () => ({ rotate, putback: putBack, cancel, done })[btn.dataset.a as 'rotate']();
  };

  // the Office panel shows an "Edit Layout" button through this hook (src/ui/app.tsx)
  Object.assign(window, { protoEditLayout: { open: () => setOpen(true) } });

  const gui = new GUI({ title: 'PROTOTYPE · Edit Layout (live)' });
  gui.domElement.style.zIndex = '26';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (innerWidth < 700) gui.close();
  const select = (v: string) => {
    variant = v;
    Object.assign(P, PRESETS[v].params);
    url.searchParams.set('layout', v);
    history.replaceState(null, '', url);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    for (const btn of bar.querySelectorAll('button')) btn.classList.toggle('on', btn.dataset.v === v);
    applyCamera();
    drawFootprints();
  };
  for (const v of VARIANTS) {
    const btn = document.createElement('button');
    btn.textContent = v;
    btn.dataset.v = v;
    btn.title = PRESETS[v].name;
    btn.onclick = () => select(v);
    bar.append(btn);
  }
  const editBtn = document.createElement('button');
  editBtn.textContent = '✎ Edit Layout';
  editBtn.onclick = () => (open ? cancel() : setOpen(true));
  const dumpBtn = document.createElement('button');
  dumpBtn.textContent = 'Dump';
  dumpBtn.onclick = () => {
    dump.textContent = `// layout=${variant} — ${PRESETS[variant].name}\n${JSON.stringify(P, null, 2)}\n// Moves used ${usedMoves}`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(editBtn, dumpBtn);
  gui.add(P, 'camera', ['game', 'top', 'tilt']).onChange(applyCamera);
  gui.add(P, 'ghostLift', 0, 1, 0.05).name('ghost lift (m)').onChange(showGhost);
  gui.add(P, 'doorKeepClear', 0, 3, 0.25).name('keep door fronts clear (m)');
  gui.add(P, 'showAllFootprints').name('show footprints').onChange(drawFootprints);
  gui.add(P, 'tapToPlace').name('tap a spot to place');
  const cheats = {
    money: () => (w().money += 2000),
    unlockAll: async () => {
      const m = await import('../sim/economy');
      for (const id of Object.keys(w().map.pads)) m.own(w(), id, true);
    },
    resetMoves: () => (usedMoves = 0),
  };
  gui.add(cheats, 'money').name('+$2000');
  gui.add(cheats, 'unlockAll').name('unlock all');
  gui.add(cheats, 'resetMoves').name('reset Moves used');

  const tick = () => {
    label.textContent =
      `PROTOTYPE · layout=${variant}\n${PRESETS[variant].name}\n` +
      `${open ? 'EDITING (paused)' : 'playing — open from the Office or ✎'} · $${Math.floor(w().money)} · Moves used ${usedMoves}`;
    if (open && ghost) ghost.position.y = P.ghostLift + Math.sin(performance.now() / 180) * 0.04;
    if (open && !picked && flash && performance.now() > flashUntil) {
      flash = '';
      render();
    }
    requestAnimationFrame(tick);
  };
  select(variant);
  requestAnimationFrame(tick);
}
