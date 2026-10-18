// mulberry32: tiny seeded RNG; state lives in the World so runs replay exactly.
export function nextRandom(state: { rng: number }): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randomInt = (state: { rng: number }, min: number, max: number): number =>
  min + Math.floor(nextRandom(state) * (max - min + 1));

/** A float in [lo, hi). */
export const randomBetween = (state: { rng: number }, [lo, hi]: readonly [number, number]): number =>
  lo + nextRandom(state) * (hi - lo);

export function shuffle<T>(state: { rng: number }, list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A shuffle where heavier entries tend to come first (keys rand^(1/weight)); all weights 1 = a plain shuffle. */
export function weightedShuffle<T>(state: { rng: number }, list: T[], weight: (t: T) => number): T[] {
  if (list.every((t) => weight(t) === 1)) return shuffle(state, list);
  return list
    .map((t) => ({ t, key: nextRandom(state) ** (1 / weight(t)) }))
    .sort((a, b) => b.key - a.key)
    .map((e) => e.t);
}

/** Index picked with chance proportional to its weight. */
export function weighted(state: { rng: number }, weights: readonly number[]): number {
  let r = nextRandom(state) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
}
