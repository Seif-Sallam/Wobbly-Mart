# Define the layout editor dev tool

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

How does the layout editor from the first-map prototype live in the real game as a development-only tool: how is it opened, how do edits get saved back into a Map's typed data file, how does it fit with the `?debug` panel, and how is it kept completely out of the release build?

## Context

Editor features and the "dev builds only" decision: [Lay out the first map](11-first-map-layout.md) (prototype branch `prototype/first-map-layout`). Typed TS map data, grid layout, stable ids and CI validation: [Define the map template for future levels](06-level-template.md). `?debug` panel and release-per-merge: [Define project practices](09-project-practices.md). Party Props are placed with it: [Design the HUD and UI](12-hud-and-ui.md).

## Answer

Resolved 2026-10-03 (grilling).

- **Scope:** move, resize and rotate anything; add or delete purely visual things only: walls, decor Props, Party Props, floors, Street, counter windows, Car Spots. Stations, Pads, Upgrades, Unlock Requirements and prices are still created in code (stable ids, typed numbers). Full authoring is out of scope for this effort.
- **Saving:** each map's layout is its own editor-owned file `maps/<map-id>/layout.ts`, rewritten whole (Prettier-formatted) on **Save** through a dev-server endpoint; Vite hot-reloads. Hand comments there are lost on save. Unlocks, Upgrades, Customer settings stay in hand-written files beside it.
- **Opening:** `npm run dev` only. `V` toggles it, `?edit` opens on load, `?map=<id>` picks any map.
- **Panel:** one `lil-gui` panel (new dependency, approved), lazy-loaded only with `?debug` so it stays out of the main bundle; the editor adds a dev-only section to it.
- **Release:** editor code behind `import.meta.env.DEV` + dynamic import so the build drops it; a CI check fails if editor code appears in `dist/`.
- **Live checks:** the CI map validator runs on every edit, problem items highlighted red; the trip-length meter stays. Save is never blocked; CI blocks broken maps.
- **Running game:** sim pauses while editing; leaving the editor or saving restarts the map fresh from the new layout (debug cheats get back to any state).
- **Kept from the prototype:** undo, snap (hold ⌘ / always), top-down + 3D editor cameras, show-everything-built, Area moves its stations, item list + inspector, walking inside the editor. Dropped: "undo last buy", copy/show current values.
