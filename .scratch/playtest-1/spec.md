# Wobbly Mart — playtest pass 1 spec

A **delta on [the v1 spec](../my-mini-mart-web/spec.md)**: everything v1 says still holds unless a section below replaces it. It settles all 25 notes from the owner's first full playtest (2026-10-03; verdict: "the game is great").

Assembled 2026-10-07 from every ticket in [the map](map.md). Tickets hold the reasoning; this file is the build's starting point.

**Sources of truth this spec points to instead of repeating:**

| What | Where |
|---|---|
| Glossary (Sprint, Loose Item, Stocker roles, Steady hands, Shelf, Shopping List, Trash Bin updated) | [`/CONTEXT.md`](../../CONTEXT.md) |
| Map 1 numbers: every Pad and Upgrade cost, Unlock Requirement, expected buy time | [`price-table/price-table.md`](price-table/price-table.md) (regenerate with `python3 price-table/sim.py --table`) |
| Map 1 layout | branch `prototype/relayout` → `maps/corner-shop/layout.ts`, **copy as-is** |
| Prices already in map data (for copying) | branch `research/economy` → `maps/corner-shop/unlocks.ts`, `upgrades.ts` |
| Playable references (`npm run dev`) | `prototype/stack-wobble` `?stack=A` · `prototype/sprint` `?sprint=B` · `prototype/item-readability` `?items=B` · `prototype/shelf-models` `?shelves=C` · `prototype/full-list` `?list=A` · `prototype/customer-cart` `?cart=B` · `prototype/producer-models` `?producers=B` · `prototype/relayout` `?relayout` (all picks in one build) |
| Demand rules already in sim code | commit "Bring in the decided demand rules" (on `prototype/full-list`, `research/economy`) |

Prototype code is throwaway: lift ideas and numbers, not the `proto-*` files and their `PROTO` switches.

---

## Playtest notes → where each is settled

| # | Note | Settled in | Ticket |
|---|---|---|---|
| 1 | Mill fans spin on the wrong axis | §7 Mill | as-is (bug) · [14](issues/14-wheat-mill-oven-models.md) |
| 2 | Egg Shelf uses the tomato basket model | §7 Shelves | [10](issues/10-shelf-and-register-models.md) |
| 3 | Tomato basket is a poor model | §7 Shelves | [10](issues/10-shelf-and-register-models.md) |
| 4 | Products float in the air | §7 Shelves | [10](issues/10-shelf-and-register-models.md) |
| 5 | Carry max too high / wobble too late | §4 Stack, §6 | [05](issues/05-stack-cap-and-wobble.md) |
| 6 | New Sprint mechanic | §4 Sprint, §6 | [06](issues/06-sprint.md) |
| 7 | Too few Stockers; let them specialise | §4 Staff, §8 Office | [03](issues/03-measure-stocker-need.md), [04](issues/04-stocker-roles-and-count.md) |
| 8 | Products too small to read | §7 Items | [09](issues/09-item-and-output-readability.md) |
| 9 | Trash Bin takes Items when walking past | §4 Trash Bin | as-is |
| 10 | Customers push a cart, wobbly stack | §4 Customers, §7 Customers | [12](issues/12-customer-cart.md) (owner chose a hand basket) |
| 11 | Wheat yields 6 instead of 4 | §5 Producers | as-is |
| 12 | Tomato farm alignment is wrong | §7 Tomato bed, §5 Layout | [09](issues/09-item-and-output-readability.md), [08](issues/08-relayout-corner-shop.md) |
| 13 | Coop bigger, eggs visible | §7 Coop, Output | [09](issues/09-item-and-output-readability.md) |
| 14 | Blender tiny, ketchup invisible | §7 Blender, Output | [09](issues/09-item-and-output-readability.md) |
| 15 | Producers don't show output clearly | §7 Output | [09](issues/09-item-and-output-readability.md), [14](issues/14-wheat-mill-oven-models.md) |
| 16 | Ovens and Blenders inside the store | §5 Layout | as-is · [08](issues/08-relayout-corner-shop.md) |
| 17 | Register model too big | §7 Register (owner reversed it: a big checkout) | [10](issues/10-shelf-and-register-models.md) |
| 18 | Too few, misaligned 100% banners | §5 Layout | [08](issues/08-relayout-corner-shop.md) |
| 19 | Wheat Shelf looks bad | §7 Shelves | [10](issues/10-shelf-and-register-models.md) |
| 20 | Player collides with Customers/Staff | §4 Player | as-is |
| 21 | Flickering circle above the Player | §7 Caps | [01](issues/01-flickering-circle.md) |
| 22 | Patience random, long; some never give up | §4 Customers, §8 bubble | [02](issues/02-customer-demand.md), [11](issues/11-full-shopping-list.md) |
| 23 | More Shelves instead of bigger Shelves | §4 Shelves, §5 | [07](issues/07-shelves-vs-shelf-size.md) |
| 24 | Weighted Shopping List size | §4 Customers | [02](issues/02-customer-demand.md) |
| 25 | Show the whole Shopping List | §8 bubble | [11](issues/11-full-shopping-list.md) |

---

## 2. Tech stack and repo — changes

- **CI bot** (`src/sim/bot.ts`): walks (never sprints), leaves every Stocker on **Auto**, prints its simulated time as info; fails only if 100% isn't reached within 4 h. Today's figure on the new rules and prices: **88 simulated min**. The bot plays ~3× slower than the estimator's good player (6× in v1), so its time is not a pacing gauge.
- **Sim tests:**
  - The opening test is updated: Stack 8, Shelf 10, Completion 3 of **79**.
  - **One new late-game flowing test** on a fully built store, in one test:
    1. A Customer heads for the fuller of a Product's two Shelves (ties → nearer) and switches when the other gets Items.
    2. A never-give-up Customer waits past 90 + 15 s, never angry, never leaves, finishes once stocked.
    3. A normal Customer's patience runs out → 15 s angry → their basket spills a Mess → the Player clears Items at the Trash Bin by holding 1.5 s.
    4. Sprinting above the safe count drops the top Item (seeded) as a Loose Item ~1.3 m behind. Customers walk through it, Stockers ignore it, and the Player takes it back by walking over it. At or below the safe count nothing drops, and a Steady hands level raises the safe count.
    5. A Goods Stocker only fills Shelves, a Machines Stocker only fills Animal/Machine inputs, and each waits rather than covering the other role.
  - **Validator test:** a retired released id passes, reusing a retired id fails (§3).

## 3. Map template — changes

- **Retired ids.** `maps/released-ids.json` gains a `retired` list: a retired id may be missing from the map, and may never come back. `shelf_cap` is the first retired id (the Shelf-size Upgrade is removed). The validator's "ids removed since last release" check accepts retired ids.
- **Station box = visual footprint, output pallet included.** A Producer's pallet sits in a **1.1 m strip along the box's front edge** (inside the box); its structure fills the rest. Producers draw at their box size (no separate model scale). So the Player and Customers bump into exactly what they see.
- **Stocker Pads** carry no assignment; the role lives on the Stocker (§4).

## 4. Game rules (the sim) — changes

**Player and Stack**
- The Player **walks through Customers and Staff** (no circle-vs-circle with them). Stations, walls and solid Props still push out.
- **Stack capacity 8**, Stack-size Upgrade **+2 per level → 10 / 12 / 14 / 16**.
- **Trash Bin:** takes Items only after the Player has stood on it for **1.5 s**; walking past never trashes anything. Still free, still appears with Area 2. It now stands at the back of Area 1, by the back door.

**Sprint** (new)
- Hold to run at **1.5×** the current walk speed (on top of the Walk-speed Upgrade: 8.25 m/s base, 11.25 at level 4). The full-Stack slowdown still applies.
- While sprinting and moving with more Items than the **safe count**: chance per second = **0.3** × ((Stack − safe) / (Stack cap − safe))^**1.2**, at most one drop per **1 s**. The top Item flies off and lands **~1.3 m** behind the Player, a little to one side.
- **Safe count 3**; new Upgrade **Steady hands** raises it to **4 / 5 / 6** (Player family, 3 levels).
- **Loose Item** (its own thing, not a Mess): no splat; Customers aren't slowed by it; never disappears; only the Player takes it back, by walking over it with room in the Stack; Stockers ignore it. Not saved (like every Item).

**Producers**
- Wheat field: **6 plants** (was 4).
- A "more plots" Pad adds **a second bed/field with as many plants as the first** (tomato 4, wheat 6; was +4 plants).

**Shelves**
- Every Shelf holds a fixed **10** Items. The Shelf-size Upgrade is **removed**.
- **Two Shelves per Product.** The second is an optional leaf Pad, revealed right after that Product's second Producer Pad (`tomato_plots`, `chicken_2`, `blender_2`, `wheat_plots`, `cow_2`, `mill_2`, `oven_2`). Nothing requires a second Shelf. Each still counts toward Completion.
- Each time a Customer heads for a Product, they pick its Shelf with the most Items, ties to the nearer. Waiting at an empty Shelf, they walk over when the other one gets Items; both empty → they wait at the nearer.

**Customers** (replaces v1's Shopping List and Patience lines, and §16 "Shopping List")
- **Shopping List**, three rolls:
  1. Product count, weighted **1 → 30%, 2 → 35%, 3 → 25%, 4 → 10%**. Counts above the Products for sale are dropped and the rest renormalised.
  2. Units, one roll per list; every line on it wants that many:

     | Products | 1 unit | 2 units | 3 units | 4 units |
     |---|---|---|---|---|
     | 4 | 15% | 80% | 4% | 1% |
     | 3 | 10% | 70% | 18% | 2% |
     | 2 | 10% | 25% | 55% | 10% |
     | 1 | 5% | 15% | 25% | 55% |

  3. Which Products: a random pick from those for sale.

  On average a Customer buys ~5.2 Items with 4+ Products for sale, and 3.3 with one. A 4 × 4 list is 0.1% of Customers.
- **Patience:** each Customer rolls **45–90 s** (uniform) at an empty Shelf, then **15 s** visibly angry, then drops their cart as a Mess and leaves. It still resets on every Item taken, and is still off while the tutorial runs.
- **25% never give up:** never angry, never leave until the list is done, no marker. They can hold Customer Cap slots while a Shelf stays empty; that's the intended cost.
- **Cart:** on arrival, **60%** of Customers take a hand basket; the rest carry their Items on their hands as today. View only, no sim difference. An angry Customer's basket tips and spills as the Mess.

**Staff**
- **6 Stocker Pads** (was 2), unlocked after: Area 2 (`stocker_1`), the wheat field (`stocker_3`), the Cow Pen (`stocker_4`), Area 3 (`stocker_5`), the Oven (`stocker_2`), the 2nd Oven (`stocker_6`).
- **Roles replace per-Product assignment.** Every new Stocker starts on **Auto**.

  | Role | Takes |
  |---|---|
  | **Auto** | today's most-urgent-job logic, any kind of job |
  | **Stock goods** | only jobs whose sink is a Shelf |
  | **Stock machines** | only jobs whose sink is an Animal or Machine input (tomato → Coop/Blender, wheat → Cow Pen/Mill, flour + egg → Oven) |

  A Stocker with no job in its role waits; it never covers the other role.

**Completion:** Map 1 = **42 Pads + 37 Upgrade levels = 79**. That's 11 new Pads (7 second Shelves and Stockers 3–6), 3 Shelf-size levels removed, and 3 Steady hands levels added.

## 5. Map 1 — "Corner shop" — changes

**Producers:** Wheat field (Crop, **6** plants × 7 s); the rest unchanged.

**Unlock order and prices:** see the [price table](price-table/price-table.md) (start **$50** = Register $10 → Tomato Shelf $15 → Tomato bed $25, unchanged). Headlines:
- **Area unlocks:** Area 2 **$125**, Area 3 **$1,100**, Exit **$2,250**.
- **Second Shelves:** $20–25 in Area 1, $125–150 in Area 2, $525–1,100 in Area 3.
- **Stockers:** $175 / $175 / $200 in Area 2, $900 / $900 / $1,100 in Area 3.
- Area cost scale **0.28 / 0.33 / 0.75** (v1 0.45 / 0.40 / 0.70).

**Upgrades — 13 lines, 37 levels:**
- **Player:** Walk speed 5.5 → 7.5 (4), **Stack 8 → 16 (4)**, **Steady hands 3 → 6 (3)**.
- **Staff:** Cashier 2.0 → 1.0 s (3), Stocker speed 4 → 6 (4), Stocker carry 6 → 14 (4).
- **Station:** Producer speed as v1 (Tomato 3, Chicken 2, Blender 2, Wheat 3, Cow 2, Mill 1, Oven 2).
- **Shelf capacity is gone.**

**Pacing:** the estimator says **29.8 min** to 100% with good play: Area 1 **7.0**, Area 2 **10.6**, Area 3 **12.2**. The owner confirmed it on 2026-10-07. The estimator models the new rules and trip lengths, but not patience, roles or Shelf capacity.

**Layout** (replaces v1's; the data is the `prototype/relayout` layout file, which passes the validator):
- **Map 52 × 58 m, store floor 44 × 22 m** (were 42 × 50 and 37 × 18). Areas split the store and farm by x: Area 1 4–20, Area 2 20–34, Area 3 34–48. Customer doors north and west as today; one back door per Area to its farm.
- **Store, front to back:** **row A** (z 7.5) holds each Product's first Shelf, **row B** (z 12.5) its second right behind, so one column per Product. Shelves 1.5 m apart, 4 m aisles between rows. Area 1: tomato, egg, ketchup. Area 2: wheat, milk, flour. Area 3: both bread Shelves in row A, both Ovens and Blender 2 in row B.
- **Machines indoors:** Blender 1 in Area 1's back zone by its back door; Ovens and Blender 2 in Area 3 (note #16).
- **Back zone:** Registers 1 (Area 1) and 2 (Area 3), each facing into the store with 6 Queue Spots in front and its Cashier Pad behind. Also the Office (Area 1, back-left, partitioned), Stocker Pads, the Area 2 and Area 3 Pads, and the Trash Bin by Area 1's back door.
- **Farm:** every Producer faces the store (its pallet toward the back door). Area 1 has two tomato beds and two Coops; Area 2 has two wheat fields, two Cow Pens and Mill 1; Area 3 has Mill 2. Exit Pad, van, Car Spots and road move to the new bottom edge.
- **Station boxes:**
  - Shelf 3 × 1, Register **2.6 × 1**, Blender 2 × 2.5.
  - Tomato bed 4 × 2.4, wheat field 3 × 3.
  - Coop and Cow Pen 3 × 4.1 (a 3 × 3 square pen plus the pallet strip).
  - Mill 2.4 × 3.5, Oven 2.2 × 3.3.
- **Pads** stay 1.6 m (half-size 0.8) at their Station's box centre; no two touch.
- **Walkways:** at least 1.5 m between solids in the store.
- **Party Props:** **6 banners** along the north wall, **4 flags** in the farm, all clear of doors (note #18).
- Average one-way carrying trip **16.3 m** (v1 11.8, measured the same way by `scripts/measure-trips.ts` on `research/economy`).

## 6. Controls and camera — changes

| Topic | Value (`feel.ts`) |
|---|---|
| Sprint | hold **Shift**; on touch push the joystick past its ring (force > **1.4**); no on-screen button |
| Stack | Item spacing **0.435 m** (0.8 × the ×1.6 Item). Bottom **2** Items rigid; above them each Item follows the lean by 0.9 × (height above them)^1.3. Sway 2.5, stiffness 45, damping 16, lean max 0.8. Idle jiggle 0.02 at speed 3. The bend applies to every Stack (Player, Stockers, Customers at their scale). |

## 7. Art direction — changes

**Items: ×1.6** everywhere (`ITEM` 0.34 → ~0.54 m, per-Product ratios kept), including ripe tomatoes on the plants and the procedural wheat sheaf (0.42 → 0.67 m). A full base Stack is ~3.5 m tall.

**Output on every Animal and Machine:** no open box. Output sits on a **dark wooden pallet**, front and centre, **×2.35** v1's Tray size, Items piled in a pyramid (3 + 2 + 1). Crops show ripe produce on the plants.

**Producers** (every part centred on the Station's origin; palette colours only):

| Producer | Look |
|---|---|
| Tomato bed | 4 plants **in one line** in a single soil strip with a low wooden planter wall; plants sit in the soil |
| Chicken Coop | 4 chicks (0.5 m), proper hut (four wall panels centred on a square, roof fitted on top), **closed box fence**, each segment centred on its side |
| Blender | blender 1.3 m tall standing on its counter, centred on the top, tomato inputs beside it; blender and counter centred by footprint |
| Wheat field | code-built: tilled patch, two dark-dirt furrow ridges, low closed fence; **6 plants**, 3 per furrow |
| Cow Pen | code-built open pasture: grass floor, closed square fence, **no hut**, two hay bales back-left, dark-wood trough back-right holding the wheat inputs, 1 cow |
| Mill | code-built barn mill: wooden barn, dark gable roof, dark door; **four sails on the gable front spinning about the forward axis** (note #1), slow idle, **3 rad/s** while milling; wheat inputs front-left |
| Oven | code-built iron stove: black body on four legs, grey top and door frame, **glass door that glows** (faint at rest, pulsing while baking), stovepipe at the back; flour and egg inputs at the front corners |

Owner on the wheat field, Mill, Oven and Cow Pen: **"B is a masterpiece."**

**Shelves:** all Kenney market Shelves are dropped. They have goods baked into the mesh, which is why Items floated (note #4). Every Product gets a code-built stand on the 3 × 1 m footprint:

| Product | Stand |
|---|---|
| Tomato | low slanted produce bin (dark-wood base 0.55 m, tomato-red tray tilted 0.2 rad forward, wooden lip); tomatoes lean and heap |
| Egg | wooden counter 0.7 m, cream top, eggs in two rows |
| Ketchup, Flour | three-step riser (0.35 / 0.7 / 1.05 m), one row per step |
| Milk | open-front cooler 1.6 m: cream body, ice-blue floor, mid shelf at 0.8 m |
| Wheat | three wooden baskets (0.8 × 0.45 × 0.8 m), sheaves standing in them |
| Bread | furniture `table` with a raised wooden bread board |

- Every stand has a Product-coloured sign board (0.9 × 0.32 m) on a thin post at the back, 1.75 m up.
- **Items sit on real surfaces:** 10 slots per stand on upward faces with room above, filled lowest step first, then front row first, then left to right. Items face front. Only tomato, bread and flour may heap a second layer.
- Bake the slots per stand at build time; don't raycast at load.

**Register → big checkout counter** (note #17 reversed by the owner). Owner on seeing it: **"I fucking love it."**
- Counter **2.6 × 1 m**, 0.9 m tall, dark wood with a light-wood top.
- **Conveyor belt** on the Customer side along 58% of the length: end rollers, cream rail, and cream stripes that move at **0.6 m/s** only while a checkout runs.
- **Goods ride the belt (view only):** the Customer's Items leave the cart, slide toward the till staggered by order, and drop into a **bagging tray** (cream floor, low wood walls).
- **Till** (`market/cash-register`) on a wooden riser at the back, facing the Cashier. **Lane light:** an orange lamp on a 1 m post that glows brighter while scanning.

**Customers carrying Items:**
- **Who carries what:** 60% hold a Mini Market `shopping-basket` (0.4 m) in the right hand. The rest carry a Stack on their hands at ×0.7.
- **Basket and tower:** basket Items are ×0.6. The first 2 sit inside, and the rest tower out of it at 0.6 × Item spacing.
- **Wobble:** the tower uses the Stack's lean ×**2.2** plus a constant **idle sway** (amplitude 0.55, speed 2.2, phase-shifted per Customer), so it wobbles even standing still. Each Item tilts with the lean up to the 6th.
- **Spill and checkout:** an angry Customer's basket tips over and spills the Mess, and the empty basket lies there briefly, then fades. At checkout the Items go onto the belt and the Customer leaves with the empty basket.

**Caps** (note #21): the cap and brim are parented to the `head` bone and sit fully above the hair, so they never pop through it.

| Who | Cap |
|---|---|
| Player | orange |
| Cashier | **white** (was orange) |
| Stocker — Auto / Goods / Machines | **red / purple / blue** |

New colours go in `palette.ts`; the Office role chips match.

**Entities table changes:** Wheat field, Cow Pen, Mill, Oven and every Shelf are code-built (above). Trays → pallets. Register → code-built checkout + `cash-register`. New: `shopping-basket`. Dropped: the Kenney market Shelves, `kitchenBar` under the Register, `windmill`, `kitchenStove`, `crops_dirtRow` / `crops_wheatStage*` for wheat.

## 8. HUD and UI — changes

**Customer bubble → a receipt card** (replaces v1's heading-to bubble and patience ring), shown while shopping, hidden once they head to the Register:
- One line per Product on the list, in list order: icon and **×n** still wanted. The **current** line (heading for or waiting at) gets a soft orange highlight.
- **Finished lines** stay, icon faded to 35%, a green **tick** instead of the count.
- An Item into the cart **pops** its line (×1.35 and back over **0.35 s**); a completing tick pops the same way.
- The card grows with the list (1–4 lines), tail pointing at the Customer. Cards overlapping in a full store is accepted.
- **Patience tells, the same for everyone** (no ring), while waiting at an empty Shelf:
  - **12 s:** yellow "…" face.
  - **30 s:** orange ">_<" face and orange outline.
  - **Really angry** (after their own 45–90 s roll): red ">:(" and red outline, then 15 s to leaving.
  - Never-give-up Customers stay at ">_<". Taking an Item clears the tells.

**Edge arrow** for "a Customer growing angry at an empty Shelf" now fires at the **30 s ">_<" tell** (see §16).

**Office panel:** the Staff section shows each Stocker with chips **Auto / Goods / Machines** in their cap colours, free, changeable any time (replaces Auto-or-one-chain). Steady hands sits in the Player group next to Walk speed and Stack size. The Shelf-size card is gone.

## 12. Saves — changes

- Saved per map: each Stocker's **role** (replaces chain assignment). Loose Items are Items, so not saved.
- **Version bump, no migration this pass** (only the owner has a save). An older save is **dropped silently** and the game starts fresh. This one-off exception to v1's "never wipe silently" rule is the owner's call; later bumps follow v1 again.

## 13. Performance — changes

- Baskets are one instanced model, like Items: up to 15 Customers add no per-Customer draw calls.
- Code-built Shelves, Producers and the checkout's static parts merge into the static store. Moving parts (belt stripes, sails, oven glow, lane light) stay out of the merge.

## 16. Settled at assembly

The owner decided these on 2026-10-07 while this spec was assembled:

- **Angry edge arrow** fires at the shared **30 s tell**, for every Customer, so it neither gives away never-give-up Customers nor stays silent about them.
- **Retired ids** (§3): a `retired` list in `released-ids.json`, starting with `shelf_cap`.
- **Old saves** (§12): dropped silently this once, since only the owner has a save.

## 17. Picked during the build (not decisions)

- Sounds for a Sprint drop and for taking back a Loose Item; reuse "Mess left" for the basket spill.
- Exact cap colour hexes.
- Exact slot positions per stand.
- Every feel and economy number above, as play-testing tunes it.
