# My Mini Mart web clone: tech stack, deploy path and free assets

Researched 2026-10-02. This builds on `01-game-and-hosting.md` and does not repeat it. Every claim has a source. **[UNVERIFIED]** marks single-source, summarised-only or inferred claims. **[MEASURED]** means I downloaded the package or asset and checked it locally. Asset contents were verified by downloading the zips and reading the GLB JSON (animation names, skins, texture references), not just by reading store pages.

---

## Key takeaways

1. **Stick with Three.js + Vite + TypeScript.** Babylon.js does not save meaningful work for this game. Its extras (GUI, inspector, physics) cover things this game either barely needs or does more easily in HTML/CSS. A minimal tree-shaken Babylon scene bundled to about **676 KB gz versus about 161 KB gz for Three.js** [MEASURED], and Three.js has about **48× the npm weekly downloads** (21.5M vs 0.44M), which is a rough proxy for how much example code an AI agent has seen.
2. **Add-on libraries (all small, all MIT):**
   - `three/addons` GLTFLoader + `SkeletonUtils.clone` for loading and cloning animated characters
   - `AnimationMixer` for walk/idle/carry
   - `InstancedMesh` for shelf stock and money piles
   - an HTML/CSS overlay for the HUD
   - `nipplejs` 1.0.4 (ships TypeScript types) for the touch joystick
   - `@tweenjs/tween.js` for juice tweens
   - `howler` for audio
   - **No physics engine.** Circle-vs-box push-out on a grid is enough.
   Extras bundle measured at ~10 KB gz for nipplejs + tween.js.
3. **Deploy:** use Vite's official GitHub Pages workflow with `actions/deploy-pages@v5`, `upload-pages-artifact@v5`, `configure-pages@v6`, `checkout@v7` and `setup-node@v7`. These are the current releases [MEASURED via GitHub API]. Set `base: '/<repo>/'`, or `'./'` for a relative base. Pages serves every file, `.glb` included, with **gzip and `Cache-Control: max-age=600`** [MEASURED]. You cannot change those headers, so rely on Vite's hashed filenames.
4. **Assets: Kenney (CC0) covers about 85% of the game in one consistent style.** **Kenney Mini Market** has shelves, a cash register, fridges, carts, baskets, a floor, walls and an animated employee. **Kenney Mini Characters** has 12 people with `idle`, `walk`, `sprint`, `pick-up` and an arms-only `holding-both` carry pose on the same rig. **Kenney Cube Pets** has a chick and a cow with `idle`, `walk` and `eat`. **Kenney Food Kit** has egg, carton, bread, ketchup bottle, tomato, corn and apple. **Kenney Nature Kit** has corn stages A–D, wheat stages A–B, fences, paths, trees and ground tiles. All of these ship as GLB [MEASURED].
5. **Main gaps:**
   - a **tomato plant**, which Quaternius Crops has in 4 stages but in a different, faceted style
   - an **apple tree with stages**
   - a **chicken coop** and **cow pen**
   - a **ketchup blender machine** (Kenney Furniture `kitchenBlender` is a usable stand-in)
   - **money stacks**
   - **floor price pads**
   - **crates holding produce**
   All of these are easy as primitives or as compositions of Kenney parts.
6. **Gotcha:** Kenney GLBs reference an **external** `Textures/colormap.png`, and every pack has a *different* colormap under the *same* name [MEASURED]. Either keep one folder per pack, or run `gltf-transform copy in.glb out.glb` to embed the texture. I tested this and it works.
7. **Audio:** the **Kenney audio packs (CC0, OGG)** cover pops, clicks, coins and chips. The closest fit for coins is `handleCoins` in RPG Audio and `chips-stack` in Casino Audio. Freesound's CC0 filter has several cash-register sounds. **jsfxr** (Unlicense) generates pickup and coin blips. OpenGameArt has curated CC0 music collections. Kenney has jingles but no music loops.

---

## A. What Three.js needs alongside it

Versions checked on npm 2026-10-02: `three` 0.186.1 (MIT), `@types/three` 0.186.0, `nipplejs` 1.0.4 (MIT), `@tweenjs/tween.js` 25.0.0 (MIT), `gsap` 3.15.0 (proprietary "Standard no-charge" license), `howler` 2.2.4 (MIT), `@babylonjs/core` 9.29.0 (Apache-2.0). Source: `https://registry.npmjs.org/<pkg>/latest` and `https://api.npmjs.org/downloads/point/last-week/<pkg>`.

### A1. glTF loading and skeletal animation

- **Loader:** `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`. The `three` package exports `./addons/*` [MEASURED from `three/package.json`]. Docs: https://threejs.org/docs/pages/GLTFLoader.html
- **Cloning:** each customer or staff member is a clone of one loaded GLB, made with `SkeletonUtils.clone()`. A plain `.clone()` breaks skinned meshes. The source says `clone` "ensur[es] that any `SkinnedMesh` instances are correctly associated with their bones … geometries and materials are reused by reference" (https://github.com/mrdoob/three.js/blob/dev/examples/jsm/utils/SkeletonUtils.js; docs https://threejs.org/docs/pages/module-SkeletonUtils.html). Kenney Mini Characters have `skins=2` [MEASURED], so they need this. Kenney Cube Pets and Blocky Characters animate nodes directly (`skins=0`) [MEASURED], so a normal clone works.
- **Playback:**
  - one `AnimationMixer` per character, with `mixer.update(dt)` called every frame (https://threejs.org/docs/pages/AnimationMixer.html)
  - `mixer.clipAction(clip)` returns an `AnimationAction`
  - switch states with `crossFadeTo` or `fadeIn`/`fadeOut` (https://threejs.org/docs/pages/AnimationAction.html)
  - official example: `webgl_animation_skinning_blending`, one of 610 official examples [MEASURED from `examples/files.json`] (https://threejs.org/examples/#webgl_animation_skinning_blending)
- **Carry animation on the Kenney rig** [MEASURED]. The rig has 6 bones: root, torso, head, arm-left/right, leg-left/right.

  | Clip | Length | Bones animated |
  |---|---|---|
  | `walk` | 0.67 s | all bones |
  | `idle` | 1.33 s | arms, torso, head |
  | `holding-both` | 0.17 s | arms only |

  To get "walk while carrying", play `holding-both` together with a copy of `walk` that has its `arm-*` tracks removed, by filtering `clip.tracks` by name. Weighted blending averages poses rather than overriding them, so without the filter the arms would end up half-swinging.
- **Format:** prefer GLB everywhere. FBX packs (Quaternius Crops) should be converted offline with Blender, or downloaded per model as glTF from Poly Pizza. Three also has an `FBXLoader`, but it adds complexity.
- **Optional optimisation:** `@gltf-transform/cli` 4.5.1 (MIT) can embed textures, dedupe and compress. Kenney models are tiny (6–30 KB each; 125–275 KB per animated character [MEASURED]), so Draco or Meshopt compression isn't worth the decoder cost here.

### A2. InstancedMesh for many stacked items

- Use one `InstancedMesh(geometry, material, maxCount)` per product type. Call `setMatrixAt(i, m)`, set `instanceMatrix.needsUpdate = true`, and adjust `.count` as items appear and disappear. The source describes it as for "a large number of objects with the same geometry and material(s) but with different world transformations … reduce the number of draw calls" (https://github.com/mrdoob/three.js/blob/dev/src/objects/InstancedMesh.js; https://threejs.org/docs/pages/InstancedMesh.html).
- Kenney food items are single-node, single-material GLBs [MEASURED: `tomato.glb` has 1 node, 1 material], so you can pull `mesh.geometry` and `mesh.material` straight into an InstancedMesh.
- **Where to use it:** shelf stock, money piles at the register, crop fields. The player's back stack (≤ ~20 items, each tweening individually) is simpler as ordinary meshes.
- `BatchedMesh` is the alternative when one draw call has to cover *different* geometries (https://threejs.org/docs/pages/BatchedMesh.html). It isn't needed for an MVP.

### A3. HUD and UI: HTML/CSS overlay (recommended)

- Put a `<div id="hud">` absolutely positioned over the canvas, with `pointer-events: none` except on buttons. It holds the money counter, upgrade panels, the shop and the tutorial arrows. This is plain DOM, which is the most AI-friendly UI tech there is, and it gives crisp text and responsive layout for free.
- **World-anchored labels** (price-pad amounts, "+$5", customer emote bubbles) have two options:
  - (a) `CSS2DRenderer` (https://threejs.org/docs/pages/CSS2DRenderer.html). The docs call it a "simplified version of CSS3DRenderer" where "the only transformations that are supported are translation and 2D rotation", which is fine for labels.
  - (b) A `CanvasTexture` sprite or plane in the scene. This is better for **floor price pads**, because the text then lies flat on the ground under the isometric camera.
- Customer happy/angry bubbles can use Kenney Emotes Pack PNGs as sprites (section C).
- Don't build the UI in-canvas (in Babylon terms, GUI on an `AdvancedDynamicTexture`). It adds a layout system to learn with no benefit for this game.

### A4. Input: keyboard plus virtual joystick

- **Keyboard:** WASD/arrow keys through `keydown`/`keyup` into a `Set<string>`, normalised to a 2D vector. No library is needed.
- **Touch:** `nipplejs` 1.0.4, MIT. It ships `dist/index.d.ts` types [MEASURED], has 1.9k stars, offers `dynamic`/`static`/`semi` modes and multitouch, and fires `move` events carrying a `vector` (https://github.com/yoannmoinet/nipplejs). Use `mode: 'dynamic'` on a full-screen zone; that is the genre's floating joystick. The package was last published 2026-05-26 [MEASURED], so it is maintained.
- **Fallback:** a hand-rolled Pointer Events joystick is about 60 lines, if nipplejs is ever a problem.
- **Camera-relative input:** under an isometric camera, rotate the input vector by the camera's yaw (usually 45°) so that "up" on screen moves the character up the screen.

### A5. Tweening

- **`@tweenjs/tween.js` 25.0.0, MIT, 14.3M weekly downloads.** It is small (bundled with nipplejs at ~10 KB gz [MEASURED]) and has `Easing.*`, chaining and `Group` for update control (https://github.com/tweenjs/tween.js). Call `group.update(time)` in the game loop. It covers squash and stretch, arc throws (tween `t` and compute a parabola in `onUpdate`), coin fly-to-HUD and pop-in on unlock.
- **GSAP 3.15** is now **free, including commercial use**, under Webflow's "Standard no-charge license". It is **not OSI open source**: it forbids use in tools that compete with Webflow's no-code animation builder, and Webflow keeps the IP. It explicitly allows AI-generated code that uses it (https://gsap.com/standard-license). That's legally fine for a game, but tween.js is lighter and fully MIT, so GSAP isn't needed.
- **Alternative:** a ~30-line in-house `tween(from, to, duration, ease, onUpdate)` helper ticked by the game loop. This is often clearer for an AI agent than a library, and it avoids timing drift because everything runs on the same `dt`.

### A6. Orthographic camera follow

- Use `OrthographicCamera(-w/2, w/2, h/2, -h/2, near, far)`. "An object's size in the rendered image stays constant regardless of its distance from the camera" (https://threejs.org/docs/pages/OrthographicCamera.html).
- **Pattern:**
  1. Keep a fixed offset, e.g. `offset = (10, 14, 10)`, for about 45° yaw and about 45–55° pitch. True isometric pitch is 35.26°, but genre games look steeper.
  2. Each frame, set `camera.position.lerp(target.position + offset, 1 - exp(-k*dt))`, then call `camera.lookAt(target)`.
  3. On resize, recompute `left/right/top/bottom` from the aspect ratio and call `updateProjectionMatrix()`.
  4. Zoom with `camera.zoom`.
- **Camera pans to new unlocks:** tween the follow target to the unlock position and back.

### A7. Physics engine?

**Not needed.** Movement is a character on a flat floor. Use:
- circle (character) versus axis-aligned box (shelves, counters, walls) push-out
- circle versus circle for customers bumping each other
- trigger zones for pickup, drop and pay pads as distance or AABB checks

NPC navigation can follow a hand-authored waypoint graph (door → shelf slots → queue spots → register → door), or run A* on a coarse grid. No Rapier, cannon-es or Ammo is required. This matches the genre: the stacking "physics" is faked with tweens and spring-damped offsets (prior research, section 8).

### A8. Audio (brief)

- **`howler` 2.2.4, MIT.** Uses the Web Audio API with an HTML5 Audio fallback, supports sound sprites, and has an `unlock` event that "fires when audio has been automatically unlocked through a touch/click event" (https://github.com/goldfire/howler.js). Unlocking matters on iOS Safari.
- Three.js's own `AudioListener`/`Audio` also works, but adds nothing for 2D UI sounds.

### A9. Does Babylon.js meaningfully reduce work? **No.** Recommendation: Three.js.

| Need | Three.js | Babylon.js | Who wins for *this* game |
|---|---|---|---|
| glTF + skeletal anim | `GLTFLoader` + `AnimationMixer` | `ImportMeshAsync` + `AnimationGroup` built in (https://doc.babylonjs.com/features/featuresDeepDive/animation/groupAnimations) | Tie. Both are a few lines |
| Instancing | `InstancedMesh` | Thin instances (https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances) | Tie |
| HUD | HTML/CSS overlay | `@babylonjs/gui` in-canvas (https://doc.babylonjs.com/features/featuresDeepDive/gui/gui) | Three + HTML. DOM is easier for an AI agent and for the owner |
| Debugging | No official inspector; `lil-gui` ships in the three examples | Inspector (https://doc.babylonjs.com/toolsAndResources/inspector) | Babylon, but this is a dev-time convenience only |
| Physics, collisions | None (not needed) | Plugins, plus built-in `moveWithCollisions` | Irrelevant. Hand-written collision is ~50 lines |
| Bundle | **631 KB raw / 161 KB gz**: renderer, ortho camera, lights, GLTFLoader, SkeletonUtils, AnimationMixer, InstancedMesh [MEASURED] | **2.88 MB raw / 676 KB gz** for the equivalent tree-shaken ES6 scene; **3.02 MB / 709 KB gz** with GUI [MEASURED] (ES6 guidance: https://doc.babylonjs.com/setup/frameworkPackages/es6Support) | Three, about 4× smaller |
| AI-friendly material | 21.5M weekly npm downloads; 610 official examples; endless tutorials and Stack Overflow answers | 0.44M weekly; large Playground (https://playground.babylonjs.com/) and good docs | Three, roughly 48× the usage |

Measurement method: esbuild `--bundle --minify --format=esm`, then gzip -9, on minimal equivalent scenes using `three@0.186.1` and `@babylonjs/{core,loaders,gui}@9.29.0`. Babylon's side-effect imports (loader, PBR material) pull in a lot; more careful tree-shaking could shave some of that, so treat 4× as approximate.

**Verdict:** Babylon's batteries mostly duplicate things this game handles more simply. The HTML HUD beats in-canvas GUI, the game needs no physics, and both engines handle animation equally well. Its real win, the Inspector, does not offset a ~4× larger payload on mobile and far less code in the wild. **Use Three.js.**

---

## B. Deploy path: Vite + TS → GitHub Actions → GitHub Pages

### B1. Vite `base`

From https://vite.dev/guide/static-deploy.html (GitHub Pages section):

| Site type | URL | `base` |
|---|---|---|
| User or org site | `https://<USER>.github.io/` | `'/'` (the default) |
| Project site | `https://<USER>.github.io/<REPO>/` | `'/<REPO>/'` |

You can also use a relative base, `base: './'` (or `''`), which makes "all generated URLs … relative to each file" and needs `import.meta` support (https://github.com/vitejs/vite/blob/main/docs/guide/build.md, "Relative base"). This survives a repo rename or a custom domain, which makes it the safest choice for a static game.

### B2. Official workflow

`.github/workflows/deploy.yml`, adapted from Vite's guide (https://vite.dev/guide/static-deploy.html). The action versions match the latest releases [MEASURED via `api.github.com/repos/actions/*/releases/latest` on 2026-10-02: deploy-pages v5.0.1, upload-pages-artifact v5.0.0, configure-pages v6.0.0, checkout v7.0.1, setup-node v7.0.0]. Vite's own file pins commit SHAs; tags are shown here for readability.

```yaml
name: Deploy to Pages
on:
  push:
    branches: ['main']
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: 'pages'
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: './dist'
      - id: deployment
        uses: actions/deploy-pages@v5
```

**One-time repo setting:** Settings → Pages → Source = **GitHub Actions**. The job needs the `pages: write` and `id-token: write` permissions and the `github-pages` environment. If you split build and deploy into separate jobs, the deploy job needs `needs: build`; otherwise it "continuously searches for an artifact that hasn't been created" (https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

**Artifact rules** (https://github.com/actions/upload-pages-artifact):
- gzip tar of regular files only, with **no symlinks or hard links**
- 1 GB officially supported, 10 GB hard cap
- default name `github-pages`, retention 1 day
- **dotfiles are excluded by default** (`include-hidden-files: false`)

**Build caching:** `setup-node`'s `cache: 'npm'` caches the npm download cache, keyed on the lockfile (Vite example; https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching). Pick one package manager and commit its lockfile. If the agent uses pnpm, add `pnpm/action-setup` and `cache: 'pnpm'`.

### B3. Assets, caching and size

- **`.glb` is not in Vite's known asset types** [MEASURED: `KNOWN_ASSET_TYPES` in https://github.com/vitejs/vite/blob/main/packages/vite/src/node/constants.ts lists images, media, fonts, pdf, txt and webmanifest, but not glb or gltf]. Pick one approach:
  1. **`public/models/...` (recommended for Kenney packs).** Files are copied as-is and unhashed. Load them with `` `${import.meta.env.BASE_URL}models/mini-market/shelf-boxes.glb` ``. This keeps each GLB next to its external `Textures/colormap.png`.
  2. `import url from './shelf.glb?url'`, or add `assetsInclude: ['**/*.glb']`. Files get content hashes, which is good for caching, but only once the textures are embedded (https://vite.dev/guide/assets.html).
- `build.assetsInlineLimit` defaults to **4096 bytes**. Smaller imported assets become base64 data URLs (https://github.com/vitejs/vite/blob/main/docs/config/build-options.md). That's fine for icons; it doesn't affect `public/`.
- **Response headers** [MEASURED with `curl -I`]:
  - every response carries `cache-control: max-age=600` (10 minutes), an `etag` and `last-modified`
  - JS **and `.glb`** are served with `content-encoding: gzip` (e.g. https://threejs.org/examples/models/gltf/Soldier.glb, `content-type: model/gltf-binary`)
  - there is no brotli and no header control
  - consequences:
    - Hashed JS and CSS from Vite are safe.
    - Unhashed `public/` files can be stale for up to 10 minutes after a deploy, then revalidate by ETag. That's acceptable for a hobby game.
    - For strict cache-busting, add `?v=<build id>` to model URLs.
- **Size budget:** the Kenney assets this game needs total roughly **4–5 MB raw** [MEASURED]:
  - Mini Market GLBs + textures: 0.78 MB
  - all 12 Mini Characters: 3.0 MB (use 4–6 of them)
  - chick and cow: 0.25 MB
  - food items: 6–15 KB each

  The engine adds about 0.16 MB gz. That is far below the Pages limits from doc 01. Characters dominate the size, so load only the variants you use, and tint materials to vary customers.

---

## C. Free asset coverage

All Kenney facts below come from downloading the official zip from each `kenney.nl/assets/<slug>` page and reading `License.txt` (CC0 in every case) and the GLB JSON [MEASURED]. Each Kenney pack ships **GLB + FBX + OBJ**.

### C1. Packs

| Pack | URL | License | Formats | Animated | Style | What's relevant |
|---|---|---|---|---|---|---|
| **Kenney Mini Market** | https://kenney.nl/assets/mini-market | CC0 | GLB/FBX/OBJ (20 models) | `character-employee` only: the full Mini Characters animation set | Chunky "mini" toy style, single colormap atlas, grey/green palette | `shelf-boxes`, `shelf-bags`, `shelf-end`, `display-fruit`, `display-bread`, `cash-register`, `freezer`, `freezers-standing`, `shopping-cart`, `shopping-basket`, `bottle-return`, `floor`, `wall`, `wall-window`, `wall-door-rotate`, `wall-corner`, `column`, `fence`, `fence-door-rotate` |
| **Kenney Mini Characters** | https://kenney.nl/assets/mini-characters | CC0 | GLB/FBX/OBJ | **Yes, skinned.** 32 clips including `idle`, `walk`, `sprint`, `pick-up`, `holding-both`, `holding-left/right`, `interact-left/right`, `emote-yes/no`, `sit` | Same mini style | `character-female-a…f`, `character-male-a…f` (12), plus accessibility props. Use for player, customers and staff |
| **Kenney Cube Pets** | https://kenney.nl/assets/cube-pets | CC0 | GLB/FBX/OBJ (24 animals) | **Yes, node anims.** `idle`, `walk`, `run`, `eat`, `dance`, `gesture-positive/negative` | Cute cube animals, same rendering look | `animal-chick` (stands in for a chicken), `animal-cow`, `animal-pig`, `animal-bunny` |
| **Kenney Food Kit** | https://kenney.nl/assets/food-kit | CC0 | GLB/FBX/OBJ (200 models) | No | Kenney standard, colormap atlas | `egg`, `egg-half`, `carton`, `carton-small`, `bread`, `loaf*`, `bottle-ketchup`, `tomato`, `corn`, `apple`, `cheese`, `can`, `bag`, `barrel`, `soda*`, `cookie`, `cup-coffee`, `fish`, `burger` (covers later marts too) |
| **Kenney Nature Kit** | https://kenney.nl/assets/nature-kit | CC0 | GLB/FBX/OBJ (329 models) | No | Older flat-shaded style, material colours (no texture), teal/orange palette | `crops_cornStageA–D`, `crops_wheatStageA–B`, `crops_leafsStageA–B`, `crops_dirtRow*`, `crop_carrot/pumpkin/melon/turnip`, `fence_*` (simple, planks, gate, corner), `ground_grass`, `ground_path*`, `path_stone*`, `path_wood*`, many `tree_*` (default, oak, fat, simple, small, pine), `plant_bush*`, `log_stack`, `stump_*` |
| **Kenney Furniture Kit** | https://kenney.nl/assets/furniture-kit | CC0 | GLB/FBX/OBJ (140) | No | Kenney standard | `trashcan`, `kitchenBlender` (ketchup machine), `kitchenFridge*`, `kitchenBar` (counter), `cardboardBoxOpen/Closed`, `kitchenCoffeeMachine`, `toaster` |
| **Kenney Survival Kit** | https://kenney.nl/assets/survival-kit | CC0 | GLB/FBX/OBJ (80) | No | Kenney standard | `box`, `box-large`, `box-open` (crates), `bucket`, `barrel`, `fence`, `patch-grass`, `tree*`, `signpost` |
| **Kenney Platformer Kit** | https://kenney.nl/assets/platformer-kit | CC0 | GLB/FBX/OBJ | No | Kenney standard | `coin-gold`, `coin-silver`, `coin-bronze`, `crate`, `crate-item`, `chest`, `arrow`, `flag`, `sign` |
| Kenney Blocky Characters | https://kenney.nl/assets/blocky-characters | CC0 | GLB/FBX/OBJ (18) | Yes, node anims, same clip names as Mini Characters | Blockier, Minecraft-like | Alternative characters, about 114 KB each |
| Kenney Fantasy Town Kit | https://kenney.nl/assets/fantasy-town-kit | CC0 | GLB/FBX/OBJ (167) | No | Kenney standard | `stall*`, `cart`, `fence*`, `hedge*`, `planks`, `windmill`, `road*`: for building a coop, barn or market stall |
| **Quaternius Ultimate Crops** (a.k.a. Nature Crops Pack, Jan 2020) | https://quaternius.com/packs/ultimatecrops.html ; zip on https://opengameart.org/content/lowpoly-crops-pack | CC0 | **FBX/OBJ/Blend only, no glTF** [MEASURED: 102 each] | No | Faceted low-poly, muted naturalistic colours, realistic proportions | **`Tomato_1–4`**, `Tomato_Crop`, `Tomato_Harvested`; **`Apple_1–4`** (tree stages), `Apple_Crop`, `Apple_Harvested`; `Corn_1–4`; `Wheat_1–4`; plus lettuce, carrot, pumpkin, rice, orange and others |
| Quaternius Farm Animal Pack | https://quaternius.com/packs/farmanimal.html ; https://poly.pizza/bundle/Farm-Animal-Pack-1kUvRTPLzT | CC0 | FBX/OBJ/Blend on site; FBX/glTF on Poly Pizza | Yes ("run, idle, jump and walk") **[UNVERIFIED clip list; from summary]** | Quaternius smooth low-poly | Cow, Pig, Sheep, Horse, Llama, Pug, Zebra. **No chicken** |
| Quaternius Chicken (single models) | https://poly.pizza/m/ineV9pU5VL ; https://poly.pizza/m/Z3RCoCYss4 | CC0 | FBX/glTF | Poly Pizza reports them as animated **[UNVERIFIED: not downloaded]** | Quaternius | Fallback chicken if the Kenney chick reads too "baby" |
| Quaternius Ultimate Animated Animals | https://quaternius.com/packs/ultimateanimatedanimals.html ; https://poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS | CC0 | FBX/OBJ/glTF/Blend | Yes, 12+ clips | More realistic | Cow, Bull, Horse and others. No chicken |
| Quaternius Universal Base Characters + Universal Animation Library | https://quaternius.com/packs/universalbasecharacters.html ; https://quaternius.com/packs/universalanimationlibrary.html | CC0 | FBX/OBJ/glTF/Blend; library FBX/GLB/Blend | Yes, 120+ clips on a humanoid rig, retargetable | Realistic-proportion humans | Too realistic next to Kenney minis. Skip |
| **KayKit Restaurant Bits** | https://kaylousberg.itch.io/restaurant-bits | CC0 ("Free for personal and commercial use, no attribution required") | OBJ/FBX/glTF | No | Chunky, single 1024² gradient atlas; closest to Kenney mini | 140+ cooking and food models "in different states (raw/cooked/chopped)". Poly Pizza lists a KayKit "Crate of Tomatoes" (https://poly.pizza/search/tomato) **[UNVERIFIED exact contents]** |
| KayKit Furniture / City Builder / Prototype Bits | https://kaylousberg.itch.io/furniture-bits ; https://kaylousberg.itch.io/city-builder-bits ; https://kaylousberg.itch.io/prototype-bits | CC0 | OBJ/FBX/glTF | No | KayKit | 50+ / 32+ / 64+ models. Prototype Bits is handy for floor pads and arrows |
| KayKit Adventurers + Character Animations | https://kaylousberg.itch.io/kaykit-adventurers ; https://kaylousberg.itch.io/kaykit-character-animations | CC0 | FBX/glTF | Yes. 100+ (free tier "150+") clips on Rig_Medium, incl. idle, walk, run, tool and "simulation" emotes | KayKit chunky | **Fantasy characters (knight, mage…)**, so a poor fit for shoppers. No farm pack exists on the KayKit profile (https://kaylousberg.itch.io/) |
| Poly Pizza (aggregator) | https://poly.pizza | **Mixed: CC0 and CC-BY 4.0 per model.** Ex-Google-Poly models are typically CC-BY and need credit as "[Title] by [User] (poly.pizza) CC-BY 4.0" (https://github.com/jasonkneen/tiny-world-builder/blob/main/.agents/skills/poly-pizza-api/SKILL.md) **[UNVERIFIED: secondary source]** | GLB/glTF/FBX per model | Some | Mixed | Use it to download Quaternius and KayKit models as glTF. Check each model's license badge |

**2D UI packs (all CC0, PNG and some SVG)** [MEASURED]:

| Pack | Files | Useful icons |
|---|---|---|
| Kenney Game Icons (https://kenney.nl/assets/game-icons) | 425 PNG | `shoppingCart`, `shoppingBasket`, `cart`, `locked`/`unlocked`, `star`, `trophy`, `gear`, `plus`, arrows |
| Kenney Board Game Icons (https://kenney.nl/assets/board-game-icons) | 513 PNG + 256 SVG | `dollar`, `lock_open`/`lock_closed`, arrows |
| Kenney Emotes Pack (https://kenney.nl/assets/emotes-pack) | 513 PNG | `emote_cash`, `emote_faceHappy`, `emote_faceAngry`, `emote_heart`, `emote_star`: customer bubbles |
| Kenney UI Pack (https://kenney.nl/assets/ui-pack) | 870 PNG + 434 SVG | buttons, panels, arrows, stars, and the `Kenney Future` font |

### C2. Coverage by need

| Need | Best CC0 source | Status |
|---|---|---|
| Tomato plant (planted → grown) | Quaternius `Tomato_1–4` (FBX, needs conversion) | **Style mismatch.** Alternatively build it procedurally: green cone or sphere bush plus Kenney Food `tomato` instances that scale in as it grows |
| Wheat stages | Kenney Nature `crops_wheatStageA/B` (+ Quaternius `Wheat_1–4`) | Covered (2 stages; use scale-in for a third) |
| Corn stages | Kenney Nature `crops_cornStageA–D` | Covered |
| Apple tree stages | Quaternius `Apple_1–4` | Mismatch. Alternatively use a Kenney Nature `tree_default`/`tree_oak` with Food `apple` instances in the canopy, scaling up over time |
| Chicken (animated) | Kenney Cube Pets `animal-chick` (`idle/walk/eat`) | Covered; it's a chick, so fine for a cute style. Fallback: Quaternius Chicken on Poly Pizza |
| Cow (animated) | Kenney Cube Pets `animal-cow` | Covered |
| Shelves | Mini Market `shelf-boxes`, `shelf-bags`, `shelf-end`, `display-fruit`, `display-bread` | Covered. Place product instances on the shelf decks |
| Checkout counter + register | Mini Market `cash-register`; counter from Furniture `kitchenBar` or a box primitive | Mostly covered |
| Fridge (milk) | Mini Market `freezer`, `freezers-standing`; Furniture `kitchenFridge*` | Covered |
| Eggs, milk, bread, ketchup | Food Kit `egg`, `carton`, `bread`/`loaf`, `bottle-ketchup` | Covered |
| Crates | Survival `box*`, Platformer `crate`, Furniture `cardboardBox*` | Covered. "Crate full of X" means crate plus instanced items |
| Trash bin | Furniture `trashcan` | Covered |
| Ketchup machine | Furniture `kitchenBlender` (scale up) | Stand-in |
| Player, customers, staff | Kenney Mini Characters (12) + Mini Market `character-employee` | **Covered, with carry** (`holding-both` + filtered `walk`) |
| Ground, paths, fences, trees | Mini Market `floor`/`fence`; Nature `ground_*`, `path_*`, `fence_*`, `tree_*` | Covered |
| Coins | Platformer `coin-gold/silver/bronze` | Covered |
| Money stacks / bills | none | **Gap.** Procedural: thin green `BoxGeometry` bills via `InstancedMesh` in a grid pile |
| UI icons | Game Icons, Board Game Icons, Emotes, UI Pack | Covered |

### C3. Style compatibility

- **Compatible core:** Kenney Mini Market + Mini Characters + Cube Pets share the same chunky "mini" toy proportions and atlas-texture shading. I checked their preview renders side by side. Food Kit, Furniture, Survival and Platformer are Kenney's standard style, which sits comfortably next to them. Rescale props, since the minis are small.
- **Slight outlier:** Kenney Nature Kit is older, flat-coloured with no texture, and uses a teal/orange palette. Use its geometry and **override materials** with your palette (grass green, wood brown).
- **Clashes:** Quaternius Crops are faceted, naturalistic and muted; they read as a different game next to Kenney minis. Use them only if recoloured and simplified, or replace them with procedural plants. Quaternius and KayKit characters also differ in proportion from Kenney minis, so don't mix character sources.
- **KayKit props** (Restaurant Bits) are close enough to Kenney to mix if needed.
- **Unifying trick:** use the same lighting for everything (one hemisphere light plus one directional light with soft shadows), and optionally `MeshToonMaterial` or a shared palette pass. That smooths over most style differences.

### C4. Gaps to build procedurally from primitives

1. **Money bills and stacks:** green boxes with a lighter band, instanced, plus a pile layout function.
2. **Floor price pads and unlock zones:** a ring or rounded square (`RingGeometry`/`ShapeGeometry`) with a radial fill progress driven by a shader or `drawRange`, plus a `CanvasTexture` price label.
3. **Tomato plant and apple tree growth stages:** primitive bush or Kenney tree plus instanced fruit that scale in.
4. **Chicken coop and cow pen:** Nature `fence_*` ring + Fantasy Town `planks`/`roof` + a box hutch; or a simple box-and-roof primitive.
5. **Ketchup and processing machines:** a box body + cylinder hopper + output tray; or scale up the Furniture blender.
6. **Customer queue markers, tutorial floor arrows, stack-limit "MAX" label:** planes with icon textures from the Kenney 2D packs.
7. **Worker role visuals:** tint Mini Character materials, or attach a primitive hat or apron.

---

## D. CC0 sound effects and music

### D1. Kenney audio (all CC0, OGG; contents verified from the downloaded zips [MEASURED])

| Pack | URL | Files | Genre-relevant sounds |
|---|---|---|---|
| Interface Sounds | https://kenney.nl/assets/interface-sounds | 100 | `pluck_*`, `drop_*`, `click_*`, `confirmation_*`, `tick_*`, `bong_*`, `glass_*`, `select_*`: **pickup pops**, unlock confirm, pay-tick |
| RPG Audio | https://kenney.nl/assets/rpg-audio | 52 | **`handleCoins*`** (coin pickup and cash collect), `metalClick`, `cloth` |
| Casino Audio | https://kenney.nl/assets/casino-audio | 55 | **`chips-stack*`, `chips-collide*`, `chips-handle*`, `chip-lay*`**: stacking money, paying into pads |
| Impact Sounds | https://kenney.nl/assets/impact-sounds | 130 | `impactSoft_*`, `impactPlate_light_*`, `impactWood_light_*` (dropping items on shelves), `footstep_*` |
| UI Audio | https://kenney.nl/assets/ui-audio | 52 | `click*`, `rollover*`, `switch*` |
| Digital Audio | https://kenney.nl/assets/digital-audio | 63 | `powerUp*`, `highUp`, `threeTone*`, `pepSound*`: level-up and unlock stingers |
| Music Jingles | https://kenney.nl/assets/music-jingles | 86 | short `jingles_PIZZI/STEEL/SAX/NES/HIT` stingers for unlocks or a new mart. **No looping background music** |

Kenney has **no cash-register "ka-ching"**. Get one from Freesound, or layer `handleCoins` with a bell `impactBell_heavy`.

### D2. Other CC0 sources

- **Freesound with the CC0 filter.** Search for cash register: https://freesound.org/search/?q=cash+register&f=license:%22Creative+Commons+0%22. Top results:
  - "cash register.mp3" by SoundCollectah: https://freesound.org/people/SoundCollectah/sounds/108278/
  - "cash register.wav" by cognito perceptu: https://freesound.org/people/cognito%20perceptu/sounds/83915/
  - "cash register.wav" by sidequesting: https://freesound.org/people/sidequesting/sounds/542568/
  - "cash register beep sound.wav" by videofueralle: https://freesound.org/people/videofueralle/sounds/455397/
  - "old adding machine mechanism like toy cash register drawer" by kyles: https://freesound.org/people/kyles/sounds/637735/

  These come from the CC0-filtered listing. **Re-check each sound's license badge before use [UNVERIFIED per sound].** The same filter works for "coin", "pop" and "chicken" / "cow moo" (animal sounds).
- **jsfxr** (https://sfxr.me/): browser sfxr with presets including **Pickup/Coin**, Powerup and Blip/Select. The library is under the Unlicense (public domain), and the page states generated sounds allow "unrestricted commercial use". It can also run as a JS library at runtime. Good for pitch-rising pay ticks generated on the fly.
- **OpenGameArt CC0 music collections** (curated lists of CC0 tracks; verify each track's page):
  - "CC0 - Upbeat / Electronic Music", curated by josepharaoh99: https://opengameart.org/content/cc0-upbeat-electronic-music. Includes "Bouncy Hamster Dancing", "Catchy", "Tropical Loop", "Short Plingy Loop", "Raspberry Jam" **[UNVERIFIED track details; from summary]**
  - "CC0 - Calm / Relaxing Music": https://opengameart.org/comment/111930
  - "CC0 - Retro Music": https://opengameart.org/content/cc0-retro-music
- **Avoid assuming CC0:** Kevin MacLeod/incompetech is CC-BY. Pixabay uses its own content license, not CC0 **[UNVERIFIED in this pass]**. Poly Pizza and OpenGameArt are mixed-license per item. Keep a `CREDITS.md` regardless; it's good practice even for CC0.

### D3. Suggested mapping

| Event | Sound |
|---|---|
| item pickup | Interface `pluck_*` / `drop_*` with ±10% random pitch |
| item placed on shelf | Impact `impactSoft_*` |
| coin/cash collect | RPG `handleCoins*` or Casino `chips-stack*` |
| customer pays | Freesound CC0 cash register |
| paying into an unlock pad | jsfxr blip with rising pitch per tick |
| unlock | Digital `powerUp*` + Jingles `jingles_PIZZI*` |
| animals | Freesound CC0 cluck and moo |
| background | one OpenGameArt CC0 loop at low volume |
