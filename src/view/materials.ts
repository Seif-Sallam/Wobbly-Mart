import * as THREE from 'three';
import { DERIVED, PALETTE } from '../palette';

const cache = new Map<string, THREE.MeshStandardMaterial>();
/** Shared look → the vertex-colour stand-in that replaces it in merged meshes. */
const baked = new Map<THREE.Material, THREE.Material>();
const ROUGHNESS = 0.9;
const GLOSS_ROUGHNESS = 0.3;
const SPOT_OPACITY = 0.55;
const vertexLook = (params: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ vertexColors: true, ...params });
/** Stands in for every palette material in merged meshes: colours baked into the vertices, one draw call for all. */
const vertexPalette = vertexLook({ roughness: ROUGHNESS });
const vertexGloss = vertexLook({ roughness: GLOSS_ROUGHNESS });
const vertexSpot = vertexLook({ transparent: true, opacity: SPOT_OPACITY });

function shared(
  key: string,
  colour: string,
  stand: THREE.Material | null,
  params: THREE.MeshStandardMaterialParameters,
): THREE.MeshStandardMaterial {
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: paletteColor(colour), ...params });
  cache.set(key, m);
  if (stand) baked.set(m, stand);
  return m;
}

/** Shared material for a palette colour name (or a derived one like `dirtDark`), or any CSS colour. */
export function paletteMaterial(name: string): THREE.MeshStandardMaterial {
  return shared(name, name, vertexPalette, { roughness: ROUGHNESS });
}

/** Shared shiny (glazed, painted) material in a palette or CSS colour. */
export function glossMaterial(colour: string): THREE.MeshStandardMaterial {
  return shared(`gloss|${colour}`, colour, vertexGloss, { roughness: GLOSS_ROUGHNESS });
}

/** Shared translucent painted square for an input spot. */
export function spotMaterial(colour: string): THREE.MeshStandardMaterial {
  return shared(`spot|${colour}`, colour, vertexSpot, { transparent: true, opacity: SPOT_OPACITY });
}

/** Shared see-through glass at one opacity (merges per opacity, not into the vertex-colour meshes). */
export function glassMaterial(colour: string, opacity: number): THREE.MeshStandardMaterial {
  return shared(`glass|${colour}|${opacity}`, colour, null, { transparent: true, opacity, roughness: 0.1 });
}

/** For merging: a shared material's geometry gets its colour as vertex colours and the vertex-colour stand-in. */
export function bakePalette(
  g: THREE.BufferGeometry,
  m: THREE.Material,
): { geometry: THREE.BufferGeometry; material: THREE.Material } {
  const stand = baked.get(m);
  if (!stand) return { geometry: g, material: m };
  const { r, g: gr, b } = (m as THREE.MeshStandardMaterial).color;
  const n = g.attributes.position.count;
  const colours = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colours.set([r, gr, b], i * 3);
  g.deleteAttribute('uv');
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return { geometry: g, material: stand };
}

export function paletteColor(name: string): THREE.Color {
  if (name in PALETTE) return new THREE.Color(PALETTE[name as keyof typeof PALETTE]);
  if (name in DERIVED) {
    const [base, f] = DERIVED[name as keyof typeof DERIVED];
    return new THREE.Color(PALETTE[base]).multiplyScalar(f);
  }
  return new THREE.Color(name);
}
