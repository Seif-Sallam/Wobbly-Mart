// PROTOTYPE (throwaway, branch prototype/pizza-shelves): `?gallery=1` shows every Pizza Place Shelf preset side by side;
// the lil-gui panel (spacing, tilt, ...) and the Dump button also run in game with `?pshelf=a|b|c|d`.
import * as THREE from 'three';
import GUI from 'lil-gui';
import {
  ACTIVE,
  PIZZA_PRODUCTS,
  TUNE,
  VARIANTS,
  buildPizzaShelf,
  saveTune,
  type PizzaProduct,
  type PizzaShelf,
} from '../view/pizza-shelves-prototype';
import { itemModel } from '../view/instanced';
import { PALETTE, SHADES } from '../palette';

const MODELS: Record<PizzaProduct, string> = { pizza: 'pizza', veggie_pizza: 'veggie-pizza', dough: 'dough' };
const FILLS: Record<string, number> = { Empty: 0, Half: 6, Full: 12 };
const PITCH = 3.7;

interface Stand {
  pivot: THREE.Group;
  product: PizzaProduct;
  shelf: PizzaShelf;
  items: THREE.Object3D[];
  phase: number;
}

export function openPizzaShelvesPrototype(): void {
  const url = new URL(location.href);
  let picked = ACTIVE || url.searchParams.get('pshelf') || 'a';
  const gallery = url.searchParams.has('gallery');

  const dumpBox = document.createElement('div');
  dumpBox.style.cssText = `position:fixed;inset:8% 12%;z-index:200;background:${PALETTE.cream};color:${PALETTE.ink};padding:12px;
    border-radius:12px;font:12px ui-monospace,monospace;white-space:pre;overflow:auto;display:none;user-select:text`;
  dumpBox.onclick = () => (dumpBox.style.display = 'none');
  document.body.append(dumpBox);

  const gui = new GUI({ title: 'Pizza shelves' });
  gui.domElement.style.zIndex = '300';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (innerWidth < 900) gui.close();
  let rebuild = () => location.reload();
  const tune = (key: keyof typeof TUNE, min: number, max: number) =>
    gui.add(TUNE, key, min, max, 0.01).onFinishChange(() => {
      saveTune();
      rebuild();
    });
  tune('spacing', 0.7, 1.3);
  tune('tilt', 0, 2);
  tune('tier', 0.5, 1.6);
  tune('sign', 0.5, 1.8);
  tune('glow', 0, 2);
  gui
    .add(
      {
        dump: () => {
          const text = JSON.stringify({ pshelf: picked, ...TUNE }, null, 2);
          dumpBox.textContent = `// tap to close\n${text}`;
          dumpBox.style.display = 'block';
          console.log(text);
          void navigator.clipboard?.writeText(text).catch(() => undefined);
        },
      },
      'dump',
    )
    .name('dump values');
  if (!gallery) {
    gui.title(`Pizza shelves (preset ${picked}: ${VARIANTS[picked]})`);
    return;
  }

  // ---------- gallery
  const css = document.createElement('style');
  css.textContent = `
    #ps-gal{position:fixed;inset:0;z-index:100;background:${PALETTE.cream};color:${PALETTE.ink};font:600 12px system-ui;
      display:flex;flex-direction:column;overflow:hidden;touch-action:none}
    #ps-gal canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
    #ps-bar{position:relative;display:flex;gap:4px;align-items:center;padding:4px 6px;flex-wrap:wrap}
    #ps-bar button{font:inherit;border:0;border-radius:6px;padding:4px 8px;background:#fff;color:${PALETTE.ink};cursor:pointer}
    #ps-bar button.on{background:${PALETTE.orange};color:#fff}
    #ps-bar .sp{flex:1}
    #ps-grid{position:relative;flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;padding:0 4px 4px;min-height:0}
    #ps-grid.one{grid-template-columns:1fr;grid-template-rows:1fr}
    #ps-grid .cell{position:relative;border:3px solid transparent;border-radius:10px;cursor:pointer;min-height:0}
    #ps-grid .cell.on{border-color:${PALETTE.orange};box-shadow:0 0 0 2px ${PALETTE.pad} inset}
    #ps-grid .cell b{position:absolute;left:6px;top:3px;background:#3a2416cc;color:${PALETTE.cream};padding:1px 6px;border-radius:6px;font-size:11px;pointer-events:none}
    #ps-grid .cell span{position:absolute;left:6px;bottom:2px;right:6px;font-size:10px;font-weight:500;pointer-events:none}`;
  document.head.append(css);
  const gal = document.createElement('div');
  gal.id = 'ps-gal';
  gal.addEventListener('pointerdown', (e) => e.stopPropagation());
  const canvas = document.createElement('canvas');
  const bar = document.createElement('div');
  bar.id = 'ps-bar';
  const grid = document.createElement('div');
  grid.id = 'ps-grid';
  gal.append(canvas, bar, grid);
  document.body.append(gal);

  let mode = 'Cycle';
  let focus = false;
  const modeBtns = ['Empty', 'Half', 'Full', 'Cycle'].map((m) => {
    const b = document.createElement('button');
    b.textContent = m;
    b.onclick = () => {
      mode = m;
      mark();
    };
    return b;
  });
  const focusBtn = document.createElement('button');
  focusBtn.textContent = 'Zoom picked';
  focusBtn.onclick = () => {
    focus = !focus;
    mark();
  };
  const play = document.createElement('button');
  const hint = document.createElement('span');
  hint.className = 'sp';
  const close = document.createElement('button');
  close.textContent = 'Close';
  bar.append(...modeBtns, focusBtn, hint, play, close);

  const cells = Object.keys(VARIANTS).map((v) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.innerHTML = `<b>${v.toUpperCase()}</b><span>${VARIANTS[v]}</span>`;
    cell.onclick = () => {
      picked = v;
      url.searchParams.set('pshelf', v);
      history.replaceState(null, '', url);
      mark();
    };
    grid.append(cell);
    return { v, cell };
  });
  function mark() {
    modeBtns.forEach((b) => b.classList.toggle('on', b.textContent === mode));
    focusBtn.classList.toggle('on', focus);
    grid.classList.toggle('one', focus);
    for (const { v, cell } of cells) {
      cell.classList.toggle('on', v === picked);
      cell.style.display = focus && v !== picked ? 'none' : '';
    }
    hint.textContent = `Tap a cell to pick it. Picked: ${picked.toUpperCase()}`;
    play.textContent = `Play ?pshelf=${picked}`;
  }
  play.onclick = () => {
    const u = new URL(location.href);
    u.search = `?map=pizza-place&pshelf=${picked}`;
    location.href = u.toString();
  };
  close.onclick = () => {
    stop();
    gal.remove();
    url.searchParams.delete('gallery');
    history.replaceState(null, '', url);
  };

  // ---------- scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SHADES.floor.light);
  scene.add(new THREE.HemisphereLight(SHADES.white, SHADES.thumbGround, 2.2));
  const sun = new THREE.DirectionalLight(SHADES.white, 2.4);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  const rows = new Map<string, { root: THREE.Group; stands: Stand[] }>();
  const build = () => {
    for (const r of rows.values()) scene.remove(r.root);
    rows.clear();
    Object.keys(VARIANTS).forEach((v, vi) => {
      const root = new THREE.Group();
      root.position.x = vi * 40;
      const stands = PIZZA_PRODUCTS.map((product, i): Stand => {
        const pivot = new THREE.Group();
        pivot.position.x = (i - 1) * PITCH;
        const body = new THREE.Group();
        pivot.add(body);
        const shelf = buildPizzaShelf(v, product, 3, 1, body);
        const items = shelf.slots.map((s) => {
          const it = itemModel(MODELS[product]);
          it.position.copy(s);
          it.rotation.x = shelf.tilt;
          body.add(it);
          return it;
        });
        root.add(pivot);
        return { pivot, product, shelf, items, phase: i };
      });
      scene.add(root);
      rows.set(v, { root, stands });
    });
  };
  build();
  rebuild = build;

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const yaw = THREE.MathUtils.degToRad(20);
  const pitch = THREE.MathUtils.degToRad(35);
  let t = 0;
  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    const W = innerWidth;
    const H = innerHeight;
    renderer.setSize(W, H, false);
    renderer.setClearColor(SHADES.floor.light);
    renderer.setScissor(0, 0, W, H);
    renderer.clear();
    for (const { v, cell } of cells) {
      if (cell.style.display === 'none') continue;
      const r = cell.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const row = rows.get(v);
      if (!row) continue;
      for (const s of row.stands) {
        s.pivot.rotation.y = Math.sin(t * 0.45 + s.phase * 1.3) * 0.75;
        s.shelf.animate?.(dt, false);
        const n = mode === 'Cycle' ? [0, 6, 12][Math.floor(t / 2.2 + s.phase) % 3] : FILLS[mode];
        s.items.forEach((it, i) => (it.visible = i < n));
      }
      const half = Math.max(2.3, (PITCH * 1.5 + 0.2) / (r.width / r.height));
      const aspect = r.width / r.height;
      Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
      cam.updateProjectionMatrix();
      const focusPt = new THREE.Vector3(row.root.position.x, 0.9, 0);
      cam.position
        .copy(focusPt)
        .add(
          new THREE.Vector3(
            Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            Math.cos(yaw) * Math.cos(pitch),
          ).multiplyScalar(20),
        );
      cam.lookAt(focusPt);
      const y = H - r.bottom;
      renderer.setViewport(r.left, y, r.width, r.height);
      renderer.setScissor(r.left, y, r.width, r.height);
      renderer.render(scene, cam);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
  };
  mark();
  raf = requestAnimationFrame(frame);
}
