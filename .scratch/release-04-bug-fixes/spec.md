# release-04 bug fixes: build-ready spec

These are the fixes asked for after testing the leaderboard release on main ([#156](https://github.com/Seif-Sallam/Wobbly-Mart/pull/156)). The spec was assembled on 2026-11-06 from the wayfinder map [release-04 bug fixes — Daily Shift, Wall, title, joystick](https://github.com/Seif-Sallam/Wobbly-Mart/issues/157). The map's tickets hold the reasoning behind each line.

Build: small playable PRs into `release-04-bug-fixes` (cut from main on 2026-11-06), in the order of §6. The release goes to main only on the owner's word. Terms are the ones in [`CONTEXT.md`](../../CONTEXT.md).

**Sources this spec points to instead of repeating:**

| What | Where |
|---|---|
| Crossroads Corner and Courtyard, corner doors, Street ground, the shop-walk rule | branch `research/daily-formats`, [`findings.md`](https://github.com/Seif-Sallam/Wobbly-Mart/blob/research/daily-formats/.scratch/research-daily-formats/findings.md) (diff in it) |
| Daily goal calibration, economy numbers, `stocker_2`, free Steady hands, `botTicks` | branch `research/daily-goal`, [`findings.md`](https://github.com/Seif-Sallam/Wobbly-Mart/blob/research/daily-goal/.scratch/research-daily-goal/findings.md) + [`diff.patch`](https://github.com/Seif-Sallam/Wobbly-Mart/blob/research/daily-goal/.scratch/research-daily-goal/diff.patch) (stacked on `research/daily-formats`) |
| Why phones don't go fullscreen | branch `research/phone-fullscreen`, [`phone-fullscreen.md`](https://github.com/Seif-Sallam/Wobbly-Mart/blob/research/phone-fullscreen/.scratch/release-04-bug-fixes/research/phone-fullscreen.md) |

The research branches are never merged. Copy their diffs into the build PRs.

---

## 1. Daily Map and Shift (sim)

### 1.1 Shop distance at most 10 m (1d, [#159](https://github.com/Seif-Sallam/Wobbly-Mart/issues/159))

- On a Daily Map, the shortest walk between any two shops is at most `TUNING.dailyMap.shopWalk = 10` m. It is measured on the walker nav grid with every Pad bought, from one shop's floor to another's. Walking through a third shop costs nothing.
- `checkDaily` rejects a day over 10 m, and the generator rerolls it.
- **Corner** and **Courtyard** are rebuilt round a crossroads (two Streets crossing):
  - A shop side wall that borders a Street gets a `customer` **corner door**: `BLOCK.cornerDoor: { from: 0.5, w: 2.5 }`.
  - Each Street, clipped to the box round all shop floors, is Area 1 ground. This replaces the Split-only special case.
  - FORMATS: Corner = Area 1 south-east facing W, Area 2 north-east facing S, Area 3 beside Area 2. Courtyard = Area 1 south-east facing W, Area 2 south-west facing E, Area 3 north-east facing S.
- Row, Column and Split are unchanged. Worst walks over 300 seeds: Corner 9.0 m, Courtyard 9.1 m.
- The margin is about 1 m. Don't move the doors or offsets without re-running the check.

### 1.2 Free Steady hands (1c)

- On a Daily Map the safe count is `TUNING.dailyMap.safe = 7` (base 5 + half the normal Maps' +3, rounded up). It is free and always on. Daily Maps have no Steady hands Upgrade.
- `safeCount` in `src/sim/economy.ts` returns it on a Daily Map. Research told a Daily Map by its `daily-` id. **Build:** use a MapDef field instead (see §1.5's `look`, or a `daily: true` flag; pick whichever is less code).

### 1.3 Second Stocker on 3-Area Maps (1e)

- A 3-Area Daily Map gets `stocker_2` at `STRIP.stocker` in Area 3. It is chained right after `area_3` and costs `cost() × staffCost.stocker`.
- 2-Area and Kit Maps keep one Stocker.

### 1.4 Daily goal: 3–4 parts, one late, bot at most 18 min (1b, [#160](https://github.com/Seif-Sallam/Wobbly-Mart/issues/160))

**Economy** (Daily only):
- `maps/daily/economy.ts`: drop the multi-Area ×2 on Upgrade costs; `dailyUpgrades` loses its `areas` param.
- `TUNING.dailyMap`: `padBase [12, 40, 100]`, `padGrowth 1.12`, `areaPadShare 0.35`.

**`calibrateDaily`:**
1. The no-goal bot plays until it buys its first **late Pad**, within `targetMinutes: [12, 18]` (× `botPace`). A late Pad sits at chain index `floor(chain × lateFrom)` or later, with `lateFrom = 0.5`. The chain excludes Opening Pads and Exit.
2. There are `goalParts 3` parts, plus one more at `extraPartChance 0.45`. The **late part is always the last part**:
   - at `lateSellChance 0.5`: Sell the furthest late Shelf's product, when the bot sold at least `sellMin` of it;
   - otherwise: Own the furthest late Pad.
3. The other parts come from a pool, one per kind first, then more Sells: Earn (always), Deliveries (if at least `deliveriesMin`), and Sells by best price. A late Sell's product is never reused.
4. Fallback: when no late Pad is bought by 18 min, Own the furthest Pad bought. This happened on 7 % of days.
5. Remove `ownAfter`. `targetMinutes` becomes `[min, max]`.

**Measured over 365 days:**
- 3 parts on 201 days, 4 parts on 164.
- The late part is in the last Area on 289 days and past the chain midpoint on another 50.
- Bot minutes: median 11.9, p90 16.6, max 18.0.
- The bot fails within `capMinutes` 20 on 0 days.

### 1.5 Daily theme and music (1h)

- Today every Daily Map wears the Corner Shop theme, because `THEMES[w.map.id]` misses for `daily-<hex>` ids.
- **Build:**
  - Rename MapDef `music?` to `look?`: "the Map whose theme and music this one wears (default: its own)".
  - The generator picks `look` from the four Map ids with the day's seed (`corner-shop`, `juice-bar`, `dairy-farm`, `pizza-place`).
  - `src/view/world-view.ts` (3×) and `src/view/level.ts` read `THEMES[map.look ?? map.id]`. `src/audio/audio.ts:79` reads `map.look ?? map.id`. The Tutorial keeps `look: 'corner-shop'`.

### 1.6 Bot time stored (1g)

- `DailyDay.botTicks` goes into `maps/daily-calendar.json`, written by `scripts/daily-calendar.ts`. The client reads it from the calendar entry, through `src/app/shift-day.ts`.

### Build notes for §1

- Every item in §1 changes the Map fingerprint.
  - The first sim PR bumps `SIM_VERSION` to 3 and sets GOLDEN (`src/sim/golden.test.ts`) to the value the test prints.
  - Later §1 PRs in this release only update the GOLDEN fingerprint (no release in between).
  - Refresh the replay fixture in `src/sim/replay.test.ts`.
- Regenerate the calendar with `npm run daily:calendar` (about 3 min for 365 days). `npm run daily:check` must pass.
- Tests (Vitest, sim only): extend the existing Daily test so it asserts on generated days:
  - the shop walk is at most 10 m;
  - a 3-Area Map has `stocker_2`;
  - the goal has 3–4 parts and its last part is late (or the fallback);
  - the safe count is 7.

## 2. Daily Shift on the HUD (ui/app)

### 2.1 Every goal part on the Shift chip (1a)

- `shiftFrame` (`src/app/app.ts`) shows only `left[0]` today. The chip lists **every** part, one row each: icon, name and got/want, with done rows ticked. The clock goes on the chip's first row.
- `hud.setShift` takes rows, not one string (`src/ui/hud.ts`).
- It must fit the phone-landscape top bar. Check at phone landscape and on desktop.
- After the goal is done, the chip keeps today's `✓ Done <clock> · for fun now` as a single row.

### 2.2 Restart Shift in the pause menu (1f)

- Remove the `↺ Reset` button from the Shift chip (`src/ui/hud.ts:91`, `onShiftReset`).
- The pause menu gets **Restart Shift**, only during a Daily Shift, behind a confirm. Reuse the confirm pattern the app already has: a hold button or a confirm card.
- It calls the existing `resetShift()`. **Try again** on the end screen stays.

## 3. Title

### 3.1 Bot time on the Daily card (1g)

- The Daily card shows the day's bot time, e.g. "Bot: 12:30". It comes from `botTicks`, formatted with the existing `clockOf`.

### 3.2 No round Credits button (3a)

- Remove the round Credits button at the title's top right (`src/ui/app.tsx:697`). Credits stays in Settings.

### 3.3 Phones always fullscreen (3b, [#158](https://github.com/Seif-Sallam/Wobbly-Mart/issues/158))

- `src/app/app.ts:221–224`: drop `{ once: true }`. Request fullscreen on every `pointerup` while `canFullscreen() && !document.fullscreenElement`.
- Hide the Settings Fullscreen toggle when `canFullscreen()`.
- Confirm on a real Android phone through `chrome://inspect`: background the tab, come back, then tap the title.

### 3.4 Reset this Map (3c)

- Each Map card on the title (or the Maps panel, `function Maps` in `src/ui/app.tsx`) gets **Reset this Map**: a `HoldButton`, then a confirm.
- It wipes that Map's Money, Pads, Upgrades, layout and Moves, Objectives, Stats and Completion quarters. It keeps its **Score**.
- The replay starts a fresh, **valid** Speedrun Run, so `runVoid` is cleared.
- Same idea as the dev `resetMap` hook (`src/app/app.ts:288`), but it keeps `score`.
- Not offered on the Tutorial or the Daily Shift.

## 4. Wall and menus

### 4.1 Daily history on the Wall (2a)

- The Wall's Today tab (`src/ui/wall.tsx`) gets ◀ / ▶ to step one day.
- ▶ stops at today, ◀ at day 1 (`TUNING.daily.launch`). The tab title shows the date.
- `GET /v1/boards/daily/<map>?day=` already serves any past day (`src/app/api.ts:62`). No Worker change.
- One request per step. Don't prefetch neighbouring days.

### 4.2 Menus follow HUD size (2b)

- `--hud-scale` today scales only `.hud-ui` (`src/ui/style.css:64–66`, set in `src/ui/hud.ts:120`).
- Every overlay and menu scales with the HUD size setting too: Wall, pause, settings, Logbook, the end screens, and the title panels.
- Set the variable once on a shared root and apply the same scale to the overlay container.
- Check at 1.0 and 1.6, in phone landscape and on desktop: nothing may be clipped and nothing may scroll sideways.

## 5. Joystick size (4a)

- New setting **Joystick size**: Small / Medium / Large. It is saved in Settings (`src/sim/save.ts` settings) and is touch only.
- Medium = today's `FEEL.joyPortrait` 110 / `joyLandscape` 115 px. Small = 0.75× that, Large = 1.25×. The factors live in `src/feel.ts`.
- `src/input/input.ts` and the `--joy-size` CSS variable (`src/app/app.ts:1243`) use the chosen size.
- The default is Small on a touch device. Everyone gets the same default; the setting does not watch orientation.

## 6. Build order (PRs into `release-04-bug-fixes`)

1. **Daily shops within 10 m**: §1.1 (copy the `research/daily-formats` diff), plus `checkDaily`'s shop-walk check, `SIM_VERSION` 3, and the calendar.
2. **Daily goal and economy**: §1.2, 1.3, 1.4 and 1.6 (copy `research/daily-goal`'s `diff.patch`, with the MapDef flag in place of the id check), plus the calendar.
3. **Daily theme**: §1.5, plus the calendar.
4. **Shift chip and Restart Shift**: §2.1 and §2.2.
5. **Title fixes**: §3.1, 3.2 and 3.3.
6. **Wall day history**: §4.1.
7. **Menus follow HUD size**: §4.2.
8. **Joystick size**: §5.
9. **Reset this Map**: §3.4.

Each PR:
- passes `npm run typecheck`, `lint`, `format:check`, `test`, `validate` and `daily:check`;
- is loaded and looked at in the browser, at phone landscape and on desktop;
- checks the Network tab for request counts on any screen that fetches.

PRs 1–3 run in order. PRs 4–9 are independent; PR 5's bot time needs PR 2.

## 7. Assumptions made without the owner (AFK run, 2026-11-06)

Raise any of these on the PR if they are wrong.

- **Late goal:** "late" means past the chain midpoint. It is not always the last Area. Days with no late Pad in 18 min (7 %) fall back to the furthest Pad and are not rerolled.
- **Bot time:** up to 18 min (inside "15–20"). The median is 11.9.
- **Daily economy:** cheaper later Pads and no Upgrade ×2 change how Daily Shifts play, not only the bot's time. The bot itself is unchanged, because the normal Maps share it.
- **Map reset and Score:** after a reset, re-earned Objectives, Challenges, Events and quarters add Score again, on top of the kept Score. This lets a player farm Score by resetting. If the Score Board must not allow that, keep the Objective ids and quarters that already scored, and award nothing for them again.
- **Joystick default:** Small on every touch device, not only in landscape fullscreen.
- **Restart Shift confirm:** reuse the existing hold-to-confirm pattern.
