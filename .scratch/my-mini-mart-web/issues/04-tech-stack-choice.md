# Choose the rendering library and toolchain

Type: grilling
Status: resolved
Blocked by: 02

## Question

Which 3D library (Three.js / Babylon.js / other), build tool, and deploy pipeline do we commit to, and what is the asset format/pipeline (e.g. glTF from packs)?

## Answer

Resolved 2026-10-02 (grilling). Builds on `research/02-tech-stack-and-assets.md`.

- **3D library:** Three.js (~4× smaller than Babylon, far more example code).
- **Language/build:** TypeScript with `strict: true`, Vite.
- **Package manager:** npm, lockfile committed.
- **Deploy:** Vite's official GitHub Actions → Pages workflow, deploy on every push to `main`; Vite `base: './'`. Repo is **public** (free Pages requirement) — owner OK with that.
- **3D assets:** GLB only, one folder per pack under `public/models/<pack>/`, loaded by path (keeps Kenney's same-named `colormap.png` per pack). Non-GLB sources converted to GLB offline before committing. No texture embedding/hashing step.
- **Helper libraries:** `nipplejs` (touch joystick), `howler` (audio, iOS unlock), in-house tween helper driven by the game clock (no tween.js).
- **UI:** HTML/CSS overlay over the canvas. **Preact** for interactive panels (Office upgrades, Stocker assignment, settings, menus); plain DOM updated directly for per-frame bits (Money counter, Completion %, popups). Pad price labels rendered in-scene, flat on the floor. Preact stays in the UI layer — game/sim code never depends on it. Decided now so no later UI rewrite.
- **Physics:** none. Hand-written collision: circle-vs-box push-out, circle-vs-circle, distance checks for proximity triggers.
