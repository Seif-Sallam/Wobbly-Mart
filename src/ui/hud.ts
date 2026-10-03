// Per-frame HUD in plain DOM: Money, Completion bar, gear, edge arrows, movement hint, 100% banner.
import { formatMoney } from '../format';

export interface EdgeArrow {
  x: number;
  y: number;
  angle: number;
  icon: string;
}

const BILL = `<svg viewBox="0 0 40 26" class="bill"><rect x="2" y="2" width="36" height="22" rx="4" fill="var(--money)" stroke="var(--ink)" stroke-width="3"/><rect x="16" y="2" width="8" height="22" fill="var(--cream)" stroke="var(--ink)" stroke-width="2"/></svg>`;
const GEAR = `<svg viewBox="0 0 24 24"><path fill="var(--ink)" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.7a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>`;

export class Hud {
  private money: HTMLElement;
  private bar: HTMLElement;
  private barFill: HTMLElement;
  private arrows: HTMLElement[] = [];
  private hint: HTMLElement;
  private shown = 0;
  private target = 0;
  onGear: () => void = () => {};

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="hud-top">
        <div class="completion"><i></i></div>
        <div class="money pill">${BILL}<span>$0</span></div>
        <button class="gear round" aria-label="Pause">${GEAR}</button>
      </div>
      <div class="hint"></div>`;
    this.money = root.querySelector('.money') as HTMLElement;
    this.bar = root.querySelector('.completion') as HTMLElement;
    this.barFill = root.querySelector('.completion i') as HTMLElement;
    this.hint = root.querySelector('.hint') as HTMLElement;
    const gear = root.querySelector('.gear') as HTMLElement;
    gear.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onGear();
    });
  }

  visible(on: boolean): void {
    this.root.style.display = on ? '' : 'none';
  }

  /** Jump straight to a value (new Opening). */
  resetMoney(v: number): void {
    this.shown = this.target = v;
    this.drawMoney();
  }

  update(dt: number, money: number, completion: number): void {
    if (money > this.target + 0.5) {
      this.money.classList.remove('bump');
      void this.money.offsetWidth;
      this.money.classList.add('bump');
    }
    this.target = money;
    const diff = this.target - this.shown;
    this.shown = Math.abs(diff) < 0.5 ? this.target : this.shown + diff * Math.min(1, dt * 12);
    this.drawMoney();
    this.barFill.style.width = `${Math.round(completion * 100)}%`;
    this.bar.classList.toggle('gold', completion >= 1);
  }

  private drawMoney(): void {
    (this.money.querySelector('span') as HTMLElement).textContent = formatMoney(this.shown);
  }

  setArrows(list: EdgeArrow[]): void {
    while (this.arrows.length < list.length) {
      const el = document.createElement('div');
      el.className = 'edge-arrow';
      el.innerHTML = '<b></b><img alt="">';
      this.root.appendChild(el);
      this.arrows.push(el);
    }
    this.arrows.forEach((el, i) => {
      const a = list[i];
      el.style.display = a ? '' : 'none';
      if (!a) return;
      el.style.transform = `translate(${a.x}px, ${a.y}px)`;
      (el.querySelector('b') as HTMLElement).style.transform = `rotate(${a.angle}rad)`;
      const img = el.querySelector('img') as HTMLImageElement;
      if (img.dataset.src !== a.icon) {
        img.dataset.src = a.icon;
        img.src = a.icon;
      }
    });
  }

  /** Movement hint: keycaps on desktop, a dragging hand on touch. `null` hides it. */
  showHint(kind: 'keys' | 'touch' | null): void {
    this.hint.className = `hint ${kind ?? 'gone'}`;
    if (kind === 'keys')
      this.hint.innerHTML = '<div class="keys"><kbd>W</kbd><br><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>';
    if (kind === 'touch') this.hint.innerHTML = '<div class="hand">👆</div>';
  }

  celebrate(): void {
    const banner = document.createElement('div');
    banner.className = 'banner100';
    banner.textContent = '100%!';
    this.root.appendChild(banner);
    const colors = ['--money', '--orange', '--pad', '--sky', '--cream'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = `var(${colors[i % colors.length]})`;
      c.style.animationDelay = `${Math.random() * 0.8}s`;
      c.style.animationDuration = `${2 + Math.random() * 1.5}s`;
      this.root.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
    setTimeout(() => banner.remove(), 3500);
  }
}
