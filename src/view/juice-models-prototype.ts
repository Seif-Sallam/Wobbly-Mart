// PROTOTYPE — throwaway showroom for the Juice Bar Producers (?variant=A|B|C).
import * as THREE from 'three';
import GUI from 'lil-gui';
import { Stage } from './stage';
import { buildStation } from './stations';
import { ITEM_SIZE } from '../../catalog/assets';
import { applyCssPalette } from '../palette';
import { BUILDERS, C, P, PRODUCERS, STYLE_NAMES, box, mat, type Built, type Style } from './juice-producers';
// ---------- the showroom

applyCssPalette(document.documentElement);
const stage = new Stage(document.getElementById('scene') as HTMLCanvasElement);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat('#e8dccb'));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
stage.scene.add(floor);

interface Placed {
  id: string;
  root: THREE.Group;
  built: Built;
  centre: THREE.Vector3;
  phase: number;
  regrow: number[];
  outCount: number;
  outItems: THREE.Mesh[];
  inItems: THREE.Mesh[];
  label: HTMLDivElement;
}
let placed: Placed[] = [];
const itemGeo = new THREE.SphereGeometry(ITEM_SIZE * 0.35, 12, 8);
const bottleGeo = new THREE.CylinderGeometry(ITEM_SIZE * 0.18, ITEM_SIZE * 0.22, ITEM_SIZE * 0.8, 10);

function rebuild(): void {
  for (const p of placed) {
    stage.scene.remove(p.root);
    p.label.remove();
  }
  placed = [];
  const rows: string[][] = [
    ['apple_tree', 'orange_tree', 'sugar_cane_field', 'strawberry_patch'],
    ['apple_press', 'squeezer', 'sugar_mill', 'candy_pot', 'smoothie_blender'],
    ['ref_mill', 'ref_oven'],
  ];
  let z = 0;
  for (const row of rows) {
    let x = 0;
    let depth = 0;
    for (const id of row) {
      const [w, d] = id.startsWith('ref_') ? (id === 'ref_mill' ? [2.4, 3.5] : [2.2, 3.3]) : P.footprints[id];
      const root = new THREE.Group();
      root.position.set(x + w / 2, 0, z + d / 2);
      stage.scene.add(root);
      let built: Built;
      if (id.startsWith('ref_')) {
        const v = buildStation(id.slice(4), [-w / 2, -d / 2, w, d], 0);
        root.add(v.root);
        built = { group: v.root, animate: (dt, _t, wk) => v.animate(dt, wk) };
      } else {
        const kind = PRODUCERS.find((p) => p.id === id)!.kind;
        const strip = kind === 'machine' ? 1.1 : 0;
        built = BUILDERS[id](P.style, w, d - strip);
        built.group.position.z = -strip / 2;
        root.add(built.group);
        if (strip) {
          box(root, 1.46, 0.1, 0.99, C.woodDark, 0, 0, d / 2 - strip / 2);
        }
      }
      if (P.showFootprints) {
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.02, d)),
          new THREE.LineBasicMaterial({ color: '#3a2416' }),
        );
        edge.position.y = 0.01;
        root.add(edge);
      }
      const label = document.createElement('div');
      label.className = 'lbl';
      const meta = PRODUCERS.find((p) => p.id === id);
      label.textContent = meta?.name ?? (id === 'ref_mill' ? 'Mill (Corner Shop, for scale)' : 'Oven (Corner Shop, for scale)');
      label.onclick = () => focusOn(id);
      document.getElementById('labels')!.append(label);
      placed.push({
        id, root, built, centre: root.position.clone(), phase: Math.random() * 5, regrow: (built.fruits ?? []).map(() => 1),
        outCount: 0, outItems: [], inItems: [], label,
      });
      x += w + 1.5;
      depth = Math.max(depth, d);
    }
    z += depth + 2;
  }
  // output pallet items and input items
  for (const p of placed) {
    if (!p.built.output) continue;
    const [, d] = P.footprints[p.id];
    const bottle = p.built.output === C.appleJuice || p.built.output === C.orangeJuice || p.built.output === C.smoothie;
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(bottle ? bottleGeo : itemGeo, mat(p.built.output));
      const row = i < 3 ? 0 : i < 5 ? 1 : 2;
      const k = i < 3 ? i - 1 : i < 5 ? i - 3.5 : 0;
      m.position.set(k * 0.42, 0.1 + ITEM_SIZE * (0.35 + row * 0.5), d / 2 - 0.55);
      m.castShadow = true;
      m.visible = false;
      p.root.add(m);
      p.outItems.push(m);
    }
    for (const at of p.built.inputs?.at ?? []) {
      const m = new THREE.Mesh(itemGeo, mat(p.built.inputs!.colour));
      m.position.copy(at).add(new THREE.Vector3(0, ITEM_SIZE * 0.35, -0.55));
      m.castShadow = true;
      p.root.add(m);
      p.inItems.push(m);
    }
  }
  focusOn(P.focus);
}

function focusOn(id: string): void {
  P.focus = id;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  const p = placed.find((q) => q.id === id);
  if (p) {
    stage.focus.copy(p.centre);
    stage.zoomTo(P.zoom);
  } else {
    const bb = new THREE.Box3();
    for (const q of placed) bb.expandByObject(q.root);
    bb.getCenter(stage.focus).setY(0);
    stage.zoomTo(innerWidth < innerHeight ? 28 : 20);
  }
  const meta = PRODUCERS.find((q) => q.id === id);
  document.getElementById('cap')!.textContent = meta
    ? `${meta.name} — ${meta.recipe} · footprint ${P.footprints[id].join(' × ')} m`
    : 'All nine — tap a name to look closer';
  for (const q of placed) q.label.classList.toggle('on', q.id === id);
}

// ---------- panel

const gui = new GUI({ title: 'Juice Bar Producers' });
if (innerWidth < 700) gui.close();
gui.add(P, 'style', { 'A — Orchard stand': 'A', 'B — Fruit gadgets': 'B', 'C — Retro juice bar': 'C' }).name('Preset').onChange(() => setStyle(P.style));
gui
  .add(P, 'focus', { Overview: 'overview', ...Object.fromEntries(PRODUCERS.map((p) => [p.name, p.id])), 'Mill (ref)': 'ref_mill', 'Oven (ref)': 'ref_oven' })
  .name('Look at')
  .onChange((v: string) => focusOn(v));
gui.add(P, 'working', ['cycle', 'on', 'off']).name('Working');
gui.add(P, 'harvest').name('Crops harvest');
gui.add(P, 'showItems').name('Show Items');
gui.add(P, 'showFootprints').name('Footprints').onChange(rebuild);
gui.add(P, 'zoom', 4, 14, 0.5).name('Close-up zoom m').onChange(() => focusOn(P.focus));
const look = gui.addFolder('Look');
look.add(P, 'berryLook', { 'Straw bed, berries on top': 'rows', 'Half barrels, berries spilling': 'barrels', 'Stepped pyramid, berries dangling': 'pyramid' }).name('Strawberry patch').onChange(rebuild);
look.add(P, 'fruitSize', 0.6, 1.8, 0.05).name('Fruit size').onFinishChange(rebuild);
look.add(P, 'treeHeight', 0.6, 1.6, 0.05).name('Tree height').onFinishChange(rebuild);
const motion = gui.addFolder('Motion');
motion.add(P, 'sway', 0, 3, 0.1).name('Sway');
motion.add(P, 'shake', 0, 3, 0.1).name('Shake');
motion.add(P, 'spin', 0, 3, 0.1).name('Spin');
motion.add(P, 'bubbles', 0, 3, 0.1).name('Bubbles');
const fp = gui.addFolder('Footprints (w × d m)');
fp.close();
for (const p of PRODUCERS) {
  const pair = P.footprints[p.id];
  const o = { w: pair[0], d: pair[1] };
  fp.add(o, 'w', 1.5, 5, 0.1).name(`${p.name} w`).onFinishChange((v: number) => ((pair[0] = v), rebuild()));
  fp.add(o, 'd', 1.5, 5, 0.1).name(`${p.name} d`).onFinishChange((v: number) => ((pair[1] = v), rebuild()));
}
const dump = document.getElementById('dump') as HTMLPreElement;
gui.add({ show: () => ((dump.style.display = 'block'), (dump.textContent = JSON.stringify(P, null, 1))) }, 'show').name('Show values');
gui.add({ hide: () => (dump.style.display = 'none') }, 'hide').name('Hide values');

const KEYS: Style[] = ['A', 'B', 'C'];
function setStyle(s: Style): void {
  P.style = s;
  const u = new URL(location.href);
  u.searchParams.set('variant', s);
  history.replaceState(null, '', u);
  document.getElementById('vname')!.textContent = `${s} — ${STYLE_NAMES[s]}`;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  rebuild();
}
const step = (k: number) => setStyle(KEYS[(KEYS.indexOf(P.style) + k + 3) % 3]);
document.getElementById('prev')!.onclick = () => step(-1);
document.getElementById('next')!.onclick = () => step(1);
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
// tap empty floor to go back to the overview
document.getElementById('scene')!.addEventListener('click', () => focusOn('overview'));

setStyle(KEYS.includes(P.style) ? P.style : 'A');

// ---------- loop

const clock = new THREE.Clock();
let t = 0;
const screen = new THREE.Vector2();
function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  for (const p of placed) {
    const wk = P.working === 'on' || (P.working === 'cycle' && (t + p.phase) % 5 < 3.2);
    p.built.animate(dt, t, wk);
    // crops: a fruit is picked every few seconds and regrows
    const fr = p.built.fruits ?? [];
    fr.forEach((f, i) => {
      if (P.harvest && p.regrow[i] >= 1 && Math.random() < dt * 0.12) p.regrow[i] = 0;
      p.regrow[i] = Math.min(1, p.regrow[i] + dt / 6);
      const g = p.regrow[i];
      f.scale.setScalar(g < 1 ? g * 0.9 : 1 + Math.sin(t * 3 + i) * 0.03);
    });
    // machines: Items arrive on the pallet while working
    if (p.outItems.length) {
      if (wk) p.outCount = Math.min(6, p.outCount + dt * 0.6);
      else if (p.outCount >= 6) p.outCount = 0;
      p.outItems.forEach((m, i) => (m.visible = P.showItems && i < Math.floor(p.outCount)));
      p.inItems.forEach((m, i) => (m.visible = P.showItems && (wk ? i < 2 : i < 4)));
    }
    stage.toScreen(p.root.position.clone().add(new THREE.Vector3(0, 2.6, 0)), screen);
    p.label.style.left = `${screen.x}px`;
    p.label.style.top = `${screen.y}px`;
  }
  stage.render(dt);
}
frame();
