// PROTOTYPE (throwaway, branch prototype/delivery-hud): `?dhud=A|B|C` — each waiting Delivery's order on the HUD;
// tap it to walk to the pickup tile, double-tap to run. The walk routes around every other Station (and Pads) so
// Auto Grab doesn't unload the Stack on the way. A = order strip, B = compact chip that opens, C = receipt + route.
// Works in every joystick mode: a HUD tap isn't a floor tap. Any joystick push cancels the walk.
import * as THREE from 'three';
import type { Stage } from '../view/stage';
import type { Input } from '../input/input';
import type { Game } from './game';
import type { Box, Point } from '../sim/map';
import type { PickupStation, World } from '../sim/world';
import { distToBox } from '../sim/geometry';
import { visiblePads } from '../sim/economy';
import { TUNING } from '../sim/tuning';
import { cellCentre, cellOf, nearestFreeCell, type Grid } from '../sim/nav';
import { iconUrl } from '../view/thumbs';

interface AppGuts {
  stage: Stage;
  input: Input;
  game: Game | null;
  protoDhud: boolean;
}

type Variant = 'A' | 'B' | 'C';
const NAMES: Record<Variant, string> = { A: 'Order strip', B: 'Chip that opens', C: 'Receipt + route line' };
const VARIANTS = Object.keys(NAMES) as Variant[];

const P = {
  /** clean = detour around Stations; shortest = straight there, Auto Grab paused the whole walk. */
  route: 'shortest' as 'clean' | 'shortest',
  /** When no clean way exists: walk with grab paused, walk anyway, or refuse. */
  noClean: 'pause grab' as 'pause grab' | 'walk anyway' | 'refuse',
  /** Clearance past a Station's reach (m). */
  margin: 0.25,
  avoidPads: true,
  /** Cost of one step inside another Station's reach, against 1 for a clean step. */
  dirtyCost: 40,
  doubleTapMs: 320,
  showRoute: true,
  cardScale: 1,
  top: 70,
  left: 12,
};

const CSS = `
#dh-bar{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:70;display:flex;gap:6px;align-items:center;
  background:#222;color:#fff;font:600 13px system-ui;padding:6px 10px;border-radius:999px;box-shadow:0 2px 8px #0006}
#dh-bar button{background:#444;color:#fff;border:0;border-radius:999px;padding:4px 10px;font:inherit}
#dh-box{position:fixed;z-index:6;display:flex;flex-direction:column;gap:8px;align-items:flex-start;transform-origin:top left;
  font-family:Fredoka,system-ui;color:#3a2416}
.dh-card{background:#fff1d0;border:3px solid #3a2416;border-radius:16px;box-shadow:0 3px 0 #3a2416;padding:6px 10px;
  cursor:pointer;user-select:none;transition:transform .12s cubic-bezier(.3,1.6,.5,1)}
.dh-card:hover{transform:translateY(-2px) scale(1.04)}
.dh-card:active{transform:translateY(2px) scale(.94)}
.dh-card.red{border-color:#d8402f;animation:dh-shake .4s infinite}
.dh-card.walking{background:#dff3c8}
.dh-card.nope{animation:dh-no .35s}
.dh-row{display:flex;gap:8px;align-items:center}
.dh-van{width:34px;height:34px}
.dh-line{display:flex;flex-direction:column;align-items:center;font:700 13px Fredoka,system-ui;position:relative}
.dh-line img{width:30px;height:30px}
.dh-line.done img{opacity:.45}
.dh-line.done::after{content:'✓';position:absolute;top:-4px;right:-4px;color:#4f9b2c;font-size:18px}
.dh-line.pop{animation:dh-pop .35s cubic-bezier(.3,1.8,.5,1)}
.dh-time{height:6px;border-radius:3px;background:#0002;margin-top:4px;overflow:hidden}
.dh-time b{display:block;height:100%;background:#7bc950}
.dh-card.red .dh-time b{background:#d8402f}
.dh-total{font:700 18px Fredoka,system-ui}
.dh-open{display:none;margin-top:6px}
.dh-card.open .dh-open{display:block}
.dh-btns{display:flex;gap:6px;margin-top:6px}
.dh-btns button{font:700 15px Fredoka,system-ui;border:3px solid #3a2416;border-radius:12px;padding:3px 12px;background:#fff;
  box-shadow:0 2px 0 #3a2416}
.dh-btns .run{background:#f2c230}
.dh-receipt{background:#fffdf6;border:0;border-radius:4px 4px 0 0;box-shadow:0 4px 10px #0003;padding:10px 12px 14px;
  min-width:150px;font:600 14px 'Courier New',monospace;position:relative;
  -webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/12px 100%;
  animation:dh-slide .45s cubic-bezier(.3,1.5,.5,1)}
.dh-receipt h5{margin:0 0 6px;font:700 15px Fredoka,system-ui;display:flex;gap:6px;align-items:center}
.dh-receipt .dh-item{display:flex;flex-direction:row;align-items:center;gap:6px}
.dh-receipt .dh-item img{width:24px;height:24px}
.dh-receipt .dh-item.done{text-decoration:line-through;opacity:.55}
.dh-go{margin-top:8px;font:800 16px Fredoka,system-ui;color:#fff;background:#d8402f;border:0;border-radius:10px;
  padding:4px 12px;transform:rotate(-4deg);box-shadow:0 2px 0 #8c2318}
.dh-toast{position:fixed;left:50%;top:30%;transform:translateX(-50%);z-index:60;background:#3a2416;color:#fff;
  font:700 16px Fredoka,system-ui;padding:8px 14px;border-radius:12px;animation:dh-pop .3s}
@keyframes dh-shake{25%{transform:rotate(-2deg)}75%{transform:rotate(2deg)}}
@keyframes dh-no{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes dh-pop{0%{transform:scale(.7)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes dh-slide{from{transform:translateX(-120%)}to{transform:none}}
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const INTERACTIVE = new Set(['shelf', 'producer', 'trash', 'pickup']);

interface Plan {
  points: Point[];
  /** Some of the way passes within another Station's reach. */
  dirty: boolean;
}

/** Cheapest walk-grid path from the Player into reach of `target`; steps near other Stations (or Pads) cost extra. */
export function plan(w: World, target: PickupStation, cost: number): Plan | null {
  const g: Grid = w.nav.walker;
  const reach = TUNING.reach + P.margin;
  const others: Box[] = [...w.stations.values()]
    .filter((s) => s.id !== target.id && INTERACTIVE.has(s.kind))
    .map((s) => s.box);
  if (P.avoidPads) for (const id of visiblePads(w)) others.push(w.map.layout.places[id].box);
  const dirtyAt = (x: number, z: number) => others.some((b) => distToBox(x, z, b) < reach);
  const n = g.w * g.h;
  const dirty = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (g.free[i]) dirty[i] = dirtyAt(...cellCentre(g, i)) ? 1 : 0;
  const goal = (i: number) => distToBox(...cellCentre(g, i), target.box) < TUNING.reach;
  const start = nearestFreeCell(g, w.player.x, w.player.z);
  if (start < 0) return null;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap: [number, number][] = [[0, start]];
  dist[start] = 0;
  const push = (d: number, i: number) => {
    heap.push([d, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop() as [number, number];
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  let end = -1;
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]) continue;
    if (goal(i)) {
      end = i;
      break;
    }
    const x = i % g.w;
    const z = Math.floor(i / g.w);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
        const j = nz * g.w + nx;
        if (!g.free[j]) continue;
        if (dx && dz && (!g.free[z * g.w + nx] || !g.free[nz * g.w + x])) continue;
        const step = (dx && dz ? Math.SQRT2 : 1) * (dirty[j] ? cost : 1);
        if (d + step < dist[j]) {
          dist[j] = d + step;
          prev[j] = i;
          push(d + step, j);
        }
      }
  }
  if (end < 0) return null;
  const cells: number[] = [];
  for (let i = end; i >= 0; i = prev[i]) cells.unshift(i);
  // leaving the Station the Player stands at doesn't count as dirty
  let k = 0;
  while (k < cells.length && dirty[cells[k]]) k++;
  const isDirty = cells.slice(k).some((i) => dirty[i]);
  // straighten: skip ahead while the straight line stays on free, equally clean ground
  const pts = cells.map((i) => cellCentre(g, i));
  const clearLine = (a: Point, b: Point, allowDirty: boolean) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= len; t += g.cell / 3) {
      const x = a[0] + ((b[0] - a[0]) * t) / len;
      const z = a[1] + ((b[1] - a[1]) * t) / len;
      const c = cellOf(g, x, z);
      if (c < 0 || !g.free[c] || (!allowDirty && dirtyAt(x, z))) return false;
    }
    return true;
  };
  const out: Point[] = [];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !clearLine(pts[a], pts[b], a < k || isDirty)) b--;
    out.push(pts[b]);
    a = b;
  }
  return { points: out, dirty: isDirty };
}

export function openDeliveryPrototype(): void {
  const app = (window as unknown as { app: AppGuts }).app;
  const { stage, input } = app;
  app.protoDhud = true;
  const url = new URL(location.href);
  let variant = (url.searchParams.get('dhud') ?? 'A').toUpperCase() as Variant;
  if (!VARIANTS.includes(variant)) variant = 'A';
  document.head.append(el('style', '', CSS));
  const box = el('div');
  box.id = 'dh-box';
  document.body.append(box);

  // ---------- the walk
  let walking: string | null = null;
  let pauseAll = false;
  let pauseDirty = false;
  let grabBefore = false;
  const line = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({ color: '#f08a24', dashSize: 0.3, gapSize: 0.2, linewidth: 2 }),
  );
  line.visible = false;
  stage.scene.add(line);

  const toast = (text: string) => {
    const t = el('div', 'dh-toast', text);
    document.body.append(t);
    setTimeout(() => t.remove(), 1400);
  };

  const go = (id: string, run: boolean, card: HTMLElement): void => {
    const game = app.game;
    const w = game?.world;
    const st = w?.stations.get(id);
    if (!game || !w || st?.kind !== 'pickup') return;
    if (walking === id && run) {
      input.tap.sprint = true;
      return;
    }
    let p = plan(w, st, P.route === 'clean' ? P.dirtyCost : 1);
    if (!p) return void (card.classList.add('nope'), setTimeout(() => card.classList.remove('nope'), 400));
    if (P.route === 'clean' && p.dirty && P.noClean === 'refuse') {
      card.classList.remove('nope');
      void card.offsetWidth;
      card.classList.add('nope');
      toast('No clear way there');
      return;
    }
    if (P.route === 'shortest') p = { ...p, dirty: true };
    input.tap.cancel();
    input.tap.target = { station: id };
    input.tap.route = p.points.slice();
    input.tap.sprint = run;
    if (!walking) grabBefore = game.manualGrab;
    walking = id;
    pauseAll = P.route === 'shortest';
    pauseDirty = P.route === 'clean' && p.dirty && P.noClean === 'pause grab';
    const pos = [w.player.x, 0.06, w.player.z, ...p.points.flatMap(([x, z]) => [x, 0.06, z])];
    line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    line.computeLineDistances();
    line.visible = P.showRoute || variant === 'C';
  };

  const endWalk = () => {
    if (!walking) return;
    walking = null;
    line.visible = false;
    if (app.game) app.game.manualGrab = grabBefore;
  };

  // ---------- cards
  const lastTap = new Map<string, number>();
  const tapCard = (id: string, card: HTMLElement) => {
    const now = performance.now();
    const double = now - (lastTap.get(id) ?? 0) < P.doubleTapMs;
    lastTap.set(id, now);
    go(id, double, card);
  };
  const cards = new Map<string, { root: HTMLElement; got: number[] }>();

  const build = (st: PickupStation, w: World): HTMLElement => {
    const d = st.delivery;
    if (!d) return el('div');
    const lines = d.order
      .map(
        (l) =>
          `<div class="dh-line"><img src="${iconUrl(w.map.products[l.product]?.model ?? '')}" alt=""><span></span></div>`,
      )
      .join('');
    if (variant === 'A') {
      const c = el(
        'div',
        'dh-card',
        `<div class="dh-row"><img class="dh-van" src="${iconUrl('van')}" alt="">${lines}</div>`,
      );
      c.append(el('div', 'dh-time', '<b></b>'));
      c.onclick = () => tapCard(st.id, c);
      return c;
    }
    if (variant === 'B') {
      const c = el(
        'div',
        'dh-card',
        `<div class="dh-row"><img class="dh-van" src="${iconUrl('van')}" alt=""><span class="dh-total"></span></div>
         <div class="dh-time"><b></b></div>
         <div class="dh-open"><div class="dh-row">${lines}</div>
           <div class="dh-btns"><button class="walk">Walk</button><button class="run">Run!</button></div></div>`,
      );
      c.onclick = (e) => {
        const t = e.target as HTMLElement;
        if (t.closest('.walk')) return go(st.id, false, c);
        if (t.closest('.run')) return go(st.id, true, c);
        c.classList.toggle('open');
      };
      return c;
    }
    const items = d.order
      .map(
        (l) =>
          `<div class="dh-item dh-line"><img src="${iconUrl(w.map.products[l.product]?.model ?? '')}" alt=""><span></span> ${w.map.products[l.product]?.name ?? l.product}</div>`,
      )
      .join('');
    const c = el(
      'div',
      'dh-card dh-receipt',
      `<h5><img class="dh-van" src="${iconUrl('van')}" alt="">Order</h5>${items}<div class="dh-time"><b></b></div><button class="dh-go">🏃 GO</button>`,
    );
    c.onclick = () => tapCard(st.id, c);
    return c;
  };

  const rebuild = () => {
    box.replaceChildren();
    cards.clear();
  };

  // ---------- frame
  const frame = () => {
    requestAnimationFrame(frame);
    const game = app.game;
    const w = game?.world;
    const playing = (app as unknown as { ui: { screen: string } }).ui.screen === 'game';
    box.style.display = playing ? '' : 'none';
    box.style.top = `calc(env(safe-area-inset-top) + ${P.top}px)`;
    box.style.left = `calc(env(safe-area-inset-left) + ${P.left}px)`;
    box.style.transform = `scale(${P.cardScale})`;
    if (!game || !w || !playing) return;
    const live = new Set<string>();
    for (const st of w.stations.values()) {
      if (st.kind !== 'pickup' || !st.delivery) continue;
      const d = st.delivery;
      live.add(st.id);
      let c = cards.get(st.id);
      if (!c) {
        c = { root: build(st, w), got: d.order.map(() => 0) };
        cards.set(st.id, c);
        box.append(c.root);
      }
      const spans = c.root.querySelectorAll<HTMLElement>('.dh-line');
      d.order.forEach((l, i) => {
        const s = spans[i];
        if (!s) return;
        const txt = `${l.got}/${l.want}`;
        const span = s.querySelector('span') as HTMLElement;
        if (span.textContent !== txt) span.textContent = txt;
        s.classList.toggle('done', l.got >= l.want);
        if (l.got !== c.got[i]) {
          s.classList.remove('pop');
          void s.offsetWidth;
          s.classList.add('pop');
          c.got[i] = l.got;
        }
      });
      const total = c.root.querySelector('.dh-total');
      if (total)
        total.textContent = `${d.order.reduce((n, l) => n + l.got, 0)}/${d.order.reduce((n, l) => n + l.want, 0)}`;
      (c.root.querySelector('.dh-time b') as HTMLElement).style.width = `${Math.round((1 - d.t / d.time) * 100)}%`;
      c.root.classList.toggle('red', d.time - d.t <= TUNING.events.honkAt);
      c.root.classList.toggle('walking', walking === st.id);
    }
    for (const [id, c] of cards)
      if (!live.has(id)) {
        c.root.remove();
        cards.delete(id);
      }
    // the walk: ends on arrival, a push, or the car leaving
    if (walking && (!input.tap.target || !live.has(walking))) {
      if (!live.has(walking)) input.tap.cancel();
      endWalk();
    }
    if (walking) {
      const st = w.stations.get(walking);
      const near = !!st && distToBox(w.player.x, w.player.z, st.box) < TUNING.reach + 0.3;
      const reach = TUNING.reach + P.margin;
      const others = [...w.stations.values()].filter((s) => s.id !== walking && INTERACTIVE.has(s.kind));
      const onDirty = others.some((s) => distToBox(w.player.x, w.player.z, s.box) < reach);
      game.manualGrab = !near && (pauseAll || (pauseDirty && onDirty)) ? true : grabBefore;
    }
  };
  requestAnimationFrame(frame);

  // ---------- switcher bar, panel, dump
  const bar = el('div');
  bar.id = 'dh-bar';
  const label = el('span');
  const select = (v: Variant) => {
    variant = v;
    url.searchParams.set('dhud', v);
    history.replaceState(null, '', url);
    label.textContent = `${v} (${NAMES[v]})`;
    rebuild();
  };
  const cycle = (d: number) => select(VARIANTS[(VARIANTS.indexOf(variant) + d + VARIANTS.length) % VARIANTS.length]);
  const prevV = el('button', '', '◀');
  const nextV = el('button', '', '▶');
  prevV.onclick = () => cycle(-1);
  nextV.onclick = () => cycle(1);
  const spawn = el('button', '', '+ Car');
  spawn.onclick = () => {
    const w = app.game?.world;
    if (!w) return;
    const free = [...w.stations.values()].find((s): s is PickupStation => s.kind === 'pickup' && !s.delivery);
    if (!free) return toast('Every Car Spot is busy');
    const products = Object.keys(w.map.products);
    const n = 1 + Math.floor(Math.random() * Math.min(3, products.length));
    const pick = [...products].sort(() => Math.random() - 0.5).slice(0, n);
    free.delivery = {
      order: pick.map((product) => ({ product, want: 2 + Math.floor(Math.random() * 3), got: 0 })),
      t: 0,
      time: 90,
      look: Math.random(),
      honked: false,
    };
    w.events.push({ type: 'deliveryArrived', station: free.id });
  };
  const dumpBtn = el('button', '', 'Dump');
  const dump = el('div');
  dump.style.cssText =
    'position:fixed;inset:8% 12%;z-index:80;display:none;flex-direction:column;gap:8px;background:#fff1d0;padding:10px;border:3px solid #3a2416;border-radius:12px';
  const text = el('textarea');
  text.readOnly = true;
  text.style.cssText = 'flex:1;font:12px monospace;user-select:text;-webkit-user-select:text';
  const row = el('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
  const copy = el('button', '', 'Copy');
  const shut = el('button', '', 'Close');
  row.append(copy, shut);
  dump.append(text, row);
  shut.onclick = () => (dump.style.display = 'none');
  copy.onclick = () => {
    text.focus();
    text.setSelectionRange(0, text.value.length);
    const ok = navigator.clipboard
      ? navigator.clipboard.writeText(text.value).then(() => true)
      : Promise.resolve(document.execCommand('copy'));
    void ok.then((done) => (copy.textContent = done ? 'Copied!' : 'Selected — copy it'));
  };
  dumpBtn.onclick = () => {
    copy.textContent = 'Copy';
    text.value = `// dhud=${variant} — ${NAMES[variant]}\n${JSON.stringify(P, null, 2)}`;
    dump.style.display = 'flex';
  };
  bar.append(prevV, label, nextV, spawn, dumpBtn);
  document.body.append(bar, dump);
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === '[') cycle(-1);
    if (e.key === ']') cycle(1);
  });

  void import('lil-gui').then(({ default: GUI }) => {
    const gui = new GUI({ title: 'PROTOTYPE · delivery HUD' });
    gui.add(P, 'route', ['clean', 'shortest']).name('route');
    gui.add(P, 'noClean', ['pause grab', 'walk anyway', 'refuse']).name('no clean way');
    gui.add(P, 'margin', 0, 0.5, 0.01).name('clearance m');
    gui.add(P, 'avoidPads').name('avoid Pads');
    gui.add(P, 'dirtyCost', 1, 200, 1).name('near-Station cost');
    gui.add(P, 'doubleTapMs', 150, 600, 10).name('double tap ms');
    gui.add(P, 'showRoute').name('route line (A, B)');
    gui.add(P, 'cardScale', 0.5, 1.6, 0.05).name('card scale');
    gui.add(P, 'top', 0, 300, 1).name('top px');
    gui.add(P, 'left', 0, 300, 1).name('left px');
    gui.close();
  });

  label.textContent = `${variant} (${NAMES[variant]})`;
  // `&play` skips the title and parks a car: quick checks without tapping
  if (url.searchParams.has('play')) {
    const guts = app as unknown as { play(id: string): void; save: { currentMap: string } };
    guts.play(guts.save.currentMap);
    setTimeout(() => spawn.click(), 1500);
    if (url.searchParams.has('walk')) setTimeout(() => box.querySelector<HTMLElement>('.dh-card')?.click(), 4000);
  }
}
