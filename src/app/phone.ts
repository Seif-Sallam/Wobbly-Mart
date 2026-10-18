// Phone layout: touch detection, landscape, and the CSS classes and variables the phone styles read.
import { FEEL } from '../feel';

/** A touch screen. In dev, `?phone` pretends a desktop window is one. */
export const isTouch =
  matchMedia('(pointer: coarse)').matches || (import.meta.env.DEV && new URLSearchParams(location.search).has('phone'));

/** Phone landscape: a touch screen wider than tall. */
export const layout = { land: false };

/** Safe-area insets in px (notch side included). */
export function insets(): { top: number; right: number; bottom: number; left: number } {
  const probe =
    document.getElementById('insets') ??
    document.body.appendChild(Object.assign(document.createElement('div'), { id: 'insets' }));
  const s = getComputedStyle(probe);
  return {
    top: parseFloat(s.paddingTop),
    right: parseFloat(s.paddingRight),
    bottom: parseFloat(s.paddingBottom),
    left: parseFloat(s.paddingLeft),
  };
}

/** Runs `onChange` now and whenever the window changes shape. */
export function watchLayout(onChange: () => void): void {
  const root = document.documentElement;
  root.style.setProperty('--office-side', String(FEEL.officeSide));
  root.style.setProperty('--office-sheet', String(FEEL.officeSheet));
  const apply = () => {
    layout.land = isTouch && innerWidth > innerHeight;
    root.classList.toggle('ph', isTouch);
    root.classList.toggle('pl', layout.land);
    root.style.setProperty('--screen-scale', String(layout.land ? FEEL.landScreenScale : FEEL.portScreenScale));
    root.style.setProperty('--card-scale', String(FEEL.landCardScale));
    onChange();
  };
  // innerWidth and the safe areas settle a moment after the event
  addEventListener('resize', () => setTimeout(apply, 50));
  screen.orientation?.addEventListener('change', () => setTimeout(apply, 150));
  apply();
}
