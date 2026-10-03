# Make Items and Producer output readable

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

How big should Items be, and how does each Producer show its output clearly? Covers the Chicken Coop size and visible eggs, a bigger Blender with visible ketchup, and a general rule for Trays and output across all Producers.

## Context

- Notes #8 (products are tiny), #13 (Chicken Coop should be bigger, eggs not visible), #14 (Blender is tiny, ketchup not visible), #15 (every Producer shows output poorly).
- Today `ITEM = 0.34` m in `catalog/assets.ts`. Trays are a `survival/box-open` at 0.35 m.
- Bigger Items change Stack spacing (`FEEL.itemSpacing`) and Shelf fit, which [Pick Shelf and Register models](10-shelf-and-register-models.md) depends on.

## Answer

Resolved 2026-10-03 (prototype; the owner tuned preset B and pasted the values). Prototype: branch `prototype/item-readability` (`src/app/items-prototype.ts`, `src/view/proto-items.ts`, `?items=B` on a dev build).

```json
{
  "itemScale": 1.6,
  "output": "pallet",
  "trayScale": 2.35,
  "trayFront": true,
  "chickHeight": 0.5,
  "chicks": 4,
  "coopScale": 1.5,
  "blenderHeight": 1.3,
  "blenderFloor": false,
  "blenderScale": 1.35,
  "stackSpacing": 0.8
}
```

**Items:** every Item is **×1.6** (`ITEM` 0.34 → ~0.54 m in `catalog/assets.ts`, the per-Product ratios kept), including the ripe tomatoes on the tomato plants. At today's bed size those look crammed, so the **tomato beds grow** instead (plants, rows and footprint) to fit ×1.6 tomatoes; the new bed size is set in [Re-lay out the Corner Shop](08-relayout-corner-shop.md).

**Stack spacing:** 0.8 × Item size → `FEEL.itemSpacing` ≈ **0.435** m. This supersedes the 0.31 from [Tune Stack capacity and wobble onset](05-stack-cap-and-wobble.md) (that value was for the old Item size); the rest of the wobble preset stands. A full base Stack (8) is ~3.5 m tall, a maxed one (16) ~7 m.

**Output — the rule for every Producer** (Animals, Machines; Crops show ripe produce on the plants as today): no more open box in a corner. Output sits on a **dark wooden pallet**, **front and centre** just outside the Producer, **×2.35** today's Tray size, Items piled in a **pyramid** (3 + 2 + 1 for the 6-Item Tray).

**Chicken Coop:** **×1.5** overall, **4 chicks** at **0.5 m**. The fence is a **closed box** on all four sides (today's fence segments are misaligned — fix by centring each segment on its side).

**Blender:** **×1.35** overall, the blender **1.3 m** tall, standing **on its counter**, centred on the counter top with the tomato inputs on the counter beside it. Today's blender and counter are misaligned because neither model is centred on its origin; centre both by their footprint (the Register uses the same counter and gets the same fix).

**Knock-on for other tickets:**

- [Re-lay out the Corner Shop](08-relayout-corner-shop.md): the owner expects this to rearrange everything. Coop and Blender footprints grow (~3 × 3 and ~2 × 1.4 m), and every Producer needs room for the pallet in front.
- [Pick Shelf and Register models](10-shelf-and-register-models.md): Shelf slots must fit ×1.6 Items.
- [Design the Customer's shopping cart](12-customer-cart.md): Items in the cart are ×1.6 too (today the cart draws them at 0.7 scale).
