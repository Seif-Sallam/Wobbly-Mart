# Design the tutorial

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: 11, 12

## Question

How is a new player guided through the first minutes — from $50 and three Pads to their first Customer, first Chicken, and the Office — with what cues (arrows, camera pans to new Pads, highlighted stations, text or none), and when does guidance stop?

## Context

Original game: arrow-only tutorial, camera pans to each new unlock ([Catalog the original My Mini Mart's mechanics](01-original-game-mechanics.md)). Opening order and prices: [Author the first map's price table and timings](10-price-table.md). Cues available from [Design the HUD and UI](12-hud-and-ui.md): edge arrows (new affordable Pad, angry Customer, available Upgrade) and the **!** over the Office desk — tune how loud they are early on.

## Answer

Resolved 2026-10-03 (grilling).

**Style:** arrows only, no text. On the first frame a movement hint (keycaps on desktop, dragging hand on touch — whichever input arrives first) fades after ~2 m of movement.

**Opening:** a new game on Map 1 starts with the Area 1 **Area Pan**, then the movement hint.

**Sequence** — a bouncing 3D arrow above the current target, plus the edge arrow from [Design the HUD and UI](12-hud-and-ui.md) when it's off-screen. No floor path.
1. Register Pad → 2. Tomato Shelf Pad → 3. Tomato bed Pad → 4. pick tomatoes → 5. fill the Tomato Shelf → 6. check out the first Customer at the Register → 7. walk over the Cash Pile → 8. Egg Shelf Pad → 9. Chicken Coop Pad → 10. feed the Chicken → 11. take eggs from the Tray to the Egg Shelf → 12. Office Pad → 13. buy one Upgrade.
- Non-blocking but ordered: the arrow always points at the first unfinished step; steps complete from game state, so anything done early is skipped. The tutorial never locks anything.
- Ends after step 13 (~1 min). Afterwards only the general cues: edge arrows, the Office **!**, Area Pans.

**Map data, not tutorial code:** the three opening Pads reveal one at a time via Unlock Requirements (Tomato Shelf requires Register, Tomato bed requires Tomato Shelf).

**Customers:** none arrive until the first Item is on a Shelf (every map). No patience while the tutorial runs.

**Area Pan** (all game, every map): when an Area is bought — and at the start of a new game for Area 1 — the camera glides to the Area (~0.6 s), holds (~0.8 s) and glides back (~0.6 s); tuned to look nice, may vary per Area. Player movement is blocked and it can't be cancelled. Ghosts of everything the Area will hold pulse for the whole pan and vanish when it ends. Ordinary Pads never pan.

**Scope:** once per save, Map 1 only, no Skip button. Later maps get no tutorial. Tutorial progress is saved → [Define save data and versioning](14-save-data.md).
