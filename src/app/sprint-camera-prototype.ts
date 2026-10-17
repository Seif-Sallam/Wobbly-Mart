// PROTOTYPE (throwaway, branch prototype/sprint-camera): `?cam=A|B|C|D&joy=J1|J2|J3` — how the camera follows a
// sprinting Player, and how big the joystick and its sprint ring are. Runs on top of the landscape prototype (C3).
import type { Stage } from '../view/stage';
import type { ProtoCam } from '../view/world-view';
import type { World } from '../sim/world';
import { openLandscapePrototype } from './landscape-prototype';

interface Cam extends ProtoCam {
  /** View size × while sprinting (1 = no zoom). */
  sprintZoom: number;
}
const TODAY: Cam = {
  sharp: 9,
  sprintSharp: 9,
  lead: 0.44,
  sprintLead: 0.44,
  leadMax: 99,
  leadEase: 99,
  sprintZoom: 1,
  offset: 0,
};
const CAMS: Record<string, { name: string; params: Cam }> = {
  A: { name: 'Today: lerp 9, lead 0.44 s', params: TODAY },
  B: { name: 'Locked on while sprinting', params: { ...TODAY, sprintSharp: 30, sprintLead: 0 } },
  C: {
    name: 'Small eased lead, capped 1.5 m',
    params: { ...TODAY, sharp: 14, sprintSharp: 14, lead: 0.25, sprintLead: 0.25, leadMax: 1.5, leadEase: 3 },
  },
  D: { name: 'Dash: tight + view widens', params: { ...TODAY, sprintSharp: 20, sprintLead: 0.15, sprintZoom: 1.15 } },
};

interface Joy {
  /** px: portrait, landscape. */
  joyPortrait: number;
  joySize: number;
  /** Push past this share of the ring sprints. */
  sprintForce: number;
  /** Draw the sprint threshold as a dashed ring that lights up while sprinting. */
  showRing: boolean;
}
const JOYS: Record<string, { name: string; params: Joy }> = {
  J1: {
    name: 'Landscape ticket: 110 / 115 px, sprint 1.2×',
    params: { joyPortrait: 110, joySize: 115, sprintForce: 1.2, showRing: false },
  },
  J2: {
    name: 'Big: 150 / 140 px, sprint 1.4×',
    params: { joyPortrait: 150, joySize: 140, sprintForce: 1.4, showRing: false },
  },
  J3: {
    name: 'Sprint ring drawn: 130 / 125 px, sprint 1.5×',
    params: { joyPortrait: 130, joySize: 125, sprintForce: 1.5, showRing: true },
  },
};

interface LandGuts {
  P: Joy & Record<string, unknown>;
  apply(): void;
  gui: import('lil-gui').default;
}
interface AppGuts {
  stage: Stage;
  game: { world: World } | null;
  zoom(): number;
}

export async function openSprintCameraPrototype(): Promise<void> {
  await openLandscapePrototype();
  const app = (window as unknown as { app: AppGuts }).app;
  const land = (globalThis as unknown as { protoLand: LandGuts }).protoLand;
  const url = new URL(location.href);
  const pick = (k: string, all: object, d: string) =>
    (url.searchParams.get(k) ?? '') in all ? (url.searchParams.get(k) as string) : d;
  let cam = pick('cam', CAMS, 'A');
  let joy = pick('joy', JOYS, 'J1');
  const C: Cam = { ...CAMS[cam].params };
  const J: Joy = { ...JOYS[joy].params };
  Object.assign(globalThis, { protoCam: C });
  const root = document.documentElement;

  const style = document.createElement('style');
  style.textContent = `
    html.sc-ring #joy .back::after{content:'';position:absolute;left:50%;top:50%;width:calc(var(--sf) * 100%);
      height:calc(var(--sf) * 100%);transform:translate(-50%,-50%);border:3px dashed #3a2416;border-radius:50%;
      box-sizing:border-box;pointer-events:none}
    html.sc-ring.sc-run #joy .back::after{border:4px solid #f26b1d;box-shadow:0 0 12px #f26b1d}
    #sc-label{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 50px);z-index:50;
      background:#3a2416aa;color:#fff1d0;padding:2px 6px;border-radius:6px;font:600 10px system-ui;pointer-events:none}
    html:not(.pl) #sc-label{top:calc(env(safe-area-inset-top) + 110px)}
    #proto-bar .sc-gap{width:6px}`;
  document.head.append(style);
  const label = document.createElement('div');
  label.id = 'sc-label';
  document.body.append(label);
  const bar = document.getElementById('proto-bar') as HTMLElement;

  const applyJoy = () => {
    Object.assign(land.P, { joyPortrait: J.joyPortrait, joySize: J.joySize, sprintForce: J.sprintForce });
    root.classList.toggle('sc-ring', J.showRing);
    root.style.setProperty('--sf', String(J.sprintForce));
    land.apply();
    land.gui.controllersRecursive().forEach((c) => c.updateDisplay());
  };
  const buttons: HTMLButtonElement[] = [];
  const mark = () => {
    for (const b of buttons) b.classList.toggle('on', b.dataset.v === cam || b.dataset.v === joy);
    url.searchParams.set('cam', cam);
    url.searchParams.set('joy', joy);
    history.replaceState(null, '', url);
  };
  const selectCam = (v: string) => {
    cam = v;
    Object.assign(C, CAMS[v].params);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    mark();
  };
  const selectJoy = (v: string) => {
    joy = v;
    Object.assign(J, JOYS[v].params);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    applyJoy();
    mark();
  };
  for (const [keys, pick, names] of [
    [Object.keys(CAMS), selectCam, CAMS],
    [Object.keys(JOYS), selectJoy, JOYS],
  ] as const) {
    const gap = document.createElement('span');
    gap.className = 'sc-gap';
    bar.append(gap);
    for (const v of keys) {
      const b = document.createElement('button');
      b.textContent = v;
      b.dataset.v = v;
      b.title = names[v].name;
      b.onclick = () => pick(v);
      bar.append(b);
      buttons.push(b);
    }
  }
  const dumpBtn = document.createElement('button');
  dumpBtn.textContent = 'Dump cam';
  dumpBtn.onclick = () => {
    const dump = document.getElementById('proto-dump') as HTMLElement;
    const cp: Partial<Cam> = { ...C };
    delete cp.offset;
    dump.textContent =
      `// cam=${cam} — ${CAMS[cam].name}\n${JSON.stringify(cp, null, 2)}\n` +
      `// joy=${joy} — ${JOYS[joy].name}\n${JSON.stringify(J, null, 2)}\n// ${innerWidth}×${innerHeight} px`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(dumpBtn);

  const GUI = (await import('lil-gui')).default;
  const gui = new GUI({ title: 'PROTOTYPE · sprint camera + joystick' });
  gui.domElement.style.zIndex = '50';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  gui.close();
  const fc = gui.addFolder('Camera follow');
  fc.add(C, 'sharp', 2, 40, 0.5).name('sharpness walking 1/s');
  fc.add(C, 'sprintSharp', 2, 40, 0.5).name('sharpness sprinting 1/s');
  fc.add(C, 'lead', 0, 0.8, 0.01).name('lead walking (s)');
  fc.add(C, 'sprintLead', 0, 0.8, 0.01).name('lead sprinting (s)');
  fc.add(C, 'leadMax', 0, 5, 0.1).name('lead cap (m)');
  fc.add(C, 'leadEase', 0.5, 99, 0.5).name('lead ease 1/s (99 = instant)');
  fc.add(C, 'sprintZoom', 1, 1.4, 0.01).name('view × while sprinting');
  const fj = gui.addFolder('Joystick');
  fj.add(J, 'joyPortrait', 90, 200, 5).name('size portrait px').onChange(applyJoy);
  fj.add(J, 'joySize', 90, 200, 5).name('size landscape px').onChange(applyJoy);
  fj.add(J, 'sprintForce', 1, 2, 0.05).name('sprint past ring ×').onChange(applyJoy);
  fj.add(J, 'showRing').name('draw sprint ring').onChange(applyJoy);

  // per frame: sprint class for the ring, sprint zoom around whatever zoom the player picked
  let zoomed = false;
  let maxOffset = 0;
  const tick = () => {
    const run = !!app.game?.world.player.sprinting;
    root.classList.toggle('sc-run', run);
    const z = run && C.sprintZoom !== 1;
    if (z !== zoomed) {
      zoomed = z;
      app.stage.zoomTo(app.zoom() * (z ? C.sprintZoom : 1));
    }
    maxOffset = Math.max(maxOffset * 0.995, C.offset);
    label.textContent = `cam ${cam} · joy ${joy} · ${run ? 'SPRINT' : 'walk'} · camera ↔ Player ${C.offset.toFixed(2)} m (peak ${maxOffset.toFixed(2)})`;
    requestAnimationFrame(tick);
  };
  selectCam(cam);
  selectJoy(joy);
  requestAnimationFrame(tick);
}
