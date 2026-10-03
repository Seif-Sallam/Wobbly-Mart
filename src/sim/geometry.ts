import type { Box, Point, Rot } from './map';

export function distToBox(x: number, z: number, b: Box): number {
  const dx = Math.max(b[0] - x, 0, x - (b[0] + b[2]));
  const dz = Math.max(b[1] - z, 0, z - (b[1] + b[3]));
  return Math.hypot(dx, dz);
}

export const inBox = (x: number, z: number, b: Box, margin = 0): boolean =>
  x >= b[0] + margin && x <= b[0] + b[2] - margin && z >= b[1] + margin && z <= b[1] + b[3] - margin;

export const boxCentre = (b: Box): Point => [b[0] + b[2] / 2, b[1] + b[3] / 2];

export const boxesOverlap = (a: Box, b: Box): boolean =>
  a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** Unit vector of a rotation's front (0 = south). */
export function frontDir(rot: Rot): Point {
  const r = (rot * Math.PI) / 180;
  return [Math.round(Math.sin(r)), Math.round(Math.cos(r))];
}

/** A point `out` metres in front of the box, shifted `side` metres along its front edge. */
export function frontPoint(b: Box, rot: Rot, out: number, side = 0): Point {
  const [cx, cz] = boxCentre(b);
  const [fx, fz] = frontDir(rot);
  const half = fx ? b[2] / 2 : b[3] / 2;
  return [cx + fx * (half + out) - fz * side, cz + fz * (half + out) + fx * side];
}

/** Push a circle out of a box; returns true if it moved. */
export function pushOutOfBox(p: { x: number; z: number }, b: Box, r: number): boolean {
  const cx = Math.min(Math.max(p.x, b[0]), b[0] + b[2]);
  const cz = Math.min(Math.max(p.z, b[1]), b[1] + b[3]);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.z = cz + (dz / d) * r;
    return true;
  }
  const pushes = [p.x - b[0], b[0] + b[2] - p.x, p.z - b[1], b[1] + b[3] - p.z];
  const m = Math.min(...pushes);
  if (m === pushes[0]) p.x = b[0] - r;
  else if (m === pushes[1]) p.x = b[0] + b[2] + r;
  else if (m === pushes[2]) p.z = b[1] - r;
  else p.z = b[1] + b[3] + r;
  return true;
}
