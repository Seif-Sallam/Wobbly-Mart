// Receipt cards: the Customer's bubble (one line per Product, patience tells), a Delivery car's order card and a Station's needs card.
import type { Customer, Delivery } from '../sim/world';
import { CanvasTex, canvasSprite, outlinedText, roundRect } from './text';
import { icon } from './thumbs';
import { PALETTE, SHADES } from '../palette';
import { FEEL } from '../feel';

const W = 320;
const H = 400;
const ROW = 76;
/** Sprite height (m): one 128 px row of the old bubble was 0.6 m. */
const HEIGHT = 0.6 * (H / 128);
const MOOD_COLOUR = [PALETTE.ink, SHADES.warn, PALETTE.orange, SHADES.angry];
const MOOD_FACE = ['', '…', '>_<', '>:('];
/** The timer ring redraws in this many steps. */
const RING_STEPS = 60;

/** 0 calm, 1 "…", 2 ">_<", 3 really angry. Never-give-up Customers top out at 2. */
export function moodOf(c: Customer): number {
  if (c.angry) return 3;
  if (c.state !== 'shop' || c.patience <= 0) return 0;
  const [first, second] = FEEL.moodTells;
  return c.patience >= second ? 2 : c.patience >= first ? 1 : 0;
}

export class Receipt {
  private tex = new CanvasTex(W, H);
  readonly sprite = canvasSprite(this.tex, HEIGHT);
  private key = '';
  private got: number[] = [];
  private popAt: number[] = [];
  private time = 0;

  constructor() {
    this.sprite.center.set(0.5, 0);
  }

  dispose(): void {
    this.tex.texture.dispose();
  }

  update(c: Customer, models: Record<string, { model: string } | undefined>, dt: number): void {
    const angryLeaving = c.state === 'leave' && c.angry;
    const mood = moodOf(c);
    const lines = c.list.map((e, i) => ({
      model: models[e.product]?.model ?? e.product,
      left: e.want - e.got,
      current: c.state === 'shop' && i === c.li,
    }));
    this.render(dt, c.state === 'shop' || angryLeaving, c.list, [lines, mood, angryLeaving], (g) => {
      if (angryLeaving) {
        card(g, W / 2 - 80, H - 124, 160, 100, SHADES.angry);
        outlinedText(g, MOOD_FACE[3], W / 2, H - 74, 54, SHADES.angry);
        return;
      }
      const y0 = this.lines(g, lines, MOOD_COLOUR[mood]);
      if (mood) outlinedText(g, MOOD_FACE[mood], W - 52, y0 + 4, 40, MOOD_COLOUR[mood]);
    });
  }

  /** A car's order card: the same lines, plus a timer ring that turns red near the end. */
  updateOrder(d: Delivery, models: Record<string, { model: string } | undefined>, dt: number, red: boolean): void {
    const lines = d.order.map((l) => ({
      model: models[l.product]?.model ?? l.product,
      left: l.want - l.got,
      current: false,
    }));
    const k = Math.round((1 - d.t / d.time) * RING_STEPS) / RING_STEPS;
    this.render(dt, true, d.order, [lines, k, red], (g) => {
      const y0 = this.lines(g, lines, red ? SHADES.angry : PALETTE.ink);
      const [x, y, r] = [W - 50, y0 + 6, 26];
      g.fillStyle = PALETTE.cream;
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(x, y, r + 6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = red ? SHADES.angry : PALETTE.money;
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      g.fill();
    });
  }

  /** A Station's needs card: one line per Product it takes (icon, have/cap), the empty ones red. */
  updateNeeds(needs: { model: string; have: number; cap: number }[], visible: boolean, dt: number): void {
    const lines = needs.map((n) => ({
      model: n.model,
      left: 0,
      current: false,
      text: `${n.have}/${n.cap}`,
      red: !n.have,
    }));
    this.render(
      dt,
      visible,
      needs.map((n) => ({ got: n.have })),
      lines,
      (g) => this.lines(g, lines, PALETTE.orange),
    );
  }

  /** Redraws only when what shows changed, or while a line pops after taking an Item. */
  private render(
    dt: number,
    visible: boolean,
    got: { got: number }[],
    state: unknown,
    paint: (g: CanvasRenderingContext2D) => void,
  ): void {
    this.time += dt;
    this.sprite.visible = visible;
    got.forEach((e, i) => {
      if (e.got > (this.got[i] ?? 0)) this.popAt[i] = this.time;
      this.got[i] = e.got;
    });
    const popping = this.popAt.some((t) => this.time - t < FEEL.receiptPop);
    const key = JSON.stringify([state, visible]);
    if (key === this.key && !popping) return;
    this.key = key;
    this.tex.draw((g) => visible && paint(g));
  }

  /** The card with one line per Product (icon, then its text, ×n left or a tick); returns its top. */
  private lines(
    g: CanvasRenderingContext2D,
    lines: { model: string; left: number; current: boolean; text?: string; red?: boolean }[],
    edge: string,
  ): number {
    const h = lines.length * ROW + 24;
    const y0 = H - 24 - h;
    card(g, 30, y0, W - 60, h, edge);
    lines.forEach((l, i) => {
      const y = y0 + 12 + i * ROW + ROW / 2;
      if (l.current && l.left > 0) {
        g.fillStyle = PALETTE.orange;
        g.globalAlpha = 0.22;
        roundRect(g, 42, y - ROW / 2 + 4, W - 84, ROW - 8, 14);
        g.fill();
        g.globalAlpha = 1;
      }
      const s = this.pop(i);
      const img = icon(l.model);
      if (img) {
        g.globalAlpha = l.text || l.left > 0 ? 1 : FEEL.receiptDoneAlpha;
        g.drawImage(img, 92 - 36 * s, y - 36 * s, 72 * s, 72 * s);
        g.globalAlpha = 1;
      }
      if (l.text) outlinedText(g, l.text, 196, y, 44 * s, l.red ? SHADES.angry : PALETTE.cream);
      else if (l.left > 0) outlinedText(g, `×${l.left}`, 196, y, 44 * s, PALETTE.cream);
      else tick(g, 190, y, 20 * s);
    });
    return y0;
  }

  /** ×1.35 and back after a line takes an Item. */
  private pop(i: number): number {
    const t = (this.time - (this.popAt[i] ?? -9)) / FEEL.receiptPop;
    return t >= 0 && t < 1 ? 1 + Math.sin(t * Math.PI) * 0.35 : 1;
  }
}

function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: string): void {
  g.fillStyle = PALETTE.cream;
  g.strokeStyle = edge;
  g.lineWidth = 7;
  roundRect(g, x, y, w, h, 26);
  g.fill();
  g.stroke();
  for (const [dy, op] of [
    [-2, 'fill'],
    [2, 'stroke'],
  ] as const) {
    g.beginPath();
    g.moveTo(W / 2 - 14, y + h + dy);
    g.lineTo(W / 2, y + h + 18);
    g.lineTo(W / 2 + 14, y + h + dy);
    g[op]();
  }
}

function tick(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = PALETTE.money;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = PALETTE.cream;
  g.lineWidth = r * 0.3;
  g.beginPath();
  g.moveTo(x - r * 0.45, y);
  g.lineTo(x - r * 0.1, y + r * 0.38);
  g.lineTo(x + r * 0.5, y - r * 0.4);
  g.stroke();
}
