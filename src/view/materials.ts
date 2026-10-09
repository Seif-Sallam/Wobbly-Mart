import * as THREE from 'three';
import { DERIVED, PALETTE } from '../palette';

const cache = new Map<string, THREE.MeshStandardMaterial>();
const palette = new Set<THREE.Material>();
const ROUGHNESS = 0.9;
/** Stands in for every palette material in merged meshes: colours baked into the vertices, one draw call for all. */
const vertexPalette = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: ROUGHNESS });

/** Shared material for a palette colour name (or a derived one like `dirtDark`), or any CSS colour. */
export function paletteMaterial(name: string): THREE.MeshStandardMaterial {
  let m = cache.get(name);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: paletteColor(name), roughness: ROUGHNESS });
  cache.set(name, m);
  palette.add(m);
  return m;
}

/** For merging: a palette mesh's geometry gets its colour as vertex colours and the shared vertex-colour material. */
export function bakePalette(
  g: THREE.BufferGeometry,
  m: THREE.Material,
): { geometry: THREE.BufferGeometry; material: THREE.Material } {
  if (!palette.has(m)) return { geometry: g, material: m };
  const { r, g: gr, b } = (m as THREE.MeshStandardMaterial).color;
  const n = g.attributes.position.count;
  const colours = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colours.set([r, gr, b], i * 3);
  g.deleteAttribute('uv');
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return { geometry: g, material: vertexPalette };
}

export function paletteColor(name: string): THREE.Color {
  if (name in PALETTE) return new THREE.Color(PALETTE[name as keyof typeof PALETTE]);
  if (name in DERIVED) {
    const [base, f] = DERIVED[name as keyof typeof DERIVED];
    return new THREE.Color(PALETTE[base]).multiplyScalar(f);
  }
  return new THREE.Color(name);
}
