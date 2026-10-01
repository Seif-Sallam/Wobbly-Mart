# Design the economy and progression of the first map

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-02)
Blocked by: 03

## Question

What is the shape of the first map's progression — the unlock order of stations/expansions/staff, what each costs relative to income, player upgrades, and what "finishing" the map means (and how it hands off to a next map)?

## Context

Build on [Decide which mechanics the clone includes](03-core-mechanics-scope.md): unlock order is expressed as Unlock Requirements over Pads, Areas and Office Upgrades; Completion % weights every Pad and Upgrade level equally; capacities everywhere are upgrade levers. Shopping List ≤4 Products × ≤4 units.

## Answer

Resolved 2026-10-02 (grilling). Glossary: `/CONTEXT.md` (new: **Sale Price**, **Customer Cap**, **Exit Pad**).

- **Length:** 30–40 min to 100% Completion.
- **Products (7) / Areas (3):** Area 1 Tomato (Crop), Egg (Chicken, eats Tomato), Ketchup (Blender); Area 2 Wheat (Crop), Milk (Cow, eats Wheat), Flour (Mill); Area 3 Bread (Oven).
- **Recipes:** one of each input → 1 output. Chicken Tomato→Egg; Blender Tomato→Ketchup; Cow Wheat→Milk; Mill Wheat→Flour; Oven Flour + Egg→Bread.
- **Unlock shape:** mostly linear, 1–3 Pads open at once (`|` = opened together), Area Pads gate phases:
  - Area 1: Register → Tomato Shelf → Tomato bed (these three = exactly the starting Money) → Egg Shelf → Chicken Coop → Office → Ketchup Shelf → Blender → Cashier | 2nd Chicken | more Tomato plots
  - Area 2 Pad → Trash Bin (free, not a Pad, not in Completion) → Wheat Shelf → Wheat field → Milk fridge → Cow pen | Flour Shelf → Mill → Stocker | more Wheat plots | 2nd Cow
  - Area 3 Pad → Bread Shelf → Oven → 2nd Register → 2nd Cashier | 2nd Stocker → Exit Pad (requires Oven)
- **Pricing:** costs are hand-picked raw numbers (goals for the player), not derived from wait times. Fixed Sale Prices, never upgradable, processed ≈1.5–2× inputs: Tomato $3, Egg $5, Ketchup $6, Wheat $4, Milk $7, Flour $8, Bread $20.
- **Cost scale (anchors):** early Pads $10–$95; Area 2 Pad ~$400; Area 3 Pad ~$1,500; Exit Pad ~$3,000; Upgrade level 1 ~$50–200, ×1.8 per level. May be lowered a little after play-testing. A spreadsheet only sanity-checks total time; it doesn't set the numbers.
- **Demand:** Customer Cap = (2 + 1 per Product for sale) × 1.3 per Cashier (compounding), rounded down → 3 at start, 15 max (7 Products, 2 Cashiers). Below the cap, a new Customer arrives every ~3 s. No other spawn lever.
- **Upgrades (11, 38 levels, max 4 each):** Player Speed (4), Stack capacity (4); Cashier speed (3), Stocker speed (4), Stocker carry (4); per-Producer Speed for the 7 Producers (2–3 levels, ~19 total); global Shelf capacity (3). More plots/animals are Pads. Level 1 of each appears once its station/Staff is bought.
- **Finishing:** 100% Completion triggers a celebration. Exit Pad beside a car leads to the next map ("coming soon" in v1). Money is per map, never carried over. Travel back is possible anytime: the car opens a picker of visited maps, and the menu has a map list.
- **Revised by [Author the first map's price table and timings](10-price-table.md):** concrete (lower) costs replace the anchors above; Stocker moved to the start of Area 2; Area 3 gained 2nd Blender/Mill/Oven Pads; Upgrades are 37 levels; Customer arrival follows the Customer Cap.
