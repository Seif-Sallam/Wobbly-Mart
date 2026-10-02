# Lay out the first map

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-02)
Blocked by: —

## Question

Where does everything on the first map sit on the grid — the three Areas, every station and its Pad, Register lines and Waiting Spot, Office, Trash Bin, Entrance/Exit, the road and the Exit van — so that walking distances feel right and the estimator's ~10 m average trip holds? Build a rough walkable top-down blockout and react to it.

## Context

Format: [Define the map template for future levels](06-level-template.md) (grid cells, rotation, wall-less Areas, explicit Pad cells, straight Queue Spots). Contents and order: [Author the first map's price table and timings](10-price-table.md). Surroundings: [Pick the asset packs and art direction](08-art-direction-and-assets.md). Camera framing: [Prototype movement, camera and carrying feel](07-controls-and-camera-feel.md) (20 m view height). Re-run `price-table/sim.py` with the measured trip length.

## Answer

Resolved 2026-10-03 (prototype). **Map 1 is D "Corner shop".** Every layout made is kept: E "Long hall", F "L-shaped store" and G "Little n" are approved for later maps (G is the owner's favourite and will get more Products); the earlier open-plan A–C are saved as alternatives.

Assets:
- Layout data: `layouts/approved-layouts.ts` (D–G, current format) and `layouts/earlier-layouts-a-b-c.ts` (A–C, older format). Overview pictures: `layouts/D-overview.png` … `G-overview.png`.
- Prototype (primary source): branch `prototype/first-map-layout`, folder `prototypes/first-map-layout/` — `npm install && npm run dev`, then `?variant=D|E|F|G`, `V` for the editor, `?all=1&edit=1&cam=3D` for a full overview.

**Map 1 (Corner shop), 42×46 m:** walled shop along the top (18 m deep) with the farm yard behind it; Areas side by side left → right (Area 1 | 2 | 3), each with its shop part and yard part. Exact cells are in the data file.

**Building rules (all approved maps):**
- Walls round the whole shop: the two far walls full height, the camera-side walls knee-high (cutaway). No roof.
- Customer doors only in the far (front) walls, sliding open when anyone comes within ~2.5 m. One **Back Door** per Area in the back wall leads the Player to that Area's yard.
- Customers walk only the **Street** and the shop floor of bought Areas — never the yard. They appear at several street corners (3 per map) and leave by walking back out through a door.
- Registers at the back of the shop; Cashier stands behind, Queue Spots run towards the shelves.
- The Office is its own walled room, about 8×7 m, with a door, static decor (bookshelf, sofa, rug, plants, cooler, table) and one upgrade desk. It never blocks a customer route.
- **Car Spots:** three per map, usable from the start in Area 1. Either on the road beside Area 1's yard (D, E) or as a drive-through on the Street at a counter window in the front wall (F, G). Several cars can be parked at once. What the car event does stays in the fog.

**Template additions** (extends [Define the map template for future levels](06-level-template.md)): walls (tall / knee-high / office partition), counter windows, sliding doors, decor props (solid, or walk-over like a rug), indoor floor rectangles, Street rectangles (Customers only), several customer street spots instead of one Entrance + one Exit, and numbered Car Spots, each a car bay plus a pickup tile.

**Trips:** shortest one-way carrying trips on map 1 average **11.3 m** (Area 1 12.9, Area 2 10.5, Area 3 10.1). Back doors add the detour. `price-table/sim.py` re-run with 11.3 m: **30.5 min** to 100% (was 29.6), so no price changes. Other maps: E 11.0 m, F 8.0 m, G 6.6 m.

**Layout editor stays in the game, development builds only:** the editor and debug tools from this prototype become a permanent dev tool, so maps can be updated later. They must not exist in the deployed release build. Pairs with the `?debug` panel in [Define project practices](09-project-practices.md).
