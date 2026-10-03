# Design the HUD and UI

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: —

## Question

What is on screen and how does it behave — Money counter, Completion %, Office Upgrade panel, Customer Shopping-List and mood bubbles, guidance arrows toward the next Pad, main menu, map list, settings (Grab Mode, audio, Credits screen) — and how does the layout differ between desktop and phone (joystick space, thumb reach, portrait vs landscape)?

## Context

Stack: Preact for panels, plain DOM for per-frame bits, Pad labels in-scene ([Choose the rendering library and toolchain](04-tech-stack-choice.md)). Credits screen and fixed Player look: [Pick the asset packs and art direction](08-art-direction-and-assets.md). A Player character choice may come later — out of v1. A phone-layout /prototype may be worth spinning off.

## Answer

Resolved 2026-10-03 (grilling). No separate phone-layout prototype; tune once the real game runs.

**General**
- Portrait and landscape both supported on phones; the camera keeps its 20 m view on the shorter screen side. No rotate prompt.
- Icons first, words only in menus, settings and Upgrade names. English only, no translation system.
- Toy-style look: chunky rounded cards, thick soft shadows, palette colours, buttons squish on press. Font: **Fredoka** (OFL, bundled, listed in Credits).
- Numbers: full with separators up to 9,999 (`$2,100`), then abbreviated (`12.5K`, `3.4M`).

**HUD** (top strip only, inside the safe area — the rest of the screen is joystick space)
- Money big at top-centre (bill icon + number; flying bills land on it). Completion % as a thin bar top-left. Gear top-right.
- No Stack counter: a bouncy **MAX** tag floats above the Stack in-scene when it's full.
- **Edge arrows** at the screen border, with the target's icon, for: an affordable newly revealed Pad, a Customer growing angry at an empty Shelf, an available affordable Upgrade. Hidden while the target is on screen. No toasts.

**In-scene**
- Customer bubble: only the Product they're heading to + remaining count. At an empty Shelf a patience ring drains yellow → red; an angry face as they leave. Cart/✓ or nothing while in a Register line.
- Bouncing **!** over the Office desk while an affordable Upgrade is available.

**Office panel**
- Opens when the Player reaches the desk; closes on walking away or X. After X it stays shut until the Player leaves the desk area and comes back.
- Game keeps running. A tap buys instantly; unaffordable → button greyed, showing the shortfall. Locked Upgrades hidden (same rule as Pads). Cards grouped Player / Station / Staff, with icon, name, level pips, cost.
- **Staff** section: each Stocker's assignment — Auto or one Product chain.
- Portrait: bottom sheet (~half screen). Landscape: right-third side panel. Camera nudges the Player into the free space; the joystick still works outside the panel.

**Screens**
- **Title**: logo + loading bar that turns into **Play** (that tap also unlocks audio). Behind it: the last-played map (Map 1 on first launch, as a teaser) shown **fully unlocked**, camera slowly panning left/right; animals and machines idle and a few scenery people wander — no sim, no real Customers, no Party Props. Play → closing-circle wipe into the real save.
- **Pause menu** (gear or Esc; sim paused; also auto-pauses when the tab is hidden): Resume / Maps / Settings, as centred cards.
- **Maps**: cards with name + Completion %; unreached maps as locked silhouettes ("coming soon" in v1). The Exit Pad car's picker reuses this panel.
- **Settings**: Music on/off, Sounds on/off, Grab Mode (desktop only), Fullscreen, Controls help, Credits. Reset/export → [Define save data and versioning](14-save-data.md); graphics quality → [Set the performance budget](16-performance-budget.md).

**Desktop keys**: WASD/arrows move; Esc closes the open panel, otherwise toggles pause; Space (held) is the Manual Grab Mode key. No mute or buy shortcuts.

**100% Completion**: non-blocking — a wobbly "100%!" banner drops in, confetti, and the Completion bar turns gold for good. The map's **Party Props** appear and stay.

**Template addition** (extends [Define the map template for future levels](06-level-template.md)): a Prop may be flagged "shown at 100%" — a **Party Prop**, placed per map with the layout editor.
