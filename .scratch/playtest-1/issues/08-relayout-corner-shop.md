# Re-lay out the Corner Shop

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-07)
Blocked by: 07, 09, 10, 14

## Question

Where does everything go in the new Corner Shop layout: Ovens and Blenders inside the store, the extra Shelves, the tomato beds lined up properly, and more Party Props (100% banners) placed correctly? And how big is each Station's box (collision) and each Pad, and how much space goes between them?

## Context

- Notes #12 (tomato bed alignment is off), #16 (Machines indoors, decided), #18 (too few 100% banners, misaligned), #23 (more Shelves).
- Use the layout editor (`V` / `?edit`) to move things. It writes `maps/corner-shop/layout.ts` and shows the trip meter.
- Machines moving indoors changes trip lengths, which feeds the economy fog on the map.
- From [Make Items and Producer output readable](09-item-and-output-readability.md): Coop ~3 × 3 m, Blender ~2 × 1.4 m, tomato beds bigger to fit ×1.6 ripe tomatoes (with note #12's alignment), and every Producer needs room for its output pallet in front. The owner expects a full rearrange.
- From [Rework the wheat field, Mill and Oven models](14-wheat-mill-oven-models.md): wheat fields 3 × 3, Mills ~2.4 × 2.4, Ovens ~2.2 × 2.2, Cow Pens 3 × 3 (square), each with its output pallet in front.
- From [Pick Shelf and Register models](10-shelf-and-register-models.md): Shelves stay 3 × 1 m; the Register grows to 2.6 × 1 m (check Queue Spots and the Cash Pile offset).
- Owner, 2026-10-07: **collision and spacing must get better.** Today the Station boxes (collision, interaction reach, the Pad it springs from) don't match the new, bigger models, and things are packed too tight. In scope:
  - every **Station box matches its visual footprint**, including its output pallet, so the Player and Customers bump into what they see, no more and no less;
  - **Pad size and spread**: how big each Pad is and where it sits relative to the Station it unlocks, so Pads don't crowd each other or the Stations;
  - **spacing**: walkways wide enough between Stations, Shelves and Queue Spots.
- Waits on Shelf count ([07](07-shelves-vs-shelf-size.md)), Producer sizes ([09](09-item-and-output-readability.md)) and model footprints ([10](10-shelf-and-register-models.md)).

## Answer

Resolved 2026-10-07 (prototype; Claude drafted, the owner walked it and approved everything except the Trash Bin, which moved to the back). Prototype: branch `prototype/relayout` (`src/app/relayout-prototype.ts`, `?relayout` on a dev build). **The decided layout is that branch's `maps/corner-shop/layout.ts`**; copy it as-is when building. It passes the map validator and the bot reaches 100% on it.

**Store and map grow:** store floor **44 × 22 m** (was 37 × 18), map **52 × 58 m** (was 42 × 50). Three Areas split the store and the farm by x: Area 1 x 4–20, Area 2 x 20–34, Area 3 x 34–48. Customer doors on the north wall and west wall as today; one back door per Area in the south wall, leading to that Area's farm.

**Store, front to back in each Area:**

- **Row A** (z 7.5): each Product's first Shelf. **Row B** (z 12.5): its second Shelf right behind, so each Product is one column. Shelves 3 × 1 m, 1.5 m apart, 4 m aisles between rows. Area 1: tomato, egg, ketchup. Area 2: wheat, milk, flour. Area 3: bread (both in row A).
- **Machines indoors:** Blender 1 in Area 1's back zone by its back door; in Area 3, row B holds both Ovens and Blender 2.
- **Back zone:** Register 1 (Area 1) and Register 2 (Area 3), each 2.6 × 1 m facing into the store with its 6 Queue Spots in front and its Cashier Pad behind; the Office in Area 1's back-left corner (partitioned as today); Stocker Pads 1, 3, 4 in Area 2 and 5, 2, 6 in Area 3; the Area 2 Pad in Area 1 and the Area 3 Pad in Area 2; the **Trash Bin at the back of Area 1, beside the back door** (not mid-store).

**Farm:** every Producer faces the store (rot 180), so its pallet is on the side nearest the back door. Area 1: two tomato beds (4 × 2.4) and two Coops; Area 2: two wheat fields, two Cow Pens and Mill 1; Area 3: Mill 2. The Exit Pad, van, car spots and road move down to the new map edge.

**Collision, Pads, spacing (owner's 2026-10-07 ask):**

- **Every Station box = its visual footprint, output pallet included.** The pallet sits in a 1.1 m strip along the box's front edge (inside the box); the Producer's structure fills the rest. Boxes: Shelf 3 × 1, Register 2.6 × 1, tomato bed 4 × 2.4, wheat field 3 × 3, Coop and Cow Pen 3 × 4.1 (a 3 × 3 square pen + pallet strip), Mill 2.4 × 3.5, Oven 2.2 × 3.3, Blender 2 × 2.5.
- **Pads stay 1.6 m** (`padHalfSize` 0.8; the owner didn't change the Pad size knob) and sit at their Station's box centre as today; with the new spacing no two Pads touch.
- **Walkways:** at least 1.5 m between any two solids in the store; aisles 4 m.
- Producers draw at their box size (the Coop/Blender ×1.5/×1.35 scales from ticket 09 become box sizes instead).

**Party Props (note #18):** 6 banners along the north wall (was 3) and 4 flags in the farm (was 2), each clear of doors.

**New Pads used by this layout** (from [Decide extra Shelves vs. Shelf size](07-shelves-vs-shelf-size.md) and [Decide Stocker roles and count](04-stocker-roles-and-count.md)), new ids, none renamed: `tomato_shelf_2`, `egg_shelf_2`, `ketchup_shelf_2`, `wheat_shelf_2`, `milk_fridge_2`, `flour_shelf_2`, `bread_shelf_2`, `stocker_3`, `stocker_4`, `stocker_5`, `stocker_6`. Their costs in the prototype are placeholders.

**Economy signal for the re-tune:** with placeholder costs and today's sim rules, the bot needs **122 simulated minutes** to reach 100% (target ~30). Longer trips and 11 more Pads are the cause; this goes to the economy re-tune in the map's fog.
