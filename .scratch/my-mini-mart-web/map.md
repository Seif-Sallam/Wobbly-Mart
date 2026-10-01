# Map: My Mini Mart — web clone

Label: wayfinder:map

## Destination

A build-ready spec for a browser clone of My Mini Mart: same mechanics, own name & assets, 3D low-poly with a fixed isometric camera, TypeScript, static on GitHub Pages, local-browser saves — one complete map, built on a reusable template for future maps.

## Notes

- Domain: game design + web game engineering. Personal project, shared with friends, no monetization.
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
- [Design the economy and progression of the first map](issues/05-economy-and-progression.md) — 30–40 min; 7 Products/3 Areas, all 1:1 Recipes; mostly-linear unlock order; hand-picked raw prices; Customer Cap (2+Products)×1.3/Cashier, max 15; 11 Upgrades/38 levels; Exit Pad by a car, Money per map
- [Prototype movement, camera and carrying feel](issues/07-controls-and-camera-feel.md) — variant B "wonky and funny": eased speed and turns, soft look-ahead ortho camera (41°, 20 m), Stack in front with heavy sway, analog floating joystick, arcing transfers (drop-off speeds up, pick-up slows mildly as the Stack fills)
- [Pick the asset packs and art direction](issues/08-art-direction-and-assets.md) — Kenney mini toy style anchors all; gaps composed from Kenney parts, then primitives; bright saturated palette, soft-shadow lighting; oversized Items; CC0/CC-BY/OFL with in-game Credits; bill-stack Money (coins only as a flip effect); Pads count down with a ghost preview; one asset table

## Not yet specified

- **Optional events (nice-to-have, after v1 core)** — thief chase, timed delivery orders, random spills, a Cleaner staff role.
- **HUD & UI** — money counter, Office upgrade panel, guidance arrows, menus, settings (incl. Grab Mode, Credits screen); mobile vs desktop layout; maybe a Player character choice later.
- **Tutorial / onboarding** — the first-minutes guided flow.
- **Audio & "juice"** — sounds, music, feedback effects; free audio sources (CC0/CC-BY/OFL; Money, coin-flip and Pad visuals are set in [Pick the asset packs and art direction](issues/08-art-direction-and-assets.md)). Stack/transfer motion is settled in [Prototype movement, camera and carrying feel](issues/07-controls-and-camera-feel.md); the rest should match its wonky tone.
- **Save data shape & versioning** — what's persisted, migrations when the game changes.
- **Performance budget** — target devices/FPS, asset size budget, load time.
- **Game name & logo** — own name and logo; palette and look are set in [Pick the asset packs and art direction](issues/08-art-direction-and-assets.md).
- **Level editor (maybe later)** — in-game tool to place stations/Pads instead of hand-editing map data.

## Out of scope

- Content for additional maps beyond the first (the template must support them, but they are not designed here).
- Monetization (ads, IAP), analytics.
- Stars/ratings, prestige, premium currencies, boosts — ruled out in [Decide which mechanics the clone includes](issues/03-core-mechanics-scope.md); Completion % is the only meta measure.
- Any backend: cloud saves, leaderboards, accounts, multiplayer.
- Using the original game's assets, name or branding.
