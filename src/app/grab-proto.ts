// PROTOTYPE (#76 "Taking before giving at Producers"), throwaway: `?grab=a|b|c|d` switches how the Player takes vs gives
// at Animals and Machines. A bottom bar switches live, a lil-gui panel tunes, "Dump values" prints the JSON.
import type { Game } from './game';
import { TUNING } from '../sim/tuning';

const G = TUNING.grabProto;
type Preset = Pick<typeof G, 'takeFirst' | 'giveGate'>;
const PRESETS: Record<string, { label: string; hint: string; set: Preset }> = {
  a: { label: 'A Today', hint: 'Loads your Stack first, then you take.', set: { takeFirst: false, giveGate: 'none' } },
  b: {
    label: 'B Take first',
    hint: 'Takes the whole Tray first, then loads.',
    set: { takeFirst: true, giveGate: 'none' },
  },
  c: {
    label: 'C Linger to give',
    hint: 'Takes at once; loads only after you stand still a moment. Walk past = no loading.',
    set: { takeFirst: true, giveGate: 'dwell' },
  },
  d: {
    label: 'D Give button',
    hint: 'Takes at once; loads only while you hold Give (Space on desktop).',
    set: { takeFirst: true, giveGate: 'button' },
  },
};

export async function openGrabProto(game: Game, variant: string): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  let current = PRESETS[variant] ? variant : 'a';

  const css = document.createElement('style');
  css.textContent = `
    .gp-bar{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:20;display:flex;gap:6px;
      background:#000a;padding:6px;border-radius:10px;font:600 13px system-ui}
    .gp-bar button{border:0;border-radius:7px;padding:7px 10px;background:#fff3;color:#fff;font:inherit}
    .gp-bar button.on{background:#ffb703;color:#222}
    .gp-info{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:20;background:#000a;color:#fff;
      padding:6px 10px;border-radius:8px;font:500 12px system-ui;max-width:90vw;text-align:center;pointer-events:none}
    .gp-give{position:fixed;right:24px;bottom:120px;z-index:20;width:96px;height:96px;border-radius:50%;border:0;
      background:#2a9d8f;color:#fff;font:800 18px system-ui;box-shadow:0 4px 0 #0004;touch-action:none}
    .gp-give.held{background:#e76f51;transform:translateY(3px)}`;
  document.head.append(css);

  const stop = (e: Event) => e.stopPropagation();
  const bar = document.createElement('div');
  bar.className = 'gp-bar';
  const info = document.createElement('div');
  info.className = 'gp-info';
  const give = document.createElement('button');
  give.className = 'gp-give';
  give.textContent = 'GIVE';
  for (const el of [bar, give])
    for (const t of ['pointerdown', 'touchstart', 'mousedown']) el.addEventListener(t, stop);
  const hold = (on: boolean) => (e: Event) => {
    e.preventDefault();
    G.giveHeld = on;
    give.classList.toggle('held', on);
  };
  give.addEventListener('pointerdown', hold(true));
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) give.addEventListener(t, hold(false));
  document.body.append(bar, info, give);

  const gui = new GUI({ title: 'Grab prototype (#76)' });
  gui.domElement.style.zIndex = '20';
  gui.domElement.addEventListener('pointerdown', stop);
  if (innerWidth < 700) gui.close();
  const controllers = [
    gui.add(G, 'takeFirst').name('take first'),
    gui.add(G, 'giveGate', ['none', 'dwell', 'button']).name('give gate'),
    gui.add(G, 'giveDwell', 0, 2, 0.05).name('linger s (C)'),
    gui.add(G, 'giveMaxSpeed', 0, 5.5, 0.1).name('linger max m/s (C)'),
  ];
  const dump = () => {
    const json = JSON.stringify(
      {
        variant: current,
        takeFirst: G.takeFirst,
        giveGate: G.giveGate,
        giveDwell: G.giveDwell,
        giveMaxSpeed: G.giveMaxSpeed,
      },
      null,
      2,
    );
    console.log(json);
    void navigator.clipboard?.writeText(json).catch(() => {});
    alert(json);
  };
  gui.add({ dump }, 'dump').name('Dump values');

  const pick = (key: string) => {
    current = key;
    Object.assign(G, PRESETS[key].set);
    for (const c of controllers) c.updateDisplay();
    const url = new URL(location.href);
    url.searchParams.set('grab', key);
    history.replaceState(null, '', url);
    render();
  };
  const render = () => {
    bar.replaceChildren(
      ...Object.entries(PRESETS).map(([key, p]) => {
        const b = document.createElement('button');
        b.textContent = p.label;
        b.classList.toggle('on', key === current);
        b.onclick = () => pick(key);
        return b;
      }),
    );
  };
  const tick = () => {
    const s = game.world.grabProtoState;
    give.style.display = G.giveGate === 'button' ? '' : 'none';
    const at = s?.at ? `at ${s.at}` : 'not at a Station';
    const gate = G.giveGate === 'dwell' ? ` · linger ${(s?.dwell ?? 0).toFixed(1)}/${G.giveDwell}s` : '';
    info.textContent = `${PRESETS[current].hint}  —  ${at}${gate} · give ${s?.giveOk ? 'ON' : 'off'}`;
    requestAnimationFrame(tick);
  };
  pick(current);
  tick();
}
