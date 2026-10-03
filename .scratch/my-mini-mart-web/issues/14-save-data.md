# Define save data and versioning

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

What exactly is saved (per map and global), when it is saved, how a save survives a game update (version number, migrations, what happens when it can't be migrated), and is there export/import or reset?

## Context

Saves are the sim state and ids are frozen per release ([Define project practices](09-project-practices.md)); stable ids rule in [Define the map template for future levels](06-level-template.md). Local browser storage only, no backend. Money is per map; visited maps can be revisited ([Design the economy and progression of the first map](05-economy-and-progression.md)). Pads keep partial payments (`CONTEXT.md`). Tutorial progress (current step / done) must be saved: [Design the tutorial](13-tutorial.md).

## Answer

Resolved 2026-10-03 (grilling). Storage facts: [research/14-browser-storage.md](../research/14-browser-storage.md).

**Every load is an Opening:** loading a Map (reload, or arriving via the Maps menu) opens the shop fresh — only bought things survive.
- **Saved per map:** Money (uncollected Cash Piles are added to it on save), Pads and Areas bought (Staff included), partial Pad payments, Upgrade levels, Stocker assignments.
- **Not saved:** Customers, Messes, every Item (Shelves, Trays, Producer inputs, Stacks), Machine/Animal work in progress. Crops restart from seed. The Player appears at the map's start spot.
- **Saved globally:** current map, visited maps, tutorial step. **Settings** (Music, Sounds, Grab Mode) are stored separately and survive a reset.
- **Tutorial after a reload:** resumes at the first unfinished step; purchase steps already done count, carry/stock steps repeat.
- **Switching maps** saves the map left behind, then opens the other map.

**When:** autosave every ~5 s, right after every purchase, and when the tab is hidden or closed. No save button, no saving indicator.

**Updates:** the save carries a version number; each bump ships a one-step migration and old saves run the chain. Content changes need no migration: unknown ids are dropped, new Pads show unbought, values are clamped to new limits, a partial payment that reaches a lowered price counts as bought. If a save still can't be migrated: keep it under a backup key, start fresh, show one message. Never wipe silently.

**Storage:** localStorage with namespaced keys (all `<user>.github.io` Pages sites share one origin), every read/write in try/catch. If saving isn't possible, the game still plays with a small "progress won't be saved" note on the title. `navigator.storage.persist()` is requested after the first Pad is bought (Firefox prompts, so never before playing).

**Settings additions:** **Copy save code** / **Paste save code** (text code via clipboard, paste asks to confirm); **Reset progress** (hold ~2 s, wipes all maps, keeps settings). No per-map reset.

**Two tabs:** the older tab detects the newer one and pauses behind a "Playing in another tab" card.

**iPhone (Safari wipes storage after 7 days of non-use):** one-time card after the tutorial on iOS Safari (not Home Screen) suggesting Add to Home Screen, with the share-icon picture; the same tip sits in Settings beside the save code. Needs a web app manifest + icon so the Home Screen version opens full screen.
