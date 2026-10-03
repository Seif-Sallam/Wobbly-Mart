# Define save data and versioning

Type: grilling
Status: open
Blocked by: —

## Question

What exactly is saved (per map and global), when it is saved, how a save survives a game update (version number, migrations, what happens when it can't be migrated), and is there export/import or reset?

## Context

Saves are the sim state and ids are frozen per release ([Define project practices](09-project-practices.md)); stable ids rule in [Define the map template for future levels](06-level-template.md). Local browser storage only, no backend. Money is per map; visited maps can be revisited ([Design the economy and progression of the first map](05-economy-and-progression.md)). Pads keep partial payments (`CONTEXT.md`). Tutorial progress (current step / done) must be saved: [Design the tutorial](13-tutorial.md).
