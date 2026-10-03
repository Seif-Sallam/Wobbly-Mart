# Pick the audio and juice

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

Which sound plays for each event, what background music (if any), and which feedback effects (squash/stretch, popups, screen shake, money bursts) make the game feel wonky and funny — plus volume/mute behaviour?

## Context

Sources and suggested mapping: research 02 §D. Licenses CC0/CC-BY/OFL; Money is bills, coins only as a flip effect; Pads count down ([Pick the asset packs and art direction](08-art-direction-and-assets.md)). Stack/transfer motion settled in [Prototype movement, camera and carrying feel](07-controls-and-camera-feel.md); match its tone. Audio via howler ([Choose the rendering library and toolchain](04-tech-stack-choice.md)).

## Answer

Resolved 2026-10-03 (grilling).

**Character:** cartoony toy sounds — plops, boings, squeaks, rubbery pops; even "real" sounds (ka-ching, cluck) are slightly exaggerated.

**Music:** one bouncy, low-volume loop (pizzicato/ukulele/marimba feel), same on the title and in game. Loaded after **Play**, so it never delays the first load. The track is picked by listening during the build. No per-map music in v1. **No ambience bed.**

**Sounds per event**

| Event | Sound |
|---|---|
| Item picked up | short pop (slows with the pick-up pacing as the Stack fills) |
| Item dropped off (Shelf, Machine, Animal) | "plop", pitch rising per Item with the drop-off crescendo |
| Paying into a Pad | fast rising-pitch ticks, "ding" at 0 |
| Pad bought | pop + short boing as the Station springs up |
| Area bought (Area Pan) | short jingle (Kenney `jingles_PIZZI`) |
| Customer pays | exaggerated ka-ching |
| Cash Pile drained | bill tick/rustle per bill, rising pitch |
| Upgrade bought | power-up rise |
| Machine working | quiet short loop while it runs (blender whirr, mill creak, oven hum) |
| Animal fed / laying | cluck or moo, random pitch |
| Customer leaves a Mess | grumble + splat |
| Mess cleared | swish |
| Stack full (**MAX**) | small bonk |
| UI buttons / panels | soft click |
| 100% Completion | fanfare jingle + party horn |
| Footsteps | none |

- Every sound gets ±10% random pitch; at most ~4 copies of the same sound at once.
- On-screen sources at full volume, off-screen at ~30%. No stereo panning, no 3D audio.

**Volume:** only the existing Music and Sounds on/off toggles, both on by default. Music dips under jingles. All audio stops while paused or the tab is hidden. Persisting the toggles → [Define save data and versioning](14-save-data.md).

**Sources:** Kenney CC0 audio packs first. Freesound CC0 for ka-ching, cluck, moo (re-check each sound's license). jsfxr pre-generated into files for the rising ticks (no runtime library). All sound effects in **one MP3 sprite** played by howler; music is a separate MP3. Every sound is listed in Credits. Audio size counts toward [Set the performance budget](16-performance-budget.md).

**Juice**
- **Squash & stretch:** Items squash on landing; a Station bounces a little per Item received; a newly bought Station springs up with overshoot.
- **Money:** bills fly to the HUD Money counter, which bumps and rolls to the new value. Coins flip only as the payment effect.
- **Floating numbers:** `+$X` (checkout total) above the Register when a Customer pays; `+$X` above the Player while draining a Cash Pile. Nothing on Pad payments or purchases (no `-$`). Chunky Fredoka, Money green, thick white outline, in-scene; pop with overshoot, slight wobble, drift up ~1 m, fade over ~0.8 s. A repeat pop from the same source within ~0.3 s adds to the existing number and re-bounces.
- **Cash Pile drain:** walking over it starts a drain. Bills peel off one by one and fly to the Player, the pile shrinks, and the `+$` number and HUD counter count up as each bill lands. The drain takes ~0.6–1 s whatever the pile size (bill count capped). Once started it finishes even if the Player walks off.
- **Puffs:** dust when a Station appears or a Mess is cleared; steam/flour while a Machine works; feathers when a chicken lays.
- **Characters:** Customers hop happily after paying and stomp angrily before leaving.
- **No screen shake, no vibration.** The wobble lives in objects, not the camera.

Juice timings go in the same tunable feel config as [Prototype movement, camera and carrying feel](07-controls-and-camera-feel.md).
