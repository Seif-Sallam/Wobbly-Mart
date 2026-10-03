# Assemble the build-ready spec

Type: task
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: 18, 19, 20

## Question

Gather every decision on the map into the single build-ready spec named in the Destination — one place a builder can work from without reading every ticket — and confirm with the owner that nothing is left undecided.

## Context

Sources: every ticket in the map's Decisions so far, `CONTEXT.md`, and research in `research/`. Optional events stay in the map's Not yet specified; the spec should say how v1 treats them (e.g. Car Spots reserved but unused) unless they are decided first.

## Answer

Resolved 2026-10-03 (task, with owner confirmation). Asset: [`spec.md`](../spec.md) is the build-ready spec. It gathers every decision on the map into 17 sections and points to the glossary, price table, layout data, research and prototypes instead of repeating them.

**Gaps found while assembling, decided by the owner:**
- Pad drain: any Pad's full price drains in a fixed ~1.5 s (like the Cash Pile drain).
- Car Spots in v1: painted bays and pickup tiles, no cars. The car event stays in the fog.
- Exit Pad in v1: van bounces and honks, then the Maps picker opens (Map 1 + "coming soon"). The van stays and reopens the picker. It counts toward Completion.
- Shopping List: uniform random, 1–4 Products × 1–4 units, matching the estimator.

**Consistency fixes:** the economy ticket's "11 Upgrades" is 13 Upgrade lines / 37 levels (each Producer speed counts as its own line). Completion on Map 1 = 31 Pads + 37 levels = 68. Locked Areas inside the walled shop get a rope and a locked tint (from the layout prototype).

Nothing on the route is left undecided. What remains is build-time picking (music, sound files, Player look, logo drawing, Pad icons, Party Props, start spot) and tuning the numbers by playing.
