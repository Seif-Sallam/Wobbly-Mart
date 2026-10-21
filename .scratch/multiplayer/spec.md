# Wobbly Mart — multiplayer design ("Fiscal Year" mode)

Design agreed in a grilling session on 2026-10-21. Fun first: no networking or tech decisions here. Capitalised terms from the solo game mean what [`/CONTEXT.md`](../../CONTEXT.md) says; new terms are defined below.

**Pitch:** 2–4 coworkers run a wobbly store for one Fiscal Year. They must hit each Shift's goal together, but only one of them gets the most Tips, and everyone can smack, shove and knock each other into the water to get there.

---

## 1. Frame

- A **separate game mode**, open from the main menu from the start. Needs no solo progress and never touches the solo save.
- **2–4 players**, each on their own device (phone or PC), joined by a room link. Tune for 2; 4 is glorious chaos.
- In the lobby each player picks a **skin** from several on offer. Skins are unique per lobby (first pick wins).
- No **Staff**: the players are the staff.
- Free-for-all; no fixed teams.

## 2. Session: the Fiscal Year

- A **Year** is 4 **Shifts** (Q1–Q4), each about 6 minutes, with a **Quarterly Meeting** between them and a **Year-End Party** after Q4.
- Each Shift is a random **Scenario** with a headline goal, graded 0–3 stars. A Year draws 4 Scenarios with **no repeats** and **rising difficulty** (Q4 is always a harder one). More Scenarios get added over time.
- **Failing a Shift** (0 stars) halves every player's Tips earned in that Shift.
- **Failing a second Shift** in the same Year = **Bankruptcy**: the Year ends on the spot with "The company has gone bankrupt. Everyone is fired." Awards still run (including "Richest Person in a Burning Building" for the top Tips), and that Year's **Shares** crash to almost nothing.

### Scenario ideas (list deferred, these are starters)

| Scenario | Goal |
|---|---|
| Grand Opening | The Mayor visits and must leave with a perfect cart. |
| Black Friday | Survive a horde of Customers; Shelves drain at triple speed. |
| Rent Day | Earn $X before the Landlord's car arrives (the plain quota). |
| The Critic | One hidden Customer is a food critic: find and serve them, and don't smack anyone in front of them. |
| Moving Day | Carry the whole store's stock onto a truck. Peak wobble. |

## 3. Together and against

- The **Scenario goal is shared**: the store wins or fails together.
- **Tips are personal** and decide the Year's winner (most total Tips).
- Every job pays a tip, so roles form on their own instead of everyone camping the Register:

| Action | Tip |
|---|---|
| Stocking a Shelf | small, per Item placed |
| Checking out a Customer | medium |
| Delivery handover, catching a Thief, cleaning a Mess | big |
| Walking over a Cash Pile | small (the cash itself goes to the team) |

Exact amounts are deferred.

## 4. Brawling

- **Smack** (tap): victim stunned ~1 s; the top few Items of their Stack fly off as **Loose Items** anyone can grab. Fragile Products (eggs) have a *chance* to break into a **Mess**.
- **Shove** (hold, release): charged push that launches the victim a few tiles.
- **Knockout**: 3 hits in quick succession → dazed ~3 s, cartoon stars.
- **Hazards** (water first; more with map design): falling in loses the whole Stack and respawns the player at the Office ~4 s later. No other penalty.
- **Fights scare Customers** — by chance, not always: a smack in view may drain nearby Customers' patience; a knockout may make one drop their cart (a Mess) and flee. Fight in the back yard, not aisle 2.

## 5. Twists

Every 45–60 s a **Twist** card shows on every screen and changes the rules for a while. The deck alternates "work together" and "fight each other" cards so the mood keeps swinging.

| Twist | Effect |
|---|---|
| Rush | A bus of 10 Customers arrives. Cooperate or the goal dies. |
| Bounty | "First to bring 5 Ketchup to the van gets $50 in tips." Race; smacking encouraged. |
| Butter Floor | Slippery floor for 20 s; shoves go twice as far. |
| Crown | One player wears a crown and earns double Tips; everyone hunts them. |
| Blackout | Lights out; only flashlight cones. |
| Team Up | Temporarily pairs players. |
| Temp Worker | A temporary Staff member for a while. |
| Robbery | As in solo. |
| Health Inspector | As in solo, but the escort circle needs **2 players, sometimes 3 or 4**, inside it. |

Full list deferred.

## 6. Money and buys

- Two pots: the **team pot** (store cash) and each player's **Tips**.
- **Rule:** anything that affects the store or everyone comes from the team pot; anything on your body comes from your own Tips.

| Team pot | Personal Tips |
|---|---|
| Pads (second Register, extra Shelf, a Machine) | Silly hat |
| Fireworks | Duck companion that follows you |
| Mascot statue, disco ball over the Register | Super-shove glove |
| | Banana peel to drop |

- Anyone can stand on a team Pad and spend the team pot on a pet project. "Who spent $300 on a blender?!" is intended.
- Personal buys cost score: "do I want to win, or do I want the duck?"
- In-Shift buys vanish at Year end (some may persist — see §9).

## 7. Social

### Quarterly Meeting (between Shifts)

- All players' characters on one camera; everyone spams emoji and words: taunts, pep talks.
- **Blame vote**: the most-blamed player wears a **dunce cap** next Shift. Cosmetic only.
- **Donations are encouraged here** (see below), e.g. a charity-drive moment for the trailing player.

### Pity Raise (catch-up)

- From Q2 on, the Meeting announces it publicly: "Management has noticed Seif is struggling. Seif receives a Pity Raise."
- The trailing player gets the Crown more often and a slightly stronger shove next Shift. Subtle; nobody should feel the result was decided by minute two.
- Now and then a Customer gives the trailing player **pity money**.

### Donations

- Any player can donate any amount of their own Tips to another, **down to $0.01**, at any time in a Shift or at a Meeting.
- Every donation is announced to everyone: "Alex donated $0.01 to Seif. Truly moved."

### Leaving and rejoining

- A disconnect is announced: "Alex has quit. Coward." Their Stack drops as Loose Items; the Scenario goal shrinks to fit the remaining players.
- Rejoining: "Alex has been rehired."

## 8. Brawl Arena

A ~60 s pure-shoving showdown, separate from the store.

- **When:**
  - **Voted** at any Quarterly Meeting (majority wins).
  - **Forced at Year end** when two or more players tie for first place on Tips.
- **Stakes:**
  - Voted: every player puts in the same slice of their Tips (~10%); last one standing takes the pot.
  - Tie-break: only the tied players fight; the winner takes first place. Everyone else watches.
- **Betting:** anyone may bet their own Tips on a fighter — fighters too, on themselves or on a rival. Bets are pooled and split among those who backed the winner, in proportion to their bets. Every bet is announced over the ring ("Sam bet $40 on Alex").
- **Venue:** a small ring with Customers cheering all around it; no store, no Items. Settings rotate: floating platform over water, the company office, more later.
- Last one standing wins; on timeout, the most knockouts wins.

## 9. After the Year

- **Year-End Party**: awards (Employee of the Year, Most Blamed, Butterfingers, Most Messes, Richest Person in a Burning Building after Bankruptcy…).
- **Shares**: multiplayer-only currency, earned at Year end from Tips plus awards, spent only on multiplayer cosmetics. Never converts to or from solo Money. Crashes on Bankruptcy.
- Awards unlock permanent cosmetics in a wardrobe (e.g. "Employee of the Year" jacket, "Most Blamed" trophy hat).

## 10. Maps

- Shifts run on **new compact maps built for brawling** (water, narrow bridges, conveyor belts), not the solo maps, which are too spread out for players to meet.
- Maps are deliberate and fast-paced: the goal is the Scenario, not growing a big store.

## 11. Deferred

- Map and hazard design.
- Full Scenario and Twist lists.
- Which cosmetics persist past a Year, and Shares prices.
- Exact Tip amounts, Arena stake size, Pity Raise strength, scare chances.
- Everything technical (networking, rooms, authority, sync).
