# Find the flickering circle above the Player

Type: task
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

What is the "huge flickering circle" the owner sees above the Player (note #21)? Is it the guidance marker, a blob shadow fighting the floor (`blobs` at y 0.025 in `src/view/world-view.ts`), a shadow-map artifact, or something else? And what does a fix that removes it look like?

## Context

AFK: reproduce it in the browser (Playwright) at several camera positions, name the mesh or effect that causes it, and capture before/after screenshots. The owner wants it gone. Whether anything should replace it (e.g. a calm guidance cue) gets confirmed with the owner when this resolves.

## Answer

Resolved 2026-10-03 (task, AFK investigation plus owner's pick on the fix).

**Cause:** it's the Player's **orange cap**, not a shadow or a marker. In `src/view/characters.ts` the cap and brim are added to the model's root group at a fixed height taken from the bind pose. The head is moved by the skeleton (`walk`/`idle` clips plus walk bob), so it rises and sinks through the cap and the orange disc pops in and out of the black hair every few frames. In 10 frames of walking, the cap showed in 3 and was hidden in 7. Stockers and Cashiers have the same bug with their role-colour caps (`ROLE_CAP` in `src/view/world-view.ts`). The blob shadows and the orange guidance cone are fine.

**Fix (owner chose "pin caps to the head"):** parent the cap and brim to the `head` bone, which both `chars/character-male-a` and `market/character-employee` have, so they move with the head. Sit the cap fully on top of the hair with no overlap, so its top face never fights the hair surface. Keep every cap and colour: orange for the Player, role colours for Staff. Nothing replaces it, and no new guidance cue is needed.

**Check when built:** close-up frames while walking and idle show the cap in every frame, on the Player, a Stocker and a Cashier.
