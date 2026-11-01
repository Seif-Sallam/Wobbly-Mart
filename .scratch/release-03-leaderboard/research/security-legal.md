# Security and legal audit of the online features

Research for issue #122 (map #114). Sources were read on **2026-11-01**. This is not legal advice. It gives practical, proportionate steps for a solo hobby game. Where the law is unclear, this note says so.

What is audited is the design as decided in #115–#121 and #138: a static GitHub Pages client at `https://seif-sallam.github.io/Wobbly-Mart/`, a Cloudflare Worker + two D1 databases (Board DB, Replay DB) on the Free plan, no login, and one bearer secret per **Device** (the **Cloud Code**) in `localStorage` (`wobbly-mart.device`). The server stores **Nicknames**, Board rows, **Replays** (Daily Shift only), cloud saves (the **Save Code**, gzipped) and the **Streak**.

## Headline

1. **The law applies, and the cost is light.** A Cloud Code (and its hash), a Nickname and an IP address are personal data under GDPR and UK GDPR. You need a short privacy notice, a contact address, a self-service **delete my Device** action and stated retention. **No cookie banner is needed** if nothing is stored before the player asks for an online feature. No analytics or third-party scripts.
2. **Children are the biggest legal unknown.** A cartoon store game is "likely to be accessed by children" (UK Children's code), and it may count as "directed to children" under COPPA. The design already avoids most of the risk: there is no chat, no contact, no age, no location and no profiling. The one gap is the **free-text Nickname**, where a child can publish a real full name.
3. **The worst security risk is cost exhaustion, not cheating.** With today's numbers, one attacker on one IP can use up the day's D1 reads in about 10 minutes, half the day's D1 writes from one IP, and the whole 500 MB Board DB with about 500 fake Devices. Some of this also hurts real players: the Board read query is O(Board size) in rows read, so the "~2–3K daily players fit Free" estimate from #121 likely fails on reads.
4. **The Cloud Code shares an origin with 4 other sites.** `seif-sallam.github.io` also serves `Inertia`, `Service-Timer`, `Virtual-Bouquet` and `ValentineRequest`. `localStorage` is per origin, so script on any of those pages can read every player's Cloud Code and save.
5. **Staging and production share one Free quota.** The Workers 100K requests/day limit is **per account**. Anyone who finds the public staging URL can make production go dark.
6. Several earlier decisions are reopened. See [Decisions this reopens](#decisions-this-reopens).

---

## Legal

### Which data is personal data

| Data | Where | Personal data? | Why |
|---|---|---|---|
| Cloud Code (raw) | client `localStorage`; sent as `Authorization: Bearer` | yes | An "online identifier" that singles out a Device over time (GDPR Recital 30, Art 4(1)). |
| `token_hash`, `id_device` | Board DB | yes, pseudonymous | Pseudonymised data stays personal data (Recital 26). |
| Nickname | Board DB, shown on public Boards | yes when it names someone; always linked to a Device | Free text, so a player can type their real name. |
| Board rows, Streak, Replay, cloud save | Board DB / Replay DB | yes (linked to the Device) | Gameplay data about one Device. |
| IP address | seen by Cloudflare on every request; used as a rate-limit key; may be in Workers Logs | yes | The CJEU's *Breyer* ruling (C-582/14) treats dynamic IPs as personal data when the means to identify are reasonably available. |
| GitHub Pages visitor IPs | GitHub's logs | yes | GitHub's own processing. It happens today, without the online features. |

There is no email, no real name field, no age, no location, no payment, no chat and no messaging between players. That keeps every regime below light.

### EU GDPR

- **Applies?** Probably, in part. The owner is not established in the EU. Art 3(2)(a) reaches a non-EU controller who *offers services* to people in the EU. Recital 23 says that "mere accessibility" of a website is not enough, so look for intent such as EU languages, currencies or marketing. A free English game open worldwide sits in a grey zone. The **household exemption (Art 2(2)(c)) does not apply**, because Boards publish data to the world. **Recommendation:** act as if GDPR applies. Doing so costs a page and one endpoint.
- **What it requires, and what we do:**
  - **Lawful basis (Art 6).** Use legitimate interests (Art 6(1)(f)): running the Boards, cloud save and abuse limits the player asked for. You could also use contract (6(1)(b)), but a child's capacity to contract is doubtful. Do not rely on consent. Art 8 (age of digital consent) applies only when consent is the basis, so it does not apply here.
  - **Transparency (Art 12–14).** Publish a privacy notice (outline below).
  - **Rights (Art 15–21).** The rights are access, rectification, erasure, objection and portability. With a no-login service, the Cloud Code is the proof of identity. Self-service covers almost everything: `GET /v1/device` and `GET /v1/save` cover access and portability, `PUT /v1/device/nickname` covers rectification, and a new **`DELETE /v1/device`** covers erasure and objection. If someone has lost their Cloud Code, Art 11(2) applies: the controller is not obliged to act when it cannot identify the person. Say so in the notice, and never ask anyone to email a Cloud Code.
  - **Data minimisation and storage limitation (Art 5(1)(c),(e)).** See [Deletion and retention](#deletion-and-retention).
  - **Security (Art 32).** See the [threat table](#security-threat-table).
  - **Processor (Art 28).** Cloudflare is the processor. Its Customer DPA "forms part of the Main Agreement" (including the Self-Serve Subscription Agreement) and includes the EU SCCs, the UK Addendum and the Data Privacy Framework (https://www.cloudflare.com/cloudflare-customer-dpa/). Nothing to sign. Record that you rely on it.
  - **Art 27 EU representative.** Where Art 3(2) applies, Art 27(1) requires a representative in the EU. Art 27(2)(a) exempts processing that is "occasional" and "unlikely to result in a risk". A live leaderboard is not clearly "occasional". **Honest answer:** strictly, a representative may be required. Small hobby services widely skip it, and enforcement against them is very unlikely. Paid representative services exist. This is the owner's risk call. Note it and move on.
  - **Breach notification (Art 33–34).** If the Board DB leaks, the hashes and Nicknames are low-risk, and the cloud saves are game data. Keep a one-line runbook: rotate secrets and post a notice on the game page.
- Sources: GDPR text https://eur-lex.europa.eu/eli/reg/2016/679/oj (Art 2, 3, 4, 5, 6, 8, 11, 12–21, 27, 28, 32–34; Recitals 23, 26, 30). Art 27 wording was checked via https://gdpr-info.eu/art-27-gdpr/.

### ePrivacy Art 5(3) / UK PECR reg 6: is a cookie banner needed for `localStorage`?

- **Applies?** Yes. The EDPB Guidelines 2/2023 on the technical scope of Art 5(3) (v2, adopted Oct 2024) say that Art 5(3) is "not limited" to cookies. Para 44 names "local storage" as stored information. When that information, "or any derivation" of it, leaves the device, Art 5(3) applies. Para 42 lists "authentication tokens" among such identifiers. So storing the Cloud Code and sending it back is in scope. So is the existing local save, but the local save never leaves the device, so per para 44 *reading* it is not "gaining access".
  (https://www.edpb.europa.eu/system/files/documents/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)
- **Exemption.** Art 5(3) allows storage "strictly necessary in order for the provider of an information society service explicitly requested by the subscriber or user to provide the service" (quoted in footnote 4 of the guidelines). The UK ICO's final guidance on storage and access technologies (29 April 2026) keeps the same test. It judges necessity from the user's point of view and names authentication and security as typical cases. The Data (Use and Access) Act 2025 added more UK exceptions (statistics, appearance/functionality). The ICO pages returned HTTP 403 to this research. Their content here comes from secondary summaries, e.g. https://cy.ico.org.uk/about-the-ico/media-centre/news-and-blogs/2025/09/fact-vs-fiction-ico-debunks-myths-on-storage-and-access-technologies. Read the primary page before launch: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/.
- **What it means for us:**
  - The Cloud Code is created **only when the player taps "I'm new" or enters a Cloud Code** (#118's lazy creation). It is strictly necessary for the Wall of Fame and cloud save the player asked for. **No consent is needed.** This holds only while the creation stays lazy: never create or send a Device token on page load.
  - The local save, settings, `seen.*` flags and "last Shift rank" are needed for the game the player opened. Exempt.
  - **Do not add** analytics, ad SDKs, third-party fonts or Cloudflare Web Analytics without revisiting this section. Mixed purposes lose the exemption.
  - Even when the exemption applies, mention the storage in the privacy notice. It costs one line.
- **Pending law.** The EU's 2025 "Digital Omnibus" proposal would move device-storage rules into the GDPR. As of this research it is a proposal, not law. Re-check before launch.

### UK GDPR and the ICO Age Appropriate Design Code (Children's code)

- **UK GDPR** applies the same way as the EU GDPR above (Art 3(2) and Art 27 have UK equivalents). The obligations are the same, and the notice must name the ICO as the UK complaint route.
- **Children's code: applies?** **Likely yes.** It covers information society services "likely to be accessed by children" (under 18) in the UK, including non-UK services that target the UK or process UK users' data. A colourful arcade-idle game on the open web will be played by under-18s. Code PDF: https://ico.org.uk/media/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services-2-1.pdf (the ICO site blocked fetching; standards checked via summaries).
- **The 15 standards against our design:**

| Standard | Our status | Action |
|---|---|---|
| 1 Best interests of the child | OK | none |
| 2 DPIA | **missing** | Write a one-page DPIA. This note covers most of it; keep it with the spec. |
| 3 Age-appropriate application | OK: same protections for everyone, no age gate needed | Do not collect age. |
| 4 Transparency | **missing** | Write the notice in plain words a 10-year-old can follow. Add a one-line hint on the Nickname card. |
| 5 Detrimental use of data | **borderline**: the Streak ("Never Missed a Shift") is a reward loop | No push notifications or "you'll lose your streak" nags. Keep the Streak passive. Mention it in the DPIA. |
| 6 Policies & community standards | OK: blocklist + owner SQL reset | State the Nickname rules in the notice. |
| 7 Default settings | OK: nothing is shared until the player opts in by choosing a Nickname | Keep the 🎲 suggestion as the *pre-filled default*. |
| 8 Data minimisation | mostly OK | See retention. |
| 9 Data sharing | OK: only Cloudflare as processor | none |
| 10 Geolocation | OK: none (Cloudflare's `request.cf` country/city must not be stored) | Never persist `cf.country`/`cf.city`. |
| 11 Parental controls | n/a | none |
| 12 Profiling | OK: none | none |
| 13 Nudge techniques | OK if the "Get on the Wall" card has an equal "Not now" | Make sure both choices have equal weight. |
| 14 Connected toys | n/a | none |
| 15 Online tools | **missing** | Add an in-game **Delete my Device** button and the notice link. |

### US: COPPA

- **Applies?** **Uncertain, so assume possibly.** COPPA covers foreign operators whose service is directed to US children under 13 or who knowingly collect from them. The "directed to children" factors include "animated characters or child-oriented activities" (16 CFR 312.2; FTC FAQ D.1). A cartoon store game partly matches. General-audience sites have no duty to investigate visitor ages (FAQ H.1).
- **What counts as personal information** (16 CFR 312.2, https://www.law.cornell.edu/cfr/text/16/312.2):
  - **Persistent identifier** (the Cloud Code, an IP address). These are exempt from notice and consent when used **only for "support for the internal operations"**, which explicitly includes "authenticate users or personalize content", "protect the security or integrity" and maintaining "game scores" as user preferences (FAQ J.5–J.8, https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). Our use fits that exemption, as long as we never use the data for ads or profiling.
  - **Screen name** is personal information only "where it functions in the same manner as online contact information". Players cannot message each other, so a Nickname alone is not that.
  - **But "a first and last name" is personal information.** "Collects" includes "enabling a child to make personal information publicly available in identifiable form". The one exception is an operator that deletes "all or virtually all" such data before posting. **A typed Nickname such as `Emma Johnson` is exactly this gap.**
- **The amended Rule** (90 FR 16918, published 2025-04-22, effective 2025-06-23, compliance by **2026-04-22**) is now fully in force. It adds a written information-security programme and written retention limits for child data. If COPPA applies, this note plus the retention table is the proportionate version of both.
- **Recommendation (no age gate):** make the 🎲 name the pre-filled default. Add a hint: "Don't use your real name". Optionally also refuse Nicknames shaped like `Firstname Lastname` (two capitalised words that match a common-first-names list). The **zero-risk option** is generated-only Nicknames (🎲 picker, no free text). That reopens #118; see below.

### Other regimes, briefly

- **US state laws** (CCPA/CPRA etc.) have revenue or volume thresholds a free hobby game does not meet.
- **The owner's home-country data protection law** was not researched. Check it separately.
- **GitHub Pages** already logs visitor IPs as its own controller (GitHub Privacy Statement). Mention GitHub in the notice.

---

## Privacy notice draft outline

One static page, `privacy.html`, shipped with the game, linked from Settings, the "Get on the Wall" card and the title screen footer. Plain language, about 400 words. Its sections:

1. **Who runs this.** The owner's name or handle, and a contact email (a dedicated alias, never shown in the repo as a secret). The notice says the game is a hobby project.
2. **Playing offline.** The game saves to your browser's local storage. Nothing leaves your device until you join the Wall of Fame or turn on cloud save.
3. **When you join the Wall.** It lists what is stored: a random **Cloud Code** (we keep only a scrambled hash of it), your **Nickname**, your best times, Scores and Streak, the inputs of your Daily Shift attempts (**Replays**) and, if you turn it on, your **cloud save**. The notice says these are public: your Nickname, rank, times, Scores and Streak. It says these are not: your Cloud Code and your cloud save.
4. **Why.** To show the Wall of Fame, restore your save on another browser, and stop cheating and abuse. The legal basis is legitimate interests.
5. **Your IP address.** Cloudflare (our host) sees it on each request. We use it only to limit abuse and do not store it. Cloudflare's logs keep request data for up to 3 days. GitHub sees it when you load the game.
6. **Who else.** Cloudflare, Inc., as our processor (Cloudflare DPA; EU SCCs / UK Addendum / Data Privacy Framework for transfers), and GitHub. No ads, no analytics, no selling, no tracking across sites.
7. **How long.** The retention table below, in plain words.
8. **Your choices.** Change your Nickname any time. **Settings → Delete my Device** erases everything we hold about it at once. Lost your Cloud Code? We can't tell which Device is yours, so we can't find it to delete it (Art 11). That data is removed automatically after the inactivity period.
9. **Kids.** No real names, please. Use the 🎲. We never ask your age, location or email.
10. **Complaints.** Your local data protection authority (the ICO in the UK, your country's DPA in the EU).
11. **Changes.** A dated "last updated" line.

---

## Deletion and retention

**Deletion.** Add `DELETE /v1/device` (bearer). One `db.batch()` per database deletes the `device` row and every `board_entry` of that Device in the Board DB, then a second call deletes the Device's `replay` rows in the Replay DB. Respond 204. The client then clears `wobbly-mart.device` and its cached rank. The UI is a Settings → Cloud Code row action with a confirm popup. That is about 20 lines of Worker code. The owner-run SQL for a bad Nickname stays as it is.

**Retention.**

| Data | Keep | Mechanism |
|---|---|---|
| Device row, Nickname, Streak | until deleted, or **24 months without any write** | Optional monthly cron: delete Devices whose `MAX(created_at, save_at, latest board_entry.updated_at)` is older than 24 months. A first release may skip this if the notice says "until you delete it". |
| Board rows | as long as the Device exists | Deleted with the Device. Rows of an old `sim_version` stay hidden (#121). Consider deleting them after 12 months. |
| Replays | top 100 per day for 30 days, then top 10 (#115) | Keep that, but **delete with the Device**. "Forever" in the notice becomes "as long as the Device exists". |
| Cloud save | latest only, overwritten | Deleted with the Device and by the inactivity purge. |
| IP address | not stored by our code; at most 3 days in Workers Logs | Never put an IP in D1 or in a log line. Rate-limit counters live in memory and are approximate. |
| Workers Logs | 3 days on Free (https://developers.cloudflare.com/workers/observability/logs/workers-logs/) | On by default for new Workers. **Verify on staging that the `Authorization` header is not stored in invocation logs.** If it is, set `[observability] invocation_logs = false` (or a low `head_sampling_rate`). Never `console.log` request headers or bodies. |

---

## Security threat table

Effort: S = under an hour, M = half a day, L = more.

| # | Threat | Impact | Current design | Mitigation | Effort |
|---|---|---|---|---|---|
| 1 | **Shared origin.** Another Pages site on `seif-sallam.github.io` (Inertia, Service-Timer, Virtual-Bouquet, ValentineRequest) is compromised, or loads a hostile script, and reads `localStorage`. | Theft of every player's Cloud Code and saves | Not considered | **Best:** serve the game from its own origin: a custom domain on Pages, or moving Pages to a domain the owner controls. **Minimum:** keep those four sites free of third-party scripts, and note the risk in the DPIA. The CORS allow-list origin is shared as well. | S (policy) / M (domain) |
| 2 | XSS in the game itself (Nickname rendered as HTML) | Cloud Code theft | Preact escapes text; Nicknames are ASCII-only, checked server-side | Never use `innerHTML` / `dangerouslySetInnerHTML` for server data. Add a strict **CSP** `<meta>` on the page: `default-src 'self'; connect-src 'self' <API URL>; script-src 'self'`, no inline scripts. Validate Nicknames in the Worker (already decided). | S |
| 3 | **Leaked Cloud Code** (screenshot, stream, shared device) | Attacker owns the Device forever: renames it, overwrites the save, deletes it | Masked in Settings; **no rotation** | Add a "New Cloud Code" action (`POST /v1/device/rotate`: swap `token_hash`, return the new code). Or accept it and rely on Delete + "I'm new". Never put the code in a URL, query string, log or error body. | S |
| 4 | Cloud Code brute force through the `GET /v1/device` oracle | Account takeover | ~80 random bits, SHA-256 hash, rate-limited per IP | Sufficient: 2^80 guesses is infeasible. Generate with `crypto.getRandomValues`. A fast hash is fine for a high-entropy token. | none |
| 5 | **SQL injection** through `:kind`, `:map`, `day` or a per-kind `ORDER BY` column | DB read/write | D1 prepared statements assumed | Bind every value with `.bind()`. Whitelist `kind` and `map` against `catalog`/`maps` **before** any query. Write one literal query per kind, never `ORDER BY ${column}`. Parse `day` as a bounded integer. | S |
| 6 | **Rate-limit bypass with a random bearer.** Reads are keyed "by bearer when sent, else IP" | Unlimited reads, so D1 reads are exhausted (see the cost analysis) | #121 | Key **reads by IP always**. Key writes by a *verified* Device id (`id_device` after the hash lookup), never by the raw header. | S |
| 7 | **Sybil Devices.** Unlimited `POST /v1/device` at 20/min/IP; per-Device limits mean nothing across many Devices | Write and storage exhaustion; Board spam | 20/min/IP; "Device creation unlimited" in the fallback | Tighten to e.g. **3 per 60 s per IP**. Add a **global** binding key per route (e.g. `global:device`, `global:write`) sized to the daily budget. Optionally require a small **proof of work** on `POST /v1/device` (the client finds a nonce so that SHA-256(challenge‖nonce) has N leading zero bits, about 1 s on a phone; the Worker verifies with one hash; `crypto.subtle`, no dependency). Turnstile would also work, but it adds a third-party script and reopens the cookie analysis. | M |
| 8 | **Zip bomb / CPU** on `PUT /v1/save`: 1 MB gzip inflates to ~1 GB, then `decodeSaveCode()` runs | Worker killed (128 MB memory, 10 ms CPU); repeated, it fails every request | ≤1 MB compressed, Worker unzips | Check `Content-Length` and reject early. Decompress with `DecompressionStream` and **abort past a decompressed cap** (e.g. 1 MB). Lower the compressed cap to about 4× a measured full-progress save (likely tens of KB). Measure `decodeSaveCode()` CPU on staging against 10 ms. | S |
| 9 | Oversized or malformed bodies on any route (JSON bomb, a 100 MB body allowed by the platform) | CPU/memory | not specified | Read the body only if `Content-Length` ≤ the route's cap (2 KB for most, 96 KB for a Shift with a base64 Replay). Parse inside try/catch and return `bad_request`. | S |
| 10 | **Score cap inflation**: claim `playTime` = 10 years and the cap becomes huge | Fake top Score | cap = `fixedMax + playTime × maxRate`; `playTime` must not decrease | Also require `playTime − stored.playTime ≤ (now − stored.updated_at) × 1.1 + slack`. Cap the first submit by `now − launch date`. | S |
| 11 | Speedrun/Daily times set exactly at the floor | Fake #1 | Floors; "security deliberately light" | Accepted by design. **But** Daily rows with **no Replay** (optional, or dropped over 64 KB) cannot be checked even by the planned offline script. Show only Replay-backed rows in the Daily top 50 / Employee-of-the-Day frame, and let the Streak count anything. | S |
| 12 | Nickname abuse (slurs past the blocklist, impersonation such as `Admin`, `WobblyMart`, `Seif`) | Reputation | LDNOOBW + owner SQL | Add reserved words to the owner list. Accepted otherwise. | S |
| 13 | **CORS misread as auth** | none if understood | Allow-list `https://seif-sallam.github.io`, cache preflights | CORS stops only browsers, never `curl`. Never reflect an arbitrary `Origin`; send `Vary: Origin`; no `Allow-Credentials` (we use bearer headers, not cookies). Remember the allow-listed origin also covers the owner's other four Pages sites. | S |
| 14 | Error bodies leaking internals | Info leak | `{error, message}`, "`message` for logs" | Return fixed `message` strings. Never echo SQL errors, stack traces or D1 `meta`. | S |
| 15 | **Staging as a back door to production quota** | Production goes dark | Staging is a public Worker on the same Free account | See the cost analysis: put staging on a separate free Cloudflare account, or make staging reject requests whose `Origin` is not the staging or dev origin, and cap staging to a low global binding limit. | S–M |
| 16 | Version / Preview URLs and `workers.dev` stay reachable | Old builds with old bugs stay live | default | Set `preview_urls = false`. If a custom domain is used, set `workers_dev = false`. Disabling `workers.dev` does **not** disable Version/Preview URLs (https://developers.cloudflare.com/workers/configuration/routing/workers-dev/). | S |
| 17 | CI supply chain (a compromised Action or `wrangler` release) | Deploy token stolen, Worker hijacked | Branch-restricted Environments, token scoped (#117) | Pin third-party Actions to a commit SHA. Use `npm ci` with the lockfile. Leave Dependabot alerts on. Token scope stays Workers Scripts Edit + D1 Read (CI never migrates). | S |
| 18 | Log exposure of the bearer token | Theft by anyone with dashboard access | Workers Logs on by default | Verify on staging; see the retention table. | S |
| 19 | Cloud save restore of a crafted save | Client crash or odd state | Worker runs `decodeSaveCode()`; only the Device holder can write | OK. Client restore must still go through the same guarded decoder as Save Code import. | none |

OWASP API Security Top 10 (2023) coverage: API1 (BOLA) is avoided because there are no object ids (#121). API2 (broken authentication) is rows 3–4 and 6. API4 (unrestricted resource consumption) is rows 7–9 and the cost analysis. API6 (sensitive business flows) is rows 10–11. API8 (misconfiguration) is rows 13–16. API9 (inventory) is row 16. Source: https://owasp.org/API-Security/editions/2023/en/0x11-t10/.

---

## Cost-exhaustion analysis against Free limits

Limits, from `research/cloudflare-free-tier` and re-checked today (https://developers.cloudflare.com/workers/platform/limits/, https://developers.cloudflare.com/d1/platform/pricing/):

- Workers: **100K requests/day per account**, shared by staging and production.
- D1: 5M rows read and 100K rows written per day. The D1 pricing page does not say whether these daily limits are per account or per database; assume per account.
- 500 MB per database. 10 ms CPU per request, with "some built-in flexibility".
- "Rows read measure how many rows a query reads (scans)."

| Budget | Attack or growth path | Today's numbers | Time to exhaust | Mitigation |
|---|---|---|---|---|
| **Worker requests** 100K/day | Any flood. The binding still invokes the Worker, so every request counts | 1.2 req/s sustained = 100K/day | **~1 day at 1.2 req/s; minutes at 100 req/s** | Unavoidable on `workers.dev`. Accepted: the game plays offline and online goes dark until 00:00 UTC (#121). A **custom domain** on a Cloudflare zone allows the Free WAF rate-limiting rule (1 rule, IP-keyed, 10 s period, 10 s timeout; https://developers.cloudflare.com/waf/rate-limiting-rules/). It runs before the Worker. Whether blocked requests still count toward the Worker quota is not documented, but they should not invoke the Worker. |
| **D1 rows read** 5M/day | `GET /v1/boards/...`: top 50 (~50) + `COUNT(*)` total (scans N index entries) + your rank `COUNT(*)` (up to N) + around (5) ≈ **2N + 60 per read** | N = 2,000 on a busy Daily Board means ~4K rows per read. At 120/min/IP that is ~480K rows/min | **~10 min from one IP.** Also organic: 2,000 players × 3 Wall opens × 4K = **24M/day, about 5× the limit** | **Measure `meta.rows_read` on staging with 2K seeded rows**; COUNT cost per index entry is not documented. Then: cache the public part (top 50 + total) per Board for 60 s. The Cache API is documented only for **custom domains**, so on `workers.dev` use a module-level `Map` in the isolate (best effort, per isolate, free). Compute your rank only for a verified Device that has a row. Lower reads to ~30/min/IP. Speedrun and Score Boards never reset, so N only grows. |
| **D1 rows written** 100K/day | `POST /v1/device`: 1 row + `token_hash` UNIQUE index ≈ 2 written. Board write: row + 2 indexes ≈ 3. Shift: + Streak (1) + Replay (1) ≈ 5 | 20/min/IP × 1,440 × 2 ≈ **57.6K/day from one IP** | **2 IPs or about 12 hours** | Row 7: lower per-IP limits, a global per-route binding key, optional proof of work. |
| **Board DB storage** 500 MB | Sybil Devices each `PUT /v1/save` 1 MB | 500 Devices × 1 MB = 500 MB | **25 min** at today's 20 Devices/min/IP | Cap saves at ~4× a measured real save (likely ≤64 KB) and **move saves to their own D1 database** (Free allows 10). A full Board DB then cannot block Board writes. |
| **Replay DB storage** 500 MB | Fake Shifts with 64 KB Replays; the cron keeps the attacker's fast fakes as "top 100" | ~7,800 Replays fill it | within a day for a Sybil attacker | Replay writes are already separate and non-fatal (row kept). Make sure a failed Replay insert never fails the Board write. Combine with rows 7 and 11. |
| **CPU** 10 ms | Zip bomb on save; large JSON | — | per request | Row 8. |

**Rate-limit binding caveats** (from #116): it is per Cloudflare location and approximate, allows only 10 s or 60 s periods, and its availability on Free is still unverified. A global key such as `global:write` is therefore global *per location*. Size it so that (limit × a few busy locations × 1,440) stays under the daily budget. If Free lacks the binding, the fallback "per-Device throttles on `updated_at`" does nothing against Sybil Devices. Device creation then needs proof of work or a hard daily cap: a small `quota(day, count)` row, 1 extra write per Device creation.

**Re-estimate of "~2–3K daily players fit Free" (#121):** writes and requests still fit. **Reads do not**, unless the Board read is cached or `COUNT(*)` turns out cheap. Re-measure before the spec claims a number.

---

## Review step in build order

Two review points, both before the release merge to `main`:

1. **Early checkpoint, after the first Worker PR** (router + `POST/GET /v1/device` + auth + CORS + rate limiting + body caps). This code shapes all security. Run `/security-review` and `/code-review` on that PR. Run the threat table rows 2, 5–9, 13–14 and 16 as a checklist. Fixing these here is cheap; at the end they touch every route.
2. **Release gate ticket: "Security + code review of release-03-leaderboard"**. It is the last ticket after every feature PR has merged into `release-03-leaderboard` and staging has run end to end, and **before** the owner applies production migrations and merges to `main` (#117's order). It covers:
   - Run `/code-review` (standards + spec) and `/security-review` over `main...release-03-leaderboard`. Triage the findings per the review-comment rules.
   - Walk the whole threat table and mark each row done or accepted.
   - Staging measurements (the owner runs these; never against production): `rows_read` per Wall tab with seeded Boards; CPU of the largest `PUT /v1/save`; the rate-limit binding works on Free; a scripted burst gets 429s; Workers Logs carry no `Authorization` header.
   - The privacy notice page is live and linked. Delete my Device works and is checked in the Worker integration test.
   - Pair this gate with the existing release-02 perf gate so `main` gets one combined gate.

Per-PR, everything touching `worker/` or `src/app/` network code also gets `/code-review`. That stays a habit, not a gate.

---

## Decisions this reopens

| Ticket | Decision | Why reopen | Proposed change |
|---|---|---|---|
| **#121 Board API and D1 schema** | 9 routes | GDPR erasure needs self-service | Add `DELETE /v1/device` (and optionally `POST /v1/device/rotate`). |
| #121 | Rank and total via `COUNT(*)`; "No edge cache for now"; "~2–3K daily players fit Free" | O(N) rows read per Wall open; one IP drains 5M reads in ~10 min; organic load likely 5× over | Measure; cache top + total per Board for 60 s (isolate memory, or the Cache API on a custom domain); rank only for a verified Device; restate capacity. |
| #121 | Reads keyed "by bearer when sent, else IP" | A random bearer string gives a fresh key per request | Key reads by IP; key writes by verified `id_device`. |
| #121 | `POST /v1/device` 20/min per IP; "Device creation unlimited" fallback | Sybil Devices drain writes and storage | 3/min/IP + a global key; proof of work or a daily quota row. |
| #121 | Save ≤1 MB compressed, Worker unzips; saves live in the Board DB | Zip bomb / CPU; ~500 fake saves fill the Board DB and block every Board write | Cap ≈4× measured save, a decompressed cap, saves in a third D1 database. |
| #121 | Score cap = `fixedMax + playTime × maxRate` | `playTime` is a client claim with no ceiling | Bound the `playTime` delta by wall-clock time since the last submit. |
| #121 / **#115 Replay** | Replay optional on Shift submit; >64 KB dropped, row kept | Top Daily rows can't be verified even offline | Only Replay-backed rows appear in the Daily top 50 / frames; others still count for Streak and Around you. |
| #115 | Top 10 Replays kept "forever" | Storage limitation; erasure | "As long as the Device exists"; deleted with the Device. |
| **#117 Worker home and deploy** | Staging is a public Worker on the same account | Free quotas are per account, so staging abuse takes production down | A separate free Cloudflare account for staging, or Origin-locked staging with a low global limit. |
| #117 | `workers.dev` URL (implied by "staging/production URLs") | No WAF rate-limit rule and no documented Cache API on `workers.dev`; preview URLs stay live | Consider a cheap custom domain for the API (it also enables the Free WAF rule). Set `preview_urls = false`; configure observability. |
| **#118 Device identity and Nicknames** | Cloud Code in `localStorage` on `seif-sallam.github.io` | That origin is shared with 4 other Pages sites | Own origin (custom domain) for the game, or keep those sites script-clean and record the risk. |
| #118 | No rotation; "lost code ⇒ new Device" | A leaked code gives permanent control | Add rotate, or at least Delete. |
| #118 | Free-text Nicknames, 3–16 chars including spaces | COPPA "first and last name" made public; Children's code transparency | Pre-fill 🎲, add a "no real names" hint, reserve impersonation names. Strictest option: 🎲-only Nicknames. |
| **#120 Where the Boards show** | Screens list | New UI is needed | Privacy link (title footer, Settings, Get-on-the-Wall card); Settings → Delete my Device (confirm popup); Nickname hint line; an equal-weight "Not now" on the Get-on-the-Wall card. |
| **#116 Cloudflare free tier** | Rate-limit binding as the main abuse control | Per-location and approximate; does not save Worker requests | Treat it as best-effort; add global keys; verify on Free at the first staging deploy (already planned). |
| **#119 Daily Shift rules** | Streak / "Never Missed a Shift" | Children's code standard 5 (reward loops) | Keep it, but no notifications or loss-aversion nags; note it in the DPIA. (Flag only, no change.) |

## Open questions

- The real `rows_read` of a `COUNT(*)` over an index range on D1. Measure on staging.
- Whether Workers invocation logs store the `Authorization` header. Check one staging log entry.
- Whether WAF-blocked requests count toward the Workers daily quota. Not documented.
- The owner's home-country data protection law.
- Whether to pay for an EU/UK Art 27 representative. Owner's risk call.
