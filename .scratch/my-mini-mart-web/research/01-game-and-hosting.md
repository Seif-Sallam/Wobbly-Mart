# My Mini Mart: game research and web-hosting feasibility

Researched 2026-10-02. Every claim has a source. **[UNVERIFIED]** marks single-source or inferred claims. **[DESIGN SUGGESTION]** marks numbers or behaviour we propose for the clone; these are not facts about the original.

Main sources:
- Google Play listing: https://play.google.com/store/apps/details?id=com.KisekiGames.smart&hl=en_US (GP)
- App Store listing: https://apps.apple.com/us/app/my-mini-mart/id1592004814 (AS)
- App Store customer reviews RSS feed, top 5 pages, sorted by most helpful: https://itunes.apple.com/us/rss/customerreviews/page=1/id=1592004814/sortby=mosthelpful/json (ASR). These reviews are the richest source for mid- and late-game content, but each is one player's account.
- PocketGamer.biz deconstruction: https://www.pocketgamer.biz/under-the-hood-deconstructing-the-top-hypercasual-games/ (PGB)
- Azur Games deconstruction (via WN Hub): https://wnhub.io/news/game-design/item-40717 (AZ)
- Supersonic's own genre blog: https://supersonic.com/learn/blog/how-to-ideate-and-build-a-profitable-idle-arcade-game/ (SS)
- PocketGamer tips: https://www.pocketgamer.com/my-mini-mart/tips-and-tricks/ (PG)
- Gamezebo guide: https://www.gamezebo.com/walkthroughs/my-mini-mart-strategy-guide-stock-the-shelves-with-these-hints-tips-and-cheats-2/ (GZ)

No Fandom wiki exists for this game. A Fandom search returned only unrelated "Mini Mart" pages. Reddit and AppGamer Q&A pages were blocked to automated fetch (Cloudflare and Reddit API), so Reddit content below comes only through secondary aggregators.

---

## Key takeaways for a web clone

1. **Genre: "idle arcade" / "arcade idle".** You control one character with a virtual joystick (drag or slide). Every interaction happens when you get close: walk over a source to pick items up, walk to a shelf to drop them, stand at the register to check customers out, stand on a price pad to pay for an unlock. There are no buttons in the core loop. (Uptodown: https://my-mini-mart.en.uptodown.com/android; Udonis: https://www.blog.udonis.co/mobile-marketing/mobile-games/arcade-idle; SS)
2. **The opening loop to rebuild first** (PGB unlock order): cash box/register → tomato shelf → tomato bed → egg shelf → chicken coop (chickens eat tomatoes) → blender (tomatoes become ketchup/sauce) → second chicken spot ($50) → new area ($95) plus trash bin → extra shelf ($60). That is roughly the first 30–40 minutes, after which the player moves to a new mart (PGB, AZ).
3. **The stack on the character's back is the core "feel".** Ads, Supersonic and deconstructions all name stacking as the most satisfying element (SS, Udonis). It needs bouncy per-item pickup tweens, a visible tower that wobbles, and items arcing into shelves.
4. **Pay-by-standing pads.** A locked thing shows a price tag on the floor. Standing on it drains money into it in a stream until it unlocks, and then the camera pans to the next thing you can buy (PGB, AZ).
5. **Automation via staff:** cashier, shelver/stocker, farmer, chef. You buy them on pads and upgrade their speed and capacity. In the original, workers have notoriously poor AI (ASR), and the clone can improve on that.
6. **Meta-progression:** a sequence of marts with different themes (Mart 1, Mart 2, Burger, Sushi, Mexican, Asian, Campsite, ... reportedly up to "Mart 14"). Each mart has a completion % and a 5-star rating, plus prestige ("rebuild" at 100%) that pays gold bars (ASR). For a clone MVP, 1–2 marts are enough.
7. **Tech recommendation:** Three.js with low-poly primitives or glTF and a hand-written game loop. It gives the smallest bundle (~0.8 MB raw / ~0.2 MB gzip for the core) and fits GitHub Pages perfectly. Godot 4 single-threaded web export is the viable "engine" alternative. Unity WebGL is workable but awkward on Pages, which has no `Content-Encoding` header control.
8. **GitHub Pages is a good fit:** static only, ≤1 GB site, 100 GB/month soft bandwidth, free HTTPS, custom domains. There are no custom headers (no COOP/COEP), so avoid anything that needs SharedArrayBuffer/threads. Save data goes in `localStorage`.

---

## 1. Overview

| Item | Finding | Source |
|---|---|---|
| Title | My Mini Mart | GP, AS |
| Publisher / store seller | **Supersonic Studios LTD**, on both stores. Support email `support@supersonic.com` | GP (page HTML), AS |
| Original developer | **Kiseki Games** (the Android package id is `com.KisekiGames.smart`). AppGrooves lists it as "Kiseki Games Pty Ltd" **[UNVERIFIED that this is the exact legal entity; "Pty Ltd" suggests an Australian company]** | GP URL; https://appgrooves.com/app/my-mini-mart-by-kiseki-games-pty-ltd/positive |
| "Fumb Games" | **Not confirmed.** No source links Fumb Games to My Mini Mart. The brief's "Fumb Games" attribution looks wrong; the developer is Kiseki Games and the publisher is Supersonic | searches for "Fumb Games" "My Mini Mart" returned nothing relevant |
| Supersonic ownership | Supersonic was ironSource's publishing label and became part of Unity after the 2022 ironSource merger. Unity sold Supersonic to **Tripledot Studios for ~$40M** in 2026 (deal reported closed Aug 4) | https://mobilegamer.biz/unity-completes-sale-of-mobile-publisher-supersonic-to-tripledot-for-40m/ ; https://wnhub.io/news/engines/item-51695 ; https://gameworldobserver.com/2026/03/27/unity-will-sell-supersonic-and-shut-down-the-ironsource-ads-network |
| Release date | First launched **December 14, 2021**. Released at the end of 2021, but the breakout came in 2022 | https://game-solver.com/my-mini-mart/ ; AZ |
| Platforms | Android (Android 7.0+), iOS/iPadOS. There is also a web version on YouTube Playables and portals (Lagged, Miniplay, GoGy) | Uptodown; https://www.youtube.com/playables/Ugkxto-OwJZo4rm8Xl2Nj3K403nHlYThf-sr ; https://www.miniplay.com/game/my-mini-mart ; https://lagged.com/en/g/my-mini-mart |
| Engine | Unity **[UNVERIFIED; inferred from Supersonic/Unity context and typical genre stack, not confirmed by a primary source]** | — |
| Genre | Idle arcade / hybrid-casual. App Store category "Casual"; Google Play "Simulation" | AS; game-solver; Udonis |
| Size | ~629 MB on iOS; ~274–277 MB APK | AS; Uptodown |
| Ratings | Google Play: **4.2★ (704,061 ratings), 100M+ downloads**, updated Sep 28, 2026. App Store US: **4.6★ (~126K ratings)**, version 1.89.5, rated 13+ | GP page data (fetched 2026-10-02); AS |
| Popularity | "The most successful idle arcade game of last year [2022] in terms of the number of installations". 70M+ downloads, >$2M revenue lifetime; ~3M downloads/month and >$100K/month revenue in early 2023 | AZ |
| Genre KPIs (Supersonic) | Idle arcade averages "D0 playtime of 1200s–1800s" and CPI ~$0.50 | SS |

### Monetization
- **Ads-heavy.** Interstitials appear "multiple times per minute" (AZ). Players report forced ads every 15–60 seconds or every 2–3 minutes (ASR; game-solver). Rewarded ads give boosts: "double the customers for 5 minutes, 5x speed, machine and worker upgrades", found "at the ATM or subtly on the side of your screen" (ASR).
- **The game blocks offline play when an ad cannot load:** it shows a fake "No Internet" screen even though the gameplay is fully offline (ASR, 2025-09-23 review; game-solver).
- **IAP** (AS): Remove Ads $4.99, Remove Pop Up Ads $2.99, Money Offer $4.99–$6.99, cash bundles $5.99–$7.99, limited offers and bundles $2.99–$9.99.
- **Hard currencies.** "Coupons" are bought with IAP or earned from rewarded videos and spent on upgrades, boosters and soft-currency acceleration (PGB, AZ). Reviews also mention **gems** (e.g. "25 gems" in the no-ads pack; "$80 for 50 gems") and **gold bars** from prestige that have little use (ASR). **[UNVERIFIED: these currencies may have been renamed across versions]**

---

## 2. Core gameplay loop

- **Movement.** "Slide your finger in the direction you want to go"; collecting, restocking and transactions happen automatically when you are close (Uptodown). The genre standard is a floating virtual joystick (Udonis). Web portals describe it as "Click or tap to interact" (Lagged) and "SELECT / MOVE" (Miniplay).
- **Loop** (AZ): "the player collects the generated products, places them on the shelves, then visitors come, pick up the products, approach the checkout and leave the money." The player then spends that money on new generators, shelves and staff.
- **Treadmill feel:** "constantly running from the tomato plants to the shelves to the register" (PG). GZ: "never stand still on the job. Run around, pick things up, find out what needs restocking."
- **Production chains.** "No resource left behind": you can "sell the tomatoes as-is" or "feed tomatoes to chickens and get eggs" (SS). An ideal mart has 2–3 chains running at once (PGB).
- **Cash handling.** Customers leave money piled at the register/cash box, and the player has to walk over it to collect (AZ; GZ "money that's piled up on your cashier's counter"). Players asked for auto-collection, so collection is manual by default (ASR).
- **Trash bin.** Lets you dump the wrong items from your stack. It appears when the second area unlocks (PGB; GZ "Use bins to dump excess inventory"). Players complain that walking past a station picks up items they didn't want, which forces them to use the bin (ASR).
- **Thief event.** If too much cash sits at the till, a thief steals it. You switch to a net and chase him, "lining up the aim marker to capture the thief before they escape" (PG, GZ). Dropped money then has to be picked up, and players say "the pick up radius for money dropped by a thief is too low" (ASR).
- **Orders, trucks and car deliveries.** Reviews mention "if a truck comes in and i need sugar" and "$400 from a car delivery" (ASR). These are timed bulk orders, separate from walk-in customers **[UNVERIFIED details; single reviews]**.
- **Ad-gated progress.** The 2026 review "First few levels are fun" says ads are "optional to help you get ahead, but then at some point" they become required (ASR).

---

## 3. Stations and entities

### Confirmed opening sequence (Mart 1)
From PGB, in unlock order:
1. **Cash box** (register; "provides soft currency")
2. **Tomato shelf** (display)
3. **Tomato bed** (resource source)
4. **Chicken egg shelf**
5. **Chicken coop** (chickens are fed tomatoes; AZ)
6. **Blender**: "converts tomatoes to ketchup". Other sources call the product tomato paste (AZ) and tomato/marinara sauce or tomato soup (ASR)
7. Second chicken spot: **$50**
8. New location/area: **$95**
9. **Trash bin** (appears with the new location)
10. Additional display: **$60**

### Products and stations seen across sources
| Category | Items | Source |
|---|---|---|
| Crops | Tomato (tomato bed/plant), wheat (field "squares"; one more square cost $300 in Mart 2), corn, apples (unlocked in Mart 2), basil (Asian mart) | PGB; ASR; GZ ("barley") |
| Animal feed | Chickens eat tomatoes (AZ). Cows eat wheat ("wheat is used to make flower, bread, feed the cow"). Hay/barley are also mentioned for cows (GZ; iofreeonline) | AZ; ASR; GZ |
| Animals | Chickens → eggs; cows → milk (milk goes in a "milk fridge") | GP; ASR |
| Machines | Blender/juicer/"mixer" (tomato → sauce); flour mill (wheat → flour); bread maker (flour + eggs (+ sugar?) → bread); sugar maker (wheat → sugar **[UNVERIFIED]**); jam/preserves bottling; cookie maker; coffee | PG; ASR |
| Shelves | One shelf per product: tomato shelf, egg shelf, wheat shelf, flour shelf, bread shelf, milk fridge, sauce shelf, etc. | PGB; ASR |
| Rooms/areas | "Coffee and cookie room" (an expansion inside Mart 1 **[UNVERIFIED placement]**); an "under construction" zone; a bigger map with money "laying in the streets" (2026 update) | ASR |
| Other | Cash register(s); a second cash register comes later; ATM (where boosts live); trash bin; net (thief) | PGB; ASR |

### Marts (the meta map)
Reviews name these marts. **The order is partly [UNVERIFIED].**
- **Mart 1**: tomato/egg/ketchup start, then wheat, flour, bread, milk, coffee and cookies.
- **Mart 2**: wheat, apples. A 2025 update replaced it with a new "Asian mart" that has Chinese and Japanese sections, flour bags, basil and a seafood section that needs eggs.
- **Mart 3**: added in an update.
- **Burger Mart / burger restaurant**: chefs (a "Chef B" bug leaves it stuck at 97% completion).
- **Sushi Mart / sushi restaurant**: fish; a chef upgrade cost "$910,000" while checkouts earn "~1,000 each".
- **Mexican Mart**: one player saw "a weird drop off in earnings and cost after the Mexican Mart".
- **Campsite**: reported as the end of the road in 2025.
- Players report reaching "Mart number 8" and "Mart 14" (2023). Seasonal "themed stores during the holidays" also exist.

Sources: ASR; game-solver; https://www.youtube.com/watch?v=JzI3aoBDu-s ("Go To Burger Mart"). game-solver's "4-store limit" claim looks dated.

### Costs
Early costs are tens of dollars ($50/$60/$95, PGB). Customer payments are about 20–30 coins per transaction early on, and machine upgrades cost 1200+ (https://www.iofreeonline.com/IOS/game/My-Mini-Mart.html). Late-game checkouts are ~1,000 each and upgrades reach ~$910K (ASR). Prices rise as the mart expands (ASR).

---

## 4. Staff / helpers

| Role | What it does | Source |
|---|---|---|
| **Cashier** | Staffs the till and checks customers out. You still collect the cash yourself | PG; AZ |
| **Shelver / stocker / merchandiser** | Moves produce from fields/sources to shelves. It does not load machines; it can take items out of machines but not put them in | PG; AZ; ASR |
| **Farmer** | Harvests crops and feeds animals (e.g. carries wheat or tomatoes to chickens/cows) | ASR ("farmer pathing ... can't collect tomatoes to feed the chickens") |
| **Chef** | Runs processing machines (flour mill, bread, burger, sushi). Chefs are named per station (e.g. "Chef B" in Burger Mart) | ASR |
| Generic helper | The early "funny pink guy" assists with "all the routine tasks" | PGB |

- **Hiring:** each worker is bought on a pad in the store. A list screen shows workers and stations (ASR).
- **Upgrades:** workers, machines and animals can be upgraded for speed and capacity ("carry more items") with soft currency or coupons (PGB; https://www.iofreeonline.com/IOS/game/My-Mini-Mart.html; ASR "leveled up on the speed and limit of the machines and staff").
- **Known AI flaws** (the clone can do better): workers bunch up, get stuck on counters, duplicate the player's work, take items and throw them in the trash, and won't shelve some items. Players want to assign workers to specific products (ASR; game-solver).
- **Genre comparison:** in Monkey Mart, workers tire and fall asleep, and upgrades are Stamina/Stack/Speed to level 4 (https://poki.com/en/g/monkey-mart). No source says My Mini Mart workers sleep. **[UNVERIFIED for MMM]**

---

## 5. Upgrades and progression

- **Player upgrades:** carry capacity and speed. "The more goods you can carry, the more useful you can be" (GZ).
- **Station upgrades:** faster generation, larger capacity, more plant squares or animals (e.g. a second chicken spot).
- **Expansion:** new areas inside a mart unlock on pads, and the camera pans to each newly available thing (PGB).
- **Completion:** each mart has a completion % from unlocking "Plants, Animals, Shelves, Machines, Workers, and M[ore]". At 100% you can "rebuild"/prestige (ASR).
- **Stars:** each mart is rated up to **5 stars**. Players talk about "full 5 star prestige on every mart" and "five starred" marts (ASR).
- **Prestige:** rebuilding a completed mart pays out gold bars. You have to re-upgrade equipment in every mart (ASR).
- **New mart:** around 30–40 minutes in, the player moves to a new market, which clears clutter and "replays familiar chains alongside fresh production networks" (PGB, AZ). Each location hints at future areas (AZ).
- **Idle/offline earnings:** one review says you can "leave your phone sitting on a table collecting the cash register, should take about an hour", which implies staff keep earning while you are present but idle. "Daily dollars" are a daily reward (ASR). A 2026 review mentions "bagging stacks every two hours" around the map, which suggests timed money pickups. True offline earnings while the app is closed are **[UNVERIFIED]**.
- **Boosts:** 2× customers for 5 min, 5× speed, temporary upgrades via rewarded ads (ASR).

---

## 6. Customer mechanics

- Customers walk in, go to a product shelf, take items, walk to the register queue, pay and leave (AZ).
- **Demand:** expanding variety "automatically attracts more customers" (iofreeonline). Customers stand and wait at empty shelves, and a full store gets queues of 5 at the till (ASR). A wider product range spreads demand across products ("less people are buying the wheat because there are more options").
- **Patience:** this is disputed. One review says customers "don't get mad ... except happy faces when they check out"; another says customers end up "walking out the door angrily" when supply is too slow. Later marts have "angry customers" (ASR). Mild patience with an angry exit at the extreme is the most likely model **[UNVERIFIED exact rules]**.
- **Payment:** money is dropped at the register as a pile of bills or coins that the player collects. Early ~20–30 per customer (iofreeonline), late ~1,000 (ASR).
- **Tips:** no source mentions tips **[NOT FOUND]**.
- **Spawn rate:** no published numbers **[NOT FOUND]**. **[DESIGN SUGGESTION]** Spawn one customer every 4–8 s, scaled by the number of unlocked shelves. Each customer wants 1–3 units of 1–2 product types.

---

## 7. Camera, art style, UI

- **Camera:** fixed-angle 3D, three-quarter top-down (isometric-like perspective) that follows the player. It pans to newly purchasable points of interest (PGB, AZ). Ad creatives use a "zoomed in perspective" (SS). Players note the camera sometimes "will pan to nothing" (ASR).
- **Art:** low-poly, bright, clean 3D; "clean, easy-to-read visuals" (PG/search summary). An early checkerboard floor "was later removed so it was easier to understand the flow of the game" (SS). In other words, use a plain floor so that items and paths stand out.
- **UI:**
  - money counter at the top
  - price tags or pads on the floor for purchases (PGB "Price tags highlight available purchases")
  - textless arrow tutorial: "The tutorial uses directional arrows without text" (AZ); "highlighted points of interest and arrows during the tutorial" (PGB)
  - completion % and stars per mart
  - side-of-screen boost buttons
  - a shop for currencies and offers
  - a worker/station list screen (ASR)
- **Sound:** animals make sounds ("The animals do make sound at first it's funny") and the action sounds are "so loud" (ASR).

---

## 8. Notable "feel" details

- **The stack:** items stack vertically on the character's back or hands. This is the signature ad visual (SS, Udonis).
- **Satisfying collection animations:** "Animations throughout collection and processing create engagement despite repetitive tasks" (PGB). Players say "the animations are incredible" (ASR).
- **Money piles** at the register, bagged up as you walk through them (AZ; ASR "bagging stacks").
- **Pay-by-standing:** stand on a price pad and money flies into it until it is paid (PGB price tags). The pad shows the remaining cost **[exact animation UNVERIFIED; genre standard]**.
- **Camera pans** reveal each new unlock (PGB).
- **Thief chase with a net** as a light action interlude (PG).
- **Machines** show input and output stacks, e.g. tomatoes in and ketchup out (PG, ASR).
- **[DESIGN SUGGESTION]** Juice checklist:
  - squash and stretch on pickup
  - arc tweens from source to stack to shelf
  - a slight lag and wobble in the stack as the player turns
  - coins that fly toward the HUD counter
  - a pop with confetti on unlock
  - a pitch-rising "tick" sound while paying
  - a floating "+$" on each sale

---

## 9. Similar games and genre conventions

| Game | Developer/publisher | Relevance | Source |
|---|---|---|---|
| **Monkey Mart** | TinyDobbins (Poki), Nov 2022 | **Browser-native near-clone**: bananas, corn, wheat, coffee and cocoa; animals fed corn give eggs/milk; yogurt, popcorn, coffee and chocolate; cashiers, assistants, farmers, chefs; Stamina/Stack/Speed upgrades to level 4; 6 marts. The best web reference for controls and pacing | https://poki.com/en/g/monkey-mart |
| My Super Tiny Market | Poki | Web genre peer | https://poki.com/en/g/my-super-tiny-market |
| My Perfect Hotel | SayGames | Top arcade idle | Udonis |
| Pizza Ready!, Burger Please! | Supercent | Top arcade idle; a player compares them with My Mini Mart | Udonis; ASR |
| Farm Land | Homa Games | Farming arcade idle | Udonis |
| Pro Builder | Black Candy / Supersonic | Supersonic idle arcade | https://supersonic.com/learn/case-studies/pro-builder/ |
| Coffee Stack, Gem Stack | — | Stack-runner peers players mention | ASR |

**Genre conventions** (SS, Udonis):
- constantly moving character on a virtual joystick
- stacking resources
- unlock, expand, explore
- upgrades
- an input/output balance (collect, then give to unlock)
- the feeling of servicing others

---

## 10. Hosting on GitHub Pages

| Constraint | Value | Source |
|---|---|---|
| Content type | Static HTML/CSS/JS straight from a repo, with an optional build step; **no server-side code** | https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages |
| Source repo size | Recommended ≤ **1 GB** | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits |
| Published site size | ≤ **1 GB** | same |
| Deploy timeout | 10 minutes | same |
| Bandwidth | **Soft** limit of **100 GB/month** | same |
| Builds | Soft limit of 10/hour. This does not apply to custom GitHub Actions workflows | same |
| Rate limiting | May return HTTP 429 | same |
| Usage restriction | Not for commercial transactions or SaaS; no passwords or credit cards | same |
| Single file size | Git warns >50 MiB, GitHub blocks >100 MiB (LFS needed) | https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github |
| Publishing source | Branch root `/` or `/docs`, or a GitHub Actions workflow (recommended for Vite builds) | https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site |
| Visibility | Sites are public even from private repos. Private-repo Pages needs a paid plan | same |
| URLs | `<owner>.github.io` (user site) or `<owner>.github.io/<repo>` (project site). **The game needs a relative base path** (e.g. Vite `base: '/<repo>/'`) | what-is-github-pages |
| Custom domain | Apex (A/ALIAS/ANAME) or subdomain (CNAME). GitHub recommends also using `www`. Verify the domain to avoid takeover | https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages |
| HTTPS | Free Let's Encrypt certificates, including on custom domains; can be enforced; avoid mixed content | https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https |
| Compression | Pages serves gzip automatically | Godot docs: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html |
| Custom headers | **Not supported**, so no COOP/COEP and therefore no SharedArrayBuffer. The workaround is the `coi-serviceworker` shim | https://github.com/orgs/community/discussions/13309 ; https://docs.wasmer.io/sdk/wasmer-js/how-to/coop-coep-headers/ |

**Verdict:** this fits. A Three.js game with procedural or low-poly glTF assets will be a few MB, far below every limit. Persist saves in `localStorage`/IndexedDB.

---

## 11. Web tech options for a low-poly 3D arcade idle

Sizes were measured from jsDelivr (latest npm versions on 2026-10-02) and gzip -9 locally:

| Option | Bundle notes | Pros | Cons |
|---|---|---|---|
| **Three.js** (r186 / v0.186.1) | `three.module.min.js` 393 KB (90 KB gz) plus `three.core.min.js` 416 KB (104 KB gz), so **~0.8 MB raw / ~0.2 MB gz** for the core; tree-shakable with Vite | Smallest; huge ecosystem (GLTFLoader, examples); full control; easy GitHub Pages deploy with Vite | Rendering library only: you write the game loop, input, UI, tweening and pathfinding yourself (the genre needs little physics) |
| **Babylon.js** (@babylonjs/core 9.29) | Full UMD `babylon.js` 8.6 MB (1.85 MB gz). Tree-shaken ES modules are much smaller, but the package is still heavier than Three | Batteries included (GUI, physics plugins, inspector, scene tools); good TypeScript support | Larger payload; tree-shaking needs care |
| **PlayCanvas** (engine 2.23) | `playcanvas.min.mjs` 2.55 MB (654 KB gz) | Game-oriented engine (entity-component, physics, audio); a polished cloud editor that can export a static build | Heavier; best workflow is tied to its online editor |
| **Godot 4** web export | Engine WASM is several MB (compresses to ~¼ with gzip, per Godot docs); needs WebGL 2; Compatibility renderer only | Full editor and engine; since 4.3, single-threaded export is the default and **needs no COOP/COEP, so it works on Pages** | Multi-MB download and slower first load; **no C# on web in Godot 4**; Safari WebGL2 quirks |
| **Unity WebGL** | Typically tens of MB | Same engine as the original **[UNVERIFIED that the original is Unity]**; mature tooling | Pages cannot set `Content-Encoding`, so you must use "Decompression Fallback" ("larger loader size and a less efficient loading scheme") or disable compression; heavy on mobile browsers |

Sources: Godot export docs (https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html); Unity deploy docs (https://docs.unity3d.com/Manual/webgl-deploying.html); npm registry and jsDelivr for sizes.

**Recommendation:** Three.js with Vite and TypeScript. Use instanced low-poly meshes (or Kenney-style CC0 glTF), a nipple-style virtual joystick (pointer events) plus WASD, an HTML/CSS overlay for the HUD, a tiny tween helper, grid/waypoint navigation for NPCs, and `localStorage` saves. Deploy with the official `actions/deploy-pages` workflow.
