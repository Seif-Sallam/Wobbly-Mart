// PROTOTYPE (throwaway, branch prototype/staff-looks): `?staff=O|A|B|C&cashier=O|A|B|C` — each Staff kind's icon
// (Pads, guidance arrows, Office) and the Cashier's animation while checking out a Customer.
import * as THREE from 'three';
import type GUI from 'lil-gui';
import { Character } from '../view/characters';
import { mopModel } from '../view/cleaning';
import { paletteMaterial } from '../view/materials';
import { icon, renderObjectThumbs, setIcon } from '../view/thumbs';
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
      setIcon(`staff-${k}`, c);
    }
    return;
  }
  renderObjectThumbs(
    KINDS.map((k): [string, THREE.Object3D] => {
      const ch = new Character('employee', { hat: CAPS[k] });
      // dt 1 settles the clip weights so the thumbnail shows the pose
      ch.update(1, 0, 0, 0, 0, variant === 'B' && k !== 'cleaner');
      if (variant === 'B') ch.root.add(tool(k));
      return [`staff-${k}`, ch.root];
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
  drawIcons(iconVariant);

  const state = new WeakMap<Character, { reg: RegisterStation; t: number; last: number; serve: number }>();
  const pose = (ch: Character) => (v: THREE.Group, dt: number) => {
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
        ch.pose = pose(ch);
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
