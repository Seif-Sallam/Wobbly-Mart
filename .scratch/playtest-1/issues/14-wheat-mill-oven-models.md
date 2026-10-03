# Rework the wheat field, Mill and Oven models

Type: prototype
Status: open
Blocked by: —

## Question

What do the wheat field, the Mill and the Oven look like so that each is properly aligned and suits what it makes, the way the Chicken Coop, Blender and tomato bed were reworked?

## Context

- Owner, 2026-10-03: the wheat field, Ovens and Mills are all sub-par: badly aligned, or not suitable for what they produce. They get reworked like the Coop, Blender and tomato bed were in [Make Items and Producer output readable](09-item-and-output-readability.md).
- Follow that ticket's rules: Items ×1.6, output on a big dark pallet front and centre, every part centred on its own origin (the Mill's sails spin on the wrong axis, note #1, decided as a bug fix).
- Today: wheat uses `crops-row` + `wheat-plant` in a 2 × 2 grid; the Mill is a box hut + `roof` + `windmill` sails; the Oven is a `stove` with a glow strip (`src/view/stations.ts`).
- New footprints feed [Re-lay out the Corner Shop](08-relayout-corner-shop.md). Shelves are reworked separately in [Pick Shelf and Register models](10-shelf-and-register-models.md).
