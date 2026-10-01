# Kenney gap check for the first map's entities

Checked 2026-10-02 by downloading the official zips (Food Kit, Furniture Kit, Fantasy Town Kit 2.0, Car Kit, Mini Market, Nature Kit) and listing their GLBs. Every `License.txt` says CC0; every pack ships GLB. Builds on `02-tech-stack-and-assets.md` §C.

| Need | Pack → filename(s) | Status | Style note |
|---|---|---|---|
| Flour | Food: no flour/sack; nearest `bag`, `bag-flat` | MEASURED | tint off-white + sticker |
| Milk | Food: `carton`, `carton-small` | MEASURED | good |
| Egg | Food: `egg`, `egg-half`, `egg-cooked`, `egg-cup` | MEASURED | good |
| Tomato | Food: `tomato`, `tomato-slice` | MEASURED | good |
| Ketchup | Food: `bottle-ketchup` | MEASURED | good |
| Bread | Food: `bread`, `loaf`, `loaf-baguette`, `loaf-round`, `croissant` | MEASURED | good |
| Wheat item | none; Nature `crops_wheatStageA/B` are plants only | MEASURED | gap → procedural sheaf |
| Oven | Furniture: `kitchenStove`, `kitchenStoveElectric`, `kitchenMicrowave`, `hoodLarge`, `hoodModern` | MEASURED | good |
| Office | Furniture: `desk`, `deskCorner`, `chairDesk`, `computerScreen`, `computerKeyboard`, `computerMouse`, `laptop` | MEASURED | good |
| Trash Bin | Furniture: `trashcan` | MEASURED | good |
| Mill | Fantasy Town: `windmill` (sail cross only, ~2×3.1×3.1), `blade`, `watermill`, `watermill-wide`; no mill building | MEASURED | compose hut from `wall-wood*` + `roof-high*` |
| Exit car | Car Kit: `sedan`, `hatchback-sports`, `taxi`, `van`, `delivery`, `delivery-flat`, `suv`, `truck`, `tractor` (+ `cone`, `box`) | MEASURED | chunky toy look, fits Mini Market |
| Mess | Food: `plate-broken`, `soda-can-crushed`, `egg-half`, `tomato-slice`, `bag-flat`…; Car `debris-*`; no splat/puddle anywhere | MEASURED | splat is procedural |
| Money | none (kenney.nl search "money"/"cash" finds nothing) | MEASURED | procedural bills; Platformer coins exist |
| Coop / pen | no Kenney 3D farm pack (`tiny-farm`, `isometric-miniature-farm` are 2D) | MEASURED | compose from Fantasy Town `planks`, `wall-wood*`, `roof*`, `fence*`, `fence-gate`, `stall*` + Nature `fence_*` |
| Employee | Mini Market `character-employee`: white top, green trim, green headband | MEASURED (preview image) | reads as a uniform |

Notes: Furniture and Nature ship a "GLTF format" folder whose files are `.glb`. Furniture uses camelCase filenames; the other packs use kebab-case.
