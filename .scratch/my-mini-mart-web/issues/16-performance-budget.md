# Set the performance budget

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-03)
Blocked by: 15

## Question

Which devices and frame rate do we commit to, what are the download-size and load-time limits, and what does the CI bundle-size check enforce?

## Context

Facts from [Research performance limits for a Three.js phone game](15-performance-research.md). Asset sizes: research 02 §B3 (~4–5 MB of Kenney assets). The CI gate waits on this ([Define project practices](09-project-practices.md)).

## Answer

Resolved 2026-10-03 (grilling). Accepts the proposal in `research/15-performance.md` §5.

**Devices and frame rate**
- Phones: a ~2021 mid-range Android and iPhones from the last ~5 years. Desktop: any laptop with built-in graphics.
- 60 fps target everywhere; 30 fps floor on phones.

**Download and load** (gzip, as GitHub Pages sends it) — locked now
- Initial JS ≤ 250 kB; total first load ≤ 1.2 MB; playable ≤ 5 s on Lighthouse Slow 4G, never > 10 s.
- Owner is fine going a bit over: raising a limit is a config change in the PR with a one-line reason, not a redesign.

**CI**
- `size-limit` + `@size-limit/file`, `gzip: true`, one step after `vite build`; any breach fails the build. No headless load-time check.

**Rendering** — provisional until the first playable build runs on the owner's phone, then adjusted once
- Phones ≤ 100 draw calls and ≤ 150k triangles per frame, shadow pass included (desktop ≤ 300 / 500k).
- Static store merged per pack material; Items and Money instanced.
- One shadow-casting directional light, `PCFShadowMap` + `shadow.radius`, 1024² on phones / 2048² on desktop; floors only receive.
- Characters use blob shadows (one instanced quad) on **every** device — one code path.
- Pixel ratio `min(dpr, 2)`, stepping down automatically 2 → 1.5 → 1 when frames run slow; no Quality setting.
- MSAA on.

**Checking it**
- The `?debug` panel shows draw calls, triangles and fps, and logs a console warning over budget. No CI draw-call test for now; the bot playthrough's fully unlocked map is where to add one if counts creep.
