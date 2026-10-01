# Decide which mechanics the clone includes

Type: grilling
Status: resolved
Blocked by: 01

## Question

From the catalog of the original's mechanics, which ones does our one map include, which are simplified, and which are cut? Pin down the core loop and the vocabulary (stations, products, customers, staff, upgrades, expansions) into `CONTEXT.md`.

## Answer

Glossary for all terms below: `/CONTEXT.md`. Decided 2026-10-02.

- **Loop**: exactly the original — proximity-only; Stack → Shelf → Register → walk over Cash Pile (never auto-collected).
- **Production**: generic **Recipe** (inputs → outputs) for every Producer — mandatory so new producers are data. Kinds: Crop (no inputs; pick ripe plants from the plot, per-plant regrow), Animal, Machine. Animals/Machines: Loading → work a few seconds → output on a **Tray** → player carries it to a selling Shelf. **Unlock Requirement** (bought first) is separate from Recipe inputs (consumed).
- **Capacities everywhere** (Stack, Shelf, Tray, input queue), all upgradable; only the Cash Pile is uncapped. Full Tray pauses production.
- **Stack**: mixed types; only matching items leave at a station; Trash Bin destroys, no refund. **Grab Mode**: Auto (default, only option on mobile) / Manual (desktop setting, hold a key to transfer one at a time — both pickup and drop).
- **Customers**: Shopping List of up to 4 Products × up to 4 units, only from unlocked Shelves; shortest Register queue. Mild patience: angry, then drops the whole cart as a **Mess** (goods lost) and leaves without paying. Mess slows customers until the player walks over it.
- **Shelves**: one Product each, capacity, unlocked one after another. Multiple Registers, each with its own Cash Pile.
- **Staff**: Cashier + Stocker only, hired on floor Pads. Stocker takes the most urgent job (empty shelf with waiting customers → lowest shelf → empty producer input) or is assigned to one Product's chain.
- **Growth**: Areas, stations, staff unlock on Pads. Upgrades bought at the **Office** (walk-to panel), gated by Unlock Requirements. Families: Player (speed, stack capacity), Station (speed, capacity, more plots/animals), Staff (speed, carry capacity), few levels each.
- **Progress**: Completion % = every Pad + every Upgrade level, equal weight; 100% = everything unlocked. Money is the only currency.
- **No offline earnings** — the game only progresses while open.
- **Deferred (nice-to-have)**: thief, timed deliveries, random spills, Cleaner staff.
- **Cut**: stars, prestige, premium currencies, boosts.
