# 14 — Browser storage for save data (localStorage on GitHub Pages)

Researched 2026-10. Primary sources linked inline.

## 1. Safari / iOS

- **7-day cap still applies.** With cross-site tracking prevention on (the default), if an origin gets no user interaction (click/tap) in the last 7 days *of Safari use*, all its script-written data is deleted. Covers localStorage, IndexedDB, sessionStorage, Cache API, SW registrations. ([MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [WebKit 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/))
- **It applies to first-party sites the user visits directly.** That is the point of the rule. Days are counted only while Safari is in use, not as calendar days. Any interaction on the site resets the clock, so a player who taps in the game at least once in 7 days of Safari use keeps the save.
- **Home Screen web apps are effectively exempt.** They keep their own day counter, which only advances when the app is used, so "we do not expect the first-party in such a web application to have its website data deleted." ([WebKit 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [web.dev](https://web.dev/articles/storage-for-the-web))
- **Safari 17 storage policy** ([WebKit 2023](https://webkit.org/blog/14403/updates-to-storage-policy/)):
  - Quota per origin is about 60% of disk for the browser and Home Screen apps, about 15% for apps that embed WebViews, and 1/10 of the parent's quota for cross-origin frames.
  - Eviction is LRU by origin, using the last user interaction or storage operation. It triggers on quota overflow, storage pressure, or ITP inactivity, so the 7-day rule is still in force.
  - `navigator.storage.persist()` / `persisted()` are supported in 17.0+. Safari grants persistence by heuristic and **never prompts**. The main signal is whether the site is open as a Home Screen web app. Origins in persistent mode, or with an active page, are excluded from eviction.

## 2. Chrome / Android / Firefox

- Storage is "best-effort" by default. localStorage and IndexedDB are not evicted separately: eviction removes **all of an origin's data at once**, least recently used origin first, when the disk is under pressure. ([web.dev storage](https://web.dev/articles/storage-for-the-web), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria))
- Chrome has no inactivity timer like Safari's. Data is lost only under storage pressure or when the user clears it.
- `persist()` marks the origin's storage (including localStorage and IndexedDB) as exempt from automatic eviction. Only the user can then clear it. ([web.dev persistent-storage](https://web.dev/articles/persistent-storage))
  - **Chrome/Edge:** no prompt. It is auto-granted based on site engagement, whether the site is installed or bookmarked, and notification permission. If denied, the site can ask again later.
  - **Firefox:** **shows a permission popup** to the user.
  - **Safari:** no prompt (heuristic, see above).
- Quotas: Chrome allows about 60% of disk per origin. Firefox allows the smaller of 10% of disk or 10 GiB for best-effort storage, and 50% of disk for persistent. (MDN)

## 3. localStorage quota and the GitHub Pages origin

- localStorage is limited to **about 5 MiB per origin** in all browsers, stored as UTF-16 strings, so the real capacity is roughly 2.5M characters. Going over throws `QuotaExceededError`, so wrap `setItem` in try/catch. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria))
- **Confirmed: every project site under `<user>.github.io/<repo>` shares one origin**, because the origin is scheme + host + port and the path is not part of it. That means all of the user's Pages sites share the same 5 MiB of localStorage, the same IndexedDB, and the same eviction fate, and keys can collide. ([MDN same-origin](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [GitHub Pages docs](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages), [community discussion](https://github.com/orgs/community/discussions/60479))
  - Mitigation: prefix keys with a namespace such as `my-mini-mart:save:v1`, or use a custom domain, which gives the site its own origin. Moving to a custom domain later strands any existing saves on the old origin. ([auroratide](https://auroratide.com/posts/migrating-localstorage-to-new-domain/))

## 4. Private browsing

- **Safari 11+:** localStorage works in Private Browsing. It is held in memory and discarded when the private tab/session closes. Before Safari 11, `setItem` threw `QuotaExceededError` (quota 0). Old code that detects private mode by catching that error no longer works. ([caniuse PR #3562](https://github.com/Fyrd/caniuse/pull/3562))
- **Chrome Incognito / Firefox Private:** storage works with a smaller quota (Chrome allows about 5% of disk) and is deleted when the private session ends. ([web.dev](https://web.dev/articles/storage-for-the-web), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria))
- The game can't reliably detect that it is in a private session. Treat every save as possibly temporary.

## Implications for save design

- localStorage is fine for a small JSON save. Namespace the keys and wrap reads and writes in try/catch.
- On iOS Safari a lapsed player can lose the save after 7 active days without visiting. The only real exemption is "Add to Home Screen". It is worth calling `navigator.storage.persist()` (no prompt in Chrome/Safari; Firefox shows one, so call it after a user gesture). Offer a manual export/import code as a backstop.
