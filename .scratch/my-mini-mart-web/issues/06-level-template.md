# Define the map template for future levels

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-02)
Blocked by: 03, 04

## Question

What does a map definition consist of — layout, stations, unlock sequence, prices, customer config, assets — and is it data (e.g. JSON) the engine reads, so a new map is authored without new code? What stays shared engine code vs per-map data?

## Context

Build on [Decide which mechanics the clone includes](03-core-mechanics-scope.md): the map data must express Producers with Recipes, Unlock Requirements, Areas, Shelves, Registers, the Office's Upgrades, and customer Shopping List config.

## Answer

Resolved 2026-10-02 (grilling). Glossary: `/CONTEXT.md`.

- **Format:** a Map is a typed TypeScript data file (`maps/<map-id>/map.ts`) — pure data, no logic; the compiler catches typos. Splittable into `layout.ts` / `unlocks.ts` / `customers.ts` in the same folder. `maps/index.ts` lists maps in play order.
- **Catalog (shared):** `catalog/products.ts` (name, model, base price) and `catalog/producers.ts` (Producer types with fixed Recipe + default stats). Maps reference by id, may add new Products/Producer types, and may override prices and stats per map.
- **Engine vs data:** Station *kinds* and all behaviour (Crop, Animal, Machine, Shelf, Register, Trash Bin, Office, Pad, Customers, Staff AI, Stack, collision, camera, saves, UI) are engine code. New producer of an existing kind = data only; new kind = code.
- **Grid layout:** stations, Pads, Props on whole cells + rotation (0/90/180/270). Characters move freely.
- **Areas:** one or more rectangles. No walls — locked Areas are bare ground behind a low rope/fence; buying paves them in. Map edge is an invisible stop line. Keep the floor uncluttered.
- **Unlock Requirements:** "all of these ids" list (may reference an Upgrade level); empty = available from start. Pads are hidden until requirements are met. Every Pad has an explicit cell.
- **Upgrades:** `{id, family, target, stat, levels: [{cost, value}], requirements}`; the Office panel is generated from them.
- **Customers:** map declares Entrance and Exit cells; engine pathfinds on the grid. Each Register has a straight row of fixed Queue Spots from its front, with a max length (optional hand-laid spots override). All queues full → Waiting Spots. Customer settings shape/scaling and all numbers belong to [Design the economy and progression of the first map](05-economy-and-progression.md).
- **Start state:** list of ids owned from the start + starting Money. First map: Money for exactly the shelf, register and tomato-bed Pads.
- **Props:** model, cell, rotation, `solid`, optional owning Area.
- **Staff:** Staff Pads name a role; Cashier Pad names its Register (one each); Stocker Pad has a spawn cell. Chain assignment derived from Recipes.
- **Assets:** models referenced by pack path (`<pack>/<file>.glb`) in catalog and Props.
- **Ids:** readable strings, never renamed or reused once released.
- **Validation:** a check script in CI fails on dangling ids, unlock cycles/unreachable items, Shelf Products nothing produces, overlapping stations, queues colliding with stations/Props, and ids removed since last release.
- **Fog added:** an in-game level editor (maybe later).
