// PROTOTYPE (throwaway, branch prototype/landscape): `?land=C1|C2|C3` — playing on a phone, landscape and portrait:
// C's corner HUD in landscape, compact title / Settings / Office, a joystick that stays on screen, action buttons.
// "Phone" = touch, or a window under 500 px on its short side (desktop preview).
import type { Stage } from '../view/stage';
import type { Settings } from '../sim/save';
import type { Input } from '../input/input';
import type { Game } from './game';
import { FEEL } from '../feel';

type Hud = 'bar' | 'rails' | 'corner';
type Action = 'auto' | 'use' | 'takegive';
interface Params {
  /** Landscape HUD: bar = today's top bar; rails = stats down the left; corner = one cluster top-right. */
  hud: Hud;
  hudScale: number;
  bannerScale: number;
  bannerRight: boolean;
  /** Title, menus, Settings, Office and Edit Layout size on phones. */
  uiLand: number;
  uiPortrait: number;
  joySize: number;
  /** Portrait joystick size (today 110). */
  joyPortrait: number;
  /** Joystick rest centre, px from the bottom-left safe corner. */
  joyLeft: number;
  joyBottom: number;
  /** Landscape joystick touch area: share of the width from the left. Portrait keeps today's whole-screen joystick. */
  joyZoneLand: number;
  /** Push past this share of the ring sprints (today 1.4). */
  sprintForce: number;
  /** auto = today (walk up, it happens); use = hold one button; takegive = hold Take or Give. */
  action: Action;
  btnSize: number;
  /** Metres across the height in landscape. */
  landZoom: number;
  nudgeX: number;
  officeWidth: number;
  officeLeft: boolean;
  padScale: number;
  /** Desktop preview only: fake notch on the left (px). */
  notch: number;
}

const C1: Params = {
  hud: 'corner',
  hudScale: 0.8,
  bannerScale: 0.7,
  bannerRight: true,
  uiLand: 0.68,
  uiPortrait: 0.85,
  joySize: 115,
  joyPortrait: 110,
  joyLeft: 110,
  joyBottom: 130,
  joyZoneLand: 0.45,
  sprintForce: 1.2,
  action: 'use',
  btnSize: 84,
  landZoom: 15,
  nudgeX: 0.05,
  officeWidth: 42,
  officeLeft: false,
  padScale: 1.25,
  notch: 0,
};
const PRESETS: Record<string, { name: string; params: Params }> = {
  C1: { name: 'One hold-to-Use button', params: C1 },
  C2: {
    name: 'Take and Give buttons',
    params: { ...C1, action: 'takegive' },
  },
  C3: {
    name: 'No buttons, walk-up grab as today',
    params: { ...C1, action: 'auto' },
  },
};
const VARIANTS = Object.keys(PRESETS);

interface AppGuts {
  stage: Stage;
  input: Input;
  game: Game | null;
  settings: Settings;
  editing: boolean;
  ui: { screen: string; overlay: string | null };
  openOverlay(o: string | null): void;
  zoom(): number;
  setZoom(metres: number): void;
}

let opened = false;

export async function openLandscapePrototype(): Promise<void> {
  if (opened) return;
  opened = true;
  const { default: GUI } = await import('lil-gui');
  const app = (window as unknown as { app: AppGuts }).app;
  const { stage, input } = app;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const url = new URL(location.href);
  let variant = url.searchParams.get('land') ?? 'C3';
  if (!PRESETS[variant]) variant = 'C3';
  const P: Params = { ...PRESETS[variant].params };
  const root = document.documentElement;
  const isPhone = () => coarse || Math.min(innerWidth, innerHeight) < 500;
  const isLand = () => innerWidth > innerHeight && isPhone();
  let land = isLand();
  let phone = isPhone();

  // Fullscreen needs a user gesture: any tap on the title enters it (so Play does), and in game, leaving it pauses behind
  // a "tap to play fullscreen" card. iPhone Safari has no Fullscreen API and an installed app is already fullscreen, so
  // neither is gated.
  const canFull = () =>
    phone &&
    !!document.documentElement.requestFullscreen &&
    !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  const goFull = () => {
    if (canFull() && !document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => {});
  };
  addEventListener('click', () => app.ui.screen !== 'game' && goFull(), true);
  let gatePaused = false;

  // With a joystick (Fixed or Free) taps never walk; Tap Walk is only for joystick Off.
  const tapWalk = input.onTap;
  input.onTap = (x, y, double) => {
    if (app.settings.joystick === 'off') tapWalk(x, y, double);
  };

  // ---------- zoom: landscape shows landZoom across the height, scaled by any pinch the Player made
  const portraitZoom = app.zoom.bind(app);
  const portraitSetZoom = app.setZoom.bind(app);
  const k = () => P.landZoom / (coarse ? FEEL.zoomPhone : FEEL.zoomDesktop);
  app.zoom = () => (land ? portraitZoom() * k() : portraitZoom());
  app.setZoom = (m) => portraitSetZoom(land ? m / k() : m);

  // ---------- framing: Office nudge follows the Office's width and side; nudgeX shifts the Player right
  const nudgeSet = stage.nudge.set.bind(stage.nudge);
  stage.nudge.set = (x, y) => {
    if (!land) return nudgeSet(x, y);
    const office = x ? ((P.officeLeft ? 1 : -1) * P.officeWidth) / 200 : 0;
    return nudgeSet(office + P.nudgeX, y);
  };

  // ---------- CSS. html.ph = phone (both ways), html.pl = phone landscape. Zoomed boxes use % not vh/vw: Chrome
  // scales viewport units by zoom, Safari doesn't.
  const style = document.createElement('style');
  style.textContent = `
    html.ph{--sl:max(env(safe-area-inset-left),var(--notch));--sr:env(safe-area-inset-right);
      --st:env(safe-area-inset-top);--sb:env(safe-area-inset-bottom)}

    /* compact screens */
    html.ph .title,html.ph .modal,html.ph .office,html.ph .layout-panel{zoom:var(--uis)}
    html.ph .logo{width:min(620px,92%)}
    html.ph .modal{display:flex;align-items:center;justify-content:center}
    html.ph .panel{max-height:100%}
    html.ph .office.sheet{height:46%}
    html.ph .layout-panel{width:min(560px,calc(100% - 32px))}
    html.pl .title{gap:10px;padding-top:4px;padding-bottom:4px}
    html.pl .title .logo{width:min(400px,55%)}
    html.pl .menu{flex-direction:row;width:auto}
    html.pl .panel.settings{display:grid;grid-template-columns:1fr 1fr;width:min(780px,100%);align-items:start}
    html.pl .panel.settings>h2,html.pl .panel.settings>.back{grid-column:1/3}
    html.pl .office.side{width:calc(var(--ow) * 1%);padding:56px calc(14px + var(--sr)) 14px 14px}
    html.pl.office-left .office.side{left:0;right:auto;border-radius:0 26px 26px 0;box-shadow:4px 0 0 var(--ink);
      padding-left:calc(14px + var(--sl));padding-right:14px}
    html.pl.office-left .office .x{right:auto;left:calc(10px + var(--sl))}

    /* HUD */
    html.pl .hud-top{left:calc(var(--sl) + 12px);right:calc(var(--sr) + 12px);top:calc(var(--st) + 8px)}
    html.pl .event-cards{left:calc(var(--sl) + 12px)}
    html.ph .event-banner,html.ph .report-card,html.ph .tutor{zoom:var(--bs)}
    html.pl.rails .hud-top{display:grid;grid-template-columns:auto 1fr auto;justify-items:start;row-gap:8px}
    html.pl.rails .completion{grid-area:1/1;width:150px}
    html.pl.rails .money{grid-area:2/1;position:static;transform:none}
    html.pl.rails .gear{grid-area:1/3}
    html.pl.rails .event-cards{top:calc(var(--st) + 112px)}
    html.pl.corner .hud-top{left:auto;gap:10px}
    html.pl.corner .completion{width:100px}
    html.pl.corner .money{position:static;transform:none}
    html.pl.corner .event-cards{top:calc(var(--st) + 10px)}
    html.pl.rails .money.bump,html.pl.corner .money.bump{animation:pl-bump .25s}
    @keyframes pl-bump{40%{transform:scale(1.15)}}
    html.pl.banner-right .event-banner{left:auto;right:calc(var(--sr) + 12px);top:calc(var(--st) + 70px);
      animation-name:pl-side-in}
    html.pl.banner-right .event-banner.out{animation-name:pl-side-out}
    @keyframes pl-side-in{0%{transform:translateX(130%)}70%{transform:translateX(0) scale(1.08,.92)}100%{transform:none}}
    @keyframes pl-side-out{to{transform:translateX(130%)}}
    html.ph .hint{display:none}

    /* joystick: touch area, and its resting look when it follows the thumb */
    html.ph #joy{right:calc((1 - var(--jz)) * 100%)}
    #pl-rest{position:fixed;z-index:1;pointer-events:none;border-radius:50%;display:none;
      width:var(--js);height:var(--js);left:calc(var(--sl,0px) + var(--jl) - var(--js) / 2);
      bottom:calc(var(--sb,0px) + var(--jb) - var(--js) / 2);background:#3a241640}
    #pl-rest::after{content:'';position:absolute;inset:25%;border-radius:50%;background:#3a241680}
    html.ph.in-game.follow #pl-rest{display:block}
    html.joying #pl-rest{opacity:0}
    html.ph.on-title #joy{display:none}

    /* action buttons */
    #pl-act{position:fixed;z-index:2;display:none;right:calc(var(--sr,0px) + 20px);bottom:calc(var(--sb,0px) + 24px);
      width:calc(var(--bz) * 1.9);height:calc(var(--bz) * 1.9)}
    html.ph.in-game.act-use #pl-act,html.ph.in-game.act-takegive #pl-act{display:block}
    #pl-act button{position:absolute;width:var(--bz);height:var(--bz);border-radius:50%;border:3px solid #3a2416;
      box-shadow:0 4px 0 #3a2416;font:700 17px Fredoka,system-ui;color:#3a2416;background:#fff1d0;
      touch-action:none;-webkit-user-select:none;user-select:none;display:grid;place-items:center;line-height:1}
    #pl-act button span{font-size:26px;display:block}
    #pl-act button.down{transform:translateY(3px) scale(.94);box-shadow:0 1px 0 #3a2416;background:#f26b1d;color:#fff}
    #pl-act .use{right:0;bottom:0;width:calc(var(--bz) * 1.15);height:calc(var(--bz) * 1.15)}
    #pl-act .give{right:0;bottom:0}
    #pl-act .take{left:0;top:0}
    html.act-use #pl-act .take,html.act-use #pl-act .give,html.act-takegive #pl-act .use{display:none}

    #pl-notch{position:fixed;left:0;top:50%;transform:translateY(-50%);width:var(--notch);height:180px;
      background:#000;border-radius:0 24px 24px 0;z-index:40;pointer-events:none}
    html:not(.pl) #pl-notch{display:none}
    #pl-gate{position:fixed;inset:0;z-index:45;display:none;place-items:center;text-align:center;
      background:#3a2416cc;color:#fff1d0;font:700 26px Fredoka,system-ui}
    #pl-gate i{display:block;font-size:64px;font-style:normal}
    #pl-gate small{display:block;font-size:15px;font-weight:500;margin-top:6px}
    html.gated #pl-gate{display:grid}
    #proto-bar{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 4px);transform:translateX(-50%);
      z-index:50;display:flex;gap:4px;background:#3a2416e6;padding:3px;border-radius:9px;font:600 11px system-ui}
    #proto-bar button{font:inherit;border:0;border-radius:6px;padding:4px 8px;background:#fff1d0;color:#3a2416;cursor:pointer}
    #proto-bar button.on{background:#f26b1d;color:#fff}
    #proto-label{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 34px);z-index:50;
      background:#3a2416aa;color:#fff1d0;padding:2px 6px;border-radius:6px;font:600 9px system-ui;white-space:pre;
      pointer-events:none;text-align:center}
    html:not(.pl) #proto-bar{top:calc(env(safe-area-inset-top) + 64px)}
    html:not(.pl) #proto-label{top:calc(env(safe-area-inset-top) + 94px)}
    #proto-dump{position:fixed;inset:6% 12%;z-index:60;background:#fff1d0;color:#3a2416;padding:14px;border-radius:12px;
      font:11px ui-monospace,monospace;white-space:pre;overflow:auto;display:none;user-select:text;-webkit-user-select:text}
  `;
  document.head.append(style);

  const el = (id: string, html = '') => {
    const d = document.createElement('div');
    d.id = id;
    d.innerHTML = html;
    document.body.append(d);
    return d;
  };
  el('pl-rest');
  const gate = el('pl-gate', '<div><i>⛶</i>Tap to play fullscreen<small>The game waits until you do</small></div>');
  gate.addEventListener('pointerdown', (e) => e.stopPropagation());
  gate.addEventListener('click', goFull);
  el('pl-notch');
  const act = el(
    'pl-act',
    '<button class="use"><span>✋</span>Use</button><button class="take"><span>⬆</span>Take</button><button class="give"><span>⬇</span>Give</button>',
  );
  for (const b of act.querySelectorAll('button')) {
    const kind = b.className as 'use' | 'take' | 'give';
    const set = (on: boolean) => {
      b.classList.toggle('down', on);
      if (kind !== 'give') input.held.take = on;
      if (kind !== 'take') input.held.give = on;
    };
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      b.setPointerCapture(e.pointerId);
      set(true);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => set(false));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  const bar = el('proto-bar');
  const label = el('proto-label');
  const dump = el('proto-dump');
  dump.onclick = () => (dump.style.display = 'none');
  for (const d of [bar, dump]) d.addEventListener('pointerdown', (e) => e.stopPropagation());
  const joy = document.getElementById('joy') as HTMLElement;
  joy.addEventListener('pointerdown', () => root.classList.add('joying'));
  addEventListener('pointerup', () => root.classList.remove('joying'));
  addEventListener('pointercancel', () => root.classList.remove('joying'));

  const probe = el('pl-probe');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  const insets = () => {
    const s = getComputedStyle(probe);
    return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => parseFloat(v));
  };

  // nipplejs pins a static joystick in px; rebuild it only when its shape changes
  let joyKey = '';
  const rebuildJoystick = () => {
    const [, , b, l] = insets();
    const notch = land ? P.notch : 0;
    // landscape: in the left zone, pinned or free; portrait: today's joystick anywhere; off: Tap Walk only
    const mode = app.settings.joystick;
    const fixed = land && mode === 'fixed';
    root.classList.toggle('follow', land && mode === 'free');
    const key = `${mode}|${P.joySize}|${P.joyPortrait}|${P.joyLeft}|${P.joyBottom}|${l}|${b}|${notch}|${land}`;
    if (key === joyKey) return;
    joyKey = key;
    input.tapsOnZone = !land;
    input.joystick(
      land ? P.joySize : P.joyPortrait,
      fixed ? { left: Math.max(l, notch) + P.joyLeft, bottom: b + P.joyBottom } : null,
      mode === 'off',
    );
  };

  const apply = () => {
    land = isLand();
    phone = isPhone();
    const c = root.classList;
    c.toggle('ph', phone);
    c.toggle('pl', land);
    for (const h of ['bar', 'rails', 'corner']) c.toggle(h, P.hud === h);
    c.toggle('banner-right', P.bannerRight);
    c.toggle('office-left', P.officeLeft);
    for (const a of ['auto', 'use', 'takegive']) c.toggle(`act-${a}`, P.action === a);
    const set = (k: string, v: string) => root.style.setProperty(k, v);
    set('--bs', String(P.bannerScale));
    set('--uis', String(land ? P.uiLand : P.uiPortrait));
    set('--jz', String(land ? P.joyZoneLand : 1));
    set('--js', `${P.joySize}px`);
    set('--jl', `${P.joyLeft}px`);
    set('--jb', `${P.joyBottom}px`);
    set('--bz', `${P.btnSize}px`);
    set('--ow', String(P.officeWidth));
    set('--notch', `${land ? P.notch : 0}px`);
    FEEL.sprintForce = phone ? P.sprintForce : 1.4;
    (globalThis as { protoPadScale?: number }).protoPadScale = land ? P.padScale : 1;
    if (!land) nudgeSet(stage.nudge.x, stage.nudge.y);
    stage.zoomTo(app.zoom());
    rebuildJoystick();
  };
  addEventListener('resize', () => setTimeout(apply, 50));
  screen.orientation?.addEventListener('change', () => setTimeout(apply, 150));

  // ---------- panel and switcher
  const gui = new GUI({ title: 'PROTOTYPE · phone play (live)' });
  gui.domElement.style.zIndex = '50';
  // top-left, clear of the corner HUD
  Object.assign(gui.domElement.style, { left: '0', right: 'auto' });
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  gui.close();

  const select = (v: string) => {
    variant = v;
    Object.assign(P, PRESETS[v].params);
    url.searchParams.set('land', v);
    history.replaceState(null, '', url);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    for (const b of bar.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v);
    apply();
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
    dump.textContent =
      `// land=${variant} — ${PRESETS[variant].name}\n${JSON.stringify(P, null, 2)}\n` +
      `// screen ${innerWidth}×${innerHeight} px · safe areas t/r/b/l ${insets().join('/')} px · ${viewText()}`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(dumpBtn);

  const fCtl = gui.addFolder('Joystick and buttons');
  fCtl.add(P, 'action', ['auto', 'use', 'takegive']).name('action buttons').onChange(apply);
  fCtl.add(P, 'btnSize', 56, 110, 2).name('button size').onChange(apply);
  fCtl.add(P, 'joySize', 90, 180, 5).name('joystick size').onChange(apply);
  fCtl.add(P, 'joyLeft', 60, 200, 5).name('rest ← px').onChange(apply);
  fCtl.add(P, 'joyBottom', 60, 200, 5).name('rest ↓ px').onChange(apply);
  fCtl.add(P, 'joyZoneLand', 0.25, 0.7, 0.05).name('zone width').onChange(apply);
  fCtl.add(P, 'sprintForce', 0.8, 1.6, 0.05).name('sprint past ring ×').onChange(apply);
  const fUi = gui.addFolder('Screens and HUD');
  fUi.add(P, 'uiLand', 0.5, 1, 0.02).name('screens size (landscape)').onChange(apply);
  fUi.add(P, 'uiPortrait', 0.5, 1, 0.02).name('screens size (portrait)').onChange(apply);
  fUi.add(P, 'hud', ['bar', 'rails', 'corner']).name('HUD layout (landscape)').onChange(apply);
  fUi.add(P, 'hudScale', 0.6, 1.4, 0.05).name('HUD size ×').onChange(apply);
  fUi.add(P, 'bannerScale', 0.5, 1.2, 0.05).name('banner size').onChange(apply);
  fUi.add(P, 'bannerRight').name('banners from right').onChange(apply);
  const fCam = gui.addFolder('Camera, Pads, Office');
  fCam.add(P, 'landZoom', 8, 22, 0.5).name('zoom (m tall, landscape)').onChange(apply);
  fCam.add(P, 'nudgeX', -0.2, 0.2, 0.01).name('Player shift →').onChange(apply);
  fCam.add(P, 'padScale', 0.8, 1.6, 0.05).name('Pad size').onChange(apply);
  fCam.add(P, 'officeWidth', 30, 60, 1).name('Office width %').onChange(apply);
  fCam.add(P, 'officeLeft').name('Office on the left').onChange(apply);
  fCam.add(P, 'notch', 0, 60, 1).name('fake notch px (desktop)').onChange(apply);

  const viewText = () => {
    const w = stage.camera.right - stage.camera.left;
    const h = stage.camera.top - stage.camera.bottom;
    return `view ${w.toFixed(1)}×${h.toFixed(1)} m`;
  };

  // per frame: HUD scale, which grab rule the sim uses, whether the in-game controls show
  const tick = () => {
    rebuildJoystick();
    const g = app.game;
    if (g) g.manualGrab = (phone && P.action !== 'auto') || (!coarse && app.settings.manualGrab);
    root.classList.toggle('on-title', app.ui.screen !== 'game');
    const gated = app.ui.screen === 'game' && canFull() && !document.fullscreenElement;
    root.classList.toggle('gated', gated);
    if (gated && !app.ui.overlay) {
      app.openOverlay('pause');
      gatePaused = true;
    } else if (!gated && gatePaused) {
      gatePaused = false;
      if (app.ui.overlay === 'pause') app.openOverlay(null);
    }
    root.classList.toggle('in-game', app.ui.screen === 'game' && !app.ui.overlay && !app.editing);
    document
      .querySelector<HTMLElement>('.hud-ui')
      ?.style.setProperty('--hud-scale', String(app.settings.hudScale * (land ? P.hudScale : 1)));
    requestAnimationFrame(tick);
  };
  setInterval(() => {
    label.textContent =
      `${variant} · ${land ? 'landscape' : phone ? 'portrait' : 'desktop'} · ${innerWidth}×${innerHeight} · ` +
      `safe ${insets().join('/')} · ${viewText()}`;
  }, 300);

  select(variant);
  // the sprint-camera prototype tunes the joystick through these
  Object.assign(globalThis, { protoLand: { P, apply, gui } });
  requestAnimationFrame(tick);
}
