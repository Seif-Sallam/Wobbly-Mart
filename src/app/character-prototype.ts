// PROTOTYPE (throwaway, branch prototype/character-select): `?look=A|B|C` — how the Player picks a character.
// A = Wardrobe panel off the title (preview + grid + cap colours, Select to confirm). B = the look stands beside the Map shelf on the
// title, ◀ ▶ under it, picks apply at once. C = Line-up: every look on a little stage, the picked one steps out and
// waves. All three use the 20 Kenney mini looks (16 shop + 4 fun) and save the pick for the whole game.
import * as THREE from 'three';
import { ASSETS } from '../../catalog/assets';
import { Character } from '../view/characters';
import type { Game } from './game';

interface Look {
  id: string;
  name: string;
  path: string;
  /** Also walks the shop as a Customer today. */
  customer?: boolean;
  /** Already wears a hat or helmet (the orange cap sits on top of it). */
  hat?: boolean;
  fun?: boolean;
}

type CapFit = [number, number, number, number];
/** Cap fit per look, [up, forward, size, tilt°]; tuned live from the panel's "Cap fit" folder. */
const FITS: Record<string, CapFit> = {
  'female-a': [-0.155, 0, 1, 0],
  'female-b': [-0.075, 0, 1, 0],
  'female-c': [-0.155, 0, 1, 0],
  'female-d': [-0.17, 0, 1, 0],
  'female-e': [-0.075, 0, 1, 0],
  'female-f': [0.015, 0, 1, 0],
  'male-c': [-0.035, 0, 1, 0],
  'male-d': [-0.075, 0, 1, 0],
  arcade: [-0.095, 0, 1, 0],
  'skate-girl': [-0.075, 0, 1, 0],
};
const fitOf = (id: string): CapFit => (FITS[id] ??= [0, 0, 1, 0]);

const LOOKS: Look[] = [
  { id: 'male-a', name: 'Sam (today)', path: 'chars/character-male-a' },
  { id: 'female-a', name: 'Ava', path: 'chars/character-female-a', customer: true },
  { id: 'female-b', name: 'Bea', path: 'chars/character-female-b', customer: true },
  { id: 'female-c', name: 'Cleo', path: 'chars/character-female-c', customer: true },
  { id: 'female-d', name: 'Dot', path: 'chars/character-female-d', customer: true },
  { id: 'female-e', name: 'Eve', path: 'chars/character-female-e' },
  { id: 'female-f', name: 'Fay', path: 'chars/character-female-f' },
  { id: 'male-b', name: 'Ben', path: 'chars/character-male-b', customer: true },
  { id: 'male-c', name: 'Cal', path: 'chars/character-male-c', customer: true },
  { id: 'male-d', name: 'Dan', path: 'chars/character-male-d', customer: true },
  { id: 'male-e', name: 'Eli', path: 'chars/character-male-e' },
  { id: 'male-f', name: 'Finn', path: 'chars/character-male-f', customer: true },
  { id: 'gamer', name: 'Gamer', path: 'chars-arcade/character-gamer', hat: true },
  { id: 'arcade', name: 'Arcade kid', path: 'chars-arcade/character-employee' },
  { id: 'skate-boy', name: 'Skater', path: 'chars-skate/character-skate-boy', hat: true },
  { id: 'skate-girl', name: 'Skater girl', path: 'chars-skate/character-skate-girl' },
  { id: 'human', name: 'Adventurer', path: 'chars-dungeon/character-human', fun: true },
  { id: 'orc', name: 'Orc', path: 'chars-dungeon/character-orc', fun: true },
  { id: 'soldier', name: 'Soldier', path: 'chars-arena/character-soldier', hat: true, fun: true },
  { id: 'archer', name: 'Archer', path: 'chars-forest/character-archer', fun: true },
];

const key = (l: Look) => `look-${l.id}`;
const PLAYER_HEIGHT = 1.25;

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(`proto-look-${k}`);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(`proto-look-${k}`, v);
    } catch {
      /* private window: the pick just isn't kept */
    }
  },
};

/** Before assets load: adds every look to the asset table and points the Player at the saved pick. */
export function registerLooks(): void {
  for (const l of LOOKS) ASSETS[key(l)] = { path: l.path, height: PLAYER_HEIGHT, cap: fitOf(l.id) };
  const picked = LOOKS.find((l) => l.id === store.get('id'));
  if (picked) ASSETS.player = { path: picked.path, height: PLAYER_HEIGHT, cap: fitOf(picked.id) };
}

type Variant = 'A' | 'B' | 'C';
const NAMES: Record<Variant, string> = { A: 'Wardrobe panel', B: 'Beside the shelf', C: 'Line-up stage' };
const VARIANTS = Object.keys(NAMES) as Variant[];

const P = {
  capColour: store.get('capColour') ?? '#f08a24',
  showFun: true,
  hideCustomerLooks: false,
  spin: 30,
  dragDegPerPx: 0.6,
  coast: 3,
  camDist: 4.2,
  camHeight: 1.1,
  lookY: 0.62,
  fov: 30,
  thumbSize: 76,
  bSize: 45,
  bLeft: 3,
  bBottom: 6,
  spacing: 1.15,
  slideEase: 6,
  stepOut: 0.7,
  lineCamHeight: 2,
  lineCamDist: 7.5,
  lineLookY: 0.15,
  firstRunOpens: true,
};

const CSS = `
#look-bar{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:70;display:flex;gap:6px;align-items:center;
  background:#222;color:#fff;font:600 13px system-ui;padding:6px 10px;border-radius:999px;box-shadow:0 2px 8px #0006}
#look-bar button{background:#444;color:#fff;border:0;border-radius:999px;padding:4px 10px;font:inherit}
#look-open{position:fixed;left:max(12px,env(safe-area-inset-left));top:12px;z-index:5;width:48px;height:48px;border-radius:50%;
  border:3px solid #3a2416;background:#fff1d0;font-size:24px;box-shadow:0 3px 0 #3a2416}
.look-panel{position:fixed;inset:4%;z-index:50;display:flex;gap:16px;background:#fff1d0;border:4px solid #3a2416;
  border-radius:20px;padding:14px;color:#3a2416;font-family:Fredoka,system-ui;box-shadow:0 6px 0 #3a2416}
@media (orientation:portrait){.look-panel{flex-direction:column}}
.look-panel .look-stage{flex:0 0 38%;min-height:0;position:relative;background:radial-gradient(#fff8e6,#f3d9a4);border-radius:14px}
.look-panel .look-side{flex:1;display:flex;flex-direction:column;min-height:0;gap:8px}
.look-grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--t),1fr));gap:8px;align-content:start}
.look-grid h4{grid-column:1/-1;margin:6px 0 0}
.look-cell{position:relative;border:3px solid transparent;border-radius:12px;background:#fff;padding:0}
.look-cell img{width:100%;display:block}
.look-cell.on{border-color:#f08a24;background:#ffe7c4}
.look-cell .tag{position:absolute;left:3px;bottom:2px;font-size:10px;background:#3a2416;color:#fff;border-radius:6px;padding:0 4px}
.look-cell,.look-btns button,.look-c button,.look-b button,#look-open{transition:transform .12s cubic-bezier(.3,1.6,.5,1),box-shadow .12s}
.look-cell:hover{transform:translateY(-3px) scale(1.05)}
.look-cell:hover img{animation:look-wiggle .5s ease-in-out}
.look-cell:active,.look-btns button:active,.look-c button:active,.look-b button:active,#look-open:active{transform:translateY(3px) scale(.9);box-shadow:0 0 0 #3a2416}
.look-btns button:hover,.look-c button:hover,.look-b button:hover,#look-open:hover{transform:translateY(-2px) scale(1.06)}
.look-cell.pop{animation:look-pop .35s cubic-bezier(.3,1.8,.5,1)}
.cap-cell{background:#fff8e6}
#ui button,#ui .btn{transition:transform .12s cubic-bezier(.3,1.6,.5,1)}
#ui button:hover:not(:disabled),#ui .btn:hover:not(:disabled){transform:translateY(-2px) scale(1.05)}
#ui button:active:not(:disabled),#ui .btn:active:not(:disabled){transform:translateY(3px) scale(.92)}
@keyframes look-pop{0%{transform:scale(.85)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes look-wiggle{25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
.look-name{font-size:22px;font-weight:700;text-align:center}
.look-btns{display:flex;gap:10px;justify-content:flex-end}
.look-btns button,.look-c button,.look-b button{font:700 18px Fredoka,system-ui;border:3px solid #3a2416;border-radius:14px;
  padding:6px 18px;background:#fff;color:#3a2416;box-shadow:0 3px 0 #3a2416}
.look-btns .go,.look-c .go{background:#7bc950}
canvas.look-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.look-b{position:fixed;z-index:4;display:flex;flex-direction:column;align-items:center;gap:4px;font-family:Fredoka,system-ui;color:#3a2416}
.look-b .look-stage{position:relative;width:100%;flex:1}
.look-b .row{display:flex;gap:8px;align-items:center;background:#fff1d0cc;border-radius:14px;padding:4px 8px}
.look-b button{padding:2px 12px}
.look-c{position:fixed;inset:0;z-index:50;background:linear-gradient(#bfe6ff,#fff1d0)}
.look-c .ui{position:absolute;left:0;right:0;bottom:56px;display:flex;flex-direction:column;align-items:center;gap:8px;
  font-family:Fredoka,system-ui;color:#3a2416;pointer-events:none}
.look-c .ui>*{pointer-events:auto}
.look-c .row{display:flex;gap:10px;align-items:center}
.look-c .back{position:absolute;left:12px;top:12px}
#look-dump{position:fixed;inset:6% 10%;z-index:80;background:#fff1d0;padding:10px;border-radius:12px;display:none;
  flex-direction:column;gap:8px;border:3px solid #3a2416}
#look-dump textarea{flex:1;font:12px monospace;color:#3a2416;background:#fff;user-select:text;-webkit-user-select:text}
#look-dump div{display:flex;gap:8px;justify-content:flex-end}
#look-dump button{font:700 16px system-ui;padding:6px 16px;border-radius:10px;border:2px solid #3a2416;background:#fff}
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

/** One live preview: its own renderer and scene, drawn into whatever box it's mounted in. */
class Preview {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(P.fov, 1, 0.1, 100);
  constructor() {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.className = 'look-canvas';
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#c9a36b', 2.2));
    const sun = new THREE.DirectionalLight('#fff4de', 2.2);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
  }
  draw(): void {
    const c = this.renderer.domElement;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * this.renderer.getPixelRatio())) this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = P.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
}

/** Starts in its idle pose, not the bind (T) pose the clips fade in from. */
/** The cap stays on every look; only its colour is picked. */
const CAP_COLOURS = ['#f08a24', '#e04a3c', '#f2c230', '#5bb04a', '#3d7be0', '#8b5bd6', '#ef7fb0', '#3a3a3a', '#f4f1ea'];

const makeChar = (l: Look, cap = P.capColour) => {
  const ch = new Character(key(l), { hat: l.fun ? undefined : cap });
  ch.update(1, 0, 0, 0, 0, false);
  return ch;
};

/** One cap per colour, drawn like the Player's (cylinder + brim). */
function capThumbs(): Map<string, string> {
  const out = new Map<string, string>();
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(128, 128, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9a36b', 2.4));
  const sun = new THREE.DirectionalLight('#fff4de', 2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0.5, 0.55, 0.9);
  cam.lookAt(0, 0.02, 0.04);
  for (const c of CAP_COLOURS) {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    const hat = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 24), m);
    top.position.y = 0.05;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), m);
    brim.position.z = 0.17;
    hat.add(top, brim);
    hat.rotation.y = -0.5;
    scene.add(hat);
    r.render(scene, cam);
    out.set(c, r.domElement.toDataURL());
    scene.remove(hat);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}

/** Head-and-shoulders portraits, drawn once. */
function portraits(cap = P.capColour, turn = 0.35, size = 128, close = false): Map<string, string> {
  const out = new Map<string, string>();
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9a36b', 2.4));
  const sun = new THREE.DirectionalLight('#fff4de', 2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  for (const l of LOOKS) {
    const ch = makeChar(l, cap);
    ch.root.rotation.y = turn;
    scene.add(ch.root);
    cam.position.set(0, close ? 1.75 : 1.0, close ? 1.3 : 2.4);
    cam.lookAt(0, close ? 1.05 : 0.75, 0);
    r.render(scene, cam);
    out.set(l.id, r.domElement.toDataURL());
    scene.remove(ch.root);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}

export function openLookPrototype(screen: () => 'title' | 'game', game: () => Game | null): void {
  const url = new URL(location.href);
  let variant = (url.searchParams.get('look') ?? 'A').toUpperCase() as Variant;
  if (!VARIANTS.includes(variant)) variant = 'A';
  document.head.append(el('style', '', CSS));

  let picked = store.get('id') ?? 'male-a';
  let shown = picked;
  const list = () => LOOKS.filter((l) => (P.showFun || !l.fun) && !(P.hideCustomerLooks && l.customer));
  const look = (id: string) => LOOKS.find((l) => l.id === id) ?? LOOKS[0];
  let thumbs = portraits();
  const capIcons = capThumbs();
  let onShow: (id: string) => void = () => {};

  let shownCap = P.capColour;
  const wear = (id: string, cap = P.capColour) => {
    picked = id;
    P.capColour = shownCap = cap;
    store.set('id', id);
    store.set('capColour', cap);
    store.set('nocap', look(id).fun ? '1' : '');
    ASSETS.player = { path: look(id).path, height: PLAYER_HEIGHT, cap: fitOf(id) };
    game()?.view.protoSwapPlayer();
  };

  // ---------- shared live preview (A, B): one character on a turntable
  const preview = new Preview();
  let solo: Character | null = null;
  let spinAt = 0;
  // drag the preview to turn the look; it coasts, and the idle sway stops until the next pick
  let turn = 0;
  let turnVel = 0;
  let dragged = false;
  let dragX: number | null = null;
  const pc = preview.renderer.domElement;
  pc.onpointerdown = (e) => {
    dragX = e.clientX;
    dragged = true;
    turnVel = 0;
    pc.setPointerCapture(e.pointerId);
  };
  pc.onpointermove = (e) => {
    if (dragX === null) return;
    const d = (e.clientX - dragX) * THREE.MathUtils.degToRad(P.dragDegPerPx);
    dragX = e.clientX;
    turn += d;
    turnVel = d * 60;
  };
  pc.onpointerup = pc.onpointercancel = () => (dragX = null);
  const showSolo = (id: string, wave: boolean) => {
    shown = id;
    onShow(id);
    if (solo) preview.scene.remove(solo.root);
    solo = makeChar(look(id), shownCap);
    preview.scene.add(solo.root);
    if (wave) solo.emote('yes');
    spinAt = 0;
    turn = turnVel = 0;
    dragged = false;
  };

  // ---------- C: everyone on one stage
  const stage = new Preview();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: '#e9c98f' }));
  floor.rotation.x = -Math.PI / 2;
  stage.scene.add(floor);
  let crowd: { l: Look; ch: Character; z: number }[] = [];
  let camX = 0;
  const buildCrowd = () => {
    for (const c of crowd) stage.scene.remove(c.ch.root);
    crowd = list().map((l) => ({ l, ch: makeChar(l), z: 0 }));
    crowd.forEach((c, i) => {
      c.ch.root.position.x = i * P.spacing;
      stage.scene.add(c.ch.root);
    });
  };

  let root: HTMLElement | null = null;
  const close = () => {
    root?.remove();
    root = null;
    preview.renderer.domElement.remove();
    stage.renderer.domElement.remove();
    openBtn.style.display = variant === 'B' ? 'none' : '';
  };

  const grid = (onPick: (id: string) => void, onCap: (c: string) => void) => {
    const g = el('div', 'look-grid');
    g.style.setProperty('--t', `${P.thumbSize}px`);
    const section = (title: string, ls: Look[]) => {
      if (!ls.length) return;
      g.append(el('h4', '', title));
      for (const l of ls) {
        const b = el('button', `look-cell ${l.id === shown ? 'on' : ''}`);
        b.dataset.id = l.id;
        b.append(Object.assign(el('img'), { src: thumbs.get(l.id) ?? '', alt: l.name }));
        if (l.customer) b.append(el('span', 'tag', 'Customer'));
        b.onclick = () => onPick(l.id);
        g.append(b);
      }
    };
    section(
      'Shop',
      list().filter((l) => !l.fun),
    );
    section(
      'Fun',
      list().filter((l) => l.fun),
    );
    g.append(el('h4', '', 'Cap'));
    for (const c of CAP_COLOURS) {
      const b = el('button', 'look-cell cap-cell');
      b.dataset.c = c;
      b.append(Object.assign(el('img'), { src: capIcons.get(c) ?? '', alt: c }));
      b.onclick = () => onCap(c);
      g.append(b);
    }
    return g;
  };

  const openA = () => {
    close();
    shownCap = P.capColour;
    showSolo(picked, false);
    root = el('div', 'look-panel');
    const box = el('div', 'look-stage');
    box.append(preview.renderer.domElement);
    const side = el('div', 'look-side');
    const name = el('div', 'look-name');
    const btns = el('div', 'look-btns');
    const back = el('button', '', 'Back');
    const go = el('button', 'go', 'Select');
    back.onclick = close;
    go.onclick = () => (wear(shown, shownCap), close());
    btns.append(back, go);
    // update in place: rebuilding the grid would lose its scroll on phones
    const mark = () => {
      name.textContent = look(shown).name + (shown === picked && shownCap === P.capColour ? ' ✓' : '');
      for (const b of g.querySelectorAll<HTMLElement>('.look-cell'))
        b.classList.toggle('on', b.dataset.id ? b.dataset.id === shown : b.dataset.c === shownCap);
    };
    const pop = (b: Element | null) => {
      b?.classList.remove('pop');
      void (b as HTMLElement | null)?.offsetWidth;
      b?.classList.add('pop');
    };
    const g = grid(
      (id) => (showSolo(id, true), mark(), pop(g.querySelector(`[data-id="${id}"]`))),
      (c) => {
        shownCap = c;
        showSolo(shown, true);
        thumbs = portraits(c);
        for (const img of g.querySelectorAll<HTMLImageElement>('.look-cell[data-id] img'))
          img.src = thumbs.get(img.parentElement?.dataset.id ?? '') ?? '';
        mark();
        pop(g.querySelector(`[data-c="${c}"]`));
      },
    );
    side.append(name, g, btns);
    mark();
    root.append(box, side);
    document.body.append(root);
    openBtn.style.display = 'none';
  };

  const openB = () => {
    close();
    showSolo(picked, false);
    root = el('div', 'look-b');
    const box = el('div', 'look-stage');
    box.append(preview.renderer.domElement);
    const name = el('b', '', look(picked).name);
    const step = (d: number) => {
      const ls = list();
      const i = (ls.findIndex((l) => l.id === picked) + d + ls.length) % ls.length;
      wear(ls[i].id);
      showSolo(ls[i].id, true);
      name.textContent = ls[i].name;
    };
    const row = el('div', 'row');
    const prev = el('button', '', '◀');
    const next = el('button', '', '▶');
    prev.onclick = () => step(-1);
    next.onclick = () => step(1);
    row.append(prev, name, next);
    box.onclick = () => solo?.emote('yes');
    root.append(box, row);
    document.body.append(root);
    placeB();
  };
  const placeB = () => {
    if (!root || variant !== 'B') return;
    const s = root.style;
    const wide = innerWidth > innerHeight;
    s.width = `${P.bSize * (wide ? 0.6 : 0.7)}vh`;
    s.height = `${P.bSize}vh`;
    s.left = `${P.bLeft}vw`;
    s.bottom = `${P.bBottom}vh`;
  };

  const openC = () => {
    close();
    buildCrowd();
    const at = Math.max(
      0,
      crowd.findIndex((c) => c.l.id === picked),
    );
    shown = crowd[at]?.l.id ?? picked;
    camX = at * P.spacing;
    root = el('div', 'look-c');
    root.append(stage.renderer.domElement);
    const ui = el('div', 'ui');
    const name = el('div', 'look-name');
    const row = el('div', 'row');
    const prev = el('button', '', '◀');
    const go = el('button', 'go', "That's me!");
    const next = el('button', '', '▶');
    const back = el('button', 'back', 'Back');
    const select = (i: number) => {
      const c = crowd[(i + crowd.length) % crowd.length];
      if (c.l.id === shown) return;
      shown = c.l.id;
      c.ch.emote('yes');
      name.textContent = c.l.name + (c.l.customer ? ' · also a Customer' : '');
    };
    const index = () => crowd.findIndex((c) => c.l.id === shown);
    prev.onclick = () => select(index() - 1);
    next.onclick = () => select(index() + 1);
    go.onclick = () => {
      wear(shown);
      leaving = 1.2;
    };
    back.onclick = close;
    row.append(prev, go, next);
    ui.append(name, row);
    root.append(ui, back);
    document.body.append(root);
    name.textContent = look(shown).name;
    // drag to slide, tap a character to pick it
    let downX = 0;
    let downCam = 0;
    let moved = false;
    const canvas = stage.renderer.domElement;
    canvas.onpointerdown = (e) => {
      downX = e.clientX;
      downCam = camX;
      moved = false;
      canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove = (e) => {
      if (!canvas.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - downX;
      if (Math.abs(dx) > 8) moved = true;
      if (moved) select(Math.round((downCam - (dx / canvas.clientWidth) * 6) / P.spacing));
    };
    canvas.onpointerup = (e) => {
      if (moved) return;
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, stage.camera);
      const hit = ray.intersectObjects(
        crowd.map((c) => c.ch.root),
        true,
      )[0];
      if (!hit) return;
      const i = crowd.findIndex((c) => c.ch.root.getObjectById(hit.object.id));
      if (i >= 0) select(i);
    };
    openBtn.style.display = 'none';
  };
  let leaving = 0;

  const open = () => ({ A: openA, B: openB, C: openC })[variant]();

  const openBtn = el('button', '', '👕');
  openBtn.id = 'look-open';
  openBtn.onclick = open;
  document.body.append(openBtn);

  // ---------- frame loop
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const onTitle = screen() === 'title';
    openBtn.style.visibility = onTitle && variant !== 'B' ? 'visible' : 'hidden';
    if (variant === 'B' && root) root.style.display = onTitle ? '' : 'none';
    if (!root) return;
    if (solo && (variant === 'A' || variant === 'B')) {
      spinAt += dt;
      if (dragX === null) {
        turn += turnVel * dt;
        turnVel *= Math.exp(-P.coast * dt);
      }
      solo.facing = turn + (dragged ? 0 : Math.sin(spinAt * THREE.MathUtils.degToRad(P.spin)) * 0.9);
      solo.update(dt, 0, 0, 0, 0, false);
      preview.camera.position.set(0, P.camHeight, P.camDist);
      preview.camera.lookAt(0, P.lookY, 0);
      preview.draw();
    }
    if (variant === 'C') {
      const at = crowd.findIndex((c) => c.l.id === shown);
      camX += (at * P.spacing - camX) * Math.min(1, dt * P.slideEase);
      crowd.forEach((c, i) => {
        const me = i === at;
        c.z += ((me ? P.stepOut : 0) - c.z) * Math.min(1, dt * 8);
        let vx = 0;
        if (me && leaving > 0) {
          leaving -= dt;
          c.z += dt * 2.5;
          vx = 0.001;
          if (leaving <= 0) close();
        }
        const toward = Math.atan2(at * P.spacing - i * P.spacing, 3) * (me ? 0 : 0.6);
        c.ch.facing = toward;
        c.ch.update(dt, i * P.spacing, c.z, 0, me && leaving > 0 ? 3 : vx, false);
        c.ch.root.rotation.y = me && leaving > 0 ? 0 : toward;
      });
      stage.camera.position.set(camX, P.lineCamHeight, P.lineCamDist);
      stage.camera.lookAt(camX, P.lineLookY, 0);
      stage.draw();
    }
  };
  requestAnimationFrame(frame);

  // ---------- switcher bar, tuning panel, dump
  const bar = el('div');
  bar.id = 'look-bar';
  const label = el('span');
  const select = (v: Variant) => {
    variant = v;
    url.searchParams.set('look', v);
    history.replaceState(null, '', url);
    label.textContent = `${v} (${NAMES[v]})`;
    close();
    if (v === 'B') open();
  };
  const cycle = (d: number) => select(VARIANTS[(VARIANTS.indexOf(variant) + d + VARIANTS.length) % VARIANTS.length]);
  const prevV = el('button', '', '◀');
  const nextV = el('button', '', '▶');
  prevV.onclick = () => cycle(-1);
  nextV.onclick = () => cycle(1);
  const dumpBtn = el('button', '', 'Dump');
  // a textarea, not text: the game turns off text selection, and http on the LAN has no clipboard API
  const dump = el('div');
  dump.id = 'look-dump';
  const text = el('textarea');
  text.readOnly = true;
  const copy = el('button', '', 'Copy');
  const shut = el('button', '', 'Close');
  const btnRow = el('div');
  btnRow.append(copy, shut);
  dump.append(text, btnRow);
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
    text.value = `// look=${variant} — ${NAMES[variant]} · picked ${picked}\n${JSON.stringify(P, null, 2)}
// cap fits [up, forward, size, tilt°]
${JSON.stringify(FITS)}`;
    dump.style.display = 'flex';
    console.log(text.value);
  };
  bar.append(prevV, label, nextV, dumpBtn);
  document.body.append(bar, dump);
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === '[') cycle(-1);
    if (e.key === ']') cycle(1);
  });
  addEventListener('resize', placeB);

  void import('lil-gui').then(({ default: GUI }) => {
    const gui = new GUI({ title: 'PROTOTYPE · character select' });
    const reopen = () => root && open();
    const reopenKeep = () => {
      for (const img of document.querySelectorAll<HTMLImageElement>('.look-cell img'))
        img.src = thumbs.get(img.parentElement?.dataset.id ?? '') ?? '';
    };
    gui.add(P, 'showFun').name('show fun looks').onChange(reopen);
    gui.add(P, 'hideCustomerLooks').name('hide Customer looks').onChange(reopen);
    const cam = gui.addFolder('Preview camera');
    cam.add(P, 'spin', 0, 120, 1).name('sway °/s');
    cam.add(P, 'dragDegPerPx', 0.1, 2, 0.05).name('drag °/px');
    cam.add(P, 'coast', 0.5, 12, 0.5).name('coast stop /s');
    cam.add(P, 'camDist', 1.5, 8, 0.1);
    cam.add(P, 'camHeight', 0, 3, 0.05);
    cam.add(P, 'lookY', 0, 1.5, 0.02);
    cam.add(P, 'fov', 15, 70, 1);
    const a = gui.addFolder('A · Wardrobe');
    a.add(P, 'thumbSize', 48, 140, 2).onChange(reopen);
    const b = gui.addFolder('B · Beside the shelf');
    b.add(P, 'bSize', 15, 70, 1).name('height vh').onChange(placeB);
    b.add(P, 'bLeft', 0, 60, 0.5).name('left vw').onChange(placeB);
    b.add(P, 'bBottom', 0, 60, 0.5).name('bottom vh').onChange(placeB);
    const c = gui.addFolder('C · Line-up');
    c.add(P, 'spacing', 0.7, 2, 0.05).onChange(reopen);
    c.add(P, 'slideEase', 1, 20, 0.5);
    c.add(P, 'stepOut', 0, 1.5, 0.05);
    c.add(P, 'lineCamHeight', 0, 5, 0.05);
    c.add(P, 'lineCamDist', 3, 14, 0.1);
    c.add(P, 'lineLookY', -1, 1.5, 0.02);
    gui.add(P, 'firstRunOpens').name('opens on first run');
    const fit = gui.addFolder('Cap fit (look in the preview)');
    const F = { up: 0, forward: 0, size: 1, tilt: 0 };
    const ctrls = [
      fit.add(F, 'up', -0.4, 0.2, 0.005),
      fit.add(F, 'forward', -0.2, 0.2, 0.005),
      fit.add(F, 'size', 0.6, 1.6, 0.01),
      fit.add(F, 'tilt', -40, 40, 1),
    ];
    const apply = () => {
      const f = fitOf(shown);
      [f[0], f[1], f[2], f[3]] = [F.up, F.forward, F.size, F.tilt];
      showSolo(shown, false);
      if (shown === picked) game()?.view.protoSwapPlayer();
    };
    for (const c of ctrls) c.onFinishChange(() => ((thumbs = portraits(shownCap)), reopenKeep()));
    for (const c of ctrls) c.onChange(apply);
    // the sliders follow whichever look is in the preview
    onShow = (id) => {
      [F.up, F.forward, F.size, F.tilt] = fitOf(id);
      for (const c of ctrls) c.updateDisplay();
    };
    onShow(shown);
    gui.close();
  });

  label.textContent = `${variant} (${NAMES[variant]})`;
  if (url.searchParams.has('capsheet')) {
    const sheet = el('div');
    sheet.style.cssText =
      'position:fixed;inset:0;z-index:90;background:#fff1d0;display:flex;flex-wrap:wrap;overflow:auto';
    const front = portraits(P.capColour, 0.3, 220, true);
    const side = portraits(P.capColour, Math.PI / 2, 220, true);
    for (const l of LOOKS.filter((o) => !o.fun)) {
      const cell = el('div', '', `<b style="position:absolute;font:14px monospace">${l.id}</b>`);
      cell.style.position = 'relative';
      for (const src of [front.get(l.id), side.get(l.id)])
        cell.append(Object.assign(el('img'), { src: src ?? '', style: 'width:170px' }));
      sheet.append(cell);
    }
    document.body.append(sheet);
  }
  if (variant === 'B') open();
  else if (P.firstRunOpens && !store.get('id')) open();
}
