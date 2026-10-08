// PROTOTYPE (throwaway, branch prototype/camera-zoom): `?zoom=A|B|C` — camera zoom presets, a Settings-style slider,
// optional pinch / wheel shortcuts, live panel, value dump.
import type { Game } from './game';
import type { Input } from '../input/input';

interface Params {
  /** Metres shown across the screen's short side (today 20 everywhere). */
  phoneDefault: number;
  desktopDefault: number;
  /** Slider ends: closest and farthest (m). */
  closest: number;
  farthest: number;
  shortcut: boolean;
  /** Wheel: fraction of the current view per notch. Pinch: how strongly finger spread zooms. */
  wheelStep: number;
  pinchGain: number;
  /** How quickly the view eases to the wanted zoom (1/s). */
  ease: number;
}

const BASE: Params = {
  phoneDefault: 14,
  desktopDefault: 18,
  closest: 10,
  farthest: 26,
  shortcut: false,
  wheelStep: 0.08,
  pinchGain: 1,
  ease: 10,
};
const PRESETS: Record<string, { name: string; params: Params }> = {
  A: { name: 'Slider only: phone 14 m, desktop 18 m, range 10–26 m', params: { ...BASE } },
  B: {
    name: 'Slider + shortcut: same, plus pinch (phone) and wheel / + − (desktop)',
    params: { ...BASE, shortcut: true },
  },
  C: {
    name: 'Closer: phone 12 m, desktop 16 m, range 9–22 m, shortcut on',
    params: { ...BASE, phoneDefault: 12, desktopDefault: 16, closest: 9, farthest: 22, shortcut: true },
  },
};
const VARIANTS = Object.keys(PRESETS);

export async function openZoomPrototype(game: Game, input: Input, phone: boolean): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const url = new URL(location.href);
  let variant = url.searchParams.get('zoom') ?? 'A';
  if (!PRESETS[variant]) variant = 'A';
  const P: Params = { ...PRESETS[variant].params };
  const stage = game.stage;
  let want = phone ? P.phoneDefault : P.desktopDefault;
  const clamp = (v: number) => Math.min(P.farthest, Math.max(P.closest, v));

  // ---------- the Settings-style slider (closest on the left)
  const style = document.createElement('style');
  style.textContent = `
    #proto-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;display:flex;gap:6px;
      background:#3a2416e6;padding:6px;border-radius:12px;font:600 13px system-ui;color:#fff1d0}
    #proto-bar button{font:inherit;border:0;border-radius:8px;padding:6px 10px;background:#fff1d0;color:#3a2416;cursor:pointer}
    #proto-bar button.on{background:#f26b1d;color:#fff}
    #proto-label{position:fixed;left:12px;top:12px;z-index:20;background:#3a2416e6;color:#fff1d0;padding:6px 10px;
      border-radius:8px;font:600 12px system-ui;white-space:pre;pointer-events:none}
    #proto-dump{position:fixed;inset:10% 20%;z-index:30;background:#fff1d0;color:#3a2416;padding:16px;border-radius:12px;
      font:12px ui-monospace,monospace;white-space:pre;overflow:auto;display:none}
    #proto-zoom{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:20;display:flex;align-items:center;gap:10px;
      background:#fff1d0;color:#3a2416;padding:10px 14px;border-radius:14px;font:700 14px system-ui;box-shadow:0 3px 0 #3a2416}
    #proto-zoom input{width:min(220px,50vw);accent-color:#f26b1d}`;
  document.head.append(style);
  const bar = document.createElement('div');
  bar.id = 'proto-bar';
  const label = document.createElement('div');
  label.id = 'proto-label';
  const dump = document.createElement('div');
  dump.id = 'proto-dump';
  dump.onclick = () => (dump.style.display = 'none');
  const zoomBox = document.createElement('div');
  zoomBox.id = 'proto-zoom';
  zoomBox.innerHTML = `<span>🔍 Zoom</span><span>+</span><input type="range" step="0.5"><span>−</span>`;
  const slider = zoomBox.querySelector('input') as HTMLInputElement;
  document.body.append(bar, label, dump, zoomBox);
  for (const el of [bar, dump, zoomBox]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  // the slider reads closest → farthest left to right, so dragging right zooms out
  const syncSlider = () => {
    slider.min = String(P.closest);
    slider.max = String(P.farthest);
    slider.value = String(want);
  };
  slider.oninput = () => (want = clamp(Number(slider.value)));

  // ---------- shortcuts: wheel and + / − on desktop, two-finger pinch on touch
  addEventListener(
    'wheel',
    (e) => {
      if (!P.shortcut || (e.target as HTMLElement).closest?.('.lil-gui')) return;
      e.preventDefault();
      want = clamp(want * (1 + Math.sign(e.deltaY) * P.wheelStep));
      syncSlider();
    },
    { passive: false },
  );
  addEventListener('keydown', (e) => {
    if (!P.shortcut) return;
    if (e.key === '+' || e.key === '=') want = clamp(want * (1 - P.wheelStep));
    else if (e.key === '-' || e.key === '_') want = clamp(want * (1 + P.wheelStep));
    else return;
    syncSlider();
  });
  let pinch: { d: number; start: number } | null = null;
  let pinches = 0;
  const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  addEventListener(
    'touchstart',
    (e) => {
      if (!P.shortcut || e.touches.length !== 2) return;
      pinch = { d: spread(e.touches), start: want };
      input.enabled = false; // a pinch is never a joystick push
      pinches++;
    },
    { capture: true, passive: true },
  );
  addEventListener(
    'touchmove',
    (e) => {
      if (!pinch || e.touches.length !== 2) return;
      want = clamp(pinch.start * (pinch.d / spread(e.touches)) ** P.pinchGain);
      syncSlider();
    },
    { capture: true, passive: true },
  );
  addEventListener(
    'touchend',
    (e) => {
      if (pinch && e.touches.length < 2) {
        pinch = null;
        // let go of both fingers before the joystick wakes again
        setTimeout(() => (input.enabled = true), 150);
      }
    },
    { capture: true, passive: true },
  );

  // ---------- panel
  const gui = new GUI({ title: 'PROTOTYPE · Camera zoom (live)' });
  gui.domElement.style.zIndex = '20';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (innerWidth < 700) gui.close();

  const select = (v: string) => {
    variant = v;
    Object.assign(P, PRESETS[v].params);
    want = phone ? P.phoneDefault : P.desktopDefault;
    syncSlider();
    url.searchParams.set('zoom', v);
    history.replaceState(null, '', url);
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
  const dumpBtn = document.createElement('button');
  dumpBtn.textContent = 'Dump';
  dumpBtn.onclick = () => {
    dump.textContent = `// zoom=${variant} — ${PRESETS[variant].name}\n${JSON.stringify(P, null, 2)}\n// last zoom: ${want.toFixed(1)} m (${phone ? 'phone' : 'desktop'})`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(dumpBtn);

  const resetDefault = () => {
    want = phone ? P.phoneDefault : P.desktopDefault;
    syncSlider();
  };
  const fZoom = gui.addFolder('Zoom (m across the short side)');
  fZoom.add(P, 'phoneDefault', 6, 30, 0.5).name('phone default').onChange(resetDefault);
  fZoom.add(P, 'desktopDefault', 6, 30, 0.5).name('desktop default').onChange(resetDefault);
  fZoom.add(P, 'closest', 4, 20, 0.5).name('closest').onChange(syncSlider);
  fZoom.add(P, 'farthest', 12, 40, 0.5).name('farthest').onChange(syncSlider);
  fZoom.add(P, 'ease', 2, 30, 1).name('ease (1/s)');
  const fShort = gui.addFolder('Shortcut');
  fShort.add(P, 'shortcut').name('pinch / wheel / + −');
  fShort.add(P, 'wheelStep', 0.02, 0.3, 0.01).name('wheel step');
  fShort.add(P, 'pinchGain', 0.3, 2, 0.05).name('pinch gain');

  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const v = stage.viewSize + (want - stage.viewSize) * (1 - Math.exp(-P.ease * dt));
    if (Math.abs(v - stage.viewSize) > 1e-3) {
      stage.viewSize = v;
      stage.resize();
    }
    const info = stage.renderer.info.render;
    label.textContent =
      `PROTOTYPE · zoom=${variant} (${phone ? 'phone' : 'desktop'})\n${PRESETS[variant].name}\n` +
      `view ${stage.viewSize.toFixed(1)} m · wanted ${want.toFixed(1)} m · pinches ${pinches}\n` +
      `draw calls ${info.calls} · triangles ${info.triangles}`;
    requestAnimationFrame(tick);
  };

  select(variant);
  requestAnimationFrame(tick);
}
