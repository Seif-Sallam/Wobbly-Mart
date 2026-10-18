// Per-frame HUD in plain DOM: Money, Completion bar, gear, edge arrows, Event banner and cards, tutorial pop-up, movement hint, 100% banner.
import { formatMoney } from '../format';
import { FEEL } from '../feel';

export interface EdgeArrow {
  x: number;
  y: number;
  angle: number;
  icon: string;
}

/** A running Event's HUD card: icon, progress text, timer bar (share left). */
export interface EventCard {
  icon: string;
  text: string;
  left: number;
  red: boolean;
  /** A Delivery card: the pickup Station's id (tap to walk there) and an Item icon with got/want per order line. */
  delivery?: { id: string; lines: { icon: string; got: number; want: number }[] };
}

/** The running Challenge's ring timer: `left` is the share of time left, `text` what sits inside the ring. */
export interface ChallengeCard {
  icon: string;
  name: string;
  text: string;
  left: number;
  low: boolean;
}

export interface EventBanner {
  line: (text: string) => void;
  close: () => void;
}

const BILL = `<svg viewBox="0 0 40 26" class="bill"><rect x="2" y="2" width="36" height="22" rx="4" fill="var(--money)" stroke="var(--ink)" stroke-width="3"/><rect x="16" y="2" width="8" height="22" fill="var(--cream)" stroke="var(--ink)" stroke-width="2"/></svg>`;
export const GEAR = `<svg viewBox="0 0 24 24"><path fill="var(--ink)" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.7a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>`;

export class Hud {
  private money: HTMLElement;
  private bar: HTMLElement;
  private barFill: HTMLElement;
  private arrows: HTMLElement[] = [];
  private cardBox: HTMLElement;
  private cards: HTMLElement[] = [];
  private hint: HTMLElement;
  private tutor: HTMLElement;
  private shown = 0;
  private target = 0;
  private ring: HTMLElement;
  private badge: HTMLElement;
  /** The Map's Score on the badge: counts up to `score` minus the points still flying in. */
  private badgeShown = 0;
  private badgeGoal = 0;
  private held = 0;
  /** Last values written to the DOM: only changes are written. */
  private drawn = {
    money: '',
    closed: false,
    width: '',
    gold: false,
    arrows: [] as string[],
    cards: [] as string[],
    tutor: '',
    ring: '',
    badge: '',
  };
  onGear: () => void = () => {};
  /** A Delivery card was tapped: its pickup Station's id. */
  onDelivery: (id: string) => void = () => {};
  onTrophy: () => void = () => {};
  /** An Objective card landed in the trophy. */
  onLand: () => void = () => {};
  onTutorNext: () => void = () => {};
  onTutorSkip: () => void = () => {};

  /** Everything but the edge arrows, scaled by the HUD size setting. */
  private ui: HTMLElement;
  /** Left of the gear: room for more corner buttons (in landscape the whole top row is the corner cluster). */
  readonly extra: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `<div class="hud-ui">
      <div class="hud-top">
        <div class="completion"><i></i></div>
        <div class="money pill">${BILL}<span>$0</span><em class="closed-badge gone">CLOSED</em></div>
        <div class="hud-right"><div class="hud-extra"><button class="trophy round" aria-label="Logbook">🏆<b class="badge">⭐ 0</b></button></div><button class="gear round" aria-label="Pause">${GEAR}</button></div>
      </div>
      <div class="chal-ring gone"><div class="ring"><i></i></div><small><img alt=""><span></span></small></div>
      <div class="event-cards"></div>
      <div class="tutor pill gone"><small></small><p></p><div><button class="btn skip">Skip tutorial</button><button class="btn buy next">OK</button></div></div>
      <div class="hint"></div></div>`;
    this.ui = root.querySelector('.hud-ui') as HTMLElement;
    this.extra = root.querySelector('.hud-extra') as HTMLElement;
    this.ring = root.querySelector('.chal-ring') as HTMLElement;
    this.badge = root.querySelector('.badge') as HTMLElement;
    this.ui.style.setProperty('--ring-size', `${FEEL.score.ringSize}px`);
    this.cardBox = root.querySelector('.event-cards') as HTMLElement;
    this.money = root.querySelector('.money') as HTMLElement;
    this.bar = root.querySelector('.completion') as HTMLElement;
    this.barFill = root.querySelector('.completion i') as HTMLElement;
    this.hint = root.querySelector('.hint') as HTMLElement;
    this.tutor = root.querySelector('.tutor') as HTMLElement;
    const press = (sel: string, fn: () => void) =>
      (root.querySelector(sel) as HTMLElement).addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        fn();
      });
    press('.gear', () => this.onGear());
    press('.trophy', () => this.onTrophy());
    press('.tutor .next', () => this.onTutorNext());
    press('.tutor .skip', () => this.onTutorSkip());
  }

  visible(on: boolean): void {
    this.root.style.display = on ? '' : 'none';
  }

  scale(s: number): void {
    this.ui.style.setProperty('--hud-scale', String(s));
  }

  /** New Opening: jump straight to the values and drop whatever was on screen. */
  reset(money: number, score: number): void {
    this.shown = this.target = money;
    this.drawMoney();
    this.badgeShown = this.badgeGoal = score;
    this.held = 0;
    this.drawBadge();
    this.setChallenge(null);
    this.root
      .querySelectorAll('.event-banner, .report-card, .score-toast, .stamp, .obj-fly')
      .forEach((e) => e.remove());
  }

  update(dt: number, money: number, completion: number, closed: boolean, score: number): void {
    const goal = score - this.held;
    if (goal > this.badgeGoal) this.bumpBadge();
    this.badgeGoal = goal;
    const gap = goal - this.badgeShown;
    this.badgeShown = Math.abs(gap) < 0.5 ? goal : this.badgeShown + gap * Math.min(1, dt * FEEL.score.badgeCount);
    this.drawBadge();
    if (money > this.target + 0.5) {
      this.money.classList.remove('bump');
      void this.money.offsetWidth;
      this.money.classList.add('bump');
    }
    this.target = money;
    const diff = this.target - this.shown;
    this.shown = Math.abs(diff) < 0.5 ? this.target : this.shown + diff * Math.min(1, dt * 12);
    this.drawMoney();
    if (closed !== this.drawn.closed)
      this.money.querySelector('.closed-badge')?.classList.toggle('gone', !(this.drawn.closed = closed));
    const width = `${Math.round(completion * 100)}%`;
    if (width !== this.drawn.width) this.barFill.style.width = this.drawn.width = width;
    if (completion >= 1 !== this.drawn.gold) this.bar.classList.toggle('gold', (this.drawn.gold = completion >= 1));
  }

  private drawBadge(): void {
    const text = `⭐ ${Math.round(this.badgeShown).toLocaleString('en-US')}`;
    if (text !== this.drawn.badge) this.badge.textContent = this.drawn.badge = text;
  }

  private bumpBadge(): void {
    this.badge.classList.remove('bump');
    void this.badge.offsetWidth;
    this.badge.classList.add('bump');
  }

  private drawMoney(): void {
    const text = formatMoney(this.shown);
    this.money.classList.toggle('debt', this.shown <= -1);
    if (text !== this.drawn.money)
      (this.money.querySelector('span') as HTMLElement).textContent = this.drawn.money = text;
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
      const key = a ? `${Math.round(a.x)},${Math.round(a.y)},${a.angle.toFixed(2)},${a.icon}` : '';
      if (key === this.drawn.arrows[i]) return;
      this.drawn.arrows[i] = key;
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

  /** Slides in from the top with an Event's icon, name and what to do, and away after `ms`; a new one replaces it.
   * Returns a setter for its line (a countdown) and a way to slide it away early. */
  banner(icon: string, name: string, line: string, ms = FEEL.bannerMs): EventBanner {
    this.root.querySelector('.event-banner')?.remove();
    const el = document.createElement('div');
    el.className = 'event-banner pill';
    el.innerHTML = '<img alt=""><div><b></b><span></span></div>';
    (el.querySelector('img') as HTMLImageElement).src = icon;
    (el.querySelector('b') as HTMLElement).textContent = name;
    const span = el.querySelector('span') as HTMLElement;
    span.textContent = line;
    this.ui.appendChild(el);
    const close = () => {
      if (el.classList.contains('out')) return;
      el.classList.add('out');
      setTimeout(() => el.remove(), FEEL.bannerSlideMs);
    };
    setTimeout(close, ms);
    return {
      line: (text) => {
        if (span.textContent !== text) span.textContent = text;
      },
      close,
    };
  }

  setCards(list: EventCard[]): void {
    while (this.cards.length < list.length) {
      const el = document.createElement('div');
      el.className = 'event-card pill';
      el.innerHTML = '<img alt=""><span></span><i><b></b></i>';
      el.addEventListener('pointerdown', (e) => {
        if (!el.dataset.id) return;
        e.stopPropagation();
        this.onDelivery(el.dataset.id);
      });
      this.cardBox.appendChild(el);
      this.cards.push(el);
    }
    this.cards.forEach((el, i) => {
      const c = list[i];
      const lines = c?.delivery?.lines.map((l) => `${l.got}/${l.want}`).join();
      const key = c ? `${c.icon}|${c.text}|${Math.round(c.left * 100)}|${c.red}|${c.delivery?.id}|${lines}` : '';
      if (key === this.drawn.cards[i]) return;
      this.drawn.cards[i] = key;
      el.style.display = c ? '' : 'none';
      if (!c) return;
      const img = el.querySelector('img') as HTMLImageElement;
      if (img.dataset.src !== c.icon) img.src = img.dataset.src = c.icon;
      if (!c.delivery) (el.querySelector('span') as HTMLElement).textContent = c.text;
      (el.querySelector('b') as HTMLElement).style.width = `${Math.round(c.left * 100)}%`;
      el.classList.toggle('red', c.red);
      el.classList.toggle('delivery', !!c.delivery);
      if (c.delivery) el.dataset.id = c.delivery.id;
      else delete el.dataset.id;
      this.drawLines(el, c.delivery?.lines ?? []);
    });
  }

  /** A Delivery card's order lines: Item icon with got/want under it; ✓ and dimmed once full, a pop when an Item lands. */
  private drawLines(card: HTMLElement, lines: { icon: string; got: number; want: number }[]): void {
    const box = card.querySelector('span') as HTMLElement;
    if (lines.length && box.firstChild && !box.firstElementChild) box.textContent = '';
    while (box.children.length > lines.length) box.lastElementChild?.remove();
    while (box.children.length < lines.length) {
      const l = document.createElement('em');
      l.innerHTML = '<img alt=""><small></small>';
      box.appendChild(l);
    }
    lines.forEach((line, i) => {
      const el = box.children[i] as HTMLElement;
      const img = el.querySelector('img') as HTMLImageElement;
      if (img.dataset.src !== line.icon) img.src = img.dataset.src = line.icon;
      (el.querySelector('small') as HTMLElement).textContent = `${line.got}/${line.want}`;
      el.classList.toggle('full', line.got >= line.want);
      if (Number(el.dataset.got ?? line.got) < line.got) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
      el.dataset.got = String(line.got);
    });
  }

  /** The ring timer under Money; `null` hides it. */
  setChallenge(c: ChallengeCard | null): void {
    const key = c ? `${c.icon}|${c.name}|${c.text}|${Math.round(c.left * 200)}|${c.low}` : '';
    if (key === this.drawn.ring) return;
    this.drawn.ring = key;
    this.ring.classList.toggle('gone', !c);
    if (!c) return;
    const ring = this.ring.querySelector('.ring') as HTMLElement;
    ring.style.setProperty('--p', c.left.toFixed(3));
    ring.style.setProperty('--c', c.low ? 'var(--angry)' : 'var(--money)');
    (ring.querySelector('i') as HTMLElement).textContent = c.text;
    const img = this.ring.querySelector('img') as HTMLImageElement;
    if (img.dataset.src !== c.icon) img.src = img.dataset.src = c.icon;
    (this.ring.querySelector('small span') as HTMLElement).textContent = c.name;
  }

  /** A big stamp mid-screen that scales in and fades. */
  stamp(text: string): void {
    const el = document.createElement('div');
    el.className = 'stamp';
    el.textContent = text;
    el.style.animationDuration = `${FEEL.score.stampMs}ms`;
    this.ui.appendChild(el);
    setTimeout(() => el.remove(), FEEL.score.stampMs);
  }

  /** A pill mid-screen with a title and a line, gone after `toastMs`. */
  toast(title: string, line: string, good = true): void {
    const el = document.createElement('div');
    el.className = `score-toast pill ${good ? 'good' : 'bad'}`;
    el.innerHTML = '<b></b><span></span>';
    (el.querySelector('b') as HTMLElement).textContent = title;
    (el.querySelector('span') as HTMLElement).textContent = line;
    el.style.animationDuration = `${FEEL.score.toastMs}ms`;
    this.ui.appendChild(el);
    setTimeout(() => el.remove(), FEEL.score.toastMs);
  }

  /** Objective done: a card pops mid-screen, holds, then flies and shrinks into the trophy while its points count up. */
  objectiveDone(icon: string, name: string, points: number): void {
    this.held += points;
    const fly = document.createElement('div');
    fly.className = 'obj-fly';
    fly.innerHTML = '<div class="obj-card pill"><img alt=""><b>Objective done!</b><span></span><em></em></div>';
    (fly.querySelector('img') as HTMLImageElement).src = icon;
    (fly.querySelector('span') as HTMLElement).textContent = name;
    (fly.querySelector('em') as HTMLElement).textContent = `⭐ +${points}`;
    this.root.appendChild(fly);
    setTimeout(() => {
      const from = fly.getBoundingClientRect();
      const to = (this.root.querySelector('.trophy') as HTMLElement).getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const flight = fly.animate(
        [
          { transform: 'translate(-50%, -50%)' },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.1)`, opacity: 0.7 },
        ],
        { duration: FEEL.score.cardFlyMs, easing: 'cubic-bezier(0.5, 0, 0.8, 0.4)', fill: 'forwards' },
      );
      flight.addEventListener('finish', () => {
        fly.remove();
        this.held = Math.max(0, this.held - points);
        this.onLand();
      });
    }, FEEL.score.cardHoldMs);
  }

  /** The Health Inspector's report: a title and a line, green when good, red when fined. */
  report(title: string, line: string, good: boolean): void {
    this.root.querySelector('.report-card')?.remove();
    const el = document.createElement('div');
    el.className = `report-card pill ${good ? 'good' : 'bad'}`;
    el.innerHTML = '<b></b><span></span>';
    (el.querySelector('b') as HTMLElement).textContent = title;
    (el.querySelector('span') as HTMLElement).textContent = line;
    el.style.animationDuration = `${FEEL.reportMs}ms`;
    this.ui.appendChild(el);
    setTimeout(() => el.remove(), FEEL.reportMs);
  }

  /** The tutorial pop-up: the step's text and "n/of". `null` hides it. */
  tutorial(text: string | null, n = 0, of = 0): void {
    const key = text ? `${n}|${text}` : '';
    if (key === this.drawn.tutor) return;
    this.drawn.tutor = key;
    this.tutor.classList.toggle('gone', !text);
    if (!text) return;
    (this.tutor.querySelector('small') as HTMLElement).textContent = `Tutorial ${n}/${of}`;
    (this.tutor.querySelector('p') as HTMLElement).textContent = text;
    this.tutor.classList.remove('pop');
    void this.tutor.offsetWidth;
    this.tutor.classList.add('pop');
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
    this.ui.appendChild(banner);
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
