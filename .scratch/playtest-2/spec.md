# Wobbly Mart — playtest pass 2 spec

A **delta on [the v1 spec](../my-mini-mart-web/spec.md) and [the playtest-1 delta](../playtest-1/spec.md)**: everything they say still holds unless a section below replaces it. It settles what the owner's second playtest (with a friend, on the shipped playtest-1 build) asked for: free placement, battery use, tap-to-move, the mop, events, Stocker priorities, more levels and better tipping.

Assembled 2026-10-09 from every ticket on [the map](https://github.com/Seif-Sallam/Wobbly-Mart/issues/1) (GitHub issues, label `wayfinder:*`). Tickets hold the reasoning and the full detail; this file is the build's starting point. Where a later ticket changed an earlier one, this spec carries the **final** answer.

**Sources of truth this spec points to instead of repeating:**

| What | Where |
|---|---|
| Glossary (Edit Layout, Move, Tap Walk, Tipping, Mop, Mop Stand, Cleaner, Event, Delivery, Robbery, Thief Pan, Health Inspector; Trash Bin, Mess, Loose Item, Staff updated) | [`/CONTEXT.md`](../../CONTEXT.md) |
| Map 1 numbers: every Pad, Upgrade, Move and Event amount, expected buy times | [`price-table/price-table.md`](price-table/price-table.md) (regenerate: `python3 price-table/sim.py --table`) |
| Map 1 layout (1.5 m clearance rule, new spots) | branch `prototype/relayout-2m` → `maps/corner-shop/layout.ts`, **copy as-is** |
| Clearance rule in the map checker, `boxGap`, `trashed` event's `station` | branch `prototype/relayout-2m` (`src/sim/validate.ts`, `geometry.ts`, `tuning.ts`, `carry.ts`) |
| Area 3 requirements (`chicken_3`, `oven_2`, Stockers 5/2) and 3 free bins | branch `prototype/relayout-2m` → `maps/corner-shop/unlocks.ts` (prices from the price table) |
| Profiling numbers and tools | [`profile/profile.md`](profile/profile.md), `profile/probe.js`, `profile/run.mjs` |
| Playable references (`npm run dev`) | `prototype/tap-to-move` `?tap=A` · `prototype/stack-tipping` `?tip=C` · `prototype/camera-zoom` `?zoom=B` · `prototype/edit-layout` `?layout=A` · `prototype/cleaning-look` `?clean=C` |

Prototype code is throwaway: lift ideas and numbers, not the `*-prototype.ts` files, their `window.proto*` hooks or `PROTOTYPE` comments.

---

## Topics → where settled

| Topic | Section | Tickets |
|---|---|---|
| Frame time and battery | §1 | [Profile](https://github.com/Seif-Sallam/Wobbly-Mart/issues/3), [Battery budget](https://github.com/Seif-Sallam/Wobbly-Mart/issues/4) |
| Camera zoom | §2 | [Camera zoom](https://github.com/Seif-Sallam/Wobbly-Mart/issues/16) |
| Tap or click to move | §3 | [Tap or click to move](https://github.com/Seif-Sallam/Wobbly-Mart/issues/5) |
| Stack tipping | §4 | [Stack tipping](https://github.com/Seif-Sallam/Wobbly-Mart/issues/10) |
| Placement (Edit Layout, Moves) | §5 | [Placement upgrade](https://github.com/Seif-Sallam/Wobbly-Mart/issues/2), [Edit Layout mode](https://github.com/Seif-Sallam/Wobbly-Mart/issues/13) |
| Corner Shop layout, Area 3 order | §6 | [Re-lay out](https://github.com/Seif-Sallam/Wobbly-Mart/issues/14), [Area 3 order](https://github.com/Seif-Sallam/Wobbly-Mart/issues/11), [Trash Bins](https://github.com/Seif-Sallam/Wobbly-Mart/issues/12) |
| Mess, Mop, Cleaner, Trash Bin look | §7 | [Mop](https://github.com/Seif-Sallam/Wobbly-Mart/issues/6), [Cleaning fixtures look](https://github.com/Seif-Sallam/Wobbly-Mart/issues/17), [Trash Bins](https://github.com/Seif-Sallam/Wobbly-Mart/issues/12) |
| Stocker priorities, never stuck | §8 | [Stocker priorities](https://github.com/Seif-Sallam/Wobbly-Mart/issues/8) |
| Events | §9 | [Events framework](https://github.com/Seif-Sallam/Wobbly-Mart/issues/7), [Deliveries](https://github.com/Seif-Sallam/Wobbly-Mart/issues/20), [Robbery](https://github.com/Seif-Sallam/Wobbly-Mart/issues/18), [Health inspector](https://github.com/Seif-Sallam/Wobbly-Mart/issues/19) |
| Economy | §10 | [Economy re-tune](https://github.com/Seif-Sallam/Wobbly-Mart/issues/21) |
| More levels | §11 | [Level ladder](https://github.com/Seif-Sallam/Wobbly-Mart/issues/9) |

---

## 1. Rendering and battery

Measured today: the loop renders every frame even when paused (120 fps on 120 Hz screens, Chrome ~60–70 % CPU vs 3 % idle), GPU-bound at DPR 2 with a 2048² PCF shadow; draw calls over budget on a full store; sim ~0.1 ms, app UI ~1 ms per frame. Full numbers in [`profile/profile.md`](profile/profile.md).

**Defaults, every device**
- **Frame cap 60 fps.** The **title screen runs at 30 fps.** Paused behind an overlay: draw one frame, then **stop drawing** until something changes. Edit Layout draws only while something is dragged or the camera moves.
- **Pixel ratio capped at 1.5** (auto step-down to 1 on slow frames stays).
- **Shadows 1024², soft (PCF)**, desktop too.
- **Draw only what's on screen** (+ **3 m** margin; off-screen shadow casters still cast). Split the merged and instanced meshes (`station-batch.ts`, `instanced.ts`, `world-view.ts`; today one per material over the whole map, culling off) **per Area half** so culling works. No popping, no missing shadows.
- **Draw-call budget is a requirement**: a fully unlocked store stays within 300 (desktop) / 100 (phone) per `?debug`.
- **App UI** (`App.onFrame`: HUD, sounds, guidance, Completion) updates only when what it shows changes.

**Settings** (in `Settings`, `src/sim/save.ts`): **Zoom** (§2), **Frame rate** 60 / 30, **Battery saver** (off by default: forces 30 fps, pixel ratio 1, hard shadows; greys out Frame rate). No automatic detection.

**Check, not a gate:** after the build, re-run `profile/run.mjs` and record the numbers.

## 2. Camera zoom

Zoom = metres across the screen's short side (`Stage.viewSize`; today 20 everywhere). Numbers in `src/feel.ts`.
- Defaults: **phone (touch) 14 m, desktop 18 m.** Range **10–26 m.**
- **A Zoom slider as the first row of Settings** (+ left, − right, 0.5 m steps), styled like the toggles; the view behind the panel zooms live. Saved with the settings.
- Shortcuts too: **pinch** on touch (joystick off during a pinch and 150 ms after), **mouse wheel / + −** on desktop at 8 % per notch. Eases to the wanted zoom at 10/s. Edit Layout shares it.

## 3. Tap Walk (tap or click to move)

Alongside the joystick and keys, never instead. Steering feeds the same move/sprint intents as the joystick (target lives in `src/input/`; sim untouched). Numbers in `src/feel.ts`.
- A **tap** = press < **250 ms**, moved < **12 px**; longer presses and drags stay the joystick.
- **Floor**: walk there on the walk grid. **Pad**: walk onto its centre. **Station** (tap within **0.6 m** of its footprint): walk to its nearest side and stop **0.44 m** from its edge (max of 0.5 × reach and Player radius + 5 cm), so proximity does the action and it's the nearest Station. **Register**: walk **behind** it, 0.5 m past its back edge, centred.
- **Double-tap** (within **300 ms**) sprints for that walk.
- **Arrive**: ease off over the last **1.2 m** (push ≥ 0.2), head for the exact tapped point (not the cell centre), stop within **0.12 m**.
- **Cancel**: any joystick push > 0.15 or key, a new tap, or arriving.
- **Show**: a pulsing orange destination ring (0.6) drawn **above the floor tiles**; a soft yellow glow under a tapped Station; no path line.

## 4. Stack tipping

Replaces playtest-1's sprint-only drop rule. Above the **safe count** (Steady hands 3 → 4/5/6) only:
- Chance per second = `0.3 × share × jolt × k^1.2`, `k = (n − safe)/(cap − safe)`, **cooldown 1 s** between drops.
- `share`: **1** sprinting, **0.15** walking (> 0.5 m/s), **0** still. `jolt = 1 + 2 × min(1, jolt)` where jolt = |wanted − current velocity| / top speed — sharp turns and stops up to **3×**.
- The top Item falls (1.3 m behind, ±0.4 m side). It **breaks into a 1-Item Mess** with its Product's `breakChance` (new field in `catalog/products.ts`), else lands as a Loose Item: egg 0.9 · tomato 0.7 · flour 0.5 · milk 0.3 · ketchup 0.25 · wheat 0.05 · bread 0.05. Roll the break only when > 0.

## 5. Placement: Edit Layout and Moves

**Rules**
- **Movable**: bought Shelves, Registers (their Cashier spot and Queue Spots move and rotate with them), Machines, Crops, Animals. **Fixed**: the Office, doors, walls, Props, **Trash Bins**, the Mop Stand, every Pad.
- **Moves**: each Area bought adds **3** to one pool (Area 1's from the start; 9 per Map). Prices rise ($40 → $650, §10). **Not in Completion.** One Move = one fixture ending somewhere other than where it started the session (spot and/or rotation); shuffling within a session counts once; putting it back is free. **No reset to default, ever.**
- **Where**: any bought Area, same half (shop fixtures in shops, farm fixtures — incl. the Mill — in yards). 0.5 m grid, 90° turns.
- **Invalid**: overlap; **closer than 1.5 m** to any other Station or Pad footprint, bought or not (a Register and its own Cashier spot exempt) — `TUNING.clearance = 1.5`, also enforced on map data by the checker; within **1.5 m** of a door; blocking a Register's queue (or its queue hitting something); outside bought Areas or the wrong half; on drop, any Station unreachable on foot or a Shelf/Register unreachable for Customers from the Street.
- **Nothing breaks**: Items on Shelves/Trays stay, Machine timers run, Customers and Staff take new routes. Moving changes the paused World in place (Station `box`/`rot`, the layout place, the Cashier spot), rebuilds the walk grid, resets the view — never re-opens the Map.
- **Saved**: the per-Map layout and Moves used go in the save and Save Code.

**Edit Layout mode** (prototype `?layout=A`)
- Opened by **✎ Edit Layout** in a "Layout" section at the top of the **Office panel** (closes the Office). Game paused, joystick off, until Done or Cancel.
- **Camera**: the play camera where you stand, current zoom; dragging empty floor pans.
- **Tap a movable fixture**: its model lifts **0.35 m** as a gently bobbing ghost (original hidden) over a footprint plate, **green** / **red**. **Drag** it or **tap a floor spot**; **⟲ Turn** (R) and **↩ Put back** (Esc). Picking another fixture drops the current one. A drop on red sends it back with a red reason bar (~2 s), e.g. "Too close to the egg shelf: 1.2 m, needs 1.5 m", "Blocks a door", "Cuts off the ketchup shelf".
- **Bill card**: "Moves left: N · 2 Moves: $40 + $60 = $100 · next Move $90"; **✓ Done · $100** (greyed when over Moves or Money); **✕ Cancel** restores everything free.

## 6. Corner Shop layout and Area 3 order

**Layout**: copy `prototype/relayout-2m`'s `layout.ts` as-is. Same size (store 44 × 22, map 52 × 58), built to a 2 m gap so it passes the 1.5 m rule with room. Highlights:
- Shelf columns 5 m apart (Area 1 x = 5/10/15, Area 2 x = 20.5/25.5/30.5, bread x = 35.5/40.5), rows z = 7.5 / 12.5.
- Area 1 shop: Register `[12, 22.5]`, Cashier `[12.8, 24.2]`, Blender `[17.5, 18.5]`, `area_2` Pad `[18.75, 15.5]`.
- `blender_2` moves into **Area 2's shop** `[28, 18.5]` (trips to the ketchup Shelf 28.5 → 11 m).
- **Trash Bins**, one per Area, **free**, **fixed**, all against the **north wall** (never the south wall — the low camera-side wall hides them): `trash` `[18.75, 4.5]`, `trash_2` `[32.9, 4.5]`, `trash_3` `[46.5, 4.5]`. Area 1's is there from the start, the others with their Area. Stockers use one only as a last resort (§8).
- **Mop Stand** `[9.5, 18.5]` inside the **Office room** by its door.
- **`chicken_3`** `[40, 28.5]` in Area 3's yard. **Cleaner Pad** `[45.5, 16]` in Area 3's shop.
- Stocker Pads Area 2 `[22,19]` `[25,19]` `[22,22]`; Area 3 `[35,20]` `[38,20]` `[41,20]`; `register_2` `[44, 22.5]`, `cashier_2` `[44.8, 24.2]`; `area_3` `[32, 18]`.

**Area 3 order** (`unlocks.ts`):

```
area_3 ─► bread_shelf ─► oven ─┬─► register_2 ─► cashier_2
                               ├─► stocker_5                 (was on area_3)
                               ├─► mill_2 ─┬─► stocker_2     (was on oven)
                               │           └─► flour_shelf_2
                               ├─► chicken_3                 NEW third Coop (eggs ran short with two Ovens)
                               ├─► cleaner                   NEW optional (§7)
                               │   oven_2 ◄── mill_2 + chicken_3   (no longer blender_2)
                               │     ├─► bread_shelf_2, stocker_6, exit
                               └─► blender_2 (optional leaf) ─► ketchup_shelf_2
```

Completion's total grows by the new Pads and Upgrade levels (`chicken_3`, `cleaner`, Mop speed ×2).

## 7. Mess, Mop, Cleaner and the cleaning fixtures

**Rules**
- **Every Mess needs the Mop** — dropped carts, tipped baskets, broken Items (§4). Walking over a Mess **no longer cleans it**. Loose Items unchanged.
- **Mop**: the Mop Stand holds **one**, the Player's. Take it by walking past the stand **with an empty Stack**; while held **nothing can be picked up** (transfers blocked like manual grab). It goes back **only when the Player walks it back** to the stand — never by itself. Holding it doesn't slow you.
- **Cleaning**: stand on the Mess with the mop for **2 s** (Mop speed Upgrade: 1.5 → 1.0 s); walking off keeps progress.
- **A waiting Mess**: slows Customers to 0.5× (as today) and the **Player and Staff to 0.7×**; Customers in it lose patience **1.5× faster**.
- **Cleaner**: a **Staff** kind bought on an **optional Pad in Area 3** (`cleaner`, needs `oven`). Brings and always carries **its own mop** (the stand still shows only the Player's). Walks only: a flat **2 m/s** wandering the bought shop floors and mopping random spots for show, **4 m/s** heading to the nearest Mess; no Upgrade changes either. Cleans in **1.5× the Player's time** (3 s base). There is **no Clean role** for Stockers; **More mops** doesn't exist.

**Look** (prototype `?clean=C`; colours to `src/palette.ts`, timings to `src/feel.ts`):
- **Mop Stand**: a blue two-shelf **janitor cart** on four wheels, grey posts, a teal spray bottle, a yellow A-frame **"WET"** sign beside it; the Player's mop stands in it when free.
- **Mop in hand**: wooden stick, grey clamp, white strand head at the side; **swishes side to side** while cleaning; a puff when taken or returned.
- **Mopping**: a light-blue ring fills around the Mess; ~10/s white **suds** rise; the Mess **shrinks to 25 %**; a **sparkle pop** (white puffs + pad-yellow) when done.
- **Stink**: three **buzzing flies** with flapping wings circle each waiting Mess (~0.45 m) plus two short rising green stink lines.
- **Grumpy bubble**: over a Customer standing in a Mess, **beside their receipt card** (to its right on screen, never overlapping): cream card with a scowl and **💢**, redder, 25 % bigger and shaking over **4 s**, fades **0.6 s** after they step out. Size 0.75 m.
- **Trash Bin**: a **pink pedal bin with a smiley face**, cream lid hinged at the back, a pedal (code-built; replaces Kenney `furn/trashcan`). Standing on it: the **lid opens 1.1 rad and wobbles**, an **orange ring** fills over the 1.5 s hold; Items fly into **the bin used**; walking off **slams the lid** with a squash and a puff.
- **Cleaner cap**: **yellow** `#f2c230` (Staff colour like the Cashier's white).

## 8. Stocker priorities

Fixes the stuck Stocker (Oven full of eggs, no flour: it froze holding an egg).
- A Producer input **inherits the demand of the final Product it ends up making**, at any depth. Final demand: Customers waiting at an empty Shelf > Customers heading to it > Shelf emptiness.
- **Tiers** (distance breaks ties within a tier): 1 empty Shelf with Customers waiting · 2 the **bottleneck input** (furthest from a full batch) of a Producer feeding a tier-1 Product · 3 low Shelves by fill, **and parked Delivery orders** (§9) · 4 other inputs by final demand · never: inputs to a Producer whose Tray is full or whose output nobody downstream needs.
- **Leftovers**: keep them and take other jobs with spare room (they drop off as soon as a sink takes them); if the **whole Stack** is leftovers for **10 s**, put them back on a Tray of that Product with room; else the **Trash Bin** as the last resort. Stockers never make Loose Items. Every rethink yields something: a job, a Tray return, the Trash, or waiting empty-handed.
- Same tiers for every role, filtered by role (Goods → Shelves and Delivery orders, Machines → Producer inputs, Auto → all).

## 9. Events

**Framework**
- An **Event**: warning → running phase with a timer → reward if handled / cost if ignored. Map data lists each Map's Events and unlocks. Paid in **Money and Items only** (never Completion, no reputation).
- **Seeded random rolls** gated by purchases: **Deliveries** once Area 1's first Shelf is bought; **Health Inspector** and **Robbery** once Area 2 is bought.
- **Deliveries never block**: one car per free Car Spot, a new car every **3–4 min** per free spot. **Robbery and the Inspector are Player-bound**: one at a time, **3–5 min** random gap. No Event in the first **3 min** after an Opening; timers run only unpaused.
- **Show**: a banner sliding in from the top (icon, name, one line) with a sound sting, an **edge arrow** to where it happens (the angry-Customer arrow), a HUD card with a timer bar and progress; outcome pops "+$X" / "−$X".

**Deliveries** — cars at the Car Spots (3 on the Corner Shop)
- Order: **1–3 Products** on sale, same count each; **3–6 / 5–9 / 7–12 Items** with 1 / 2 / 3 Areas bought.
- Timer **90 s + 10 s per Item**; an order card (receipt style, ×n left, ticks) with a timer ring over the car; at **15 s** left it honks and the ring turns red.
- Stand on the pickup tile: the Stack **drains into the car like a Shelf** (wanted Items only). Partial is fine; on timeout it pays delivered Items at plain Sale Price and leaves, no fine.
- Complete: **1.5× Sale Price**; within the first half of the timer, a tip up to **+25 %** ("+$X tip").
- Auto and Goods Stockers fill orders (§8).
- Cars: code-built, wonky, a new colour each time; bounce on parking, a happy/impatient face in the windshield, honk, drive off with an exhaust puff.

**Robbery** — Player-only, can't be ignored
- A **Thief** walks in like a Customer but with a **beanie and striped shirt** and **no receipt card**.
- Takes up to **5 Items** from the **fullest Shelf** (2 s), or **half** of a Cash Pile over the threshold (§10). Never steals from an empty store.
- **Thief Pan**: the moment they grab, the camera pans to them, the game **freezes 0.5 s**, then returns to the Player; the banner, arrow and sting fire with it. An **evil laughing-face bubble** ("HA HA HA") rides over them for the getaway.
- Runs **6.5 m/s** to the nearest customer door (faster than the walk, slower than Sprint); Messes slow them like a Customer; Staff and Customers ignore them.
- **Caught** (within 0.8 m before the door): comic tumble + "no!"; Items fly back onto their Shelf / cash onto its Cash Pile; **bounty** pop. **Escaped**: the goods are gone ("−$X" at the door), nothing else.

**Health Inspector** — Player-bound, can't be ignored
- **15 s warning** banner with countdown and an edge arrow to their front door; the visit clock starts when they step in.
- Route: **4–6 random stops** among bought shop Stations (Shelves, Registers, indoor Machines), **5 s** each scribbling, walking at **Customer speed 2.6 m/s**, a different route every visit (~60 s); they step around Messes.
- **Escort**: a dashed **5 m** circle on the floor, red when the Player is outside. Outside, they stop, tap their foot, and a **clock ring** fills over **15 s** → a red **"BAD REVIEW"** stamp, the fine pops, they storm out.
- Look: code-built grey suit, round glasses, bowler hat, clipboard; at each stop a ✓/✗ bubble (✗ if a Mess or Loose Item within 4 m) — flavour only.
- **End of visit** (mopping during the visit counts): a 3 s report card — **Spotless ★★★** + random incentive, or "2 Messes, 1 Loose Item: −$Y" (per-dirt fine). **Bad review**: the per-dirt fine **plus** the review fine, even if spotless.

## 10. Economy

All numbers in [`price-table/price-table.md`](price-table/price-table.md). Estimator: **100 % in 32.4 min** of good play (trips 15.7 m on the new layout; walking tips; new Area 3 order). Bot: **97.9 simulated min** on the new layout (gate 4 h).

| New or changed | Price |
|---|---|
| `chicken_3` | $750 |
| `cleaner` (optional) | $900 |
| `blender_2` (optional leaf) | $525 |
| Mop speed (appears with `area_2`) | $100 / $175 |
| Moves 1–9 | $40 · $60 · $90 · $150 · $200 · $275 · $400 · $525 · $650 |

| Event | Area 2 | Area 3 |
|---|---|---|
| Inspector spotless incentive | $100–200 | $300–600 |
| Inspector fine per Mess / Loose Item | $20 | $60 |
| Inspector bad review (on top) | $150 | $450 |
| Robbery bounty | $40 | $120 |
| Robbery grabs half a Cash Pile over | $150 | $400 |

Deliveries: 1.5× Sale Price + up to 25 % tip (≈ +18 % income in Area 1, +8–11 % later). Events aren't in the estimator.

## 11. Level ladder (for later efforts)

Four Maps; same loop everywhere — twists come from **Event frequency** and **layout efficiency**. 7–10 Products on sale per Map, chains ≤ 3 steps, growth by **width** (one input → several Machines, combination recipes), one Recipe per Producer, 1–2 familiar Products kept per Map. **Nothing carries over** that affects play (Money, Upgrades, Staff, Moves, layout are per Map); you keep the Map, its Completion and Party Props.

| # | Map | Twist | Products on sale |
|---|---|---|---|
| 1 | Corner Shop (exists) | learn the loop; all Events gently | tomato, egg, ketchup, wheat, milk, flour, bread |
| 2 | Juice Bar | **Deliveries** often + a 4th Car Spot | apple, orange, apple juice, orange juice, sugar, candy apple, strawberry, milk, smoothie |
| 3 | Dairy Farm | **Inspector** often | wheat, milk, butter, goat milk, cheese, goat cheese, strawberry, egg, ice cream, pudding |
| 4 | Pizza Place | **Robbery** downtown + a tight, odd store | tomato, pizza sauce, flour, dough, olives, pizza, veggie pizza |

Recipes, Areas and the ~18 new Producer types are in the [Level ladder ticket](https://github.com/Seif-Sallam/Wobbly-Mart/issues/9). **Building Maps 2–4 is out of scope** for this pass.

---

## Build notes

- **Bug**: `StationBatch.clear()` resets slots but not their scales — a hidden slot stays shrunk after a view reset (seen as a moved fixture vanishing while its shadow stayed). Reset the scales.
- The `trashed` event carries the bin's `station` so Items fly into the bin used.
- Sim stays deterministic: every new roll (break chance, Event rolls, Delivery orders, inspector routes) uses the seeded RNG; skip the roll when a chance is 0 so seeded runs stay stable.
- Feel numbers → `src/feel.ts`; gameplay numbers → `src/sim/tuning.ts` / catalog / map data; colours → `src/palette.ts`.
- **Save**: bump the save version for the new fields (per-Map layout, Moves used, Settings: zoom, frame rate, battery saver); old saves load with defaults.
- **Tests** (Vitest, broad flowing tests):
  - Validator test covers the 1.5 m clearance message (on `prototype/relayout-2m`).
  - Opening test: Completion's total grows with the new Pads/Upgrade levels (80 on the branch before the Cleaner and Mop speed).
  - Late-game flowing test gains: the Oven-full-of-eggs case (a Stocker brings flour within N s, no Stocker idle holding Items > 12 s); the Sprint-drop step pins a Product with break chance 0 (or asserts the Mess path); a Mess survives walking over it and is cleaned with the Mop; a Delivery order filled by a Stocker.
- **Bot**: walks (now can tip), still reaches 100 % in the 4 h gate.

## Out of scope

- Building Maps 2–4 (layouts, exact recipes, prices, the new Producer models) — later efforts starting from §11.
