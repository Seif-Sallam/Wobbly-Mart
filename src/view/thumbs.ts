// Rendered-thumbnail icons for Pads, bubbles and UI: each model drawn once into a small canvas.
import * as THREE from 'three';
import { itemModel } from './instanced';
import { buildStation } from './stations';
import { LIGHT, SHADES } from '../palette';

const SIZE = 128;
const icons = new Map<string, HTMLCanvasElement>();

/** Renders the given models (Item or Station model names). Call once after assets load. */
export function renderThumbs(items: string[], stations: string[], characters: string[]): void {
  renderObjectThumbs([
    ...items.map((n): [string, THREE.Object3D] => [n, itemModel(n)]),
    ...stations.map((n): [string, THREE.Object3D] => [n, buildStation(n, [0, 0, 2, 2], 0).root]),
    ...characters.map((n): [string, THREE.Object3D] => [n, itemModel(n)]),
  ]);
}

/** Draws each object once into its own icon under its key. */
export function renderObjectThumbs(list: [string, THREE.Object3D][]): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(SHADES.white, SHADES.thumbGround, 2.2));
  const sun = new THREE.DirectionalLight(LIGHT.sun, 2.4);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const shoot = (key: string, obj: THREE.Object3D) => {
    scene.add(obj);
    const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
    const r = sphere.radius * 1.05;
    Object.assign(camera, { left: -r, right: r, top: r, bottom: -r });
    camera.updateProjectionMatrix();
    camera.position.copy(sphere.center).add(new THREE.Vector3(1, 0.9, 1.2).normalize().multiplyScalar(20));
    camera.lookAt(sphere.center);
    renderer.render(scene, camera);
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    c.getContext('2d')?.drawImage(renderer.domElement, 0, 0);
    icons.set(key, c);
    scene.remove(obj);
  };
  for (const [key, obj] of list) shoot(key, obj);
  renderer.dispose();
  renderer.forceContextLoss();
}

export const icon = (name: string): HTMLCanvasElement | undefined => icons.get(name);

/** PROTOTYPE (prototype/staff-looks): a Staff kind's own icon when the prototype drew one, else the shared employee. */
export const staffIcon = (kind: string): string => (icons.has(`staff-${kind}`) ? `staff-${kind}` : 'employee');

/** PROTOTYPE: stores a ready-made icon (a composited badge). */
export const setIcon = (key: string, c: HTMLCanvasElement): void => void icons.set(key, c);

export const iconUrl = (name: string): string => icons.get(name)?.toDataURL() ?? '';

/** An emoji drawn as an icon the same size as the model thumbnails (Event visitors). */
export function emojiUrl(emoji: string): string {
  let c = icons.get(emoji);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.font = `${SIZE * 0.78}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, SIZE / 2, SIZE * 0.56);
    icons.set(emoji, c);
  }
  return c.toDataURL();
}
