# Performance limits for a Three.js phone game

Researched 2026-10-02 for ticket 15. This builds on `02-tech-stack-and-assets.md` and does not repeat it: engine choice, the 161 KB gz Three.js bundle, GitHub Pages gzip and `max-age=600`, InstancedMesh basics and the Kenney asset list are all covered there.

Labels: **[MEASURED]** means I downloaded the file or source and checked it locally. **[UNVERIFIED]** means the claim has only one source, comes from a secondary write-up, or is my own inference.

---

## Key takeaways

1. **Nobody publishes per-game draw-call or triangle numbers for comparable web idle games.** I found no Poki, CrazyGames or Three.js postmortem with real figures. The usable numbers are maintainer and GPU-vendor rules of thumb. The best-known one is Don McCurdy's (three.js maintainer): **"Aim for something like <100 draw calls and <100,000 vertices if you can."** Arm's GPU guide puts the OpenGL ES ceiling at **under 500 draw calls per frame**.
2. **The draw-call budget goes on characters and shadows, not on items.** Each Kenney Mini Character is **2 skinned meshes** (body and head) [MEASURED]. Skinned meshes can't be instanced or merged at runtime, so 17 characters cost **34 draw calls, and another 34 if they cast shadows**. Shelves are also expensive unless merged: `shelf-boxes.glb` has **11 meshes** but one shared material [MEASURED].
3. **Triangles are not a problem.** A character is about **730 triangles**, a shelf 360–890, and a tomato 132 [MEASURED]. A full store with 17 characters and a few hundred items comes to roughly 60–90k triangles. The thing to watch is instanced item vertices, since 300 tomatoes is 74k vertices.
4. **Pixel ratio is the biggest single cost on phones.** The three.js manual notes that a 3× display means **9× the pixels**. Cap the ratio at 2.
5. **Shadows:** each shadow-casting light renders every caster again. Use one directional light, the default `PCFShadowMap` with `shadow.radius` (`PCFSoftShadowMap` has been deprecated since r182), a tight frustum, and a 1024 map on phones.
6. **Download size is far under every platform limit.** The gzip-on-the-wire total for this game is about **0.6–0.9 MB** [MEASURED/estimated]. Compare Poki's guidance of 5 MB initial and 8 MB total, and CrazyGames' 20 MB mobile cap. On Lighthouse's "Slow 4G" profile (1.6 Mbps) 0.8 MB takes about 4–5 s. Poki's line is that players leave after **10 s**.
7. **Enforce the budget with `size-limit` + `@size-limit/file` using `gzip: true`.** Vite's own `chunkSizeWarningLimit` only warns, never fails, and it measures uncompressed size.

---

## 1. Rendering budgets on phones

### 1.1 Draw calls

| Source | Figure | Notes |
|---|---|---|
| Don McCurdy, three.js maintainer (https://discourse.threejs.org/t/bad-performance-when-loading-more-than-3500-meshes-into-the-scene/63960/4) | "<100 draw calls and <100,000 vertices if you can" | A forum rule of thumb, not a benchmark |
| Arm GPU Best Practices Developer Guide 3.4, §"Draw call batching" (https://documentation-service.arm.com/static/67a62b17091bfc3e0a947695) | "For OpenGL ES, aim for fewer than 500 draw calls per frame. For Vulkan, aim for fewer than 1000." The guide calls these "approximate guidelines" because CPU performance varies by chipset | WebGL on Android runs on GLES. The guide also says "Use batches, even if not CPU-limited, to reduce system power consumption" |
| discoverthreejs.com tips (https://discoverthreejs.com/tips-and-tricks/) | "fewer draw calls = better performance"; "Use geometry instancing when you have hundreds or thousands of similar geometries" | Written by a former three.js contributor. No numbers |
| Secondary blogs (utsubo.com "100 Three.js tips", digitalstrategyforce.com) | "~0.1 ms CPU per draw call on mobile", "under ~100–150 draw calls on mid-range" | **[UNVERIFIED]** No measurement method given |

**How to measure:** `renderer.info.render.calls` and `.triangles` (https://threejs.org/docs/pages/WebGLRenderer.html). In WebGLRenderer, `info.reset()` runs before `shadowMap.render()` inside `render()` (`src/renderers/WebGLRenderer.js` around lines 1744–1750 on `dev`) [MEASURED from source]. So **the reported counts include the shadow pass**, and the budget below counts both passes.

**Estimated draw calls for this game** (inferred from the measured mesh counts) [UNVERIFIED]:

| Thing | Naive | After the fixes in §3 |
|---|---|---|
| 17 skinned characters (2 meshes each) | 34 | 34 |
| …the same characters in the shadow pass | 34 | 0–1 (blob shadows: one instanced quad) |
| Static store: about 10 shelves × 8–11 meshes, plus walls, floor, register | 100+ | 1–3 (merged per material; Kenney packs use one `colormap` material per pack) |
| …static casters in the shadow pass | 100+ | 1–3 |
| Items: one InstancedMesh per product type | 6–10 | 6–10 |
| Money stacks (instanced) | 1–2 | 1–2 |
| Price pads and labels (one plane each) | 10–20 | 10–20, or 0 if drawn as HTML overlays |
| **Total** | **~300** | **~55–75** |

Unoptimised, the scene is still below Arm's 500 ceiling, but it is 3× McCurdy's 100.

### 1.2 Triangles and vertices

Measured from the GLB JSON accessors in the official Kenney zips [MEASURED]:

| Asset | Meshes | Triangles | Vertices |
|---|---|---|---|
| `character-male-a` (Mini Characters) | 2 skinned (7 joints each), 32 clips | 723 | 1,259 |
| `character-employee` (Mini Market) | 2 skinned | 520 | 890 |
| `shelf-bags` / `shelf-boxes` / `shelf-end` | 9 / 11 / 8 | 892 / 436 / 362 | 1,308 / 856 / 690 |
| `display-fruit` | 1 | 650 | 1,192 |
| `cash-register` | 1 | 203 | 361 |
| `tomato` (Food Kit) | 1 | 132 | 248 |
| `wall` / `floor` | 1 | 32 / 24 | 54 / 46 |

- 17 characters come to about 12k triangles. Fifteen shelves and displays come to about 10k.
- A money bill (`BoxGeometry`) is 12 triangles and 24 vertices, so 500 bills is 12k vertices.
- **Instanced items are what grow.** Every on-shelf tomato is 248 vertices, so a full store with 300 visible items is about 75k vertices. Shadow casting doubles vertex work for casters.
- Arm's triangle-density rule is "Use models that create at least 10–20 fragments per primitive" (§5.8, same PDF). From a ~20 m-tall ortho view on a phone, a tomato is a few dozen pixels across with 132 triangles. That is close to the micro-triangle zone. Inferred: if items get dense, a lower-poly stand-in for shelf stock (e.g. a 12-tri box with the colormap) is the lever [UNVERIFIED].

### 1.3 Pixel ratio

- three.js manual, "Responsive" (https://github.com/mrdoob/three.js/blob/dev/manual/pages/responsive.html): "phones have an HD-DPI ratio of 3x … they have to do 9x the rendering … For any heavy three.js app that's probably what you want [render at 1x] otherwise you're likely to get a slow framerate."
- The same page has a section "Limiting maximum drawing buffer size". Its example caps total pixels at `maxPixelCount = 3840*2160`, because fractional OS scaling "may lead to excessive GPU load, lower frame rates and high power consumption."
- discoverthreejs: "devices have high pixel ratios as high as 5 — consider limiting the max pixel ratio to 2 or 3."
- Lighthouse's reference phone (Moto G Power 2022) is emulated at `deviceScaleFactor: 1.75` and 412×823 CSS px (`core/config/constants.js`, https://github.com/GoogleChrome/lighthouse) [MEASURED from source].
- Arm on MSAA: "Use 4x MSAA because it is not expensive and provides good image quality improvements" (§7.4) on tile-based mobile GPUs. So `antialias: true` at DPR 1.5–2 is usually cheaper than rendering at DPR 3 without AA [UNVERIFIED: inference from Arm's general guidance; not measured in WebGL].

### 1.4 Shadows

- The three.js manual, "Shadows" (https://github.com/mrdoob/three.js/blob/dev/manual/pages/shadows.html), explains that "for every light that casts shadows all objects marked to cast shadows are rendered from the point of view of the light … with 5 lights … your entire scene will be drawn 6 times". It continues: "One common solution is to have multiple lights but only one directional light generating shadows," and suggests fake blob shadows (a plane with a grayscale texture).
- Defaults in `src/lights/LightShadow.js` [MEASURED from source]: `mapSize` 512×512, `radius` 1, `blurSamples` 8, `autoUpdate` true.
- Shadow type: the migration guide entry for r181→r182 says "`PCFSoftShadowMap` with `WebGLRenderer` is now deprecated. Use `PCFShadowMap` which is now soft as well." In r185→r186 it was removed from WebGPURenderer (https://github.com/mrdoob/three.js/wiki/Migration-Guide). The current `WebGLShadowMap.js` warns and falls back to PCF [MEASURED from source]. **So for "soft shadows", use the default `PCFShadowMap` and tune `light.shadow.radius`.**
- discoverthreejs: "Make the shadow frustum as small as possible", "Make the shadow texture as low resolution as possible", "If your scene is static, only update the shadow map when something changes" (`shadowMap.autoUpdate = false` + `needsUpdate = true`, per the WebGLRenderer docs). Characters move every frame, so a shadow map that includes them can't be static. The split in §3 (baked or static store shadow, blob shadows for movers) avoids per-frame shadow cost.
- Texel density (my arithmetic): a 1024 map over a ~30 × 30 m shadow frustum gives about 3 cm per texel. That is plenty for 1 m-tall low-poly characters.

### 1.5 What "low- and mid-range phone" means in practice

- Lighthouse's mobile profile is the de-facto web baseline. It uses a Moto G Power 2022 user agent, a 4× CPU slowdown that "moves a typical run in the high-end desktop bracket somewhere into the mid-tier mobile bracket", and "Slow 4G": **150 ms RTT, 1.6 Mbps down / 750 Kbps up**. Google describes that as "roughly the bottom 25% of 4G connections and top 25% of 3G" (https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md).
- Alex Russell's "Performance Inequality Gap, 2026" (https://infrequently.org/2025/11/performance-inequality-gap-2026/) models a 75th-percentile device and network. Its budgets for a 3 s load are about 2.0 MiB total (0.3 MiB JS) for JS-light pages; for 5 s, about 3.7 MiB total. **[UNVERIFIED]** The page timed out on every fetch; these figures come from the search-result excerpt only.
- No GPU-tier data exists for WebGL games specifically. Test on a real device: a ~2020–2022 budget Android (Adreno 6xx / Mali-G5x class) is the realistic floor [UNVERIFIED].

---

## 2. Download size and load time players tolerate

| Source | Figure |
|---|---|
| Poki, "Choosing your web game engine" (https://developers.poki.com/guide/web-engine) [MEASURED from page HTML] | "for a good web game the initial download should not exceed **5MB and 8MB in total**." It also gives "The file size of a compressed Three.js project is 151KB … 122kb by using Brotli." |
| Poki, "Requirements" (https://developers.poki.com/guide/requirements-quality) | "Players tend to move to another game if loading takes **more than 10 seconds**, and they load from everywhere in the world." It recommends progressive loading |
| CrazyGames, technical requirements (https://docs.crazygames.com/requirements/technical/) | Initial download **≤ 50 MB**; **≤ 20 MB to be eligible for the mobile homepage**; total ≤ 250 MB; ≤ 1,500 files; for externally hosted content, "time it takes to reach gameplay (≤ 20 seconds)" |
| web.dev LCP (https://web.dev/articles/lcp) | Good is ≤ 2.5 s and poor is > 4 s, measured at the 75th percentile, mobile and desktop separately. That is a web-page metric, not a game metric, but it is the closest primary "tolerance" number Google publishes |

**This game's payload** [MEASURED unless noted]:

| Part | Raw | gzip -9 (what Pages sends) |
|---|---|---|
| Three.js + loader + SkeletonUtils + mixer (from doc 02) | 631 KB | 161 KB |
| nipplejs + tween.js (doc 02) | — | ~10 KB |
| Game code | — | ~30–80 KB [UNVERIFIED estimate] |
| One Mini Character GLB | 247 KB | **35 KB** (the GLB is mostly JSON accessors and 32 animation clips, which compress 7×) |
| All 12 Mini Characters | 3.04 MB | 445 KB (so 6 characters ≈ 220 KB) |
| All 20 Mini Market GLBs | 788 KB | 125 KB |
| `colormap.png` (per pack) | 8.7 KB | 8.3 KB (PNG doesn't gzip) |
| Audio (Kenney OGG, ~10 clips) | — | ~100–300 KB [UNVERIFIED estimate] |
| **Total** | ~4–5 MB | **~0.6–0.9 MB** |

On Slow 4G (1.6 Mbps ≈ 200 KB/s) that is about 3–5 s of transfer plus a handful of 150 ms round trips, all under Poki's 10 s. Characters don't need Draco or Meshopt. Stripping unused clips from the GLB saves little after gzip: animation buffers are about 25% of a character's binary [MEASURED].

Caching note: Pages' `max-age=600` means a repeat visitor after 10 minutes revalidates every file (304s). Hashed Vite filenames don't help with that header. With ~40 files, that costs extra round trips, not bytes [UNVERIFIED inference].

---

## 3. Techniques that hit the budget (all three.js core or addons)

1. **Merge static store geometry per material** with `BufferGeometryUtils.mergeGeometries` (`three/addons/utils/BufferGeometryUtils.js`). Every Kenney pack uses one `colormap` material, so the whole static store collapses to one draw per pack. Rebuild the merge when an expansion unlocks.
2. **One `InstancedMesh` per item type and one for money** (doc 02). Keep `.count` at the visible number.
3. **Characters:** 2 draws each is unavoidable without offline work. Options:
   - accept 34 draws
   - merge head and body into one skinned mesh in Blender or gltf-transform [UNVERIFIED: not tried]
   - on phones, set `castShadow = false` and draw blob shadows as a single `InstancedMesh` of dark circles
4. **Shadows:** one `DirectionalLight` with `castShadow`. Fit the ortho shadow camera to the visible area and move it with the camera target. Use `mapSize` 1024 on phones and 2048 on desktop, the default `PCFShadowMap`, and `shadow.radius` 2–4. Floors only receive shadows.
5. **Pixel ratio:** `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`. Optionally step down to 1.5 and then 1 if the average frame time stays above ~20 ms. That adaptive step is my suggestion, not from a source [UNVERIFIED].
6. **HUD, price labels and money counters in HTML/CSS**, not as canvas-texture planes. Each plane is a draw call.

---

## 4. Enforcing a bundle-size budget in Vite CI

- **Vite's built-in setting only warns.** `build.chunkSizeWarningLimit` defaults to **500 kB** and "is compared against the uncompressed chunk size" (https://github.com/vitejs/vite/blob/main/docs/config/build-options.md). The minified Three.js chunk alone is about 631 KB raw, so it will warn. Raise the limit to around 800 or move three into its own chunk; either way the setting never fails a build. `build.reportCompressedSize` (default true) prints gzip sizes in the build log.
- **`size-limit` 14.1.0** (MIT, published 2026-09-27; https://github.com/ai/size-limit) fails CI when a limit is exceeded. Use `@size-limit/file` alone for a prebuilt app:
  - `path` accepts globs and arrays with `!` excludes; `limit` takes forms like `"250 kB"` or `"1 s"`
  - `gzip: true` switches from the default Brotli to gzip, which is what GitHub Pages serves
  - `brotli: false` measures raw size
  - the file plugin just streams each matched file through zlib, so it works for **GLB, PNG and OGG too**, not only JS [MEASURED from `packages/file/index.js`]
  - `@size-limit/preset-app` adds the `time` plugin, which runs headless Chrome. It defaults to "slow 3G (50 kB/s) without latency", and `networkSpeed` / `latency` are configurable per check. It's optional and heavier in CI
- **`andresz1/size-limit-action@v1`** (v1.8.0, last release 2024-04) posts a size-diff comment on each PR, using `github_token`, `build_script` and `skip_step`. It's convenient but stale. A plain `npx size-limit` step after `vite build` is enough to fail the job.
- `bundlesize` (0.18.2, last published 2024-03) is effectively unmaintained. Prefer size-limit.
- Seeing what's inside a chunk: `rollup-plugin-visualizer` 7.1.1 or `vite-bundle-analyzer` 1.3.9 (both MIT). These are for diagnosis only, not enforcement.

Example `.size-limit.json` (paths assume Vite's default `dist/assets/` plus models in `public/models/`):

```json
[
  { "name": "JS (initial)", "path": "dist/assets/*.js", "gzip": true, "limit": "250 kB" },
  { "name": "Models + textures", "path": ["dist/models/**/*.glb", "dist/models/**/*.png"], "gzip": true, "limit": "600 kB" },
  { "name": "Audio", "path": "dist/audio/**/*", "brotli": false, "limit": "400 kB" },
  { "name": "Everything", "path": "dist/**/*", "gzip": true, "limit": "1.2 MB" }
]
```

CI step: `npm run build && npx size-limit`. It exits non-zero on any breach. Note that OGG is already compressed, so gzip on it is meaningless.

**Runtime budgets** (draw calls, triangles) can't be checked by size-limit. The cheapest enforcement is a dev-only overlay showing `renderer.info.render.calls` / `.triangles`, plus an `assert`-style console warning when the count passes the budget. A Playwright CI check that loads a "full store" debug scene and reads `renderer.info` is possible, but CI GPUs are software-rendered, so only the counts mean anything there, not the timings [UNVERIFIED].

---

## 5. Recommended starting budget (owner to accept or change)

| Budget | Phone (target: ~2021 mid-range Android, Lighthouse Slow 4G) | Desktop | Basis |
|---|---|---|---|
| Frame rate | 60 fps target, 30 fps floor | 60 fps | — |
| Draw calls per frame (incl. shadow pass, from `renderer.info`) | **≤ 100** | ≤ 300 | McCurdy <100; Arm GLES <500 |
| Rendered triangles per frame (incl. shadow pass) | **≤ 150k** (vertices in scene ≤ 100k) | ≤ 500k | McCurdy <100k vertices |
| Pixel ratio | `min(dpr, 2)`, adaptive down to 1 | `min(dpr, 2)` | three.js manual; discoverthreejs |
| MSAA | on | on | Arm: 4x MSAA "not expensive" |
| Shadow-casting lights | 1 directional | 1 directional | three.js manual |
| Shadow map | 1024², `PCFShadowMap`, radius ~3; characters use blob shadows | 2048², characters cast real shadows | LightShadow defaults; r182 migration |
| Skinned characters on screen | ≤ 17 (2 draws each) | same | Game design |
| Initial JS (gzip) | **≤ 250 kB** | same | Measured 171 kB for libs; leaves ~80 kB for game code |
| Total first-load transfer (gzip) | **≤ 1.2 MB** | same | Measured ~0.6–0.9 MB; ≈ 6 s on Slow 4G worst case |
| Time to playable | **≤ 5 s** on Slow 4G profile, never > 10 s | ≤ 2 s on broadband | Poki 10 s; web.dev LCP 2.5/4 s |
| CI enforcement | `size-limit` + `@size-limit/file`, `gzip: true`, fails build | same | size-limit README |

All of these sit far below the platform caps (Poki 5 MB initial, CrazyGames 20 MB mobile). If portal distribution ever becomes a goal, the size budget won't block it.

---

## Open questions

- No real-device frame-time data exists yet. The first prototype should log `renderer.info` and the average frame ms on one actual low-end Android and one iPhone before these numbers are locked.
- Whether merging Kenney head and body skins into one SkinnedMesh works cleanly (it would halve character draws) is untested.
- I couldn't fetch the Russell 2026 budget table directly.
