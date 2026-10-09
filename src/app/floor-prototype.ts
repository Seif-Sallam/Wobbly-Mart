// PROTOTYPE (throwaway, branch prototype/floor-tiles): `?floor=A|B|C|D` — shop floor tile size / contrast presets,
// live panel, value dump. Question: does a bigger, softer floor stop the strobing while sprinting?
import * as THREE from 'three';
import type { Game } from './game';

interface Params {
  /** Show today's Kenney floor (0.5 m checker) instead of the code-drawn one. */
  original: boolean;
  /** Side of one checker square (m). */
  square: number;
  /** 1 = full light/dark difference, 0 = one flat colour. */
  contrast: number;
  /** Grout line width as a fraction of a square. */
  grout: number;
  /** Anisotropic filtering: keeps far tiles from shimmering at this camera angle. */
  aniso: boolean;
  light: string;
  dark: string;
  groutColour: string;
}

const BASE: Params = {
  original: false,
  square: 1,
  contrast: 1,
  grout: 0.02,
  aniso: true,
  light: '#ece3d4',
  dark: '#c2b6ab',
  groutColour: '#b3a79c',
};
const PRESETS: Record<string, { name: string; params: Params }> = {
  A: { name: "Today's floor (Kenney, 0.5 m checker)", params: { ...BASE, original: true } },
  B: { name: '1 m checker, same contrast, filtered', params: { ...BASE } },
  C: { name: '2 m checker, half contrast', params: { ...BASE, square: 2, contrast: 0.5, grout: 0.03 } },
  D: { name: '2 m plain tiles, grout lines only', params: { ...BASE, square: 2, contrast: 0.08, grout: 0.035 } },
};
const VARIANTS = Object.keys(PRESETS);
const TEX = 512;

export async function openFloorPrototype(game: Game): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const url = new URL(location.href);
  let variant = url.searchParams.get('floor') ?? 'A';
  if (!PRESETS[variant]) variant = 'A';
  const P: Params = { ...PRESETS[variant].params };
  const renderer = game.stage.renderer;
  const original = (game.view.level as unknown as { floor: THREE.InstancedMesh[] }).floor;

  // ---------- the code-drawn floor: one plane per floor rect, a 2 × 2 checker texture repeating every 2 squares
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const planes: THREE.Mesh[] = game.world.map.layout.floors.map(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
    m.position.set(x + w / 2, 0.013, z + d / 2);
    m.receiveShadow = true;
    game.stage.scene.add(m);
    return m;
  });

  const draw = () => {
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    const mix = (a: string, b: string, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
    const mid = mix(P.light, P.dark, 0.5);
    const light = mix(mid, P.light, P.contrast);
    const dark = mix(mid, P.dark, P.contrast);
    const half = TEX / 2;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? dark : light;
        g.fillRect(i * half, j * half, half, half);
      }
    const gw = Math.max(0, P.grout * half);
    g.fillStyle = P.groutColour;
    for (const k of [0, half]) {
      g.fillRect(k - gw / 2, 0, gw, TEX);
      g.fillRect(0, k - gw / 2, TEX, gw);
    }
    g.fillRect(TEX - gw / 2, 0, gw, TEX);
    g.fillRect(0, TEX - gw / 2, TEX, gw);
    tex.anisotropy = P.aniso ? renderer.capabilities.getMaxAnisotropy() : 1;
    tex.needsUpdate = true;
    for (const p of planes) {
      const [w, d] = [(p.geometry as THREE.PlaneGeometry).parameters.width, (p.geometry as THREE.PlaneGeometry).parameters.height];
      const uv = p.geometry.attributes.uv;
      // world-anchored: squares line up across rects
      const x0 = p.position.x - w / 2;
      const z0 = p.position.z - d / 2;
      const period = P.square * 2;
      for (let i = 0; i < uv.count; i++) {
        const u = i % 2;
        const v = Math.floor(i / 2);
        uv.setXY(i, (x0 + u * w) / period, (z0 + v * d) / period);
      }
      uv.needsUpdate = true;
      p.visible = !P.original;
    }
    for (const o of original) o.visible = P.original;
  };

  // ---------- prototype chrome
  const style = document.createElement('style');
  style.textContent = `
    #proto-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;display:flex;gap:6px;
      background:#3a2416e6;padding:6px;border-radius:12px;font:600 13px system-ui;color:#fff1d0}
    #proto-bar button{font:inherit;border:0;border-radius:8px;padding:6px 10px;background:#fff1d0;color:#3a2416;cursor:pointer}
    #proto-bar button.on{background:#f26b1d;color:#fff}
    #proto-label{position:fixed;left:12px;top:64px;z-index:20;background:#3a2416e6;color:#fff1d0;padding:6px 10px;
      border-radius:8px;font:600 12px system-ui;white-space:pre;pointer-events:none}
    #proto-dump{position:fixed;inset:10% 10%;z-index:30;background:#fff1d0;color:#3a2416;padding:16px;border-radius:12px;
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

  const gui = new GUI({ title: 'PROTOTYPE · Floor tiles (live)' });
  gui.domElement.style.zIndex = '20';
  gui.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (innerWidth < 700) gui.close();
  const showLabel = () =>
    (label.textContent = `PROTOTYPE · floor=${variant}\n${PRESETS[variant].name}\nsprint around the shop (Shift / push the stick far)`);
  const select = (v: string) => {
    variant = v;
    Object.assign(P, PRESETS[v].params);
    url.searchParams.set('floor', v);
    history.replaceState(null, '', url);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    for (const b of bar.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v);
    showLabel();
    draw();
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
    dump.textContent = `// floor=${variant} — ${PRESETS[variant].name}\n${JSON.stringify(P, null, 2)}`;
    dump.style.display = 'block';
    console.log(dump.textContent);
  };
  bar.append(dumpBtn);

  gui.add(P, 'original').name("today's floor").onChange(draw);
  gui.add(P, 'square', 0.25, 4, 0.25).name('square (m)').onChange(draw);
  gui.add(P, 'contrast', 0, 1, 0.01).onChange(draw);
  gui.add(P, 'grout', 0, 0.12, 0.005).name('grout').onChange(draw);
  gui.add(P, 'aniso').name('anisotropic filter').onChange(draw);
  gui.addColor(P, 'light').onChange(draw);
  gui.addColor(P, 'dark').onChange(draw);
  gui.addColor(P, 'groutColour').name('grout colour').onChange(draw);

  select(variant);
}
