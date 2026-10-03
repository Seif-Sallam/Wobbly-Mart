// Juice: floating +$ numbers, dust/steam/feather puffs and the coin flip. Timings live in feel.ts.
import * as THREE from 'three';
import { CanvasTex, canvasSprite, outlinedText } from './text';
import { PALETTE, SHADES } from '../palette';
import { FEEL } from '../feel';
import { ease } from '../tween';
import { model } from './assets';

interface Float {
  sprite: THREE.Sprite;
  tex: CanvasTex;
  source: string;
  amount: number;
  age: number;
  base: THREE.Vector3;
}

interface Puff {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  life: number;
  grow: number;
}

interface Coin {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  age: number;
}

const puffGeometry = new THREE.SphereGeometry(0.18, 8, 6);

export class Juice {
  readonly group = new THREE.Group();
  private floats: Float[] = [];
  private puffs: Puff[] = [];
  private coins: Coin[] = [];

  /** `+$X` above a point; a repeat from the same source within ~0.3 s adds up and re-bounces. */
  money(source: string, amount: number, at: THREE.Vector3): void {
    const recent = this.floats.find((f) => f.source === source && f.age < FEEL.floatMerge);
    if (recent) {
      recent.amount += amount;
      recent.age = 0;
      recent.base.copy(at);
      this.drawFloat(recent);
      return;
    }
    const tex = new CanvasTex(256, 96);
    const f: Float = { sprite: canvasSprite(tex, 0.75), tex, source, amount, age: 0, base: at.clone() };
    this.drawFloat(f);
    this.group.add(f.sprite);
    this.floats.push(f);
  }

  private drawFloat(f: Float): void {
    f.tex.draw((g, w, h) =>
      outlinedText(g, `+$${Math.round(f.amount)}`, w / 2, h / 2, 64, PALETTE.money, SHADES.white),
    );
  }

  puff(at: THREE.Vector3, color: string, count = 6, spread = 1): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        puffGeometry,
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.8, roughness: 1 }),
      );
      mesh.position.copy(at);
      const a = Math.random() * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(a) * spread, 0.6 + Math.random() * 0.8, Math.sin(a) * spread);
      this.group.add(mesh);
      this.puffs.push({ mesh, vel, age: 0, life: 0.5 + Math.random() * 0.3, grow: 1.5 + Math.random() });
    }
  }

  /** The gold coin flips and spins up — never shows an amount. */
  coin(at: THREE.Vector3): void {
    const obj = model('coin');
    obj.position.copy(at);
    this.group.add(obj);
    this.coins.push({ obj, from: at.clone(), age: 0 });
  }

  update(dt: number): void {
    this.floats = this.floats.filter((f) => {
      f.age += dt;
      const k = f.age / FEEL.floatLife;
      const pop = f.age < 0.15 ? ease.outBack(f.age / 0.15, 3) : 1;
      f.sprite.position.copy(f.base).add(new THREE.Vector3(0, ease.outCubic(Math.min(1, k)) * FEEL.floatRise, 0));
      f.sprite.scale.set(2 * pop, 0.75 * pop, 1);
      f.sprite.material.rotation = Math.sin(f.age * 18) * 0.06;
      f.sprite.material.opacity = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4);
      if (k < 1) return true;
      this.group.remove(f.sprite);
      f.tex.texture.dispose();
      f.sprite.material.dispose();
      return false;
    });
    this.puffs = this.puffs.filter((p) => {
      p.age += dt;
      const k = p.age / p.life;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(1 + k * p.grow);
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.8 * (1 - k);
      if (k < 1) return true;
      this.group.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
      return false;
    });
    this.coins = this.coins.filter((c) => {
      c.age += dt;
      const k = c.age / 0.7;
      c.obj.position.copy(c.from).add(new THREE.Vector3(0, Math.sin(Math.min(1, k) * Math.PI) * 1.2 + k * 0.4, 0));
      c.obj.rotation.set(c.age * 14, c.age * 9, 0);
      c.obj.scale.setScalar(k > 0.8 ? Math.max(0, (1 - k) * 5) : 1);
      if (k < 1) return true;
      this.group.remove(c.obj);
      return false;
    });
  }
}
