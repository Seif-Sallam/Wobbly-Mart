# Decide Stocker roles and count

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: 03

## Question

How many Stocker Pads does the Corner Shop get, where and at what cost, and how does specialisation work: **Stock goods** (to Shelves) vs. **Stock machines** (feed Animals and Machines)? Is the role picked in the Office, how does it combine with today's per-Product assignment, and what does an unassigned Stocker do?

## Context

Note #7. Uses the numbers from [Measure how many Stockers the store needs](03-measure-stocker-need.md). The current urgency rules are in `TUNING.urgency` and `src/sim/staff.ts`. Update the Stocker entry in `CONTEXT.md` when resolved.

## Answer

Resolved 2026-10-03 (grilling with the owner, using the table from [Measure how many Stockers the store needs](03-measure-stocker-need.md)).

**Count:** 6 Stocker Pads (was 2). At 6 + the Player helping, ~2% of Customers leave angry — a little wonky chaos stays and the Player still matters. Unlock order, one per chain the store takes on:

1. after Area 2 (today's `stocker_1`)
2. after the wheat field
3. after the cow pen
4. after Area 3
5. after the Oven (today's `stocker_2`)
6. after the second Oven

Costs → economy re-tune (map fog). Floor positions → [Re-lay out the Corner Shop](08-relayout-corner-shop.md).

**Roles** replace today's per-Product assignment:

- **Auto** (default for every new Stocker): today's most-urgent-job logic, any kind of job.
- **Stock goods**: only jobs whose sink is a Shelf (beds → tomato Shelf, Blender → ketchup Shelf, Coop → egg Shelf, …).
- **Stock machines**: only jobs whose sink is an Animal or Machine input (tomato → Coop/Blender, wheat → Cow Pen/Mill, flour + egg → Oven).
- A Stocker with no job in its role waits; it never covers the other role.
- Picked in the Office panel: chips **Auto / Goods / Machines** per Stocker, free, changeable any time.

**Cap colours** (role shows only by cap; Office chips match):

| Who | Cap |
|---|---|
| Player | orange (unchanged) |
| Cashier | white (was orange) |
| Stocker — Auto | red |
| Stocker — Goods | purple |
| Stocker — Machines | blue |

New colours go in `src/palette.ts`.

**Saves:** no migration this pass — nobody but the owner has a save. Bump the save version and drop older saves. This also covers Shelf-size changes from [Decide extra Shelves vs. Shelf size](07-shelves-vs-shelf-size.md).

**Glossary:** Stocker entry updated in `CONTEXT.md`.
