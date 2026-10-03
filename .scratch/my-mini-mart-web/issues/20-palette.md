# Fix the named palette

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

What are the 8–10 named palette colours (grass, path, wood, Pad, Money green, sky, …) with exact values? Build a rough swatch page that shows them on real Kenney models under the chosen lighting, and react to it.

## Context

Style, lighting and the promise of a named palette: [Pick the asset packs and art direction](08-art-direction-and-assets.md). UI uses palette colours: [Design the HUD and UI](12-hud-and-ui.md). Floating numbers use Money green: [Pick the audio and juice](17-audio-and-juice.md). Tone: wonky and funny.

## Answer

Resolved 2026-10-03 (prototype). Owner's verdict: **C, "Golden Storybook" — "C all the way"**. A (Sunny Toy) and B (Candy Pop) were rejected.

Prototype (primary source): branch `prototype/palette`, folder `prototypes/palette/`. Run `npm install && npm run dev` there, then open `?variant=C`. It shows a corner of the first map built from real Kenney models, plus sample HUD, Office panel, bubbles, `+$` number and logo, with every colour live-tunable.

**Named palette: 12 colours.** There are more than the 8–10 first guessed, and the owner kept all 12.

| Name | Hex | Used for |
|---|---|---|
| sky | `#7ec8e3` | background around the map; hemisphere light sky colour; favicon/home-icon square |
| grass | `#a3c94a` | ground; hemisphere light ground colour |
| leaf | `#5e9e3a` | Nature Kit `grass`/`leafsGreen` materials (trees, bushes, crop leaves) |
| path | `#e8c48a` | walkways, pavement; disabled UI buttons |
| dirt | `#9c5b3a` | crop beds, locked-Area bare ground |
| road | `#5d5a63` | the street where the Exit van parks |
| wood | `#c17a43` | Nature/Furniture `wood`/`woodBark` (fences, trunks, desks, counters) |
| ink | `#3a2416` | dark-wood outline: logo outline, all UI text and outlines |
| cream | `#fff1d0` | UI panels, bubbles, pills; the band on Money bills |
| pad | `#ffe066` | Pad face |
| money | `#2f9e4f` | Money bills, `+$` numbers, buy buttons, "Wobbly" in the logo |
| orange | `#f26b1d` | accent: guidance arrows, Completion bar fill, "Mart" in the logo |

**Darker shades are derived, not named:** `dirtDark` = dirt × 0.75 and `woodDark` = wood × 0.75 (Kenney's `dirtDark`/`woodDark` materials).

**Lighting** (fixes the values left open in [Pick the asset packs and art direction](08-art-direction-and-assets.md)):
- Warm sun `#ffcf8a` at intensity 3.0, from above, front-right.
- Hemisphere light at intensity 0.9, using sky and grass as its sky and ground colours.
- Shadow radius 3 with PCF shadows.
- ACES filmic tone mapping at exposure 1.

**Recolouring rule:**
- Kenney materials without textures (Nature, Furniture) are swapped by material name for shared palette materials. Textured Mini packs keep their colormap as-is.
- The material-name → palette-colour map sits next to the asset table.

**For the build:**
- The palette is one `palette.ts`: the 3D materials and the UI's CSS variables both read from it, so no colour is written in twice.
- The map is finite: sky colour shows past the edge of the ground.
- The Mini Market floor keeps its grey/white checker texture. The owner didn't object; revisit only if it looks too clinical in play.
