# Wobbly Mart — rules for coding sessions

Arcade-idle store game, Three.js + TypeScript, static on GitHub Pages. Glossary: [CONTEXT.md](CONTEXT.md). Spec: [.scratch/my-mini-mart-web/spec.md](.scratch/my-mini-mart-web/spec.md). Run/test/deploy: [README.md](README.md).

## Layout and boundaries (ESLint enforces them)

- `src/sim/` — all rules, fixed 60 Hz timestep, seeded RNG. No Three.js, Preact, DOM, `Date.now()` or `Math.random()`.
- `src/view/` — Three.js; reads sim state only. `src/ui/` — Preact + DOM; reads sim state only. `src/input/` — keys/joystick → intents.
- `src/app/` glues them (loop, saves, guidance); `src/audio/` maps sim events to sounds; `src/editor/` is dev-only.
- `catalog/` shared Products, Producers, the asset table, credits. `maps/<id>/` is pure data; `layout.ts` is editor-owned.

## Conventions

- `camelCase` / `PascalCase` / `UPPER_CASE`, `kebab-case.ts` files, `strict`, no `any`.
- No magic numbers in `sim/`: they live in `catalog/`, map data or `src/sim/tuning.ts`. Feel/juice numbers live in `src/feel.ts`; the sim reads it only for the movement ramp, Area Pan, Thief Pan and Cash Pile drain timings. Colours only in `src/palette.ts` (`PALETTE` + `SHADES`).
- Minimal code: reuse or extend before adding; never duplicate; light comments.
- Runtime deps are only `three`, `preact`, `nipplejs`, `howler`, `lil-gui`. Another one needs the owner's OK in the PR.
- Tests: Vitest on `sim/` and the validator only — broad flowing tests, no mocking our own code.
- Branch + PR, small playable steps; commits single-line, no prefix. Released ids are never renamed (`maps/released-ids.json`).
