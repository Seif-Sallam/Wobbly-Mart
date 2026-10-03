# Wobbly Mart

A browser arcade-idle store game: grow crops, feed animals, run machines, stock Shelves, check out Customers, spend the Money on more store. Rules for contributors: [CLAUDE.md](CLAUDE.md) · glossary: [CONTEXT.md](CONTEXT.md) · credits: [CREDITS.md](CREDITS.md).

## Run

```bash
npm ci
npm run dev          # http://localhost:5173 — add ?debug for the debug panel
```

Dev-only tools: press **V** (or open `?edit`) for the layout editor; `?map=<id>` picks a map.

## Test

```bash
npm run typecheck && npm run lint && npm run format:check
npm test             # Vitest: sim + map validator
npm run bot          # headless bot plays every map to 100% Completion
npm run validate     # map validator (add --record before a release to freeze ids)
npm run build && npm run size && npm run check:dist
```

## Deploy

Every push to `main` runs the CI gate and deploys `dist/` to GitHub Pages (`.github/workflows/ci.yml`). In the repo settings, set Pages → Source to **GitHub Actions**.

## Assets

- Models: Kenney GLBs in `public/models/<pack>/`, named in `catalog/assets.ts`. After adding a character or animal, run `npx tsx scripts/optimize-models.ts`.
- Sounds: `KENNEY=… FS=… scripts/build-audio.sh` rebuilds the SFX sprite and music (sources in CREDITS.md).
- Icons: `npx tsx scripts/icons.ts`. Credits: `npm run credits`.
