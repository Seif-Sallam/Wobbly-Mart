# Research web 3D stack, deploy path, and free asset coverage

Type: research
Status: resolved
Blocked by: —

## Question

For an AI-written TypeScript arcade-idle game with a fixed isometric camera: how do Three.js, Babylon.js and PlayCanvas (engine-only) compare on learning curve, built-ins (glTF loading, animation, instancing, UI, input), bundle size and docs? What does a Vite + GitHub Actions → GitHub Pages deploy look like? Which free (CC0 preferred) low-poly packs cover farm crops, farm animals, a mini-mart (shelves, counter, products), animated people, and environment — and are their styles compatible?

Findings: `.scratch/my-mini-mart-web/research/02-tech-stack-and-assets.md`.

## Answer

Findings in `research/02-tech-stack-and-assets.md` ([MEASURED] = verified by download).
- Three.js over Babylon: ~161 KB vs ~676 KB gzip for an equivalent scene; ~48× npm downloads (more examples). Babylon's GUI/physics don't help this game.
- Three.js companions: GLTFLoader + SkeletonUtils.clone, AnimationMixer, InstancedMesh, HTML/CSS HUD overlay, nipplejs (touch joystick), tween.js, howler; ortho camera follow; no physics engine.
- Deploy: Vite official Pages workflow (deploy-pages@v5 etc.), `base` set for project pages, `.glb` in `public/`. Pages gzips, caches 10 min, no header control.
- Assets: Kenney CC0 covers ~85% in one style (Mini Market, Mini Characters, Cube Pets, Food Kit, Nature Kit; GLB, animated). Gaps → procedural: tomato plant, apple tree, money stacks, price pads, coop/pen, ketchup machine. Gotcha: Kenney texture filename collisions across packs.
- Audio: Kenney CC0 audio + Freesound CC0 (register) + jsfxr; OpenGameArt CC0 music.
