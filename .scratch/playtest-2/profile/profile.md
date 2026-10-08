# Where the frame time and battery go

Resolves [Profile where the frame time and battery go](https://github.com/Seif-Sallam/Wobbly-Mart/issues/3). Numbers only, no fixes. Measured 2026-10-08 on the production build (`npm run build && vite preview`) in real Google Chrome with the GPU on, on an Apple-silicon MacBook (ProMotion, 120 Hz).

- [`probe.js`](probe.js): paste into the console on any build and `await probe(15)`. It splits each frame into sim / view / app-UI / render CPU time, counts canvas texture uploads, reads draw calls and triangles, and times the GPU with `EXT_disjoint_timer_query_webgl2`.
- [`run.mjs`](run.mjs): drives Chrome (`playwright-core`, `channel: 'chrome'`) through the scenarios and samples Chrome's CPU and energy impact with macOS `top`. Busy scenes use `?debug` → *unlock all*, run at 6× for 40 s, then measure at 1×.
- Raw results: [`desktop.jsonl`](desktop.jsonl), [`phone.jsonl`](phone.jsonl).

**Desktop**: 1440×900 window, DPR 2. **Phone**: emulated 390×844, DPR 3, touch, CPU throttled 4×. The phone run still used the Mac's GPU, so its GPU numbers aren't a phone's. Its pixel count, draw calls, shadow size and CPU split are real. Each scenario is a 15 s sample.

## Results

| Scenario | fps | CPU ms/frame (p95) | sim | view | app UI | render submit | GPU ms/frame | draw calls | triangles | canvas uploads /s (MPx/s) | Chrome CPU / energy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Desktop** title screen (showcase store) | 119 | 1.9 (2.3) | 0.07 | 0.29 | 0.64 | 0.88 | 3.1 | 269 | 69 k | 0.3 (0.03) | 66 % / 66 |
| Desktop in game, fresh Map 1, idle | 119 | 2.5 (3.3) | 0.08 | 0.37 | 1.02 | 1.05 | 4.1 | 272 | 83 k | 34 (4.4) | 59 % / 59 |
| Desktop everything unlocked, busy | 120 | 2.4 (3.3) | 0.07 | 0.43 | 0.89 | 1.04 | 4.1 | 270 | 108 k | 29 (3.7) | 66 % / 66 |
| Desktop busy + walking | 119 | 2.8 (4.5) | 0.07 | 0.43 | 1.07 | 1.19 | 5.2 | **333** | 114 k | 54 (6.9) | 69 % / 69 |
| Desktop blank tab baseline | | | | | | | | | | | 3 % / 3 |
| **Phone** title screen | 119 | 4.8 (6.4) | 0.09 | 0.86 | 0.01 | 3.81 | (1.3) | 261 | 69 k | 0 | (131 %) |
| Phone in game, fresh Map 1, idle | 120 | 3.7 (5.0) | 0.08 | 0.08 | 1.63 | 1.90 | (1.7) | 54 | 58 k | 0 | (110 %) |
| Phone everything unlocked, busy | 115 | 7.4 (9.4) | 0.21 | 1.45 | 1.64 | 4.13 | (1.6) | **312** | 119 k | 5.3 (0.7) | (124 %) |
| Phone busy + walking | 116 | 7.1 (9.1) | 0.19 | 1.45 | 1.60 | 3.86 | (1.7) | 268 | 117 k | 5.4 (0.7) | (125 %) |
| Phone blank tab baseline | | | | | | | | | | | (74 %) |

The phone's Chrome CPU column is in brackets because CDP CPU throttling inflates it: a blank tab reads 74 %. Compare phone runs by ms/frame instead.

"sim" is the frame minus view, app UI and render: the fixed-step sim plus the loop's own overhead. "app UI" is `App.onFrame`: HUD, sounds, guidance and the Completion count. "render submit" is the CPU side of `renderer.render`.

## Facts for the battery decision

1. **The loop never idles and never caps.** `src/app/app.ts:130` calls `game.frame` on every `requestAnimationFrame`, and `Game.frame` (`src/app/game.ts:50`) always calls `stage.render`, paused or not. On a 120 Hz screen the game renders **120 full frames per second everywhere**: the paused title screen, a still Player, an open overlay. The title screen costs about as much as playing (66 % vs 59–69 % Chrome CPU, against 3 % for a blank tab).
2. **Most of the cost is the GPU at full resolution.** Desktop draws a 2880×1800 buffer: 3.1–5.2 ms of GPU per frame, so **37–62 % of the GPU is busy** at 120 fps. CPU per frame is only 1.9–2.8 ms. The emulated phone draws 780×1688 (DPR 3 clamped to 2).
3. **Pixel ratio stays at 2.** `Stage.watchFrame` (`src/view/stage.ts:81`) only steps 2 → 1.5 → 1 when frames take longer than 1/45 s. No scenario got close, so it never stepped down, even on the 4×-throttled phone.
4. **Shadows:** one PCF shadow map (`THREE.PCFShadowMap`, type 1) from the sun, **2048²** on desktop and **1024²** on touch devices, re-rendered every frame. The shadow pass draws the casters again, which is part of the draw-call count.
5. **Draw calls go over the debug budget** (`src/app/debug.ts`: phone 100, desktop 300). Desktop reaches 333 when walking. The emulated phone has 54 calls on the fresh map, but **312 with everything unlocked**, three times its budget. Triangles stay under budget (≤ 119 k).
6. **The sim is nearly free.** It takes 0.07–0.09 ms per frame on desktop and 0.2 ms busy on a 4×-throttled CPU, under 3 % of the frame.
7. **App UI is the biggest JS slice in game**: 0.9–1.1 ms on desktop and 1.6 ms on the phone, every frame, as much as the render submit on desktop.
8. **Canvas redraws (receipts, Pad labels, floaters) are cheap in CPU but steady.** On desktop: 29–54 texture uploads/s, 3.7–7.4 ms of upload per second, 3.7–6.9 MPx/s. The phone sends fewer and smaller ones (5/s, 0.7 MPx/s). Receipts only redraw when their key changes (`src/view/receipt.ts:56`), but each one builds that key with `JSON.stringify` every frame.
9. **The view update grows with the store**: 0.08 ms on the fresh map to 1.45 ms busy on the throttled phone (characters, baskets, instanced Items).
10. **Hidden tab:** the browser stops `requestAnimationFrame` there, so a background tab costs nothing. `visibilitychange` already pauses sounds and saves.

Not measured: real phone hardware, battery drain in mAh, thermals, and Safari. iOS Safari's own rAF caps (60 Hz, 30 Hz in Low Power Mode) would halve these frame counts there. Profiling on a real phone would be a follow-up task if the battery decision needs it.
