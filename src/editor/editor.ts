// wobbly-mart-layout-editor — dev builds only (`npm run dev`): V toggles, `?edit` opens on load.
// Moves, resizes and rotates anything; adds/deletes purely visual things; Save rewrites maps/<id>/layout.ts.
import * as THREE from 'three';
import GUI, { type Controller } from 'lil-gui';
import type { Box, MapDef, MapLayout, Point, Rot } from '../sim/map';
import type { MapSave } from '../sim/save';
import type { Game } from '../app/game';
import { validateMap } from '../sim/validate';
import { boxCentre, distToBox } from '../sim/geometry';
import { fieldFor } from '../sim/walk';
import { cellCentre } from '../sim/nav';
import { TUNING } from '../sim/tuning';
import { ASSETS } from '../../catalog/assets';
import RELEASED from '../../maps/released-ids.json';

type ItemRef =
  | { kind: 'place' | 'wall' | 'door' | 'prop'; id: string }
  | { kind: 'area'; id: string; i: number }
  | { kind: 'floor' | 'street' | 'road' | 'car'; i: number }
  | { kind: 'spot'; list: 'streetSpots' | 'waitingSpots'; i: number }
  | { kind: 'van' | 'start' };

const SPOT = 0.6;
const DELETABLE = new Set(['wall', 'prop', 'floor', 'street', 'car']);

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

/** Called once by the app in dev builds. */
export function installEditor(h: EditorHost): void {
  host = h;
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyV' || (e.target as HTMLElement).closest('input, textarea')) return;
    toggleEditor();
  });
  if (new URLSearchParams(location.search).has('edit')) toggleEditor();
}

/** The debug panel hosts the editor's controls when it is open. */
export function addEditor(gui: GUI): void {
  parentGui = gui;
  gui.add({ toggle: toggleEditor }, 'toggle').name('layout editor [V]');
}

function toggleEditor(): void {
  if (!host) return;
  if (editor) {
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
  const old = boxOf(L, r);
  const dx = b[0] - old[0];
  const dz = b[1] - old[1];
  const centre = (p: Point): Point => [p[0] + dx + (b[2] - old[2]) / 2, p[1] + dz + (b[3] - old[3]) / 2];
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
          if (x >= old[0] && x <= old[0] + old[2] && z >= old[1] && z <= old[1] + old[3])
            p.box = [p.box[0] + dx, p.box[1] + dz, p.box[2], p.box[3]];
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
      s.pickup = [s.pickup[0] + dx, s.pickup[1] + dz, s.pickup[2], s.pickup[3]];
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
  const turned: Box = [cx - b[3] / 2, cz - b[2] / 2, b[3], b[2]];
  const next = (rot: Rot): Rot => ((rot + 90) % 360) as Rot;
  if (r.kind === 'place') L.places[r.id] = { box: turned, rot: next(L.places[r.id].rot) };
  else if (r.kind === 'prop') L.props[r.id] = { ...L.props[r.id], box: turned, rot: next(L.props[r.id].rot) };
  else if (r.kind !== 'spot' && r.kind !== 'start') setBox(L, r, turned);
}

function remove(L: MapLayout, r: ItemRef): void {
  if (r.kind === 'wall') delete L.walls[r.id];
  if (r.kind === 'prop') delete L.props[r.id];
  if (r.kind === 'floor') L.floors.splice(r.i, 1);
  if (r.kind === 'street') L.street.splice(r.i, 1);
  if (r.kind === 'car') L.carSpots.splice(r.i, 1);
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
    assignments: {},
  };
}

class Editor {
  private baseMap: MapDef;
  private L: MapLayout;
  private undo: string[] = [];
  private selected: ItemRef | null = null;
  private gui: GUI;
  private overlay = new THREE.Group();
  private problems: string[] = [];
  private problemIds = new Set<string>();
  private rebuildTimer = 0;
  private drag: { start: THREE.Vector3; box: Box; resize: boolean; pan: boolean; focus: THREE.Vector3 } | null = null;
  private inspector = { item: '', x: 0, z: 0, w: 0, d: 0 };
  private controllers: Controller[] = [];
  private status = { problems: 'none', trip: '—' };
  private ui = { snapAlways: false, topDown: true, walk: false, outlines: true };
  private focus = new THREE.Vector3();
  private listeners: [string, EventListener][] = [];

  constructor(private readonly host: EditorHost) {
    const game = host.game;
    this.baseMap = game.world.map;
    this.L = structuredClone(this.baseMap.layout);
    const [W, H] = this.L.size;
    this.focus.set(W / 2, 0, H / 2);
    this.gui = parentGui ? parentGui.addFolder('Layout editor') : new GUI({ title: 'Layout editor' });
    this.gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.buildGui();
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
    this.applyCamera();
    this.rebuild();
  }

  close(): void {
    const game = this.host.game;
    for (const [type, fn] of this.listeners) removeEventListener(type, fn);
    game.stage.scene.remove(this.overlay);
    game.stage.topDown = false;
    game.stage.viewSize = 20;
    game.stage.resize();
    game.view.cameraOverride = null;
    (document.getElementById('joy') as HTMLElement).style.pointerEvents = '';
    this.gui.destroy();
  }

  private map(): MapDef {
    return { ...this.baseMap, layout: this.L };
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
    const names = () => allItems(this.L).map(key);
    const pick = g.add(this.inspector, 'item', names()).name('select');
    pick.onChange((name: string) => this.select(allItems(this.L).find((r) => key(r) === name) ?? null));
    this.controllers = (['x', 'z', 'w', 'd'] as const).map((k) =>
      g
        .add(this.inspector, k)
        .step(0.1)
        .onFinishChange(() => this.fromInspector()),
    );
    g.add({ rotate: () => this.mutate(() => this.selected && rotate(this.L, this.selected)) }, 'rotate').name(
      'rotate [R]',
    );
    g.add({ del: () => this.deleteSelected() }, 'del').name('delete visual thing [⌫]');
    const add = g.addFolder('Add');
    const at = (): Box => [Math.round(this.focus.x) - 1, Math.round(this.focus.z) - 1, 2, 2];
    const unique = (prefix: string, taken: object) => {
      let i = 1;
      while (`${prefix}${i}` in taken) i++;
      return `${prefix}${i}`;
    };
    add
      .add(
        {
          f: () =>
            this.mutate(
              () =>
                (this.L.walls[unique('wall_new', this.L.walls)] = {
                  kind: 'tall',
                  box: [...at().slice(0, 2), 3, 0.3] as Box,
                }),
            ),
        },
        'f',
      )
      .name('wall');
    add
      .add(
        {
          f: () =>
            this.mutate(
              () =>
                (this.L.walls[unique('window_new', this.L.walls)] = {
                  kind: 'window',
                  box: [...at().slice(0, 2), 2, 0.3] as Box,
                }),
            ),
        },
        'f',
      )
      .name('counter window');
    add
      .add(
        {
          f: () =>
            this.mutate(
              () =>
                (this.L.props[unique('prop_new', this.L.props)] = { model: 'plant', box: at(), rot: 0, solid: true }),
            ),
        },
        'f',
      )
      .name('decor Prop');
    add
      .add(
        {
          f: () =>
            this.mutate(
              () =>
                (this.L.props[unique('party_new', this.L.props)] = {
                  model: 'flag',
                  box: at(),
                  rot: 0,
                  solid: false,
                  party: true,
                }),
            ),
        },
        'f',
      )
      .name('Party Prop');
    add.add({ f: () => this.mutate(() => this.L.floors.push(at())) }, 'f').name('floor');
    add.add({ f: () => this.mutate(() => this.L.street.push(at())) }, 'f').name('Street');
    add
      .add(
        {
          f: () =>
            this.mutate(() =>
              this.L.carSpots.push({
                car: [...at().slice(0, 2), 3.4, 1.8] as Box,
                pickup: [at()[0], at()[1] - 3, 1.5, 1.5],
              }),
            ),
        },
        'f',
      )
      .name('Car Spot');
    const propModel = { model: 'plant' };
    add
      .add(
        propModel,
        'model',
        Object.keys(ASSETS).filter((k) => ASSETS[k].path),
      )
      .name('selected Prop model')
      .onChange((m: string) => {
        const r = this.selected;
        if (r?.kind === 'prop') this.mutate(() => (this.L.props[r.id].model = m));
      });
    g.add({ undo: () => this.popUndo() }, 'undo').name('undo [⌘Z]');
    g.add({ save: () => void this.save() }, 'save').name('💾 Save layout.ts');
    this.gui.onChange(() => pick.options(names()));
  }

  private applyCamera(): void {
    const stage = this.host.game.stage;
    stage.topDown = this.ui.topDown;
    const [W, H] = this.L.size;
    stage.viewSize = this.ui.topDown ? Math.max(H, W / (innerWidth / innerHeight)) + 4 : (W + H) * 0.6;
    stage.resize();
    if (!this.ui.walk) this.host.game.view.cameraOverride = this.focus;
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
    this.selected = null;
    this.rebuild();
  }

  private deleteSelected(): void {
    const r = this.selected;
    if (!r || !DELETABLE.has(r.kind)) return;
    if (r.kind === 'wall' && this.L.walls[r.id] === undefined) return;
    this.mutate(() => remove(this.L, r));
    this.selected = null;
  }

  private select(r: ItemRef | null): void {
    this.selected = r;
    this.toInspector();
    this.drawOverlay();
  }

  private toInspector(): void {
    const r = this.selected;
    if (!r) return;
    const [x, z, w, d] = boxOf(this.L, r);
    Object.assign(this.inspector, { item: key(r), x, z, w, d });
    this.controllers.forEach((c) => c.updateDisplay());
  }

  private fromInspector(): void {
    const r = this.selected;
    if (!r) return;
    const { x, z, w, d } = this.inspector;
    this.mutate(() => setBox(this.L, r, [x, z, Math.max(0.1, w), Math.max(0.1, d)]));
  }

  /** Validator + trip meter on every edit; the world is rebuilt fully built (debounced). */
  private rebuild(): void {
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => {
      const map = this.map();
      const found = validateMap(map, ASSETS, (RELEASED as Record<string, string[]>)[map.id] ?? []);
      this.problems = found.map((p) => `${p.id}: ${p.message}`);
      this.problemIds = new Set(found.map((p) => p.id));
      this.status.problems = found.length ? `${found.length} — see console` : 'none';
      if (found.length) console.warn('Layout problems:\n' + this.problems.join('\n'));
      const game = this.host.game;
      game.open(map, builtSave(map), true);
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

  private drawOverlay(): void {
    for (const c of [...this.overlay.children]) {
      this.overlay.remove(c);
      (c as THREE.LineSegments).geometry?.dispose();
    }
    for (const r of allItems(this.L)) {
      const sel = this.selected && key(this.selected) === key(r);
      const bad = 'id' in r && this.problemIds.has(r.id);
      if (!sel && !bad && !this.ui.outlines) continue;
      const [x, z, w, d] = boxOf(this.L, r);
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.05, d));
      const color = sel ? '#ffe066' : bad ? '#ff2a2a' : r.kind === 'area' ? '#f26b1d' : '#ffffff';
      const line = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: sel || bad ? 1 : 0.35, depthTest: false }),
      );
      line.position.set(x + w / 2, 0.12, z + d / 2);
      line.renderOrder = 20;
      this.overlay.add(line);
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

  private onDown(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('.lil-gui') || this.ui.walk) return;
    const p = this.ground(e);
    // smallest thing under the pointer wins
    const hits = allItems(this.L)
      .map((r) => ({ r, b: boxOf(this.L, r) }))
      .filter(({ b }) => p.x >= b[0] && p.x <= b[0] + b[2] && p.z >= b[1] && p.z <= b[1] + b[3])
      .sort((a, b) => a.b[2] * a.b[3] - b.b[2] * b.b[3]);
    const hit = hits[0]?.r ?? null;
    this.select(hit);
    const box = hit ? boxOf(this.L, hit) : ([0, 0, 0, 0] as Box);
    if (hit) this.undo.push(JSON.stringify(this.L));
    this.drag = { start: p, box, resize: e.shiftKey, pan: !hit, focus: this.focus.clone() };
  }

  private onMove(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    const p = this.ground(e);
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
    const next: Box = drag.resize
      ? [b[0], b[1], Math.max(0.2, q(b[2] + dx)), Math.max(0.2, q(b[3] + dz))]
      : [q(b[0] + dx), q(b[1] + dz), b[2], b[3]];
    setBox(this.L, r, next);
    this.toInspector();
    this.drawOverlay();
  }

  private onUp(): void {
    if (this.drag && !this.drag.pan && this.selected) this.rebuild();
    this.drag = null;
  }

  private onWheel(e: WheelEvent): void {
    if ((e.target as HTMLElement).closest('.lil-gui')) return;
    const stage = this.host.game.stage;
    stage.viewSize = Math.min(120, Math.max(6, stage.viewSize * (1 + Math.sign(e.deltaY) * 0.1)));
    stage.resize();
  }

  private onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey)) this.popUndo();
    else if (e.code === 'KeyR' && this.selected) this.mutate(() => this.selected && rotate(this.L, this.selected));
    else if ((e.code === 'Delete' || e.code === 'Backspace') && this.selected) this.deleteSelected();
    else if (e.code === 'Escape') this.select(null);
  }

  private async save(): Promise<void> {
    const res = await fetch('/__editor/save', {
      method: 'POST',
      body: JSON.stringify({ map: this.baseMap.id, source: serialize(this.L) }),
    });
    if (!res.ok) console.error('Layout save failed:', await res.text());
    else console.info(`Saved maps/${this.baseMap.id}/layout.ts`);
  }
}
