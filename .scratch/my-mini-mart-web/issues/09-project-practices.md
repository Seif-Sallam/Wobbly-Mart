# Define project practices

Type: grilling
Status: resolved
Assignee: Seif (claimed 2026-10-02)
Blocked by: 04

## Question

Given the chosen stack (Three.js + Vite + strict TS + Preact panels, npm, Actions → Pages): what repo layout, testing approach (tool, and what is worth testing — e.g. simulation/economy logic vs rendering), lint/format setup, CI checks before deploy, and code conventions do we adopt, so the owner can judge good/bad practice as code is written?

## Answer

Resolved 2026-10-02 (grilling).

- **Architecture:** brain/picture split. `src/sim/` = all rules, fixed timestep, no Three.js/UI imports; `src/view/` (Three.js) and `src/ui/` (Preact + HTML/CSS) only read sim state; `src/input/` turns keys/joystick into intents. `maps/` and `catalog/` as in [Define the map template for future levels](06-level-template.md). An ESLint rule enforces the boundaries.
- **Minimal code (standing rule):** only as much code as needed; no redundant or duplicated code — reuse/extend first and push back on anything that repeats existing work. Light comments; optimise for the next person updating or debugging.
- **Lint/format:** ESLint (typescript-eslint strict) + Prettier.
- **Tests:** Vitest. Test `sim/` and the map validator only, as broad flowing tests: happy paths, the likely culprits, common error cases. No tests for rendering/feel/UI or trivial one-off scripts. No mocking our own code — only fake input and the seeded RNG.
- **Bot playthrough:** headless scripted bot plays the first map at high speed in CI; fails if 100% Completion isn't reachable (softlocks, unreachable Pads). Prints simulated time as information only (feeds [Author the first map's price table and timings](10-price-table.md)).
- **Conventions:** `camelCase` / `PascalCase` / `UPPER_CASE`, `kebab-case.ts` files; no `Date.now()`/`Math.random()` in `sim/` (sim clock + seeded RNG); no `any`; no magic numbers in `sim/` (catalog, map or `tuning.ts`).
- **Workflow:** branch + PR, merge only when green. Commits single-line, **no `ClaudeCode:` prefix**. PR descriptions short and to the point: summary, how to try it, new deps, reused vs added. Small PRs, one playable/testable step each. No PR preview deploys — owner tries branches via `npm run dev`.
- **CI gate (PRs and `main` before deploy):** typecheck, lint, format check, tests (incl. bot playthrough), map validation, production build. Bundle-size check waits for the performance budget.
- **Dependencies:** any new runtime dependency beyond Three.js, Preact, nipplejs, howler needs owner OK in the PR with a one-line reason; dev tools just listed.
- **Release:** every merge to `main`. A committed `released-ids.json` (updated by CI) backs the "ids removed since last release" validation.
- **Docs:** short root `CLAUDE.md` (rules above for coding sessions), `README.md` (run/test/deploy for humans), `CONTEXT.md` stays the glossary; each links, nothing repeated.
- **Debug panel:** hidden behind `?debug`, shipped in the live build — live tuning sliders (same tuning values the game reads) + cheats (+Money, unlock all, sim speed).
