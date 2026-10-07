// Animated Mini Characters: turn toward their motion, bob while walking, hold arms out when carrying.
import * as THREE from 'three';
import { clipsOf, model } from './assets';
import { FEEL } from '../feel';
import { paletteMaterial } from './materials';

type Clip = 'idle' | 'walk' | 'holding-both' | 'emote-yes' | 'emote-no';

export class Character {
  readonly root = new THREE.Group();
  readonly visual: THREE.Group;
  facing = 0;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<Clip, THREE.AnimationAction>();
  private bob = 0;
  private hop = 0;
  private cap: THREE.Mesh[] = [];

  hatColour: string;

  setHat(colour: string): void {
    if (colour === this.hatColour) return;
    this.hatColour = colour;
    for (const m of this.cap) m.material = paletteMaterial(colour);
  }

  constructor(name: string, opts: { tint?: string; hat?: string } = {}) {
    this.visual = model(name, { tint: opts.tint });
    this.visual.traverse((o) => (o.castShadow = false));
    this.root.add(this.visual);
    if (opts.hat) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12), paletteMaterial(opts.hat));
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), paletteMaterial(opts.hat));
      const h = new THREE.Box3().setFromObject(this.visual).max.y;
      cap.position.y = h + 0.05;
      brim.position.set(0, h, 0.17);
      this.visual.add(cap, brim);
      this.cap = [cap, brim];
      // Ride the animated head bone, or the head bobs through the cap.
      const head = this.visual.getObjectByName('head');
      if (head) {
        this.visual.updateMatrixWorld(true);
        head.attach(cap);
        head.attach(brim);
      }
    }
    this.mixer = new THREE.AnimationMixer(this.visual);
    this.hatColour = opts.hat ?? '';
    for (const clip of clipsOf(name)) {
      if (['idle', 'walk', 'holding-both', 'emote-yes', 'emote-no'].includes(clip.name)) {
        const a = this.mixer.clipAction(clip);
        a.play();
        a.setEffectiveWeight(0);
        this.actions.set(clip.name as Clip, a);
      }
    }
  }

  private weight(clip: Clip, target: number, k: number): void {
    const a = this.actions.get(clip);
    if (a) a.setEffectiveWeight(a.getEffectiveWeight() + (target - a.getEffectiveWeight()) * k);
  }

  /** Happy hop (`yes`) or angry stomp (`no`). */
  emote(kind: 'yes' | 'no'): void {
    this.hop = 1;
    const a = this.actions.get(kind === 'yes' ? 'emote-yes' : 'emote-no');
    a?.reset().setEffectiveWeight(1).play();
  }

  update(dt: number, x: number, z: number, vx: number, vz: number, carrying: boolean): void {
    this.root.position.set(x, 0, z);
    const speed = Math.hypot(vx, vz);
    if (speed > 0.1) {
      const target = Math.atan2(vx, vz);
      const diff = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
      this.facing += THREE.MathUtils.clamp(diff, -FEEL.turnSpeed * dt, FEEL.turnSpeed * dt);
    }
    this.root.rotation.y = this.facing;
    this.bob += dt * speed * 3;
    this.hop = Math.max(0, this.hop - dt * 1.5);
    this.visual.position.y =
      (speed > 0.1 ? Math.abs(Math.sin(this.bob)) * FEEL.walkBob : 0) +
      Math.abs(Math.sin(this.hop * Math.PI * 3)) * this.hop * 0.35;
    const k = Math.min(1, dt * 10);
    const walking = speed > 0.3;
    this.weight('walk', walking ? 1 : 0, k);
    this.weight('idle', walking ? 0 : 1, k);
    this.weight('holding-both', carrying ? 1 : 0, k);
    this.weight('emote-yes', 0, dt);
    this.weight('emote-no', 0, dt);
    this.actions.get('walk')?.setEffectiveTimeScale(Math.max(0.6, speed / 3));
    this.mixer.update(dt);
  }
}
