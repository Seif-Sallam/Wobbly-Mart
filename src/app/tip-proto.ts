// PROTOTYPE (#77 "Gentler Tipping in each Map's first Area"), throwaway: `?tip=a|b|c|d` picks how much gentler Tipping
// is until area_2 is owned. A bottom bar switches live, a lil-gui panel tunes, "Dump values" prints the JSON.
import type { Game } from './game';
import { TUNING } from '../sim/tuning';
import { stackCap } from '../sim/economy';

const P = TUNING.tipProto;
type Knobs = Pick<typeof P, 'on' | 'safeBonus' | 'rateScale' | 'walkScale' | 'joltScale' | 'breakScale'>;
const OFF: Knobs = { on: false, safeBonus: 0, rateScale: 1, walkScale: 1, joltScale: 1, breakScale: 1 };
const PRESETS: Record<string, { label: string; hint: string; set: Knobs }> = {
  a: { label: 'A Today', hint: 'Area 1 tips like everywhere else.', set: OFF },
  b: {
    label: 'B Steadier',
    hint: 'Safe count +2: carry 5 before anything can fall.',
    set: { ...OFF, on: true, safeBonus: 2 },
  },
  c: {
    label: 'C Rarer',
    hint: 'Only sprinting tips, at a third of the rate, with softer turns and stops.',
    set: { ...OFF, on: true, rateScale: 0.35, walkScale: 0, joltScale: 0.5 },
  },
  d: {
    label: 'D Soft landing',
    hint: 'Still tips (a bit less) but nothing breaks: always a Loose Item, never a Mess.',
    set: { ...OFF, on: true, rateScale: 0.7, breakScale: 0 },
  },
};

export async function openTipProto(game: Game, variant: string): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  let current = PRESETS[variant] ? variant : 'a';

  const css = document.createElement('style');
  css.textContent = `
    .tp-bar{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:20;display:flex;gap:6px;
      background:#000a;padding:6px;border-radius:10px;font:600 13px system-ui}
    .tp-bar button{border:0;border-radius:7px;padding:7px 10px;background:#fff3;color:#fff;font:inherit}
    .tp-bar button.on{background:#ffb703;color:#222}
    .tp-info{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:20;background:#000a;color:#fff;
      padding:6px 10px;border-radius:8px;font:500 12px system-ui;max-width:90vw;text-align:center;pointer-events:none}`;
  document.head.append(css);

  const stop = (e: Event) => e.stopPropagation();
  const bar = document.createElement('div');
  bar.className = 'tp-bar';
  for (const t of ['pointerdown', 'touchstart', 'mousedown']) bar.addEventListener(t, stop);
  const info = document.createElement('div');
  info.className = 'tp-info';
  document.body.append(bar, info);

  const gui = new GUI({ title: 'Tipping prototype (#77)' });
  gui.domElement.style.zIndex = '20';
  gui.domElement.addEventListener('pointerdown', stop);
  if (innerWidth < 700) gui.close();
  const controllers = [
    gui.add(P, 'on').name('gentle on'),
    gui.add(P, 'onlyArea1').name('only before area_2'),
    gui.add(P, 'stockersToo').name('Stockers too'),
    gui.add(P, 'safeBonus', 0, 6, 1).name('safe +'),
    gui.add(P, 'rateScale', 0, 1, 0.05).name('rate ×'),
    gui.add(P, 'walkScale', 0, 1, 0.05).name('walking ×'),
    gui.add(P, 'joltScale', 0, 1, 0.05).name('turns/stops ×'),
    gui.add(P, 'breakScale', 0, 1, 0.05).name('break chance ×'),
  ];
  const resetStats = () => (game.world.tipProtoStats = { drops: 0, messes: 0 });
  const dump = () => {
    const json = JSON.stringify({ variant: current, ...P }, null, 2);
    console.log(json);
    void navigator.clipboard?.writeText(json).catch(() => {});
    alert(json);
  };
  gui.add({ resetStats }, 'resetStats').name('Reset drop count');
  gui.add({ dump }, 'dump').name('Dump values');

  const pick = (key: string) => {
    current = key;
    Object.assign(P, PRESETS[key].set);
    for (const c of controllers) c.updateDisplay();
    const url = new URL(location.href);
    url.searchParams.set('tip', key);
    history.replaceState(null, '', url);
    resetStats();
    bar.replaceChildren(
      ...Object.entries(PRESETS).map(([k, p]) => {
        const b = document.createElement('button');
        b.textContent = p.label;
        b.classList.toggle('on', k === current);
        b.onclick = () => pick(k);
        return b;
      }),
    );
  };
  const tick = () => {
    const w = game.world;
    const s = w.tipProtoState;
    const st = w.tipProtoStats ?? { drops: 0, messes: 0 };
    const perMin = ((s?.rate ?? 0) * 60).toFixed(1);
    info.textContent =
      `${PRESETS[current].hint} — ${s?.gentle ? 'GENTLE' : 'normal'} · Stack ${w.player.stack.length}/${stackCap(w)} ` +
      `safe ${s?.safe ?? '?'} · ~${perMin} drops/min now · this run: ${st.drops} fell, ${st.messes} Messes`;
    requestAnimationFrame(tick);
  };
  pick(current);
  tick();
}
