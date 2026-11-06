# Why phones don't go fullscreen from the title (#158)

Branch base: `origin/release-04-bug-fixes` (dcbb6b0). No game code changed.

## Answer

**Cause:** the title screen gets exactly one fullscreen attempt per page load. `firstTap` in `src/app/app.ts:221-224` is a `{ once: true }` `pointerup` listener. After that, nothing on the title re-requests fullscreen:

- If the first attempt fails, nobody sees it. The `.catch(() => {})` swallows the error, and the listener is already gone.
- Android Chrome leaves fullscreen when the tab is hidden: app switch, notification shade, screen lock. It also leaves on the system back gesture. When the player comes back, the title stays windowed.
- The only automatic re-entry is the `'fullscreen'` pause card (`app.ts:456-458`). It only runs inside the game frame loop, never on the title.
- `enterGame()` (`app.ts:345`) asks again only when Play is pressed. So the owner ends up using Settings → Fullscreen (`app.ts:831-833`) on the title.

**The activation itself is fine.** `pointerup` from a touch counts as a user activation, so this is not the bug (see Evidence 1).

**Smallest fix (one line):** keep the listener alive and guard it, so every tap re-enters fullscreen while it is off:

```ts
const firstTap = (): void => {
  if (canFullscreen() && !document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => {});
};
addEventListener('pointerup', firstTap); // was { once: true }
```

(Rename it to `tapFullscreen`.) This covers the title, the wipe and the game the same way. The pause card can stay, because it also pauses the shift.

Trade-off: on a phone, Settings → Fullscreen "exit" only lasts until the next tap. That matches "a phone always plays fullscreen". If that is wanted, hide that toggle when `canFullscreen()`.

## Evidence

1. **pointerup on touch is a valid activation.** The HTML spec lists the activation-triggering input events: `keydown` (except Esc and hotkeys), `mousedown`, `pointerdown` when `pointerType` is `"mouse"`, `pointerup` when `pointerType` is not `"mouse"`, and `touchend`. `click` is not on the list.
   https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event
   The resulting transient activation lasts a few seconds. Chrome implements this as User Activation v2.
   https://developer.mozilla.org/en-US/docs/Glossary/Transient_activation
   https://developer.chrome.com/blog/user-activation
   So a tap's `pointerup` is the right event. A `{ once: true }` listener on `window` also runs for taps on buttons: `Btn` only stops `pointerdown` (`src/ui/btn.tsx:15`), not `pointerup`.

2. **requestFullscreen consumes the activation.** Without transient activation, the promise rejects with a `TypeError`. When the request goes ahead, the call consumes the user activation.
   https://fullscreen.spec.whatwg.org/#dom-element-requestfullscreen
   https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
   A Play tap therefore fires two requests: the window `pointerup` (which wins) and then `click`, which calls `enterGame()`. The second one is harmless, because the page is already fullscreen by then.

3. **Hidden documents leave fullscreen.** The HTML "update the visibility state" steps fully exit fullscreen when a document becomes hidden.
   https://html.spec.whatwg.org/multipage/interaction.html#update-the-visibility-state
   The app only listens for `visibilitychange` to pause and resume audio (`app.ts:226`). Nothing re-arms fullscreen on the title.

4. **History.** #113 / 93c3e1f "Fix fullscreen" added the one-shot `firstTap`. It also stopped treating `display-mode: standalone` as already fullscreen. Before that, the only entry point was `enterGame()`. The fix made the first tap work but did not cover any later loss of fullscreen on the title.

5. **The installed-PWA case is not the cause.** `public/manifest.webmanifest` sets `"display": "fullscreen"`. An installed WebAPK matches `(display-mode: fullscreen)`, and `canFullscreen()` correctly returns false there. A plain home-screen shortcut reports `browser` and goes through the same path as a tab. That path is fixed by the change above.

## Not verified

No on-device repro was run. The causes in (3) and the first-attempt failure in "Answer" are inferred from the specs and the code. To confirm, log the `.catch` reason and `document.visibilityState` on the owner's phone, using remote debugging at `chrome://inspect`.
