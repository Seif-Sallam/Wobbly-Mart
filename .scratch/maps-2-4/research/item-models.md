# Item and Shelf-stand models for the Maps 2–4 Products

Answers [#39](https://github.com/Seif-Sallam/Wobbly-Mart/issues/39). Researched 2026-10-10.

## Sources

- **Repo:** `public/models/*` (what is vendored), `catalog/assets.ts` (the asset table), `catalog/products.ts`, `catalog/credits.ts`, `src/view/stands.ts`, `src/view/assets.ts` (`model()` and `tint()`), `src/view/instanced.ts` (`wheatSheaf`, the one code-built Item today).
- **Kenney Food Kit zip**, downloaded from https://kenney.nl/assets/food-kit (`kenney_food-kit.zip`, CC0, already credited in `catalog/credits.ts`). I listed `Models/GLB format/`, read each GLB's JSON for its bounding box and node names, and sampled `Textures/colormap.png` at each mesh's UVs to get its main colours. **[MEASURED]**
- The vendored `food/*.glb` files and `food/Textures/colormap.png` are byte-identical to the zip's copies, so these numbers hold for files we already ship.
- Other packs' file lists come from the earlier measured notes: `.scratch/my-mini-mart-web/research/02-tech-stack-and-assets.md` §C and `08-kenney-gap-check.md`.

## What is vendored today

`public/models` holds only the files the Corner Shop uses:

| Dir | GLBs |
|---|---|
| `food/` | `bag`, `bottle-ketchup`, `carton`, `egg`, `loaf`, `tomato` |
| `market/` | `cash-register`, `character-employee`, `fence`, `shopping-basket`, `wall`, `wall-window` |
| `furn/` | `bookcaseOpen`, `chairDesk`, `computerScreen`, `desk`, `kitchenBar`, `kitchenBlender`, `kitchenFridgeSmall`, `loungeSofa`, `pottedPlant`, `rugRectangle`, `table` |
| `nature/` | `crops_wheatStageA`, `crops_wheatStageB`, `fence_simple`, `flower_redA`, `flower_yellowA`, `grass`, `plant_bush`, `plant_bushLarge`, `tree_default`, `tree_oak` |
| `pets/` | `animal-chick`, `animal-cow` |
| `town/` | `banner-green`, `banner-red`, `fence`, `planks`, `roof-high`, `wall-wood` |
| `car/` `delivery` · `platformer/` `coin-gold`, `flag` · `chars/` 9 characters · `survival/` only `Textures/` | |

**None of the new Products has a vendored model.** Every Kenney fit below is a new file copied from the Food Kit zip into `public/models/food/` (same pack, same `colormap.png`, no new credit). Each Item gets an `ASSETS` row; a code-built one gets `{}` and a branch next to `wheatSheaf` in `src/view/instanced.ts`.

## How the Food Kit models look

The Food Kit has 200 GLBs: the FBX list plus `rollingPin` and `wholer-ham`. All are single-material and use the shared colormap atlas. Raw size is in Kenney units; `model()` rescales to `ITEM_SIZE × ratio` tall.

| GLB | w × h × d | Main colours (share of verts) | Reads as |
|---|---|---|---|
| `apple` | 0.20 × 0.19 × 0.20 | red `#f46743` | red apple |
| `orange` | 0.17 × 0.17 × 0.17 | orange `#ff7a44`–`#ff8e44`, green leaf | orange with a leaf |
| `strawberry` | 0.12 × 0.18 × 0.12 | red `#d7574c`, green top, seed tan | strawberry |
| `carton` (= Milk now) | 0.23 × 0.59 × 0.23 | purple `#633fbc`/`#9f71e3` + white | tall purple carton |
| `carton-small` | 0.23 × 0.39 × 0.23 | pink `#f8a3e2`/`#db82d8` + white | short pink carton |
| `soda-bottle` | 0.18 × 0.58 × 0.16 | brown `#a25c41` | cola bottle |
| `bottle-oil` | 0.14 × 0.62 × 0.14 | green `#2e9872`–`#53bd84` | green oil bottle |
| `glass` | 0.16 × 0.29 × 0.18 | near-white `#fafafc` | empty glass |
| `frappe` | 0.25 × 0.50 × 0.25 | white `#ebebf2`–`#fafafc` | domed takeaway cup |
| `bag` (= Flour, tinted) | 0.31 × 0.85 × 0.58 | kraft tan `#efba94` | paper sack |
| `can`, `can-small` | 0.30 × 0.32 / 0.14 × 0.30 | grey-blue `#7f849c`/`#bfc8f0` | tin can |
| `honey`, `peanut-butter` | ~0.3 × 0.3 × 0.3 | brown `#ab5e41` + tan | jars |
| `cheese` | 0.68 × 0.22 × 0.68 | yellow `#ffc759`/`#ffd363` | 12-wedge wheel (12 nodes named `wedge`) |
| `cheese-cut` | 0.38 × 0.02 × 0.26 | tan board + yellow slice | flat slice on a board |
| `ice-cream` | 0.33 × 0.30 × 0.38 | pink `#e48ddb`–`#f19be0` | pink scoop tub (2 nodes) |
| `ice-cream-cup` / `ice-cream-cne` | ~0.2 × 0.2–0.3 | tan cup/cone | scoop in cup / cone (note Kenney's `cne` typo) |
| `sundae` | 0.22 × 0.62 × 0.26 | red, white | tall sundae glass |
| `popsicle` | 0.08 × 0.49 × 0.18 | orange/yellow | ice lolly |
| `pudding` | 0.25 × 0.20 × 0.29 | caramel brown `#ab5e41`/`#845442` | flan |
| `pizza` | 0.84 × 0.04 × 0.84 | orange-red `#f96a42`, dark toppings `#413331` | flat pizza, 8 nodes `slice1`–`slice8` |
| `pizza-box` | 0.94 × 0.09 × 0.95 | white | box with a `lid` node |
| `bottle-ketchup` (= Ketchup) | 0.69 × 1.89 × 0.80 | red `#ee6445` | squeeze bottle |
| `lollypop` | 0.04 × 0.38 × 0.19 | pink | lollipop |
| `popsicle-stick` | 0.02 × 0.34 × 0.04 | wood tan | bare stick |
| `paprika-slice`, `mushroom-half`, `onion-half`, `tomato-slice` | small | red / brown / … | toppings |
| `bowl` | 0.54 × 0.23 × 0.62 | white | bowl |
| `rollingPin` | 0.81 × 0.14 × 0.16 | wood tan | rolling pin |

**No Food Kit model for:** juice (any carton or bottle), sugar, candy apple, butter, goat milk, goat cheese, pizza sauce or any jar of sauce, dough, olives. Filename search for `olive|jar|juice|butter|sugar|dough|sauce|milk|goat` finds only `peanut-butter` and `cup-saucer`.

**Tinting only darkens.** `tint()` in `src/view/assets.ts` multiplies the material colour, and the atlas tints every face at once. So tinting works on near-white models (`glass`, `frappe`, `bowl`, `pizza-box`, the tan `bag` used for Flour). It cannot turn yellow `cheese` white, and a red tint on the grey `can` gives a muddy maroon.

**Flat models need a small height ratio.** `pizza` (h/w ≈ 0.05) and `cheese` (≈ 0.32) are sized by height in `ASSETS`. At `ITEM` height they would be several metres wide. Give them ratios of about `ITEM × 0.08` (pizza: ~0.55 m across) and `ITEM × 0.4` (cheese: ~0.67 m across). The `ITEM` table in `stands.ts` needs a wide `gap` for them too.

## Stands

`src/view/stands.ts` builds a stand per Product in `stand()`. There are six shapes:

1. **Slanted produce bin:** `tomato`.
2. **Low cream-topped table:** `egg`.
3. **Three-step riser:** `ketchup`, `flour`.
4. **Open-front cooler, two shelves:** `milk`.
5. **Three baskets:** `wheat`.
6. **Table with bread board:** `bread`.

Each is coloured by `SHADES.splat[product]` and gets a sign in that colour. To reuse a shape, add the new id to that `case` and give it an `ITEM` row (h, gap), a `SHADES.splat` colour and a `PRODUCTS.shelf` name. `HEAPS` adds a second layer for loose produce.

## Answer per Product

| Product | Map | Item model | Stand |
|---|---|---|---|
| apple | 2 | `apple` (Food Kit) | produce bin (tomato's), add to `HEAPS` |
| orange | 2 | `orange` (Food Kit) | produce bin, `HEAPS` |
| strawberry | 2, 3 | `strawberry` (Food Kit; small, so ratio ~0.8) | produce bin, or a new code-built punnet tray |
| apple juice | 2 | **code-built** bottle: pale-gold body, white cap, a mini `apple` on the cap/label | three-step riser, or the cooler |
| orange juice | 2 | **code-built** same bottle, bright orange body, a mini `orange` on top | riser / cooler, a separate stand from apple juice |
| sugar | 2 | **code-built**: white sugar-cube box or a stack of cubes in a blue box | riser |
| candy apple | 2 | **code-built** from `apple` (deep-red tint) + `popsicle-stick` on top, maybe a caramel drip ring | **new code-built** stick rack (board with holes, apples upright); egg's table works as a fallback |
| butter | 3 | **code-built**: pale-yellow brick, half-unwrapped from a blue/silver foil wrapper | cooler |
| goat milk | 3 | `carton-small` (pink/white, short) | cooler (milk's, same Map) |
| cheese | 3 | `cheese` (yellow 12-wedge wheel; drop 1–2 `wedge` nodes for a cut look) | cooler, or a wooden board table (bread's) |
| goat cheese | 3 | **code-built**: white log or round with a grey ash rind (cylinder plus a darker end cap) | cooler |
| ice cream | 3 | `ice-cream` (pink tub) | **new code-built** chest freezer: white body with a frosted glass-blue lid (`SHADES.glass`). Mini Market `freezer` exists but isn't vendored, and the owner prefers bespoke fixtures. |
| pudding | 3 | `pudding` (caramel flan) | cooler |
| pizza sauce | 4 | **code-built** jar: red body, white lid, mini `tomato` on the lid. Not `bottle-ketchup`, which is another Product's Item. | riser |
| dough | 4 | **code-built**: cream dough ball (squashed sphere) dusted white; `rollingPin` as stand dressing | bread's table + board |
| olives | 4 | **code-built**: small glass jar of dark-green spheres, green lid; or a white `bowl` heaped with olives | riser |
| pizza | 4 | `pizza` (Food Kit), ratio ~0.08; stacks as flat discs | bread's table, or a new code-built pizza rack |
| veggie pizza | 4 | **code-built** from `pizza`: add big green pepper rings plus `mushroom-half` / `onion-half` pieces on top, or swap in a green-tinted `pizza-box` lid | same stand shape as pizza, separate Shelf |

So **8 Products have a Kenney fit** (apple, orange, strawberry, goat milk, cheese, ice cream, pudding, pizza) and **10 must be code-built**, 4 of them partly from Kenney parts (candy apple, veggie pizza, and the two juices' fruit toppers). **New stands:** a chest freezer (ice cream) and a candy-apple stick rack. Optional ones: a strawberry punnet and a pizza rack. Everything else reuses an existing shape.

Smoothie is also on Map 2 (map #36) but isn't in this ticket. `frappe` tinted pink, or a fruit colour, fits it without code. That makes four drinks on Map 2: Milk `carton`, two code-built juice bottles, and a domed `frappe` cup. They are four different silhouettes.

## Gaps and look-alike risks

- **Two juices (Map 2):** same bottle shape by design. Tell them apart by colour, pale gold against bright orange, and by a fruit topper (mini `apple`, mini `orange`). Gold and orange are close at 0.5 m, so keep the apple-juice body clearly yellow-green, not amber. Put them on separate stands with distinct sign colours.
- **Apple vs candy apple (Map 2):** same base model. The stick on top and the deeper, glossier red must carry it, and so should the different stand (rack vs bin). Keep the stick long, about 40% of Item height, so it shows from the camera.
- **Apple vs orange vs strawberry:** different colours and sizes. Strawberry is the smallest, so a ratio of about 0.8 keeps it readable.
- **Two cheeses (Map 3):** a yellow wedge wheel vs a white log. Shape and colour both differ, so the risk is low. Butter is the real look-alike for cheese, since both are yellow. Keep butter a rectangular brick in a foil wrapper and pale cream-yellow.
- **Milk vs goat milk (Map 3):** tall purple carton vs short pink carton. Different, but pink can read as strawberry milk, and strawberry is on Map 3 too. If playtest finds that confusing, use a code-built glass bottle with a goat sticker instead.
- **Two pizzas (Map 4):** the highest risk. They share a flat disc that the camera sees face-on. Veggie pizza needs large, high-contrast green toppings: pepper rings at least ~1/6 of the diameter, enough to read at 0.5 m. Toppings sized like Kenney's own vanish. A dark sign colour alone isn't enough. Adding a green box lid, or a whole-pizza vs one-slice-missing difference (pizza has 8 `slice` nodes), adds a second cue.
- **Pizza sauce vs Ketchup:** both are tomato-red condiments, but Ketchup isn't on Map 4. Still, don't reuse `bottle-ketchup`. A jar keeps every Product's Item unique across Maps.
- **Flour vs sugar:** Flour already uses a tinted `bag`. Sugar shouldn't be a second bag, even though Flour isn't on Map 2.
- **Dough vs Bread (`loaf`):** Bread isn't on Map 4. Dough reads as a pale ball, not a browned loaf, so the risk is low.
- **Flat or tiny Items on a Stack:** pizza discs make a short, stable-looking Stack, which may matter for Tipping visuals. Strawberry and the olives jar are small, so check them in the Stack at 0.5 m.

## Not checked

- I didn't render any of these in the game camera. The colours come from atlas samples. Eyeball the look-alike calls (juices, pizzas, butter/cheese) in a prototype with the real camera before committing.
- I didn't re-download the Mini Market, Furniture and Survival packs (Kenney's CDN was slow). Their file lists are from the 2026-10-02 measured notes. Nothing above depends on them except the mention that a `freezer` exists.
