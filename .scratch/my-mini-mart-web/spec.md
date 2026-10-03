# Wobbly Mart — build-ready spec

A browser clone of My Mini Mart under its own name and art: an arcade-idle store game where the Player grows crops, feeds animals, runs machines, stocks Shelves and checks out Customers, spending the Money on more of the store. Low-poly 3D under a fixed isometric camera, TypeScript, static on GitHub Pages, saves in the browser. v1 is **one complete map** (Map 1, "Corner shop") built on a map template that later maps reuse.

Assembled 2026-10-03 from every ticket in [the map](map.md). This file is the build's starting point; tickets hold the reasoning behind each line.

**Sources of truth this spec points to instead of repeating:**

| What | Where |
|---|---|
| Glossary — every capitalised term below | [`/CONTEXT.md`](../../CONTEXT.md) |
| Map 1 numbers: every Pad cost and Unlock Requirement, Upgrade levels, Producer timings | [`price-table/price-table.md`](price-table/price-table.md) (regenerate with `python3 price-table/sim.py --table`) |
| Map 1 cells (and approved later layouts E, F, G) | [`layouts/approved-layouts.ts`](layouts/approved-layouts.ts), picture [`layouts/D-overview.png`](layouts/D-overview.png) |
| Asset filenames for gaps | [`research/08-kenney-gap-check.md`](research/08-kenney-gap-check.md); pack and audio URLs in [`research/02-tech-stack-and-assets.md`](research/02-tech-stack-and-assets.md) §C–D |
| Feel reference (playable) | branch `prototype/movement-feel` → `prototypes/movement-feel/`, `?variant=B` |
| Layout editor reference (playable) | branch `prototype/first-map-layout` → `prototypes/first-map-layout/`, `?variant=D`, `V` |
| Palette reference (playable) | branch `prototype/palette` → `prototypes/palette/`, `?variant=C` |

---

## 1. Name and identity

- **Wobbly Mart** (with a space) on logo, tab title, home screen, Credits. `wobbly-mart` for the repo and Pages URL — rename the repo from `my-mini-mart` before the first deploy. No tagline.
- **Logo:** flat SVG wordmark in Fredoka, chunky, slightly tilted, letters at uneven heights. "Wobbly" in `money`, "Mart" in `orange`, one `ink` outline, soft drop shadow. A stack icon (crate, tomato, egg as oversized flat tilted shapes) sits on the "M"; must read at 32 px.
- The icon alone on a `sky` rounded square = favicon and iPhone home-screen icon (web app manifest needed, see §12).
- **Title motion** (in-house tweens): drops in with squash + bouncy plop → letters bob out of sync, the stack sways like the in-game Stack → **Play** gives one big wobble, then the circle wipe.

## 2. Tech stack and repo

| Topic | Decision |
|---|---|
| 3D | Three.js |
| Language / build | TypeScript `strict: true`, Vite, `base: './'` |
| Packages | npm, lockfile committed |
| Runtime deps (only these) | `three`, `preact`, `nipplejs` (touch joystick), `howler` (audio, iOS unlock), `lil-gui` (debug panel, lazy-loaded). Any other runtime dep needs owner OK in the PR with a one-line reason. Dev tools just get listed. |
| Tweens | in-house helper driven by the game clock |
| Physics | none — circle-vs-box push-out, circle-vs-circle, distance checks for proximity |
| UI | HTML/CSS overlay; Preact for panels (Office, Stocker assignment, settings, menus); plain DOM for per-frame bits (Money, Completion, popups). Pad labels and floating numbers are in-scene. |
| 3D assets | GLB only, `public/models/<pack>/`, loaded by path (keeps each Kenney pack's `colormap.png`). Non-GLB converted offline before commit. |
| Deploy | Vite's official GitHub Actions → Pages workflow on every push to `main`; public repo. Every merge to `main` is a release. |

**Layout**

```
src/sim/      all rules; fixed timestep; sim clock + seeded RNG; no Three.js/UI imports
src/view/     Three.js; reads sim state only
src/ui/       Preact + HTML/CSS; reads sim state only
src/input/    keys/joystick → intents
catalog/      products.ts, producers.ts (shared)
maps/         index.ts (play order); <map-id>/layout.ts (editor-owned), unlocks.ts, customers.ts …
```

An ESLint rule enforces the sim/view/ui boundaries.

**Conventions:** `camelCase` / `PascalCase` / `UPPER_CASE`, `kebab-case.ts` files; no `any`; no `Date.now()`/`Math.random()` in `sim/`; no magic numbers in `sim/` (they live in catalog, map data or `tuning.ts`); feel and juice constants in one `feel.ts`; colours in one `palette.ts` (feeds 3D materials and CSS variables). **Minimal code:** reuse or extend before adding; never duplicate; light comments.

**Quality:** ESLint (typescript-eslint strict) + Prettier. Vitest on `sim/` and the map validator only — broad flowing tests, no mocking our own code (fake input and seeded RNG only). No tests for rendering, feel or UI.

**CI gate** (PRs and `main` before deploy): typecheck, lint, format check, tests, **bot playthrough** (headless bot plays Map 1 at high speed; fails if 100% Completion is unreachable; prints simulated time as info), map validation, production build, `size-limit` (§13), "no editor code in `dist/`" check (§14).

**Workflow:** branch + PR, merge when green; small PRs, each one playable/testable step. Commits single-line, no prefix. PR description: summary, how to try it, new deps, reused vs added. No preview deploys — owner tries branches with `npm run dev`.

**Docs:** short root `CLAUDE.md` (rules above, for coding sessions), `README.md` (run/test/deploy), `CONTEXT.md` (glossary), `CREDITS.md` (generated, §8). Each links, none repeats another.

## 3. Map template (data, not code)

A Map is a typed TS data file set under `maps/<map-id>/` — pure data, the compiler catches typos. Engine code owns every Station *kind* and all behaviour; a new Producer of an existing kind is data only, a new kind is code.

- **Catalog:** `catalog/products.ts` (name, model, Sale Price) and `catalog/producers.ts` (Producer types: kind, fixed Recipe, default stats). Maps reference by id, may add Products/Producer types and override prices/stats.
- **Units:** metres; x east, z south, origin top-left. Stations, Pads and Props sit on whole cells with rotation 0/90/180/270 (layout prototype boxes are `[x, z, w, d]`). Characters move freely.
- **Areas:** one or more rectangles each. A locked Area is bare `dirt` ground behind a low rope (inside the shop it gets a locked tint too); buying paves it in. A door in a locked Area stays shut. Map edge is an invisible stop line.
- **Building pieces:** tall walls (far sides), knee-high walls (camera sides, cutaway), office partitions, sliding customer doors (open when anyone is within ~2.5 m), Back Doors, counter windows, indoor floor rectangles, Street rectangles (Customers only), customer street spots (several), numbered Car Spots (car bay + pickup tile). No roof.
- **Pads:** every Pad has an explicit cell, a cost, and an Unlock Requirement list ("all of these ids", may name an Upgrade level; empty = from start). Hidden until requirements are met.
- **Upgrades:** `{id, family, target, stat, levels: [{cost, value}], requirements}`; the Office panel is generated from them.
- **Registers:** a straight row of fixed Queue Spots from the front with a max length (optional hand-laid spots override); all full → Waiting Spots.
- **Staff Pads** name a role; a Cashier Pad names its Register; a Stocker Pad has a spawn cell. Chain assignment is derived from Recipes.
- **Props:** model, cell, rotation, `solid` or walk-over (rug), optional owning Area, optional **Party Prop** flag (appears at 100%).
- **Start state:** owned ids + starting Money; Player start spot.
- **Assets** are referenced by model **name** from one shared asset table (name → path, scale, tint, offset); the material-name → palette map sits beside it.
- **Ids:** readable strings, never renamed or reused once released. CI keeps a committed `released-ids.json`.
- **Validator** (CI and live in the editor) fails on: dangling ids, unlock cycles / unreachable items, Shelf Products nothing produces, overlapping stations, queues colliding with stations/Props, ids removed since last release, model names missing from the asset table.

## 4. Game rules (the sim)

**Player and Stack**
- Proximity only: walking near a thing is the action. One Player, never leaves the Areas.
- Stack carried in front, mixed Products; only matching Items leave at a Station. Capacity from Upgrades (16 → 32). Full Stack slows the Player up to 25% (linear with fullness).
- **Grab Mode:** Auto (default; only mode on touch) — transfers happen within reach. Manual (desktop setting) — Items move one at a time only while Space is held, both directions.
- **Transfers:** reach 0.6 m from the Station's edge. Pick-up interval 0.25 s empty → 0.5 s full (scales with fullness). Drop-off speeds up: 0.25 s × 0.85 per Item, floor ~0.06 s, reset on arriving at a Station. Each Item flies 0.3 s on a 1.5 m arc.
- **Trash Bin:** destroys dropped Items, no refund. Free, not a Pad, not in Completion; appears when Area 2 is bought.

**Producers** (one Recipe each; full Tray pauses production)
- **Crop:** no inputs; plants in plots ripen and are picked individually, each regrowing on its own timer.
- **Animal / Machine:** Loading puts inputs in an input queue; it works a few seconds and puts output on its **Tray** (Customers never buy from a Tray). Tray 6, input queue 6 (Oven: 4 Flour + 4 Egg) — fixed in v1.
- A "more plots" Pad adds 4 plants; a 2nd Animal/Machine is its own Station and doubles output.

**Shelves:** one Product each, capacity 8 → 20 (one global Upgrade).

**Customers**
- Arrive at one of the map's street spots whenever the store is below the **Customer Cap** and at least one Item is on a Shelf (so none before the first shelved Item), at most one every 1.5 s. Walk only the Street and bought shop floor; enter by a front door, leave the same way.
- **Customer Cap** = ⌊(2 + Products for sale) × 1.3^Cashiers⌋ → 3 at start, 15 max on Map 1.
- **Shopping List:** up to 4 different Products from unlocked Shelves, up to 4 units each. Rolled uniformly (§16). Bubble shows only the Product they're heading to + remaining count.
- Take Items into a cart, queue at the shortest Register queue, pay, leave.
- **Patience** runs only while waiting at an empty Shelf: angry after 20 s, then 10 s later drops the whole cart as a **Mess** and leaves without paying. Never angry in a Register line or on a Waiting Spot. No patience at all while the tutorial runs.
- **Mess:** slows passing Customers 50% until the Player walks over it.

**Registers and Money**
- Checkout: Player 1.5 s per Customer; Cashier 2.0 → 1.0 s (Upgrade). Cash lands on that Register's **Cash Pile** — uncapped, never auto-collected, only the Player collects it by walking over it. Cashiers don't collect.
- **Money** is the one currency, per map, never carried between maps. Fixed Sale Prices, never upgradable.

**Pads and growth**
- Standing on a Pad drains Money into it until bought, in a fixed ~1.5 s (§16). Walking off keeps what was paid; the label shows the remainder.
- **Area Pan** when an Area is bought (and for Area 1 at the start of a new game): camera glides there ~0.6 s, holds ~0.8 s, glides back ~0.6 s; Player movement blocked; can't be cancelled; ghosts of everything the Area will hold pulse throughout. Ordinary Pads never pan.
- **Staff:** Cashier (works one Register) and Stocker. A Stocker moves Items anywhere: unassigned it takes the most urgent job (empty Shelf with waiting Customers → lowest Shelf → empty Producer input); it can be assigned to one Product's chain in the Office. Stocker speed 4 → 6 m/s, carry 6 → 14.
- **Office:** walking to the desk opens the Upgrade panel (§9). Upgrade families: Player, Station, Staff. An Upgrade's level 1 appears once its station/Staff is bought.
- **Completion** = bought Pads + Upgrade levels, all equally weighted. Map 1: 31 Pads + 37 levels = 68. The only meta measure.
- **Exit Pad:** beside a delivery van; buying it opens the map picker (v1 behaviour in §16). Players can go back to any visited map anytime via the Maps menu.
- **No offline earnings.** The game only runs while open.

**Opening** — every map load (reload or arriving from Maps) starts fresh: only what's bought survives (§12). No Customers, Messes or Items; Crops from seed; Player at the start spot.

## 5. Map 1 — "Corner shop"

**Products and Sale Prices:** Tomato $3, Egg $5, Ketchup $6, Wheat $4, Milk $7, Flour $8, Bread $20.

**Producers** (all 1:1 Recipes): Tomato bed (Crop, 4 plants × 6 s), Chicken Coop (Tomato → Egg, 4 s), Blender (Tomato → Ketchup, 3 s), Wheat field (Crop, 4 plants × 7 s), Cow pen (Wheat → Milk, 5 s), Mill (Wheat → Flour, 4 s), Oven (Flour + Egg → Bread, 6 s).

**Unlock order** (full costs and requirements in the price table): start with **$50** = Register $10 → Tomato Shelf $15 → Tomato bed $25, revealed one at a time.
- Area 1: Egg Shelf → Chicken Coop → Office → Ketchup Shelf → Blender → Cashier | 2nd Chicken | more Tomato plots.
- Area 2 ($150): Stocker → Wheat Shelf → Wheat field → Milk fridge → Cow pen → Flour Shelf → Mill → more Wheat plots | 2nd Cow. (Trash Bin appears free.)
- Area 3 ($1,050, needs Mill): Bread Shelf → Oven → 2nd Register → 2nd Cashier | 2nd Stocker | 2nd Blender | 2nd Mill → 2nd Oven (needs 2nd Blender + 2nd Mill) → Exit Pad $2,100.

**Upgrades — 13 lines, 37 levels:** Player Speed 5.5 → 7.5 m/s (4), Stack 16 → 32 (4), Shelf capacity 8 → 20 (3), Cashier 2.0 → 1.0 s (3), Stocker speed 4 → 6 m/s (4), Stocker carry 6 → 14 (4), Producer speed ×0.8 work time per level — Tomato 3, Chicken 2, Blender 2, Wheat 3, Cow 2, Mill 1, Oven 2. Costs ×1.8 per level, scaled by the Area of their station. Rounding: $5 under $100, $25 under $1,000, $50 above.

**Pacing:** estimator says **30.5 min** to 100% with perfect play (Area 1 ~7, 2 ~11, 3 ~11); expected 30–40 min real. Numbers get tuned by playing; carrying is the bottleneck.

**Layout** (42 × 46 m, data in `approved-layouts.ts` → `D`):
- Walled shop along the top (18 m deep), farm yard behind; Areas side by side left → right, each with a shop part and a yard part, one Back Door each.
- Customer doors in the far walls (north and west); 3 street spots; Street is the strip outside those walls.
- Registers at the back of the shop, Cashier behind, Queue Spots run north toward the Shelves.
- Office: walled room ~8×7 m in Area 1 with a door and static decor (bookshelf, sofa, rug, plants, cooler, table); the Office Pad places its upgrade desk.
- Road along the bottom: delivery van by the Exit Pad; 3 painted Car Spot bays beside Area 1's yard (unused in v1).
- Average one-way carrying trip 11.3 m.

## 6. Controls and camera

| Topic | Value (starting point, tunable in `feel.ts`) |
|---|---|
| Movement | top speed from Upgrade (5.5 base); ramp up 0.31 s, stop 0.30 s; turn 10 rad/s (visible swing); walk bob 0.05 m |
| Desktop keys | WASD/arrows move; Space held = Manual Grab; Esc closes the open panel, else toggles pause. No mute/buy shortcuts. |
| Touch | floating analog joystick anywhere (nipplejs `dynamic`); half push = half speed |
| Camera | orthographic, 45° yaw, 41° pitch, 20 m view on the shorter screen side; soft follow (sharpness 9, exponential) with 0.44 s look-ahead along velocity |
| Stack | in front, Item spacing 0.31 m; sway spring from Player acceleration — amount 2, stiffness 51, damping 20 (big slow heavy lean, bends more toward the top); allow amount > 2 when tuning |
| Orientation | phones in portrait and landscape; no rotate prompt |

## 7. Art direction

- **Style anchor:** Kenney "mini" toy style (Mini Market, Mini Characters, Cube Pets). Gaps: compose from other Kenney parts → primitives in the palette. Never a clashing style.
- **Items oversized 1.5–2×** relative to people. Character models unmodified. Kenney textures as-is; no toon shading, no outlines.
- **Lighting:** warm sun `#ffcf8a` intensity 3.0 from above front-right; hemisphere light 0.9 (sky = `sky`, ground = `grass`); PCF shadows, radius 3; ACES filmic tone mapping, exposure 1. Same for every model.
- **Recolouring:** untextured Kenney materials (Nature, Furniture) are swapped by material name for shared palette materials; textured Mini packs keep their colormap. Mini Market floor keeps its checker.
- The map is finite: `sky` shows past the ground edge.

**Palette — "Golden Storybook"** (`palette.ts`)

| Name | Hex | Used for |
|---|---|---|
| sky | `#7ec8e3` | background; hemi sky; icon square |
| grass | `#a3c94a` | ground; hemi ground |
| leaf | `#5e9e3a` | Nature `grass`/`leafsGreen` (trees, bushes, crop leaves) |
| path | `#e8c48a` | walkways, pavement; disabled UI buttons |
| dirt | `#9c5b3a` | crop beds, locked-Area ground |
| road | `#5d5a63` | the road |
| wood | `#c17a43` | Nature/Furniture `wood`/`woodBark` |
| ink | `#3a2416` | logo outline, all UI text and outlines |
| cream | `#fff1d0` | UI panels, bubbles, pills; band on bills |
| pad | `#ffe066` | Pad face |
| money | `#2f9e4f` | bills, `+$` numbers, buy buttons, "Wobbly" |
| orange | `#f26b1d` | guidance arrows, Completion fill, "Mart" |

Derived: `dirtDark` = dirt × 0.75, `woodDark` = wood × 0.75.

**Entities**

| Entity | Source |
|---|---|
| Player | one fixed Mini Character, signature colour + hat (picked in build); no customisation |
| Customers | random Mini Characters variants, random tints |
| Cashier / Stocker | Mini Market `character-employee` + coloured cap per role |
| Tomato, Egg, Ketchup, Milk, Bread | Food Kit `tomato`, `egg`, `bottle-ketchup`, `carton`, `loaf` |
| Wheat | procedural sheaf (gold cylinder bundle + tie) |
| Flour | Food Kit `bag`, tinted off-white, wheat-ear sticker |
| Tomato bed | Nature `crops_dirtRow` + primitive bush; Food Kit tomatoes grow in |
| Wheat field | Nature `crops_dirtRow` + `crops_wheatStageA/B`, recoloured |
| Chicken Coop | Cube Pets `animal-chick` ×N in a coop from Fantasy Town planks/roof/fence |
| Cow pen | Cube Pets `animal-cow`, Nature/Fantasy fences + feed trough |
| Blender | Furniture `kitchenBlender` scaled up on a counter; shakes while working |
| Mill | hut from Fantasy Town walls/roof + `windmill` sails spinning while working |
| Oven | Furniture `kitchenStove` scaled up; glows/puffs while working |
| Trays | Survival `box-open` with Items inside |
| Shelves | Mini Market `display-fruit` (Tomato, Egg), `shelf-boxes` (Ketchup, Flour), `freezers-standing` (Milk), `display-bread` (Bread), `shelf-bags` (Wheat) |
| Register | Mini Market `cash-register` on Furniture `kitchenBar` |
| Office desk | Furniture `desk` + `chairDesk` + `computerScreen` |
| Trash Bin | Furniture `trashcan` |
| Exit van | Car Kit `delivery` |
| Locked-Area rope | Mini Market `fence`, rope look |
| Ground | Mini Market `floor` indoors; grass with recoloured Nature trees/bushes outside; road at the bottom |

- **Money:** procedural green bill stacks everywhere. Platformer `coin-gold` only as a flip-and-spin effect when a Customer pays and when a Cash Pile is collected — never shows an amount.
- **Pads:** flat rounded `pad`-coloured square with the unlock's icon (Kenney 2D packs; rendered-thumbnail fallback) and price, flat on the floor. While stood on: ghost preview of the Station, price counts down to 0, radial fill grows.
- **Mess:** coloured floor splat + 2–3 of the dropped Products tipped over.
- **Licences:** CC0, CC-BY, OFL only (no SA, NC or "personal use"). One credits list generates `CREDITS.md` and the in-game Credits screen.

## 8. HUD and UI

**General:** icons first, words only in menus, settings and Upgrade names. English only. Toy look: chunky rounded `cream` cards, thick soft shadows, buttons squish on press. Font **Fredoka** (OFL, bundled). Numbers in full with separators to 9,999 (`$2,100`), then `12.5K`, `3.4M`.

**HUD** — top strip only, inside the safe area (rest of the screen is joystick space):
- Money big at top-centre (bill icon + number; flying bills land on it, it bumps and rolls up).
- Completion as a thin `orange` bar top-left; gear top-right.
- No Stack counter: a bouncy **MAX** tag floats over the Stack when full.
- **Edge arrows** at the screen border with the target's icon for: an affordable newly revealed Pad, a Customer growing angry at an empty Shelf, an available affordable Upgrade. Hidden while the target is on screen. No toasts.

**In-scene:** Customer bubble (heading-to Product + count); at an empty Shelf a patience ring drains yellow → red; angry face on leaving; cart/✓ or nothing in a Register line. Bouncing **!** over the Office desk while an affordable Upgrade exists.

**Office panel:** opens on reaching the desk; closes on walking away or X (after X stays shut until the Player leaves the desk area and returns). Game keeps running. Tap buys instantly; unaffordable = greyed with the shortfall shown. Locked Upgrades hidden. Cards grouped Player / Station / Staff with icon, name, level pips, cost. **Staff** section: each Stocker's assignment — Auto or one Product chain. Portrait: bottom sheet (~half screen); landscape: right-third side panel; camera nudges the Player into the free space; joystick works outside the panel.

**Screens**
- **Title:** logo + loading bar that becomes **Play** (that tap also unlocks audio). Behind it the last-played map (Map 1 on first launch) shown fully unlocked, camera slowly panning; animals/machines idle, a few scenery people wander — no sim, no real Customers, no Party Props. Play → closing-circle wipe into the save. Shows a small "progress won't be saved" note if storage fails.
- **Pause** (gear/Esc; sim paused; auto when tab hidden): Resume / Maps / Settings as centred cards.
- **Maps:** cards with name + Completion %; unreached maps as locked silhouettes ("coming soon" in v1). The Exit van's picker reuses it.
- **Settings:** Music on/off, Sounds on/off, Grab Mode (desktop only), Fullscreen, Controls help, Credits, Copy/Paste save code, Add-to-Home-Screen tip, Reset progress (§12). No graphics quality setting.

**100% Completion:** non-blocking — wobbly "100%!" banner drops in, confetti, Completion bar turns gold for good, the map's Party Props appear and stay. Map 1's Party Props are placed with the layout editor during the build.

## 9. Tutorial (Map 1 only, once per save, no Skip)

- Textless. First frame: movement hint (keycaps on desktop, dragging hand on touch — whichever input comes first), fades after ~2 m. A new game first plays the Area 1 Area Pan.
- A bouncing 3D arrow over the current target, plus the edge arrow when off-screen. No floor path.
- Steps: 1 Register Pad → 2 Tomato Shelf Pad → 3 Tomato bed Pad → 4 pick tomatoes → 5 fill the Tomato Shelf → 6 check out the first Customer → 7 walk over the Cash Pile → 8 Egg Shelf Pad → 9 Chicken Coop Pad → 10 feed the Chicken → 11 take eggs from the Tray to the Egg Shelf → 12 Office Pad → 13 buy one Upgrade.
- Ordered but non-blocking: the arrow points at the first unfinished step; steps complete from game state, so early completions are skipped. Never locks anything. Ends after step 13 (~1 min); afterwards only edge arrows, the Office **!** and Area Pans.
- The opening Pads' one-at-a-time reveal is map data (Unlock Requirements), not tutorial code.
- After a reload it resumes at the first unfinished step: purchase steps already done count, carry/stock steps repeat.

## 10. Audio

- **Character:** cartoony toy sounds — plops, boings, squeaks, rubbery pops; "real" sounds slightly exaggerated. No footsteps, no ambience.
- **Music:** one bouncy low-volume loop (pizzicato/ukulele/marimba feel), title and game alike, separate MP3 loaded after **Play**. Track picked by listening during the build.

| Event | Sound |
|---|---|
| Item picked up | short pop (slows with pick-up pacing) |
| Item dropped off | "plop", pitch rising per Item with the crescendo |
| Paying into a Pad | fast rising-pitch ticks, "ding" at 0 |
| Pad bought | pop + short boing as the Station springs up |
| Area bought | short jingle (Kenney `jingles_PIZZI`) |
| Customer pays | exaggerated ka-ching |
| Cash Pile drained | bill tick/rustle per bill, rising pitch |
| Upgrade bought | power-up rise |
| Machine working | quiet loop while running (whirr, creak, hum) |
| Animal fed / laying | cluck or moo, random pitch |
| Mess left | grumble + splat |
| Mess cleared | swish |
| Stack full | small bonk |
| UI | soft click |
| 100% Completion | fanfare jingle + party horn |

- ±10% random pitch on every sound; at most ~4 copies of one sound at once. On-screen sources full volume, off-screen ~30%; no panning or 3D audio.
- Only Music and Sounds on/off toggles, both on by default. Music dips under jingles. All audio stops while paused or hidden.
- **Sources:** Kenney CC0 audio first; Freesound CC0 for ka-ching, cluck, moo (re-check each licence); jsfxr pre-generated files for rising ticks (no runtime lib). All SFX in **one MP3 sprite**. Every sound in Credits; audio counts toward the size budget.

## 11. Juice

- **Squash & stretch:** Items squash on landing; a Station bounces a little per Item received; a new Station springs up with overshoot.
- **Floating numbers:** `+$X` over the Register when a Customer pays; `+$X` over the Player while draining a Cash Pile. None on Pad payments (no `-$`). Fredoka, `money`, thick white outline, in-scene; pop with overshoot, slight wobble, drift up ~1 m, fade ~0.8 s; a repeat from the same source within ~0.3 s adds to the number and re-bounces.
- **Cash Pile drain:** bills peel off one by one and fly to the Player; pile shrinks; `+$` and HUD count up per bill. Takes ~0.6–1 s whatever the size (bill count capped); once started it finishes even if the Player walks off.
- **Puffs:** dust when a Station appears or a Mess is cleared; steam/flour while a Machine works; feathers when a chicken lays.
- **Characters:** Customers hop happily after paying, stomp angrily before leaving.
- **No screen shake, no vibration.** Juice timings live in `feel.ts`.

## 12. Saves

- **Saved per map:** Money (uncollected Cash Piles added on save), Pads/Areas/Staff bought, partial Pad payments, Upgrade levels, Stocker assignments.
- **Not saved:** Customers, Messes, all Items, work in progress. Crops restart from seed.
- **Saved globally:** current map, visited maps, tutorial step. **Settings** (Music, Sounds, Grab Mode) stored separately; they survive a reset.
- **When:** autosave every ~5 s, right after every purchase, on tab hide/close. No save button or indicator. Switching maps saves the one left, then opens the other.
- **Versioning:** save carries a version; each bump ships a one-step migration, old saves run the chain. Content changes need none: unknown ids dropped, new Pads unbought, values clamped, a partial payment that reaches a lowered price counts as bought. Unmigratable → kept under a backup key, fresh start, one message. Never wipe silently.
- **Storage:** localStorage, keys namespaced `wobbly-mart.*` (all `<user>.github.io` sites share one origin), every access in try/catch. If saving fails the game still plays (title note). `navigator.storage.persist()` after the first Pad is bought.
- **Save code:** Copy / Paste (clipboard text; paste asks to confirm). **Reset progress:** hold ~2 s, wipes all maps, keeps settings. No per-map reset.
- **Two tabs:** the older tab pauses behind a "Playing in another tab" card.
- **iPhone:** one-time card after the tutorial on iOS Safari (not when already on the Home Screen) suggesting Add to Home Screen with the share-icon picture; same tip in Settings. Web app manifest + icon so the Home Screen version opens full screen.

## 13. Performance budget

- **Targets:** ~2021 mid-range Android, iPhones from the last ~5 years, laptops with built-in graphics. 60 fps target; 30 fps floor on phones.
- **Download** (gzip, locked): initial JS ≤ 250 kB; total first load ≤ 1.2 MB; playable ≤ 5 s on Lighthouse Slow 4G, never > 10 s. Enforced by `size-limit` + `@size-limit/file` (`gzip: true`) after `vite build`. Raising a limit = config change in the PR with a one-line reason.
- **Rendering** (provisional until the first build runs on the owner's phone, then adjusted once): phones ≤ 100 draw calls and ≤ 150k triangles per frame incl. shadow pass (desktop ≤ 300 / 500k). Static store merged per pack material; Items and Money instanced. One shadow-casting directional light, `PCFShadowMap` + `shadow.radius`, 1024² phones / 2048² desktop; floors only receive. Characters use instanced **blob shadows** on every device. Pixel ratio `min(dpr, 2)`, stepping down 2 → 1.5 → 1 automatically when frames run slow. MSAA on.
- `?debug` shows draw calls, triangles, fps and warns in the console over budget.

## 14. Dev tools

**`?debug` panel** (ships in the live build): one `lil-gui` panel, lazy-loaded only with `?debug`. Live tuning sliders for the same values the game reads, cheats (+Money, unlock all, sim speed), render counts.

**Layout editor** (dev builds only):
- Opened only under `npm run dev`: `V` toggles, `?edit` opens on load, `?map=<id>` picks a map. Adds a dev-only section to the debug panel.
- Move, resize, rotate anything; add/delete purely visual things only (walls, decor Props, Party Props, floors, Street, counter windows, Car Spots). Stations, Pads, Upgrades, requirements and prices stay hand-written code.
- **Save** rewrites the editor-owned `maps/<id>/layout.ts` whole (Prettier-formatted) through a dev-server endpoint; Vite hot-reloads. Hand comments in that file are lost.
- Validator runs on every edit (problems highlighted red) plus the trip-length meter; Save is never blocked — CI blocks broken maps.
- Sim pauses while editing; leaving or saving restarts the map fresh.
- Kept from the prototype: undo, snap (hold ⌘ / always), top-down + 3D cameras, show-everything-built, moving an Area moves its stations, item list + inspector, walking inside the editor.
- Kept out of the release: code behind `import.meta.env.DEV` + dynamic import; CI fails if editor code appears in `dist/`.

## 15. Out of scope for v1

- Optional events — thief chase, timed delivery orders, random spills, Cleaner staff, and the **car event** (what a car wants and pays). They stay in the map's fog for after v1.
- Content for maps beyond Map 1 (layouts E, F, G and A–C are saved; Products, prices and order are not designed).
- Full map authoring in the editor; in-game Player customisation; translations; graphics quality setting.
- Monetization, analytics, any backend (cloud saves, leaderboards, accounts, multiplayer), stars/ratings/prestige/premium currencies/boosts, offline earnings.
- The original game's name, assets or branding.

## 16. Settled at assembly

No ticket covered these; the owner decided them on 2026-10-03 while this spec was being assembled.

- **Pad drain speed:** any Pad's full price drains in a fixed **~1.5 s**, with rising ticks and a ding at 0. With less Money than the remainder, it drains at that same rate until Money runs out. Same idea as the fixed-time Cash Pile drain.
- **Car Spots in v1:** the 3 bays are **painted on the road** (and the pickup tiles marked), but no cars come. Their data stays in the map so the car event can be added later without a layout change.
- **Exit Pad in v1:** when bought, the van bounces and honks, then the Maps picker opens showing Map 1 plus "coming soon" silhouettes. The van stays, and walking up to it reopens the picker. The Exit counts toward Completion like any Pad.
- **Shopping List:** uniform random. 1–4 Products (never more than are for sale), each a random unlocked Shelf's Product, 1–4 units each. This matches the estimator's 2.5-unit average.

## 17. Picked during the build (not decisions)

Music track, individual sound files, Player colour and hat, the logo drawing, Pad icons, Party Prop placement, the Player start spot, and every feel/juice/economy number above as play-testing tunes it.
