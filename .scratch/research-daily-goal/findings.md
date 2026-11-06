# Daily goal numbers: 3–4 parts, one late, bot under 20 min

Ticket: https://github.com/Seif-Sallam/Wobbly-Mart/issues/160. Branch `research/daily-goal`, cut from `research/daily-formats` (acd302b), so it already has the reworked Corner and Courtyard formats. This branch is never merged. The build copies `diff.patch` (it leaves out `maps/daily-calendar.json`).

All the numbers come from 365 days (2026-11-01 to 2027-10-31), with every decided Daily change in place:
- free Steady hands, safe count 7;
- `stocker_2` in Area 3 of 3-Area Maps;
- Corner and Courtyard as crossroads.

## Result

| | value |
|---|---|
| parts per day | 3 parts: 201 days; 4 parts: 164 days (45 %) |
| late part | own: 345; sell: 20 |
| where the late part sits | last Area: 289; an earlier Area but past the chain midpoint: 50; **not late (fallback)**: 26 (7 %) |
| bot minutes, all days | min 8.3, median 11.9, p90 16.6, max 18.0 |
| bot minutes, 1-Area (Kit) | median 11.7, max 12.0 |
| bot minutes, 2-Area | median 11.8, p90 15.0, max 17.9 |
| bot minutes, 3-Area | median 13.1, p90 17.4, max 18.0 |
| days the bot fails within `capMinutes` (20) | **0** |
| rerolls | 3 |

The raw output is in `report-365.txt` and `sweep-120.txt`.

## Why the economy had to change

On 3-Area Maps the bot as it is today reaches Area 3 within 25 minutes on only 12 of 34 days. One day (2026-11-15) bought no Pad in 20 minutes: it earned $1224 and spent about $1030 of it on 15 Upgrade levels. The bot buys any Upgrade it can afford before it saves for the next Pad. Daily Upgrade costs also double on Maps with more than one Area, which adds up to about $1300. So the later Areas run out of money.

A sweep (`sweep.ts`, knobs on `TUNING.dailyMap`) settled on these numbers:
- the Upgrade ×2 for multi-Area Maps is dropped;
- `padBase [12, 60, 300]` becomes `[12, 40, 100]`;
- `padGrowth 1.18` becomes `1.12`;
- `areaPadShare 0.6` becomes `0.35`.

With those, 3-Area Maps pass the chain midpoint at a median of 13.3 min (p90 17.2). They buy Area 3 at a median of 14.1 min. The bot was not changed: it is shared with the normal Maps.

## Calibration design (`calibrateDaily`)

1. **Adaptive target.** The no-goal bot plays until it buys its first **late Pad**, within `targetMinutes: [12, 18]`. A late Pad sits at index `floor(chain × lateFrom)` or later, where `lateFrom = 0.5`. The chain excludes Opening Pads and Exit. On 2-Area and 3-Area Maps the midpoint falls about where the last Area starts. Each goal part is what the bot had reached by then. The verification bot is deterministic and runs on the same seed, so its time is never later than the stop point.
2. **Parts.** There are `goalParts 3` parts, plus one more at `extraPartChance 0.45`. The **late part is always last**. It is one of two things:
   - Sell the furthest late Shelf's product, at `lateSellChance 0.5`, when the bot sold at least `sellMin` of it;
   - otherwise Own the furthest late Pad.

   The other parts come from a pool, one of each kind first (Earn, Deliveries if at least 2, Sell of the best-priced product), then more Sells.
3. **Fallback (7 % of days).** Some days reach no late Pad in 18 min. The late part is then Own the furthest Pad the bot bought, which is still past the Opening.
4. `ownAfter` is removed. `targetMinutes` becomes a `[min, max]` pair.

Sell-late is rare (5 %) because calibration stops right after the late Pad is bought, before any of its Items are sold.

## Other changes in the diff

- `DailyDay.botTicks` is stored in `maps/daily-calendar.json` (decision 1g).
- `safeCount` returns `TUNING.dailyMap.safe = 7` on a Daily Map. It tells a Daily Map by its `daily-` id prefix. The build may prefer a flag on the MapDef.
- `stocker_2` uses the `STRIP.stocker` spot of Area 3. Its cost is `cost() × staffCost.stocker`, the same as `stocker_1`.

## Build notes

- `golden.test.ts` and `replay.test.ts` fail, as expected: bump `SIM_VERSION` (golden asks for 3), update GOLDEN, and refresh the replay fixture. `npm run daily:check` passes against the regenerated calendar.
- Regenerate the calendar after the bump: `npm run daily:calendar` takes about 3 min for 365 days on 12 processes.

## Scripts

`probe.ts` (chain progress at 10/12/15/20 min), `chain.ts` (one day's Pads and buy times), `spend.ts` (where the Money goes), `sweep.ts` (knob sweep), `report.ts` (calendar summary).
