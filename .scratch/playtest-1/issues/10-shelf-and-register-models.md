# Pick Shelf and Register models

Type: prototype
Status: open
Blocked by: 09

## Question

Which model does each Product's Shelf use, so that every Shelf looks different and suits what it holds? How do Items sit *on* surfaces instead of floating? And which smaller model replaces the Register?

## Context

- Notes #2 (egg Shelf is the same model as the tomato basket), #3 (the tomato basket is a poor fit for tomatoes), #4 (Items float in the air), #19 (the wheat Shelf is bad), #17 (the Register is too big).
- Today: tomato and egg both use `display-fruit`, wheat uses `shelf-bags`, and the Register is a `kitchen-bar` + `cash-register` composite (`catalog/products.ts`, `catalog/assets.ts`).
- Kenney packs first, then composed parts. Show candidates side by side.
- Owner, 2026-10-03: **every Shelf gets resized and gets a new model** here. They must fit ×1.6 Items ([Make Items and Producer output readable](09-item-and-output-readability.md)) and hold a fixed 10 Items each ([Decide extra Shelves vs. Shelf size](07-shelves-vs-shelf-size.md)).
