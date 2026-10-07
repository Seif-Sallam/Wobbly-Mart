# Rework the wheat field, Mill and Oven models

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-07)
Blocked by: —

## Question

What do the wheat field, the Mill, the Oven and the Cow Pen look like so that each is properly aligned and suits what it makes, the way the Chicken Coop, Blender and tomato bed were reworked?

## Context

- Owner, 2026-10-03: the wheat field, Ovens and Mills are all sub-par: badly aligned, or not suitable for what they produce. They get reworked like the Coop, Blender and tomato bed were in [Make Items and Producer output readable](09-item-and-output-readability.md).
- Follow that ticket's rules: Items ×1.6, output on a big dark pallet front and centre, every part centred on its own origin (the Mill's sails spin on the wrong axis, note #1, decided as a bug fix).
- Today: wheat uses `crops-row` + `wheat-plant` in a 2 × 2 grid; the Mill is a box hut + `roof` + `windmill` sails; the Oven is a `stove` with a glow strip (`src/view/stations.ts`).
- Owner, 2026-10-07: the **Cow Pen** has the same not-square fence as the Chicken Coop had. The Coop's fix (closed box fence, each segment centred on its side) was only written down for the Coop, so the Cow Pen is in scope here too: a square, closed fence, the proper hut from ticket 09, and its pallet.
- New footprints feed [Re-lay out the Corner Shop](08-relayout-corner-shop.md). Shelves are reworked separately in [Pick Shelf and Register models](10-shelf-and-register-models.md).

## Answer

Resolved 2026-10-07 (prototype; the owner picked preset **B** for all four: **"B is a masterpiece."** Carry this quote into the playtest-pass spec). Prototype: branch `prototype/producer-models` (`src/app/producers-prototype.ts`, `src/view/proto-producers.ts`, `?producers=B` on a dev build; built on `prototype/item-readability`, so it has ×1.6 Items, pallets and the square Coop).

```json
{
  "wheat": "B",
  "mill": "B",
  "oven": "B",
  "pen": "B",
  "wheatSize": 3,
  "millSize": 2.4,
  "ovenSize": 2.2,
  "penSize": 3,
  "wheatPlants": 6,
  "sailSpeed": 3,
  "cows": 1
}
```

All four are built in code from boxes and cylinders (palette colours only), every part centred on the Station's origin, and each Producer's output on the dark pallet front and centre ([Make Items and Producer output readable](09-item-and-output-readability.md)).

- **Wheat field — fenced furrows, 3 × 3 m (square):** a tilled dirt patch with two dark-dirt furrow ridges (80% of the width, 0.45 m wide) and a low closed fence on all four sides (the Coop's fence: each segment centred on its side). **6 plants** (the decided yield), 3 per furrow.
- **Mill — barn mill, 2.4 m:** a wooden barn (70% × 60% of the size, 1.4 m tall) with a dark-wood gable roof and a dark door at the front. **Four sails on the gable front** (dark-wood arms, cream cloth) spin about the forward axis, which fixes note #1: slow idle turn, **3 rad/s** while milling. Wheat inputs sit at the front-left.
- **Oven — iron stove, 2.2 m:** a black iron body on four legs with a grey top plate, a grey door frame and a **glass door that glows** (faint at rest, pulsing while baking), plus a black stovepipe at the back. Flour and egg inputs sit at the two front corners.
- **Cow Pen — open pasture, 3 × 3 m (square):** a grass floor and a closed fence like the Coop, **no hut**, two hay bales lying in the back-left corner, a dark-wood trough at the back-right holding the wheat inputs, and 1 cow.

**Footprints for the re-layout:** wheat field **3 × 3** (was 3 × 3, and the second wheat plot 3 × 2), Mill **~2.4 × 2.4** with its pallet (was 2 × 2), Oven **~2.2 × 2.2** (was 2 × 2), Cow Pen **3 × 3** (was 3 × 2, the cause of the not-square look).
