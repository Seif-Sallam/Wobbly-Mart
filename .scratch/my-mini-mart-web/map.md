# Map: My Mini Mart — web clone

Label: wayfinder:map

## Destination

A build-ready spec for a browser clone of My Mini Mart: same mechanics, own name & assets, 3D low-poly with a fixed isometric camera, TypeScript, static on GitHub Pages, local-browser saves — one complete map, built on a reusable template for future maps.

## Notes

- Domain: game design + web game engineering. Personal project, shared with friends, no monetization.
- **Minimal code:** never duplicate or add redundant code; push back when something already exists. Practices in [Define project practices](issues/09-project-practices.md).
- Owner play-tests and decides; Claude writes all code. Owner has no JS/TS experience — explain tech choices in plain terms. Good/bad practices are defined as we go.
- Desktop (keyboard) takes precedence; mobile (touch joystick) also supported.
- Hosting: GitHub Pages preferred, another static host only if Pages blocks us. No backend at all.
- Art: free (ideally CC0) asset packs as much as possible; low-poly 3D under a fixed isometric camera ("2.5D").
- Every session: use `/grilling` + `/domain-modeling` for grilling tickets; `/prototype` for prototype tickets; `/research` subagents for research tickets. Glossary lives in `/CONTEXT.md`.
- Research findings live in `.scratch/my-mini-mart-web/research/`.
- **Tone: wonky and funny.** The owner chose exaggerated, playful feel (heavy Stack sway, swinging turns, high item arcs) — apply the same spirit to art, juice and audio.

## Decisions so far

- [Destination & constraints](map.md#destination) — charted 2026-10-02 (see Destination/Notes)
- [Catalog the original My Mini Mart's mechanics](issues/01-original-game-mechanics.md) — proximity-driven harvest→carry→shelf→checkout loop, pay-pads, crop→animal→machine chains; Pages viable; Three.js+Vite leaning
- [Decide which mechanics the clone includes](issues/03-core-mechanics-scope.md) — original loop kept; generic Recipes; Tray-based producers; capacities everywhere; Cashier+Stocker; Office for upgrades; angry customers leave a Mess; Completion % only; no offline earnings
- [Research web 3D stack, deploy path, and free asset coverage](issues/02-tech-stack-and-assets-research.md) — Three.js (4× smaller than Babylon) + small libs; Vite→Actions→Pages; Kenney CC0 packs cover ~85%, gaps procedural
- [Choose the rendering library and toolchain](issues/04-tech-stack-choice.md) — Three.js + Vite + strict TS, npm, auto-deploy to Pages from public repo; GLB per-pack folders; nipplejs, howler, in-house tweens; Preact for panels only; no physics
- [Define the map template for future levels](issues/06-level-template.md) — typed TS data per map + shared Catalog; grid layout; wall-less Areas; requirement-list unlocks; data-driven Upgrades; fixed Queue Spots; CI validation; stable ids
- [Design the economy and progression of the first map](issues/05-economy-and-progression.md) — 30–40 min; 7 Products/3 Areas, all 1:1 Recipes; mostly-linear unlock order; hand-picked raw prices; Customer Cap (2+Products)×1.3/Cashier, max 15; 11 Upgrades; Exit Pad by a car, Money per map (numbers and some order revised by the price table)
- [Prototype movement, camera and carrying feel](issues/07-controls-and-camera-feel.md) — variant B "wonky and funny": eased speed and turns, soft look-ahead ortho camera (41°, 20 m), Stack in front with heavy sway, analog floating joystick, arcing transfers (drop-off speeds up, pick-up slows mildly as the Stack fills)
- [Pick the asset packs and art direction](issues/08-art-direction-and-assets.md) — Kenney mini toy style anchors all; gaps composed from Kenney parts, then primitives; bright saturated palette, soft-shadow lighting; oversized Items; CC0/CC-BY/OFL with in-game Credits; bill-stack Money (coins only as a flip effect); Pads count down with a ghost preview; one asset table
- [Define project practices](issues/09-project-practices.md) — sim/view/ui split with pure seeded sim; ESLint+Prettier, Vitest on sim + validator + CI bot playthrough; branch+PR, no commit prefix; full CI gate; new deps need OK; every `main` merge is a release; `?debug` panel; minimal, non-duplicated code
- [Author the first map's price table and timings](issues/10-price-table.md) — ~30 min estimated (7/11/11 per Area); costs cut below the anchors (carrying is the bottleneck); start $50, Exit $2,100; Stocker opens Area 2; Area 3 adds 2nd Blender/Mill/Oven; Stack 16; 37 Upgrade levels; patience only at empty Shelves; estimator script as the sheet
- [Research performance limits for a Three.js phone game](issues/15-performance-research.md) — phones <100 draw calls/<100k vertices; characters are the main cost (merge static store, blob shadows); game ~0.6–0.9 MB gzip vs Poki 5 MB; `size-limit` in CI; proposed 250 kB JS / 1.2 MB / ≤5 s on Slow 4G
- [Lay out the first map](issues/11-first-map-layout.md) — map 1 = Corner shop: walled shop on top, farm yard behind, back door per Area, Customers on Street + shop floor only from 3 street spots, Office room, 3 Car Spots from the start; E/F/G (+ earlier A–C) saved for later maps; 11.3 m trips → 30.5 min; layout editor kept as a dev-only tool
- [Design the HUD and UI](issues/12-hud-and-ui.md) — icons first, top-strip HUD (Money, Completion bar, gear), edge arrows, current-Product Customer bubbles; Office panel (instant buy, hidden locked Upgrades, Stocker assignment) as bottom sheet/side panel; title over a fully unlocked panning map with circle wipe; pause/Maps/Settings; Fredoka; Party Props at 100%
- [Design the tutorial](issues/13-tutorial.md) — textless, ~1 min, 13 ordered but non-blocking steps (Register → … → first Upgrade) with a bouncing arrow; opening Pads chained by Unlock Requirements; no Customers before the first shelved Item, no patience during it; Area Pans (blocking, pulsing ghosts) on every Area buy; Map 1 only, no skip
- [Pick the audio and juice](issues/17-audio-and-juice.md) — cartoony toy sounds; one bouncy music loop loaded after Play, no ambience; per-event sound table with ±10% pitch, rising-pitch plops/ticks; off-screen at 30%; on/off toggles only; Kenney + Freesound CC0 + baked jsfxr in one MP3 sprite; squash & stretch, flying bills, `+$` floating numbers, Cash Pile drains bill-by-bill with a rising number; no screen shake or vibration
- [Set the performance budget](issues/16-performance-budget.md) — ~2021 mid-range Android + recent iPhones; 60 fps (30 floor); 250 kB JS / 1.2 MB / ≤5 s Slow 4G enforced by `size-limit` in CI; phones ≤100 draws/150k tris (provisional until real-device check); blob character shadows everywhere; auto pixel-ratio step-down; counts in `?debug`
- [Define save data and versioning](issues/14-save-data.md) — every load is a fresh Opening: only Money (+ Cash Piles), purchases, partial payments, Upgrades and Stocker assignments survive; autosave ~5 s/purchase/tab-hide; versioned saves with migration chain, never wiped silently; copy/paste save code, hold-to-reset; two-tab pause; persist() after first Pad; iPhone Add-to-Home-Screen card
- [Name the game](issues/18-game-name.md) — **Wobbly Mart** (`wobbly-mart` repo/URL, no tagline); Fredoka SVG wordmark, green "Wobbly" + orange "Mart", crate–tomato–egg stack on the M doubles as favicon/home icon; drops in, sways, big wobble on Play

## Not yet specified

- **Optional events (nice-to-have, after v1 core)** — thief chase, timed delivery orders, random spills, a Cleaner staff role. A car event now has 3 reserved Car Spots per map (usable from Area 1; several cars may be parked at once). What a car wants and pays is still open.

## Out of scope

- Content for additional maps beyond the first (the template must support them, but they are not designed here). Their layouts are saved (E, F, G, and earlier A–C in `layouts/`), but their Products, prices and order are not.
- Monetization (ads, IAP), analytics.
- Stars/ratings, prestige, premium currencies, boosts — ruled out in [Decide which mechanics the clone includes](issues/03-core-mechanics-scope.md); Completion % is the only meta measure.
- Any backend: cloud saves, leaderboards, accounts, multiplayer.
- Using the original game's assets, name or branding.
