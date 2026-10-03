# Tune Stack capacity and wobble onset

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

What base Stack size and what wobble curve make carrying feel wonky early, without the Stack feeling endless? Should the Stack-size Upgrade steps shrink too?

## Context

Note #5: the carry max is too high, or the wobble shows up too late. Today: base `stack: 16`, Upgrade steps 20/24/28/32, and sway constant from `FEEL.sway` / `swayStiffness` / `swayDamping`. Prototype with presets and a live panel, and let the owner pick.

## Answer

Resolved 2026-10-03 (prototype, owner played it and picked preset **A**, the original, untouched). Prototype: branch `prototype/stack-wobble` (`src/app/stack-prototype.ts`, `?stack=A` on a dev build). The owner tried the wobblier A+ / A++ and the extremes B / C, and kept A.

**Capacity:** base Stack **8** (was 16). The Stack-size Upgrade adds **+2 per level**: 10 / 12 / 14 / 16 (was 20 / 24 / 28 / 32). Upgrade costs go to the economy re-tune.

**Wobble** — the bottom Items stay rigid and the top bends, so the Stack looks wonky from the 3rd Item on:

```json
{
  "wobbleFrom": 2,
  "bendPower": 1.3,
  "bendGain": 0.9,
  "sway": 2.5,
  "swayStiffness": 45,
  "swayDamping": 16,
  "leanMax": 0.8,
  "jiggle": 0.02,
  "jiggleSpeed": 3,
  "itemSpacing": 0.31
}
```

- `wobbleFrom`: Items at the bottom that never bend. `bendGain` × (height above them)^`bendPower` is how far each Item follows the lean.
- `sway` / `swayStiffness` / `swayDamping`: the lean spring driven by the Player's acceleration (today's values were 2 / 51 / 20). `leanMax` caps it.
- `jiggle` / `jiggleSpeed`: new idle wobble, so the Stack is never perfectly still — slight.
- All of these go in `src/feel.ts`. The bend applies to every Stack (Player, Stockers, Customer carts at their scale).

Feeds [Design the Sprint](06-sprint.md): the Stack now tops out at 8–16 Items, and the sprint's "no risk at 3 or fewer" sits just above the rigid bottom 2.
