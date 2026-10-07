# Assemble the playtest-pass spec

Type: task
Status: resolved
Assignee: Claude, confirmed by Seif 2026-10-07
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 14, 15, 16

## Question

Gather every decision on this map, including the notes decided as-is, into `spec.md` as a delta on the v1 spec, and confirm with the owner that all 25 playtest notes are covered and nothing is left undecided.

## Context

Check against the playtest note one item at a time. Clear or ticket whatever is left in the map's Not yet specified before resolving this.

## Answer

Resolved 2026-10-07. The spec is [spec.md](../spec.md), a delta on the v1 spec. Its first table maps all 25 playtest notes to a spec section and ticket; the owner confirmed everything is covered.

Settled with the owner at assembly (no ticket had decided them):

- The angry-Customer edge arrow fires at the shared 30 s tell.
- `shelf_cap` is retired through a `retired` list in `released-ids.json`.
- The old save is dropped silently this once.

The glossary's Trash Bin entry (1.5 s hold) and Customer entry (cart = hand basket or hands) were updated.
