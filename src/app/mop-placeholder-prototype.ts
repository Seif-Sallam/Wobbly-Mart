// PROTOTYPE (throwaway, branch prototype/relayout-2m): a labelled placeholder on the reserved Mop Stand spot.
// The real Mop Stand is designed in the cleaning-fixtures prototype ticket.
import * as THREE from 'three';
import type { Game } from './game';
import { PALETTE, SHADES } from '../palette';
import { CanvasTex, canvasSprite, outlinedText } from '../view/text';

export function addMopPlaceholder(game: Game): void {
  const place = game.world.map.layout.places.mop_stand;
  if (!place) return;
  const [x, z, w, d] = place.box;
  const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c });
  const g = new THREE.Group();
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.45, 16), mat('#3d7fd6'));
  bucket.position.y = 0.225;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), mat(PALETTE.wood));
  stick.position.set(0.05, 0.95, 0);
  stick.rotation.z = 0.18;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.25, 10), mat(SHADES.white));
  head.position.set(-0.03, 0.42, 0);
  for (const m of [bucket, stick, head]) m.castShadow = true;
  const tex = new CanvasTex(512, 128);
  tex.draw((c, cw, ch) => outlinedText(c, 'MOP STAND (placeholder)', cw / 2, ch / 2, 44, PALETTE.cream));
  const label = canvasSprite(tex, 0.45);
  label.position.y = 2.1;
  g.add(bucket, stick, head, label);
  g.position.set(x + w / 2, 0, z + d / 2);
  game.stage.scene.add(g);
}
