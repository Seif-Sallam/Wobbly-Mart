# Map: Wobbly Mart — playtest pass 1

Label: wayfinder:map

## Destination

A build-ready **playtest-pass spec** (`spec.md` here, a delta on [the v1 spec](../my-mini-mart-web/spec.md)) that settles every point of the owner's first full playtest (2026-10-03, 25 notes) — each one either decided as-is or resolved by a ticket below — so a builder can ship it without asking anything.

## Notes

- Source: the owner's playtest notes, kept in their notes app as *"Wobbly Mart playtest feedback (2026-10-03)"*. Each ticket's Context names the note numbers (#1–#25) it covers.
- **Plan, don't do:** tickets settle decisions. Building happens after the spec, not inside the map. AFK tasks may run the game or the headless bot to gather facts.
- Same standing rules as the v1 map: owner play-tests and decides, Claude writes code; wonky-and-funny tone; minimal, non-duplicated code; Kenney CC0 first; glossary in `/CONTEXT.md`.
- Every session: `/grilling` + `/domain-modeling` for grilling tickets; `/prototype` for prototype tickets. Prototypes follow the owner's preferred style: presets + live tuning panel + value dump.
- Feel numbers go in `src/feel.ts`, gameplay numbers in `src/sim/tuning.ts` / catalog / map data, colours in `src/palette.ts`.
- Changes to layout, Producer yields, staffing or demand all shift the price table. Re-running the estimator is in the fog until those settle.

## Decisions so far

- [Owner's playtest notes](map.md#notes) — decided as-is, no ticket needed:
  - #1 Mill sails spin on the wrong axis. It's a bug, fix it.
  - #9 The Trash Bin only takes Items after the Player stands on it for **1.5 s**. Walking past never trashes anything.
  - #11 A wheat field yields **6** wheat per harvest (was 4).
  - #16 Ovens and Blenders move **inside the store**. Where exactly is decided in [Re-lay out the Corner Shop](issues/08-relayout-corner-shop.md).
  - #20 The Player walks through Customers and Staff. No collision with them.
- [Find the flickering circle above the Player](issues/01-flickering-circle.md) — the Player's orange cap was fixed to the body while the animated head moved through it (Staff caps too). Fix: attach the caps to the `head` bone, sitting above the hair, and keep all caps.

## Not yet specified

- **Re-tune the economy** — after layout, yields, Shelf count, demand and staffing change, the price table and 30-minute pacing probably need re-running with the estimator. It's unclear which numbers move until those tickets close.
- **Bot and tests vs. new rules** — the CI bot playthrough and sim tests assume the current Stack, Trash, list and patience rules. Whether they need new scenarios (Sprint drops, never-give-up Customers) depends on the final mechanics.
- **Save migration** — if Shelf-size Upgrades go away or Stocker roles join the save, old saves need a migration step. Its shape depends on [Decide extra Shelves vs. Shelf size](issues/07-shelves-vs-shelf-size.md) and [Decide Stocker roles and count](issues/04-stocker-roles-and-count.md).

## Out of scope

- Building the changes. That comes after the spec.
- New Products, Maps or Producers beyond what the notes ask for.
