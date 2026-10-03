// Canvas drawing helpers for in-scene labels (Pad prices, floating numbers, bubbles).
import * as THREE from 'three';
import { PALETTE } from '../palette';

export function outlinedText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  stroke: string = PALETTE.ink,
): void {
  g.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size / 4;
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A canvas + texture pair that redraws on demand. */
export class CanvasTex {
  readonly canvas = document.createElement('canvas');
  readonly g: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;

  constructor(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.g = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  draw(fn: (g: CanvasRenderingContext2D, w: number, h: number) => void): void {
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    fn(this.g, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }
}

/** A camera-facing sprite showing a canvas, sized in metres by its height. */
export function canvasSprite(tex: CanvasTex, height: number): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({ map: tex.texture, transparent: true, depthWrite: false, toneMapped: false });
  const s = new THREE.Sprite(mat);
  s.scale.set((height * tex.canvas.width) / tex.canvas.height, height, 1);
  s.renderOrder = 10;
  return s;
}
