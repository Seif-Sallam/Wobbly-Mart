# Decide Customer demand: Shopping List weights and patience

Type: grilling
Status: open
Blocked by: —

## Question

What are the exact weighted odds for a Shopping List's size (Products × units), and what is the patience model: the random range, and what share of Customers never give up?

## Context

- Note #24: 4 Products → 2 units; 3 Products → 2 units, rarely 3; 2 Products → 3 units; 1 Product → 4 units. All random with weights, so 4 × 4 is very rare but possible. Today it's uniform 1–4 × 1–4 (`src/sim/customers.ts`, `TUNING.listMax*`).
- Note #22: patience is random but always long, and some Customers never give up. Today it's a fixed `patienceAngry: 20` + `patienceLeave: 10` s, counted only at an empty Shelf.
- To settle: a weight table, the patience distribution, how a never-give-up Customer looks (if at all), and whether the glossary's "mild patience" wording changes.
