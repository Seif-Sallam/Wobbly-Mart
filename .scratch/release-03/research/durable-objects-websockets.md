# Cloudflare Durable Objects and WebSockets for live rooms

Research for issue #125 (map #124). This note builds on #116 (`.scratch/release-03-leaderboard/research/cloudflare-free-tier.md` on `research/cloudflare-free-tier`) and does not repeat it. All sources are on developers.cloudflare.com and were read on **2026-10-30**. Cloudflare changes these numbers, so re-check them before launch.

## Headline

- **Durable Objects are on Workers Free** (since 2025-04-07), but only with the **SQLite storage backend**.
- The Free limits are **100,000 DO requests/day** and **13,000 GB-s duration/day**. Both reset at 00:00 UTC. Over a limit, "further operations of that type fail with an error", so a live room can die mid-session.
- **Incoming WebSocket messages bill at 20:1** (20 messages = 1 request). **Outgoing messages are free.** Protocol pings and `setWebSocketAutoResponse` replies are free.
- **Requests are the binding limit, not duration.** A 4-player room at 25 frames/s each for 30 min costs about **9,000 requests** and **225 GB-s**. That is about **11 rooms/day** on Free (9 at 30/s, 13 at 20/s).
- **Hibernation saves nothing for a live room.** An object hibernates only after 10 s with no events. A room taking ~100 frames/s never gets there, so it bills wall-clock for the whole session. Hibernation helps only lobbies and paused rooms.
- A room is addressed by name: `env.ROOM.getByName(code)` or `idFromName(code)`. The first use of a name can take "up to a few hundred milliseconds" for a global check.
- The object is placed **near the first `get()`** and **never moves**. `locationHint` is best effort and applies only to the first `get()`. The `me` (Middle East) hint does not spawn in that region.
- `wrangler dev` **always runs Durable Objects locally** (remote DOs are not supported in dev). So the two-tabs dev path works offline.

## Free plan availability and limits

Sources: https://developers.cloudflare.com/durable-objects/platform/pricing/, https://developers.cloudflare.com/durable-objects/platform/limits/, https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier/

| Limit | Free | Paid |
|---|---|---|
| Requests | 100,000 / day | 1M / month incl., then $0.15 / M |
| Duration | 13,000 GB-s / day | 400,000 GB-s / month incl., then $12.50 / M GB-s |
| SQLite rows read / written | 5M / 100K per day | 25B / 50M per month incl. |
| SQLite stored data | 5 GB total | 5 GB-month incl., then $0.20 / GB-month |
| Storage per object (SQLite) | 1 GB (per FAQ) | 10 GB |
| Storage backend | SQLite only | SQLite; key-value only for existing namespaces |
| Classes per account | 100 | 500 |
| Objects | unlimited | unlimited |
| CPU per request | 30 s default; each HTTP request or WebSocket message resets it | same, configurable up to 5 min with `limits.cpu_ms` |
| Requests per second per object | 1,000 (soft); beyond queue capacity returns "overloaded" | same |
| WebSocket message size (received) | 32 MiB | 32 MiB |
| Hibernatable WebSockets per object | 32,768 | 32,768 |

How billing works (pricing page):

- **One request opens a WebSocket connection.** The Worker that forwards the upgrade also bills one Workers request (#116). The pricing page lists DO requests as their own dimension and says its examples "exclude the costs for the Workers calling the Durable Objects". It does not say outright whether the two 100K/day pools are shared. Treat them as separate but budget conservatively.
- **Incoming messages bill at 20:1.** For example, 100 incoming messages are charged as 5 requests. The ratio does not change metrics. The footnote has no plan qualifier, so it is assumed to apply on Free too. That is **not explicitly stated** for Free.
- **Outgoing messages are not charged.** Incoming protocol pings are not charged.
- **Duration is wall-clock time** "as long as the Object is active and not eligible for hibernation". It is billed at **128 MB per object** whatever memory is used, so 1 s costs 0.125 GB-s.
- Calling `ws.accept()` (standard API) bills duration for the whole connection. Use `ctx.acceptWebSocket()` (Hibernation API) instead.
- "Code updates disconnect all WebSockets" (WebSockets best-practices page), so a deploy kills every live room.

## Budget: a 4-player, 30-minute room

Assumptions: 4 players, each sending *f* frames/s to the object for 1,800 s. Every frame a player sends is **incoming** to the DO. The DO's fan-out to the other players is outgoing, so it is free.

| f (frames/s per player) | Incoming frames | Billed requests (÷20, + ~4 connects) | Duration (always active) | Free rooms/day by requests | by duration |
|---|---|---|---|---|---|
| 20 | 144,000 | ~7,200 | 1,800 s × 0.125 = 225 GB-s | **13** | 57 |
| 25 | 180,000 | ~9,000 | 225 GB-s | **11** | 57 |
| 30 | 216,000 | ~10,800 | 225 GB-s | **9** | 57 |

- **Requests bind first**, at about 10 rooms/day. Duration alone would allow about 57.
- **The lever is frames sent, not logical messages.** Cloudflare's WebSocket guide recommends batching 10–100 logical messages into one frame. Sending inputs only on change, or Guests at 10 Hz, scales the room count directly. For example, the Host at 20 Hz plus 3 Guests at 10 Hz is 50 frames/s. That gives 4,500 requests per room and **~22 rooms/day**.
- **Paid ($5/month minimum):** one such room costs about $0.0014 in requests and $0.0028 in duration beyond the included amounts. The included 1M requests and 400K GB-s cover about 110 rooms/month by requests, or about 1,770 by duration.
- **Hitting the daily cap is a hard failure.** Further requests fail until 00:00 UTC. The room client needs a "server busy, try later" path, and should probably refuse to start a room late in a day that is near the cap.

## WebSocket Hibernation API

Sources: https://developers.cloudflare.com/durable-objects/best-practices/websockets/, https://developers.cloudflare.com/durable-objects/api/state/, https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/

- `this.ctx.acceptWebSocket(ws, tags?)` accepts a socket that survives hibernation. A socket can have up to 10 tags of up to 256 chars each. Events arrive at class methods (`webSocketMessage`, `webSocketClose`, …). `ctx.getWebSockets(tag?)` lists open sockets.
- `ws.serializeAttachment(value)` keeps up to **16,384 bytes** per connection across hibernation, and `deserializeAttachment()` reads it back. Use it for player slot or role.
- `ctx.setWebSocketAutoResponse(req, res)` answers an app-level ping without waking the object and without billing duration. Request and response are capped at 2,048 chars each.
- Lifecycle: an object can hibernate after **10 s of inactivity** once it is hibernation-eligible. A non-hibernateable idle object is evicted after 70–140 s. On wake, "in-memory state is reset" and the constructor runs again.
- An object is eligible only when all of these hold: no `setTimeout`/`setInterval` is pending, no unfinished I/O or `waitUntil`, no open outbound connection, the standard WebSocket API is not in use, and no event is in flight.
- What it saves for us: **nothing during play** at 20–30 frames/s. It does save the cost of lobbies waiting for players, paused rooms, and players idling between rounds.
- A **server-sim** room (the DO ticking the 60 Hz sim with `setInterval`) can never hibernate while the room is open. It bills wall-clock for as long as the room exists, including idle time, until the timer stops.

## Placement and location hints

Source: https://developers.cloudflare.com/durable-objects/reference/data-location/

- By default, an object is created "in a data center close to where the initial `get()` request is made". In practice that is the first player to open the link, normally the Host.
- "Durable Objects do not currently change locations after they are created." Moving objects is planned for the future.
- The `locationHint` values are `wnam`, `enam`, `sam`, `weur`, `eeur`, `apac`, `apac-ne`, `apac-se`, `oc`, `afr` and `me`.
- Hints are "best effort and not a guarantee". "Only the first call to `get()` for a particular Object will respect the hint."
- For `sam`, `afr` and `me`, the object is spawned in a nearby supported location instead. Players in the Middle East or Africa get a relay in another region, with the extra round trip that adds.
- Jurisdictions (`eu`, `us`, `fedramp`) are enforced, unlike hints. We don't need them.

## Addressing a room by link

Source: https://developers.cloudflare.com/durable-objects/api/namespace/

- `env.ROOM.getByName(code)` returns a stub straight away. It is the same as `env.ROOM.get(env.ROOM.idFromName(code))`. The same name always reaches the same object, so a room code in the URL (`?room=ABCD`) is the whole addressing scheme.
- Name-derived ids need a global existence check on first use, and "this round-the-world check can take up to a few hundred milliseconds". After that the location is cached.
- `newUniqueId()` skips that check, so first use is faster. Its id string is long and must be stored or shared, which makes it a poor fit for short, human-typed room codes.
- The object is created lazily on the first request through the stub. Use `get(id, { locationHint })` when we want a hint.
- Free has unlimited objects, so a one-off room per session costs nothing extra. An empty SQLite object costs no storage.

## Local development (two tabs)

Sources: https://developers.cloudflare.com/workers/development-testing/, https://developers.cloudflare.com/workers/wrangler/commands/workers/, https://developers.cloudflare.com/durable-objects/get-started/

- `wrangler dev` simulates every binding locally. For Durable Objects: "Enabling remote connections for Durable Objects may be supported in the future, but currently will always run locally." Two browser tabs pointed at `localhost:8787` reach the same local DO, with no Cloudflare account or quota needed.
- `--ip` defaults to `localhost`. To test from a phone on the LAN, set `--ip 0.0.0.0`. `--persist-to <dir>` sets where local state goes (the docs don't name a default). `--local` forces every binding local.
- Config: the current get-started guide declares DO classes in an `exports` field, e.g. `"Room": { "type": "durable-object", "storage": "sqlite" }`, plus a `durable_objects` binding (`name`, `class_name`). Older projects use the legacy `migrations` array (`new_sqlite_classes`). Free needs `"storage": "sqlite"`.

## What this means for Host-relay vs server-sim vs lockstep

- **Host-relay:** the Host uploads snapshots (incoming, billed) and the DO fans them out (free). Guests upload inputs (billed). The cost is the sum of all uploads. The DO code is tiny and far inside the 30 s per-message CPU budget, and it never touches the sim. Snapshot size is not a constraint, since received messages can be up to 32 MiB. The cost lever is the Host's snapshot rate plus batching.
- **Server-sim:** only inputs are incoming, and the snapshot broadcast is outgoing and free. So it has **fewer billed requests** than Host-relay for the same tick rate. However, `setInterval` blocks hibernation, so the room bills duration from open to close. Its 60 Hz CPU also runs in a 128 MB isolate, and a deploy restarts every room mid-game. The docs do not say how the 30 s CPU budget applies to timer callbacks outside a request. Verify that before choosing this model.
- **Lockstep:** every player sends inputs each tick, all incoming. The cost matches Host-relay's Guest traffic for every player, with no snapshot upload. It is similar to server-sim on requests, but the DO stays a dumb relay.
- In all three models, **frames per second sent to the DO is the only number that moves the Free budget.** Duration is fixed at 225 GB-s per 30-minute room, so it is never the bottleneck under about 57 rooms/day.
