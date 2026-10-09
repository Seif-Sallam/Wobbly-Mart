// Delivery cars: code-built and wonky, a new colour each time, with a face in the windshield.
import * as THREE from 'three';
import type { Box } from '../sim/map';
import { paletteMaterial } from './materials';
import { CanvasTex } from './text';
import { PALETTE, SHADES } from '../palette';
import { FEEL } from '../feel';

const WHEEL = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 14).rotateX(Math.PI / 2);

/** Faces the car's front (+x): it drives in eastward. */
export class Car {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private face = new CanvasTex(128, 96);
  private impatient: boolean | null = null;
  readonly length: number;

  constructor(spot: Box, look: number) {
    const [, , len, depth] = spot;
    this.length = len * 0.9;
    const colour = SHADES.cars[Math.floor(look * SHADES.cars.length)];
    const wonk = (look * 7.3) % 1;
    const tall = 1 + (wonk - 0.5) * 2 * FEEL.carHeightWonk;
    const mat = paletteMaterial(colour);
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, 0);
      mesh.castShadow = true;
      this.body.add(mesh);
      return mesh;
    };
    box(this.length, 0.55 * tall, depth * 0.85, mat, 0, 0.5);
    const cabin = box(this.length * 0.5, 0.55 * tall, depth * 0.75, mat, -this.length * 0.08, 0.5 + 0.55 * tall);
    cabin.rotation.z = (wonk - 0.5) * 2 * FEEL.carWonk;
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(depth * 0.65, 0.45 * tall),
      new THREE.MeshBasicMaterial({ map: this.face.texture, toneMapped: false }),
    );
    glass.rotation.y = Math.PI / 2;
    glass.position.set(this.length * 0.25 + 0.01, 0, 0);
    cabin.add(glass);
    for (const z of [-1, 1])
      box(0.06, 0.14, 0.22, paletteMaterial('cream'), this.length / 2, 0.55).position.z = z * depth * 0.28;
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const wheel = new THREE.Mesh(WHEEL, paletteMaterial('ink'));
        wheel.position.set(x * this.length * 0.32, 0.28, z * depth * 0.42);
        this.body.add(wheel);
      }
    this.root.add(this.body);
    this.setFace(false);
  }

  setFace(impatient: boolean): void {
    if (impatient === this.impatient) return;
    this.impatient = impatient;
    this.face.draw((g, w, h) => {
      g.fillStyle = SHADES.glass;
      g.fillRect(0, 0, w, h);
      g.fillStyle = g.strokeStyle = PALETTE.ink;
      g.lineWidth = 7;
      g.lineCap = 'round';
      for (const x of [w * 0.32, w * 0.68]) {
        g.beginPath();
        if (impatient) {
          g.moveTo(x - 12, h * 0.3 + (x < w / 2 ? -4 : 4));
          g.lineTo(x + 12, h * 0.3 + (x < w / 2 ? 4 : -4));
          g.stroke();
          g.beginPath();
        }
        g.arc(x, h * 0.42, 7, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      if (impatient) g.arc(w / 2, h * 0.85, 16, Math.PI * 1.15, Math.PI * 1.85);
      else g.arc(w / 2, h * 0.6, 18, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    });
  }

  dispose(): void {
    this.face.texture.dispose();
  }
}
