# Decide Customer demand: Shopping List weights and patience

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

What are the exact weighted odds for a Shopping List's size (Products × units), and what is the patience model: the random range, and what share of Customers never give up?

## Context

- Note #24: 4 Products → 2 units; 3 Products → 2 units, rarely 3; 2 Products → 3 units; 1 Product → 4 units. All random with weights, so 4 × 4 is very rare but possible. Today it's uniform 1–4 × 1–4 (`src/sim/customers.ts`, `TUNING.listMax*`).
- Note #22: patience is random but always long, and some Customers never give up. Today it's a fixed `patienceAngry: 20` + `patienceLeave: 10` s, counted only at an empty Shelf.
- To settle: a weight table, the patience distribution, how a never-give-up Customer looks (if at all), and whether the glossary's "mild patience" wording changes.

## Answer

Resolved 2026-10-03 (grilling with the owner).

**Shopping List size** — three rolls:

1. **Product count**, weighted: 1 → 30%, 2 → 35%, 3 → 25%, 4 → 10%. Counts above the Products for sale are dropped and the rest renormalised (no clamping).
2. **Units**, one roll per list; every line on it wants that many. Weights by Product count:

   | Products | 1 unit | 2 units | 3 units | 4 units |
   |---|---|---|---|---|
   | 4 | 15% | 80% | 4% | 1% |
   | 3 | 10% | 70% | 18% | 2% |
   | 2 | 10% | 25% | 55% | 10% |
   | 1 | 5% | 15% | 25% | 55% |

3. Which Products: a random pick from those for sale, as today.

A 4 × 4 list is 0.1% of Customers. The average Customer buys ~5.2 Items (was 6.25), which feeds the economy re-tune.

**Patience:**

- Each Customer rolls patience **45–90 s** (uniform) at an empty Shelf, then **15 s** visibly angry, then drops the cart as a Mess and leaves. Still resets on every Item taken, still off in the tutorial.
- **25%** of Customers never give up: never angry, never leave until the list is done. No marker; they just wait. They can hold Customer Cap slots while a Shelf stays empty — that's the intended cost of ignoring it.

**Glossary:** Shopping List and Customer entries updated in `CONTEXT.md`.
