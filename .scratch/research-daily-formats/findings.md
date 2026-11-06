# Corner and Courtyard Daily formats within 10 m

Answers [#159](https://github.com/Seif-Sallam/Wobbly-Mart/issues/159) (map: #157). Throwaway branch `research/daily-formats`. Never merged. The diff to `maps/daily/blocks.ts` and `src/sim/daily-map.ts` on this branch is the proof of concept the build copies.

## Measuring rule

**Shop distance** is the shortest walk, on the walker nav grid with every Pad bought, from any cell of one shop's floor to any cell of another's. Walking through a third shop costs nothing: take the pairwise walks, then shortest paths over the shop graph (at most 3 shops).

- This is what "door to door" means in practice. Touching shops (Row, Column) measure about 1 m through the open wall. Shops across a Street measure front door to front door.
- A plain shop box gap is no good. It says 4 m for crossroads layouts whose real walk is 13–21 m, because the doors sit far from the crossing.
- `checkDaily` rejects a day when any pair is over `TUNING.dailyMap.shopWalk = 10` (m), message `shops <a> and <b> are <d> m apart`. It costs one `makeField` per shop on the map grid. The geometry only depends on the format, so in practice it guards against future edits more than it rerolls days.

## Why the old shapes can't be nudged

Every shop's Street runs edge to edge of the map and must not cross a block, and every block is 48 m deep (22 m shop + 26 m yard). Two shops facing perpendicular Streets therefore either have their yards overlap or sit at least 26 m apart. So the fix moves the shops to the corners of a **crossroads** (two Streets crossing), with the shops facing the crossing.

A brute force over every crossroads placement (`search.ts`: quadrant × facing for each of 3 Areas, with Area 1's front door at local x 7 or 10) found **none under 10 m**. The best was 13.6 m. Shops round a corner need a door at that corner.

## Changes (all in the branch diff)

1. **Corner door** (`BLOCK.cornerDoor: { from: 0.5, w: 2.5 }`). A shop side wall (not front, not back) that borders a Street gets a `customer` door, 0.5 m behind the front. This only happens at a crossroads: no Row, Column, Split or Kit shop has a side wall on a Street. The Street boxes are now computed before the walls; the code moved, the logic is the same.
2. **Street ground**. Each Street, clipped to the box round all shop floors, is Area 1 ground. This replaces the `format === 'split'` special case:
   - Split gets exactly the strip it had before.
   - Row, Column and Kit clip to nothing.
   - Corner and Courtyard get the crossing arms between their shops.
3. **New `FORMATS`** (crossroads Streets at x 48–52 and z 48–52 before the shift):

```ts
// a crossroads: Area 1 faces the north-south Street from the south-east; Area 2 faces the east-west Street
// round the corner, Area 3 beside it
corner: [
  { x: 52, z: 52, facing: 'W' },
  { x: 52, z: 0, facing: 'S' },
  { x: 66, z: 0, facing: 'S' },
],
// a crossroads: Areas 1 and 2 face each other across the north-south Street, Area 3 faces the east-west one
courtyard: [
  { x: 52, z: 52, facing: 'W' },
  { x: 0, z: 52, facing: 'E' },
  { x: 52, z: 0, facing: 'S' },
],
```

```
Corner (3 Areas)                     Courtyard (3 Areas)
            | V |  [A2 S][A3 S]                  | V |  [A3 S]
            |   |  (yards north)                 |   |
 ===========+===+============ H      ===========+===+=========== H
            |   |[A1 W]                  [A2 E] |   |[A1 W]
            |   | (yard east, road south)       |   |
```

- **Corner**: Area 1 sits in the south-east, faces west, and has a corner door onto the east–west Street. Area 2 sits round the corner in the north-east, faces south, and has a corner door onto the north–south Street. Area 3 shares Area 2's east wall (the wall is open). A 2-Area day is a true corner.
- **Courtyard**: Area 1 (south-east) and Area 2 (south-west) face each other across the north–south Street. Area 3 (north-east) faces the east–west Street. All three have corner doors onto the crossing. A 2-Area day is two shops facing across a Street.
- Area 1 sits south-east, so its road goes on the far (south) side of its yard and never meets a Street. In every other quadrant the road hit a Street and the day failed.

## Measured (`measure.ts`, 300 seeds per format, 2- and 3-Area days)

| Format    | Days (2 / 3 Areas) | Rerolls | Worst shop distance | Worst box gap |
|-----------|--------------------|---------|---------------------|---------------|
| row       | 146 / 154          | 12      | 1.0 m               | 14.0 m        |
| column    | 147 / 153          | 7       | 1.0 m               | 14.0 m        |
| corner    | 145 / 155          | 1       | **9.0 m**           | 4.0 m         |
| split     | 145 / 155          | 9       | 5.0 m               | 4.0 m         |
| courtyard | 144 / 156          | 0       | **9.1 m**           | 4.0 m         |

Before the change: corner 21.0 m (old shape 28.9 m), courtyard 19.0 m (old 71.6 m). No generation failures. Rerolls are the existing checks (mostly yard packing) and haven't changed.

## Notes for the build

- The Map fingerprint changes for Corner and Courtyard days only. Split's ground is identical. Row and Column gain no ground or doors. Bump `SIM_VERSION` with the other Daily changes and regenerate the calendar.
- Corner doors are `customer` doors, so Customers and the robbery's "nearest customer door" can use them. This is intended (a corner shop has two doors).
- Margin is about 1 m (9.0 / 9.1 vs 10). Don't move `frontDoor`, `cornerDoor.from` or the crossroads offsets without re-running the check.
- Vitest wasn't run here (`node_modules` is missing in this worktree), and the layouts weren't checked visually. `corner.svg` and `courtyard.svg` are top-down drawings of seed 7919 from `draw.ts`. In them, red marks a corner door, blue a front door and green a back door. Look at them in the build PR.
