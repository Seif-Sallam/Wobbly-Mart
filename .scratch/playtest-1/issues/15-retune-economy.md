# Re-tune the economy

Type: task
Status: resolved
Assignee: Claude (AFK), confirmed by Seif 2026-10-07
Blocked by: 02, 04, 05, 06, 07, 08, 09

## Question

With every playtest decision in place, what are the new Pad costs, Upgrade costs and Upgrade levels (including the new Steady hands Upgrade and the removed Shelf-size Upgrade), so the Corner Shop still reaches 100% in about 30 minutes of good play?

## Context

- AFK: rebuild the price table with the v1 estimator (`.scratch/my-mini-mart-web/price-table/`), fed with the new rules: weighted Shopping Lists (~5.2 Items per Customer) and long patience ([02](02-customer-demand.md)), 6 Stocker Pads with roles ([04](04-stocker-roles-and-count.md)), Stack 8 +2 per level ([05](05-stack-cap-and-wobble.md)), Sprint and Steady hands ([06](06-sprint.md)), fixed 10-Item Shelves and 7 second-Shelf Pads ([07](07-shelves-vs-shelf-size.md)), wheat yield 6 (map notes), and the new layout's trip lengths ([08](08-relayout-corner-shop.md), branch `prototype/relayout`).
- Signal from the re-layout: with placeholder costs and today's sim rules the bot needs 122 simulated minutes to reach 100%.
- Report a full table (every Pad and Upgrade level: cost, Unlock Requirement, expected unlock time) and the bot's minutes to 100%; the owner confirms the pacing before it's final.

## Answer

Resolved 2026-10-07 (AFK run; the owner confirmed the ~30 min pacing, split 7 / 11 / 12). Full table: [price-table/price-table.md](../price-table/price-table.md), timeline: [price-table/timeline.txt](../price-table/timeline.txt), estimator: [price-table/sim.py](../price-table/sim.py) (a copy of the v1 one). Research branch `research/economy` (on `prototype/relayout` plus the demand rules) holds the same prices in `maps/corner-shop/unlocks.ts` / `upgrades.ts` and a trip-meter script (`scripts/measure-trips.ts`).

**Pacing:** estimator **29.8 min** to 100% with good play: Area 1 **7.0**, Area 2 **10.6**, Area 3 **12.2** (v1: 7.4 / 11.6 / 11.5 = 30.5). 79 purchases (v1: 68): 42 Pads, 37 Upgrade levels.

**What the estimator now models:** weighted Shopping Lists (3.3 Items per Customer with 1 Product for sale, rising to 5.2 with 4 or more), Stack 8 +2 per level, Sprint ×1.5 (walk loaded or sprint with drops, whichever is faster; empty legs always sprint), 6 Stockers, wheat yield 6, a second bed/field doubling plants, 7 second Shelves as cost-only leaves, and the re-layout's trip length: **16.3 m** one way (v1 layout 11.8 m, measured the same way). Not modelled: patience and never-give-up Customers, Stocker roles (all Auto), Shelf capacity.

**How:** the new rules alone put the estimator at 35.6 min, and Area 1 at 11 min: a Stack of 8 over 38% longer trips halves the Player's carrying. Prices are rebalanced per Area instead of touching the decided rules: Area cost scale **0.28 / 0.33 / 0.75** (v1 0.45 / 0.40 / 0.70). Area 1 gets cheaper, Area 3 a little dearer because 6 Stockers lift its income.

**Headline prices:** Area 2 $125, Area 3 $1,100, Exit $2,250. Second Shelves $20–25 (Area 1), $125–150 (Area 2), $525–1,100 (Area 3). Stockers $175 / $175 / $200 (Area 2), $900 / $900 / $1,100 (Area 3). Steady hands $25 / $45 / $80. Stack size $20 / $40 / $75 / $125. Shelf size is gone.

**The bot is not the pacing gauge.** On today's game (v1 rules, v1 layout) the bot needs **182 simulated minutes**, against v1's 30.5-minute estimate: it plays about 6× slower than a good player. So the re-layout's "122 minutes" was never a regression. With these prices and rules the bot needs **88.4 min** (it doesn't sprint). The bot stays a reachability gate in CI, as the v1 spec says ("prints simulated time as info").

**Found while doing it — for the spec:** removing the Shelf-size Upgrade trips the validator: `shelf_cap` is in `maps/released-ids.json`, and released ids "must not be removed or renamed". The build needs a way to retire a released id (e.g. a `retired` list the validator accepts, so the id is never reused), not a rename.
