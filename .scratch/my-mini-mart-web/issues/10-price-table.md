# Author the first map's price table and timings

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-02)
Blocked by: 05

## Question

What are the concrete numbers for the first map: every Pad cost, every Upgrade level cost, starting Money, Producer work/regrow times, capacities per level, Customer patience? Does a simple spreadsheet sanity-check put the total at 30–40 min to 100% Completion?

## Context

Shape and anchors are fixed in [Design the economy and progression of the first map](05-economy-and-progression.md): hand-picked raw numbers (not derived from wait times), Sale Prices set, Pad/Upgrade cost scale, Customer Cap formula. The spreadsheet is a sanity check only; the owner picks the numbers. Link the sheet as an asset.

## Answer

Resolved 2026-10-02 (grilling). Assets: full table `price-table/price-table.md`, estimator `price-table/sim.py` (`python3 sim.py` → timeline; `--table` → regenerates the table), last run `price-table/timeline.txt`.

**Target:** ~30 min in the estimator (perfect play), expected ~30–40 min real. Current run: **29.6 min** — Area 1 ~7, Area 2 ~11, Area 3 ~11. Drift is fine; numbers get tuned by playing.

**Key finding:** the Player's carrying is the bottleneck almost throughout. A bigger Stack alone barely helps (10 → 30 only cut 64 → 60 min — each Item still takes ~0.5 s to move), so costs came down rather than the prototype's feel values going up.

**Costs**
- Starting Money $50 = Register $10 + Tomato Shelf $15 + Tomato bed $25.
- Relative to the anchors in [Design the economy and progression of the first map](05-economy-and-progression.md): Area 1 ×0.45, Area 2 ×0.4, Area 3 ×0.7. Area 1 Pads $15–45; Area 2 Pad $150, then $60–200; Area 3 Pad $1,050 (the jump is kept), then $425–1,050; Exit $2,100.
- Upgrades ×1.8 per level, scaled by the Area of the station they belong to (Office Upgrades count as Area 1).
- Rounded: to $5 under $100, $25 under $1,000, $50 above.

**Unlock order changes** (revises the economy ticket):
- Stocker is the first Pad after the Area 2 Pad.
- Area 3 Pad requires the Mill.
- New Area 3 Pads: 2nd Blender, 2nd Mill, 2nd Oven (needs both); Exit requires the 2nd Oven.

**Upgrades — 37 levels** (the economy ticket's "38" didn't match its own breakdown): Stack 16→32 (+4/level; base raised from the prototype's 10), Player Speed 5.5→7.5 m/s, Shelf 8→20, Cashier 2.0→1.0 s/Customer, Stocker speed 4.0→6.0 m/s, Stocker carry 6→14; Producer speed ×0.8 work time per level — Tomato 3, Chicken 2, Blender 2, Wheat 3, Cow 2, Mill 1, Oven 2.

**Producers:** Tomato bed 4 plants × 6 s regrow; Wheat field 4 plants × 7 s; "more plots" Pad +4 plants. Chicken 4 s, Cow 5 s, Blender 3 s, Mill 4 s, Oven 6 s per output; a 2nd one doubles output. Tray 6, input queue 6 (Oven 4 + 4) — fixed for now, may change later.

**Customers:** arrive as fast as the Customer Cap allows (fastest every 1.5 s) — the "~3 s" is only the opening pace. Patience runs **only while waiting at an empty Shelf**: angry after 20 s, Mess 10 s later. Anyone in a Register line or on a Waiting Spot never gets angry. A Mess slows passing Customers 50% until walked over.

**Checkout:** Player at a Register 1.5 s/Customer (faster than an un-upgraded Cashier).
