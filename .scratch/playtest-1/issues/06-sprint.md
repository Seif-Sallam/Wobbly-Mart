# Design the Sprint

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: 05

## Question

How does the Sprint work: which key or touch control, whether it's a 1.5× speed boost, the drop-chance curve by Stack height, what a drop looks like (one Item or a slide), where dropped Items go (a Mess? pick them back up?), and how it combines with the Walk-speed Upgrade?

## Context

Note #6: run at 1.5× speed, with a chance to drop Items. No risk at 3 Items or fewer. Above that the chance grows with Stack size. It depends on the Stack size from [Tune Stack capacity and wobble onset](05-stack-cap-and-wobble.md). New glossary term **Sprint** goes in `CONTEXT.md` when resolved.

## Answer

Resolved 2026-10-03 (prototype + grilling; the owner played the presets and picked **B, "Pick-up"**, with a lower drop rate). Prototype: branch `prototype/sprint` (`src/app/sprint-prototype.ts`, `?sprint=B` on a dev build).

**Controls:** hold **Shift**; on touch, push the joystick past its ring (force > 1.4). No on-screen button.

**Speed:** **1.5×**, multiplied on top of the Walk-speed Upgrade (8.25 m/s base, 11.25 m/s at Walk speed level 4). The full-Stack slowdown still applies.

**Drops** — while sprinting and moving, with more Items than the safe count:

```json
{
  "speed": 1.5,
  "scaleWithUpgrade": true,
  "safe": 3,
  "maxRate": 0.3,
  "curve": 1.2,
  "slideMax": 1,
  "cooldown": 1,
  "dropDistance": 1.3,
  "touchForce": 1.4
}
```

- Chance per second = `maxRate` × ((Stack − safe) / (Stack cap − safe))^`curve`. So 0.3/s at a full Stack, falling to 0 at the safe count.
- One top Item per drop, at most one drop per second. It flies off and lands ~1.3 m behind the Player, a little to one side.

**Loose Item** (new; not a Mess):

- No splat. Customers aren't slowed by it.
- Only the Player picks it back up, by walking over it (if the Stack has room). Stockers ignore it. It never disappears.
- In the prototype it was hacked onto Mess with a flag; the build should make it its own thing.

**New Upgrade — "Steady hands"** (Player family, in the Office next to Walk speed and Stack size): safe count 3 → **4 / 5 / 6** over 3 levels. Costs → economy re-tune. Adds 3 levels to Completion.

**Glossary:** Sprint and Loose Item added to `CONTEXT.md`; the Upgrade entry's Player family mentions Steady hands.
