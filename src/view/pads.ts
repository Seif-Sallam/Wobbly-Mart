// Pads: a flat rounded square with the unlock's icon and its price; a radial fill and a ghost while stood on.
import * as THREE from 'three';
import { CanvasTex, outlinedText } from './text';
import { formatMoney } from '../format';
import { paletteMaterial } from './materials';
import { PALETTE, withAlpha } from '../palette';
import { FEEL } from '../feel';
import { icon } from './thumbs';

const HALF = 0.85;
const YAW = THREE.MathUtils.degToRad(FEEL.cameraYawDeg);

function roundedSquare(h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r);
  s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r);
  s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

const padGeometry = new THREE.ExtrudeGeometry(roundedSquare(HALF, 0.25), { depth: 0.06, bevelEnabled: false });
const labelGeometry = new THREE.PlaneGeometry(HALF * 2, HALF * 2);

export class PadVisual {
  readonly group = new THREE.Group();
  private label = new CanvasTex(256, 256);
  private shown = -1;
  private shownFill = -1;
  private pop = 0;

  constructor(
    x: number,
    z: number,
    private readonly iconName: string,
    readonly ghost: THREE.Object3D | null,
  ) {
    this.group.position.set(x, 0, z);
    const base = new THREE.Mesh(padGeometry, paletteMaterial('pad'));
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    const mat = new THREE.MeshBasicMaterial({ map: this.label.texture, transparent: true, toneMapped: false });
    const label = new THREE.Mesh(labelGeometry, mat);
    label.rotation.set(-Math.PI / 2, 0, YAW);
    label.position.y = 0.07;
    this.group.add(base, label);
    if (ghost) {
      ghost.visible = false;
      this.group.add(ghost);
    }
  }

  update(dt: number, remaining: number, cost: number, standing: boolean): void {
    this.pop = Math.min(1, this.pop + dt * 3);
    const s = this.pop < 1 ? 1 + Math.sin(this.pop * Math.PI) * 0.25 : 1;
    this.group.scale.setScalar(s * Math.min(1, this.pop * 4));
    if (this.ghost) {
      this.ghost.visible = standing;
      if (standing) this.ghost.position.y = 0.05 + Math.sin(performance.now() / 150) * 0.05;
    }
    const price = Math.ceil(remaining);
    const fill = Math.round((1 - remaining / cost) * 40) / 40;
    if (price === this.shown && fill === this.shownFill) return;
    this.shown = price;
    this.shownFill = fill;
    this.label.draw((g, w, h) => {
      if (fill > 0) {
        g.fillStyle = withAlpha(PALETTE.orange, 0.35);
        g.beginPath();
        g.moveTo(w / 2, h / 2);
        g.arc(w / 2, h / 2, w * 0.48, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
        g.closePath();
        g.fill();
      }
      const img = icon(this.iconName);
      if (img) g.drawImage(img, w * 0.24, h * 0.04, w * 0.52, h * 0.52);
      outlinedText(g, formatMoney(price), w / 2, h * 0.74, 58, PALETTE.cream);
    });
  }
}
