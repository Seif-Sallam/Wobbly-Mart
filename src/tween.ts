// In-house tweens driven by the game clock (call `tweens.update(dt)` once per frame).
export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  /** Overshoots past 1 then settles: springy pop. */
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  outElastic: (t: number) =>
    t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1,
  outBounce: (t: number) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

interface Tween {
  t: number;
  duration: number;
  delay: number;
  apply: (k: number) => void;
  ease: (t: number) => number;
  done?: () => void;
}

export class Tweens {
  private list: Tween[] = [];

  /** Calls `apply` with eased progress 0 → 1 over `duration` seconds. */
  add(
    duration: number,
    apply: (k: number) => void,
    opts: { ease?: (t: number) => number; delay?: number; done?: () => void } = {},
  ): void {
    this.list.push({
      t: 0,
      duration,
      delay: opts.delay ?? 0,
      apply,
      ease: opts.ease ?? ease.outCubic,
      done: opts.done,
    });
  }

  update(dt: number): void {
    const current = this.list;
    const still: Tween[] = [];
    this.list = [];
    for (const tw of current) {
      if (tw.delay > 0) {
        tw.delay -= dt;
        still.push(tw);
        continue;
      }
      tw.t = Math.min(tw.duration, tw.t + dt);
      const k = tw.duration > 0 ? tw.t / tw.duration : 1;
      tw.apply(tw.ease(k));
      if (k < 1) still.push(tw);
      else tw.done?.();
    }
    this.list.push(...still);
  }
}
