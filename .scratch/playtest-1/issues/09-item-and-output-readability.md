# Make Items and Producer output readable

Type: prototype
Status: open
Blocked by: —

## Question

How big should Items be, and how does each Producer show its output clearly? Covers the Chicken Coop size and visible eggs, a bigger Blender with visible ketchup, and a general rule for Trays and output across all Producers.

## Context

- Notes #8 (products are tiny), #13 (Chicken Coop should be bigger, eggs not visible), #14 (Blender is tiny, ketchup not visible), #15 (every Producer shows output poorly).
- Today `ITEM = 0.34` m in `catalog/assets.ts`. Trays are a `survival/box-open` at 0.35 m.
- Bigger Items change Stack spacing (`FEEL.itemSpacing`) and Shelf fit, which [Pick Shelf and Register models](10-shelf-and-register-models.md) depends on.
