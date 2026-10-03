# Wobbly Mart (web clone of My Mini Mart)

An arcade-idle store game: the player runs a small mart, producing goods, stocking shelves and checking out customers, and spends earnings to grow the store.

## Language

### Core loop

**Player**:
The single character the human controls. Interacts with everything by proximity only — walking near a thing is the action.
_Avoid_: hero, avatar

**Stack**:
The tower of **Items** the **Player** (or a **Stocker**) carries. May mix item types; has a capacity.
_Avoid_: inventory, bag

**Item**:
One unit of a **Product** in the world — on a stack, a shelf, or a station.

**Product**:
A kind of thing the store deals in (tomato, egg, ketchup). Raw or processed.

**Grab Mode**:
How **Items** move between the **Stack** and stations. *Auto* (default, the only mode on mobile): proximity transfers automatically. *Manual* (desktop setting): items transfer one at a time only while a key is held.

**Trash Bin**:
A station where the **Player** dumps unwanted **Items** from their **Stack**; they are destroyed, no refund.

**Mess**:
What an angry **Customer** leaves when dropping their cart — the goods are lost. Slows **Customers** walking through it until the **Player** walks over it to clear it.
_Avoid_: spill, dropped items

### Production

**Station**:
Any fixed thing in the store the **Player** interacts with by proximity (producer, **Shelf**, **Register**, **Trash Bin**).

**Producer**:
A **Station** that outputs **Products** according to its **Recipe**. Three kinds: **Crop**, **Animal**, **Machine**.

**Recipe**:
What a **Producer** consumes (its inputs) and what it yields (its outputs). Generic so new producers are data, not code.

**Crop**:
A **Producer** that grows a raw **Product** in plots (tomato bed).

**Animal**:
A **Producer** that must be fed input **Products** to yield output (chickens eat tomatoes → eggs).

**Machine**:
A **Producer** that converts input **Products** into a processed one (blender: tomato → ketchup).

**Loading**:
Putting a **Recipe**'s input **Items** into an **Animal** or **Machine**. It then works for a few seconds on its own and puts the output on its **Tray**.

**Tray**:
The output spot beside an **Animal** or **Machine** where its products wait to be picked up; when full, production pauses. Not a **Shelf** — customers never buy from it.
_Avoid_: output shelf

**Unlock Requirement**:
What must already be bought before a **Pad** (or **Upgrade**) becomes available. Distinct from **Recipe** inputs, which are consumed.
_Avoid_: prerequisite

**Chain**:
A sequence of **Producers** where one's output is another's input (tomato → chicken → egg).

### Selling

**Shelf**:
A **Station** that displays **Items** of exactly one **Product** for **Customers** to take; has a capacity. Shelves are unlocked one after another.

**Customer**:
A visitor with a **Shopping List** who takes **Items** from **Shelves** into a cart, queues at the shortest **Register** queue, pays and leaves. Has mild patience: only while waiting at an empty **Shelf** does it grow angry, then drop everything in the cart as a **Mess** and leave without paying. Never angry while in a **Register** line or on a **Waiting Spot**.

**Shopping List**:
What a **Customer** came for: up to 4 different **Products**, up to 4 units each.

**Sale Price**:
The fixed amount of **Money** one **Item** of a **Product** earns at checkout. Never upgradable. A processed **Product** is worth clearly more than the inputs it consumes.
_Avoid_: value, worth

**Customer Cap**:
The most **Customers** that can be in the store at once. Grows with the number of **Products** for sale and with every extra **Cashier**. New **Customers** arrive whenever the store is below it and at least one **Item** is on a **Shelf** — the only lever on how many come.

**Register**:
The checkout **Station**. Checking out a **Customer** drops cash onto its **Cash Pile**.
_Avoid_: till, cash box, checkout

**Cash Pile**:
Money left at the **Register**; only becomes spendable when the **Player** walks over it. Never auto-collected and the only uncapped thing in the game.

**Money**:
The game's single currency.
_Avoid_: coins, cash (except in **Cash Pile**), gems, coupons

### Growth

**Pad**:
A floor price tag; standing on it drains **Money** into it until the thing it unlocks is bought. Money paid in stays if the **Player** walks off; the Pad shows the remaining amount.
_Avoid_: price tag, buy zone

**Staff**:
Hired helpers, bought on **Pads**. Two roles: **Cashier** and **Stocker**.

**Cashier**:
**Staff** that checks out **Customers** at a **Register**. Does not collect the **Cash Pile**.

**Stocker**:
**Staff** that moves **Items** wherever they're needed — producers to shelves, to animals and machines, **Trays** to shelves. Unassigned, it takes the most urgent job; it can be assigned to a single **Product**'s chain.

**Area**:
A section of the map unlocked by a **Pad**; holds the **Pads** for its own stations.
_Avoid_: zone, expansion (as a noun for the place)

**Area Pan**:
When an **Area** is bought, the camera briefly sweeps over it, showing pulsing ghosts of everything it will hold; the **Player** can't move meanwhile. Ordinary **Pads** never trigger one.

**Office**:
The **Station** where **Upgrades** are bought: walking to it opens a panel.

**Upgrade**:
A purchased improvement in one of three families: **Player** (speed, stack capacity), **Station** (speed, capacity, more plots/animals), **Staff** (speed, carry capacity).

**Exit Pad**:
A **Pad** beside a car, bought late in a map; once bought, the car travels to the next map. The player can return to any visited map at any time.

**Completion**:
A map's progress as a percentage of everything purchasable — every **Pad** and every **Upgrade** level, equally weighted. 100% means everything is unlocked. The only meta-progression measure.
_Avoid_: stars, rating, prestige

### Maps

**Map**:
One complete store level: its layout, **Areas**, stations, **Pads**, **Upgrades**, starting state and customer settings. Maps are played in a fixed order.
_Avoid_: level, stage

**Catalog**:
The shared definitions every **Map** draws on: **Products** and **Producer** types with their **Recipes**. A **Map** may add to it or override its values.

**Prop**:
A non-interactive decoration on a **Map** (plant, sign, fence); may be solid, may belong to an **Area**.

**Opening**:
The state a **Map** starts in every time it is loaded: only what was bought survives (**Money**, **Pads**, **Areas**, **Staff**, **Upgrades**, **Stocker** assignments); no **Customers**, no **Items** anywhere, **Crops** start from seed. A brand-new game's Opening also plays the first **Area Pan**.

**Save Code**:
A text copy of the whole save that the **Player** can copy out and paste back in, to move between devices or keep a backup.

**Party Prop**:
A **Prop** that appears only once its **Map** reaches 100% **Completion**, and stays from then on.

**Street**:
The pavement outside the shop's front walls. Only **Customers** walk it; they appear at several spots on it, walk in through a front door and leave the same way. The **Player** never leaves the **Areas**.
_Avoid_: entrance, exit (as single points)

**Back Door**:
A door in the shop's back wall leading the **Player** from an **Area**'s shop part to its farm yard. **Customers** never go through it.

**Car Spot**:
A reserved bay where a car parks for the car event, with a pickup tile beside it where the **Player** hands over the order. Each **Map** has several, usable from the start.
_Avoid_: parking, drive-through (as a noun for the spot)

**Queue Spot**:
A fixed place in a **Register**'s line where a **Customer** stands to wait for checkout; each **Register** has a limited number.

**Waiting Spot**:
Where a **Customer** stands when every **Register**'s **Queue Spots** are taken.

## Relationships

- A **Crop**'s **Recipe** has no inputs; **Animals** and **Machines** need **Loading**
- A **Producer** has exactly one **Recipe**; a **Chain** links producers through their recipes
- Everything that holds **Items** has a capacity (stacks, shelves, trays, producer input queues) — capacities are upgradable
- Each **Register** has its own **Cash Pile**
- A **Shelf** holds **Items** for **Customers**; a **Customer** pays at a **Register**, producing a **Cash Pile**
- Each map has its own **Money**; it never carries over between maps
- A **Pad** stays hidden until its **Unlock Requirement** is met
- The game only progresses while the player has the game open — no offline earnings
- Uncollected **Cash Piles** are added to **Money** when the game saves; everything else not bought is lost at the next **Opening**

## Flagged ambiguities

- "checkout", "till", "cash box" all meant the **Register**.
- "prerequisite" split into **Recipe** inputs (consumed) vs **Unlock Requirement** (bought first).
- "the shelf next to the machine" is a **Tray**, not a **Shelf**.
