# Find the flickering circle above the Player

Type: task
Status: open
Blocked by: —

## Question

What is the "huge flickering circle" the owner sees above the Player (note #21)? Is it the guidance marker, a blob shadow fighting the floor (`blobs` at y 0.025 in `src/view/world-view.ts`), a shadow-map artifact, or something else? And what does a fix that removes it look like?

## Context

AFK: reproduce it in the browser (Playwright) at several camera positions, name the mesh or effect that causes it, and capture before/after screenshots. The owner wants it gone. Whether anything should replace it (e.g. a calm guidance cue) gets confirmed with the owner when this resolves.
