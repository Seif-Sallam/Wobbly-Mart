// PROTOTYPE (throwaway, branch prototype/tap-to-move): `?tap=A|B|C` — tap/click to move presets, live panel, value dump.
/* eslint-disable @typescript-eslint/no-non-null-assertion -- throwaway prototype */
import * as THREE from 'three';
import type { Game } from './game';
import type { Input } from '../input/input';
import type { Point } from '../sim/map';
import { boxCentre, distToBox, footprint, frontPoint, inBox } from '../sim/geometry';
import { TUNING } from '../sim/tuning';
import { headingFor, type Target } from '../sim/walk';
import { visiblePads } from '../sim/economy';

interface Params {
  /** A press shorter than this (ms) that moved less than tapPx is a tap. */
  tapMs: number;
  tapPx: number;
  /** Hold-to-follow: keep walking toward the held finger/mouse. */
  holdFollow: boolean;
  /** How far around a tapped point a Station or Pad still counts as tapped (m). */
  pickSlop: number;
  showPath: boolean;
  showMarker: boolean;
  markerSize: number;
  highlightTarget: boolean;
  doubleTapSprint: boolean;
  doubleTapMs: number;
  /** Joystick push (0–1) that cancels a tap walk. */
  cancelForce: number;
  /** Ease off inside this distance of the end (m), never below minPush; stop inside arriveStop (m). */
  arriveSlow: number;
  minPush: number;
  arriveStop: number;
  /** Where a Station walk ends, as a share of reach from its edge (0 = touching, 1 = edge of reach). */
  stationDepth: number;
  /** How far behind the Register's back edge a Register tap ends (m). */
  behindRegister: number;
}

const BASE: Params = {
  tapMs: 250,
  tapPx: 12,
  holdFollow: false,
  pickSlop: 0.6,
  showPath: false,
  showMarker: true,
  markerSize: 0.6,
  highlightTarget: true,
  doubleTapSprint: false,
  doubleTapMs: 300,
  cancelForce: 0.15,
  arriveSlow: 1.2,
  minPush: 0.2,
  arriveStop: 0.12,
  stationDepth: 0.5,
  behindRegister: 0.5,
};
const PRESETS: Record<string, { name: string; params: Params }> = {
  A: {
    name: 'Tap alongside: tap floor or a fixture to walk there, double-tap = Sprint; joystick/keys cancel',
    params: { ...BASE, doubleTapSprint: true },
  },
  B: {
    name: 'Tap + path: dotted path, target glows, double-tap = Sprint',
    params: { ...BASE, showPath: true, doubleTapSprint: true },
  },
  C: {
    name: 'Hold to follow: hold on the floor and the Player follows; tap a fixture to go to it',
    params: { ...BASE, holdFollow: true, showMarker: false },
  },
};
const VARIANTS = Object.keys(PRESETS);

type InputGuts = { keys: Set<string>; joy: { x: number; y: number; active: boolean; force: number } };

export async function openTapPrototype(game: Game, input: Input): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const url = new URL(location.href);
  let variant = url.searchParams.get('tap') ?? 'A';
  if (!PRESETS[variant]) variant = 'A';
  const P: Params = { ...PRESETS[variant].params };
  const guts = input as unknown as InputGuts;
  const canvas = game.stage.renderer.domElement;
  const scene = game.stage.scene;

  let target: Target | null = null;
  let targetLabel = '';
  let sprinting = false;
  let held: { x: number; y: number } | null = null;
  let walks = 0;
  let cancels = 0;

  // ---------- picking
  const ray = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const floorPoint = (cx: number, cy: number): Point | null => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1),
      game.stage.camera,
    );
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(floor, hit) ? [hit.x, hit.z] : null;
  };
  const grow = (b: [number, number, number, number], s: number) =>
    [b[0] - s, b[1] - s, b[2] + 2 * s, b[3] + 2 * s] as typeof b;
  const pick = (p: Point): { target: Target; label: string } => {
    const w = game.world;
    for (const id of visiblePads(w)) {
      const b = w.map.layout.places[id].box;
      if (inBox(p[0], p[1], grow(b, P.pickSlop))) return { target: { point: boxCentre(b) }, label: `Pad ${id}` };
    }
    for (const [id, s] of w.stations) {
      if (!inBox(p[0], p[1], grow(s.box, P.pickSlop))) continue;
      // The Register is worked from behind, where the Cashier stands.
      if (s.kind === 'register')
        return {
          target: { point: frontPoint(s.box, s.rot, -(footprint(s.box, s.rot)[1] + P.behindRegister)) },
          label: `register ${id} (behind)`,
        };
      return { target: { station: id }, label: `${s.kind} ${id}` };
    }
    return { target: { point: p }, label: `floor ${p[0].toFixed(1)}, ${p[1].toFixed(1)}` };
  };

  // ---------- pointer: tap vs drag (the joystick keeps drags)
  let down: { x: number; y: number; t: number } | null = null;
  let lastTap = 0;
  const onUi = (e: PointerEvent) =>
    !!(e.target as HTMLElement).closest?.('button, .lil-gui, #proto-bar, #proto-dump, .hud, .overlay, .card');
  addEventListener(
    'pointerdown',
    (e) => {
      if (onUi(e)) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (P.holdFollow) held = { x: e.clientX, y: e.clientY };
    },
    true,
  );
  addEventListener('pointermove', (e) => held && (held = { x: e.clientX, y: e.clientY }), true);
  addEventListener(
    'pointerup',
    (e) => {
      held = null;
      if (!down) return;
      const tap = performance.now() - down.t < P.tapMs && Math.hypot(e.clientX - down.x, e.clientY - down.y) < P.tapPx;
      down = null;
      if (!tap) return;
      const p = floorPoint(e.clientX, e.clientY);
      if (!p) return;
      const now = performance.now();
      sprinting = P.doubleTapSprint && now - lastTap < P.doubleTapMs;
      lastTap = now;
      const picked = pick(p);
      // In hold-follow, a plain floor tap just stops; fixtures still get a walk.
      if (P.holdFollow && 'point' in picked.target && picked.label.startsWith('floor')) return;
      target = picked.target;
      targetLabel = picked.label;
      walks++;
    },
    true,
  );

  // ---------- intents: tap walk feeds the same move/sprint intents as the joystick
  const realMove = input.move.bind(input);
  const realSprint = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'sprint')!.get!.bind(input);
  const manual = () => {
    const m = realMove();
    return Math.hypot(m.x, m.z) > P.cancelForce || guts.keys.size > 0 ? m : null;
  };
  const toward = (to: Point, push = 1) => {
    const pl = game.world.player;
    const dx = to[0] - pl.x;
    const dz = to[1] - pl.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: (dx / d) * push, z: (dz / d) * push };
  };
  // Distance left to the end of the walk: the tapped point, or the edge of a Station's reach.
  const left = (t: Target) => {
    const pl = game.world.player;
    if ('point' in t) return Math.hypot(t.point[0] - pl.x, t.point[1] - pl.z);
    const b = game.world.stations.get(t.station)!.box;
    return Math.max(0, distToBox(pl.x, pl.z, b) - Math.max(TUNING.reach * P.stationDepth, TUNING.playerRadius + 0.05));
  };
  // Nearest point on a Station's footprint: the final approach once inside the walk field's arrival ring.
  const edge = (id: string): Point => {
    const pl = game.world.player;
    const b = game.world.stations.get(id)!.box;
    return [Math.min(Math.max(pl.x, b[0]), b[0] + b[2]), Math.min(Math.max(pl.z, b[1]), b[1] + b[3])];
  };
  input.move = () => {
    const m = manual();
    if (m) {
      if (target) cancels++;
      target = null;
      return m;
    }
    if (held && P.holdFollow) {
      const p = floorPoint(held.x, held.y);
      const pl = game.world.player;
      if (p && Math.hypot(p[0] - pl.x, p[1] - pl.z) > 0.4) {
        const h = headingFor(game.world, 'walker', pl, { point: p });
        if (h) return toward(h);
      }
      return { x: 0, z: 0 };
    }
    if (!target) return realMove();
    const d = left(target);
    const h =
      d < ('point' in target ? P.arriveStop : 0.02)
        ? null
        : (headingFor(game.world, 'walker', game.world.player, target) ??
          ('station' in target ? edge(target.station) : null));
    if (!h) {
      target = null;
      return { x: 0, z: 0 };
    }
    const push = Math.min(1, Math.max(P.minPush, d / P.arriveSlow));
    // Last stretch: head for the exact tapped point, not the grid cell centre.
    return toward('point' in target && d < P.arriveSlow ? target.point : h, push);
  };
  Object.defineProperty(input, 'sprint', { get: () => realSprint() || (!!target && sprinting) });

  // ---------- marker, path, highlight
  const ink = new THREE.MeshBasicMaterial({ color: '#f26b1d', transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), ink);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.renderOrder = 2;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.35, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.07;
  glow.renderOrder = 1;
  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.09, 12), ink, 200);
  dots.frustumCulled = false;
  scene.add(ring, glow, dots);
  const m4 = new THREE.Matrix4();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  let t = 0;
  const drawPath = () => {
    let n = 0;
    if (P.showPath && target) {
      const w = game.world;
      let at: Point = [w.player.x, w.player.z];
      const field = headingFor(w, 'walker', w.player, target) ? true : false;
      for (let hop = 0; field && hop < 40 && n < 200; hop++) {
        const next = headingFor(w, 'walker', { x: at[0], z: at[1] }, target);
        if (!next) break;
        const len = Math.hypot(next[0] - at[0], next[1] - at[1]);
        for (let s = 0.5; s < len && n < 200; s += 0.5) {
          m4.compose(
            new THREE.Vector3(at[0] + ((next[0] - at[0]) * s) / len, 0.09, at[1] + ((next[1] - at[1]) * s) / len),
            flat,
            new THREE.Vector3(1, 1, 1),
          );
          dots.setMatrixAt(n++, m4);
        }
        if (len < 0.05) break;
        at = next;
      }
    }
    dots.count = n;
    dots.instanceMatrix.needsUpdate = true;
  };
  const tick = () => {
    t += 1 / 60;
    ring.visible = P.showMarker && !!target;
    glow.visible = P.highlightTarget && !!target && 'station' in target;
    if (target) {
      const w = game.world;
      const c: Point = 'point' in target ? target.point : boxCentre(w.stations.get(target.station)!.box);
      const pulse = 1 + 0.12 * Math.sin(t * 8);
      ring.position.set(c[0], 0.08, c[1]);
      ring.scale.setScalar(P.markerSize * pulse);
      if ('station' in target) {
        const b = w.stations.get(target.station)!.box;
        glow.position.set(b[0] + b[2] / 2, 0.07, b[1] + b[3] / 2);
        glow.scale.set(b[2] + 0.6, b[3] + 0.6, 1);
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(t * 6);
      }
    }
    drawPath();
    label.textContent = `PROTOTYPE · tap=${variant}\n${PRESETS[variant].name}\ntarget: ${target ? targetLabel : '—'}${sprinting && target ? ' (sprint)' : ''}\nwalks ${walks} · cancelled ${cancels}`;
    requestAnimationFrame(tick);
  };

  // ---------- panel
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

  const gui = new GUI({ title: 'PROTOTYPE · Tap to move (live)' });
  gui.domElement.style.zIndex = '20';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (innerWidth < 700) gui.close();

  const select = (v: string) => {
    variant = v;
    Object.assign(P, PRESETS[v].params);
    target = null;
    url.searchParams.set('tap', v);
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
    dump.textContent = `// tap=${variant} — ${PRESETS[variant].name}\n${JSON.stringify(P, null, 2)}`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(dumpBtn);

  const fTap = gui.addFolder('Tap');
  fTap.add(P, 'tapMs', 80, 600, 10).name('tap max ms');
  fTap.add(P, 'tapPx', 2, 40, 1).name('tap max px');
  fTap.add(P, 'pickSlop', 0, 2, 0.1).name('fixture pick slop (m)');
  fTap.add(P, 'holdFollow').name('hold to follow');
  fTap.add(P, 'cancelForce', 0, 1, 0.05).name('joystick cancel push');
  const fArrive = gui.addFolder('Arrive');
  fArrive.add(P, 'arriveSlow', 0, 3, 0.1).name('ease-off distance (m)');
  fArrive.add(P, 'minPush', 0.05, 1, 0.05).name('min push');
  fArrive.add(P, 'arriveStop', 0.02, 0.6, 0.02).name('stop within (m)');
  fArrive.add(P, 'stationDepth', 0, 0.9, 0.05).name('Station stop (share of reach)');
  fArrive.add(P, 'behindRegister', 0.1, 1.5, 0.05).name('behind Register (m)');
  const fShow = gui.addFolder('Show');
  fShow.add(P, 'showMarker').name('destination ring');
  fShow.add(P, 'markerSize', 0.2, 2, 0.05).name('ring size');
  fShow.add(P, 'showPath').name('dotted path');
  fShow.add(P, 'highlightTarget').name('glow tapped fixture');
  const fSprint = gui.addFolder('Sprint');
  fSprint.add(P, 'doubleTapSprint').name('double-tap = Sprint');
  fSprint.add(P, 'doubleTapMs', 150, 600, 10).name('double-tap window ms');

  select(variant);
  requestAnimationFrame(tick);
}
