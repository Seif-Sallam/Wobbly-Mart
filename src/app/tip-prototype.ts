// PROTOTYPE (throwaway, branch prototype/stack-tipping): `?tip=A|B|C` — Stack tipping presets, live panel, value dump.
import type { Game } from './game';
import { TUNING } from '../sim/tuning';
import { own, safeCount, stackCap } from '../sim/economy';

interface Params {
  maxRate: number;
  curve: number;
  cooldown: number;
  walkShare: number;
  joltBoost: number;
  breakChance: Record<string, number>;
}

const BREAK: Record<string, number> = {
  tomato: 0.7,
  egg: 0.9,
  ketchup: 0.25,
  wheat: 0.05,
  milk: 0.3,
  flour: 0.15,
  bread: 0.05,
};
const BASE: Params = {
  maxRate: TUNING.sprint.maxRate,
  curve: TUNING.sprint.curve,
  cooldown: TUNING.sprint.cooldown,
  walkShare: 0,
  joltBoost: 0,
  breakChance: BREAK,
};
const PRESETS: Record<string, { name: string; params: Params }> = {
  A: { name: 'Sprint only: tips by height while sprinting (today), each Product may break', params: { ...BASE } },
  B: { name: 'Walking tips too: a quarter of the sprint chance while walking', params: { ...BASE, walkShare: 0.25 } },
  C: {
    name: 'Jolts: sharp turns and sudden stops up to 3× likelier, walking a little too',
    params: { ...BASE, walkShare: 0.15, joltBoost: 2 },
  },
};
const VARIANTS = Object.keys(PRESETS);

export async function openTipPrototype(game: Game): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const url = new URL(location.href);
  let variant = url.searchParams.get('tip') ?? 'A';
  if (!PRESETS[variant]) variant = 'A';
  const P: Params = { ...PRESETS[variant].params, breakChance: { ...BREAK } };
  let loose = 0;
  let breaks = 0;
  let seenLoose = 0;
  let seenMess = 0;

  const apply = () => {
    Object.assign(TUNING.sprint, { maxRate: P.maxRate, curve: P.curve, cooldown: P.cooldown });
    Object.assign(TUNING.tip, { walkShare: P.walkShare, joltBoost: P.joltBoost });
    Object.assign(TUNING.tip.breakChance, P.breakChance);
  };
  const w = () => game.world;
  const fill = (only?: string) => {
    const products = Object.keys(w().map.products);
    const st = w().player.stack;
    while (st.length < stackCap(w())) st.push(only ?? products[st.length % products.length]);
  };
  const tools = {
    fillMixed: () => fill(),
    fillEggs: () => fill('egg'),
    fillTomatoes: () => fill('tomato'),
    fillBread: () => fill('bread'),
    fillMilk: () => fill('milk'),
    empty: () => (w().player.stack.length = 0),
    maxStack: () => (w().levels.stack_cap = w().map.upgrades.stack_cap.levels.length),
    unlockAll: () => {
      for (const id of Object.keys(w().map.pads)) own(w(), id, true);
    },
    clearFloor: () => {
      for (const m of w().messes) w().events.push({ type: 'messCleared', mess: m.id });
      w().messes.length = 0;
      w().loose.length = 0;
    },
  };

  const style = document.createElement('style');
  style.textContent = `
    #proto-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;display:flex;gap:6px;
      background:#3a2416e6;padding:6px;border-radius:12px;font:600 13px system-ui;color:#fff1d0}
    #proto-bar button{font:inherit;border:0;border-radius:8px;padding:6px 10px;background:#fff1d0;color:#3a2416;cursor:pointer}
    #proto-bar button.on{background:#f26b1d;color:#fff}
    #proto-label{position:fixed;left:12px;top:12px;z-index:20;background:#3a2416e6;color:#fff1d0;padding:6px 10px;
      border-radius:8px;font:600 12px system-ui;white-space:pre;pointer-events:none}
    #proto-dump{position:fixed;inset:10% 20%;z-index:30;background:#fff1d0;color:#3a2416;padding:16px;border-radius:12px;
      font:12px ui-monospace,monospace;white-space:pre;overflow:auto;display:none}`;
  document.head.append(style);
  const bar = document.createElement('div');
  bar.id = 'proto-bar';
  const label = document.createElement('div');
  label.id = 'proto-label';
  const dump = document.createElement('div');
  dump.id = 'proto-dump';
  dump.onclick = () => (dump.style.display = 'none');
  document.body.append(bar, label, dump);
  for (const el of [bar, dump]) el.addEventListener('pointerdown', (e) => e.stopPropagation());

  const gui = new GUI({ title: 'PROTOTYPE · Stack tipping (live)' });
  gui.domElement.style.zIndex = '20';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (innerWidth < 700) gui.close();

  const select = (v: string) => {
    variant = v;
    Object.assign(P, PRESETS[v].params, { breakChance: { ...PRESETS[v].params.breakChance } });
    url.searchParams.set('tip', v);
    history.replaceState(null, '', url);
    apply();
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    for (const b of bar.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v);
  };
  for (const v of VARIANTS) {
    const b = document.createElement('button');
    b.textContent = v;
    b.dataset.v = v;
    b.title = PRESETS[v].name;
    b.onclick = () => select(v);
    bar.append(b);
  }
  const fillBtn = document.createElement('button');
  fillBtn.textContent = 'Fill';
  fillBtn.onclick = () => tools.fillMixed();
  const dumpBtn = document.createElement('button');
  dumpBtn.textContent = 'Dump';
  dumpBtn.onclick = () => {
    dump.textContent = `// tip=${variant} — ${PRESETS[variant].name}\n${JSON.stringify(P, null, 2)}`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(fillBtn, dumpBtn);

  const fTip = gui.addFolder('Tipping');
  fTip.add(P, 'maxRate', 0, 2, 0.05).name('full-Stack drops /s').onChange(apply);
  fTip.add(P, 'curve', 0.5, 4, 0.1).name('height curve').onChange(apply);
  fTip.add(P, 'cooldown', 0, 4, 0.1).name('cooldown s').onChange(apply);
  fTip.add(P, 'walkShare', 0, 1, 0.05).name('walking share').onChange(apply);
  fTip.add(P, 'joltBoost', 0, 4, 0.1).name('jolt boost').onChange(apply);
  const fBreak = gui.addFolder('Break into a Mess (chance)');
  for (const k of Object.keys(P.breakChance)) fBreak.add(P.breakChance, k, 0, 1, 0.05).onChange(apply);
  const fTools = gui.addFolder('Tools');
  fTools.add(tools, 'fillMixed').name('fill Stack: mixed');
  fTools.add(tools, 'fillEggs').name('fill Stack: eggs');
  fTools.add(tools, 'fillTomatoes').name('fill Stack: tomatoes');
  fTools.add(tools, 'fillBread').name('fill Stack: bread');
  fTools.add(tools, 'fillMilk').name('fill Stack: milk');
  fTools.add(tools, 'empty').name('empty Stack');
  fTools.add(tools, 'maxStack').name('max Stack Upgrade (16)');
  fTools.add(tools, 'unlockAll').name('unlock all');
  fTools.add(tools, 'clearFloor').name('clear Messes + Loose Items');

  const tick = () => {
    const W = w();
    const p = W.player;
    if (W.loose.length > seenLoose) loose += W.loose.length - seenLoose;
    if (W.messes.length > seenMess) breaks += W.messes.length - seenMess;
    seenLoose = W.loose.length;
    seenMess = W.messes.length;
    const safe = safeCount(W);
    const cap = stackCap(W);
    const n = p.stack.length;
    const k = n > safe ? (n - safe) / Math.max(1, cap - safe) : 0;
    const moving = Math.hypot(p.vx, p.vz) > 0.5;
    const share = p.sprinting ? 1 : moving ? P.walkShare : 0;
    const rate = P.maxRate * share * (1 + P.joltBoost * Math.min(1, p.jolt ?? 0)) * k ** P.curve;
    label.textContent =
      `PROTOTYPE · tip=${variant}\n${PRESETS[variant].name}\n` +
      `Stack ${n}/${cap} · safe ${safe} · ${p.sprinting ? 'SPRINT' : moving ? 'walk' : 'still'} · jolt ${(p.jolt ?? 0).toFixed(2)}\n` +
      `tip chance now ${rate.toFixed(2)}/s\nfell loose ${loose} · broke into a Mess ${breaks}`;
    requestAnimationFrame(tick);
  };

  select(variant);
  requestAnimationFrame(tick);
}
