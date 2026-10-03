// The Wobbly Mart wordmark: chunky tilted Fredoka letters at uneven heights, the stack icon on the "M".
import { useEffect, useRef } from 'preact/hooks';
import { PALETTE } from '../palette';
import { STACK_SHAPES } from './icon-svg';

const WORD: { ch: string; color: string }[] = [
  ...[...'Wobbly'].map((ch) => ({ ch, color: PALETTE.money })),
  ...[...'Mart'].map((ch) => ({ ch, color: PALETTE.orange })),
];
const HEIGHTS = [0, -6, 3, -3, 4, -5, 0, -7, 2, -4];

export function Logo() {
  const letters = useRef<(SVGTextElement | null)[]>([]);
  const stack = useRef<SVGGElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      letters.current.forEach((el, i) => {
        el?.setAttribute(
          'transform',
          `translate(0 ${Math.sin(t * 2.2 + i * 0.9) * 3}) rotate(${Math.sin(t * 1.6 + i) * 3} ${xOf(i) + 14} 60)`,
        );
      });
      stack.current?.setAttribute('transform', `translate(318 -34) scale(0.62) rotate(${Math.sin(t * 1.8) * 6} 50 92)`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <svg class="logo" viewBox="-10 -45 560 150" role="img" aria-label="Wobbly Mart">
      <g transform="rotate(-5 270 60)" style={{ filter: 'drop-shadow(0 6px 0 rgba(58,36,22,.25))' }}>
        <g ref={stack}>{<g dangerouslySetInnerHTML={{ __html: STACK_SHAPES }} />}</g>
        {WORD.map((l, i) => (
          <text
            key={i}
            ref={(el) => {
              letters.current[i] = el;
            }}
            x={xOf(i)}
            y={78 + HEIGHTS[i]}
            fill={l.color}
            stroke={PALETTE.ink}
            stroke-width="10"
            paint-order="stroke fill"
            stroke-linejoin="round"
            font-family="Fredoka, system-ui"
            font-weight="700"
            font-size="86"
          >
            {l.ch}
          </text>
        ))}
      </g>
    </svg>
  );
}

const ADVANCE = [66, 48, 48, 48, 26, 46, 74, 48, 34, 30];
function xOf(i: number): number {
  let x = 0;
  for (let k = 0; k < i; k++) x += ADVANCE[k] + (k === 5 ? 24 : 0);
  return x;
}
