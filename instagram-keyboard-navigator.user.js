// ==UserScript==
// @name         Instagram Keyboard Navigator
// @namespace    https://github.com/untragaluz
// @version      1.4.1
// @description  Navigate the Instagram feed with arrow keys, like (L), comment (C), repost (T), send (S) and save (B) — no mouse, no trackpad.
// @author       Wilder Zumarán Sarmiento
// @match        https://www.instagram.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // CONFIG — adjust here if you want to change keys or behavior
  // ---------------------------------------------------------------------
  const KEY_NEXT = 'ArrowDown';  // next post
  const KEY_PREV = 'ArrowUp';    // previous post
  const KEY_LIKE = 'l';          // like / unlike
  const KEY_COMMENT = 'c';       // open comments view for the active post
  const KEY_REPOST = 't';        // repost
  const KEY_SEND = 's';          // send via DM
  const KEY_SAVE = 'b';          // save (bookmark)
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
  // Likes or unlikes the currently focused post.
  // Instagram doesn't expose a reliable fixed attribute like
  // data-testid="like-button", so we look for the like button's SVG
  // by its aria-label, which is the most stable option available:
  // "Like" or "Unlike".
  // ---------------------------------------------------------------------
  function toggleLike() {
    if (!currentPostEl) return;

    const likeSvg = currentPostEl.querySelector(
      'svg[aria-label="Like"], svg[aria-label="Unlike"]'
    );
    if (!likeSvg) return;

    // The SVG isn't directly clickable; the real button is a nearby
    // ancestor (button or div with role="button").
    const button = likeSvg.closest('button, div[role="button"]');
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
    if (!currentPostEl) return;

    const commentSvg = currentPostEl.querySelector('svg[aria-label="Comment"]');
    if (!commentSvg) return;

    const button = commentSvg.closest('button, div[role="button"]');
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Reposts the active post (the two curved arrows icon).
  // ---------------------------------------------------------------------
  function toggleRepost() {
    if (!currentPostEl) return;

    const repostSvg = currentPostEl.querySelector('svg[aria-label="Repost"]');
    if (!repostSvg) return;

    const button = repostSvg.closest('button, div[role="button"]');
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
    if (!currentPostEl) return;

    const sendSvg = currentPostEl.querySelector('svg[aria-label="Share"]');
    if (!sendSvg) return;

    const button = sendSvg.closest('button, div[role="button"]');
    if (button) {
      button.click();
    }
  }

  // ---------------------------------------------------------------------
  // Saves / unsaves the active post (bookmark icon).
  // ---------------------------------------------------------------------
  function toggleSave() {
    if (!currentPostEl) return;

    const saveSvg = currentPostEl.querySelector(
      'svg[aria-label="Save"], svg[aria-label="Remove"]'
    );
    if (!saveSvg) return;

    const button = saveSvg.closest('button, div[role="button"]');
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
    // them as-is, without lowercasing.
    if (e.key === KEY_NEXT) {
      e.preventDefault();
      e.stopPropagation();
      goNext();
      return;
    }
    if (e.key === KEY_PREV) {
      e.preventDefault();
      e.stopPropagation();
      goPrev();
      return;
    }

    const key = e.key.toLowerCase();
    const isOurKey =
      key === KEY_LIKE ||
      key === KEY_COMMENT ||
      key === KEY_REPOST ||
      key === KEY_SEND ||
      key === KEY_SAVE ||
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
