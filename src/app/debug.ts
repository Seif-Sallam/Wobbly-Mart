// `?debug`: lil-gui panel (lazy-loaded) — live tuning, cheats, render counts. Dev builds add the layout editor.
import type { Game } from './game';
import { FEEL } from '../feel';
import { TUNING } from '../sim/tuning';
import { own } from '../sim/economy';
import { Bot } from '../sim/bot';

const BUDGET = { phone: { calls: 100, triangles: 150_000 }, desktop: { calls: 300, triangles: 500_000 } };

export async function openDebug(game: Game, phone: boolean): Promise<void> {
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
    money100: () => (game.world.money += 100),
    money1000: () => (game.world.money += 1000),
    unlockAll: () => {
      const w = game.world;
      for (const id of Object.keys(w.map.pads)) own(w, id, true);
      for (const [id, up] of Object.entries(w.map.upgrades)) w.levels[id] = up.levels.length;
    },
    autopilot: false,
  };
  const fCheat = gui.addFolder('Cheats');
  fCheat.add(cheats, 'money100').name('+$100');
  fCheat.add(cheats, 'money1000').name('+$1,000');
  fCheat.add(cheats, 'unlockAll').name('unlock all');
  fCheat.add(game, 'speed', 0.25, 30, 0.25).name('sim speed');
  fCheat
    .add(cheats, 'autopilot')
    .name('bot plays')
    .onChange((on: boolean) => (game.autopilot = on ? new Bot() : null));

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
