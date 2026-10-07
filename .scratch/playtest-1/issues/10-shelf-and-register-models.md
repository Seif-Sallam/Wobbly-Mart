# Pick Shelf and Register models

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-07)
Blocked by: 09

## Question

Which model does each Product's Shelf use, so that every Shelf looks different and suits what it holds? How do Items sit *on* surfaces instead of floating? And which smaller model replaces the Register?

## Context

- Notes #2 (egg Shelf is the same model as the tomato basket), #3 (the tomato basket is a poor fit for tomatoes), #4 (Items float in the air), #19 (the wheat Shelf is bad), #17 (the Register is too big).
- Today: tomato and egg both use `display-fruit`, wheat uses `shelf-bags`, and the Register is a `kitchen-bar` + `cash-register` composite (`catalog/products.ts`, `catalog/assets.ts`).
- Kenney packs first, then composed parts. Show candidates side by side.
- Owner, 2026-10-03: **every Shelf gets resized and gets a new model** here — today's are all sub-par (badly aligned, or not suited to what they hold). They must fit ×1.6 Items ([Make Items and Producer output readable](09-item-and-output-readability.md)) and hold a fixed 10 Items each ([Decide extra Shelves vs. Shelf size](07-shelves-vs-shelf-size.md)).

## Answer

Resolved 2026-10-07 (prototype; the owner picked preset **C** for every Shelf, then asked for a big checkout with a belt instead of C's small Register stand: "I fucking love it"). Prototype: branch `prototype/shelf-models` (`src/app/shelves-prototype.ts`, `src/view/proto-shelves.ts`, `?shelves=C` on a dev build; `?shelves=gallery` shows every Kenney candidate).

```json
{
  "variant": "C",
  "fixtureScale": 1,
  "neat": true,
  "register": "checkout",
  "registerScale": 1,
  "checkoutLength": 2.6,
  "beltSpeed": 0.6
}
```

**Why Items floated (note #4):** the Mini Market Shelf models come with goods baked in (boxes, bags, loaves; `display-fruit`'s tomatoes are part of the mesh itself), and Items were laid on top of that bounding box. All Kenney market Shelves are dropped.

**Shelves — every Product gets its own stand, built in code from boxes** (wood / dark wood / cream, the Product's colour as an accent), each on today's 3 × 1 m footprint:

- **Tomato:** low slanted produce bin (dark-wood base 0.55 m, tomato-red tray tilted 0.2 rad toward the front, wooden front lip). Tomatoes lean with the tray and heap when the floor runs out.
- **Egg:** wooden counter 0.7 m tall, 85% × 75% of the box, with a cream top; eggs in two rows.
- **Ketchup and flour:** three-step riser (0.35 / 0.7 / 1.05 m, dark / light / dark wood), one row per step.
- **Milk:** open-front cooler 1.6 m tall: cream back, sides and top, an ice-blue floor and a mid shelf at 0.8 m.
- **Wheat:** three wooden baskets (0.8 × 0.45 × 0.8 m), sheaves standing in them.
- **Bread:** furniture-kit `table` with a raised wooden bread board.
- **Every stand:** a Product-coloured sign board (0.9 × 0.32 m) on a thin post at the back, 1.75 m up.

**Items sit on real surfaces:** each Shelf has 10 slots, found where a downward ray hits an upward face with room for the Item above it, filled lowest step first, front row first, left to right. Items face the front (no random yaw). Only tomato, bread and flour may heap a second layer; upright Items never stack. Build can bake these slots per stand instead of raycasting at load.

**Register → big checkout counter (note #17 reversed: the owner now wants it big), built in code.** Owner on seeing it: **"I fucking love it."** Carry this quote into the playtest-pass spec.

- Counter **2.6 × 1 m** (was a 2 × 1 m box), 0.9 m tall, dark wood with a light-wood top.
- **Conveyor belt** on the Customer side: dark belt along 58% of the length from the end opposite the till, end rollers, a cream side rail and cream stripes that move at **0.6 m/s** only while a checkout is in progress.
- **Goods ride the belt (view only, no sim change):** while a Customer is checked out, their cart Items leave the cart, slide down the belt toward the till staggered by order, then drop into the **bagging tray** (cream floor with low wood walls) past the belt. Items on the belt are at cart scale.
- **Till** (`market/cash-register`) on a wooden riser at the back, facing the Cashier.
- **Lane light:** orange lamp on a 1 m post behind the till; glows brighter while scanning.

**Footprints for the re-layout:** Shelves stay 3 × 1 m (the milk cooler is 1.6 m tall, the signs reach 1.9 m); the Register box grows to **2.6 × 1 m**, so Queue Spots and the Cash Pile offset must be checked against it.

**Also needed when built:** Items ×1.6 everywhere (from [Make Items and Producer output readable](09-item-and-output-readability.md)), including the procedural wheat sheaf (0.42 → 0.67 m). The extra Kenney models added for the comparison aren't needed; the only model C uses besides boxes is `table`, already in `catalog/assets.ts`, plus `cash-register`.
