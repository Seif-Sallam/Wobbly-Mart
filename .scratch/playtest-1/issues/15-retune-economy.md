# Re-tune the economy

Type: task
Status: open
Blocked by: 02, 04, 05, 06, 07, 08, 09

## Question

With every playtest decision in place, what are the new Pad costs, Upgrade costs and Upgrade levels (including the new Steady hands Upgrade and the removed Shelf-size Upgrade), so the Corner Shop still reaches 100% in about 30 minutes of good play?

## Context

- AFK: rebuild the price table with the v1 estimator (`.scratch/my-mini-mart-web/price-table/`), fed with the new rules: weighted Shopping Lists (~5.2 Items per Customer) and long patience ([02](02-customer-demand.md)), 6 Stocker Pads with roles ([04](04-stocker-roles-and-count.md)), Stack 8 +2 per level ([05](05-stack-cap-and-wobble.md)), Sprint and Steady hands ([06](06-sprint.md)), fixed 10-Item Shelves and 7 second-Shelf Pads ([07](07-shelves-vs-shelf-size.md)), wheat yield 6 (map notes), and the new layout's trip lengths ([08](08-relayout-corner-shop.md), branch `prototype/relayout`).
- Signal from the re-layout: with placeholder costs and today's sim rules the bot needs 122 simulated minutes to reach 100%.
- Report a full table (every Pad and Upgrade level: cost, Unlock Requirement, expected unlock time) and the bot's minutes to 100%; the owner confirms the pacing before it's final.
