// Renderer, lights and the isometric camera rig.
import * as THREE from 'three';
import { FEEL } from '../feel';
import { LIGHT } from '../palette';
import { paletteColor } from './materials';

const YAW = THREE.MathUtils.degToRad(FEEL.cameraYawDeg);
const PITCH = THREE.MathUtils.degToRad(FEEL.cameraPitchDeg);
const CAMERA_DISTANCE = 60;
const SHADOW_HALF = 20;
const PIXEL_RATIOS = [2, 1.5, 1];
const SLOW_FRAME = 1 / 45;

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
  viewSize = FEEL.viewSize;

  constructor(canvas: HTMLCanvasElement, phone: boolean) {
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
    const size = phone ? 1024 : 2048;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.radius = LIGHT.shadowRadius;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    Object.assign(this.sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 80 });
    this.scene.add(hemi, this.sun, this.sun.target);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = innerWidth;
    const h = innerHeight;
    const short = Math.min(w, h);
    const half = this.viewSize / 2;
    Object.assign(this.camera, { left: (-half * w) / short, right: (half * w) / short, top: (half * h) / short, bottom: (-half * h) / short });
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(PIXEL_RATIOS[this.ratioStep]);
    this.renderer.setSize(w, h, false);
  }

  /** Steps the pixel ratio down 2 → 1.5 → 1 when frames run slow for a while. */
  watchFrame(dt: number): void {
    if (dt > SLOW_FRAME) {
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
    this.nudgeNow.lerp(this.nudge, 1 - Math.exp(-6 * dt));
    const offset = new THREE.Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH));
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
    this.renderer.render(this.scene, this.camera);
  }

  /** Screen position (CSS px) of a world point. */
  toScreen(p: THREE.Vector3, out = new THREE.Vector2()): THREE.Vector2 {
    const v = p.clone().project(this.camera);
    return out.set(((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight);
  }
}
