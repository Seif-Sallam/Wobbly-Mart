# Wobbly Mart — online features spec (release-03-leaderboard)

Assembled 2026-11-02 from the map [Wayfinder: online features — Boards, Daily Shift, cloud save](https://github.com/Seif-Sallam/Wobbly-Mart/issues/114) and every closed ticket under it. Each section links the ticket that holds the full reasoning. Words follow `CONTEXT.md` (its **Online** section lands with this spec).

Build happens in small playable PRs into `release-03-leaderboard` (§14). Nothing here is left to decide; numbers marked *tune* are play-testing knobs, not decisions.

## 1. Scope

In: a Cloudflare Worker + D1 backend; **Devices** with **Cloud Codes** and **Nicknames**; the **Speedrun Board**, **Score Board**, **Daily Board** and **Streak Board**; the **Daily Shift** on a generated Map with **Replays**; cloud save; the **Wall of Fame** UI; privacy notice, Delete and retention.

Out (parked, also in project memory): ghost race from a Replay, Mutators after 100% with their own Boards, Rush Hour Event, Critic Customer (VIP), combo multiplier, star goals per Map, cosmetics bought with Score, a 5th Map with a twist, Favourite Daily Shifts, an offline Replay verification script.

## 2. Ground rules

- The game plays fully offline and with the backend down, as storage failures do today. Unset `VITE_API_URL` ⇒ every online feature hidden.
- Network code lives in `src/app/`; `src/sim/` stays pure. No new runtime deps: `fetch`, `CompressionStream`, `DecompressionStream`, `crypto` only.
- Security is deliberately light: sanity checks + rate limits, not anti-cheat. The Worker never re-sims anything.
- Never run anything against a deployed Worker or D1 from a session; produce the commands.
- `?debug` and its cheats are stripped from deployed builds on `main`; they stay in dev.
- The Tutorial Map has no Boards.

## 3. Backend home and deploy — [Worker home and deploy](https://github.com/Seif-Sallam/Wobbly-Mart/issues/117), [Staging isolation](https://github.com/Seif-Sallam/Wobbly-Mart/issues/140), [Cloudflare free tier](https://github.com/Seif-Sallam/Wobbly-Mart/issues/116)

- **Code**: `worker/` in this repo with its own `wrangler.toml`; `wrangler` and `@cloudflare/workers-types` are devDependencies. The Worker may import `catalog/`, `maps/` and pure `src/sim/` (caps, Map ids, `SIM_VERSION`, the Daily generator stay single-source), never `app`/`view`/`ui` (ESLint boundary). Request/response types in `worker/api.ts`, imported type-only by `src/app/`.
- **Environments**, each with its own three D1 databases (§6):
  - **local**: `wrangler dev --ip 0.0.0.0`, local D1 (Miniflare), reachable from a phone on the LAN.
  - **staging**: on a **separate free Cloudflare account** (its traffic can't spend production's per-account quota). CI deploys on every push to `release-03-leaderboard`.
  - **production**: CI deploys on every push to `main`, after the release gate.
- **Host**: `workers.dev` for both. A custom domain (Free WAF rate-limit rule, Cache API, `workers_dev = false`) is an additive move only if abuse shows up.
- **Config**: `preview_urls = false` everywhere. Workers Logs on (the gate checks no `Authorization` header is logged). Cron trigger once a day (§9).
- **CORS** (manual, in the router): allow-list per environment in `wrangler.toml` `[vars]`. Production: exactly `https://seif-sallam.github.io`. Staging and local: `http://localhost:<any>` and private LAN IPs (`192.168.*`, `10.*`). Never reflect an unlisted `Origin`; `Vary: Origin`; no `Allow-Credentials`; preflight `Access-Control-Max-Age: 86400`.
- **Client URL**: build variable `VITE_API_URL`; dev defaults to `http://<page host>:8787`; CI sets staging/production URLs from GitHub repository variables.
- **Secrets**: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` only in GitHub Environments `worker-staging` / `worker-production`, each restricted to its branch; staging's are the second account's. Token scope: Workers Scripts Edit + D1 Read (CI never migrates). Secrets are never committed, logged, echoed, put in `wrangler.toml`, a PR, an issue or a chat. Deploy via `cloudflare/wrangler-action@v4`. Third-party Actions pinned to a commit SHA; CI uses `npm ci`; Dependabot alerts on.
- **Migrations**: `worker/migrations/<db>/NNNN_name.sql`, additive only, copied into the PR description. The owner applies them: `npx wrangler d1 migrations apply <db> --remote --env <staging|production>`, staging before the merge into `release-03-leaderboard`, production before the release merge to `main`.
- **Setup checklist**: the first Worker PR ships a `/wizard` for the owner: both Cloudflare accounts, the six D1 databases, the rate-limit namespaces, the GitHub Environments and variables.
- **Game page**: stays on `seif-sallam.github.io/Wobbly-Mart/`. Standing rule: the owner's other Pages sites on that origin load no third-party scripts. The game page gets a CSP `<meta>`: `default-src 'self'; connect-src 'self' <API URL>; script-src 'self'`, no inline scripts.

## 4. Device, Cloud Code, Nickname — [Device identity and Nicknames](https://github.com/Seif-Sallam/Wobbly-Mart/issues/118)

- **Identity is one secret.** The Cloud Code, e.g. `WBLY-7F3K-9QXM-2RTA`: Crockford base32, ~80 random bits from `crypto.getRandomValues`. The client keeps it in `localStorage` key `wobbly-mart.device` and sends it as `Authorization: Bearer …`. The Worker stores only its SHA-256 hash; no public Device id exists anywhere. Never in a URL, query string, log or error body.
- **Made lazily** on the first online write (Nickname before a first submit, or turning on cloud save), after the privacy Accept (§11). Reading Boards needs no Device. No "login" wording anywhere. Save Code copy/paste stays as today.
- **Another browser**: entering the Cloud Code makes it the same Device; the cloud save restore choice follows (§10). Lost code + wiped storage ⇒ a new Device; old rows stay under the old Nickname.
- **Rotate**: Settings → New Cloud Code → confirm ⇒ `POST /v1/device/rotate`; the old code dies at once.
- **Nicknames**: typed, with 🎲 suggesting adjective + game noun, pre-filled. 3–16 chars of ASCII letters, digits, space, `_`, `-`; trimmed, inner spaces collapsed. Not unique; changeable any time; shows on all the Device's rows. Hint line "No real names" (real names still accepted; owner-accepted risk, in the DPIA).
- **Blocklist**, Worker only: normalise (lowercase, strip spaces/symbols, leetspeak `0→o 1→i 3→e 4→a 5→s 7→t @→a $→s`), refuse if any listed word is a substring. List = LDNOOBW (CC-BY 4.0, credited in `CREDITS.md`) + owner additions + reserved names (`admin`, `wobblymart`, `seif`, `mod`, …). Refusal ⇒ inline "That name isn't allowed, try another".
- **Bad name slips through** — owner runs by hand (on the Board DB of the environment):

```sql
UPDATE `device` SET `nickname` = 'Wobbly Cashier' WHERE `nickname` = ?;  -- bind the bad name; add the word to the list in worker/
```

## 5. Runs, Scores, Daily Shifts — [Replay](https://github.com/Seif-Sallam/Wobbly-Mart/issues/115), [Daily Shift rules](https://github.com/Seif-Sallam/Wobbly-Mart/issues/119), [Daily Map generator](https://github.com/Seif-Sallam/Wobbly-Mart/issues/138)

### 5.1 `SIM_VERSION`

A manual integer in `src/sim/`. A Vitest golden run (bot, fixed seed, a few sim minutes) fingerprints the World; any sim behaviour change fails CI until `SIM_VERSION` is bumped and the fingerprint refreshed. The Daily generator is part of it. Every Board row stores `sim_version`; Speedrun and Score Boards show only the current one (older rows kept, hidden). A submit with another version ⇒ 409 `update` ⇒ "A new version is out · Reload".

### 5.2 Run (Speedrun Board)

- One continuous attempt from a fresh save of one non-Tutorial Map to 100% Completion. Time = **sim ticks only**, across all Openings: anything that stops the sim (pause menu, popups, outside fullscreen) doesn't count; Closed time does.
- Ticks and a `runValid` flag live in the save per Map, so a Run survives reloads and cloud restores. A **Save Code import voids** the Run of every Map it carries. A fresh save of the Map starts a new Run.
- Submitted at 100% Completion: `{map, ticks, simVersion}`. No Replay. Floor: the Map's `speedrunFloorTicks` (map data = bot runs × 0.5).
- End of Run screen: big time, Map + Openings pills, rank count-up "of N", Around you; "🏅 See the Wall", "Keep playing".

### 5.3 Score (Score Board)

Submitted at each Opening end: `{score, playTime, simVersion}`. The row keeps the latest (Score only goes up). Cap = `fixedMax(map)` (all Objectives + 4 quarters) + `playTime × maxRate` (fastest the repeating sources pay under `TUNING`); both computed from `catalog/`/`maps/`/`tuning.ts`. `playTime` may not go below the stored one, may not grow more than `(now − stored.updated_at) × 1.1 + 60 s`, and a first submit's `playTime ≤ now − RELEASE_LAUNCH_DATE` (constant in `worker/`).

### 5.4 Daily Shift (Daily Board)

- **Day**: UTC date; day number from a launch date; seed = FNV-1a of the date string. The client computes it alone, so a Shift is playable offline (unranked until posted, §12). The Worker accepts day D until 00:15 UTC on D+1.
- **World**: its own, never touches the save. Open to every player whatever their save has reached.
- **Map**: generated from the seed by a pure generator in `src/sim/` (from `prototype/daily-map`, never merged):
  - Variants picked by the seed: **Slabs** (2–3 Areas, one random Chain per Area from the whole Catalog, up to 4 Producers, a second Chain if the first is tiny) and **Kit** (one packed Area, two Chains).
  - Block engine: each Area = shop block (22 m) + farm yard (26 m) behind it, in a local frame turned N/S/W/E. Walls (north/west tall, south/east low), customer doors, Back Doors, side doors where a shop meets another Area's yard, open sides between shops, the Street strip outside every shop front (joined edge to edge), road and Car Spots beside Area 1's yard, the Van — all derived from block placement.
  - Slabs formats, equal weight: **Row**, **Column**, **Corner**, **Split street** (the Street between the rows is Area 1 ground), **Courtyard**.
  - Interiors per shop block: Aisles, Wall market, Vertical aisles or Staggered. Area 1 keeps the Corner Shop's Register, Office and Mop Stand corner. Producers packed into the yard by a 0.5 m scan keeping 1.6 m clear.
  - Random Props: trees/bushes on grass, pots/coolers in shop corners, flowers in yards.
  - A day failing a check rerolls on a derived seed (deterministic).
- **Opening**: Area 1 plus 35–55% of the Pad chain bought (never past Area 1), $40. Exactly one Stocker Pad and one Cashier Pad; Stockers never pre-bought. **No Edit Layout and no Closed** (a real MapDef switch).
- **Goal**: 1–3 parts from the existing Objective kinds (Buy a Pad, Earn $X, Sell N of a Product, Fill N Deliveries); the Shift ends when all are done. Sized to ~10 min: the bot plays the day for `targetMinutes × botPace` (*tune*), each part = what it reached, rounded down; Buy-a-Pad only if bought after 75% of the target.
- **Calendar file**: CI bot-calibrates the next 365 days and commits each day's goal + **Daily floor** (min plausible ticks). Client and Worker read it; the Map itself is still generated from the seed.
- **CI proof**: for the next 365 days, validator + reachability (every Station reachable by the Player with all bought; every Shelf and Register by Customers) + bot to goal. ~5 min across 12 processes.
- **Ranking**: fastest ticks to the goal; Score and Money as columns. Ticks only, so pausing is fine. After the goal the player may keep playing, unranked.
- **Retries**: unlimited; **Reset** restarts the same seed. Every finished attempt submits; the Board keeps each Device's best of the day.
- **Reload**: the in-progress input log is kept locally; reload re-sims it from the seed at high speed to the exact state, still rankable.
- **HUD**: one chip `📅 <goal> · 32/60 · m:ss.cc · ↺ Reset`; after the goal `✓ Done · for fun now`.
- **End of Shift**: big time, Score and Money pills, rank count-up "of N today", "🔥 N Shifts in a row", Around you; "🏅 See the Wall" (main), "↺ Try again", "Keep playing".

### 5.5 Replay

- Daily Shift only. **Required**: a Shift without a valid ≤ 64 KB Replay gets no Board row (the Streak still updates).
- Intents are quantized before the sim sees them, in every game (one input path): `move` x/z as int8 (−127..127); flags `grab`, `sprint`, `grabPaused`, `manualGrab`; commands `buyUpgrade`, `assign`, `setClosed`. Only changes are logged, as (ticks since last change, changed fields), gzipped with `CompressionStream`. Header: `simVersion`, Map, day, seed, tick count, claimed result.
- CI bot check records a full Shift and fails over 64 KB.
- A failed Replay insert never fails the submit.

### 5.6 Streak (Streak Board)

A day counts when the Device submits a finished Shift that UTC day; a missed day resets it. Kept on `device` (`streak_current`, `streak_best`, `streak_last_day`), updated by the Worker on each Shift submit, never a client claim. The Streak Board ranks `streak_best`, each row also showing the current 🔥. No notifications or loss nags anywhere.

## 6. D1 schema — [Board API and D1 schema](https://github.com/Seif-Sallam/Wobbly-Mart/issues/121), [Harden the Board API](https://github.com/Seif-Sallam/Wobbly-Mart/issues/139)

Three databases per environment: **Board DB** (`wobbly_board`), **Replay DB** (`wobbly_replay`), **Save DB** (`wobbly_save`). D1 is SQLite: no schema qualifier and no `ENGINE` clause; identifiers are backticked. Apply in this order, staging then production:

```sql
-- wobbly_board: worker/migrations/board/0001_init.sql
CREATE TABLE `device` (
    `id_device`        INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    `token_hash`       BLOB     NOT NULL,
    `nickname`         TEXT     NOT NULL,
    `streak_current`   INTEGER  NOT NULL DEFAULT 0,
    `streak_best`      INTEGER  NOT NULL DEFAULT 0,
    `streak_last_day`  INTEGER  NULL,
    `created_at`       INTEGER  NOT NULL,
    `last_seen_at`     INTEGER  NOT NULL
);
CREATE UNIQUE INDEX `device_token_hash` ON `device` (`token_hash`);
CREATE INDEX `device_streak_best` ON `device` (`streak_best`);
CREATE INDEX `device_last_seen_at` ON `device` (`last_seen_at`);

CREATE TABLE `board_entry` (
    `kind`         TEXT     NOT NULL,  -- 'speed' | 'score' | 'daily'
    `map`          TEXT     NOT NULL,
    `day`          INTEGER  NOT NULL DEFAULT 0,  -- day number; 0 unless kind = 'daily'
    `sim_version`  INTEGER  NOT NULL,
    `id_device`    INTEGER  NOT NULL,
    `ticks`        INTEGER  NULL,
    `score`        INTEGER  NULL,
    `money`        INTEGER  NULL,
    `play_time`    INTEGER  NULL,
    `updated_at`   INTEGER  NOT NULL,
    PRIMARY KEY (`kind`, `map`, `day`, `sim_version`, `id_device`)
);
CREATE INDEX `board_entry_ticks` ON `board_entry` (`kind`, `map`, `day`, `sim_version`, `ticks`);
CREATE INDEX `board_entry_score` ON `board_entry` (`kind`, `map`, `day`, `sim_version`, `score`);
CREATE INDEX `board_entry_device` ON `board_entry` (`id_device`);

CREATE TABLE `quota` (
    `day`    INTEGER  NOT NULL PRIMARY KEY,  -- UTC day number
    `count`  INTEGER  NOT NULL
);

-- wobbly_replay: worker/migrations/replay/0001_init.sql
CREATE TABLE `replay` (
    `day`        INTEGER  NOT NULL,
    `id_device`  INTEGER  NOT NULL,
    `ticks`      INTEGER  NOT NULL,
    `data`       BLOB     NOT NULL,  -- gzipped Replay, <= 64 KB
    PRIMARY KEY (`day`, `id_device`)
);
CREATE INDEX `replay_day_ticks` ON `replay` (`day`, `ticks`);
CREATE INDEX `replay_device` ON `replay` (`id_device`);

-- wobbly_save: worker/migrations/save/0001_init.sql
CREATE TABLE `device_save` (
    `id_device`  INTEGER  NOT NULL PRIMARY KEY,
    `save_code`  BLOB     NOT NULL,  -- gzipped by the client
    `save_at`    INTEGER  NOT NULL
);
```

No seed rows, no backfill. Times are Unix seconds UTC.

## 7. API — `/v1`, JSON only

Bearer = Cloud Code. Types in `worker/api.ts`. **No row id, `id_device` or `token_hash` ever appears in a URL, response or error.** Public identifiers are only Map ids, `kind`, `day`.

| Route | Body → response | Body cap |
|---|---|---|
| `POST /v1/device` | `{nickname}` → `{cloudCode}` (returned once) | 2 KB |
| `GET /v1/device` (bearer) | → `{nickname, cloudSaveAt?}` (checks a typed Cloud Code) | — |
| `PUT /v1/device/nickname` | `{nickname}` → 204 | 2 KB |
| `POST /v1/device/rotate` | → `{cloudCode}` | — |
| `DELETE /v1/device` | → 204 | — |
| `POST /v1/runs` | `{map, ticks, simVersion}` → `{rank, total, improved}` | 2 KB |
| `POST /v1/shifts` | `{day, ticks, score, money, simVersion, replay}` (base64 gzip) → `{rank, total, improved, streak}` | 96 KB |
| `PUT /v1/scores/:map` | `{score, playTime, simVersion}` → `{rank, total, improved}` | 2 KB |
| `GET /v1/boards/:kind/:map?day=` | `kind` = `speed\|score\|daily\|streak` (`map` = `-` for streak), bearer optional → `{top: Row[≤50], you?: {rank, around: Row[≤5]}, total}` | — |
| `PUT /v1/save` | `{saveCode}` → 204 | save cap |
| `GET /v1/save` | → `{saveCode, saveAt}` | — |

- `Row` = `{rank, nickname, value, score?, money?, you?}`; your own row `"you": true`; same-Nickname rows told apart by `rank`. `rank` above 1,000 is sent as `1001` and shown "1000+".
- **Errors** `{error, message}` with fixed `message` strings (never SQL errors, stacks or D1 `meta`): `bad_request` 400, `unknown_device` 401, `update` 409, `name_blocked` / `implausible` 422, `slow_down` 429. The client maps `error` to its own text; network failure / 5xx ⇒ "📡 out of reach".
- **Input handling**: reject on `Content-Length` over the route's cap before reading; parse JSON in try/catch ⇒ `bad_request`. Whitelist `kind` and `map` against `catalog`/`maps` before any query; parse `day` as a bounded integer; every value `.bind()`ed; one literal query per kind (never `ORDER BY ${col}`).
- **Writes**: Speedrun and Daily keep the lowest `ticks` (`ON CONFLICT DO UPDATE … WHERE excluded.ticks < ticks`); a Replay is replaced only when its row improves. Score overwrites. Every write updates `device.last_seen_at`.
- **Board read**: top 50 + total cached 60 s per Board in a module-level `Map` (per isolate, best effort). Your rank and Around you only for a verified Device with a row; rank is a bounded count: `SELECT COUNT(*) FROM (SELECT 1 FROM … WHERE ticks < ? LIMIT 1000)`. Around you = ±2 rows by the index.
- **Delete**: hard delete at once of the `device` row, its `board_entry` rows, Replays and save across all three DBs. No grace period.

### 7.1 Sanity checks (fail ⇒ 422 `implausible`)

- **Run**: released non-Tutorial Map; `ticks ≥ speedrunFloorTicks`.
- **Shift**: `day` = today, or yesterday until 00:15 UTC; `ticks ≥` the calendar's Daily floor; Score/Money ≤ what that many ticks can earn; Replay present, ≤ 64 KB, header matches the body.
- **Score**: §5.3.
- **Nickname**: blocklist + the character rule (`name_blocked`).
- **Save**: compressed ≤ the save cap (≈ 4× a measured full-progress save, ≤ 64 KB; a build bot check keeps a full-progress save under ¼ of it). Decompressed with `DecompressionStream`, aborted past 256 KB, then `decodeSaveCode()` (pure `sim/save.ts`).

### 7.2 Rate limits

Rate-limit binding (per Cloudflare location, approximate, 10 s / 60 s periods — best effort):

| Key | Limit |
|---|---|
| Board reads, by IP always | 30 / 60 s |
| Writes, by verified `id_device` | 6 / 60 s per route |
| Writes, `global:write` | sized so a few busy locations × 1,440 stay under 100K D1 writes/day |
| `POST /v1/device`, by IP | 3 / 60 s |

Plus a hard cap independent of the binding: the `quota` row for today allows 2,000 new Devices per UTC day, then 429 `slow_down`. A 429 only shows "📡 out of reach · Try again", never stops play. Limits stay loose for carrier NAT and school wifi.

### 7.3 Capacity

≈15 requests and 10 row writes per active player per day; a Wall read ≈ 60 rows + ≤ 1,000 for your rank. **~2,000 daily players fit Free, provisionally**, until the release gate measures `rows_read` and save CPU on staging. Past the limit, online goes dark until 00:00 UTC; the game keeps playing.

## 8. When the client calls

- Run submit at 100% Completion; Shift submit on each finished attempt; Score at each Opening end; cloud save upload at Opening end, at most every 5 min.
- Board read only when a Wall tab or Map chip opens, kept 60 s in memory.
- Nothing on page load except retrying pending submits (§12). The Daily ticket's rank and 🔥 come from the last Shift response, stored locally.

## 9. Cron (daily)

1. Replays: per Daily Board keep the top 100 for 30 days, then the top 10 (kept while their Device exists).
2. Devices idle 24 months (`last_seen_at`): same cascade as Delete.
3. `quota` rows older than 7 days deleted.

## 10. Cloud save — conflicts settled at assembly

- The existing Save Code, gzipped by the client, stored against the Device in the Save DB.
- **Last write wins.** Uploads at Opening end, at most every 5 min.
- Entering a Cloud Code in a browser that has a local save shows a restore choice with both saves (Maps, Completion, date): **Use cloud save** or **Keep this one**. Nothing else syncs.
- A cloud restore goes through the same guarded decoder as a Save Code import, but keeps Runs valid (§5.2).

## 11. UI — [Where the Boards show](https://github.com/Seif-Sallam/Wobbly-Mart/issues/120), [Privacy surface](https://github.com/Seif-Sallam/Wobbly-Mart/issues/141)

Build from `prototype/boards-ui` (`src/app/boards-prototype.ts`, `?boards=frames`, `&gallery=1`, `&offline=1`); never merge it.

- **Player-facing name "Wall of Fame"** (🏅); no "X Board" on screen. Tabs 📅 Today / ⏱️ Speed / ⭐ Stars / 🔥 Streaks with headings Shift of the Day / Speed Legends / Star Collectors / Never Missed a Shift; label over #1 Employee of the Day / Fastest Hands / Star of the Store / Never Late.
- **Entry points**: 🏅 round button in the title corner; the **Daily ticket** under the title plaque (Shift #, today's goal, 🔥 + rank once you have a Device; bottom-left in phone landscape) opens Today; end screens link to it. Nothing new in the HUD except the Shift chip.
- **Wall popup**, fixed size (max 480 px wide, 86% high; landscape near full screen): centred title + ✕; tabs (swipe too); scrolling body; footer with one main action ("▶ Play today's Shift" / "▶ Play <Map>"); Speed and Stars pick the Map with chips. Body: top three as tilted Employee-of-the-Month frames on a wood wall with medals; **Around you** (±2, highlighted); **Everyone** (rows 4…50). Row: rank, coloured initials badge, Nickname, value. Without a Device: "You're not on the Wall yet" + "Pick a Nickname".
- **Every popup** uses one shell (title + ✕, body, footer), blurs the game behind (3 px) and never closes on an outside tap.
- **Privacy popup + `privacy.html`**, same text: what's stored (Device, Nickname, Board rows, Replays, cloud save, IP seen by Cloudflare), why, how long (§9), rights, a contact address the owner picks, Cloudflare as processor, no ads, no analytics. Linked from the title footer, Settings and the Get-on-the-Wall card.
- **First online write**: the Privacy popup with **Accept** and **Not now** at equal weight (Not now ⇒ stays offline). The accepted notice version is stored locally; a bump asks again. Offline play is never gated. This is an acknowledgement, not the lawful basis (legitimate interests). Then "☁️ Get on the Wall": "I'm new here" (→ Nickname) and "I've played on another browser" (→ Cloud Code), with "Not now" the same size.
- **Nickname card**: live preview of your Wall row, field pre-filled by 🎲, "No real names" hint line that turns into the inline refusal, n/16 counter, Enter saves. **Cloud Code entry**: dashes inserted as you type.
- **Settings**: Nickname (Change); Cloud Code (masked `WBLY-••••-••••-2RTA`, Show / Copy, "keep it secret" note, **New Cloud Code** with confirm); **Delete my Device** (confirm ⇒ `DELETE /v1/device` ⇒ local Cloud Code wiped; offline ⇒ "📡 out of reach", nothing wiped); Privacy link. Without a Device: one "Wall of Fame · Join" row.
- **Offline / loading / empty** inside the fixed popup: "📡 The Wall is out of reach" + Try again; skeleton rows; "This wall is empty".
- Tuned values: blur 3 px, Wall 480 px × 0.86, neighbours 2, rows 50, rank count-up 1.4 s (*tune*).

## 12. Offline submits — settled at assembly

Keep only the best pending result per Board in `localStorage`. Retry on the next app start, Wall open or submit. Daily results past 00:15 UTC D+1 are dropped. The end screen says "Saved, will post when you're back online".

## 13. Privacy and legal — [Security and legal audit](https://github.com/Seif-Sallam/Wobbly-Mart/issues/122)

Findings: `.scratch/release-03-leaderboard/research/security-legal.md` on `research/online-security-legal`. Not legal advice.

- Act as if GDPR / UK GDPR, the UK Children's code and COPPA apply. Lawful basis: legitimate interests. No cookie banner while the Cloud Code is created on request and there are no analytics or third-party scripts.
- No age gate. No Art 27 EU/UK representative.
- `docs/dpia.md`, one page: shared-origin risk, the Streak (kept, no nags), free-text Nicknames (accepted).
- Retention: Board rows, save and Streak while the Device exists; Replays per §9; idle Devices deleted after 24 months; Delete is immediate.

## 14. Build order — small playable PRs into `release-03-leaderboard`

Each PR touching `worker/` or `src/app/` network code gets `/code-review`. Migrations in the PR description, applied by the owner on staging before merge.

1. **Worker skeleton**: `worker/`, `wrangler.toml` (3 envs, `preview_urls = false`, CORS vars, rate-limit bindings), migrations `0001` for all three DBs, router, CORS, body caps, errors, rate limits + `quota`, `POST/GET/DELETE /v1/device`, rotate, nickname + blocklist, the Worker integration test (`@cloudflare/vitest-pool-workers`, flowing, asserting bodies), CI staging deploy, the `/wizard`. CLAUDE.md's test line gains "and the Worker". **Review checkpoint 1**: `/security-review` + `/code-review`; walk threat-table rows 2, 5–9, 13, 14, 16.
2. **`SIM_VERSION` + quantized Intents**: one input path, golden-run test.
3. **Online client + privacy**: `src/app/` API client, `VITE_API_URL`, CSP, Privacy popup + `privacy.html`, Get on the Wall, Nickname card, Cloud Code entry, Settings rows (Change, Show/Copy, New Cloud Code, Delete my Device). `docs/dpia.md`.
4. **Wall of Fame + Score Board**: popup shell (blur, ✕), Wall tabs reading `GET /v1/boards`, Stars tab live, `PUT /v1/scores/:map` at Opening end, Board read cache in the Worker.
5. **Runs + Speedrun Board**: run clock + `runValid` in the save, Save Code import voids, `speedrunFloorTicks` map data, `POST /v1/runs`, end of Run screen, Speed tab.
6. **Daily Map generator**: pure generator in `src/sim/`, MapDef switch (no Edit Layout / Closed), calendar file + CI 365-day proof.
7. **Daily Shift**: separate world, Daily ticket, HUD chip, Reset, reload resume, Replay recording + 64 KB CI check, `POST /v1/shifts`, Streak, end of Shift screen, Today and Streaks tabs.
8. **Cloud save**: Save DB routes, upload cadence, restore choice, save-cap bot check.
9. **Offline submit queue** (§12).
10. **Cron** (§9) and the `?debug` strip on deployed `main` builds.
11. **Release gate** (one combined gate with the release-02 perf gate), after every PR above has merged and staging has run end to end, **before** production migrations and the merge to `main`:
    - `/code-review` (standards + spec) and `/security-review` over `main...release-03-leaderboard`; triage per the review-comment rules.
    - Walk the whole threat table in the findings file; mark each row done or accepted.
    - Owner-run staging measurements: `rows_read` per Wall tab with seeded Boards (2K rows); CPU of the largest `PUT /v1/save` and `decodeSaveCode()`; the rate-limit binding works on Free; a scripted burst gets 429s; Workers Logs carry no `Authorization` header. Restate §7.3 from the numbers.
    - The privacy page is live and linked; Delete works and is in the Worker integration test.
