# Re-lay out the Corner Shop

Type: prototype
Status: open
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
