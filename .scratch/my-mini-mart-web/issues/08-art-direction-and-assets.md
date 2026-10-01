# Pick the asset packs and art direction

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-02)
Blocked by: 02, 03

## Question

Which specific free packs do we use for each needed entity, how do we fill gaps, and what overall visual style/palette results? Confirm licenses permit public hosting.

## Answer

Resolved 2026-10-02 (grilling). Builds on `research/02-tech-stack-and-assets.md` §C; exact filenames for the gaps are in `research/08-kenney-gap-check.md`.

**Style**
- **Anchor:** Kenney "mini" toy style (Mini Market, Mini Characters, Cube Pets). Everything else conforms to it.
- **Gap fill order:** compose from other Kenney parts → simple primitives in our palette. Never a clashing style (e.g. Quaternius crops), whatever its license.
- **Rendering:** one hemisphere light + one directional light with soft shadows, identical for every model; Kenney textures as-is. No toon shading, no outlines.
- **Palette:** bright, saturated, warm sun, sky-blue background. 8–10 named colours (grass, path, wood, Pad, Money green, …) to be fixed in the spec; Nature Kit pieces recoloured to it.
- **Wonk in the art:** Items oversized 1.5–2× relative to people (also reads better on phones). Character models are not modified.

**Licenses**
- Allowed: CC0, CC-BY, OFL (fonts). Rejected: CC-BY-SA, CC-BY-NC, custom "personal use" licenses. All Kenney packs used are CC0 and fine to host publicly.
- Credits in `CREDITS.md` and an in-game Credits screen (in settings), both generated from one list.

**Entities**

| Entity | Source |
|---|---|
| Player | One fixed Mini Character with a signature colour + hat; no customisation in v1 |
| Customers | Random Mini Characters variants with random tints |
| Cashier / Stocker | Mini Market `character-employee` + coloured cap per role |
| Tomato, Egg, Ketchup, Milk, Bread | Food Kit `tomato`, `egg`, `bottle-ketchup`, `carton`, `loaf` |
| Wheat (Item) | Procedural sheaf (gold cylinder bundle + tie) |
| Flour (Item) | Food Kit `bag`, tinted off-white, wheat-ear sticker |
| Tomato bed | Nature `crops_dirtRow` + primitive bush; Food Kit tomatoes grow in |
| Wheat field | Nature `crops_dirtRow` + `crops_wheatStageA/B`, recoloured |
| Chicken Coop | Cube Pets `animal-chick` ×N in a coop composed from Fantasy Town planks/roof/fence |
| Cow pen | Cube Pets `animal-cow` in Nature/Fantasy fences + feed trough |
| Blender | Furniture `kitchenBlender`, scaled up, on a counter; shakes while working |
| Mill | Hut from Fantasy Town walls/roof + `windmill` sails that spin while working |
| Oven | Furniture `kitchenStove`, scaled up; glows/puffs while working |
| Trays | Survival `box-open` crate with Items inside |
| Shelves | Mini Market `display-fruit` (Tomato, Egg), `shelf-boxes` (Ketchup, Flour), `freezers-standing` (Milk), `display-bread` (Bread), `shelf-bags` (Wheat) |
| Register | Mini Market `cash-register` on Furniture `kitchenBar` |
| Office | Furniture `desk` + `chairDesk` + `computerScreen` |
| Trash Bin | Furniture `trashcan` |
| Exit Pad car | Car Kit `delivery` van |
| Locked Area boundary | Mini Market `fence` with a rope look; bare dirt ground |
| Floor / surroundings | Mini Market `floor`; grass field with Nature trees/bushes (recoloured); road on the Entrance side where the Exit van parks |

The procedural tomato bush and wheat sheaf are the likeliest to be revisited after a play-test.

**Money:** procedural green bill stacks everywhere (Cash Pile, Money flying into Pads). Platformer `coin-gold` used only as a flip-and-spin effect when a Customer pays and when a Cash Pile is collected — never an amount.

**Pads:** flat rounded square showing the unlock's icon (Kenney 2D packs; rendered thumbnail fallback) and its price. While the Player stands on it: a ghost preview of the station appears, the price label **counts down** to 0, and a radial fill grows. Walking off keeps what was paid; the label shows the remainder.

**Mess:** a coloured floor splat plus 2–3 of the actual dropped Products lying tipped over.

**Asset table:** one shared table — model name → path, scale, tint, offset. Catalog and Maps reference models by name only; CI checks every reference exists in the table.
