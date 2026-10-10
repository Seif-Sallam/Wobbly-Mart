# Dairy Farm price table

Answers [#50](https://github.com/Seif-Sallam/Wobbly-Mart/issues/50). Numbers live in `maps/dairy-farm/unlocks.ts` and `upgrades.ts`; regenerate the tables with
`npx tsx .scratch/maps-2-4/dairy-farm-price-table/bot-table.ts dairy-farm 5 --dairy-events --table`.

## Method

As for the Juice Bar (#46): the **CI bot is the measure**, 5 seeds, logging when each Pad and Upgrade level is bought. `--dairy-events` applies [#40](https://github.com/Seif-Sallam/Wobbly-Mart/issues/40)'s Dairy Farm numbers: Deliveries at the defaults and the Inspector every 2–4 min. The sim still has one shared visit timer, so the Inspector runs alone at that gap; the Robbery (every 10–15 min) is left out. The bot ignores the Inspector, so it pays every fine and bad review: a pessimistic player.

Target: 100% near the Corner Shop's pace, with each Area taking about as long.

| Bot, 5 seeds | Area 1 | Area 2 | Area 3 | 100% | Delivery pay |
|---|---|---|---|---|---|
| Corner Shop | 24.9 min | 33.9 min | 39.7 min | **98.5 min** | $791 |
| Dairy Farm, first pass | 23.7 min | 39.3 min | 38.7 min | 101.7 min | $1018 |
| **Dairy Farm, tuned** | 23.7 min | 36.5 min | 39.0 min | **99.2 min** (95.4–101.1) | $959 |

The first pass used Juice Bar–shaped prices. Area 2 ran long because the west wing adds eight Pads to it (Register 3, Cashier 3, the second presses, the third cheese Shelves and Stockers 8 and 9). Changes: **those eight Pads ×0.75**, and `area_3` $1600 → $1300. Area 2 still runs about 2.5 min longer than the Corner Shop's, but Area 1 runs about 1 min shorter, so the total is within a minute. Everything else is unchanged. Well inside the 4 h gate.

The Inspector every 2–4 min costs the bot only about 0.4 min against the default visit timing (101.3 min), even though the bot never escorts the Inspector.

## Pads (bot buy order)

| Area | Pad | Cost | Requires | Bought at |
|---|---|---|---|---|
| 1 | register | $10 | — | 0:05 |
| 1 | wheat_shelf | $15 | register | 0:08 |
| 1 | wheat_field | $25 | wheat_shelf | 0:12 |
| 1 | milk_fridge | $15 | wheat_field | 1:06 |
| 1 | cow_pen | $25 | milk_fridge | 1:35 |
| 1 | office | $20 | cow_pen | 2:03 |
| 1 | butter_shelf | $25 | office | 3:04 |
| 1 | milk_fridge_2 | $25 | cow_pen | 3:25 |
| 1 | butter_churn | $30 | butter_shelf | 3:57 |
| 1 | cashier_1 | $25 | butter_churn | 4:39 |
| 1 | wheat_field_2 | $25 | butter_churn | 5:18 |
| 1 | wheat_shelf_2 | $20 | wheat_field_2 | 6:06 |
| 1 | butter_shelf_2 | $60 | butter_churn | 7:12 |
| 2 | area_2 | $175 | cashier_1 | 23:41 |
| 2 | stocker_1 | $225 | area_2 | 26:25 |
| 2 | goat_milk_fridge | $80 | stocker_1 | 27:00 |
| 2 | goat_pen | $100 | goat_milk_fridge | 27:28 |
| 2 | cheese_shelf | $150 | goat_pen | 29:30 |
| 2 | goat_milk_fridge_2 | $150 | goat_pen | 31:06 |
| 2 | cheese_press | $200 | cheese_shelf | 33:17 |
| 2 | cow_2 | $200 | cheese_press | 35:49 |
| 2 | goat_cheese_shelf | $200 | cheese_press | 36:14 |
| 2 | stocker_3 | $225 | goat_pen | 40:41 |
| 2 | cheese_press_2 | $225 | cow_2 | 40:51 |
| 2 | cleaner | $600 | cheese_press | 41:18 |
| 2 | stocker_4 | $250 | cheese_press | 42:11 |
| 2 | cheese_shelf_2 | $225 | cheese_press | 42:23 |
| 2 | cheese_shelf_3 | $200 | cheese_press_2 | 43:15 |
| 2 | goat_cheese_press | $275 | goat_cheese_shelf | 45:04 |
| 2 | goat_cheese_press_2 | $275 | goat_cheese_press | 46:33 |
| 2 | goat_cheese_shelf_3 | $250 | goat_cheese_press_2 | 47:45 |
| 2 | goat_cheese_shelf_2 | $275 | goat_cheese_press | 48:20 |
| 2 | register_3 | $375 | goat_cheese_press | 50:39 |
| 2 | stocker_8 | $225 | register_3 | 51:40 |
| 2 | stocker_9 | $250 | stocker_8 | 52:56 |
| 2 | cashier_3 | $450 | register_3 | 54:16 |
| 3 | area_3 | $1300 | goat_cheese_press | 60:14 |
| 3 | strawberry_shelf | $300 | area_3 | 60:31 |
| 3 | strawberry_patch | $350 | strawberry_shelf | 60:54 |
| 3 | ice_cream_shelf | $400 | strawberry_patch | 61:54 |
| 3 | ice_cream_maker | $600 | ice_cream_shelf | 63:30 |
| 3 | egg_shelf | $450 | ice_cream_maker | 64:21 |
| 3 | chicken_coop | $500 | egg_shelf | 65:57 |
| 3 | pudding_shelf | $500 | chicken_coop | 67:24 |
| 3 | strawberry_shelf_2 | $500 | ice_cream_maker | 68:17 |
| 3 | egg_shelf_2 | $600 | chicken_coop | 69:47 |
| 3 | pudding_pot | $700 | pudding_shelf | 72:02 |
| 3 | register_2 | $600 | pudding_pot | 74:27 |
| 3 | cow_3 | $750 | pudding_pot | 75:30 |
| 3 | cashier_2 | $750 | register_2 | 77:60 |
| 3 | wheat_field_3 | $750 | pudding_pot | 79:07 |
| 3 | chicken_2 | $750 | pudding_pot | 81:54 |
| 3 | stocker_5 | $900 | ice_cream_maker | 82:22 |
| 3 | stocker_2 | $900 | cow_3 | 83:45 |
| 3 | ice_cream_maker_2 | $1100 | cow_3 | 84:51 |
| 3 | ice_cream_shelf_2 | $900 | ice_cream_maker_2 | 86:56 |
| 3 | pudding_pot_2 | $1100 | chicken_2, wheat_field_3 | 89:22 |
| 3 | pudding_shelf_2 | $1100 | pudding_pot_2 | 90:37 |
| 3 | stocker_6 | $1100 | pudding_pot_2 | 91:32 |
| 3 | stocker_7 | $1300 | stocker_6 | 93:50 |
| 3 | exit | $2250 | ice_cream_maker_2, pudding_pot_2 | 99:09 |

## Upgrades

| Upgrade | Appears after | Level costs (bought at) | Values |
|---|---|---|---|
| player_speed | office | $15 (2:26) / $30 (9:31) / $55 (14:32) / $100 (18:50) | 6 → 6.5 → 7 → 7.5 |
| stack_cap | office | $20 (6:45) / $40 (11:26) / $75 (16:07) / $125 (21:22) | 10 → 12 → 14 → 16 |
| steady_hands | office | $25 (9:00) / $45 (12:49) / $80 (17:38) | 4 → 5 → 6 |
| mop_speed | office | $100 (19:58) / $175 (29:60) | 1.5 → 1 |
| speed_wheat_field | wheat_field | $15 (5:06) / $25 (9:07) / $45 (13:28) | 0.8 → 0.64 → 0.512 |
| speed_cow_pen | cow_pen | $20 (7:40) / $35 (9:59) / $55 (15:14) | 0.8 → 0.64 → 0.512 |
| speed_butter_churn | butter_churn | $20 (8:14) / $35 (10:32) | 0.8 → 0.64 |
| speed_goat_pen | goat_pen | $65 (28:00) / $115 (29:59) | 0.8 → 0.64 |
| speed_cheese_press | cheese_press | $85 (33:54) / $145 (35:44) | 0.8 → 0.64 |
| speed_goat_cheese_press | goat_cheese_press | $115 (45:21) / $195 (46:41) | 0.8 → 0.64 |
| speed_strawberry_patch | strawberry_patch | $150 (61:05) / $250 (61:32) | 0.8 → 0.64 |
| speed_chicken_coop | chicken_coop | $200 (66:11) / $300 (66:33) | 0.8 → 0.64 |
| speed_ice_cream_maker | ice_cream_maker | $300 (63:55) / $500 (69:27) | 0.8 → 0.64 |
| speed_pudding_pot | pudding_pot | $300 (72:32) / $500 (74:01) | 0.8 → 0.64 |
| cashier_speed | cashier_1 | $40 (12:18) / $75 (16:43) / $125 (22:41) | 1.6 → 1.3 → 1 |
| stocker_speed | stocker_1 | $85 (28:31) / $150 (31:50) / $300 (49:46) / $500 (55:49) | 4.5 → 5 → 5.5 → 6 |
| stocker_carry | stocker_1 | $85 (29:05) / $150 (34:57) / $300 (51:13) / $500 (56:33) | 8 → 10 → 12 → 14 |

## Moves

| Move | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Price | $40 | $60 | $90 | $150 | $200 | $275 | $400 | $525 | $650 |

Moves are not in Completion; 3 open per Area bought.

## Events

All three are on from the first Opening (`requires: []`, #40); none come in the first 3 min. Area 1 amounts match the Juice Bar's, and Areas 2 and 3 match the Corner Shop's.

| Event | Area | Amounts |
|---|---|---|
| Delivery | 1 / 2 / 3 | 3–6 / 5–9 / 7–12 Items; 1.5× Sale Price + tip up to 25 %; defaults (a car every 180–240 s) |
| Health inspector (every 2–4 min) | 1 | spotless $40–80; fine $10 per Mess / Loose Item; bad review +$60 |
| Health inspector | 2 | spotless $100–200; fine $20; bad review +$150 |
| Health inspector | 3 | spotless $300–600; fine $60; bad review +$450 |
| Robbery (every 10–15 min) | 1 | bounty $15; steals half a Cash Pile over $60 |
| Robbery | 2 | bounty $40; Cash Pile over $150 |
| Robbery | 3 | bounty $120; Cash Pile over $400 |
