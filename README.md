# Instagram Keyboard Navigator

A [userscript](https://en.wikipedia.org/wiki/Userscript) that adds full keyboard navigation to Instagram web — no mouse, no trackpad. Move through the feed with arrow keys and trigger every post action (like, comment, repost, send via DM, save) and section jump (Home, Reels, Messages, Explore, Notifications) from the keyboard.

Works in any browser compatible with [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) — tested on Firefox (including forks like [Zen Browser](https://zen-browser.app/)) and on Chromium-based browsers (including forks like [Helium Browser](https://helium.computer/)).

## Why a userscript instead of a store extension?

Chrome Web Store and Firefox Add-ons extensions that offer this feature tend to:
- Request broader permissions than necessary (tab access, downloads).
- Not exist on both stores at once — if you use more than one browser, you end up without coverage on one of them.
- Depend on an unknown third party keeping them maintained.

A userscript solves all three: it runs the same way on any browser with Tampermonkey/Violentmonkey installed, the code is fully readable and auditable, and it only requests permission on `instagram.com`.

## Shortcuts

| Key | Action |
|---|---|
| `↑` | Previous post |
| `↓` | Next post |
| `L` | Like / Unlike |
| `C` | Comment |
| `T` | Repost |
| `S` | Send via DM |
| `B` | Save |
| `H` | Home (reloads the page) |
| `R` | Reels |
| `M` | Messages |
| `E` | Explore |
| `N` | Notifications |

The active post is highlighted with a blue outline, so you always know which one you're about to act on before pressing an action key.

The script ignores keystrokes while you're typing in any text field (comments, search, DMs), so it won't interfere with normal typing.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or [Violentmonkey](https://violentmonkey.github.io/)) in your browser.
   - On Firefox and its forks (Zen, etc.): from [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/).
   - On Chrome and its forks (Helium, etc.): from the [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
2. Click the Tampermonkey icon → **Create a new script**.
3. Delete the default sample content and paste the full contents of [`instagram-keyboard-navigator.user.js`](./instagram-keyboard-navigator.user.js).
4. Save with `Ctrl+S` (or `Cmd+S`).
5. Go to [instagram.com](https://www.instagram.com) and reload the page.

If you use more than one browser, repeat steps 2–4 in each — it's the same file, no changes needed.

## Screenshots

<!-- Add screenshots here: the highlighted post, the Tampermonkey menu, etc. -->

## Customization

All keys are centralized at the top of the file, in the `CONFIG` section:

```javascript
const KEY_NEXT = 'ArrowDown';
const KEY_PREV = 'ArrowUp';
const KEY_LIKE = 'l';
const KEY_COMMENT = 'c';
const KEY_REPOST = 't';
const KEY_SEND = 's';
const KEY_SAVE = 'b';
```

Change any of these values and save again in Tampermonkey to use your own keys.

## Technical notes

- The script identifies feed posts by looking for `<article>` elements, and actions (like, comment, repost, etc.) by finding the corresponding SVG icons via their `aria-label` attribute. Instagram doesn't publicly document these attributes, so if Instagram updates its interface, some shortcut might stop responding.
- To debug a broken shortcut: open the browser console with a post focused (the one with the blue outline) and run:
  ```javascript
  Array.from(document.querySelector('.jkl-nav-active').querySelectorAll('svg[aria-label]'))
    .map(el => el.getAttribute('aria-label'))
  ```
  This lists the real `aria-label` values Instagram is currently using — compare them against what each function looks for (`toggleLike`, `openComments`, `toggleRepost`, `openSend`, `toggleSave`) and adjust the selector if it changed.
- The section-navigation shortcuts (R, M, E, N) look up the real link in Instagram's side menu by its `href` and click it, instead of forcing a URL change — this respects Instagram's internal React router.
- The keydown listener runs in the capture phase (`addEventListener(..., true)`) and uses `stopPropagation()` to prevent a key from also triggering a native Instagram shortcut bound to the same key (this happened with `B`, which collided with Instagram's native "give feedback" shortcut).

## License

[GPL-3.0](./LICENSE) — you're free to use, modify, and redistribute this code, as long as any modified version you share also stays open source under the same license.

## Author

WZS — [@untragaluz](https://github.com/untragaluz)
