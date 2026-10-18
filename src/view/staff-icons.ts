// One rendered icon per Staff kind (`staff-cashier`, `staff-stocker`, `staff-cleaner`): the employee in the kind's cap
// with what it handles. Drawn once at load.
import * as THREE from 'three';
import { Character } from './characters';
import { mopModel } from './cleaning';
import { paletteMaterial } from './materials';
import { renderObjectThumbs } from './thumbs';
import { PALETTE, SHADES } from '../palette';

const box = (w: number, h: number, d: number, colour: string, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paletteMaterial(colour));
  m.position.set(x, y, z);
  return m;
};

const KINDS: Record<string, { cap: string; holding: boolean; tool: () => THREE.Object3D[] }> = {
  cashier: {
    cap: SHADES.white,
    holding: true,
    tool: () => [
      box(0.34, 0.06, 0.18, PALETTE.money, 0.05, 0.62, 0.32),
      box(0.34, 0.06, 0.18, PALETTE.money, 0, 0.69, 0.3),
    ],
  },
  stocker: {
    cap: SHADES.roleCaps.auto,
    holding: true,
    tool: () => [0, 1, 2].map((i) => box(0.36, 0.22, 0.3, PALETTE.wood, 0, 0.55 + i * 0.24, 0.32)),
  },
  cleaner: {
    cap: SHADES.cleanerCap,
    holding: false,
    tool: () => {
      const mop = mopModel();
      mop.position.set(0.38, 0, 0.2);
      mop.rotation.set(0.2, 0, -0.2);
      return [mop];
    },
  },
};

export function renderStaffIcons(): void {
  renderObjectThumbs(
    Object.entries(KINDS).map(([kind, k]): [string, THREE.Object3D] => {
      const ch = new Character('employee', { hat: k.cap });
      // dt 1 settles the clip weights so the thumbnail shows the pose
      ch.update(1, 0, 0, 0, 0, k.holding);
      ch.root.add(...k.tool());
      return [`staff-${kind}`, ch.root];
    }),
  );
}
