# Measure how many Stockers the store needs

Type: task
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: 02

## Question

With the new demand from [Decide Customer demand](02-customer-demand.md), how many angry Customers leave per 10 minutes on a fully unlocked Corner Shop for each staffing mix (0–6 Stockers, Player idle vs. Player helping)? What's the smallest mix that runs the store with almost no Messes?

## Context

AFK: drive the headless sim (`scripts/bot-playthrough.ts`, `src/sim/staff.ts`) at high speed. Note #7: at 30× speed many Customers left angry, and the owner thinks the store needs about 5 workers including the Player. Today there are 2 Stocker Pads (`stocker_1` $200, `stocker_2` $850). Report a table, not a recommendation.

## Answer

Resolved 2026-10-03 (task, AFK). Code and script on branch `research/stocker-need` (`scripts/measure-stockers.ts`, with the [Decide Customer demand](02-customer-demand.md) rules built in the sim). Not for merge.

**Setup:** the bot plays the Corner Shop to 100% (seed 1: every Pad, every Upgrade at max, 2 Registers with Cashiers, Customer Cap 15). That save is re-opened with 0–10 unassigned Stockers (extras cloned from `stocker_1`, same speed/carry Upgrades), tutorial done, money 0. 5 min warm-up, then 30 min measured, 3 seeds averaged. "Idle" = Player stands still at the start; "helping" = the CI bot carries, works Registers and collects cash (it clears Messes only by walking over them).

**New demand rules** (weighted lists, 45–90 s patience + 15 s, 25% never give up):

| Stockers | Player | Served /10 min | Turned angry /10 min | Left angry (Mess) /10 min | % left angry | Items sold /10 min | Messes on floor at end |
|---|---|---|---|---|---|---|---|
| 0 | idle | 0 | 0 | 0 | — | 0 | 0 |
| 1 | idle | 28.6 | 19.3 | 8.4 | 23% | 172 | 32.3 |
| 2 | idle | 53.7 | 21.7 | 9.9 | 16% | 312 | 37.7 |
| 3 | idle | 77.6 | 26.1 | 12.1 | 14% | 429 | 42.0 |
| 4 | idle | 96.7 | 26.1 | 10.2 | 10% | 532 | 35.3 |
| 5 | idle | 114.6 | 22.1 | 8.1 | 7% | 615 | 28.3 |
| 6 | idle | 132.0 | 13.9 | 2.7 | 2% | 698 | 11.0 |
| 7 | idle | 150.8 | 7.0 | 1.6 | 1% | 786 | 6.7 |
| 8 | idle | 167.2 | 3.1 | 0.3 | 0% | 872 | 1.7 |
| 10 | idle | 202.8 | 0.4 | 0.0 | 0% | 1062 | 0.3 |
| 0 | helping | 26.9 | 19.4 | 8.2 | 23% | 162 | 19.0 |
| 1 | helping | 45.1 | 21.7 | 10.7 | 19% | 257 | 17.7 |
| 2 | helping | 62.8 | 22.1 | 10.8 | 15% | 351 | 22.7 |
| 3 | helping | 89.4 | 27.3 | 12.4 | 12% | 488 | 30.7 |
| 4 | helping | 107.8 | 25.0 | 8.4 | 7% | 581 | 17.3 |
| 5 | helping | 126.4 | 18.9 | 5.3 | 4% | 668 | 4.3 |
| 6 | helping | 139.7 | 12.2 | 3.1 | 2% | 739 | 5.3 |
| 7 | helping | 160.2 | 4.7 | 0.4 | 0% | 833 | 1.3 |
| 8 | helping | 178.6 | 1.4 | 0.0 | 0% | 932 | 0.0 |
| 10 | helping | 211.1 | 0.2 | 0.0 | 0% | 1101 | 0.0 |

**Baseline, today's rules on master** (uniform 1–4 × 1–4, 20 s + 10 s, everyone gives up) — what the owner played:

| Stockers | Idle: left angry /10 min (%) | Helping: left angry /10 min (%) |
|---|---|---|
| 1 | 45.1 (64%) | 54.1 (55%) |
| 2 | 56.7 (55%) | 55.4 (49%) |
| 4 | 40.1 (32%) | 37.8 (28%) |
| 6 | 23.2 (16%) | 19.8 (13%) |

**Facts worth knowing for the Stocker decision:**

- The new demand alone cuts angry leaves ~5× at today's 2 Stockers (55% → 16% idle), but doesn't remove them.
- "Almost no Messes" (≤ 1 angry leave /10 min) needs **7 Stockers + the Player helping**, or **8 with the Player idle**. 6 + Player gets to ~3 /10 min (2%).
- Throughput hasn't saturated even at 10 Stockers: Items sold keeps rising ~90 /10 min per extra Stocker, so Stockers are the store's bottleneck, not Customer Cap (15) or Cashiers.
- The bot Player is worth roughly one Stocker. With the 3–4 mid counts, angry *rises* slightly vs. 1–2 because more Customers get served and so more reach empty Shelves.
- Messes pile up on the floor with nobody to clear them (30–40 at 2–4 Stockers idle); they slow Customers (`messSlowdown`), which compounds the shortfall.
- All Stockers here are unassigned. Specialised roles ([Decide Stocker roles and count](04-stocker-roles-and-count.md)) may change the numbers.
- View note for the spec: the Customer bubble's patience ring is `patience / (angry + leave)`. For a never-give-up Customer it would never shrink, which is a visible tell — conflicts with "no marker" in [Decide Customer demand](02-customer-demand.md).
