// The Wardrobe's 3D side: a live preview that turns on its own or by drag, plus portraits and cap icons drawn per colour.
import * as THREE from 'three';
import { Character, capParts, lookCharacter } from './characters';
import { LOOKS } from '../../catalog/looks';
import { CAP_COLOURS, LIGHT, SHADES, type CapName } from '../palette';
import { FEEL } from '../feel';

const W = FEEL.wardrobe;
const PORTRAIT_SIZE = 128;
const PORTRAIT_TURN = 0.35;

function lit(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(SHADES.white, SHADES.thumbGround, 2.2));
  const sun = new THREE.DirectionalLight(LIGHT.sun, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
}

export class WardrobeView {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(W.fov, 1, 0.1, 100);
  private solo: Character | null = null;
  private raf = 0;
  private last = 0;
  private swayTime = 0;
  private turn = 0;
  private turnSpeed = 0;
  private dragX: number | null = null;
  private dragged = false;
  private shot: THREE.WebGLRenderer | null = null;
  private people = new Map<string, Character>();
  private portraits = new Map<string, Map<string, string>>();
  private capIcons = new Map<string, string>();

  constructor() {
    lit(this.scene);
  }

  /** Starts drawing the preview; mount the returned canvas. */
  start(look: string, cap: string): HTMLCanvasElement {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    const c = r.domElement;
    c.className = 'wardrobe-canvas';
    c.onpointerdown = (e) => {
      this.dragX = e.clientX;
      this.dragged = true;
      this.turnSpeed = 0;
      c.setPointerCapture(e.pointerId);
    };
    c.onpointermove = (e) => {
      if (this.dragX === null) return;
      const d = THREE.MathUtils.degToRad((e.clientX - this.dragX) * W.dragDeg);
      this.dragX = e.clientX;
      this.turn += d;
      this.turnSpeed = d * 60;
    };
    c.onpointerup = c.onpointercancel = () => (this.dragX = null);
    this.renderer = r;
    this.show(look, cap, false);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    return c;
  }

  stop = (): void => {
    cancelAnimationFrame(this.raf);
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this.shot?.dispose();
    this.shot?.forceContextLoss();
    this.shot = null;
    this.people.clear();
    this.portraits.clear();
    this.capIcons.clear();
  };

  /** Puts a look in the preview; a new pick makes it wave and stops the idle sway until the next one. */
  show(look: string, cap: string, wave: boolean): void {
    if (this.solo) this.scene.remove(this.solo.root);
    // dt 1 settles the clip weights, so it starts in its idle pose rather than the bind pose
    this.solo = lookCharacter(look, cap);
    this.solo.update(1, 0, 0, 0, 0, false);
    this.scene.add(this.solo.root);
    if (wave) this.solo.emote('yes');
    this.swayTime = 0;
    this.turn = this.turnSpeed = 0;
    this.dragged = false;
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const { renderer: r, solo } = this;
    if (!r || !solo) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.dragX === null) {
      this.turn += this.turnSpeed * dt;
      this.turnSpeed *= Math.exp(-W.coast * dt);
    }
    this.swayTime += dt;
    const sway = this.dragged ? 0 : Math.sin(this.swayTime * THREE.MathUtils.degToRad(W.sway)) * W.swing;
    solo.facing = this.turn + sway;
    solo.update(dt, 0, 0, 0, 0, false);
    const c = r.domElement;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * r.getPixelRatio())) r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.set(0, W.camHeight, W.camDist);
    this.camera.lookAt(0, W.lookY, 0);
    this.camera.updateProjectionMatrix();
    r.render(this.scene, this.camera);
  };

  private shooter(): { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera } {
    if (!this.shot) {
      this.shot = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.shot.setSize(PORTRAIT_SIZE, PORTRAIT_SIZE, false);
      this.shot.toneMapping = THREE.ACESFilmicToneMapping;
    }
    const scene = new THREE.Scene();
    lit(scene);
    return { r: this.shot, scene, cam: new THREE.PerspectiveCamera(W.fov, 1, 0.1, 50) };
  }

  /** Head-and-shoulders portrait of a look under a cap colour (all looks are drawn together the first time). */
  portrait(look: string, cap: string): string {
    let set = this.portraits.get(cap);
    if (!set) {
      const { r, scene, cam } = this.shooter();
      cam.position.set(0, 1, 2.4);
      cam.lookAt(0, 0.75, 0);
      set = new Map();
      for (const l of LOOKS) {
        let ch = this.people.get(l.id);
        if (!ch) {
          ch = lookCharacter(l.id, cap);
          ch.update(1, 0, 0, 0, 0, false);
          ch.root.rotation.y = PORTRAIT_TURN;
          this.people.set(l.id, ch);
        }
        ch.setHat(CAP_COLOURS[cap as CapName] ?? CAP_COLOURS.orange);
        scene.add(ch.root);
        r.render(scene, cam);
        set.set(l.id, r.domElement.toDataURL());
        scene.remove(ch.root);
      }
      this.portraits.set(cap, set);
    }
    return set.get(look) ?? '';
  }

  /** A cap of the given colour on its own. */
  capIcon(cap: string): string {
    let url = this.capIcons.get(cap);
    if (!url) {
      const { r, scene, cam } = this.shooter();
      cam.position.set(0.5, 0.55, 0.9);
      cam.lookAt(0, 0.02, 0.04);
      const hat = new THREE.Group();
      hat.add(...capParts(CAP_COLOURS[cap as CapName]));
      hat.rotation.y = -0.5;
      scene.add(hat);
      r.render(scene, cam);
      url = r.domElement.toDataURL();
      this.capIcons.set(cap, url);
    }
    return url;
  }
}
