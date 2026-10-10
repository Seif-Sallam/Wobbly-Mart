# Music and Machine sounds for Maps 2–4: free-licensed candidates

Research for [#41](https://github.com/Seif-Sallam/Wobbly-Mart/issues/41), under [#36](https://github.com/Seif-Sallam/Wobbly-Mart/issues/36). Checked 2026-10-10. Every link was opened and its license read on the primary page (OpenGameArt or Freesound). Nothing was downloaded into the repo. Lengths come from the Freesound page; most OpenGameArt pages show none, so file size is given instead (OpenGameArt downloads were throttled to a few KB/s; only one OGA file was measured, `[MEASURED]`). Loopability is from the author's page; nothing here was listened to, so **pick by ear during the build**, the same way issue 17 picked the Corner Shop track.

## 1. What the current audio already covers

Sources: `src/audio/audio.ts`, `src/audio/sprite.json`, `scripts/build-audio.sh`, `catalog/credits.ts`.

- **Music:** one file, `public/audio/music.mp3` (Bouncy Hamster Dancing, cynicmusic, CC0; 65.0 s, 64 kbps mono `[MEASURED]`). `Sounds.unlock()` loads it as a looping `Howl` (`html5: true`) after **Play**. It has no idea which **Map** is loaded.
- **SFX sprite:** `public/audio/sfx.mp3` (16.9 s `[MEASURED]`, 20 entries in `sprite.json`): `pop plop tick ding boing jingle kaching bill powerup cluck moo grumble splat swish bonk click fanfare horn honk hum`. Built offline by `scripts/build-audio.sh` from Kenney packs, two Freesound clips and three ffmpeg-made sounds.
- **Producers today:**
  - **Crop** harvest: no own sound. Picking up is the generic `transfer` → `pop`.
  - **Animal:** on `produced`, 50% chance of `moo` if `output === 'milk'`, otherwise `cluck`. **A goat (goat milk) would cluck** with this code.
  - **Machine:** one shared loop, `hum` (a 1 s synthetic 90 Hz drone made in `build-audio.sh`), played while any **Machine** has `work > 0`, louder if one is on-screen. Blender, mill and oven all share it; issue 17 wanted per-Machine loops ("blender whirr, mill creak, oven hum") but v1 shipped one.
  - Loading (drop-off) is the generic `plop` crescendo for every **Producer**.
- **Credits:** `Credit.license` is `'CC0' | 'CC-BY 4.0' | 'OFL 1.1'`. A CC-BY **3.0** pick needs `'CC-BY 3.0'` added to that union; nothing else changes. `CREDITS.md` is generated from it.

## 2. Music candidates per Map

All loaded the same way as today (after **Play**, separate from the first-load budget in issue 16). Encode like the current track: mono, 44.1 kHz, 64 kbps MP3 (~0.5 MB per minute).

### Juice Bar — fresh, fruity, upbeat

| Track | Author | License | Length | Loop | Notes |
|---|---|---|---|---|---|
| [Tropical Loop](https://opengameart.org/content/tropical-loop) | wipics | CC0 | not on page (WAV 3.2 MB) | tagged *loop*; "Tropical Loop with African drums" | synths + conga; most "fruity" of the set |
| [Sicilian sun](https://opengameart.org/content/sicilian-sun) | Konrad "FeniX" Gadzina | CC-BY 3.0 | 9.0 s loop `[MEASURED]` (preview `Sicilian sun - looped.ogg`) | "short loop" | solo ukulele, chill-beach; very short, may wear thin |
| [Happy Clappy Loop](https://opengameart.org/content/happy-clappy-loop) | OwlishMedia | CC0 | not on page (WAV 6.2 MB) | "Loops seamlessly" (author) | cheerful piano + claps; a commenter ships it in a mobile game |
| *alt* [Atoll](https://opengameart.org/content/atoll) | Alexandr Zhelanov | CC-BY 3.0 | not on page (OGG 2.7 MB) | author: the OGG is "more loopable" | ukulele + drive guitar, bright |

### Dairy Farm — country / farm

| Track | Author | License | Length | Loop | Notes |
|---|---|---|---|---|---|
| [Gone Fishin'](https://opengameart.org/content/gone-fishin) | Memoraphile @ You're Perfect Studio | CC0 (also CC-BY 4.0 / OGA-BY 3.0) | not on page (MP3 3.5 MB) | tagged *loopable, looping* | banjo bluegrass; same page has `beary_fishy_menu_screen` (MP3 2.3 MB) as a calmer second loop |
| [Apple Cider](https://opengameart.org/content/apple-cider) | Zane Little Music | CC0 | not on page (OGG 3.2 MB) | not stated | cozy acoustic guitar/flute/whistle, tagged *farm, harvest moon, stardew valley* |
| [Casual game track](https://opengameart.org/content/casual-game-track) | Alexandr Zhelanov | CC-BY 3.0 | not on page (OGG 3 MB) | not stated | "Track in Farm-games style", tagged *casual, farm, funny* |
| *alt* [Jumping Jamboree](https://opengameart.org/content/jumping-jamboree) | tcarisland | CC-BY 4.0 | not on page (MP3 7.5 MB) | page has a separate `_tail.wav`; drum intro 4 bars | banjo, xylophone, cowbell, 128 bpm, "happy upbeat" |

### Pizza Place — Italian / busy downtown

| Track | Author | License | Length | Loop | Notes |
|---|---|---|---|---|---|
| `restaurant` loop in [Short Looping Songs](https://opengameart.org/content/short-looping-songs) | Umplix | CC0 (credit optional, "Umplix") | not on page (zip 22.9 MB, 9 loops) | the pack is "Short Looping Songs" | tagged *restaurant, accordion*; inside `short_loops.zip` |
| [The Italian Heist (Looping)](https://opengameart.org/content/the-italian-heist-looping) | Eric Matyas (soundimage.org) | CC-BY 3.0 | 1:22 (page) | "(Looping)" | playful/sneaky — also fits the **Robbery** twist. Credit must be in-game: "The Italian Heist" by Eric Matyas, www.soundimage.org ([his attribution page](https://soundimage.org/attribution-info/)) |
| [The Accordion Sample](https://opengameart.org/content/the-accordion-sample) | Spring Spring | CC0 | not on page (OGG 4.7 MB) | not stated | accordion + synth, tagged *european, lively, quick, upbeat* |
| *alt* "Accordion, Guitar, Action!" in [Four original MIDI loops](https://opengameart.org/content/four-original-midi-loops) | tapatilorenzo | CC0 | not on page (MP3 1.2 MB) | author: "fun but less seamless" | beepbox chiptune; editable source on beepbox |

**Rejected:** [Eat' sa Pizza](https://opengameart.org/content/eat-sa-pizza) (CC-BY-SA 4.0 — share-alike, outside today's licenses). [Farm Music](https://opengameart.org/content/farm-music) (OGA-BY 4.0, slow piano, page reports a silent `.flac`). Kevin MacLeod / incompetech: CC-BY, but its licence page no longer states a version and filmmusic.io now redirects to ende.app, so not verifiable on a primary page today. Paid "farm music packs" on itch/Unity (not CC).

### How per-Map music joins

- Files: `public/audio/music-<mapId>.mp3` (Corner Shop keeps `music.mp3` or is renamed `music-corner-shop.mp3`). Built by extra lines at the end of `scripts/build-audio.sh`, trimmed to the loop with `atrim` if the source has an intro/tail.
- `Sounds.unlock()` takes the Map id (or a `setMap(id)` swaps the `Howl`, unloading the old one). Title screen: whichever Map is selected, or keep the Corner Shop track there.
- One `Credit` per track in `catalog/credits.ts`; CC-BY 3.0 picks add `'CC-BY 3.0'` to the license union.

## 3. Sounds per new Producer: reuse vs new

Rule today: **Machines** share one `hum` loop; **Animals** pick a voice clip on `produced`; **Crops** use the generic `pop`. Two ways to give Machines their own voice:

- **Cheap (reuse):** keep `hum`, pass a per-Producer `rate` (and volume) — e.g. blender 1.6×, churn 0.7×. No new files.
- **Per-Machine loop:** a `sound` name per **Producer** type in `catalog/producers.ts` (data, not code), each a 1–2 s seamless slice in the sprite. `machineHum` already plays one loop at a time at the loudest Machine's volume; it would play the loudest working Machine's own loop. Each 1.5 s slice at 64 kbps mono costs ~12 kB.

Every Freesound link below shows **"Creative Commons 0"** on its page (checked 2026-10-10). Lengths are the page's.

| Producer | Kind | Reuse today | New candidate (CC0) | Length | How it joins |
|---|---|---|---|---|---|
| apple tree, orange tree, sugar cane, strawberry patch, olive tree | Crop | `pop` on pick-up | none needed | — | unchanged |
| goat pen | Animal | **none** — code plays `cluck` for non-milk | [Single Goat Bleating 2x](https://freesound.org/people/Kinoton/sounds/581240/) (Kinoton); alt [Baby goat bleating](https://freesound.org/people/jsbarrett/sounds/200333/) (jsbarrett), [Goat.wav](https://freesound.org/people/leosalom/sounds/234286/) (leosalom, 1:29 field rec.) | 4.0 s / 8.1 s / 1:29 | new sprite entry `bleat` (~1.5 s, one bleat); Animal voice picked by Producer data instead of `output === 'milk'` |
| smoothie blender | Machine | `hum` (high rate) | [blender mixer smoothie](https://freesound.org/people/leosalom/sounds/234883/) (leosalom, Zoom H2N, banana smoothie) | 20.2 s | loop slice `whirr`; also usable for Corner Shop blender |
| squeezer | Machine | `hum` | [Orange juicer](https://freesound.org/people/JuanFeB/sounds/533275/) (JuanFeB); alt [making juice (foreground)](https://freesound.org/people/miguel2613/sounds/324782/) (miguel2613, electric juicer) | 4.3 s / 42.2 s | loop slice `juicer` |
| apple press | Machine | `hum` low + `plop` | [wood creaks](https://freesound.org/people/seth-m/sounds/269722/) (seth-m) layered with [squishes.wav](https://freesound.org/people/Eneasz/sounds/216882/) (Eneasz, wet noodle stirring) | 5.3 s / 1:23 | one `press` loop (creak + squish mixed in ffmpeg); shared with cheese press |
| cheese press | Machine | `hum` low | same `press` as apple press (creak only, lower rate) | — | reuse `press` with `rate` |
| sugar mill | Machine | `hum` (Corner Shop mill uses it too) | [Manual Coffee Grinder](https://freesound.org/people/apintofmild/sounds/642772/) (apintofmild); alt [Mill stone grinding corn](https://freesound.org/people/PLukx/sounds/430589/) (PLukx, 3:15) | 1:21.9 / 3:15.5 | loop slice `grind`; also fits the Corner Shop mill |
| candy pot, pudding pot, sauce pot | Machine | `hum` | [Boiling Pot of Water](https://freesound.org/people/monsterthing/sounds/456382/) (monsterthing); thicker alt [bubbling hot pot 01](https://freesound.org/people/rucisko/sounds/343744/) (rucisko, mud pot — gloopy, good for pudding/candy) | 14.4 s / 35.7 s | one `bubble` loop for all three pots, `rate` per pot (candy higher, pudding lower) |
| butter churn | Machine | `hum` low | [Water Churn.wav](https://freesound.org/people/columbia23/sounds/396749/) (columbia23, liquid sloshing in a bottle) | 38.0 s | loop slice `slosh`; or reuse `bubble` slowed |
| ice cream maker | Machine | `hum` | no CC0 "ice cream maker" on Freesound (search: 1 unrelated result). Reuse the dough mixer's `mixer` at low rate, or `hum` | — | reuse |
| dough mixer | Machine | `hum` | [MUS135 Sound Lab Stand Mixer 1](https://freesound.org/people/Orl2004/sounds/704146/) (Orl2004); alt [Stand mixer slow buildup](https://freesound.org/people/Fwughox_Official/sounds/747749/) (Fwughox_Official, 57 s, several speeds); [Blender](https://freesound.org/people/Fewes/sounds/170745/) (Fewes, actually a handheld mixer, 25.2 s); for a wetter feel [Mixing pasta](https://freesound.org/people/danieldouch/sounds/167298/) (danieldouch, 25.7 s) | 4.4 s / 57.1 s | loop slice `mixer`; shared with ice cream maker |
| pizza oven | Machine | `hum` (Corner Shop oven uses it) | [fire_crackling_oven.WAV](https://freesound.org/people/Fasolt/sounds/91114/) (Fasolt, open oven door, fresh fire) | 16.4 s | loop slice `crackle`; also fits the Corner Shop oven |

**Minimum new set:** `bleat` (required — otherwise the goat clucks) plus, if per-Machine loops are wanted, 6 loops: `whirr`, `juicer`, `press`, `grind`, `bubble`, `mixer`, `crackle` (7 with `slosh`). Each new clip gets a `Credit` (author, CC0, Freesound URL) like the existing cluck/moo entries; at ~1.5 s each the sprite grows ~100 kB.

## Sources

- Repo: `src/audio/audio.ts`, `src/audio/sprite.json`, `scripts/build-audio.sh`, `catalog/credits.ts`, `.scratch/my-mini-mart-web/issues/17-audio-and-juice.md`.
- OpenGameArt pages linked in §2 (license badge, files, author notes read on each page).
- Freesound sound pages linked in §3 (license "Creative Commons 0" and duration read on each page).
- Eric Matyas attribution terms: https://soundimage.org/attribution-info/
- Incompetech licences page: https://incompetech.com/music/royalty-free/licenses/
