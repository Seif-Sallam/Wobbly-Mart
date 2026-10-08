# Wobbly Mart (web clone of My Mini Mart)

An arcade-idle store game: the player runs a small mart, producing goods, stocking shelves and checking out customers, and spends earnings to grow the store.

## Language

### Core loop

**Player**:
The single character the human controls. Interacts with everything by proximity only — walking near a thing is the action. Moves by joystick, keys, or a **Tap Walk**.
_Avoid_: hero, avatar

**Stack**:
The tower of **Items** the **Player** (or a **Stocker**) carries. May mix item types; has a capacity.
_Avoid_: inventory, bag

**Item**:
One unit of a **Product** in the world — on a stack, a shelf, or a station.

**Product**:
A kind of thing the store deals in (tomato, egg, ketchup). Raw or processed.

**Grab Mode**:
How **Items** move between the **Stack** and stations. _Auto_ (default, the only mode on mobile): proximity transfers automatically. _Manual_ (desktop setting): items transfer one at a time only while a key is held.

**Trash Bin**:
A station where the **Player** dumps unwanted **Items** from their **Stack** by standing on it for 1.5 s; they are destroyed, no refund. Walking past never trashes anything. Each **Area** has one, against a wall the camera can see (never the south wall); bins never move. **Stockers** use one only as a last resort.

**Tap Walk**:
Tapping or clicking the floor, a **Pad** or a **Station** sends the **Player** walking there on their own; at a **Station** they stop within reach so proximity does the action, and at a **Register** they go behind it. A double tap sprints. Any joystick or key input cancels it.

**Sprint**:
Holding run makes the **Player** move 1.5× faster. A tipping **Stack** sheds its top **Item** much more often while sprinting.

**Tipping**:
With more **Items** than **Steady hands** allows, a **Stack** may shed its top **Item**: likelier the taller it is, most while sprinting, a little while walking, and more on sharp turns and sudden stops. The **Item** lands as a **Loose Item** or, depending on its **Product**, breaks into a **Mess**.

**Loose Item**:
An **Item** that fell off the **Player**'s **Stack** without breaking. It lies on the floor until the **Player** walks over it to take it back.
_Avoid_: Mess (a Mess is lost; a Loose Item isn't)

**Mess**:
What an angry **Customer** leaves when dropping their cart, a tipped basket, or an **Item** that broke falling off a **Stack** — the goods are lost. Slows everyone walking through it and makes **Customers** in it lose patience faster, until someone cleans it with a **Mop**.
_Avoid_: spill, dropped items

### Production

**Mop**:
What cleans a **Mess**: taken from the **Mop Stand** with an empty **Stack**, and while held no **Items** can be picked up. It goes back only when carried back to the stand.

**Mop Stand**:
The **Station** in the **Office** room that holds the store's **Mops**.

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
A **Station** that displays **Items** of exactly one **Product** for **Customers** to take; holds a fixed number of **Items**. A **Product** can have more than one **Shelf**; more are unlocked as the store grows.

**Customer**:
A visitor with a **Shopping List** who takes **Items** from **Shelves** into a cart (a hand basket, or stacked on their hands), queues at the shortest **Register** queue, pays and leaves. Has long, random patience: only while waiting at an empty **Shelf** does it grow angry, then drop everything in the cart as a **Mess** and leave without paying. Some **Customers** never give up and wait as long as it takes. Never angry while in a **Register** line or on a **Waiting Spot**.

**Shopping List**:
What a **Customer** came for: 1–4 different **Products**, 1–4 units of each, the same for every **Product** on it. Longer lists usually want fewer of each; a full list of 4 × 4 is very rare.

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
**Staff** that moves **Items** wherever they're needed. Has a role, picked in the **Office**: **Auto** takes the most urgent job of any kind; **Stock goods** only carries **Items** to **Shelves**; **Stock machines** only feeds **Animals** and **Machines**; **Clean** only mops **Messes**. A **Stocker** with no job in its role waits.

**Area**:
A section of the map unlocked by a **Pad**; holds the **Pads** for its own stations.
_Avoid_: zone, expansion (as a noun for the place)

**Area Pan**:
When an **Area** is bought, the camera briefly sweeps over it, showing pulsing ghosts of everything it will hold; the **Player** can't move meanwhile. Ordinary **Pads** never trigger one.

**Office**:
The **Station** where **Upgrades** are bought: walking to it opens a panel.

**Upgrade**:
A purchased improvement in one of three families: **Player** (speed, stack capacity, **Steady hands** — how many **Items** are safe while sprinting), **Station** (speed, more plots/animals), **Staff** (speed, carry capacity).

**Edit Layout**:
A paused mode opened from the **Office** where the **Player** rearranges bought **Stations** (not **Pads**, the **Office** or **Trash Bins**) on a grid, each staying in the shop or the farm yard of any bought **Area**. Pressing Done pays for the **Moves** made. There is no going back to the original layout.

**Move**:
One **Station** left somewhere other than where it started an **Edit Layout** session (a new spot or rotation), paid for on Done. Each bought **Area** adds 3 Moves to the **Map**'s pool; each Move costs more than the last.

**Exit Pad**:
A **Pad** beside a car, bought late in a map; once bought, the car travels to the next map. The player can return to any visited map at any time.

**Completion**:
A map's progress as a percentage of everything purchasable — every **Pad** and every **Upgrade** level, equally weighted (**Moves** don't count). 100% means everything is unlocked. The only meta-progression measure.
_Avoid_: stars, rating, prestige

### Events

**Event**:
A timed happening on a **Map** that asks the **Player** to act: a warning, a running phase, then a reward if handled or a cost if not. Paid in **Money** and **Items** only. **Deliveries** run alongside anything; the **Player**-bound ones (**Robbery**, **Health Inspector**) come one at a time.

**Delivery**:
An **Event** where a car parks at a **Car Spot** with an order; bring the **Items** to its pickup tile before it leaves to earn more than their **Sale Price**. Ignoring one only misses the reward.

**Robbery**:
An **Event** where a **Thief**, looking like a **Customer**, takes goods or cash and runs for the door. Only the **Player** can stop them.

**Health Inspector**:
An **Event** visitor who walks a fresh route through the shop and must be escorted by the **Player**; the store's dirt (**Messes**, **Loose Items**) decides a bonus or a fine, and leaving them alone too long earns a bad review.

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
A reserved bay where a car parks for a **Delivery**, with a pickup tile beside it where the **Player** hands over the order. Each **Map** has several, usable from the start.
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
