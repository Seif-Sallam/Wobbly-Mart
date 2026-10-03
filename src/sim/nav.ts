// Walk grids and distance fields (Dijkstra, 8-neighbour, no corner cutting). Agents walk downhill to a field's seed.
import type { Point } from './map';

export interface Grid {
  cell: number;
  w: number;
  h: number;
  free: Uint8Array;
}

export function makeGrid(width: number, height: number, cell: number, isFree: (x: number, z: number) => boolean): Grid {
  const w = Math.ceil(width / cell);
  const h = Math.ceil(height / cell);
  const grid: Grid = { cell, w, h, free: new Uint8Array(w * h) };
  for (let i = 0; i < grid.free.length; i++) grid.free[i] = isFree(...cellCentre(grid, i)) ? 1 : 0;
  return grid;
}

export const cellCentre = (g: Grid, i: number): Point => [
  ((i % g.w) + 0.5) * g.cell,
  (Math.floor(i / g.w) + 0.5) * g.cell,
];

export function cellOf(g: Grid, x: number, z: number): number {
  const gx = Math.floor(x / g.cell);
  const gz = Math.floor(z / g.cell);
  return gx < 0 || gz < 0 || gx >= g.w || gz >= g.h ? -1 : gz * g.w + gx;
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Distance (m) from every free cell to the nearest seed cell. */
export function makeField(g: Grid, seeds: number[]): Float32Array {
  const d = new Float32Array(g.w * g.h).fill(Infinity);
  const heap = new MinHeap();
  for (const s of seeds) {
    if (s < 0 || !g.free[s]) continue;
    d[s] = 0;
    heap.push(0, s);
  }
  while (heap.size) {
    const c = heap.pop();
    const v = d[c];
    const gx = c % g.w;
    const gz = (c - gx) / g.w;
    for (const [ox, oz] of STEPS) {
      const nx = gx + ox;
      const nz = gz + oz;
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const ni = nz * g.w + nx;
      if (!g.free[ni]) continue;
      if (ox && oz && (!g.free[gz * g.w + nx] || !g.free[nz * g.w + gx])) continue;
      const nv = v + (ox && oz ? Math.SQRT2 : 1) * g.cell;
      if (nv < d[ni]) {
        d[ni] = nv;
        heap.push(nv, ni);
      }
    }
  }
  return d;
}

/** Seed cells: free cells matching `test`, or else the free cell nearest to `fallback`. */
export function seedCells(g: Grid, test: (x: number, z: number) => boolean, fallback?: Point): number[] {
  const out: number[] = [];
  for (let i = 0; i < g.free.length; i++) if (g.free[i] && test(...cellCentre(g, i))) out.push(i);
  if (!out.length && fallback) {
    const n = nearestFreeCell(g, fallback[0], fallback[1]);
    if (n >= 0) out.push(n);
  }
  return out;
}

export function nearestFreeCell(g: Grid, x: number, z: number): number {
  const c = cellOf(g, x, z);
  if (c >= 0 && g.free[c]) return c;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < g.free.length; i++) {
    if (!g.free[i]) continue;
    const [cx, cz] = cellCentre(g, i);
    const dd = (cx - x) ** 2 + (cz - z) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = i;
    }
  }
  return best;
}

function descend(g: Grid, f: Float32Array, c: number): number {
  let best = c;
  const gx = c % g.w;
  const gz = (c - gx) / g.w;
  for (const [ox, oz] of STEPS) {
    const nx = gx + ox;
    const nz = gz + oz;
    if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
    const ni = nz * g.w + nx;
    if (ox && oz && (!g.free[gz * g.w + nx] || !g.free[nz * g.w + gx])) continue;
    if (f[ni] < f[best]) best = ni;
  }
  return best;
}

function clearLine(g: Grid, ax: number, az: number, bx: number, bz: number): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (g.cell / 3));
  for (let s = 1; s < steps; s++) {
    const c = cellOf(g, ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps);
    if (c < 0 || !g.free[c]) return false;
  }
  return true;
}

const LOOK_AHEAD = 6;

/** Next point to head for: the farthest of the next few downhill cells in a straight clear line. Null at the seed. */
export function waypoint(g: Grid, f: Float32Array, x: number, z: number): Point | null {
  let c = cellOf(g, x, z);
  if (c < 0) return null;
  if (f[c] === 0) return null;
  let best: Point | null = null;
  for (let n = 0; n < LOOK_AHEAD; n++) {
    const next = descend(g, f, c);
    if (next === c) break;
    c = next;
    const p = cellCentre(g, c);
    if (best && !clearLine(g, x, z, p[0], p[1])) break;
    best = p;
    if (f[c] === 0) break;
  }
  return best;
}

export const fieldDistance = (g: Grid, f: Float32Array, x: number, z: number): number => {
  const c = cellOf(g, x, z);
  return c < 0 ? Infinity : f[c];
};

class MinHeap {
  size = 0;
  private keys = new Float32Array(1024);
  private vals = new Int32Array(1024);

  push(k: number, v: number): void {
    if (this.size === this.keys.length) {
      const nk = new Float32Array(this.size * 2);
      nk.set(this.keys);
      this.keys = nk;
      const nv = new Int32Array(this.size * 2);
      nv.set(this.vals);
      this.vals = nv;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= k) break;
      this.keys[i] = this.keys[p];
      this.vals[i] = this.vals[p];
      i = p;
    }
    this.keys[i] = k;
    this.vals[i] = v;
  }

  pop(): number {
    const top = this.vals[0];
    const k = this.keys[--this.size];
    const v = this.vals[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.keys[c + 1] < this.keys[c]) c++;
      if (this.keys[c] >= k) break;
      this.keys[i] = this.keys[c];
      this.vals[i] = this.vals[c];
      i = c;
    }
    this.keys[i] = k;
    this.vals[i] = v;
    return top;
  }
}
