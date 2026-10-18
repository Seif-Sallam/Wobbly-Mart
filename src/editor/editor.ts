// wobbly-mart-layout-editor — dev builds only (`npm run dev`): V toggles (and saves on exit), `?edit` opens on load.
// One edit mode at a time (Stations, Props, Areas, Walls & doors, Ground); the pointer only sees that mode's things.
import * as THREE from 'three';
import GUI, { type Controller } from 'lil-gui';
import type { Box, DoorKind, MapDef, MapLayout, Point, PropDef, Rot, WallKind } from '../sim/map';
import type { MapSave } from '../sim/save';
import type { Game } from '../app/game';
import { validateMap, type ReleasedIds } from '../sim/validate';
import { boxCentre, distToBox, footprint, inBox } from '../sim/geometry';
import { fieldFor } from '../sim/walk';
import { cellCentre } from '../sim/nav';
import { TUNING } from '../sim/tuning';
import { ASSETS, PROP_MODELS } from '../../catalog/assets';
import { PALETTE, SHADES } from '../palette';
import { MAPS, mapById } from '../../maps';
import RELEASED from '../../maps/released-ids.json';

type ItemRef =
  | { kind: 'place' | 'wall' | 'door' | 'prop'; id: string }
  | { kind: 'area'; id: string; i: number }
  | { kind: 'floor' | 'street' | 'road' | 'car'; i: number }
  | { kind: 'spot'; list: 'streetSpots' | 'waitingSpots'; i: number }
  | { kind: 'van' | 'start' };
type Kind = ItemRef['kind'];

type Mode = 'stations' | 'props' | 'areas' | 'walls' | 'ground';
const MODES: { id: Mode; label: string; kinds: Kind[] }[] = [
  { id: 'stations', label: 'Stations', kinds: ['place'] },
  { id: 'props', label: 'Props', kinds: ['prop'] },
  { id: 'areas', label: 'Areas', kinds: ['area'] },
  { id: 'walls', label: 'Walls & doors', kinds: ['wall', 'door'] },
  { id: 'ground', label: 'Ground', kinds: ['floor', 'street', 'road', 'car', 'spot', 'van', 'start'] },
];
const WALL_KINDS: WallKind[] = ['tall', 'low', 'partition', 'window'];
const DOOR_KINDS: DoorKind[] = ['customer', 'back', 'office'];

const SPOT = 0.6;
/** Thin things (walls, doors, small Props) are pickable within at least this square (m). */
const PICK_MIN = 0.8;
const MIN_SIZE = 0.2;
/** Outline widths in screen pixels. */
const OUTLINE = { idle: 2, problem: 4, hover: 4, selected: 6 };
const HELP =
  'click select · drag move · ⇧drag resize · R rotate · ⌫ delete · A add at cursor · arrows nudge · V save & exit';

export interface EditorHost {
  game: Game;
  /** Restart the current map fresh from the save. */
  reopen: () => void;
  /** While editing, the app must not save the fully built preview over the player's progress. */
  editing: (on: boolean) => void;
}

let host: EditorHost | null = null;
let parentGui: GUI | null = null;
let editor: Editor | null = null;
let saving = false;

/** Called once by the app in dev builds. */
export function installEditor(h: EditorHost): void {
  host = h;
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyV' || (e.target as HTMLElement).closest('input, textarea')) return;
    void toggleEditor();
  });
  if (new URLSearchParams(location.search).has('edit')) void toggleEditor();
}

/** The debug panel hosts the editor's controls when it is open. */
export function addEditor(gui: GUI): void {
  parentGui = gui;
  gui.add({ toggle: () => void toggleEditor() }, 'toggle').name('layout editor [V] (saves on exit)');
}

/** Leaving always saves layout.ts; a failed save keeps the editor open so nothing is lost. */
async function toggleEditor(): Promise<void> {
  if (!host || saving) return;
  if (editor) {
    saving = true;
    const ok = await editor.save();
    saving = false;
    if (!ok) return;
    editor.close();
    editor = null;
    host.editing(false);
    host.reopen();
  } else {
    host.editing(true);
    editor = new Editor(host);
  }
}

function key(r: ItemRef): string {
  switch (r.kind) {
    case 'place':
    case 'wall':
    case 'door':
    case 'prop':
      return r.id;
    case 'area':
      return `${r.id} #${r.i + 1}`;
    case 'spot':
      return `${r.list} #${r.i + 1}`;
    case 'van':
    case 'start':
      return r.kind === 'van' ? 'van' : 'player start';
    default:
      return `${r.kind} #${r.i + 1}`;
  }
}

const same = (a: ItemRef | null, b: ItemRef | null): boolean => !!a && !!b && a.kind === b.kind && key(a) === key(b);

function allItems(L: MapLayout): ItemRef[] {
  const out: ItemRef[] = [];
  for (const id of Object.keys(L.places)) out.push({ kind: 'place', id });
  for (const id of Object.keys(L.walls)) out.push({ kind: 'wall', id });
  for (const id of Object.keys(L.doors)) out.push({ kind: 'door', id });
  for (const id of Object.keys(L.props)) out.push({ kind: 'prop', id });
  for (const [id, rects] of Object.entries(L.areas)) rects.forEach((_, i) => out.push({ kind: 'area', id, i }));
  L.floors.forEach((_, i) => out.push({ kind: 'floor', i }));
  L.street.forEach((_, i) => out.push({ kind: 'street', i }));
  L.roads.forEach((_, i) => out.push({ kind: 'road', i }));
  L.carSpots.forEach((_, i) => out.push({ kind: 'car', i }));
  L.streetSpots.forEach((_, i) => out.push({ kind: 'spot', list: 'streetSpots', i }));
  L.waitingSpots.forEach((_, i) => out.push({ kind: 'spot', list: 'waitingSpots', i }));
  out.push({ kind: 'van' }, { kind: 'start' });
  return out;
}

const pointBox = (p: Point): Box => [p[0] - SPOT / 2, p[1] - SPOT / 2, SPOT, SPOT];
const r2 = (v: number) => Math.round(v * 100) / 100;
const roundBox = (b: Box): Box => [r2(b[0]), r2(b[1]), r2(b[2]), r2(b[3])];
/** A box of size w×d centred on (x, z), snapped to 5 cm. */
const centred = (x: number, z: number, w: number, d: number): Box =>
  roundBox([Math.round((x - w / 2) * 20) / 20, Math.round((z - d / 2) * 20) / 20, w, d]);

function boxOf(L: MapLayout, r: ItemRef): Box {
  switch (r.kind) {
    case 'place':
      return L.places[r.id].box;
    case 'wall':
      return L.walls[r.id].box;
    case 'door':
      return L.doors[r.id].box;
    case 'prop':
      return L.props[r.id].box;
    case 'area':
      return L.areas[r.id][r.i];
    case 'floor':
      return L.floors[r.i];
    case 'street':
      return L.street[r.i];
    case 'road':
      return L.roads[r.i];
    case 'car':
      return L.carSpots[r.i].car;
    case 'van':
      return L.van;
    case 'spot':
      return pointBox(L[r.list][r.i]);
    case 'start':
      return pointBox(L.playerStart);
  }
}

function setBox(L: MapLayout, r: ItemRef, b: Box): void {
  b = roundBox(b);
  const old = boxOf(L, r);
  const dx = b[0] - old[0];
  const dz = b[1] - old[1];
  const centre = (p: Point): Point => [r2(p[0] + dx + (b[2] - old[2]) / 2), r2(p[1] + dz + (b[3] - old[3]) / 2)];
  switch (r.kind) {
    case 'place':
      L.places[r.id].box = b;
      break;
    case 'wall':
      L.walls[r.id].box = b;
      break;
    case 'door':
      L.doors[r.id].box = b;
      break;
    case 'prop':
      L.props[r.id].box = b;
      break;
    case 'area': {
      // moving an Area moves its Stations
      if (dx || dz)
        for (const p of Object.values(L.places)) {
          const [x, z] = boxCentre(p.box);
          if (inBox(x, z, old)) p.box = roundBox([p.box[0] + dx, p.box[1] + dz, p.box[2], p.box[3]]);
        }
      L.areas[r.id][r.i] = b;
      break;
    }
    case 'floor':
      L.floors[r.i] = b;
      break;
    case 'street':
      L.street[r.i] = b;
      break;
    case 'road':
      L.roads[r.i] = b;
      break;
    case 'car': {
      const s = L.carSpots[r.i];
      s.pickup = roundBox([s.pickup[0] + dx, s.pickup[1] + dz, s.pickup[2], s.pickup[3]]);
      s.car = b;
      break;
    }
    case 'van':
      L.van = b;
      break;
    case 'spot':
      L[r.list][r.i] = centre(L[r.list][r.i]);
      break;
    case 'start':
      L.playerStart = centre(L.playerStart);
      break;
  }
}

function rotate(L: MapLayout, r: ItemRef): void {
  const b = boxOf(L, r);
  const [cx, cz] = boxCentre(b);
  const turned = roundBox([cx - b[3] / 2, cz - b[2] / 2, b[3], b[2]]);
  const next = (rot: Rot): Rot => ((rot + 90) % 360) as Rot;
  if (r.kind === 'place') L.places[r.id] = { box: turned, rot: next(L.places[r.id].rot) };
  else if (r.kind === 'prop') L.props[r.id] = { ...L.props[r.id], box: turned, rot: next(L.props[r.id].rot) };
  else if (r.kind !== 'spot' && r.kind !== 'start') setBox(L, r, turned);
}

/** False when the thing can't be deleted (Stations, spots, an Area's last rect). */
function remove(L: MapLayout, r: ItemRef): boolean {
  if (r.kind === 'wall') delete L.walls[r.id];
  else if (r.kind === 'door') delete L.doors[r.id];
  else if (r.kind === 'prop') delete L.props[r.id];
  else if (r.kind === 'area' && L.areas[r.id].length > 1) L.areas[r.id].splice(r.i, 1);
  else if (r.kind === 'floor') L.floors.splice(r.i, 1);
  else if (r.kind === 'street') L.street.splice(r.i, 1);
  else if (r.kind === 'road') L.roads.splice(r.i, 1);
  else if (r.kind === 'car') L.carSpots.splice(r.i, 1);
  else return false;
  return true;
}

function unique(prefix: string, taken: object): string {
  let i = 1;
  while (`${prefix}${i}` in taken) i++;
  return `${prefix}${i}`;
}

function serialize(L: MapLayout): string {
  return `// Editor-owned: the layout editor rewrites this file whole on Save (hand comments are lost).
import type { MapLayout } from '../../src/sim/map';

export const layout: MapLayout = ${JSON.stringify(L, null, 2)};
`;
}

/** A save with everything bought: the editor shows the map fully built. */
function builtSave(map: MapDef): MapSave {
  return {
    money: 0,
    owned: [...Object.keys(map.layout.areas), ...Object.keys(map.pads)],
    paid: {},
    levels: {},
    roles: {},
  };
}

/** A flat ring just outside the box, `width` metres wide: real width, unlike WebGL lines. */
function outline(b: Box, width: number, color: string, opacity: number): THREE.Mesh {
  const [x, z, w, d] = b;
  const o = width;
  const shape = new THREE.Shape()
    .moveTo(x - o, z - o)
    .lineTo(x + w + o, z - o)
    .lineTo(x + w + o, z + d + o)
    .lineTo(x - o, z + d + o);
  shape.holes.push(
    new THREE.Path()
      .moveTo(x, z)
      .lineTo(x, z + d)
      .lineTo(x + w, z + d)
      .lineTo(x + w, z),
  );
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, side: THREE.DoubleSide }),
  );
  mesh.position.y = 0.15;
  return mesh;
}

class Editor {
  private baseMap: MapDef;
  private L: MapLayout;
  private undo: string[] = [];
  private mode: Mode = 'stations';
  private selected: ItemRef | null = null;
  private hovered: ItemRef | null = null;
  private cursor: THREE.Vector3 | null = null;
  private gui: GUI;
  private selGui: GUI | null = null;
  private addGui: GUI | null = null;
  private bar = document.createElement('div');
  private overlay = new THREE.Group();
  private problemIds = new Set<string>();
  private rebuildTimer = 0;
  private drag: {
    start: THREE.Vector3;
    box: Box;
    before: string;
    moved: boolean;
    resize: { x: number; z: number } | null;
    pan: boolean;
    focus: THREE.Vector3;
  } | null = null;
  private inspector = { item: '', x: 0, z: 0, w: 0, d: 0 };
  private pick: Controller | null = null;
  private controllers: Controller[] = [];
  private status = { problems: 'none', trip: '—' };
  private ui = { snapAlways: false, topDown: true, walk: false, outlines: true };
  private adding = { what: '', party: false };
  private focus = new THREE.Vector3();
  private listeners: [string, EventListener][] = [];

  private zoomBefore: number;

  constructor(private readonly host: EditorHost) {
    const game = host.game;
    this.zoomBefore = game.stage.viewSize;
    this.baseMap = game.world.map;
    this.L = structuredClone(this.baseMap.layout);
    const [W, H] = this.L.size;
    this.focus.set(W / 2, 0, H / 2);
    this.gui = parentGui ? parentGui.addFolder('Layout editor') : new GUI({ title: 'Layout editor' });
    this.gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.buildGui();
    this.buildModeBar();
    game.stage.scene.add(this.overlay);
    (document.getElementById('joy') as HTMLElement).style.pointerEvents = 'none';
    const on = (type: string, fn: EventListener) => {
      addEventListener(type, fn, { passive: false });
      this.listeners.push([type, fn]);
    };
    on('pointerdown', (e) => this.onDown(e as PointerEvent));
    on('pointermove', (e) => this.onMove(e as PointerEvent));
    on('pointerup', () => this.onUp());
    on('wheel', (e) => this.onWheel(e as WheelEvent));
    on('keydown', (e) => this.onKey(e as KeyboardEvent));
    this.setMode('stations');
    this.applyCamera();
    this.rebuild();
  }

  close(): void {
    const game = this.host.game;
    clearTimeout(this.rebuildTimer);
    for (const [type, fn] of this.listeners) removeEventListener(type, fn);
    game.stage.scene.remove(this.overlay);
    game.stage.topDown = false;
    game.stage.viewSize = this.zoomBefore;
    game.stage.resize();
    game.view.cameraOverride = null;
    (document.getElementById('joy') as HTMLElement).style.pointerEvents = '';
    document.body.style.cursor = '';
    this.bar.remove();
    this.gui.destroy();
  }

  /** Writes maps/<id>/layout.ts (and the in-memory map, so the reopened game shows it before Vite reloads). */
  async save(): Promise<boolean> {
    const id = this.baseMap.id;
    const res = await fetch('/__editor/save', {
      method: 'POST',
      body: JSON.stringify({ map: id, source: serialize(this.L) }),
    }).catch((e: Error) => new Response(e.message, { status: 500 }));
    if (!res.ok) {
      console.error('Layout save failed; the editor stays open:', await res.text());
      return false;
    }
    const map = mapById(id);
    if (map) map.layout = structuredClone(this.L);
    console.info(`Saved maps/${id}/layout.ts`);
    return true;
  }

  private map(): MapDef {
    return { ...this.baseMap, layout: this.L };
  }

  private kinds(): Kind[] {
    return MODES.find((m) => m.id === this.mode)?.kinds ?? [];
  }

  private modeItems(): ItemRef[] {
    const kinds = this.kinds();
    return allItems(this.L).filter((r) => kinds.includes(r.kind));
  }

  private buildModeBar(): void {
    const bar = this.bar;
    bar.className = 'editor-modes';
    bar.style.cssText = `position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:20;padding:6px;
      border-radius:12px;background:${PALETTE.ink};color:${PALETTE.cream};font:600 13px system-ui;text-align:center`;
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:4px;justify-content:center';
    MODES.forEach((m, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1} ${m.label}`;
      b.dataset.mode = m.id;
      b.onclick = () => this.setMode(m.id);
      row.append(b);
    });
    const help = document.createElement('div');
    help.textContent = HELP;
    help.style.cssText = 'font-weight:400;font-size:11px;opacity:.8;margin-top:4px';
    bar.append(row, help);
    document.body.append(bar);
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.hovered = null;
    for (const b of this.bar.querySelectorAll('button')) {
      const on = b.dataset.mode === mode;
      b.style.cssText = `border:0;border-radius:8px;padding:6px 10px;cursor:pointer;font:inherit;
        background:${on ? PALETTE.pad : 'transparent'};color:${on ? PALETTE.ink : PALETTE.cream}`;
    }
    this.buildAddGui();
    this.select(null);
  }

  private buildGui(): void {
    const g = this.gui;
    g.add(this.ui, 'topDown')
      .name('top-down camera')
      .onChange(() => this.applyCamera());
    g.add(this.ui, 'snapAlways').name('always snap (else hold ⌘)');
    g.add(this.ui, 'outlines')
      .name('show outlines')
      .onChange(() => this.drawOverlay());
    g.add(this.ui, 'walk')
      .name('walk around')
      .onChange((on: boolean) => {
        this.host.game.paused = !on;
        this.host.game.view.cameraOverride = on ? null : this.focus;
        (document.getElementById('joy') as HTMLElement).style.pointerEvents = on ? '' : 'none';
      });
    g.add(this.status, 'problems').listen().disable();
    g.add(this.status, 'trip').name('avg trip (m)').listen().disable();
    this.pick = g
      .add(this.inspector, 'item', [])
      .name('select')
      .onChange((name: string) => this.select(this.modeItems().find((r) => key(r) === name) ?? null));
    this.controllers = (['x', 'z', 'w', 'd'] as const).map((k) =>
      g
        .add(this.inspector, k)
        .step(0.05)
        .onFinishChange(() => this.fromInspector()),
    );
    g.add({ rotate: () => this.mutate(() => this.selected && rotate(this.L, this.selected)) }, 'rotate').name(
      'rotate [R]',
    );
    g.add({ del: () => this.deleteSelected() }, 'del').name('delete [⌫]');
    g.add({ undo: () => this.popUndo() }, 'undo').name('undo [⌘Z]');
  }

  /** What this mode can add, by name; each adds at (x, z) and returns the new thing. */
  private adders(): Record<string, (x: number, z: number) => ItemRef> {
    const L = this.L;
    const rect = (list: Box[], kind: 'floor' | 'street' | 'road') => (x: number, z: number) => {
      list.push(centred(x, z, 2, 2));
      return { kind, i: list.length - 1 } as ItemRef;
    };
    switch (this.mode) {
      case 'props':
        return Object.fromEntries(PROP_MODELS.map((m) => [m, (x: number, z: number) => this.addProp(m, x, z)]));
      case 'walls':
        return {
          ...Object.fromEntries(
            WALL_KINDS.map((kind) => [
              `${kind} wall`,
              (x: number, z: number): ItemRef => {
                const id = unique(kind === 'tall' || kind === 'low' ? 'wall_' : `${kind}_`, L.walls);
                L.walls[id] = { kind, box: centred(x, z, 3, 0.3) };
                return { kind: 'wall', id };
              },
            ]),
          ),
          ...Object.fromEntries(
            DOOR_KINDS.map((kind) => [
              `${kind} door`,
              (x: number, z: number): ItemRef => {
                const id = unique(`door_${kind}_`, L.doors);
                L.doors[id] = { kind, box: centred(x, z, 2.5, 0.3) };
                return { kind: 'door', id };
              },
            ]),
          ),
        };
      case 'areas':
        return Object.fromEntries(
          Object.keys(L.areas).map((id) => [
            `rect of ${id}`,
            (x: number, z: number): ItemRef => {
              L.areas[id].push(centred(x, z, 4, 4));
              return { kind: 'area', id, i: L.areas[id].length - 1 };
            },
          ]),
        );
      case 'ground':
        return {
          floor: rect(L.floors, 'floor'),
          Street: rect(L.street, 'street'),
          road: rect(L.roads, 'road'),
          'Car Spot': (x, z) => {
            L.carSpots.push({ car: centred(x, z, 3, 1.8), pickup: centred(x, z + 2.5, 1.5, 1.5) });
            return { kind: 'car', i: L.carSpots.length - 1 };
          },
        };
      default:
        return {};
    }
  }

  /** Sized like the same model elsewhere; inside an Area it belongs to that Area (hidden while locked). */
  private addProp(model: string, x: number, z: number): ItemRef {
    const L = this.L;
    const party = this.adding.party;
    const sample = [...Object.values(L.props), ...MAPS.flatMap((m) => Object.values(m.layout.props))].find(
      (p) => p.model === model,
    );
    const [w, d] = sample ? footprint(sample.box, sample.rot) : [1, 1];
    const area = Object.keys(L.areas).find((id) => L.areas[id].some((b) => inBox(x, z, b)));
    const id = unique(`${party ? 'party' : 'prop'}_${model.replace(/-/g, '_')}_`, L.props);
    L.props[id] = {
      model,
      box: centred(x, z, w, d),
      rot: 0,
      solid: sample?.solid ?? !party,
      ...(party ? { party: true } : area ? { area } : {}),
    };
    return { kind: 'prop', id };
  }

  private buildAddGui(): void {
    this.addGui?.destroy();
    this.addGui = null;
    const names = Object.keys(this.adders());
    if (!names.length) return;
    const f = (this.addGui = this.gui.addFolder(`Add (${MODES.find((m) => m.id === this.mode)?.label})`));
    if (!names.includes(this.adding.what)) this.adding.what = names[0];
    f.add(this.adding, 'what', names).name('add');
    if (this.mode === 'props') f.add(this.adding, 'party').name('as Party Prop');
    f.add({ go: () => this.addAt(this.focus.x, this.focus.z) }, 'go').name('add at view centre (A: at cursor)');
  }

  private addAt(x: number, z: number): void {
    const add = this.adders()[this.adding.what];
    if (!add) return;
    let made: ItemRef | null = null;
    this.mutate(() => (made = add(x, z)));
    this.select(made);
  }

  /** Per-kind settings of the selected thing: wall/door kind, Prop model, solidity, Party, Area. */
  private buildSelGui(): void {
    this.selGui?.destroy();
    this.selGui = null;
    const r = this.selected;
    if (!r || (r.kind !== 'wall' && r.kind !== 'door' && r.kind !== 'prop')) return;
    const f = (this.selGui = this.gui.addFolder(`Selected: ${r.id}`));
    if (r.kind === 'wall')
      f.add({ kind: this.L.walls[r.id].kind }, 'kind', WALL_KINDS).onChange((k: WallKind) =>
        this.mutate(() => (this.L.walls[r.id].kind = k)),
      );
    if (r.kind === 'door')
      f.add({ kind: this.L.doors[r.id].kind }, 'kind', DOOR_KINDS).onChange((k: DoorKind) =>
        this.mutate(() => (this.L.doors[r.id].kind = k)),
      );
    if (r.kind !== 'prop') return;
    const p = this.L.props[r.id];
    const models = PROP_MODELS.includes(p.model) ? PROP_MODELS : [p.model, ...PROP_MODELS];
    const o = { model: p.model, solid: p.solid, party: !!p.party, area: p.area ?? '' };
    const set = (fn: (p: PropDef) => void) => this.mutate(() => fn(this.L.props[r.id]));
    f.add(o, 'model', models).onChange((m: string) => set((p) => (p.model = m)));
    f.add(o, 'solid').onChange((v: boolean) => set((p) => (p.solid = v)));
    f.add(o, 'party')
      .name('Party Prop')
      .onChange((v: boolean) => set((p) => (v ? (p.party = true) : delete p.party)));
    f.add(o, 'area', ['', ...Object.keys(this.L.areas)])
      .name('shown with Area')
      .onChange((a: string) => set((p) => (a ? (p.area = a) : delete p.area)));
  }

  private applyCamera(): void {
    const stage = this.host.game.stage;
    stage.topDown = this.ui.topDown;
    const [W, H] = this.L.size;
    stage.viewSize = this.ui.topDown ? Math.max(H, W / (innerWidth / innerHeight)) + 4 : (W + H) * 0.6;
    stage.resize();
    if (!this.ui.walk) this.host.game.view.cameraOverride = this.focus;
    this.drawOverlay();
  }

  private mutate(fn: () => void): void {
    this.undo.push(JSON.stringify(this.L));
    fn();
    this.toInspector();
    this.rebuild();
  }

  private popUndo(): void {
    const last = this.undo.pop();
    if (!last) return;
    this.L = JSON.parse(last) as MapLayout;
    this.select(null);
    this.rebuild();
  }

  private deleteSelected(): void {
    const r = this.selected;
    if (!r) return;
    const before = JSON.stringify(this.L);
    if (!remove(this.L, r)) return void console.warn(`${key(r)} can't be deleted`);
    this.undo.push(before);
    this.select(null);
    this.rebuild();
  }

  private select(r: ItemRef | null): void {
    const changed = !same(r, this.selected) || !r;
    this.selected = r;
    this.toInspector();
    if (changed) this.buildSelGui();
    this.drawOverlay();
  }

  private toInspector(): void {
    this.pick?.options(this.modeItems().map(key));
    const r = this.selected;
    if (r) {
      const [x, z, w, d] = boxOf(this.L, r);
      Object.assign(this.inspector, { item: key(r), x, z, w, d });
    } else Object.assign(this.inspector, { item: '', x: 0, z: 0, w: 0, d: 0 });
    this.pick?.updateDisplay();
    this.controllers.forEach((c) => c.updateDisplay());
  }

  private fromInspector(): void {
    const r = this.selected;
    if (!r) return;
    const { x, z, w, d } = this.inspector;
    this.mutate(() => setBox(this.L, r, [x, z, Math.max(MIN_SIZE, w), Math.max(MIN_SIZE, d)]));
  }

  /** Validator + trip meter on every edit; the world is rebuilt fully built (debounced). */
  private rebuild(): void {
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => {
      const map = this.map();
      const found = validateMap(map, ASSETS, (RELEASED as Record<string, ReleasedIds>)[map.id]);
      this.problemIds = new Set(found.map((p) => p.id));
      this.status.problems = found.length ? `${found.length} — see console` : 'none';
      if (found.length) console.warn('Layout problems:\n' + found.map((p) => `${p.id}: ${p.message}`).join('\n'));
      const game = this.host.game;
      game.open(map, builtSave(map));
      game.view.rebuildLevel();
      game.view.level.showParty(true);
      game.paused = !this.ui.walk;
      if (!this.ui.walk) game.view.cameraOverride = this.focus;
      this.status.trip = this.tripLength();
      this.drawOverlay();
    }, 120);
  }

  /** Average one-way walk between Stations that feed each other (nearest pair per chain leg). */
  private tripLength(): string {
    const w = this.host.game.world;
    const legs: number[] = [];
    const producers = [...w.stations.values()].filter((s) => s.kind === 'producer');
    const productOut = (id: string) => {
      const s = w.stations.get(id);
      return s?.kind === 'producer' ? w.map.producers[s.type].output : null;
    };
    const outputs = new Set(producers.map((p) => productOut(p.id)));
    for (const product of outputs) {
      if (!product) continue;
      const sources = producers.filter((p) => productOut(p.id) === product);
      const sinks = [...w.stations.values()].filter(
        (s) =>
          (s.kind === 'shelf' && s.product === product) ||
          (s.kind === 'producer' && w.map.producers[s.type].inputs.includes(product)),
      );
      const sinkTypes = new Set(sinks.map((s) => (s.kind === 'shelf' ? s.id : s.kind === 'producer' ? s.type : '')));
      for (const t of sinkTypes) {
        let best = Infinity;
        for (const sink of sinks.filter(
          (s) => (s.kind === 'shelf' ? s.id : s.kind === 'producer' ? s.type : '') === t,
        )) {
          const f = fieldFor(w, 'walker', { station: sink.id });
          for (const src of sources)
            for (let i = 0; i < f.length; i++) {
              if (f[i] < best && distToBox(...cellCentre(w.nav.walker, i), src.box) < TUNING.reach + 0.3) best = f[i];
            }
        }
        if (best < Infinity) legs.push(best);
      }
    }
    return legs.length ? (legs.reduce((a, b) => a + b, 0) / legs.length).toFixed(1) : '—';
  }

  /** This mode's things faintly, problems in red, hover and selection thick. */
  private drawOverlay(): void {
    for (const c of [...this.overlay.children]) {
      const m = c as THREE.Mesh;
      this.overlay.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    const stage = this.host.game.stage;
    const px = stage.viewSize / Math.min(innerWidth, innerHeight);
    const kinds = this.kinds();
    for (const r of allItems(this.L)) {
      const sel = same(r, this.selected);
      const hov = same(r, this.hovered);
      const bad = 'id' in r && this.problemIds.has(r.id);
      const style: [number, string, number] | null = sel
        ? [OUTLINE.selected, PALETTE.pad, 1]
        : hov
          ? [OUTLINE.hover, SHADES.glass, 1]
          : bad
            ? [OUTLINE.problem, SHADES.angry, 0.9]
            : this.ui.outlines && kinds.includes(r.kind)
              ? [OUTLINE.idle, r.kind === 'area' ? PALETTE.orange : SHADES.white, 0.55]
              : null;
      if (!style) continue;
      const mesh = outline(boxOf(this.L, r), style[0] * px, style[1], style[2]);
      mesh.renderOrder = sel ? 23 : hov ? 22 : 21;
      this.overlay.add(mesh);
    }
  }

  private ground(e: { clientX: number; clientY: number }): THREE.Vector3 {
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.host.game.stage.camera);
    return (
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3()) ?? new THREE.Vector3()
    );
  }

  /** This mode's thing under (x, z): nearest box first (thin ones padded to PICK_MIN), then smallest. */
  private hitAt(x: number, z: number): ItemRef | null {
    const hits = this.modeItems()
      .map((r) => {
        const b = boxOf(this.L, r);
        const pad: Box = [
          b[0] - Math.max(0, PICK_MIN - b[2]) / 2,
          b[1] - Math.max(0, PICK_MIN - b[3]) / 2,
          Math.max(b[2], PICK_MIN),
          Math.max(b[3], PICK_MIN),
        ];
        return { r, b, hit: inBox(x, z, pad), dist: distToBox(x, z, b) };
      })
      .filter((h) => h.hit)
      .sort((a, b) => a.dist - b.dist || a.b[2] * a.b[3] - b.b[2] * b.b[3]);
    return hits[0]?.r ?? null;
  }

  private overUi(e: Event): boolean {
    return !!(e.target as HTMLElement).closest?.('.lil-gui, .editor-modes');
  }

  private onDown(e: PointerEvent): void {
    if (this.overUi(e) || this.ui.walk) return;
    const p = this.ground(e);
    const hit = this.hitAt(p.x, p.z);
    if (hit) this.select(hit);
    const box = hit ? boxOf(this.L, hit) : ([0, 0, 0, 0] as Box);
    let resize: { x: number; z: number } | null = null;
    if (hit && e.shiftKey) {
      // drag the edges nearest the grab point; walls and doors only stretch along their length
      const [cx, cz] = boxCentre(box);
      resize = { x: p.x < cx ? -1 : 1, z: p.z < cz ? -1 : 1 };
      if (hit.kind === 'wall' || hit.kind === 'door') {
        if (box[2] >= box[3]) resize.z = 0;
        else resize.x = 0;
      }
    }
    const before = JSON.stringify(this.L);
    this.drag = { start: p, box, before, moved: false, resize, pan: !hit, focus: this.focus.clone() };
  }

  private onMove(e: PointerEvent): void {
    if (this.overUi(e)) return;
    const p = this.ground(e);
    this.cursor = p;
    const drag = this.drag;
    if (!drag) {
      if (this.ui.walk) return;
      const hov = this.hitAt(p.x, p.z);
      document.body.style.cursor = hov ? 'move' : 'grab';
      if (!same(hov, this.hovered)) {
        this.hovered = hov;
        this.drawOverlay();
      }
      return;
    }
    if (!drag.moved) {
      if (Math.hypot(p.x - drag.start.x, p.z - drag.start.z) < 0.05) return;
      drag.moved = true;
      if (!drag.pan) this.undo.push(drag.before);
    }
    if (drag.pan) {
      this.focus.copy(drag.focus).sub(p.clone().sub(drag.start));
      drag.focus.copy(this.focus);
      return;
    }
    const r = this.selected;
    if (!r) return;
    const snap = this.ui.snapAlways || e.metaKey || e.ctrlKey;
    const q = (v: number) => (snap ? Math.round(v * 2) / 2 : Math.round(v * 20) / 20);
    const dx = p.x - drag.start.x;
    const dz = p.z - drag.start.z;
    const b = drag.box;
    let next: Box = [q(b[0] + dx), q(b[1] + dz), b[2], b[3]];
    if (drag.resize) {
      // an edge snaps; the opposite edge stays put
      const edge = (start: number, size: number, d: number, side: number): [number, number] => {
        if (side > 0) return [start, Math.max(MIN_SIZE, q(start + size + d) - start)];
        if (side < 0) {
          const s = Math.min(q(start + d), start + size - MIN_SIZE);
          return [s, start + size - s];
        }
        return [start, size];
      };
      const [x, w] = edge(b[0], b[2], dx, drag.resize.x);
      const [z, d] = edge(b[1], b[3], dz, drag.resize.z);
      next = [x, z, w, d];
    }
    setBox(this.L, r, next);
    this.toInspector();
    this.drawOverlay();
  }

  private onUp(): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    if (drag.pan && !drag.moved) this.select(null);
    else if (!drag.pan && drag.moved) this.rebuild();
  }

  private onWheel(e: WheelEvent): void {
    if (this.overUi(e)) return;
    const stage = this.host.game.stage;
    stage.viewSize = Math.min(120, Math.max(6, stage.viewSize * (1 + Math.sign(e.deltaY) * 0.1)));
    stage.resize();
    this.drawOverlay();
  }

  private onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).closest('input, textarea, select') || this.ui.walk) return;
    const r = this.selected;
    const mode = /^Digit([1-9])$/.exec(e.code);
    const arrows: Record<string, Point> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (mode && MODES[Number(mode[1]) - 1]) this.setMode(MODES[Number(mode[1]) - 1].id);
    else if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey)) this.popUndo();
    else if (e.code === 'KeyR' && r) this.mutate(() => rotate(this.L, r));
    else if ((e.code === 'Delete' || e.code === 'Backspace') && r) this.deleteSelected();
    else if (e.code === 'KeyA' && this.cursor) this.addAt(this.cursor.x, this.cursor.z);
    else if (e.code in arrows && r) {
      const step = e.shiftKey ? 0.5 : 0.05;
      const [ax, az] = arrows[e.code];
      const b = boxOf(this.L, r);
      this.mutate(() => setBox(this.L, r, [b[0] + ax * step, b[1] + az * step, b[2], b[3]]));
    } else if (e.code === 'Escape') this.select(null);
  }
}
