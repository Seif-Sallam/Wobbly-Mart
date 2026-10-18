// Edit Layout: the picked fixture lifted as a gently bobbing ghost over a green (allowed) or red footprint plate.
import * as THREE from 'three';
import type { Box, Placement } from '../sim/map';
import { FEEL } from '../feel';
import { PALETTE, SHADES } from '../palette';
import { buildStation, ghostify } from './stations';

const plateMat = (color: string) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });

export class LayoutGhost {
  readonly group = new THREE.Group();
  private ghost: THREE.Object3D | null = null;
  private shown = '';
  private ok = plateMat(PALETTE.money);
  private bad = plateMat(SHADES.angry);
  private plates = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.ok);
    m.renderOrder = 3;
    m.visible = false;
    this.group.add(m);
    return m;
  });
  private outline = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), plateMat(PALETTE.pad));
    m.renderOrder = 3;
    m.visible = false;
    this.group.add(m);
    return m;
  });
  private t = 0;

  /** A Lesson's suggested spot: a yellow outline around `box`, until `hide`. `null` clears it. */
  suggest(box: Box | null): void {
    const [x, z, w, d] = box ?? [0, 0, 0, 0];
    const e = FEEL.layoutOutline;
    // top, bottom, left, right edges: [centre x, centre z, width, depth]
    const edges = [
      [x + w / 2, z - e / 2, w + 2 * e, e],
      [x + w / 2, z + d + e / 2, w + 2 * e, e],
      [x - e / 2, z + d / 2, e, d],
      [x + w + e / 2, z + d / 2, e, d],
    ];
    this.outline.forEach((m, i) => {
      m.visible = !!box;
      m.position.set(edges[i][0], 0.05, edges[i][1]);
      m.scale.set(edges[i][2], 1, edges[i][3]);
    });
  }

  /** Shows `model` at `spot` (and the Register's Cashier spot), green when `allowed`. */
  show(model: string | null, spot: Placement, allowed: boolean, cashier: Box | null): void {
    const key = `${model}|${spot.box.join()}|${spot.rot}`;
    if (key !== this.shown) {
      this.shown = key;
      if (this.ghost) this.group.remove(this.ghost);
      this.ghost = model ? buildStation(model, spot.box, spot.rot).root : null;
      if (this.ghost) {
        ghostify(this.ghost, FEEL.layoutGhostOpacity);
        this.group.add(this.ghost);
      }
    }
    [spot.box, cashier].forEach((b, i) => {
      const plate = this.plates[i];
      plate.visible = !!b;
      if (!b) return;
      plate.material = allowed ? this.ok : this.bad;
      plate.position.set(b[0] + b[2] / 2, 0.06, b[1] + b[3] / 2);
      plate.scale.set(b[2], 1, b[3]);
    });
  }

  hide(): void {
    if (this.ghost) this.group.remove(this.ghost);
    this.ghost = null;
    this.shown = '';
    for (const p of this.plates) p.visible = false;
    this.suggest(null);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.ghost) this.ghost.position.y = FEEL.layoutLift + Math.sin(this.t * FEEL.layoutBob) * 0.04;
  }
}
