// Intents as the sim sees them. Move is quantized to int8 steps, so a Replay (which logs int8) plays back exactly.
import type { Intents } from './world';

/** int8 range of one move axis: -127..127. */
export const MOVE_STEPS = 127;

export const toMoveStep = (v: number): number =>
  Math.max(-MOVE_STEPS, Math.min(MOVE_STEPS, Math.round(v * MOVE_STEPS)));

export const quantize = (intents: Intents): Intents => ({
  ...intents,
  move: { x: toMoveStep(intents.move.x) / MOVE_STEPS, z: toMoveStep(intents.move.z) / MOVE_STEPS },
});
