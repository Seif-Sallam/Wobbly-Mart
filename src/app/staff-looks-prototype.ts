// PROTOTYPE (throwaway, branch prototype/staff-looks): `?staff=O|A|B|C&cashier=O|A|B|C` — each Staff kind's icon
// (Pads, guidance arrows, Office) and the Cashier's animation while checking out a Customer.
import * as THREE from 'three';
import type GUI from 'lil-gui';
import { Character } from '../view/characters';
import { mopModel } from '../view/cleaning';
import { paletteMaterial } from '../view/materials';
import { icon, renderObjectThumbs, setIcon } from '../view/thumbs';
import { itemModel } from '../view/instanced';
import { buildStation } from '../view/stations';
import { MAPS } from '../../maps';
import type { RegisterStation } from '../sim/world';
import { PALETTE, SHADES } from '../palette';

type Kind = 'cashier' | 'stocker' | 'cleaner';
const KINDS: Kind[] = ['cashier', 'stocker', 'cleaner'];
const CAPS: Record<Kind, string> = { cashier: SHADES.white, stocker: SHADES.roleCaps.auto, cleaner: SHADES.cleanerCap };

const ICONS: Record<string, string> = {
  O: 'Today: one employee icon for all three',
  A: 'Caps: the employee in its own cap colour',
  B: 'Tools: cap + what it handles (cash, boxes, mop)',
  C: 'Badges: the employee with an emoji badge',
};

const box = (w: number, h: number, d: number, colour: string, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paletteMaterial(colour));
  m.position.set(x, y, z);
  return m;
};

function tool(kind: Kind): THREE.Object3D {
  const g = new THREE.Group();
  if (kind === 'cleaner') {
    const mop = mopModel();
    mop.position.set(0.38, 0, 0.2);
    mop.rotation.set(0.2, 0, -0.2);
    g.add(mop);
  } else if (kind === 'stocker') {
    for (let i = 0; i < 3; i++) g.add(box(0.36, 0.22, 0.3, PALETTE.wood, 0, 0.55 + i * 0.24, 0.32));
  } else {
    g.add(box(0.34, 0.06, 0.18, PALETTE.money, 0.05, 0.62, 0.32), box(0.34, 0.06, 0.18, PALETTE.money, 0, 0.69, 0.3));
  }
  return g;
}

/** Draws a variant's three icons under `gal-<variant>-<kind>`. */
function drawIcons(variant: string): void {
  if (variant === 'O') return;
  if (variant === 'C') {
    const base = icon('employee');
    const badge: Record<Kind, string> = { cashier: '💵', stocker: '📦', cleaner: '🧹' };
    for (const k of KINDS) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      if (!g || !base) continue;
      g.drawImage(base, 0, 0);
      g.fillStyle = PALETTE.cream;
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(94, 94, 30, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.font = '36px system-ui, "Apple Color Emoji", "Segoe UI Emoji"';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(badge[k], 94, 97);
      setIcon(`gal-${variant}-${k}`, c);
    }
    return;
  }
  renderObjectThumbs(
    KINDS.map((k): [string, THREE.Object3D] => {
      const ch = new Character('employee', { hat: CAPS[k] });
      // dt 1 settles the clip weights so the thumbnail shows the pose
      ch.update(1, 0, 0, 0, 0, variant === 'B' && k !== 'cleaner');
      if (variant === 'B') ch.root.add(tool(k));
      return [`gal-${variant}-${k}`, ch.root];
    }),
  );
}

// ---------- Cashier
interface Anim {
  /** Arm raised forward while serving (rad). */
  lift: number;
  /** Side-to-side sweep of the scanning arm (rad) and sweeps per second. */
  sweep: number;
  rate: number;
  /** Torso turn between belt and bag (rad). */
  turn: number;
  /** Hop per sweep (m) and a happy emote when the Customer is done. */
  hop: number;
  cheer: boolean;
  /** Head nod per sweep (rad). */
  nod: number;
}
const NONE: Anim = { lift: 0, sweep: 0, rate: 0, turn: 0, hop: 0, cheer: false, nod: 0 };
const CASHIERS: Record<string, { name: string; params: Anim }> = {
  O: { name: 'Today: stands idle', params: NONE },
  A: { name: 'Scan: one arm sweeps goods past the till', params: { ...NONE, lift: 1.1, sweep: 0.6, rate: 2.2 } },
  B: {
    name: 'Bag: arms out, turns belt → bag, nods when done',
    params: { ...NONE, lift: 0.9, rate: 1.4, turn: 0.55, cheer: true },
  },
  C: {
    name: 'Lively: bouncy scan + nod, hop of joy when done',
    params: { lift: 1.2, sweep: 0.7, rate: 2.6, turn: 0.15, hop: 0.06, cheer: true, nod: 0.18 },
  },
};

export function openStaffLooksPrototype(): void {
  const url = new URL(location.href);
  const pick = (k: string, all: object, d: string) => {
    const v = url.searchParams.get(k) ?? '';
    return v in all ? v : d;
  };
  const iconVariant = pick('staff', ICONS, 'A');
  let cashier = pick('cashier', CASHIERS, 'A');
  const P: Anim = { ...CASHIERS[cashier].params };
  for (const v of Object.keys(ICONS)) drawIcons(v);
  for (const k of KINDS) {
    const c = icon(`gal-${iconVariant}-${k}`);
    if (c) setIcon(`staff-${k}`, c);
  }

  const state = new WeakMap<Character, { reg: RegisterStation; t: number; last: number; serve: number }>();
  const pose = (ch: Character, A: () => Anim) => (v: THREE.Group, dt: number) => {
    const P = A();
    const s = state.get(ch);
    if (!s) return;
    const serving = s.reg.progress > 0;
    if (P.cheer && s.last > 0 && !serving) ch.emote('yes');
    s.last = s.reg.progress;
    s.serve += ((serving ? 1 : 0) - s.serve) * Math.min(1, dt * 8);
    s.t += dt * (serving ? 1 : 0);
    const k = s.serve;
    if (k < 0.001) return;
    const ph = s.t * P.rate * Math.PI * 2;
    const [armL, armR, torso, head] = ['arm-left', 'arm-right', 'torso', 'head'].map((n) => v.getObjectByName(n));
    if (armR) {
      armR.rotation.x -= P.lift * k;
      armR.rotation.y += Math.sin(ph) * P.sweep * k;
    }
    if (armL && P.turn > 0.3) armL.rotation.x -= P.lift * k;
    if (torso) torso.rotation.y += Math.sin(ph * 0.5) * P.turn * k;
    if (head) head.rotation.x += Math.max(0, Math.sin(ph)) * P.nod * k;
    v.position.y += Math.abs(Math.sin(ph)) * P.hop * k;
  };
  Object.assign(globalThis, {
    protoCashier: (ch: Character, reg: RegisterStation) => {
      const s = state.get(ch);
      if (s) s.reg = reg;
      else {
        state.set(ch, { reg, t: 0, last: 0, serve: 0 });
        ch.pose = pose(ch, () => P);
      }
    },
  });

  // ---------- switcher, panel, dump
  const css = document.createElement('style');
  css.textContent = `
    #sl-bar{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 6px);transform:translateX(-50%);z-index:60;
      display:flex;gap:4px;align-items:center;background:#3a2416e6;padding:4px;border-radius:10px;font:600 12px system-ui;color:#fff1d0}
    #sl-bar button{font:inherit;border:0;border-radius:6px;padding:5px 9px;background:#fff1d0;color:#3a2416;cursor:pointer}
    #sl-bar button.on{background:#f26b1d;color:#fff}
    #sl-bar img{width:30px;height:30px}
    #sl-label{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 50px);z-index:60;
      background:#3a2416aa;color:#fff1d0;padding:2px 8px;border-radius:6px;font:600 11px system-ui;pointer-events:none}
    #sl-dump{position:fixed;inset:10% 15%;z-index:70;background:#fff1d0;color:#3a2416;padding:14px;border-radius:12px;
      font:12px ui-monospace,monospace;white-space:pre;overflow:auto;display:none;user-select:text}`;
  document.head.append(css);
  const bar = document.createElement('div');
  bar.id = 'sl-bar';
  const label = document.createElement('div');
  label.id = 'sl-label';
  const dump = document.createElement('div');
  dump.id = 'sl-dump';
  dump.onclick = () => (dump.style.display = 'none');
  document.body.append(bar, label, dump);
  for (const d of [bar, dump]) d.addEventListener('pointerdown', (e) => e.stopPropagation());

  const group = (title: string) => {
    const s = document.createElement('span');
    s.textContent = title;
    s.style.margin = '0 2px 0 6px';
    bar.append(s);
  };
  const buttons: HTMLButtonElement[] = [];
  const mark = () => {
    for (const b of buttons)
      b.classList.toggle('on', b.dataset.g === 'staff' ? b.dataset.v === iconVariant : b.dataset.v === cashier);
    label.textContent = `icons ${iconVariant}: ${ICONS[iconVariant]} · cashier ${cashier}: ${CASHIERS[cashier].name}`;
  };
  group('Icons');
  for (const v of Object.keys(ICONS)) {
    const b = document.createElement('button');
    b.textContent = v;
    b.dataset.g = 'staff';
    b.dataset.v = v;
    b.title = ICONS[v];
    // icons are drawn once into the Pads, so switching reloads
    b.onclick = () => {
      url.searchParams.set('staff', v);
      location.href = url.toString();
    };
    bar.append(b);
    buttons.push(b);
  }
  for (const k of KINDS) {
    const img = document.createElement('img');
    img.title = k;
    img.src = (icon(iconVariant === 'O' ? 'employee' : `staff-${k}`) ?? icon('employee'))?.toDataURL() ?? '';
    bar.append(img);
  }
  group('Cashier');
  let gui: GUI | null = null;
  const selectCashier = (v: string) => {
    cashier = v;
    Object.assign(P, CASHIERS[v].params);
    url.searchParams.set('cashier', v);
    history.replaceState(null, '', url);
    gui?.controllersRecursive().forEach((c) => c.updateDisplay());
    mark();
  };
  for (const v of Object.keys(CASHIERS)) {
    const b = document.createElement('button');
    b.textContent = v;
    b.dataset.g = 'cashier';
    b.dataset.v = v;
    b.title = CASHIERS[v].name;
    b.onclick = () => selectCashier(v);
    bar.append(b);
    buttons.push(b);
  }
  const dumpBtn = document.createElement('button');
  dumpBtn.textContent = 'Dump';
  dumpBtn.onclick = () => {
    dump.textContent =
      `// staff=${iconVariant} — ${ICONS[iconVariant]}\n` +
      `// cashier=${cashier} — ${CASHIERS[cashier].name}\n${JSON.stringify(P, null, 2)}`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(dumpBtn);

  // ---------- gallery: every icon variant and every Cashier animation at once
  const galCss = document.createElement('style');
  galCss.textContent = `
    #sl-gal{position:fixed;inset:0;z-index:80;background:${PALETTE.cream};color:${PALETTE.ink};overflow:auto;
      padding:12px 16px 40px;font:600 13px system-ui;display:none;box-sizing:border-box}
    #sl-gal h2{margin:10px 0 6px;font-size:16px}
    #sl-gal .close{position:fixed;top:10px;right:14px;font:700 14px system-ui;border:0;border-radius:8px;padding:8px 14px;
      background:${PALETTE.orange};color:#fff;z-index:81}
    #sl-gal .icons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    #sl-gal .card{background:#fff;border-radius:12px;padding:8px;border:3px solid transparent;cursor:pointer}
    #sl-gal .card.on{border-color:${PALETTE.orange}}
    #sl-gal .card p{margin:0 0 6px;font-size:12px}
    #sl-gal .row{display:flex;gap:6px;justify-content:space-around;align-items:flex-end}
    #sl-gal .row div{text-align:center;font-size:10px;font-weight:500}
    #sl-gal .pad{width:64px;height:64px;border-radius:14px;background:${PALETTE.pad};display:grid;place-items:center;margin:0 auto 2px}
    #sl-gal .pad img{width:52px;height:52px}
    #sl-gal .small img{width:28px;height:28px;display:block;margin:2px auto 0}
    #sl-gal canvas{width:100%;height:min(46vh,340px);display:block;border-radius:12px;background:${SHADES.floor.light}}
    #sl-gal .cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:6px}
    #sl-gal .cols .card{font-size:12px}`;
  document.head.append(galCss);
  const gal = document.createElement('div');
  gal.id = 'sl-gal';
  gal.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.append(gal);
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = 'Close gallery';
  const h1 = document.createElement('h2');
  h1.textContent = 'Staff icons: tap a card to use it in game (reloads)';
  const iconGrid = document.createElement('div');
  iconGrid.className = 'icons';
  for (const v of Object.keys(ICONS)) {
    const card = document.createElement('div');
    card.className = `card${v === iconVariant ? ' on' : ''}`;
    const p = document.createElement('p');
    p.textContent = `${v} · ${ICONS[v]}`;
    const row = document.createElement('div');
    row.className = 'row';
    for (const k of KINDS) {
      const src = (icon(v === 'O' ? 'employee' : `gal-${v}-${k}`) ?? icon('employee'))?.toDataURL() ?? '';
      const cell = document.createElement('div');
      cell.innerHTML = `<div class="pad"><img src="${src}"></div>${k}<span class="small"><img src="${src}"></span>`;
      row.append(cell);
    }
    card.append(p, row);
    card.onclick = () => {
      url.searchParams.set('staff', v);
      url.searchParams.set('gallery', '1');
      location.href = url.toString();
    };
    iconGrid.append(card);
  }
  const h2 = document.createElement('h2');
  h2.textContent = 'Cashier at work: a checkout every 3 s. Tap a card to tune it in the panel and use it in game';
  const canvas = document.createElement('canvas');
  const cols = document.createElement('div');
  cols.className = 'cols';
  const colCards = Object.keys(CASHIERS).map((v) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = `${v} · ${CASHIERS[v].name}`;
    card.onclick = () => {
      selectCashier(v);
      for (const [i, c] of colCards.entries()) c.classList.toggle('on', Object.keys(CASHIERS)[i] === v);
    };
    cols.append(card);
    return card;
  });
  gal.append(close, h1, iconGrid, h2, canvas, cols);

  let stop: (() => void) | null = null;
  const openGallery = () => {
    gal.style.display = 'block';
    for (const [i, c] of colCards.entries()) c.classList.toggle('on', Object.keys(CASHIERS)[i] === cashier);
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
    const product = Object.values(MAPS[0].products)[0]?.model ?? '';
    const GAP = 6;
    const lanes = Object.keys(CASHIERS).map((v, i) => {
      const x = i * GAP;
      const reg = buildStation('register', [x - 1.3, -0.5, 2.6, 1], 0);
      scene.add(reg.root);
      const ch = new Character('employee', { hat: SHADES.white });
      const cz = -1.1;
      ch.facing = Math.atan2(0, -cz);
      scene.add(ch.root);
      const fake = { progress: 0 } as RegisterStation;
      state.set(ch, { reg: fake, t: 0, last: 0, serve: 0 });
      ch.pose = pose(ch, () => (v === cashier ? P : CASHIERS[v].params));
      const goods = [0, 1, 2].map(() => {
        const g = itemModel(product);
        g.scale.setScalar(0.6);
        scene.add(g);
        return g;
      });
      return { x, cz, ch, fake, reg, goods };
    });
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
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      renderer.setSize(W, H, false);
      const cw = W / lanes.length;
      const half = 1.9;
      for (const [i, l] of lanes.entries()) {
        const cyc = (t + i * 0.25) % 3;
        l.fake.progress = cyc < 2 ? cyc / 2 : 0;
        l.ch.update(dt, l.x, l.cz, 0, 0, false);
        const belt = l.reg.belt;
        l.goods.forEach((g, n) => {
          const k = THREE.MathUtils.clamp(l.fake.progress * 1.6 - (n / 3) * 0.6, 0, 1);
          g.visible = !!belt && l.fake.progress > 0;
          if (belt)
            g.position.copy(l.reg.root.localToWorld(k < 1 ? belt[0].clone().lerp(belt[1], k) : belt[2].clone()));
        });
        const aspect = cw / H;
        Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
        cam.updateProjectionMatrix();
        const focus = new THREE.Vector3(l.x, 0.6, -0.4);
        cam.position
          .copy(focus)
          .add(
            new THREE.Vector3(
              Math.sin(yaw) * Math.cos(pitch),
              Math.sin(pitch),
              Math.cos(yaw) * Math.cos(pitch),
            ).multiplyScalar(20),
          );
        cam.lookAt(focus);
        renderer.setViewport(i * cw, 0, cw, H);
        renderer.setScissor(i * cw + 2, 0, cw - 4, H);
        renderer.render(scene, cam);
      }
    };
    raf = requestAnimationFrame(frame);
    stop = () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      for (const l of lanes) state.delete(l.ch);
    };
  };
  close.onclick = () => {
    gal.style.display = 'none';
    stop?.();
    stop = null;
    url.searchParams.delete('gallery');
    history.replaceState(null, '', url);
  };
  const galBtn = document.createElement('button');
  galBtn.textContent = 'Gallery';
  galBtn.onclick = openGallery;
  bar.prepend(galBtn);
  if (url.searchParams.has('gallery')) openGallery();

  void import('lil-gui').then(({ default: G }) => {
    gui = new G({ title: 'PROTOTYPE · Cashier at work (live)' });
    gui.domElement.style.zIndex = '60';
    gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
    gui.add(P, 'lift', 0, 2, 0.05).name('arm lift (rad)');
    gui.add(P, 'sweep', 0, 1.5, 0.05).name('scan sweep (rad)');
    gui.add(P, 'rate', 0, 5, 0.1).name('sweeps / s');
    gui.add(P, 'turn', 0, 1.2, 0.05).name('turn belt → bag (rad)');
    gui.add(P, 'nod', 0, 0.6, 0.02).name('nod (rad)');
    gui.add(P, 'hop', 0, 0.2, 0.01).name('hop (m)');
    gui.add(P, 'cheer').name('happy hop when done');
    gui.close();
  });
  selectCashier(cashier);
}
