// ==UserScript==
// @name         Instagram Keyboard Navigator
// @namespace    https://github.com/untragaluz
// @version      1.8.0
// @description  Navigate Instagram's feed, Stories, and posts entirely by keyboard — arrows, carousels, like (L), comment/reply (C), repost (T), send (S), save (B), pause (P) and mute (O) on Stories. No mouse, no trackpad.
// @author       Wilder Zumarán Sarmiento
// @match        https://www.instagram.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// ---------------------------------------------------------------------
// CHANGELOG (see README.md for the full version-by-version history)
//
// Instagram renders a single post/story in several different ways,
// and most of the bugs below came from that: the feed (<article>
// elements), a modal preview overlaid on top of the still-rendered
// feed (opened via the comment icon or the "C" key), the full
// single-post page (/p/postid/, no <article>, no modal wrapper), and
// Stories (/stories/..., a horizontal tray with several preloaded
// stories mounted at once). actionScope() is the function that
// decides which container to search in, for each case.
//
// 1.8.0 — Added Stories support: like (L), reply (C, focuses the
//         "Reply to..." field instead of opening a modal), send (S),
//         pause/play (P) and mute (O). The script now defers to
//         Instagram's native ←/→ on Stories instead of hijacking them
//         for carousel navigation, same as it already did for ↑/↓ on
//         Reels. Finding the right container for Stories' action
//         icons was the hard part: neither offsetParent nor CSS
//         visibility distinguish the active story from the preloaded
//         ones sitting off-screen in the tray, so the script probes
//         document.elementFromPoint() near the bottom-right of the
//         viewport — where Instagram consistently places these
//         icons — instead of relying on visibility checks alone.
// 1.7.1 — Like/comment/repost/send/save now work inside the modal
//         preview: search is scoped to its div[role="dialog"] instead
//         of the whole page, which was silently matching icons from
//         feed posts hidden behind the overlay.
// 1.7.0 — Fixed the same five actions on the full single-post page.
// 1.5.2 — Fixed carousel arrows (←/→) inside the modal/full post page.
// 1.5.1 — Fixed send (S): Instagram's aria-label is "Share", not "Send".
// 1.5.0 — Added carousel navigation; deferred to Instagram's native
//         ↑/↓ on the Reels page instead of double-handling them.
// 1.4.0 — Moved the listener to the capture phase and added
//         stopPropagation() so our keys stop triggering Instagram's
//         own native shortcuts on the same key (happened with "B").
// 1.1.0 — Post navigation now tracks the focused post directly
//         instead of just an index, to avoid skipping posts when the
//         feed loads new content while navigating quickly.
// ---------------------------------------------------------------------

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // CONFIG — adjust here if you want to change keys or behavior
  // ---------------------------------------------------------------------
  const KEY_NEXT = 'ArrowDown';  // next post
  const KEY_PREV = 'ArrowUp';    // previous post
  const KEY_CAROUSEL_NEXT = 'ArrowRight'; // next slide in a carousel post
  const KEY_CAROUSEL_PREV = 'ArrowLeft';  // previous slide in a carousel post
  const KEY_LIKE = 'l';          // like / unlike
  const KEY_COMMENT = 'c';       // open comments view for the active post (Reply on Stories)
  const KEY_REPOST = 't';        // repost
  const KEY_SEND = 's';          // send via DM
  const KEY_SAVE = 'b';          // save (bookmark)
  const KEY_STORY_PAUSE = 'p';   // pause/play the active story
  const KEY_STORY_MUTE = 'o';    // mute/unmute the active story
  const HIGHLIGHT_COLOR = '#0095f6'; // Instagram-style blue, for the active post's outline

  // Section navigation shortcuts — we look up the real link in
  // Instagram's side menu and click it. More reliable than simulating
  // pushState by hand, since it uses Instagram's own React router
  // instead of trying to imitate it.
  const NAV_SHORTCUTS = {
    r: '/reels/',           // Reels
    m: '/direct/inbox/',    // Messages
    e: '/explore/',         // Explore
    n: '/notifications/',   // Notifications
  };

  // Instagram's own Reels view already uses Up/Down to move between
  // reels — we defer to that instead of hijacking the same keys.
  function isOnReelsPage() {
    return window.location.pathname.startsWith('/reels/');
  }

  // Instagram's own Stories view already uses Left/Right to move
  // between stories (its scroll is horizontal) — we defer to that
  // instead of hijacking the same keys for carousel navigation.
  function isOnStoriesPage() {
    return window.location.pathname.startsWith('/stories/');
  }

  // When you open a single post's expanded view (e.g. by clicking the
  // comment icon), Instagram mounts it separately from the feed's
  // <article> — so carousel buttons there live outside currentPostEl.
  // We detect this via the URL pattern Instagram uses for single posts.
  function isOnExpandedPostView() {
    return /^\/p\/[^/]+\/?/.test(window.location.pathname);
  }

  // ---------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------
  let currentIndex = -1;
  let posts = [];
  let currentPostEl = null; // direct reference to the active post, not just its index
  let isScrolling = false;  // prevents very fast keystrokes from overlapping

  // ---------------------------------------------------------------------
  // Finds all visible posts in the feed.
  // Instagram renders each post inside an <article>. It's the most
  // stable thing in its structure — if this stops working, it's the
  // first line to check.
  // ---------------------------------------------------------------------
  function getPosts() {
    return Array.from(document.querySelectorAll('article'));
  }

  // Removes the highlight from the previously active post
  function clearHighlight() {
    document.querySelectorAll('.jkl-nav-active').forEach((el) => {
      el.classList.remove('jkl-nav-active');
    });
  }

  // Highlights and centers the post at the given index.
  // We ALWAYS refresh "posts" against the current DOM, but if we
  // already had an active post, we locate its real position in the
  // fresh list (in case the feed inserted new posts above/in between
  // and shifted the indices) instead of blindly trusting the number
  // saved from last time.
  function focusPost(targetIndex, direction) {
    const freshPosts = getPosts();
    if (freshPosts.length === 0) return;

    let baseIndex = targetIndex;

    // If we were coming from a known post, recalculate its real
    // position in the fresh list — that way an extra inserted post
    // doesn't make us skip one "for no reason".
    if (currentPostEl && direction) {
      const realIndex = freshPosts.indexOf(currentPostEl);
      if (realIndex !== -1) {
        baseIndex = realIndex + direction;
      }
    }

    posts = freshPosts;

    if (baseIndex < 0) baseIndex = 0;
    if (baseIndex >= posts.length) baseIndex = posts.length - 1;

    clearHighlight();
    currentIndex = baseIndex;
    currentPostEl = posts[currentIndex];

    currentPostEl.classList.add('jkl-nav-active');

    isScrolling = true;
    currentPostEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Release the "lock" after a reasonable delay so the scroll
    // animation finishes before we accept the next keystroke.
    setTimeout(() => { isScrolling = false; }, 350);

    // If we're near the end of the loaded feed, Instagram needs you
    // (or the browser) to trigger the infinite-scroll. We force a
    // small extra scroll so more posts load.
    if (currentIndex >= posts.length - 2) {
      window.scrollBy(0, 1);
    }
  }

  function goNext() {
    if (isScrolling) return;
    if (currentIndex === -1) {
      focusPost(0);
      return;
    }
    focusPost(currentIndex + 1, 1);
  }

  function goPrev() {
    if (isScrolling) return;
    if (currentIndex === -1) {
      focusPost(0);
      return;
    }
    focusPost(currentIndex - 1, -1);
  }

  // ---------------------------------------------------------------------
  // When searching the whole document (expanded post view), Instagram
  // often keeps several matching elements mounted at once — e.g. the
  // same feed post preloaded off-screen behind the modal. Picking the
  // first match can silently act on the wrong post. We prefer the
  // element that's actually visible on screen.
  // ---------------------------------------------------------------------
  function findVisibleButton(scope, selector) {
    const candidates = Array.from(scope.querySelectorAll(selector));
    return candidates.find((el) => el.offsetParent !== null) || candidates[0];
  }

  // Same idea, but for icons built as an <svg> inside a clickable
  // ancestor (button or div[role="button"]) — the pattern used by
  // like, comment, repost, send and save.
  function findVisibleIconButton(scope, svgSelector) {
    const svgs = Array.from(scope.querySelectorAll(svgSelector));
    const visibleSvg = svgs.find((el) => el.offsetParent !== null) || svgs[0];
    if (!visibleSvg) return null;
    return visibleSvg.closest('button, div[role="button"]');
  }

  // ---------------------------------------------------------------------
  // Finds the container of the story that's actually on screen.
  // Instagram preloads several stories at once (current, next, and
  // others in the tray), each keeping its own full set of action
  // icons mounted — but unlike the feed-behind-modal case, these
  // aren't hidden via display/visibility, they're just positioned
  // off to the side. Neither offsetParent nor CSS visibility tell
  // them apart, so instead we ask the browser directly: what's the
  // element actually rendered at the center of the viewport right
  // now? We then walk up to the nearest ancestor with an inline
  // pixel width/height style, which is how Instagram sizes each
  // individual story's video/image wrapper.
  // ---------------------------------------------------------------------
  // Finds the container that holds the active story's action icons
  // (like, comment, send). Instagram positions these at the bottom of
  // the story card, not at its visual center — so we probe a point
  // near the bottom-right of the viewport, where the like/send
  // buttons consistently sit, instead of the center (which lands on
  // the story's video/image content instead).
  function findActiveStoryContainer() {
    const el = document.elementFromPoint(
      window.innerWidth * 0.75,
      window.innerHeight * 0.9
    );
    return el || null;
  }

  // ---------------------------------------------------------------------
  // Returns the right container to search for action icons (like,
  // comment, repost, send, save) depending on where we are:
  // - In the feed, icons live inside the active post's <article>.
  // - In the expanded post view, Instagram either shows a full page
  //   (/p/...) or a modal overlay on top of the feed (opened via C).
  //   The modal case is tricky: the feed keeps rendering behind it,
  //   so searching the whole document can match icons belonging to
  //   posts hidden behind the overlay. When a dialog is present
  //   (confirmed via div[role="dialog"]) we scope to it specifically;
  //   otherwise we fall back to the whole document for the full-page
  //   view, which doesn't use a dialog wrapper at all.
  // - On Stories, Instagram preloads several stories at once (current,
  //   next, others in the tray), each with its own duplicated set of
  //   icons — but unlike the feed-behind-modal case, the preloaded
  //   ones are properly hidden (no offsetParent), so searching the
  //   whole document and relying on findVisibleIconButton's visibility
  //   check is enough to land on the right one.
  // ---------------------------------------------------------------------
  function actionScope() {
    if (isOnExpandedPostView()) {
      const dialog = document.querySelector('div[role="dialog"]');
      return dialog || document;
    }
    if (isOnStoriesPage()) {
      return findActiveStoryContainer() || document;
    }
    return currentPostEl;
  }

  // ---------------------------------------------------------------------
  // Likes or unlikes the currently focused post.
  // Instagram doesn't expose a reliable fixed attribute like
  // data-testid="like-button", so we look for the like button's SVG
  // by its aria-label, which is the most stable option available:
  // "Like" or "Unlike".
  // ---------------------------------------------------------------------
  function toggleLike() {
    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleIconButton(
      scope,
      'svg[aria-label="Like"], svg[aria-label="Unlike"]'
    );
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Navigates to a section by finding the real <a> in Instagram's
  // side menu via its href attribute, and simulating a real click.
  // This respects Instagram's internal (React) router, unlike forcing
  // the URL by hand.
  // ---------------------------------------------------------------------
  function goToSection(path) {
    // Look for a link whose href contains the target path.
    const link = document.querySelector(`a[href="${path}"], a[href^="${path}"]`);
    if (link) {
      link.click();
      return;
    }
    // If we can't find the link (e.g. the side menu is collapsed or
    // its structure changed), fall back to changing the URL directly
    // — not as smooth, but it works.
    window.location.href = path;
  }

  // H fully reloads the Home page, as requested.
  function goHome() {
    window.location.href = '/';
  }


  // ---------------------------------------------------------------------
  // Opens the comments view for the active post.
  // Instagram doesn't show a direct text field in the feed — you have
  // to click the comment icon (the "speech bubble"), which opens the
  // post in an expanded view where the field actually exists.
  // We look for that icon by its aria-label, same as we do with like.
  // ---------------------------------------------------------------------
  function openComments() {
    // Stories don't have a comments modal — they have an always-visible
    // "Reply to..." text field instead. We focus it directly rather
    // than looking for a clickable icon.
    if (isOnStoriesPage()) {
      const replyField = document.querySelector('textarea[placeholder*="Reply"]');
      if (replyField) {
        replyField.focus();
      }
      return;
    }

    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleIconButton(scope, 'svg[aria-label="Comment"]');
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Moves to the next/previous slide in a carousel post (multiple
  // photos/videos in one post). Instagram shows small left/right
  // arrow buttons over the media when a post has more than one item.
  // Unlike the other post actions, these buttons carry their
  // aria-label directly on the <button> itself, not on an inner SVG
  // — confirmed as "Go back" / "Next".
  // If the active post isn't a carousel, these buttons simply don't
  // exist and the function does nothing.
  // ---------------------------------------------------------------------
  function carouselNext() {
    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleButton(scope, 'button[aria-label="Next"]');
    if (button) {
      button.click();
    }
  }

  function carouselPrev() {
    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleButton(scope, 'button[aria-label="Go back"]');
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Reposts the active post (the two curved arrows icon).
  // ---------------------------------------------------------------------
  function toggleRepost() {
    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleIconButton(scope, 'svg[aria-label="Repost"]');
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Opens the "Send via DM" panel for the active post (the paper
  // plane icon). Instagram labels it "Share" in its aria-label, not
  // "Send" as we initially assumed.
  // ---------------------------------------------------------------------
  function openSend() {
    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleIconButton(
      scope,
      'svg[aria-label="Share"], svg[aria-label="Share Post"], svg[aria-label="Direct"]'
    );
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Saves / unsaves the active post (bookmark icon).
  // ---------------------------------------------------------------------
  function toggleSave() {
    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleIconButton(
      scope,
      'svg[aria-label="Save"], svg[aria-label="Remove"]'
    );
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Pauses/resumes the active story. Instagram swaps the icon between
  // "Play" (when paused) and, when playing, an implicit pause state
  // with no equivalent "Pause" aria-label observed — we search for
  // "Play" first since that's the one confirmed to exist; if the
  // story is currently playing, clicking its own toggle button (found
  // via the same icon position) pauses it regardless of label.
  // ---------------------------------------------------------------------
  function toggleStoryPause() {
    if (!isOnStoriesPage()) return;
    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleIconButton(
      scope,
      'svg[aria-label="Play"], svg[aria-label="Pause"]'
    );
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Mutes/unmutes the active story's audio.
  // ---------------------------------------------------------------------
  function toggleStoryMute() {
    if (!isOnStoriesPage()) return;
    const scope = actionScope();
    if (!scope) return;

    const button = findVisibleIconButton(
      scope,
      'svg[aria-label="Audio is muted"], svg[aria-label="Audio is playing"], svg[aria-label="Toggle audio"]'
    );
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Main keyboard listener.
  // We ignore keystrokes when focus is on a text field (comments,
  // search, DMs) so we don't interfere with normal typing.
  // ---------------------------------------------------------------------
  function isTypingContext() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      el.isContentEditable
    );
  }

  document.addEventListener('keydown', (e) => {
    if (isTypingContext()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return; // don't override system/browser shortcuts

    // Arrow keys arrive as "ArrowUp"/"ArrowDown" in e.key — we compare
    // them as-is, without lowercasing. On the Reels page, Instagram
    // already uses Up/Down to move between reels, so we step aside
    // and let those keystrokes through untouched.
    if (e.key === KEY_NEXT && !isOnReelsPage()) {
      e.preventDefault();
      e.stopPropagation();
      goNext();
      return;
    }
    if (e.key === KEY_PREV && !isOnReelsPage()) {
      e.preventDefault();
      e.stopPropagation();
      goPrev();
      return;
    }
    if (e.key === KEY_CAROUSEL_NEXT && !isOnStoriesPage()) {
      e.preventDefault();
      e.stopPropagation();
      carouselNext();
      return;
    }
    if (e.key === KEY_CAROUSEL_PREV && !isOnStoriesPage()) {
      e.preventDefault();
      e.stopPropagation();
      carouselPrev();
      return;
    }

    const key = e.key.toLowerCase();
    const isOurKey =
      key === KEY_LIKE ||
      key === KEY_COMMENT ||
      key === KEY_REPOST ||
      key === KEY_SEND ||
      key === KEY_SAVE ||
      key === KEY_STORY_PAUSE ||
      key === KEY_STORY_MUTE ||
      key === 'h' ||
      !!NAV_SHORTCUTS[key];

    // Stop propagation on ALL our keys, not just with preventDefault —
    // this prevents Instagram from having its own listener bound to
    // the same key and triggering something extra (this happened with
    // "B", which besides saving also opened Instagram's feedback dialog).
    if (isOurKey) {
      e.stopPropagation();
    }

    if (key === KEY_LIKE) {
      e.preventDefault();
      toggleLike();
    } else if (key === KEY_COMMENT) {
      e.preventDefault();
      openComments();
    } else if (key === KEY_REPOST) {
      e.preventDefault();
      toggleRepost();
    } else if (key === KEY_SEND) {
      e.preventDefault();
      openSend();
    } else if (key === KEY_SAVE) {
      e.preventDefault();
      toggleSave();
    } else if (key === KEY_STORY_PAUSE) {
      e.preventDefault();
      toggleStoryPause();
    } else if (key === KEY_STORY_MUTE) {
      e.preventDefault();
      toggleStoryMute();
    } else if (key === 'h') {
      e.preventDefault();
      goHome();
    } else if (NAV_SHORTCUTS[key]) {
      e.preventDefault();
      goToSection(NAV_SHORTCUTS[key]);
    }
  }, true); // capture: true — intercept the event BEFORE it arrives elsewhere

  // ---------------------------------------------------------------------
  // Active post styling — a visible outline so you always know which
  // post is "selected" before liking it.
  // ---------------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    .jkl-nav-active {
      outline: 3px solid ${HIGHLIGHT_COLOR} !important;
      outline-offset: -2px;
      border-radius: 4px;
    }
  `;
  document.head.appendChild(style);

  // Refresh the list of posts periodically in case the feed changes
  // (new posts loaded, reels mixed in, etc.)
  setInterval(() => {
    posts = getPosts();
  }, 2000);
})();
