# Wobbly Mart — playtest pass 3 spec

A **delta on [the v1 spec](../my-mini-mart-web/spec.md), [the playtest-1 delta](../playtest-1/spec.md) and [the playtest-2 delta](../playtest-2/spec.md)**: everything they say still holds unless a section below replaces it. It settles what the owner asked for after the third playtest (on `release-02` with all four Maps): steadier Stacks, take-first at Producers, phone landscape, a sharper sprint camera, Delivery orders on the HUD, a Closed switch, Debt from repeat Bad Reviews, Objectives / Challenges / Score / Stats, a Wardrobe for the Player's look, Staff icons, and a Tutorial Map that replaces the Corner Shop's step tutorial.

Assembled 2026-10-18 from every ticket on [the map](https://github.com/Seif-Sallam/Wobbly-Mart/issues/75) (GitHub issues, label `wayfinder:*`). Tickets hold the reasoning and the full detail; this file is the build's starting point. Where a later ticket changed an earlier one, this spec carries the **final** answer.

**Sources of truth this spec points to instead of repeating:**

| What | Where |
|---|---|
| Glossary (Lesson, Tutorial Map, Objective, Challenge, Score, Stats, Closed, Completion, Bad Review, Debt — all merged into `release-02`) | [`/CONTEXT.md`](../../CONTEXT.md) |
| Player looks: packs, rig, clips, per-pack folders | [`research/player-models` → `.scratch/research/player-models.md`](https://github.com/Seif-Sallam/Wobbly-Mart/blob/research/player-models/.scratch/research/player-models.md) |
| Tutorial Map layout (shape A, `trail`) | branch `prototype/tutorial-layout` → `maps/tutorial/shapes.ts` |
| Playable references (`npm run dev`) | `prototype/grab-priority` `?grab=b` · `prototype/area1-tipping` `?tip=b` · `prototype/landscape` `?land=C3` · `prototype/sprint-camera` `?cam=C&joy=J3` · `prototype/delivery-hud` `?dhud=A` · `prototype/staff-looks` `?gallery=1` · `prototype/score-ui` `?score=B&play` (`&land=C3`, `&gallery=1`) · `prototype/character-select` `?look=A` · `prototype/tutorial-layout` `?map=tutorial&tlayout=A` |

Prototype code is throwaway: lift ideas and numbers, not the `*-prototype.ts` files, their `window.proto*` hooks or `PROTOTYPE` comments. The one exception is the Tutorial Map's shape A layout, which is lifted into `maps/tutorial/layout.ts`.

---

## Topics → where settled

| Topic | Section | Tickets |
|---|---|---|
| Machine input caps, Inspector stop time, idle Stockers | §1 | charting decisions (map Notes) |
| Take first at Producers | §2 | [Taking before giving at Producers](https://github.com/Seif-Sallam/Wobbly-Mart/issues/76) |
| Gentler Tipping | §3 | [Gentler Tipping in each Map's first Area](https://github.com/Seif-Sallam/Wobbly-Mart/issues/77) |
| Phone landscape, joystick modes, fullscreen | §4 | [Landscape on phones](https://github.com/Seif-Sallam/Wobbly-Mart/issues/84) |
| Sprint camera, joystick feel, Manual grab on phones | §5 | [Sprint camera lag and joystick size](https://github.com/Seif-Sallam/Wobbly-Mart/issues/85) |
| Delivery cards on the HUD, tap to walk | §6 | [Delivery orders on the HUD, tap to walk there](https://github.com/Seif-Sallam/Wobbly-Mart/issues/86) |
| Closed | §7 | [Closed: the switch and what it shows](https://github.com/Seif-Sallam/Wobbly-Mart/issues/81) |
| Repeat Bad Reviews and Debt | §8 | [Repeat Inspector bad reviews: fines below $0](https://github.com/Seif-Sallam/Wobbly-Mart/issues/88) |
| Objectives, Challenges, Score, Stats: rules and numbers | §9 | [what they are](https://github.com/Seif-Sallam/Wobbly-Mart/issues/80), [Objective lists and Challenge numbers per Map](https://github.com/Seif-Sallam/Wobbly-Mart/issues/94) |
| … where they show | §10 | [Objectives, Challenges, Score and Stats: where they show](https://github.com/Seif-Sallam/Wobbly-Mart/issues/93) |
| Player look (Wardrobe) | §11 | [Player models we have or can get](https://github.com/Seif-Sallam/Wobbly-Mart/issues/82), [Character selection screen](https://github.com/Seif-Sallam/Wobbly-Mart/issues/83) |
| Staff icons, Cashier at work | §12 | [Staff looks](https://github.com/Seif-Sallam/Wobbly-Mart/issues/87) |
| Tutorial Map | §13 | [mechanics, order and pauses](https://github.com/Seif-Sallam/Wobbly-Mart/issues/78), [layout](https://github.com/Seif-Sallam/Wobbly-Mart/issues/79), [a Lesson for Objectives, Challenges and Score](https://github.com/Seif-Sallam/Wobbly-Mart/issues/95), [first save, Lesson 9 move and title card](https://github.com/Seif-Sallam/Wobbly-Mart/issues/103) |

---

## 1. Small rule changes (decided while charting)

- **Machine input caps 4 → 6.** Every Producer then takes 6. The eight at 4 in `catalog/producers.ts`: `oven`, `candy_pot`, `smoothie_blender`, `ice_cream_maker`, `pudding_pot`, `dough_mixer`, `pizza_oven`, `veggie_pizza_oven`. With all at 6, drop the per-Producer `inputCap` field and use one catalog default, unless a Map overrides it.
- **Health Inspector stop** `TUNING.events.inspector.stopTime` 5 → **3** s. Everything else about the escort stays.
- **Idle Stockers wander.** A Stocker with no job strolls between spots near the Stations its role serves (Goods → Shelves, Machines → Producers, Auto → both), at **2 m/s** (half its working pace; the Cleaner's `wanderSpeed`), spots snapped to the Cleaner's 4 m wander grid, within **3 m** of a served Station. It drops the stroll the moment a job appears (next rethink). Reuse the Cleaner's wander code. Numbers go in `TUNING` (`stocker.idle`). The Cleaner already wanders; Cashiers stay at their Register.

## 2. Take first at Producers

At an **Animal or Machine**, the Player takes the whole Tray onto the Stack first (while there's room), **then** Auto Grab Mode loads the Stack's inputs. No give gate, no separate input.

- Build: in `transferTick` (`src/sim/carry.ts`), when the Player stands at a Producer with Items on its Tray and Stack room, the pick-up runs before drop-offs, same pick pacing.
- Unchanged: Manual Grab Mode, Shelves, Trash Bins, Delivery pickups, every Stocker rule.

## 3. Gentler Tipping (every Area, every Map)

- `TUNING.base.safe` 3 → **5**; Steady hands levels `[4, 5, 6]` → **`[6, 7, 8]`** in all four `maps/*/upgrades.ts` (levels are absolute). Stack cap unchanged.
- `TUNING.tip.walkShare` 0.12 → **0.03**. Sprint share, `maxRate`, `curve`, jolt and break chances unchanged.
- Stockers follow on their own (they read `base.safe` and `walkShare`).
- Rough feel: Player sprinting with 6 of 8 goes from ~9.7 to ~4.8 drops/min.

## 4. Phone landscape

"Phone" = touch screen. "Landscape" = a phone wider than tall. **Portrait stays fully supported.** Tuned on the owner's phone; preset C3.

**HUD (landscape)**
- One compact cluster in the **top-right corner**: Completion bar (100 px), Money, 🏆 (§10) and the gear in a row. The HUD scales to **0.8×** the HUD-size setting.
- Event cards (and Delivery cards, §6) move to the **top-left**. Event banners slide in from the right at **0.7×**; the report card and Lesson cards also 0.7×.
- `env(safe-area-inset-*)` pads every edge element, notch side included.
- Portrait keeps today's top bar.

**Screens** (title, menus, Settings, Office, Edit Layout, Logbook, Wardrobe)
- Phones shrink them: **0.68×** landscape, **0.85×** portrait.
- Sizes in `%`, never `vw`/`vh` (Chrome scales viewport units by `zoom`, Safari doesn't).
- Title, landscape: one centred column — logo `min(400px, 55%)`, then the Map shelf, then Play; fits a 390 px-tall screen.
- Pause menu, landscape: buttons in a row. Settings, landscape: two columns, no scrolling. Dialogs still too tall scroll inside the screen.
- Office: landscape a right-hand panel **42 %** wide (the camera nudge follows its width); portrait a bottom sheet **46 %** tall.

**Camera and Pads (landscape)**: view **15 m** across the screen height; the Player sits **0.05** view-widths right of centre; Pads **1.25×**.

**Joystick: new Settings row "Joystick: Fixed / Free / Off"** (touch only, default **Fixed**, saved in `Settings`)
- *Fixed*: landscape draws it bottom-left (115 px, centre 110 px from the left and 130 px from the bottom, plus safe area); only the left **45 %** of the screen drives it. In portrait Fixed acts like Free.
- *Free*: appears under the thumb. Landscape: starts only in the left 45 %, with a faint ring at its resting spot. Portrait: starts anywhere.
- *Off*: no joystick, Tap Walk only.
- With Fixed or Free, **floor taps never walk**: Tap Walk exists only when the joystick is Off. (HUD Delivery taps still walk, §6.)
- A thumb on the joystick plus a second finger is never a pinch.
- Sizes and the sprint ring are in §5.

**Action buttons: none.** Grab stays automatic on phones by default (Manual grab is opt-in, §5).

**Fullscreen**
- On a phone, Play on the title goes fullscreen.
- In game, leaving fullscreen pauses behind a **"Tap to play fullscreen"** card; tapping it re-enters fullscreen and resumes.
- Settings keeps the Fullscreen button (so a player can leave to close the game).
- No card on iPhone Safari (no Fullscreen API) or in the installed app.

## 5. Sprint camera, joystick feel, Manual grab on phones

**Camera follow** (walking and sprinting alike; numbers in `src/feel.ts`)
- `followSharpness` 9 → **14**.
- Lead = **0.25 s** of velocity (replaces `lookAhead` 0.44), **capped at 1.5 m**, eased in at **3/s**.
- No zoom change while sprinting.

**Joystick**
- Sizes: **110 px** portrait, **115 px** landscape.
- Sprint at **1.5×** the ring (replaces both today's 1.4 and §4's prototype 1.2).
- The sprint threshold is drawn as a **dashed ring** around the stick; solid orange with a soft glow while sprinting.
- **Full walk speed at 0.6** of the ring: speed rises linearly 0 → full from 0 to 0.6.

**Manual grab on landscape phones**
- Settings shows "Manual grab" on phones too, opt-in, off by default.
- On, in landscape: holding a finger anywhere **right of the joystick zone** acts as Space on desktop (Items move only while held), with a faint **44 px** ring under the finger. In portrait the setting does nothing.
- Update `CONTEXT.md`'s **Grab Mode** ("the only mode on mobile") to match, in the same PR.

The paused-redraw blur on phones was fixed separately ([#97](https://github.com/Seif-Sallam/Wobbly-Mart/issues/97)).

## 6. Delivery cards on the HUD

**Look**: one card per waiting Delivery replaces today's van card, in the event-card spot (top-left in landscape). Van icon, then each order line's Item icon with `got/want` under it (✓ and dimmed once full; pops when an Item lands), a timer bar below. From the honk on, the card turns red and shakes.

**Tap**
- Tap a card: walk to that car's pickup tile. Double-tap (within **320 ms**) or a second tap during the walk: run (Sprint).
- Works in **every joystick mode** — a HUD tap isn't a floor Tap Walk.
- Any joystick or key push cancels it, as Tap Walk does. It also ends when the car leaves.
- **Auto Grab is paused for the whole walk** until the Player is within reach of the target pickup tile, so nothing is unloaded or picked up en route. Plain shortest route, no detour. Walking over a Pad still pays into it.
- **Route line**: a dashed orange line on the floor from the Player to the pickup tile while walking; gone on arrival or cancel.
- The walk target and grab pause live in `src/input/` / intents (the sim gets a "grab paused" intent), as Tap Walk does today.

## 7. Closed

- **Switch**: in the **Office** only — a top row of the Office panel, **Close store** / **Open store**.
- **Waits**: once Closed, no reopening for **30 s**; after reopening, no closing for **5 open minutes**. The button greys out with a countdown ("Close again in 3:12"). Neither wait is saved: every Opening starts Open with no wait.
- **Length**: as long as the Player likes.
- **Customers**: no new ones appear on the Pavement. Those already on it still come in; everyone inside shops normally, anger and Mess included.
- **Events**: running Robbery / Inspector visits finish; only the timers that start new ones pause, resuming on reopening. **Deliveries keep their usual pace**; a parked car keeps its own timer. **Delivery-only is dropped.**
- **Challenges**: none offered; a running one pauses (§9).
- **Shows**: a **CLOSED board** on the shop's front wall; the front doors shut once the last Customer is inside or gone; a fixed **CLOSED badge** near Money on the HUD.
- **Stat**: "times Closed", per Map and whole game, saved. Feeds no Score and no Objective.
- Tutorial Map: the Office row stays hidden until Lesson 12 (§13).

## 8. Repeat Bad Reviews and Debt

- **Counts**: only a **Bad Review** (the Player left the Inspector alone 15 s in total). Escorting through a dirty store is just a fine.
- **Streak**: Bad Reviews in a row, **per Map save** (saved with that Map's Money and Pads; survives reloads and Openings).
- **Reset**: escorting one visit to the end without a Bad Review sets it to 0, however dirty.
- **Fine**
  - 1st in a row: today's fine (per-dirt + review fine), still stopping at $0.
  - 2nd and later: the review fine **×2** (no further growth) plus dirt, **not capped** at Money. No floor on Debt.
  - Build: `score()` in `src/sim/inspector.ts` drops `Math.min(w.money, fine)` when the streak before this visit is ≥ 1, with a ×2 review fine.
- **Debt blocks** all buying (Pads, Upgrades, Moves) — already true (`src/sim/player.ts` Pads stop draining at ≤ $0; Upgrades and Moves need Money ≥ cost). Nothing else: Staff keep working, no game over, no interest; checkouts pay it back.
- **Shows**: HUD Money in red with a minus sign while in Debt; report card "BAD REVIEW ×2 · −$X · in debt"; while the streak is ≥ 1, the Inspector's warning card adds "Ignore them again and the fine can put you in debt."; Pads and Upgrades show their usual can't-afford state.

## 9. Objectives, Challenges, Score, Stats

### Stats
Per Map and for the whole game (whole game = sum over Map saves plus play time; computed, not stored twice). Saves from before this update start at 0. Counted in the sim from events it already raises.
- Items: made per Product, sold per Product, trashed, fallen off a Stack as Loose Items
- Messes: made (Tipping, angry Customers, tipped baskets) and cleaned
- Money: earned (checkouts, Deliveries, Event rewards, Challenge bonuses) and paid in fines
- Customers: served and gave up
- Deliveries: filled completely, partly, missed
- Robbery: caught, escaped · Inspector: spotless, fined, Bad Review
- Challenges: won, failed · times Closed (§7) · play time

### Objectives
- A fixed goal on a Map, done once, kept in the save; shows progress counted from Stats.
- Shared kinds in `catalog/`: **sell N of a Product**, **earn $N**, **fill N Deliveries completely**, **own a Pad or Area**. (Catch Thieves / spotless inspections / reach N % are not used: Objectives are only what normal play reaches on its own.)
- **Each Objective counts toward Completion like one Pad**: Completion = Pads + Upgrade levels + Objectives, equally weighted (`completionOf` in `src/sim/economy.ts`). 100 % needs every Objective. The Exit Pad is unchanged, so moving on is never blocked.
- **10 per Map** (map data):

| | Corner Shop | Juice Bar | Dairy Farm | Pizza Place |
|---|---|---|---|---|
| Sell | 100 Tomatoes | 100 Apples | 100 Milk | 75 Tomatoes |
| Sell | 150 Eggs | 150 Apple Juice | 150 Butter | 125 Pizza Sauce |
| Sell | 100 Milk | 150 Orange Juice | 125 Cheese | 75 Olives |
| Sell | 150 Ketchup | 100 Candy Apples | 75 Ice Cream | 75 Pizzas |
| Sell | 75 Bread | 50 Smoothies | 50 Puddings | 50 Veggie Pizzas |
| Earn | $5,000 | $6,000 | $8,000 | $5,000 |
| Earn | $20,000 | $24,000 | $30,000 | $20,000 |
| Fill Deliveries completely | 4 | 4 | 3 | 2 |
| Own | `oven` | `smoothie_blender` | `pudding_pot` | `veggie_pizza_oven` |
| Own | `area_3` | `area_3` | `area_3` | `area_3` |

### Challenges
- Short, timed, optional. **One at a time**, offered every **3–5 min** (seeded) after the Opening's quiet start; starts on its own with the stamp and ring timer (§10); runs alongside Events.
- **Never offered when impossible right now** — per kind: *check out* needs an owned Register and the store Open; *no new Mess* always; *fill a Shelf* picks an owned Shelf that isn't full; *make N* picks a Product an owned Producer makes; *sell N* picks a Product on an owned Shelf; *finish a Delivery* only while a car waits with more than T s left.
- **Closed or paused**: none offered; a running one's timer pauses.
- **Win**: Score + Money bonus. **Fail or ignore**: costs nothing.
- **The same table on every Map** (`TUNING` / catalog), by Areas bought:

| Challenge (weight) | Area 1 | Area 2 | Area 3 |
|---|---|---|---|
| Check out N Customers in 90 s (×3) | 4 | 8 | 12 |
| No new Mess for T s (×2) | 60 | 90 | 120 |
| Fill a named Shelf to full in T s (×2) | 45 | 45 | 45 |
| Make N of an owned Product in 60 s (×2) | 4 | 6 | 8 |
| Sell N of a Product in 90 s (×2) | 4 | 6 | 10 |
| Finish a Delivery with ≥ T s left (×1) | 30 | 30 | 30 |
| **Money bonus** | **$60** | **$120** | **$360** |

Price tables stay as they are; the bot never plays Challenges (winning them all reaches 100 % ~15 % sooner, accepted).

### Score
Per Map; the game's total is the sum over Maps. **Never goes down**; failures and fines never touch it; resets only with that Map's save. Points in `TUNING`:

| Earns Score | Points |
|---|---|
| Objective done | 100 |
| Challenge won | 50 |
| Delivery filled completely | 20 |
| Thief caught | 30 |
| Spotless inspection | 30 |
| Each 25 % of Completion (first time reached) | 250 |

## 10. Where Objectives, Challenges, Score and Stats show (preset B, Trophy + Logbook)

**HUD**: a round **🏆** button beside the gear with a small **⭐ badge** under it showing this Map's Score. Portrait: just left of the gear. Landscape: in the corner cluster (Completion · Money · 🏆 · gear). No other Score readout.

**Challenge**
- A big **"CHALLENGE!"** stamp mid-screen (~1.2 s, scales in, fades).
- Then a **ring timer** at the top centre (below Money in portrait, very top in landscape, clear of the corner HUD): empties as time runs (green; red in the last 10 s), progress inside (`3/8`, or seconds left for "no Mess" / "fill the Shelf"), a small label under it with the Challenge's icon and short name. Ring ~64 px (`src/feel.ts`).
- Won: toast "Challenge won! · ⭐ +50 · $40" and the badge bumps. Failed: a short "Time up" toast.

**Objective done**: a card pops mid-screen (icon, "Objective done!", name, "⭐ +100"), holds ~1.3 s, flies and shrinks into 🏆; the badge counts up and bumps.

**Logbook** (🏆): full-screen panel; **the game pauses while it's open**.
- Header "📖 <Map name>" with this Map's ⭐ Score; line "Game total 🏆 N · x/y Objectives".
- Tabs: **Objectives** · **This Map** · **Whole game**.
- Objectives: grid of tiles — icon in a progress ring, name, `got/want`; done tiles turn green with "✓ +100" and sort to the end.
- Stats: small grouped cards (Items, Messes, Money, Customers, Deliveries, Robbery, Inspector, Challenges, Play time).

**Title screen**: a 🏆 plaque under the logo with the game's total; each visited Map card wears a ⭐ ribbon (top-right) with its Score (locked cards none; the Tutorial card none); a 🏆 round button beside ★ Credits and ⚙ opens the Logbook on **Whole game**.

**Pause menu**: a new **Title** button below Settings — saves, tears down the Opening and returns to the title with the current Map as the stocked backdrop (share the title setup as `showcase()` in `src/app/app.ts`, as on the branch).

Sounds for the stamp and fly-in: reuse existing UI sounds; picking new ones is [#42](https://github.com/Seif-Sallam/Wobbly-Mart/issues/42).

## 11. Player look: the Wardrobe

**Assets**: all **20** Kenney CC0 mini-rig looks (same 7-bone rig, the 5 clips the game plays): the 9 in the repo, 3 more from Mini Characters (`female-e`, `female-f`, `male-e`), 8 from Mini Arcade, Mini Skate, Mini Dungeon, Mini Arena and Mini Forest. One asset-table row each plus `optimize-models.ts`. **Each extra pack in its own `public/models/chars-<pack>/` folder** (every pack's material is `colormap` with a different texture; `loadAssets` shares materials per folder). Credits updated. **Load every look at start** (~120 KB each).

**Screen** (preset A)
- A round **👕** button on the title opens the panel: big live preview on the left (turning gently, waving on each pick), one scrolling grid on the right with three sections — **Shop** looks, **Fun** looks, **Cap**. **Back** closes; **Select** saves look and cap colour together. Picking a tile never resets the grid's scroll.
- **Drag the preview sideways** to turn it (0.6°/px), spinning on after release and slowing at 3/s; once dragged, the idle sway stops until the next pick.
- **First run**: opens by itself when there is no save. Otherwise the last pick is used.
- **One choice for the whole game** (global save, not per Map). Staff keep their own models.
- **Shop (16)**: the 12 Mini Characters, Gamer, Arcade kid, Skater, Skater girl. **Fun (4)**: Adventurer, Orc, Soldier, Archer. All free.
- **Customer looks allowed**; their tiles carry a small "Customer" tag; the cap tells the Player apart.
- **Cap**: always on for Shop looks, none on Fun looks; may overlap a look's own hat. 9 colours: orange, red, yellow, green, blue, purple, pink, black, white (into `src/palette.ts`). Picking one recolours the preview and every portrait.
- **Cap fit** `[up, forward, size, tilt°]` from the model's top; unlisted looks `[0, 0, 1, 0]`: `female-a [-0.155,0,1,0]`, `female-b [-0.075,0,1,0]`, `female-c [-0.155,0,1,0]`, `female-d [-0.17,0,1,0]`, `female-e [-0.075,0,1,0]`, `female-f [0.015,0,1,0]`, `male-c [-0.035,0,1,0]`, `male-d [-0.075,0,1,0]`, `arcade [-0.095,0,1,0]`, `skate-girl [-0.075,0,1,0]`.
- Preview numbers (`src/feel.ts`): camDist 4.2, camHeight 1.1, lookY 0.62, fov 30, sway 30°/s, thumb 76 px.

**Buttons feel alive everywhere** (not just here): tiles lift and wiggle on hover, every button squishes on press, a picked tile pops. One shared CSS treatment in `src/ui/style.css`.

## 12. Staff icons and the Cashier at work

**Icons** (preset B): each Staff kind its own rendered thumbnail, drawn once at load:
- **Cashier**: white cap, holding cash (two green bills), `holding-both` pose.
- **Stocker**: red cap (Auto role colour), three stacked boxes, `holding-both`.
- **Cleaner**: yellow cap, mop beside it, idle.

They replace the shared `employee` icon everywhere: Pads, guidance arrows, Office upgrade rows (Cashier, Stocker), the Office Stocker list. Cap colours already in `SHADES`.

**Cashier "Bag"** (only while the Register's `progress` > 0; eases in/out over ~1/8 s): both arms raised forward **0.9 rad**; torso turns **±0.55 rad** belt ↔ bagging tray at **1.4 cycles/s** (`sin(phase × 0.5)`); on each finished Customer, `emote('yes')`. A procedural pose on `arm-left`, `arm-right`, `torso`, layered after the clips each frame. Values to `src/feel.ts`: `{ "lift": 0.9, "rate": 1.4, "turn": 0.55, "cheer": true }`.

## 13. Tutorial Map

Replaces the Corner Shop's step tutorial. The **Corner Shop starts with no tutorial.** Delete the old step-tutorial machinery (`TutorialStep`, `w.tutorial`, the `tutorial` entries in `maps/*/tutorial.ts`, `tutorialStep`/`tutorialStepDone` in `src/sim/economy.ts`, its HUD and guidance hooks, the `skipTutorial` intent) once the Tutorial Map runs.

### Save and title
- The Tutorial Map is **`MAPS[0]`** and leads the title row, but keeps **no save**: only a global **`tutorialDone`** flag.
- A fresh save's `currentMap` is the **Corner Shop**: `loadSave` and `wipeSave` default to the first real Map, not `MAPS[0]`.
- The unlock chain from `MAPS[i − 1]`'s Exit Pad **skips the Tutorial Map**: the Corner Shop never waits on it.
- **Title card**: always first, never locked, no ⭐ ribbon. Name **Tutorial**, line "Learn the ropes in 14 short Lessons". Until `tutorialDone`, a bouncing **"Start here!"** ribbon — the whole suggestion: no pop-up, tapping another Map just plays it. Once done: **"✓ Done"** ribbon and the button reads **"Play again"**.

### Layout (shape A, Lesson Trail; 40 × 30 m)
Lift shape A (`trail`) from `prototype/tutorial-layout`'s `maps/tutorial/shapes.ts` into `maps/tutorial/layout.ts`.
- One long shop strip on the north street (x 4–30, z 4–14), customer door on the north wall; farm yard behind a low wall with one back door (z 14–26); the Delivery road along the south.
- Each Lesson's Station a few steps east of the last: Register and Tomato Shelf by the start → Egg Shelf → Blender and Ketchup Shelf → Mop Stand and Trash Bin by the back wall → Stocker Pad → Office corner → Area 2 Pad at the east end.
- Farm: Tomato Bed by the back door, Chicken Coop further east. Two Car Spots, pickups at the south of the yard.
- **Area 2**: a small east garden (x 30–38) with only the **Exit Pad** and garden Props.
- Owned from the start: Tomato Bed, Tomato Shelf, Register. Pads in Lesson order: Egg Shelf → Chicken Coop → Ketchup Shelf → Blender → Office → Cashier → Stocker → Area 2 → Exit. Trash Bin and Mop Stand free. **Moves free.**
- Products: tomato, egg, ketchup. Producers: `tomato_bed`, `chicken_coop`, `blender`.
- Keep Stations off the walk to the next Pad (a Mop Stand in the way stalled the bot in shape B).
- **One Objective**: Sell 10 Tomatoes (counts toward Completion like every Map). **No Challenges** except Lesson 13's scripted one.

### How a Lesson runs
- A **card freezes the whole sim** and explains the mechanic and why it matters → **Got it** → live play with an arrow and ring on the target until the goal is met → a short "Nice!" → the next card.
- Card copy differs by device (joystick and taps on phones; WASD, Shift and click on desktop) and fits both orientations (0.7× in landscape, §4).
- **Scripted**: each Lesson hands over exactly the Money it needs; Customers come only when a Lesson calls them, Events only when their Lesson triggers them; Producers run fast. Nothing hangs on the economy or random timers.
- **Never failed**: a Lesson that goes wrong (Thief escapes, Bad Review, Customer gives up, Challenge times out) replays its setup. No fines, no Money lost.
- **Practice Score**: the ⭐ badge, toasts and Logbook count normally, but nothing is saved; Logbook Stats show this run only.
- **Leaving partway** starts Lesson 1 next time; no Lesson picker. **Skip** (pause menu) exits without counting it as finished. Save Code and Settings aren't taught.

### Lessons
0. **Goal card**: grow the mart (sell, earn, buy Pads), open new Areas, reach 100 % Completion, then the **Exit Pad** finishes the Map and takes you to the next.
1. **Move**: joystick or keys, Tap Walk, then Sprint. On phones the card teaches the current Joystick mode (stick and sprint ring, or Tap Walk when Off), then names the other ways to play, all in Settings: **Joystick: Fixed / Free / Off** (Off = tap to walk, double-tap to run) and **Manual grab** (landscape: hold the right side to move Items; off = grab happens on its own). The live goal uses only the current mode.
2. **Crop → Shelf**: pick tomatoes, put them on the Tomato Shelf.
3. **Register**: a Customer shops; check them out, collect the Cash Pile.
4. **Pad**: buy the Egg Shelf.
5. **Animal**: buy the Chicken Coop, load tomatoes into it, take eggs from the Tray (take first, §2).
6. **Machine**: buy the Ketchup Shelf and Blender; it makes ketchup.
7. **Tipping**: sprint with a tall Stack, retrieve a Loose Item, mop a Mess with the Mop, empty Items into the Trash Bin.
8. **Office**: buy the Office, then an Upgrade.
9. **Edit Layout**: open it from the Office; move the **Egg Shelf** — a ghost outline marks a suggested spot just inside the back door near the Chicken Coop path; **any legal drop** counts; press Done. Free here; the card says Moves cost Money in real Maps.
10. **Staff**: hire a Cashier, then a Stocker, and set its role.
11. **Events**, one at a time: a Delivery (tap its HUD card to walk there), then a Robbery (catch the Thief), then the Health Inspector (escort them).
12. **Closed**: close the store from the Office (row shown from here on), reopen after the wait.
13. **Objectives & Challenges**: a scripted Challenge **"check out 3 Customers in 60 s"** starts with the stamp and ring (the Lesson sends Customers in). The Objective "Sell 10 Tomatoes" starts at **8/10** and completes during it, so its card flies into 🏆. Then an arrow points at 🏆: open the Logbook, see the green tile and the Stats tabs, close it. The Challenge pays its normal **$60**. Time up → "Time up, try again" and the setup replays.
14. **Finish**: buy a cheap Area 2 (with its Area Pan), watch Completion jump (the Objective included), then buy the Exit Pad: the car drives off and the **"Tutorial complete"** card appears → title, Corner Shop in front, `tutorialDone` saved.

**Lesson 13 card** (polish allowed):
> **Objectives & Challenges**
> Every Map has **Objectives**: goals like "Sell 100 Eggs". Each one done earns ⭐ **Score** and counts toward **Completion**, so 100% needs them all.
> Now and then a **Challenge** pops up: a quick task against the clock. Win it for ⭐ Score and a little Money. Miss it and you lose nothing. Score never goes down.
> Tap 🏆 (desktop: click) any time to see your Objectives and Stats.
> *Here it's practice: the tutorial keeps no Score. On every real Map your Score is saved and adds up to your 🏆 total on the title screen.*

Goal line: "Win the Challenge, then open 🏆". "Nice!" line: "That's how you climb the 🏆 total on the title screen."

---

## Build notes

- **Save**: bump `SAVE_VERSION` 3 → 4 with one migration step. New per-Map fields: Stats, Objectives done, Score (and the Completion quarters already scored), Bad Review streak. New global fields: `tutorialDone`, look + cap colour, Settings `joystick` (`fixed` | `free` | `off`). Drop the old per-Map step-tutorial state. Old saves load with Stats and Score at 0 and `tutorialDone` false; "own a Pad / Area" Objectives tick at once on load, which is fine. Their Completion % drops (10 more items in the total) — expected.
- **Completion**: `completionOf` adds Objectives done / 10 to the count. The Opening test's total grows by 10 per Map (Corner Shop 83 → 93 before any other count change).
- **Sim stays deterministic**: Challenge gaps and picks, idle-Stocker spots use the seeded RNG. Stats, Objectives, Score and Challenges are sim state; the UI only reads them.
- **Numbers** → `TUNING` (Score points, Challenge table and gaps, Closed waits, ×2 review fine, idle Stocker), map data (Objective lists), `src/feel.ts` (camera, joystick, ring timer, card timings, Cashier pose, Wardrobe preview), `src/palette.ts` (cap colours, Debt red, ring colours).
- **Glossary** is merged except the Grab Mode line (§5), which changes with that PR.
- **Bot** (`price-table` runs, 4 h gate), re-run after §1–§3 and §8:
  - Every Map still reaches 100 % inside the gate with Objectives in Completion (they complete within the run by construction).
  - Each Challenge's N and T is reachable at the bot's measured rate in that Area with a **1.5× margin**.
  - A Debt never blocks progress for long (track the longest stretch below $0).
  - Tutorial Map: the bot (Lessons scripted) reaches the Exit Pad.
- **Tests** (Vitest, broad flowing tests):
  - Opening test: Completion total includes Objectives; an Objective ticks from Stats and adds 100 Score; Score never drops after a fine.
  - Late-game flowing test gains: take first at a full Tray; a Closed stretch (no new Pavement Customers, Deliveries still park, a running Challenge pauses, reopen blocked for 30 s); two Bad Reviews in a row push Money below $0 and Pads stop draining; one escorted visit resets the streak.
  - Save test: a v3 save migrates to v4 with zeroed Stats.
  - Validator: the Tutorial Map passes (clearance, reachability).

## Build order (small playable PRs into the current release branch)

Each step is playable on its own; later steps lean on earlier ones only where noted.

1. **Rule tweaks**: input caps 6, Inspector stop 3 s, Tipping numbers (§1, §3), take first (§2). Re-run the bot tables.
2. **Idle Stockers wander** (§1).
3. **Camera and joystick feel**: follow 14 + eased lead, joystick sizes, 1.5× dashed sprint ring, full walk at 0.6 (§5).
4. **Landscape layout**: corner HUD, safe areas, screen scales, `%` sizing, Office panel / sheet, 15 m view, Pads 1.25× (§4).
5. **Joystick setting + fullscreen**: Fixed / Free / Off, floor taps walk only when Off, Manual grab on landscape phones, fullscreen on Play and the pause card; Grab Mode glossary line (§4, §5).
6. **Delivery cards on the HUD**: cards, tap / double-tap walk with Auto Grab paused, route line (§6). After 4–5.
7. **Staff icons and Cashier "Bag"** (§12).
8. **Closed** (§7).
9. **Bad Review streak and Debt** (§8). Save bump lands here or in 10, once.
10. **Stats** in the sim and save (§9). Save v4.
11. **Objectives, Score, Completion change** in the sim + map data; bot check (§9).
12. **Challenges** in the sim; bot reachability check (§9). After 8 (pause while Closed).
13. **Score UI**: 🏆 + badge, Logbook (pauses), Objective fly-in, Challenge stamp and ring, title plaque / ribbons / 🏆 button, pause-menu Title (§10).
14. **Wardrobe**: 11 new looks in per-pack folders, credits, panel, caps and fits, drag-to-turn, first-run open; buttons-alive CSS everywhere (§11).
15. **Tutorial Map data**: layout from shape A, unlocks, the one Objective, `MAPS[0]` + fresh-save default + unlock-chain skip, title card with "Start here!" / "✓ Done" (§13). Playable as a normal small Map.
16. **Lesson runner + Lessons 0–7**: freeze cards, arrow/ring goals, scripted Money / Customers / fast Producers, replay on failure, practice Score, Skip, `tutorialDone` (§13).
17. **Lessons 8–14**, then remove the Corner Shop step tutorial and its machinery (§13). After 8, 12, 13.

## Out of scope

- [Pick each Map's music and sounds](https://github.com/Seif-Sallam/Wobbly-Mart/issues/42) — its own issue (incl. stamp / fly-in sounds).
