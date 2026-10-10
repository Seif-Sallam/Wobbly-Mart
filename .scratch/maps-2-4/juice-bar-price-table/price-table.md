# Juice Bar price table

Answers [#46](https://github.com/Seif-Sallam/Wobbly-Mart/issues/46). Numbers live in `maps/juice-bar/unlocks.ts` and `upgrades.ts`; regenerate the tables with
`npx tsx .scratch/maps-2-4/juice-bar-price-table/bot-table.ts juice-bar 5 --juice-events --table`.

## Method

The playtest-2 table used a Python estimator calibrated against the bot. Here the **CI bot is the measure**: it plays the real sim over 5 seeds and logs when each Pad and Upgrade level is bought. `--juice-events` applies [#40](https://github.com/Seif-Sallam/Wobbly-Mart/issues/40)'s Juice Bar numbers (cars every 110–150 s, `carStockers` [1, 3, 5], extra-car odds 0.5, visits ≈ every 5–7.5 min) until per-Map Event timing is built. The bot fills car orders but ignores Thieves and the Inspector, so it pays their costs: a pessimistic player.

Target: 100% near the Corner Shop's pace, with each Area taking about as long.

| Bot, 5 seeds | Area 1 | Area 2 | Area 3 | 100% | Delivery pay |
|---|---|---|---|---|---|
| Corner Shop | 24.9 min | 33.9 min | 39.7 min | **98.5 min** | $791 |
| Juice Bar, first pass | 24.5 min | 24.9 min | 41.6 min | 90.9 min (3 seeds) | $1197 |
| **Juice Bar, tuned** | 25.4 min | 31.4 min | 41.0 min | **97.7 min** (96.0–100.2) | $1102 |

The first pass ran Area 2 in 25 min: sugar ($8) and candy apples ($16) pay well while its costs copied the Corner Shop's. Changes: **Area 2 Pads and the Area 2 Upgrades (cane, sugar mill, candy pot, Stocker speed and carry, Mop speed) ×1.3**, `area_2` $150 → $175, `area_3` $1100 → $1600. Area 1 and Area 3 Pads are unchanged. Well inside the 4 h gate.

Deliveries pay about 4 % of the $27,185 total spend (Pads $20,935, Upgrades $6,250), so the payout stays at 1.5× Sale Price.

## Pads (bot buy order)

| Area | Pad | Cost | Requires | Bought at |
|---|---|---|---|---|
| 1 | register | $10 | — | 0:05 |
| 1 | apple_shelf | $15 | register | 0:09 |
| 1 | apple_tree | $25 | apple_shelf | 0:15 |
| 1 | orange_shelf | $15 | apple_tree | 1:03 |
| 1 | orange_tree | $25 | orange_shelf | 1:49 |
| 1 | office | $20 | orange_tree | 2:17 |
| 1 | apple_juice_shelf | $25 | office | 3:50 |
| 1 | apple_press | $30 | apple_juice_shelf | 5:07 |
| 1 | cashier_1 | $25 | apple_press | 5:33 |
| 1 | apple_tree_2 | $25 | apple_press | 6:14 |
| 1 | apple_shelf_2 | $20 | apple_tree_2 | 6:45 |
| 1 | orange_tree_2 | $30 | apple_press | 8:15 |
| 1 | orange_juice_shelf | $40 | cashier_1 | 8:19 |
| 1 | orange_shelf_2 | $25 | orange_tree_2 | 8:48 |
| 1 | squeezer | $50 | orange_juice_shelf | 10:02 |
| 1 | orange_juice_shelf_2 | $60 | squeezer | 12:10 |
| 1 | apple_juice_shelf_2 | $60 | squeezer | 12:35 |
| 2 | area_2 | $175 | squeezer | 25:23 |
| 2 | stocker_1 | $225 | area_2 | 29:19 |
| 2 | sugar_cane_field | $85 | stocker_1 | 30:04 |
| 2 | sugar_shelf | $100 | sugar_cane_field | 30:56 |
| 2 | sugar_mill | $150 | sugar_shelf | 32:51 |
| 2 | candy_apple_shelf | $150 | sugar_mill | 34:33 |
| 2 | stocker_3 | $225 | sugar_cane_field | 39:07 |
| 2 | candy_pot | $200 | candy_apple_shelf | 39:10 |
| 2 | cane_field_2 | $200 | candy_pot | 40:33 |
| 2 | sugar_shelf_2 | $200 | cane_field_2 | 41:40 |
| 2 | candy_apple_shelf_2 | $225 | cane_field_2 | 42:39 |
| 2 | sugar_mill_2 | $225 | cane_field_2 | 44:05 |
| 2 | stocker_4 | $250 | sugar_mill | 45:26 |
| 2 | candy_pot_2 | $300 | sugar_mill_2 | 47:39 |
| 3 | area_3 | $1600 | cane_field_2 | 56:44 |
| 3 | strawberry_shelf | $300 | area_3 | 57:20 |
| 3 | strawberry_patch | $350 | strawberry_shelf | 58:15 |
| 3 | milk_fridge | $400 | strawberry_patch | 60:09 |
| 3 | cow_pen | $450 | milk_fridge | 61:12 |
| 3 | smoothie_shelf | $450 | cow_pen | 63:40 |
| 3 | smoothie_blender | $675 | smoothie_shelf | 65:33 |
| 3 | strawberry_shelf_2 | $500 | smoothie_blender | 67:40 |
| 3 | register_2 | $600 | smoothie_blender | 70:13 |
| 3 | cow_2 | $750 | smoothie_blender | 77:33 |
| 3 | cashier_2 | $750 | register_2 | 77:54 |
| 3 | milk_fridge_2 | $600 | cow_2 | 79:05 |
| 3 | cleaner | $900 | smoothie_blender | 79:33 |
| 3 | cane_field_3 | $750 | smoothie_blender | 79:45 |
| 3 | stocker_5 | $900 | smoothie_blender | 85:01 |
| 3 | stocker_2 | $900 | cow_2 | 86:51 |
| 3 | smoothie_blender_2 | $1100 | cane_field_3, cow_2 | 89:08 |
| 3 | smoothie_shelf_2 | $1100 | smoothie_blender_2 | 90:55 |
| 3 | stocker_6 | $1100 | smoothie_blender_2 | 92:30 |
| 3 | stocker_7 | $1300 | stocker_6 | 94:47 |
| 3 | exit | $2250 | smoothie_blender_2 | 97:44 |

## Upgrades

| Upgrade | Appears after | Level costs (bought at) | Values |
|---|---|---|---|
| player_speed | office | $15 (3:17) / $30 (12:28) / $55 (17:55) / $100 (22:02) | 6 → 6.5 → 7 → 7.5 |
| stack_cap | office | $20 (5:27) / $40 (14:50) / $75 (19:45) / $125 (23:31) | 10 → 12 → 14 → 16 |
| steady_hands | office | $25 (8:51) / $45 (16:22) / $80 (21:04) | 4 → 5 → 6 |
| mop_speed | area_2 | $125 (26:34) / $225 (46:50) | 1.5 → 1 |
| speed_apple_tree | apple_tree | $15 (4:10) / $25 (11:29) / $45 (16:54) | 0.8 → 0.64 → 0.512 |
| speed_orange_tree | orange_tree | $20 (7:10) / $35 (13:49) / $55 (18:50) | 0.8 → 0.64 → 0.512 |
| speed_apple_press | apple_press | $20 (8:28) / $35 (14:21) | 0.8 → 0.64 |
| speed_squeezer | squeezer | $30 (12:59) / $50 (17:18) | 0.8 → 0.64 |
| speed_sugar_cane_field | sugar_cane_field | $65 (30:33) / $125 (33:51) / $200 (44:10) | 0.8 → 0.64 → 0.512 |
| speed_sugar_mill | sugar_mill | $85 (33:38) / $150 (35:52) | 0.8 → 0.64 |
| speed_candy_pot | candy_pot | $125 (39:33) / $200 (45:10) | 0.8 → 0.64 |
| speed_strawberry_patch | strawberry_patch | $150 (58:29) / $250 (59:05) | 0.8 → 0.64 |
| speed_cow_pen | cow_pen | $200 (61:46) / $300 (62:28) | 0.8 → 0.64 |
| speed_smoothie_blender | smoothie_blender | $300 (66:10) / $500 (69:55) | 0.8 → 0.64 |
| cashier_speed | cashier_1 | $40 (15:08) / $75 (20:29) / $125 (25:13) | 1.6 → 1.3 → 1 |
| stocker_speed | stocker_1 | $85 (31:23) / $150 (36:48) / $300 (48:56) / $500 (50:60) | 4.5 → 5 → 5.5 → 6 |
| stocker_carry | stocker_1 | $85 (32:21) / $150 (37:39) / $300 (49:46) / $500 (52:31) | 8 → 10 → 12 → 14 |

## Moves

| Move | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Price | $40 | $60 | $90 | $150 | $200 | $275 | $400 | $525 | $650 |

Moves are not in Completion; 3 open per Area bought.

## Events

All three on from the first Opening (`requires: []`, #40); none in the first 3 min. Area 1 amounts are new (about 40 % of Area 2's); Area 2 and 3 match the Corner Shop, since the Juice Bar's income per Area is about the same.

| Event | Area | Amounts |
|---|---|---|
| Delivery | 1 / 2 / 3 | 3–6 / 5–9 / 7–12 Items; 1.5× Sale Price + tip up to 25 %; a car every 110–150 s, a 4th car waits once you have 5 Stockers, 0.5 extra-car odds |
| Health inspector | 1 | spotless $40–80; fine $10 per Mess / Loose Item; bad review +$60 |
| Health inspector | 2 | spotless $100–200; fine $20; bad review +$150 |
| Health inspector | 3 | spotless $300–600; fine $60; bad review +$450 |
| Robbery | 1 | bounty $15; steals half a Cash Pile over $60 |
| Robbery | 2 | bounty $40; Cash Pile over $150 |
| Robbery | 3 | bounty $120; Cash Pile over $400 |

Robbery and the Inspector: each every 10–15 min, at least 2 min after the last visit ends (#40).

## Not measured

- Area 1 Robbery and Inspector (needs #40's build); expect a little slower, the bot already loses later visits.
- A real player's pace: the Corner Shop's estimator said 32 min of good play against the bot's 98, so expect the Juice Bar near the same ~35 min.
