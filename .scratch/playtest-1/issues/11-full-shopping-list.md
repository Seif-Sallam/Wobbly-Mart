# Show the whole Shopping List

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-07)
Blocked by: 02

## Question

How does a Customer's bubble show the whole Shopping List (every Product and how many are still wanted) without cluttering a busy store, and how does it react as Items go into the cart?

## Context

Note #25. Today the bubble shows only the current Product (HUD decision in the v1 map). List sizes come from [Decide Customer demand](02-customer-demand.md).

Also settle the patience ring in the bubble: never-give-up Customers have no marker, but a ring that never shrinks would give them away (found in [Measure how many Stockers the store needs](03-measure-stocker-need.md)).

## Answer

Resolved 2026-10-07 (prototype; the owner picked preset **A, "Receipt"**, as-is). Prototype: branch `prototype/full-list` (`src/app/list-prototype.ts`, `src/view/proto-list.ts`, `?list=A` on a dev build; it also carries the [Decide Customer demand](02-customer-demand.md) rules).

```json
{
  "variant": "A",
  "mood": "steps",
  "moodAt1": 12,
  "moodAt2": 30,
  "doneStyle": "tick",
  "bubbleScale": 1,
  "pop": 0.35
}
```

**Bubble = a receipt card** above the Customer while shopping (hidden once they head to the Register, as today):

- **One line per Product** on the Shopping List, in list order: the Product's icon and **×n** still wanted.
- **Current line** (the Product they're heading for or waiting at) has a soft orange highlight.
- **Finished lines** stay on the card: icon faded to 35% with a green **tick** instead of the count.
- **Item into the cart:** that line's icon and count **pop** (scale up to ×1.35 and back over 0.35 s); a line's tick pops in the same way when it completes.
- The card grows with the list (1–4 lines); the tail points at the Customer.

**Patience tell — shared steps, never a giveaway:** the shrinking ring is removed. While waiting at an empty Shelf, every Customer shows the same tells at the same times, both below the 45 s minimum patience:

- **12 s:** a yellow "…" face on the card's corner.
- **30 s:** an orange ">_<" face, and the card's outline turns orange.
- **Really angry** (after their own 45–90 s roll): red ">:(" and a red outline, as today; then the 15 s to leaving.
- Never-give-up Customers simply stay at ">_<", so they look exactly like anyone else who hasn't given up yet.
- An Item taken resets patience, so the tells clear too.

**Known trade-off:** with a full store (15 Customers) the receipt cards overlap; the owner accepted that over the compact options.
