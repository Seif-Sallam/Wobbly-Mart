// Event visitors: Robbery's Thief (beanie, stripes, laughing bubble, tumble) and the Health Inspector (bowler hat,
// glasses, clipboard, the dashed escort circle, the alone clock, ✓/✗ marks and the BAD REVIEW stamp).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Inspector, Thief } from '../sim/world';
import { TUNING } from '../sim/tuning';
import { Character } from './characters';
import { paletteMaterial } from './materials';
import { CanvasTex, canvasSprite, outlinedText, roundRect } from './text';
import { Tweens, ease } from '../tween';
import { PALETTE, SHADES } from '../palette';
import { FEEL } from '../feel';

const DASHES = 28;

function bubble(w: number, h: number, height: number): { tex: CanvasTex; sprite: THREE.Sprite } {
  const tex = new CanvasTex(w, h);
  const sprite = canvasSprite(tex, height);
  sprite.center.set(0.5, 0);
  sprite.visible = false;
  return { tex, sprite };
}

function card(g: CanvasRenderingContext2D, w: number, h: number, edge: string): void {
  g.fillStyle = PALETTE.cream;
  g.strokeStyle = edge;
  g.lineWidth = 8;
  roundRect(g, 8, 8, w - 16, h - 16, 30);
  g.fill();
  g.stroke();
}

function stripes(): THREE.Texture {
  const tex = new CanvasTex(16, 64);
  tex.draw((g, w, h) => {
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? SHADES.thief.stripe : SHADES.thief.shirt;
      g.fillRect(0, (i * h) / 6, w, h / 6);
    }
  });
  return tex.texture;
}

export class ThiefLook {
  readonly ch: Character;
  private laugh = bubble(320, 160, 0.8);
  private tumbling = false;

  constructor(
    model: string,
    private readonly root: THREE.Object3D,
    private readonly tweens: Tweens,
  ) {
    this.ch = new Character(model);
    const t = this.ch.top;
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      paletteMaterial(SHADES.thief.beanie),
    );
    beanie.position.y = t - 0.14;
    beanie.scale.y = 0.75;
    const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), paletteMaterial(SHADES.thief.stripe));
    pompom.position.y = t + 0.08;
    this.ch.wear([beanie, pompom], true);
    const shirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.2, 0.3, 14, 1, true),
      new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.9 }),
    );
    shirt.position.y = 0.38;
    this.ch.wear([shirt], false);
    this.laugh.tex.draw((g, w, h) => {
      card(g, w, h, SHADES.angry);
      // grinning evil face: slanted brows, wide grin
      g.strokeStyle = g.fillStyle = PALETTE.ink;
      g.lineWidth = 7;
      g.lineCap = 'round';
      for (const [x, d] of [
        [52, 1],
        [96, -1],
      ]) {
        g.beginPath();
        g.moveTo(x - 16, 48 - 8 * d);
        g.lineTo(x + 16, 48 + 8 * d);
        g.stroke();
        g.beginPath();
        g.arc(x, 66, 6, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.arc(74, 86, 28, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
      outlinedText(g, 'HA HA HA', 220, h / 2, 44, SHADES.angry, PALETTE.cream);
    });
    root.add(this.ch.root, this.laugh.sprite);
  }

  update(dt: number, th: Thief, x: number, z: number): void {
    this.ch.update(dt, x, z, th.vx, th.vz, th.carry.length > 0 || th.cash > 0);
    this.laugh.sprite.visible = !th.caught && (th.state === 'grab' || th.state === 'run');
    this.laugh.sprite.position.set(x, FEEL.visitorBubbleY, z);
    this.laugh.sprite.scale.y = 0.8 * (1 + Math.abs(Math.sin(performance.now() / 120)) * 0.08);
  }

  /** Comic tumble: over on its back, a beat, and up again with a "no!". */
  tumble(): void {
    if (this.tumbling) return;
    this.tumbling = true;
    this.ch.emote('no');
    this.tweens.add(FEEL.tumbleTime, (k) => (this.ch.visual.rotation.x = -Math.sin(k * Math.PI) * 1.4), {
      ease: ease.linear,
      done: () => (this.tumbling = false),
    });
  }

  dispose(): void {
    this.root.remove(this.ch.root, this.laugh.sprite);
    this.laugh.tex.texture.dispose();
  }
}

export class InspectorLook {
  readonly ch: Character;
  private circle: THREE.Mesh;
  private clock = bubble(160, 160, 0.6);
  private mark = bubble(160, 160, 0.6);
  private stamp = bubble(512, 192, 1.1);
  private markKey: boolean | null = null;
  private clockShown = -1;
  private stamped = false;

  constructor(
    model: string,
    private readonly root: THREE.Object3D,
    private readonly tweens: Tweens,
  ) {
    this.ch = new Character(model, { tint: SHADES.inspector.suit });
    const t = this.ch.top;
    const hat = paletteMaterial(SHADES.inspector.hat);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hat);
    dome.position.y = t - 0.03;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 18), hat);
    brim.position.y = t - 0.03;
    const glasses = [-1, 1].map((side) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.065, 0.014, 6, 16),
        paletteMaterial(SHADES.inspector.glasses),
      );
      ring.position.set(side * 0.1, t - 0.3, 0.29);
      return ring;
    });
    this.ch.wear([dome, brim, ...glasses], true);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.02), paletteMaterial(SHADES.inspector.board));
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.022), paletteMaterial(SHADES.inspector.paper));
    paper.position.y = -0.02;
    board.add(paper);
    board.position.set(0.12, 0.42, 0.24);
    board.rotation.x = -0.6;
    this.ch.wear([board], false);
    const r = TUNING.events.inspector.escort;
    const dashes = Array.from(
      { length: DASHES },
      (_, i) => new THREE.RingGeometry(r - 0.12, r, 4, 1, (i / DASHES) * Math.PI * 2, (Math.PI / DASHES) * 1.1),
    );
    const geo = mergeGeometries(dashes);
    this.circle = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.circle.rotation.x = -Math.PI / 2;
    this.circle.renderOrder = 2;
    root.add(this.ch.root, this.circle, this.clock.sprite, this.mark.sprite, this.stamp.sprite);
  }

  update(dt: number, ins: Inspector, x: number, z: number, far: boolean): void {
    const inside = ins.state === 'visit';
    this.ch.root.visible = ins.state !== 'warn';
    this.ch.update(dt, x, z, ins.vx, ins.vz, false);
    // foot tap while left alone
    this.ch.visual.rotation.z = inside && far ? Math.sin(performance.now() / 90) * 0.06 : 0;
    this.circle.visible = inside;
    this.circle.position.set(x, 0.06, z);
    (this.circle.material as THREE.MeshBasicMaterial).color.set(far ? SHADES.angry : PALETTE.cream);
    this.drawClock(inside ? ins.alone / TUNING.events.inspector.alone : 0);
    this.clock.sprite.position.set(x, FEEL.visitorBubbleY + 0.15, z);
    this.drawMark(inside ? ins.clean : null);
    this.mark.sprite.position.set(x + 0.55, FEEL.visitorBubbleY - 0.2, z);
    this.stamp.sprite.position.set(x, FEEL.visitorBubbleY + 0.4, z);
  }

  private drawClock(k: number): void {
    const step = Math.round(k * 40) / 40;
    this.clock.sprite.visible = step > 0;
    if (step === this.clockShown) return;
    this.clockShown = step;
    this.clock.tex.draw((g, w, h) => {
      g.fillStyle = PALETTE.cream;
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 8;
      g.beginPath();
      g.arc(w / 2, h / 2, 60, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = SHADES.angry;
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.arc(w / 2, h / 2, 50, -Math.PI / 2, -Math.PI / 2 + step * Math.PI * 2);
      g.fill();
    });
  }

  private drawMark(clean: boolean | null): void {
    this.mark.sprite.visible = clean !== null;
    if (clean === this.markKey || clean === null) return;
    this.markKey = clean;
    this.mark.tex.draw((g, w, h) => {
      card(g, w, h, clean ? PALETTE.money : SHADES.angry);
      outlinedText(g, clean ? '✓' : '✗', w / 2, h / 2 + 4, 90, clean ? PALETTE.money : SHADES.angry, PALETTE.cream);
    });
  }

  /** The red BAD REVIEW stamp slams down over them. */
  badReview(): void {
    if (this.stamped) return;
    this.stamped = true;
    this.stamp.tex.draw((g, w, h) => {
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(-0.12);
      g.strokeStyle = SHADES.angry;
      g.lineWidth = 12;
      roundRect(g, -220, -64, 440, 128, 18);
      g.stroke();
      outlinedText(g, 'BAD REVIEW', 0, 4, 76, SHADES.angry, PALETTE.cream);
      g.restore();
    });
    const s = this.stamp.sprite;
    s.visible = true;
    const base = s.scale.clone();
    this.tweens.add(FEEL.stampTime, (k) => s.scale.copy(base).multiplyScalar(2.2 - 1.2 * k), {
      ease: (t) => ease.outBack(t, FEEL.springOvershoot),
    });
  }

  dispose(): void {
    this.root.remove(this.ch.root, this.circle, this.clock.sprite, this.mark.sprite, this.stamp.sprite);
    for (const b of [this.clock, this.mark, this.stamp]) b.tex.texture.dispose();
    this.circle.geometry.dispose();
  }
}
