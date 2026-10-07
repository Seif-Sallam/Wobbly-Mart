# Update the bot and tests for the new rules

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-07)
Blocked by: 02, 04, 06, 07, 12

## Question

Which new scenarios must the CI bot playthrough and the sim tests cover so the playtest-pass rules can't silently break: Sprint drops and Loose Items, never-give-up Customers, Stocker roles, two Shelves per Product, the 1.5 s Trash Bin hold, baskets tipping into a Mess? And what does the bot do with them (does it sprint, does it pick Stocker roles)?

## Context

- Today's bot (`scripts/bot-playthrough.ts`, `src/sim/bot.ts`) and Vitest sim tests assume the v1 Stack, Trash, list and patience rules.
- Project rule: broad flowing tests on `sim/` and the validator, no mocking our own code.

## Answer

Resolved 2026-10-07 (grilling with the owner).

**Bot** (`src/sim/bot.ts`, `scripts/bot-playthrough.ts`):

- **Walks, never sprints.** It stays a "100% is reachable" gate; Sprint is covered by the sim test below.
- **Leaves every Stocker on Auto.** It doesn't set roles.
- **Time is only printed**, as today. CI fails only if 100% isn't reached within the 4 h limit. Today's figure with the re-tuned prices: 88 simulated minutes ([Re-tune the economy](15-retune-economy.md)).

**Sim tests** (Vitest, broad and flowing, no mocking our own code):

- **Opening test, updated:** Stack 8, Shelf 10, Completion counts 3 of 79.
- **New late-game flowing test** on a fully built store (every Pad owned), stepping through, in one test:
  1. **Two Shelves per Product:** a Customer heads for the fuller Shelf, ties to the nearer, and walks over when the empty one's twin gets Items.
  2. **Never-give-up Customer:** waits past 90 + 15 s at an empty Shelf, never angry, never leaves, then finishes the list once stocked.
  3. **Angry leave:** a normal Customer's patience runs out → 15 s angry → their basket tips and spills as a Mess → the Player clears it at the Trash Bin by holding **1.5 s**.
  4. **Sprint:** above the safe count, a seeded drop throws the top Item off as a **Loose Item** ~1.3 m behind; Customers walk through it, Stockers ignore it, the Player takes it back by walking over it (with room in the Stack); at or below the safe count nothing drops; a Steady hands level raises the safe count.
  5. **Stocker roles:** a Goods Stocker only fills Shelves, a Machines Stocker only fills Animal/Machine inputs, and each waits rather than cover the other role.
- **Validator test:** also covers retiring a released id (`shelf_cap`): a retired id passes, a retired id reused fails ([Re-tune the economy](15-retune-economy.md) found the conflict).
