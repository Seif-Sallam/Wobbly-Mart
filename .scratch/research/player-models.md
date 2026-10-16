# Player models we have or can get

Research for [#82](https://github.com/Seif-Sallam/Wobbly-Mart/issues/82) (map [#75](https://github.com/Seif-Sallam/Wobbly-Mart/issues/75)), 2026-10-16.

**Question:** which free-licensed character models could the Player switch between on a character selection screen, and what does each need (rig, animations, scale) to work with the game's walk/carry animations?

**Answer:** **20 drop-in Player looks are realistic with no new animation work.** All are Kenney CC0 models on the same 7-bone mini rig, with the same clip names the game plays. 9 are already in the repo, 3 more come from the Mini Characters pack we already credit, and 8 come from other Kenney "mini" packs. A further 5 Graveyard Kit characters use the same clips as node animation. Blocky Characters also share the clip names, but they are a different, taller style. Quaternius and KayKit need retargeting, so they are out.

Tags: **[MEASURED]** means I read it from the GLB JSON (skins, joint names, animation names, materials) with a small Node script, or from the pack's `License.txt`, on 2026-10-16. **[CODE]** means it comes from this repo.

## 1. What the game needs from a character model

- **Loading.** `Character` (`src/view/characters.ts`) calls `model(name)` from `src/view/assets.ts`. That function clones the loaded GLB with `SkeletonUtils.clone`, scales it to `height` from `catalog/assets.ts`, and stands it on y = 0 [CODE]. Scale works for any source size, so a new model needs only one asset-table row: `{ path, height }`.
- **Clips.** The game uses only five clips, looked up by name: `idle`, `walk`, `holding-both`, `emote-yes` and `emote-no`. `holding-both` is weighted in while carrying, and `walk`'s time scale follows speed (`src/view/characters.ts`) [CODE]. Any clip it doesn't find is silently skipped, so the model then just doesn't animate that state.
- **Head bone.** `wear(..., onHead)` attaches the Player's orange cap to the node named `head` (`getObjectByName('head')`) [CODE]. A model with no `head` node still renders, but the cap floats and doesn't follow the head bob.
- **Trimming.** `scripts/optimize-models.ts` drops every clip except `idle`, `walk`, `holding-both`, `emote-yes`, `emote-no`, `eat` and `static`. It also embeds the colormap and quantizes the file [CODE]. That is why repo character files are 110–130 KB, against 237–279 KB for the raw pack files [MEASURED]. The script only processes `public/models/chars`, `public/models/pets` and `public/models/market/character-employee.glb`. A new folder has to be added to its `FILES` list.
- **Material-sharing gotcha.** `loadAssets` shares materials under the key `<top folder>|<material name>|tex` (`src/view/assets.ts:44`) [CODE]. Every Kenney mini character has one material called `colormap` [MEASURED]. Mini Characters and Mini Market use the same colormap PNG (same MD5). Mini Dungeon, Mini Arena, Mini Skate and the other packs each ship a **different** `colormap.png` [MEASURED]. So a model from another pack placed in `public/models/chars/` would pick up the Mini Characters texture and render in the wrong colours. **Put each extra pack's characters in their own folder**, for example `models/chars-dungeon/`. No code change is needed for that.

## 2. Already in the repo

All of these are from Kenney Mini Characters 1.0 (CC0, https://kenney.nl/assets/mini-characters) or Mini Market (CC0, https://kenney.nl/assets/mini-market), and both packs are already in `CREDITS.md`. Rig: 2 skins, joints `root, leg-left, leg-right, torso, arm-left, arm-right, head`. Clips after trimming: `static, idle, walk, emote-yes, emote-no, holding-both` [MEASURED].

| Model file (`public/models/…`)   | Used today as (`catalog/assets.ts`)                    | Player-ready? |
| -------------------------------- | ------------------------------------------------------ | ------------- |
| `chars/character-male-a`         | `player` (height 1.25, orange cap)                     | Yes (current) |
| `chars/character-female-a…d`     | `customer-a…d`                                         | Yes           |
| `chars/character-male-b, c, d, f` | `customer-e…h`; `customer-g` is also the Health Inspector (tinted); the Thief picks a random customer model | Yes |
| `market/character-employee`      | `employee`: every Stocker, Cashier and Cleaner         | Yes, technically, but Staff keep their own model (#75 decision), so the Player shouldn't use it |

**Work:** none for the model. Add a selection key per look in the asset table, or point `player` at the chosen path.

**Caveat:** today the Player is told apart from customers by model choice plus an orange cap. If the Player can pick a customer's model, the cap is the only difference. To keep looks unique, either drop the chosen look from `CUSTOMER_MODELS` (`src/view/world-view.ts:32`) or rely on the cap.

## 3. In a pack we already credit, but not committed

The Mini Characters zip (`kenney_mini-characters.zip`, 2.4 MB, 1.0, CC0) has 12 people. The repo committed 9 of them [MEASURED]. The other 3 are on the same rig, with all 32 clips, including every clip the game uses [MEASURED]:

| Model                 | Source                                  | License | Rig / clips            | Work |
| --------------------- | --------------------------------------- | ------- | ---------------------- | ---- |
| `character-female-e`  | https://kenney.nl/assets/mini-characters | CC0     | Same rig, all 5 clips  | Copy GLB + `Textures/colormap.png` into `public/models/chars/`, run `optimize-models.ts`, add an asset row with `height: 1.25`. Same colormap, so `chars/` is fine |
| `character-female-f`  | same                                    | CC0     | same                   | same |
| `character-male-e`    | same                                    | CC0     | same                   | same |

The pack also has wearable props (`aid-glasses`, `aid-sunglasses`, `aid-mask`, `aid_hearing`, canes) [MEASURED]. They could become cheap accessory variants through `Character.wear`, but they need hand placement per prop.

## 4. Other Kenney "mini" packs (same rig, new download)

Each of these packs ships 1–2 characters with **the same 7 joint names, 2 skins and the same clip names**, including `idle`, `walk`, `holding-both`, `emote-yes` and `emote-no`. All are CC0 per each zip's `License.txt` [MEASURED]. They match the current style. Each pack has its **own** `colormap.png`, so each needs its own folder (see the gotcha in section 1).

| Model                      | Pack (version)        | Source                                  | Look | Extra clips |
| -------------------------- | --------------------- | --------------------------------------- | ---- | ----------- |
| `character-gamer`          | Mini Arcade 1.2       | https://kenney.nl/assets/mini-arcade    | One of the pack's two kids (blue cap or hair buns in the preview) | — |
| `character-employee`       | Mini Arcade 1.2       | same                                    | The other kid | — |
| `character-skate-boy`      | Mini Skate 2.0        | https://kenney.nl/assets/mini-skate     | Red cap, skater | `skate*` (unused) |
| `character-skate-girl`     | Mini Skate 2.0        | same                                    | Skater girl | `skate*` (unused) |
| `character-human`          | Mini Dungeon 2.0      | https://kenney.nl/assets/mini-dungeon   | Adventurer, ginger hair. Sword and shield are separate models | — |
| `character-orc`            | Mini Dungeon 2.0      | same                                    | Green orc | — |
| `character-soldier`        | Mini Arena 1.1        | https://kenney.nl/assets/mini-arena     | Helmeted soldier with a red plume | No wheelchair clips (not needed) |
| `character-archer`         | Mini Forest 1.0       | https://kenney.nl/assets/mini-forest    | Archer | — |

The skater, orc, soldier and Arcade employee GLBs contain only `body-mesh` and `head-mesh` [MEASURED], so no weapon or board is baked in.

**Work per pack:** copy the GLB and its `Textures/colormap.png` into a new `public/models/chars-<pack>/` folder. Add that folder to `FILES` in `scripts/optimize-models.ts` and run it. Add an asset row with `height: 1.25`. Add one row to `catalog/credits.ts` and rerun `npm run credits`. About 110–130 KB per character after trimming (estimated from the repo's current ratio). No code or animation work.

The Mini Arcade `character-employee` shares its file name with the Mini Market one the Staff use. Its own folder keeps them apart. Check visually that it doesn't look like Staff before offering it.

## 5. Same clip names, node-animated (works, but check the look)

| Model                                                   | Pack                    | Source                                   | License | Rig | Notes |
| ------------------------------------------------------- | ----------------------- | ---------------------------------------- | ------- | --- | ----- |
| `character-keeper`, `-vampire`, `-zombie`, `-skeleton`, `-ghost` | Graveyard Kit 5.0 | https://kenney.nl/assets/graveyard-kit | CC0 [MEASURED] | **0 skins**. Each part is a node named `root, torso, head, arm-*, leg-*`, animated directly with the same 32 clip names [MEASURED] | Same mini proportions in the preview. Clips target node names, so `AnimationMixer` plays them, and `head` exists, so the cap attaches. `optimize-models.ts` handles them like the pets (which are also node-animated). The ghost has no legs, so `walk` is mostly a float. Theme (spooky) fits a seasonal or joke unlock more than a default pick |
| `character-a…r` (18)                                    | Blocky Characters 2.0   | https://kenney.nl/assets/blocky-characters | CC0 [MEASURED] | 0 skins, same node names, 27 clips including all 5 the game uses [MEASURED] | **Different style**: tall, Minecraft-like boxes, next to the chunky minis. Each model has its own `texture-<letter>` material and PNG, so the folder key is safe. Technically drop-in, but it would look out of place next to mini customers. Not recommended |

## 6. Non-Kenney packs (not drop-in)

From the earlier asset survey (`.scratch/my-mini-mart-web/research/02-tech-stack-and-assets.md`, rows for these packs):

- **Quaternius Universal Base Characters + Universal Animation Library** (CC0, https://quaternius.com/packs/universalbasecharacters.html): humanoid rig with realistic proportions. It doesn't match the Kenney style, and the rig differs, so the five clips would have to be retargeted or replaced. Out.
- **KayKit Adventurers + Character Animations** (CC0, https://kaylousberg.itch.io/kaykit-adventurers): uses `Rig_Medium` with different bone names and clip names, in a chunky fantasy style. It would need clip-name mapping at least, and in practice retargeting. Out.

I found no CC-BY pack that matches the mini rig. Nothing outside Kenney uses its 7-joint `root/torso/head/arm-*/leg-*` naming.

## 7. How many looks without new animation work

| Tier | Looks | Effort |
| ---- | ----- | ------ |
| Already committed (excluding the Staff employee) | **9** (male-a, female-a…d, male-b, c, d, f) | Asset rows only |
| + rest of Mini Characters                         | **+3** → 12 | Copy + optimize, same folder |
| + Mini Arcade, Skate, Dungeon, Arena, Forest characters | **+8** → 20 | One folder + one credit row per pack |
| + Graveyard Kit (node-animated, spooky)           | **+5** → 25 | Same as above; check the ghost's walk visually |

**Realistic shop-friendly roster:** the 12 Mini Characters people plus the gamer, both skaters and the Arcade employee, which is **16 looks**. Add the orc, soldier, adventurer and archer as fun unlocks. None of them need animation work. The decisions left for the spec:

1. Can the Player's look overlap a customer's model? If not, remove the chosen look from `CUSTOMER_MODELS`.
2. Does the Player keep the orange cap over every look? Some looks already wear a hat: the skater boy's red cap, the soldier's helmet, and one Mini Arcade kid's blue cap.
3. Is the download-size budget fine? Each look adds about 120 KB, and today all assets are loaded up front (`loadAssets`). With 16 looks that is about +0.8–1 MB, unless only the chosen look is loaded.

## Sources

- Kenney pack pages, as listed per row above. The zip URLs are linked from each page, for example https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip, downloaded 2026-10-16.
- The `License.txt` in each zip: Mini Characters 1.0, Mini Dungeon 2.0, Mini Skate 2.0, Mini Arena 1.1, Mini Arcade 1.2, Mini Forest 1.0, Graveyard Kit 5.0, Blocky Characters 2.0, all "Creative Commons Zero, CC0".
- Repo: `src/view/characters.ts`, `src/view/assets.ts`, `catalog/assets.ts`, `scripts/optimize-models.ts`, `src/view/world-view.ts`, `CREDITS.md`.
