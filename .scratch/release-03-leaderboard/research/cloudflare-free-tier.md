# Cloudflare free tier: Workers + D1 limits, rate limiting, CORS, deploy

Research for issue #116. All sources were read on **2026-10-29** and come from developers.cloudflare.com or the `cloudflare/wrangler-action` repo. Cloudflare changes these numbers, so re-check them before launch.

## Headline

- The assumed numbers are right **except storage**. 5 GB is the **account** total. **A single D1 database is capped at 500 MB on Free**, and Free allows 10 databases.
- Free allows **50 D1 queries per Worker invocation**. A `db.batch()` counts as one query.
- The max row, string or BLOB size is **2 MB**, so a ~100 KB replay blob fits easily. The 500 MB database cap is the real budget for replays: about 5,000 replays at 100 KB each.
- A native **rate-limiting binding** exists and is GA. It is approximate and **per Cloudflare location**, so it is not a strict global limit. The docs do not state which plans include it or what it costs.
- CORS is done by hand in the Worker: answer `OPTIONS` preflights and add `Access-Control-Allow-Origin` to every response.
- To deploy, run `cloudflare/wrangler-action@v4` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. `wrangler d1 migrations apply <db> --remote` skips its confirmation prompt in CI.

## Workers Free limits

Source: https://developers.cloudflare.com/workers/platform/limits/ and https://developers.cloudflare.com/workers/platform/pricing/

| Limit | Free | vs assumption |
|---|---|---|
| Requests | 100,000 / day, reset 00:00 UTC | matches |
| CPU time | 10 ms per HTTP request | matches |
| Requests per second | "no general limit" | n/a |
| Subrequests | 50 per invocation (internal services: 1,000) | n/a |
| Memory | 128 MB per isolate | n/a |
| Worker size | 64 MiB uncompressed | n/a |
| Workers per account | 100 | n/a |
| Request body | 100 MB (set by the zone plan) | n/a |
| Env vars | 64 per Worker, 5 KB each | n/a |
| Wall-clock duration (HTTP) | no limit | n/a |

Over the daily request limit, Cloudflare returns **Error 1027**. A route's mode decides what happens next. In *fail open* mode the Worker is bypassed, as if no Worker were configured. In *fail closed* mode a 1027 error page is returned. The client must handle that failure gracefully.

Workers Paid costs at least **$5/month**. It includes 10M requests/month and 30M CPU ms/month (pricing page above).

## D1 Free limits

Sources: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/platform/pricing/

| Limit | Free | Paid | vs assumption |
|---|---|---|---|
| Rows read | 5,000,000 / day | 25B / month incl. | matches |
| Rows written | 100,000 / day | 50M / month incl. | matches |
| Storage per account | 5 GB | 1 TB | matches (account-wide) |
| **Max size of one database** | **500 MB** | 10 GB (hard cap) | **differs**: assumed 5 GB |
| Databases per account | 10 | 50,000 | new |
| **Queries per Worker invocation** | **50** | 1,000 | new |
| Max string / BLOB / row size | 2 MB | 2 MB | new |
| Max SQL statement length | 100 KB | 100 KB | new |
| Bound parameters per query | 100 | 100 | new |
| Columns per table | 100 | 100 | new |
| Max query duration | 30 s | 30 s | new |
| Time Travel (point-in-time restore) | 7 days | 30 days | new |

How these limits behave (pricing page):

- **Rows read counts every row scanned, not only the rows returned.** A full scan of a 5,000-row table costs 5,000. A leaderboard top-N query needs an index on its filter and sort columns, for example `(map, mode, day, score)`. Without one, each view scans the whole table.
- Each write to an indexed column costs **one extra row written** per index.
- Over the daily read or write limit, **queries fail with an error** until 00:00 UTC. At the 5 GB storage cap, inserts and creates fail until data is deleted.
- `db.batch()` runs as one SQL transaction: if any statement fails, the whole batch rolls back. It counts as one query toward the 50 per invocation. Source: https://developers.cloudflare.com/d1/worker-api/d1-database/ and the limits page.
- Each result's `meta.rows_read` and `meta.rows_written` show what a query cost (same D1 database API page).

What this means for us:

- **Replay blob, ~100 KB:** under the 2 MB row limit. Send it as a **bound parameter**. Inlined in the SQL text, it would hit the 100 KB statement limit. At 100 KB each, the 500 MB database holds about 5,000 replays. To keep more, store only top-N replays, prune old days, or use a second database. Cloudflare also lists R2 and KV as storage options, but this note does not research them.
- **Save Code (base64):** small and well under every limit.

## Rate-limiting binding

Sources: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ and https://developers.cloudflare.com/changelog/post/2025-09-19-ratelimit-workers-ga/

- **GA since 2025-09-19.** The `ratelimit` binding is stable. It needs **Wrangler >= 4.36.0**.
- **Plan and price: not stated.** None of the rate-limit docs, the Workers pricing page or the GA changelog name a plan or a price. Confirm it works on our Free account with a test deploy before relying on it.
- Config (`wrangler.toml`):
  ```toml
  [[ratelimits]]
  name = "MY_RATE_LIMITER"
  namespace_id = "1001"   # positive integer as a string, unique per account
  [ratelimits.simple]
  limit = 100
  period = 60             # only 10 or 60 allowed
  ```
- API: `const { success } = await env.MY_RATE_LIMITER.limit({ key })`. When `success` is false, return 429.
- **Behaviour:** "Rate limits are approximate and apply separately in each Cloudflare location." Counts are cached locally and synced in the background, so "requests can exceed your configured limit". Bindings that share a `namespace_id` share counters, even across Workers.
- The docs advise **against IP addresses as keys**, because many users can share one IP. Key on device id plus route instead. For a strict global limit, the docs recommend Durable Objects.
- These bindings do not appear in the dashboard. To see them, use Workers Logs or Analytics Engine.

## CORS from `https://seif-sallam.github.io`

Source: https://developers.cloudflare.com/workers/examples/cors-header-proxy/

Workers have no built-in CORS setting. Cloudflare's example does it by hand:

- **Preflight:** an `OPTIONS` request carrying `Origin`, `Access-Control-Request-Method` and `Access-Control-Request-Headers`. Reply with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` (for example `GET,HEAD,POST,OPTIONS`) and `Access-Control-Allow-Headers` (the example echoes the requested headers). Add `Access-Control-Max-Age: 86400`, so the browser caches the preflight for a day.
- **Actual responses:** set `Access-Control-Allow-Origin` and append `Vary: Origin`.
- Cloudflare's example uses `*` on preflight. For us, set an allow-list of exactly `https://seif-sallam.github.io`, plus `http://localhost:<port>` in dev. Echo the origin only when it matches. A custom header such as `Authorization` for the secret token triggers a preflight, and so does a `Content-Type: application/json` POST. Each preflight is one more Worker request against the 100K/day budget. `Max-Age` keeps that cost low.

## Deploy from GitHub Actions

Sources: https://github.com/cloudflare/wrangler-action, https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/, https://developers.cloudflare.com/workers/wrangler/commands/d1/, https://developers.cloudflare.com/d1/reference/migrations/, https://developers.cloudflare.com/fundamentals/api/reference/permissions/

- **Action:** `cloudflare/wrangler-action@v4`. It defaults to Wrangler v4, and tags need the `v` prefix. Inputs: `apiToken`, `accountId`, `command` (multi-line), `wranglerVersion`, `workingDirectory`, `preCommands`/`postCommands`, `secrets`, `environment` and `packageManager`. The `secrets` input takes newline-separated names; each is read from the job's `env` and pushed with `wrangler secret put`.
- **GitHub secrets:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- **API token:** create a custom account API token from the "Edit Cloudflare Workers" permission policy, scoped to the one account. D1 migrations need the account permission **D1 Edit** as well (the permissions page also lists it as "D1 Write"). The Workers scripts permission is "Workers Scripts Edit" (or "Write").
- **Migrations:** SQL files go in `migrations/` (set by `migrations_dir`), and applied ones are tracked in the `d1_migrations` table. Run `wrangler d1 migrations apply <DB_NAME> --remote`. The docs advise the database name rather than the binding name. A failing migration is rolled back, and earlier migrations stay applied. A backup is captured after each apply. **In CI or another non-interactive shell, the confirmation prompt is skipped.** The docs do not state whether `--local` or `--remote` is the default, so always pass `--remote` explicitly.
- Sketch:
  ```yaml
  - uses: cloudflare/wrangler-action@v4
    with:
      apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      workingDirectory: worker
      command: |
        d1 migrations apply wobbly-mart --remote
        deploy
  ```

## Open questions

- Is the rate-limiting binding usable on Free, and is it billed? The docs say nothing. Test it with a deploy.
- Is the 500 MB per-database cap on Free hard? The FAQ says only that the 10 GB Paid cap cannot be raised.
