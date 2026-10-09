// Tap Walk: a tap or click on the floor, a Pad or a Station walks the Player there, feeding the same move intent as
// the joystick. It reads the sim to pick and steer; the sim never knows.
import type { Box, Point } from '../sim/map';
import type { World } from '../sim/world';
import { boxCentre, distToBox, footprint, frontPoint, inBox } from '../sim/geometry';
import { TUNING } from '../sim/tuning';
import { forgetPoint, headingFor, inOwnedAreas, walkable, walkDistance, type Target } from '../sim/walk';
import { visiblePads } from '../sim/economy';
import { FEEL } from '../feel';

const grow = (b: Box, s: number): Box => [b[0] - s, b[1] - s, b[2] + 2 * s, b[3] + 2 * s];

export class TapWalk {
  target: Target | null = null;
  /** Double-tapped: Sprint for this walk. */
  sprint = false;

  /** Picks what a tap on floor point `p` means and starts walking there; a spot nobody can walk to does nothing. */
  start(w: World, p: Point, sprint: boolean): void {
    this.forget(w);
    this.target = pick(w, p);
    this.sprint = sprint;
  }

  cancel(): void {
    this.target = null;
  }

  /** A finished walk's one-off point field isn't kept. */
  private forget(w: World): void {
    if (this.target && 'point' in this.target) forgetPoint(w, this.target.point);
  }

  /** This step's move intent; the walk ends on arrival. */
  move(w: World): { x: number; z: number } {
    const t = this.target;
    if (!t || ('station' in t && !w.stations.has(t.station))) return this.stop(w);
    const pl = w.player;
    const left =
      'point' in t
        ? Math.hypot(t.point[0] - pl.x, t.point[1] - pl.z)
        : Math.max(0, distToBox(pl.x, pl.z, w.stations.get(t.station)?.box ?? [0, 0, 0, 0]) - stationStop());
    if (left < ('point' in t ? FEEL.tapArriveStop : FEEL.tapStationSettle)) return this.stop(w);
    // the walk grid counts a Station as reached a little early: finish the approach toward its nearest edge
    const heading = headingFor(w, 'walker', pl, t) ?? ('station' in t ? nearestEdge(w, t.station, pl) : null);
    if (!heading) return this.stop(w);
    // last stretch: ease off and head for the exact tapped point, not the walk grid's cell centre
    const to = 'point' in t && left < FEEL.tapArriveSlow ? t.point : heading;
    const push = Math.min(1, Math.max(FEEL.tapMinPush, left / FEEL.tapArriveSlow));
    const dx = to[0] - pl.x;
    const dz = to[1] - pl.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: (dx / d) * push, z: (dz / d) * push };
  }

  private stop(w: World): { x: number; z: number } {
    this.forget(w);
    this.target = null;
    return { x: 0, z: 0 };
  }
}

/** A Station walk ends this far from its edge: well inside reach, so proximity does the action. */
const stationStop = (): number => Math.max(TUNING.reach * FEEL.tapStationDepth, TUNING.playerRadius + 0.05);

function nearestEdge(w: World, id: string, at: { x: number; z: number }): Point | null {
  const b = w.stations.get(id)?.box;
  return b ? [Math.min(Math.max(at.x, b[0]), b[0] + b[2]), Math.min(Math.max(at.z, b[1]), b[1] + b[3])] : null;
}

function pick(w: World, p: Point): Target | null {
  for (const id of visiblePads(w)) {
    const b = w.map.layout.places[id].box;
    if (inBox(p[0], p[1], grow(b, FEEL.tapPickSlop))) return { point: boxCentre(b) };
  }
  for (const [id, s] of w.stations) {
    if (!inBox(p[0], p[1], grow(s.box, FEEL.tapPickSlop))) continue;
    // the Register is worked from behind, where the Cashier stands
    if (s.kind === 'register')
      return { point: frontPoint(s.box, s.rot, -(footprint(s.box, s.rot)[1] + FEEL.tapBehindRegister)) };
    return { station: id };
  }
  // the floor: only inside the bought Areas and somewhere the Player can walk to (a tap into a prop snaps out of it)
  if (!inOwnedAreas(w, p[0], p[1])) return null;
  const to = walkable(w, p[0], p[1]);
  const [px, pz] = walkable(w, w.player.x, w.player.z);
  return Number.isFinite(walkDistance(w, 'walker', { x: px, z: pz }, { point: to })) ? { point: to } : null;
}
