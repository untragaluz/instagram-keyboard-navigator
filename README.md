# Instagram Keyboard Navigator

A [userscript](https://en.wikipedia.org/wiki/Userscript) that adds full keyboard navigation to Instagram web — no mouse, no trackpad. Move through the feed with arrow keys, browse carousel posts, control Stories (pause, mute, reply), and trigger every post action (like, comment, repost, send via DM, save) and section jump (Home, Reels, Messages, Explore, Notifications) from the keyboard.

Works in any browser compatible with [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) — tested on Firefox (including forks like [Zen Browser](https://zen-browser.app/)) and on Chromium-based browsers (including forks like [Helium Browser](https://helium.computer/)).

All shortcuts work consistently across every way Instagram renders content: the main feed, the modal preview opened by clicking the comment icon, a post's full single page (`/p/postid/`), Reels, and Stories.

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
| `←` | Previous slide (on carousel posts) |
| `→` | Next slide (on carousel posts) |
| `L` | Like / Unlike |
| `C` | Comment — opens the post's expanded view (on Stories: focuses the "Reply to..." field instead) |
| `T` | Repost |
| `S` | Send via DM |
| `B` | Save |
| `P` | Pause / play the active story (Stories only) |
| `O` | Mute / unmute the active story (Stories only) |
| `H` | Home (reloads the page) |
| `R` | Reels |
| `M` | Messages |
| `E` | Explore |
| `N` | Notifications |

The active post is highlighted with a blue outline, so you always know which one you're about to act on before pressing an action key.

On Reels (`/reels/`), the script steps aside for `↑`/`↓` and lets Instagram's own built-in shortcuts handle moving between reels. On Stories (`/stories/...`), it does the same for `←`/`→`, since Instagram already binds those to move between stories.

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
const KEY_STORY_PAUSE = 'p';
const KEY_STORY_MUTE = 'o';
```

Change any of these values and save again in Tampermonkey to use your own keys.

## Technical notes

- The script identifies feed posts by looking for `<article>` elements, and actions (like, comment, repost, etc.) by finding the corresponding SVG icons via their `aria-label` attribute. Instagram doesn't publicly document these attributes, so if Instagram updates its interface, some shortcut might stop responding.
- To debug a broken shortcut: open the browser console with a post focused (the one with the blue outline) and run:
  ```javascript
  Array.from(document.querySelector('.jkl-nav-active').querySelectorAll('svg[aria-label]'))
    .map(el => el.getAttribute('aria-label'))
  ```
  This lists the real `aria-label` values Instagram is currently using — compare them against what each function looks for (`toggleLike`, `openComments`, `toggleRepost`, `openSend`, `toggleSave`) and adjust the selector if it changed. Note that some buttons (like the carousel's "Next"/"Go back") carry their `aria-label` directly on the `<button>` instead of on an inner `<svg>` — if a search for `svg[aria-label=...]` comes up empty, try `button[aria-label=...]` instead.
- The section-navigation shortcuts (R, M, E, N) look up the real link in Instagram's side menu by its `href` and click it, instead of forcing a URL change — this respects Instagram's internal React router.
- The keydown listener runs in the capture phase (`addEventListener(..., true)`) and uses `stopPropagation()` to prevent a key from also triggering a native Instagram shortcut bound to the same key (this happened with `B`, which collided with Instagram's native "give feedback" shortcut).
- On `/reels/`, Instagram already binds `↑`/`↓` to move between reels, and on `/stories/...` it already binds `←`/`→` to move between stories — the script detects these routes and steps aside instead of double-handling the same keys.
- Instagram renders a single post/story in several different ways, and each needed its own handling:
  - **Feed**: each post is an `<article>`, tracked as `currentPostEl`.
  - **Modal preview** (opened by clicking the comment icon, or pressing `C`): Instagram overlays a `div[role="dialog"]` on top of the still-rendered feed. Searching the whole page for an icon can silently match one of the (often several) identical icons belonging to feed posts hidden behind the overlay — the fix is to scope the search to that dialog specifically once it's present.
  - **Full page** (`/p/postid/`, opened in its own tab/URL): no `<article>` and no dialog wrapper at all — the search falls back to the whole `document`.
  - **Stories** (`/stories/username/storyid/`): Instagram preloads several stories at once (the current one, the next one, others in the tray), each keeping its own full set of action icons mounted. Unlike the modal case, neither `offsetParent` nor CSS `visibility` reliably tell the active story apart from the preloaded ones — they're just positioned off to the side, not hidden. The fix that worked: ask the browser directly what's rendered at a point near the bottom-right of the viewport (`document.elementFromPoint`), since that's where Instagram consistently places the like/reply/send icons, and scope the search to that element instead of guessing from DOM structure alone.

  `actionScope()` centralizes this decision for every action function.

## Changelog

- **1.8.0** — Added Stories support: like (`L`), reply (`C`, focuses the "Reply to..." field instead of opening a modal), send (`S`), pause/play (`P`) and mute (`O`). The script now defers to Instagram's native `←`/`→` on Stories, the same way it already did for `↑`/`↓` on Reels.
- **1.7.1** — Fixed like/comment/repost/send/save not working inside the modal preview opened by `C`: search is now scoped to the `div[role="dialog"]` overlay instead of the whole page, so it stops matching hidden feed posts behind it. Also added the `"Share Post"` label variant for the send action.
- **1.7.0** — Fixed the same five actions not working at all on the full single-post page (`/p/postid/`), which doesn't use `<article>`. Introduced `actionScope()` to centralize where each action searches, and `findVisibleIconButton()` to prefer the on-screen icon when several matches exist.
- **1.6.1** — Investigated a focus issue in the modal preview (later found unrelated to the real bug in 1.7.x).
- **1.6.0** — Fixed like/comment/repost/send/save not working on the full single-post page.
- **1.5.2** — Fixed carousel arrows (←/→) not working inside the modal preview or full post page; scoped the search to `document` there instead of the feed's `<article>`.
- **1.5.1** — Fixed the send shortcut (`S`): Instagram labels that icon `"Share"`, not `"Send"` as first assumed.
- **1.5.0** — Added carousel navigation (`←`/`→`) and made the script defer to Instagram's native `↑`/`↓` shortcuts on the Reels page.
- **1.4.1** — Fixed the repost shortcut (`T`) after a duplicate `aria-label` match with the send icon.
- **1.4.0** — Fixed `B` (save) also triggering Instagram's native "give feedback" dialog, by moving the listener to the capture phase and adding `stopPropagation()`.
- **1.3.0** — Added repost (`T`), send via DM (`S`), and save (`B`).
- **1.2.0** — Renamed the project to *Instagram Keyboard Navigator* and fixed the comment shortcut (`C`) to open the comments view instead of looking for a text field that doesn't exist in the feed.
- **1.1.0** — Made post navigation track the focused post directly (instead of just an index) to avoid skipping posts when the feed loads new content while navigating quickly.
- **1.0.0** — First version: post navigation and like.

## License

[GPL-3.0](./LICENSE) — you're free to use, modify, and redistribute this code, as long as any modified version you share also stays open source under the same license.

## Author

WZS — [@untragaluz](https://github.com/untragaluz)
