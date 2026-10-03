// Loads every GLB in the asset table once; hands out fitted, palette-recoloured clones by model name.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ASSETS, MATERIAL_PALETTE } from '../../catalog/assets';
import { paletteMaterial } from './materials';

interface Loaded {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  size: THREE.Vector3;
  minY: number;
}

const loaded = new Map<string, Loaded>();

export async function loadAssets(onProgress: (done: number, total: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL;
  const paths = [...new Set(Object.values(ASSETS).flatMap((a) => (a.path ? [a.path] : [])))];
  let done = 0;
  await Promise.all(
    paths.map(async (path) => {
      const gltf = await loader.loadAsync(`${base}models/${path}.glb`);
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        const src = m.material as THREE.MeshStandardMaterial;
        const token = !src.map ? MATERIAL_PALETTE[src.name] : undefined;
        if (token) m.material = paletteMaterial(token);
      });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      loaded.set(path, {
        scene: gltf.scene,
        clips: gltf.animations,
        size: box.getSize(new THREE.Vector3()),
        minY: box.min.y,
      });
      onProgress(++done, paths.length);
    }),
  );
}

export const clipsOf = (name: string): THREE.AnimationClip[] => loaded.get(ASSETS[name]?.path ?? '')?.clips ?? [];

const tinted = new Map<string, THREE.Material>();
function tint(obj: THREE.Object3D, color: string): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    const key = `${src.uuid}:${color}`;
    if (!tinted.has(key)) {
      const t = src.clone();
      t.color.multiply(new THREE.Color(color));
      tinted.set(key, t);
    }
    m.material = tinted.get(key) as THREE.Material;
  });
}

export interface ModelOptions {
  /** Footprint to fill (w × d, metres) when the asset doesn't set a height. */
  fit?: [number, number];
  height?: number;
  tint?: string;
}

/**
 * A fresh copy of a model, scaled per the asset table, standing on y = 0, front facing +z.
 * Wrapped in a group so callers can position/rotate it freely.
 */
export function model(name: string, opts: ModelOptions = {}): THREE.Group {
  const def = ASSETS[name];
  const src = def?.path ? loaded.get(def.path) : undefined;
  const group = new THREE.Group();
  group.name = name;
  if (!def || !src) return group;
  const inner = cloneSkinned(src.scene);
  const height = opts.height ?? def.height;
  let s = 1;
  if (height) s = height / src.size.y;
  else if (opts.fit) {
    const turned = (def.yaw ?? 0) % 180 !== 0;
    s = Math.min(opts.fit[0] / (turned ? src.size.z : src.size.x), opts.fit[1] / (turned ? src.size.x : src.size.z));
  }
  inner.scale.setScalar(s);
  inner.position.y = -src.minY * s;
  inner.rotation.y = THREE.MathUtils.degToRad(def.yaw ?? 0);
  if (def.tint || opts.tint) tint(inner, opts.tint ?? def.tint ?? '#fff');
  group.add(inner);
  return group;
}

/** Size of a model's natural bounding box (unscaled), for fitting decisions. */
export const naturalSize = (name: string): THREE.Vector3 =>
  loaded.get(ASSETS[name]?.path ?? '')?.size.clone() ?? new THREE.Vector3(1, 1, 1);
