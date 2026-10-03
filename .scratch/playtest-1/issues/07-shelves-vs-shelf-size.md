# Decide extra Shelves vs. Shelf size

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

Does the Shelf-size Upgrade go away in favour of buying extra Shelves per Product? If so: how many Shelves per Product, at what Pad costs and with what Unlock Requirements, and how do Customers and Stockers choose between two Shelves of the same Product?

## Context

Note #23: more Shelves instead of bigger Shelves. Today `shelf_cap` is an Office Upgrade (8 → 12/16/20) and each Product has one Shelf Pad (`maps/corner-shop/unlocks.ts`). This changes Completion's count (Pads + Upgrade levels) and saves.

## Answer

Resolved 2026-10-03 (grilling with the owner).

- **Shelf-size Upgrade is removed** (`shelf_cap`, 3 levels). Every Shelf holds a fixed **10** Items (was 8 → 12/16/20). One full starting Stack (8) never overflows a Shelf; two Shelves hold 20, like today's maxed Shelf.
- **2 Shelves per Product** → 7 new Shelf Pads (14 Shelves in all). The first Shelf of each Product keeps its place in the unlock order.
- **Second Shelf unlocks right after that Product's second Producer Pad:** `tomato_plots` → 2nd tomato, `chicken_2` → 2nd egg, `blender_2` → 2nd ketchup, `wheat_plots` → 2nd wheat, `cow_2` → 2nd milk, `mill_2` → 2nd flour, `oven_2` → 2nd bread.
- **They're optional leaf Pads:** no Pad, Area or the Exit Pad requires them, so you can progress without them. They still count toward Completion. Costs → economy re-tune; positions → [Re-lay out the Corner Shop](08-relayout-corner-shop.md).
- **Customers re-pick each time they head for a Product:** the Shelf with the most Items, ties to the nearer one. Waiting at an empty Shelf, they walk over when the other gets Items. If both are empty, they wait at the nearer one.
- **Stockers: no new rule.** Today's urgency (empty with Customers waiting, then lowest) already spreads work across same-Product Shelves.
- **Completion:** −3 Upgrade levels, +7 Pads.
- **Saves:** covered by [Decide Stocker roles and count](04-stocker-roles-and-count.md) — version bump, no migration.
- **Glossary:** Shelf entry updated in `CONTEXT.md`.
