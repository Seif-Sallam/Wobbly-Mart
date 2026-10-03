// Offline asset step: shrinks the animated Kenney GLBs (characters, pets) before commit; run once after adding one.
// Drops attributes and animation clips the game never uses, then quantizes. The colormap gets embedded.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize } from '@gltf-transform/functions';

const FILES = ['chars', 'pets', 'market/character-employee.glb'];
const KEEP_CLIPS = new Set(['idle', 'walk', 'holding-both', 'emote-yes', 'emote-no', 'eat', 'static']);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const paths = FILES.map((f) => join('public/models', f)).flatMap((p) =>
  p.endsWith('.glb')
    ? [p]
    : readdirSync(p)
        .filter((f) => f.endsWith('.glb'))
        .map((f) => join(p, f)),
);
for (const path of paths) {
  {
    const before = statSync(path).size;
    const doc = await io.read(path);
    const root = doc.getRoot();
    for (const anim of root.listAnimations()) if (!KEEP_CLIPS.has(anim.getName())) anim.dispose();
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        for (const attr of ['TANGENT', 'TEXCOORD_1']) prim.getAttribute(attr)?.dispose();
      }
    }
    await doc.transform(prune(), dedup(), quantize());
    await io.write(path, doc);
    console.log(`${path}: ${(before / 1024).toFixed(0)} → ${(statSync(path).size / 1024).toFixed(0)} kB`);
  }
}
