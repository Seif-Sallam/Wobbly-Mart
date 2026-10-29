# Netcode models for a small browser brawler

Research for [#126](https://github.com/Seif-Sallam/Wobbly-Mart/issues/126), part of map [#124](https://github.com/Seif-Sallam/Wobbly-Mart/issues/124). Sources were read 2026-10-30. The decision itself belongs to [#136](https://github.com/Seif-Sallam/Wobbly-Mart/issues/136). This file gives the costs, the evidence and a lean.

**Target:** 2–4 friends on phones (iPhone and Android) in one region, on home Wi-Fi or 4G, at ~150 ms RTT to whatever sits in the middle. Smacks, Shoves, Loose Items flying and Customers come from [`.scratch/multiplayer/spec.md`](../../multiplayer/spec.md). Cheating among friends is acceptable.

The three models:

- **(a) Server sim.** A server (e.g. a Cloudflare Durable Object) runs `src/sim/`. Phones send inputs and receive snapshots.
- **(b) Host + relay.** One player's browser is the **Host** and runs the sim. A relay forwards inputs to the Host and snapshots back out. To a guest this works like (a).
- **(c) Deterministic lockstep / rollback.** Every phone runs the sim. Only inputs travel, through the same kind of relay.

---

## 1. What the sources say

### Snapshot + prediction (models a and b)

- **Quake-style client/server:** clients send inputs and the server sends state, "so the game no longer has to be deterministic across machines". Each player's latency depends on their own link, not the slowest one, and joining or leaving mid-game is easy. ([Fiedler, *What every programmer needs to know about game networking*](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/))
- **Client-side prediction:** the client moves its own character at once. When a correction arrives, it rewinds and replays its stored inputs. Corrections "mainly occur when outside events … affect the player in ways the client cannot predict" (same source). In our game, **being smacked or shoved is exactly that kind of event.** The victim's character will be corrected (a small pop or a smoothed slide) about ½ RTT after the Host decides the hit.
- **Source engine numbers** ([Valve, *Source Multiplayer Networking*](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking), read via the web.archive.org copy because the live wiki answers 403 to bots):
  - Tick 66 Hz. Snapshots default to `cl_updaterate 20`, and commands are sent at about 30 packets/s, with several commands per packet.
  - Interpolation delay is `cl_interp 0.1` (100 ms), "even if one snapshot is lost, there are always two valid snapshots to interpolate between". After that, it extrapolates for up to 0.25 s.
  - Delta compression is used: a full snapshot goes out only at start or after heavy loss.
  - With 150 ms latency and no prediction, "the player would see his own change of movement with a 150 milliseconds delay". Prediction removes that delay for your own character.
  - **Lag compensation:** "Command Execution Time = Current Server Time − Packet Latency − Client View Interpolation". The server moves other players back to that moment, tests the hit, then restores them. It keeps one second of history. The known cost is that hit detection "is not pixel perfect".
- **Snapshot interpolation buffer:** at 2–5% loss, use about 3× the send interval: 300 ms at 10 pps, **150 ms at 30 pps**, 85 ms at 60 pps. Skip lost snapshots and never wait for a resend. ([Fiedler, *Snapshot Interpolation*](https://gafferongames.com/post/snapshot_interpolation/))
- **State sync** (inputs plus a prioritised subset of object state, with both sides simulating) is "approximate and lossy". Fiedler kept the player's own object at top priority and objects that are interacting at high priority. ([Fiedler, *State Synchronization*](https://gafferongames.com/post/state_synchronization/))
- **Engines** ([Photon Fusion intro](https://doc.photonengine.com/fusion/v1/fusion-intro)):
  - In Host mode, "the session is owned by the host and will be lost if the host disconnects". Host migration exists but "requires special handling in client code".
  - Server and Host modes give the server "full and exclusive State Authority over all objects".
  - Shared mode, where each client owns its objects, has no "lag compensation, prediction and rollback".
- **Godot** makes peer 1 the server and authority by default. Its docs describe no host migration: the example lobby just tears down on `server_disconnected`. ([Godot high-level multiplayer](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html))

### Lockstep and rollback (model c)

- **Lockstep latency:** "each player in the game has latency equal to the most lagged player". Late join is uncommon "due to the difficulty of capturing and transmitting a completely deterministic starting point". ([Fiedler, *What every programmer…*](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/))
- **Input traffic is tiny:** a 6-bit input, with every unacked input re-sent in each packet, costs about 90 bytes per packet at worst. Over TCP, a lost packet stalls play for "RTT*2", giving visible hitches at 100 ms and 1% loss. ([Fiedler, *Deterministic Lockstep*](https://gafferongames.com/post/deterministic_lockstep/))
- **Determinism is "yes, if…":** you need the same compiler and instruction set and restricted float operations. Trig functions differed between AMD and Intel. ([Fiedler, *Floating Point Determinism*](https://gafferongames.com/post/floating_point_determinism/))
- **Rollback (GGPO):** the game guesses missing remote inputs and, when they arrive, "re-simulate[s] from the point of divergence". The game must provide save state, load state and a step that does not render. Lockstep without rollback "often results in sluggish, unresponsive gameplay". ([ggpo.net](https://www.ggpo.net/))
- **Photon Quantum** is the commercial version of (c). Inputs go through a server that keeps the clocks, and every client runs the sim with predict/rollback, "never need[ing] to wait for a slower client". It ships its own deterministic math and physics libraries. ([Quantum intro](https://doc.photonengine.com/quantum/current/getting-started/quantum-intro))

### Browser and phone facts that apply to all three models

- **JS float math across engines:**
  - `+ − × ÷` and `Math.sqrt` are exactly specified. `Math.sqrt` returns "𝔽(the square root of ℝ(n))".
  - "acos, … cos, exp, **hypot**, log, **pow**, sin, … is not precisely specified … some latitude is allowed in the choice of approximation algorithms". `**` (Number::exponentiate) "returns an implementation-approximated value". ([ECMA-262 §21.3.2, §6.1.6.1.3](https://tc39.es/ecma262/))
  - Every iPhone browser runs WebKit's JavaScript engine ("Apps that browse the web must use the appropriate WebKit framework and WebKit JavaScript", [App Review Guideline 2.5.6](https://developer.apple.com/app-store/review/guidelines/); EU and Japan have exceptions). Android Chrome runs V8.
  - So an iPhone and an Android phone **may** return different last bits from `Math.hypot` or `**`. I did not test this on devices.
- **Transport:**
  - WebSocket runs over TCP. Fiedler's TCP stall above applies to it, and to 4G loss in particular.
  - A WebRTC DataChannel can be unordered and unreliable (`ordered: false`, `maxRetransmits`). ([MDN createDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel))
  - Behind symmetric NAT, common on mobile carriers, WebRTC needs a TURN server "relaying all information through that server". ([MDN WebRTC protocols](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols))
- **Background tabs:** Chrome throttles timers in a hidden page to once per second. After 5 minutes hidden, silent, and without WebRTC, it throttles to once per minute. ([Chrome timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)) **If a Host or lockstep peer gets a call, or a player switches apps, their sim stops.**
- **Cloudflare relay budget (Durable Objects on Workers Free):**
  - Only SQLite-backed Durable Objects are allowed. Limits are 100,000 requests/day and 13,000 GB-s/day; past a limit, calls "fail with an error".
  - Incoming WebSocket messages count 20:1 "for compute requests billing-only". Idle Durable Objects that can hibernate are not billed for duration. ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/))
  - The page does not say whether the 20:1 ratio also applies to the Free plan's 100K/day cap. That needs a test deploy, as in [#116](https://github.com/Seif-Sallam/Wobbly-Mart/issues/116).

---

## 2. Our sim, checked

### Determinism hazards in `src/sim/` (for model c)

| Check | Finding | Risk for lockstep |
|---|---|---|
| `Math.random` / `Date` / `performance` | None in `src/sim/` (grep found nothing). ESLint already bans them. | none |
| Fixed step | `DT = 1 / TUNING.tickRate` (60) in `world.ts`. `game.ts:81` uses an accumulator with `MAX_STEPS_PER_FRAME`. | none |
| RNG | mulberry32 using `Math.imul` and `>>>`, all integer math. Three separate streams (`rng`, `eventRng`, `challengeRng`) live in `World` (`rng.ts`, `world.ts`). | none: exact on every engine |
| Iteration order | `Map`/`Set` iterate in insertion order per spec, and `Array.prototype.sort` is stable. `sort` is used in `staff.ts`, `robbery.ts`, `events.ts` and `rng.ts`; ties keep insertion order. | low, as long as every peer inserts in the same order (same inputs, same order) |
| `Math.hypot` | About 30 non-test calls (with `Math.sqrt`) across `player.ts`, `walk.ts`, `carry.ts`, `cleaning.ts`, `customers.ts`, `inspector.ts`, `robbery.ts`, `nav.ts` and `geometry.ts`. Used for distances, thresholds (`< ARRIVE`, `> catchRadius`) and normalising movement. | **real**: implementation-approximated. A one-ulp difference at a threshold flips a branch and the peers desync. Fix by replacing it with `Math.sqrt(dx*dx + dz*dz)`, which is exact. |
| `**` | `carry.ts:148` `k ** T.curve` decides whether a Stack tips (compared against `nextRandom`). `economy.ts:233` sets the customer cap. `rng.ts:30` `weightedShuffle`. | **real**: the tipping roll is a direct desync path. Replace with integer powers or a lookup table. |
| `Math.sin/cos` | `geometry.ts:27` is wrapped in `Math.round`, so it is safe. `bot.ts:104` is bot-only. | none / bot only |
| `Float32Array` | Nav distance fields (`nav.ts`). The values come from `Math.hypot` (`walk.ts:98`) and `**` (`nav.ts:91`) and are then rounded to f32. | inherits the hypot/`**` risk |
| Physics | There is no physics engine. Movement is kinematic: speed ramp plus box push-out (`player.ts`, `geometry.ts`). Shove launches and flying Loose Items do not exist yet. | Brawl physics will be new code we own. Written with only `+−×÷` and `sqrt`, it would be deterministic. |
| Single player | `World.player` is one `Player`. `Intents` has one `move` with raw float components. | Every model needs `players[]`, and inputs need quantising (e.g. 8-bit direction and buttons) before they travel. |

**Verdict for (c):** the sim is deterministic on one engine. It is **not yet** guaranteed deterministic between iPhone (JavaScriptCore) and Android (V8), because of `Math.hypot` and `**`. The fix is mechanical: write a `dist()` helper on `sqrt`, replace `**` with integer powers or tables, and add a per-tick checksum. After that, every future change to `sim/` has to keep the rule, so ESLint should ban `Math.hypot`, `**` and trig in `sim/`. Rollback also needs a cheap save/load of `World`. `nav.fields` (a `Map` of `Float32Array`) is derived from the layout, so it can be rebuilt instead of copied.

### Snapshot size (models a and b)

Measured by running `createWorld(cornerShop, null, 42)` with the `Bot` for 40 sim minutes (tsx, desktop). At peak, the store held 28 Stations, 10 Customers, 3 Stockers and 1 Mess:

- **JSON of the dynamic state:** 10,041 bytes peak. One Customer is about 436 B (full-precision floats, lists, ids) and the Player about 315 B. The whole Corner Shop is bigger than a compact brawl Map will be.
- **Sim cost:** 0.059 ms per step on desktop, so 60 Hz uses under 0.4% of a frame. A phone Host has plenty of headroom even if it is 10× slower.

A quantised binary estimate for a compact Map, using Fiedler-style quantisation (positions at 16 bits per axis, ~1 mm over 64 m):

| Entity (compact Map, worst case: Rush) | Count | Bytes each | Bytes |
|---|---|---|---|
| Player (pos, vel, 8-item Stack, stun/shove/knockout timers, flags) | 4 | ~16 | 64 |
| Customer (pos, vel, state, list ≤ 4 lines, cart, patience, flags) | 17 (7 + Rush 10) | ~22 | 375 |
| Station (Shelf count / Producer tray, inputs, work / Register cash, queue) | 12 | ~4 | 50 |
| Loose Item while flying (pos, height, vel, product) | 20 | ~11 | 220 |
| Mess, Thief/Inspector, Deliveries | — | — | ~70 |
| Globals (tick, team pot, 4 × Tips, Twist, Scenario progress, 3 RNG states) | — | — | ~40 |
| **Full snapshot** | | | **~0.8 KB** |

A render-only snapshot (no Customer lists, no RNG) is about 0.5 KB. With deltas against the last acked snapshot (Source's method), a typical tick is probably 100–300 B, but this was not measured.

### Bandwidth per player

| | Down per guest | Up per guest | Host up |
|---|---|---|---|
| (a)/(b) at 20 snapshots/s, full | 0.8 KB × 20 = **16 KB/s (~130 kbit/s)** | inputs at 30/s with redundancy, ~2 KB/s incl. framing | (b) only: one copy to the relay, which fans it out: ~16 KB/s |
| (a)/(b) with deltas | ~2–6 KB/s | same | ~2–6 KB/s |
| (c) lockstep/rollback | 3 peers × ~2 KB/s = ~6 KB/s | ~2 KB/s | — |

Every option fits easily on home Wi-Fi or 4G. Bandwidth does not decide this.

**Relay request budget (Cloudflare Free), one Year ≈ 4 × 6 min + Meetings ≈ 30 min = 1,800 s:**

- (b): 3 guests send inputs at 30/s and the Host sends snapshots at 20/s, so 110 incoming messages/s × 1,800 s ≈ 198K messages, or **≈ 9.9K billed requests per Year at 20:1, about 10 Years/day**.
- (c): 4 × 30/s, roughly the same.
- (a): roughly the same messages. The Durable Object also stays awake running the 60 Hz loop: 0.125 GB × 1,800 s ≈ 225 GB-s per Year, about 57 Years/day against 13,000 GB-s.
- **If the 20:1 ratio does not apply to the Free cap, the cap is about 15 minutes of play per day.** Verify this first. Sending inputs at 20/s or batching both directions cuts it roughly in half.

---

## 3. The three models at ~150 ms RTT

| | (a) Server sim | (b) Host + relay | (c) Lockstep / rollback |
|---|---|---|---|
| Own movement | instant (predicted) | instant (predicted); the Host has 0 ms | plain lockstep: **≥ 150 ms input delay** (relay path = guest→relay→peer ≈ full RTT) plus a jitter buffer. Rollback: instant. |
| Other players / Customers | interpolated, ~75 ms + 100–150 ms buffer behind | same for guests; the Host sees the truth | lockstep: in sync but late. Rollback: predicted, popping when a guess was wrong. |
| Smack hits | decided by the server. Without rewind, a guest's smack on a moving rival lands about ½ RTT + buffer later than it looked. With Source-style rewind, it hits what the attacker saw. | same, decided on the Host. The Host player has the edge (acceptable among friends). | identical on all peers. Under rollback, a hit can appear and then un-happen (a rollback pop). |
| Being shoved (victim's view) | an unpredicted external event: the correction pops or is smoothed | same | lockstep: smooth but late. Rollback: pops. |
| Physics / Loose Items | runs only on the server; clients interpolate | runs only on the Host | must be bit-identical everywhere |
| Determinism needed | no | no | **yes, across V8 and JavaScriptCore** (see §2) |
| Authority leaving | the server never leaves. A player who drops is the spec's "Alex has quit". | **Host leaving.** End the room, or migrate: promote a guest from the last full keyframe, which works if the Host sends full state (RNG, lists) about once a second. The game rewinds ≤ 1 s. | no Host. A peer leaving just stops sending inputs. Rejoin still needs a full state transfer. |
| Phone goes to the background | only that player freezes | **the Host's sim throttles to 1 Hz: everyone freezes** unless authority moves | lockstep: everyone stalls. Rollback: everyone else runs on predictions of that player. |
| Rejoin ("Alex has been rehired") | send a full snapshot (~0.8 KB) | same | send a full state with RNG and ticks (same size), then resume in lockstep |
| Cheating | none from clients | the Host can do anything (acceptable) | any peer can see everything and fake inputs. Desync stays detectable. |
| Infra cost | sim in a Durable Object: an awake loop and duration billing. Whether a DO can tick at 60 Hz cheaply is unverified. | dumb relay: the cheapest server | dumb relay |
| Code cost | the sim runs on Workers (pure TS, no DOM, so it should run). Build: a server loop, snapshots, prediction, interpolation. | the same client code as (a), minus the server loop, plus migration if wanted | `players[]`, quantised inputs, removing hypot/`**`, save/load/resim, checksums, and a desync recovery path |

---

## 4. Lean (for #136 to decide)

**Lean: (b) Host + relay, with snapshots and own-player prediction.** Keep (a) in reserve: it is the same client code with the sim moved into the Durable Object, if Host leaving or backgrounding hurts in playtests. Do not pick (c).

- **Why not (c):**
  - Plain lockstep puts ≥ 150 ms on every move, which suits RTS games, not a brawler.
  - Rollback fixes that, but cross-engine float determinism, the GGPO-style save/load/resim, and keeping `sim/` free of hypot/`**`/trig forever all cost a lot. The spec's rejoin and Bankruptcy-mid-Year still need full-state transfer anyway.
  - Its main win, tiny bandwidth, does not matter at ~1 KB snapshots.
- **Why (b) over (a):**
  - Server cost is a dumb relay.
  - The sim runs on a phone unchanged, at < 0.5% of a frame.
  - Host advantage and Host cheating are acceptable among friends.
  - Moving to (a) later reuses the whole client side.
- **What (b) must answer (questions for #136):**
  1. **Host leaving:** end the room, or migrate from a once-per-second full keyframe?
  2. **Host backgrounded:** pause for everyone with "Seif is on a call", or hand authority to a guest?
  3. Smack hit rule: Host-time (simple, favours the Host and the victim) or Source-style rewind (favours the attacker, more code)?
  4. Transport: WebSocket-only through a Durable Object (simple, but TCP stalls on 4G loss), or WebRTC unreliable DataChannels (needs TURN on carrier NAT)?
  5. Verify the Cloudflare Free 20:1 WebSocket ratio before relying on ~10 Years/day.
