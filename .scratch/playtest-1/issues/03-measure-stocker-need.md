# Measure how many Stockers the store needs

Type: task
Status: open
Blocked by: 02

## Question

With the new demand from [Decide Customer demand](02-customer-demand.md), how many angry Customers leave per 10 minutes on a fully unlocked Corner Shop for each staffing mix (0–6 Stockers, Player idle vs. Player helping)? What's the smallest mix that runs the store with almost no Messes?

## Context

AFK: drive the headless sim (`scripts/bot-playthrough.ts`, `src/sim/staff.ts`) at high speed. Note #7: at 30× speed many Customers left angry, and the owner thinks the store needs about 5 workers including the Player. Today there are 2 Stocker Pads (`stocker_1` $200, `stocker_2` $850). Report a table, not a recommendation.
