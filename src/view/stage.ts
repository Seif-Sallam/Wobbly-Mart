// Renderer, lights and the isometric camera rig.
import * as THREE from 'three';
import { FEEL } from '../feel';
import { LIGHT } from '../palette';
import { paletteColor } from './materials';

const YAW = THREE.MathUtils.degToRad(FEEL.cameraYawDeg);
const CAMERA_DISTANCE = 60;
/** The sun's shadow box covers the screen's floor (and up to this height) plus a margin, so casters just off screen
 * still cast. */
const SHADOW_TOP = 3;
const SHADOW_MARGIN = 3;
const PIXEL_RATIOS = [1.5, 1];
const SHADOW_SIZE = 1024;
/** A frame this many times longer than the frame cap's interval counts as slow (1/45 s at 60 fps). */
const SLOW_FRAME = 4 / 3;

/** Screen-right and screen-up directions projected onto the floor. */
export const SCREEN_RIGHT = new THREE.Vector2(Math.cos(YAW), -Math.sin(YAW));
export const SCREEN_UP = new THREE.Vector2(-Math.sin(YAW), -Math.cos(YAW));

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  readonly sun = new THREE.DirectionalLight();
  /** Point on the floor the camera looks at. */
  readonly focus = new THREE.Vector3();
  /** Screen-space shift of the focus in view fractions (e.g. to keep the Player clear of a panel). */
  readonly nudge = new THREE.Vector2();
  private nudgeNow = new THREE.Vector2();
  private ratioStep = 0;
  private slowTime = 0;
  private fastTime = 0;
  /** Metres across the screen's short side; `zoomTo` eases it. */
  viewSize = FEEL.zoomDesktop;
  private zoomWant: number | null = null;
  private saver = false;
  /** Layout editor: look straight down with north up. */
  topDown = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LIGHT.exposure;
    this.ratioStep = PIXEL_RATIOS.findIndex((r) => r <= Math.min(devicePixelRatio, 2));
    this.scene.background = paletteColor('sky');
    const hemi = new THREE.HemisphereLight(paletteColor('sky'), paletteColor('grass'), LIGHT.hemiIntensity);
    this.sun.color.set(LIGHT.sun);
    this.sun.intensity = LIGHT.sunIntensity;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
    this.sun.shadow.radius = LIGHT.shadowRadius;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    Object.assign(this.sun.shadow.camera, { near: 1, far: 80 });
    this.scene.add(hemi, this.sun, this.sun.target);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = innerWidth;
    const h = innerHeight;
    const short = Math.min(w, h);
    const half = this.viewSize / 2;
    Object.assign(this.camera, {
      left: (-half * w) / short,
      right: (half * w) / short,
      top: (half * h) / short,
      bottom: (-half * h) / short,
    });
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.saver ? 1 : PIXEL_RATIOS[this.ratioStep]);
    this.renderer.setSize(w, h, false);
  }

  /** Battery saver: pixel ratio 1 and hard shadows. */
  batterySaver(on: boolean): void {
    if (on === this.saver) return;
    this.saver = on;
    this.renderer.shadowMap.type = on ? THREE.BasicShadowMap : THREE.PCFShadowMap;
    this.resize();
  }

  /** Eases the view toward this zoom (metres across the short side). */
  zoomTo(metres: number): void {
    this.zoomWant = metres;
  }

  /** The view is still easing toward a zoom. */
  get zooming(): boolean {
    return this.zoomWant !== null;
  }

  /** Steps the pixel ratio down 1.5 → 1 when frames run slow for a while. */
  watchFrame(dt: number, fps: number): void {
    if (dt > SLOW_FRAME / fps) {
      this.slowTime += dt;
      this.fastTime = 0;
    } else {
      this.fastTime += dt;
      if (this.fastTime > 1) this.slowTime = 0;
    }
    if (this.slowTime > 2 && this.ratioStep < PIXEL_RATIOS.length - 1) {
      this.ratioStep++;
      this.slowTime = 0;
      this.resize();
    }
  }

  render(dt: number): void {
    if (this.zoomWant !== null) {
      const v = this.viewSize + (this.zoomWant - this.viewSize) * (1 - Math.exp(-FEEL.zoomEase * dt));
      this.viewSize = Math.abs(v - this.zoomWant) < 0.01 ? this.zoomWant : v;
      if (this.viewSize === this.zoomWant) this.zoomWant = null;
      this.resize();
    }
    this.nudgeNow.lerp(this.nudge, 1 - Math.exp(-6 * dt));
    const PITCH = THREE.MathUtils.degToRad(FEEL.cameraPitchDeg);
    const offset = this.topDown
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH));
    this.camera.up.set(0, this.topDown ? 0 : 1, this.topDown ? -1 : 0);
    const w = this.camera.right - this.camera.left;
    const h = this.camera.top - this.camera.bottom;
    // Shift the look-at point so the focus lands nudged on screen; screen-up on the floor is longer by 1/sin(pitch).
    const shift = new THREE.Vector3(
      -SCREEN_RIGHT.x * this.nudgeNow.x * w - (SCREEN_UP.x * this.nudgeNow.y * h) / Math.sin(PITCH),
      0,
      -SCREEN_RIGHT.y * this.nudgeNow.x * w - (SCREEN_UP.y * this.nudgeNow.y * h) / Math.sin(PITCH),
    );
    const look = this.focus.clone().add(shift);
    this.camera.position.copy(look).addScaledVector(offset, CAMERA_DISTANCE);
    this.camera.lookAt(look);
    this.sun.position.copy(look).add(new THREE.Vector3(10, 22, 14));
    this.sun.target.position.copy(look);
    this.fitShadow();
    this.renderer.render(this.scene, this.camera);
  }

  private fitShadow(): void {
    const cam = this.sun.shadow.camera;
    cam.position.copy(this.sun.position);
    cam.lookAt(this.sun.target.position);
    cam.updateMatrixWorld();
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const ahead = this.camera.getWorldDirection(new THREE.Vector3());
    const box = new THREE.Box3();
    const p = new THREE.Vector3();
    for (const x of [this.camera.left, this.camera.right])
      for (const y of [this.camera.bottom, this.camera.top])
        for (const h of [0, SHADOW_TOP]) {
          p.copy(this.camera.position).addScaledVector(right, x).addScaledVector(up, y);
          p.addScaledVector(ahead, (h - p.y) / ahead.y);
          box.expandByPoint(p.applyMatrix4(cam.matrixWorldInverse));
        }
    Object.assign(cam, {
      left: box.min.x - SHADOW_MARGIN,
      right: box.max.x + SHADOW_MARGIN,
      bottom: box.min.y - SHADOW_MARGIN,
      top: box.max.y + SHADOW_MARGIN,
    });
    cam.updateProjectionMatrix();
  }

  /** Floor point (x, z) under a screen position (CSS px). */
  floorAt(cx: number, cy: number): [number, number] | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), this.camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    return hit ? [hit.x, hit.z] : null;
  }

  /** Screen position (CSS px) of a world point. */
  toScreen(p: THREE.Vector3, out = new THREE.Vector2()): THREE.Vector2 {
    const v = p.clone().project(this.camera);
    return out.set(((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight);
  }
}
