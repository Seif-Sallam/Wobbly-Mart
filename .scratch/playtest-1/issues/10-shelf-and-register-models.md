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
