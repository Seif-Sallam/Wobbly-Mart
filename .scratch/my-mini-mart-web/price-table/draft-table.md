# Map 1 price table — draft (COST_SCALE 0.55)

Starting Money: $50

## Pads (unlock order)

| Pad | Cost | Requires |
|---|---|---|
| register | $10 | — |
| tomato_shelf | $15 | register |
| tomato_bed | $25 | tomato_shelf |
| egg_shelf | $22 | tomato_bed |
| chicken_coop | $33 | egg_shelf |
| office | $41 | chicken_coop |
| ketchup_shelf | $50 | office |
| blender | $66 | ketchup_shelf |
| cashier_1 | $82 | blender |
| chicken_2 | $72 | blender |
| tomato_plots | $61 | blender |
| area_2 | $220 | cashier_1 |
| wheat_shelf | $82 | area_2 |
| wheat_field | $110 | wheat_shelf |
| milk_fridge | $138 | wheat_field |
| cow_pen | $165 | milk_fridge |
| flour_shelf | $165 | cow_pen |
| mill | $220 | flour_shelf |
| stocker_1 | $165 | mill |
| wheat_plots | $193 | mill |
| cow_2 | $248 | mill |
| area_3 | $550 | stocker_1 |
| bread_shelf | $220 | area_3 |
| oven | $330 | bread_shelf |
| register_2 | $275 | oven |
| cashier_2 | $330 | register_2 |
| stocker_2 | $385 | oven |
| exit | $1100 | oven |

## Upgrades

| Upgrade | Appears after | Level costs | Values (base → max) |
|---|---|---|---|
| player_speed | office | $33 / $53 / $84 / $135 | 5.5 → 6.0 → 6.5 → 7.0 → 7.5 |
| stack_cap | office | $44 / $70 / $113 / $180 | 10 → 14 → 18 → 22 → 26 |
| cashier_speed | cashier_1 | $82 / $132 / $211 | 2.0 → 1.6 → 1.3 → 1.0 |
| stocker_speed | stocker_1 | $82 / $132 / $211 / $338 | 4.0 → 4.5 → 5.0 → 5.5 → 6.0 |
| stocker_carry | stocker_1 | $82 / $132 / $211 / $338 | 6 → 8 → 10 → 12 → 14 |
| shelf_cap | office | $55 / $88 / $141 | 8 → 12 → 16 → 20 |
| speed_tomato_bed | tomato_bed | $28 / $44 / $70 | work time ×0.8 per level (3 levels) |
| speed_chicken_coop | chicken_coop | $33 / $53 | work time ×0.8 per level (2 levels) |
| speed_blender | blender | $38 / $62 | work time ×0.8 per level (2 levels) |
| speed_wheat_field | wheat_field | $82 / $132 / $211 | work time ×0.8 per level (3 levels) |
| speed_cow_pen | cow_pen | $99 / $158 | work time ×0.8 per level (2 levels) |
| speed_mill | mill | $110 | work time ×0.8 per level (1 levels) |
| speed_oven | oven | $165 / $264 | work time ×0.8 per level (2 levels) |

## Producers

| Producer | Recipe | Base timing |
|---|---|---|
| tomato_bed | — → tomato | 4 plants, regrow 6.0 s each |
| chicken_coop | tomato → egg | 4.0 s per output |
| blender | tomato → ketchup | 3.0 s per output |
| wheat_field | — → wheat | 4 plants, regrow 7.0 s each |
| cow_pen | wheat → milk | 5.0 s per output |
| mill | wheat → flour | 4.0 s per output |
| oven | flour + egg → bread | 6.0 s per output |
