# Prototype movement, camera and carrying feel

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-02)
Blocked by: 04

## Question

How should moving, the isometric camera follow, and carrying a stack of items feel on desktop (WASD/arrows) and mobile (virtual joystick)? Build a throwaway prototype with placeholder assets and react to it.

## Answer

Resolved 2026-10-02 (prototype). Owner's verdict: **variant B, "very wonky and funny"** — the playful wobble is the appeal; snappy/rigid (A) and weighty (C) rejected.

Prototype (primary source): branch `prototype/movement-feel`, folder `prototypes/movement-feel/` — `npm install && npm run dev`, then `?variant=B`. Placeholder primitives; three presets + live tuning panel.

Chosen values (starting point for the real build; still tunable):

| Area | Setting |
|---|---|
| Movement | top speed 5.5 m/s; ramps up over 0.31 s, stops over 0.30 s; turns at 10 rad/s (character visibly swings round); walk bob 0.05 m |
| Full Stack | slows the Player by 25% when at capacity (linear with fullness) |
| Joystick | floating (nipplejs `dynamic`, anywhere on screen); **analog** — half-push = half speed |
| Camera | orthographic, 45° yaw, **41° pitch**, view height **20 m**; soft follow (sharpness 9, exponential) with **0.44 s look-ahead** along velocity |
| Stack | carried **in front**; item spacing 0.31 m; capacity 10 (map Upgrades will change it) |
| Sway | spring driven by Player acceleration — amount 2 (slider max), stiffness 51, damping 20: a big, slow, heavy lean that bends more toward the top, rather than a fast jiggle |
| Transfers | Auto Grab; reach 0.6 m from the Station's edge; one Item per 0.25 s; each Item flies 0.3 s on a 1.5 m arc |

Notes for the build:
- The owner pushed sway to the slider's maximum, so allow values above 2 when tuning later.
- Use feel constants as named config (one `feel.ts`), not magic numbers, so they stay tunable.
- "Wonky and funny" is a tone for the whole game (art, juice, audio), not just the Stack — recorded in the map's Notes.
- **Transfer pacing (agreed after the prototype, not yet felt):**
  - *Drop-off speeds up* — each Item leaves faster than the last (e.g. 0.25 s × 0.85 per Item, floor ~0.06 s), a "plop… plopplopplop" crescendo. Resets each time the Player arrives at a Station.
  - *Pick-up slows mildly* — interval scales with Stack fullness, at most 2× (0.25 s empty → 0.5 s full), like the walking slowdown. Kept mild so capacity Upgrades never feel like a penalty.
  - Numbers are starting points; tune both curves in play.
- Manual Grab Mode was built (hold Space/E) but not judged; it stays as decided in [Decide which mechanics the clone includes](03-core-mechanics-scope.md).
