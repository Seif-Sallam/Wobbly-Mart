// The Cashier's "Bag" pose: arms forward, torso turning between belt and bagging tray while the Register works.
import * as THREE from 'three';
import { FEEL } from '../feel';

export class CashierBag {
  serving = false;
  private blend = 0;
  private phase = 0;

  /** Layer the pose on the bones after the clips have run. */
  apply = (visual: THREE.Group, dt: number): void => {
    this.blend += ((this.serving ? 1 : 0) - this.blend) * Math.min(1, dt / FEEL.bagEase);
    if (this.serving) this.phase += dt * FEEL.bag.rate * Math.PI * 2;
    if (this.blend < 0.001) return;
    const bone = (name: string) => visual.getObjectByName(name);
    for (const arm of ['arm-left', 'arm-right']) {
      const b = bone(arm);
      if (b) b.rotation.x -= FEEL.bag.lift * this.blend;
    }
    const torso = bone('torso');
    if (torso) torso.rotation.y += Math.sin(this.phase * 0.5) * FEEL.bag.turn * this.blend;
  };
}
