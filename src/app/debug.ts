// `?debug`: lil-gui panel (lazy-loaded) — live tuning, cheats, render counts. Dev builds add the layout editor.
import { INPUT_CAP } from '../../catalog/producers';
import type { Game } from './game';
import { FEEL } from '../feel';
import { TUNING } from '../sim/tuning';
import { own } from '../sim/economy';
import { areaOf } from '../sim/walk';

const BUDGET = { phone: { calls: 100, triangles: 150_000 }, desktop: { calls: 300, triangles: 500_000 } };

/** App hooks the panel needs: `resetMap` wipes the current Map's save and reopens it fresh; `openMaps` opens every Map. */
export interface DebugHooks {
  resetMap: () => void;
  openMaps: () => void;
}

export async function openDebug(game: Game, phone: boolean, hooks: DebugHooks): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const gui = new GUI({ title: 'Debug' });
  gui.domElement.style.zIndex = '10';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (innerWidth < 700) gui.close();

  const stats = { fps: 0, calls: 0, triangles: 0 };
  const fStats = gui.addFolder('Render');
  fStats.add(stats, 'fps').listen().disable();
  fStats.add(stats, 'calls').name('draw calls').listen().disable();
  fStats.add(stats, 'triangles').listen().disable();
  const budget = phone ? BUDGET.phone : BUDGET.desktop;
  let warned = 0;
  let last = performance.now();
  const sample = () => {
    const now = performance.now();
    stats.fps = Math.round(1000 / Math.max(1, now - last));
    last = now;
    const info = game.stage.renderer.info.render;
    stats.calls = info.calls;
    if (cheats.noCustomers) game.world.arrivalTimer = Infinity;
    stats.triangles = info.triangles;
    if ((info.calls > budget.calls || info.triangles > budget.triangles) && now - warned > 5000) {
      warned = now;
      console.warn(
        `Over render budget: ${info.calls} draw calls / ${info.triangles} triangles (budget ${budget.calls} / ${budget.triangles})`,
      );
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);

  const cheats = {
    noCustomers: false,
    money100: () => (game.world.money += 100),
    money1000: () => (game.world.money += 1000),
    unlockAll: () => {
      const w = game.world;
      for (const id of Object.keys(w.map.pads)) own(w, id, true);
      for (const [id, up] of Object.entries(w.map.upgrades)) w.levels[id] = up.levels.length;
    },
    // every Pad in the Areas owned now, the next Area's Pad among them; not the new Area's own Pads
    buyToNextArea: () => {
      const w = game.world;
      const here = new Set(Object.keys(w.map.layout.areas).filter((a) => w.owned.has(a)));
      for (const [id, pad] of Object.entries(w.map.pads)) {
        const place = w.map.layout.places[id];
        if (place && pad.unlocks.kind !== 'exit' && here.has(areaOf(w, place.box) ?? '')) own(w, id, true);
      }
    },
    fillProducers: () => {
      const w = game.world;
      for (const st of w.stations.values()) {
        if (st.kind !== 'producer') continue;
        const type = w.map.producers[st.type];
        for (const p of type.inputs) st.input[p] = INPUT_CAP;
        st.tray = type.trayCap ?? st.tray;
        st.plants.fill(0);
      }
    },
    resetMap: () => hooks.resetMap(),
    openMaps: () => hooks.openMaps(),
  };
  const fCheat = gui.addFolder('Cheats');
  fCheat.add(cheats, 'money100').name('+$100');
  fCheat.add(cheats, 'money1000').name('+$1,000');
  fCheat.add(cheats, 'unlockAll').name('unlock all');
  fCheat.add(cheats, 'buyToNextArea').name('buy until next Area');
  fCheat
    .add(cheats, 'noCustomers')
    .name('no new Customers')
    .onChange((v: boolean) => !v && (game.world.arrivalTimer = 0));
  fCheat.add(cheats, 'fillProducers').name('fill Animals & Machines');
  fCheat.add(cheats, 'resetMap').name('reset this Map');
  fCheat.add(cheats, 'openMaps').name('open all Maps');
  fCheat.add(game, 'speed', 0.25, 30, 0.25).name('sim speed');

  const fFeel = gui.addFolder('Feel (feel.ts)').close();
  for (const [k, v] of Object.entries(FEEL)) if (typeof v === 'number') fFeel.add(FEEL, k as keyof typeof FEEL);
  const fTuning = gui.addFolder('Tuning (tuning.ts)').close();
  for (const [k, v] of Object.entries(TUNING)) if (typeof v === 'number') fTuning.add(TUNING, k as keyof typeof TUNING);
  const fBase = fTuning.addFolder('Base values');
  for (const k of Object.keys(TUNING.base)) fBase.add(TUNING.base, k as keyof typeof TUNING.base);
  fFeel
    .add(game.stage, 'viewSize', 8, 40, 0.5)
    .name('view size (m)')
    .onChange(() => game.stage.resize());

  if (import.meta.env.DEV) {
    const { addEditor } = await import('../editor/editor');
    addEditor(gui);
  }
}
