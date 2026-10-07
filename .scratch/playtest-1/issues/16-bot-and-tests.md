# Update the bot and tests for the new rules

Type: grilling
Status: open
Blocked by: 02, 04, 06, 07, 12

## Question

Which new scenarios must the CI bot playthrough and the sim tests cover so the playtest-pass rules can't silently break: Sprint drops and Loose Items, never-give-up Customers, Stocker roles, two Shelves per Product, the 1.5 s Trash Bin hold, baskets tipping into a Mess? And what does the bot do with them (does it sprint, does it pick Stocker roles)?

## Context

- Today's bot (`scripts/bot-playthrough.ts`, `src/sim/bot.ts`) and Vitest sim tests assume the v1 Stack, Trash, list and patience rules.
- Project rule: broad flowing tests on `sim/` and the validator, no mocking our own code.
