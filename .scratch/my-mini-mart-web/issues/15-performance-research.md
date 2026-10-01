# Research performance limits for a Three.js phone game

Type: research
Status: resolved
Blocked by: —

## Question

What do comparable Three.js / web arcade-idle games achieve on low- and mid-range phones (draw calls, triangle counts, shadow cost, instancing, pixel-ratio caps), what download size and load time do players tolerate on mobile web, and how do teams enforce a bundle-size budget in a Vite CI?

Findings: `.scratch/my-mini-mart-web/research/15-performance.md`.

## Answer

Resolved 2026-10-02 (research subagent). Findings: `research/15-performance.md` (§5 is a proposed budget for the owner to accept or change in [Set the performance budget](16-performance-budget.md)).
- No comparable web game publishes draw-call/triangle figures; limits come from three.js maintainer and Arm guidance: phones **<100 draw calls**, **<100k vertices** (Arm GLES ceiling ~500 calls). `renderer.info` counts include the shadow pass.
- Biggest cost is characters: Kenney Mini Character = 2 skinned meshes, ~730 tris [MEASURED]; 17 on screen = 34 draws (68 if shadow-casting). Merging the static store per pack material cuts ~300 → ~60 draws.
- Pixel ratio `min(dpr, 2)`; `PCFSoftShadowMap` deprecated since r182 → `PCFShadowMap` + `shadow.radius`; 1024² map on phones, blob shadows for characters.
- Download: whole game ~0.6–0.9 MB gzip (one character 247 KB raw / 35 KB gzip). Poki: 5 MB initial, players leave after ~10 s; CrazyGames: 20 MB mobile.
- CI: `size-limit` 14.1 + `@size-limit/file`, `gzip: true` fails the build; Vite's `chunkSizeWarningLimit` only warns. Runtime counts need a dev overlay (CI GPUs are software-rendered).
- Proposed: 250 kB JS gzip, 1.2 MB total, playable ≤5 s on Lighthouse Slow 4G; 60 fps target / 30 floor on a ~2021 mid-range Android.
- Open: no real-device frame data yet; merging Kenney head+body skins untested.
