# TikTok and other infinite feeds: design note (not implemented)

Same standards as everywhere else: clear positive evidence only, a person's or creator's name is never evidence (0.4.59 stripping), every change carries the Vegan Lens icon and name, swaps stay category-level, and nothing about browsing is sent anywhere.

## Phase 1: what the page already shows as text (cheap, reliable)
- **Unit:** one feed item (a video in the For You / Following feed, or a grid tile on search, profile and hashtag pages). Pick it by stable attributes such as `data-e2e` values, `role`, or `/video/<id>` links, never by class names. The pattern is the same as Pinterest pins (0.4.60) and YouTube cards.
- **Text read:**
  - the caption;
  - hashtags (strong signal, weighted like category tags: `#steak` yes, `#vegansteak` no);
  - the sound/music title (weak, snippet weight);
  - the video's link aria-label.
  - The `@handle` and display name are passed as `creators`, so they're stripped.
- **Action:** one labelled chip on the caption overlay; "dim" or "hide" blurs the video poster. In the full-screen feed, a chip and blur on the current video is enough. Never auto-skip or scroll the user's feed.
- **Infinite scroll:**
  - A MutationObserver picks up new items, and an IntersectionObserver classifies only items near the viewport.
  - Each item is keyed by video id, so recycled DOM nodes are re-checked when the id changes (the same audit loop as YouTube).
  - The 0.4.59 recount keeps the badge right across SPA URL changes.
- **Search assist:** `tiktok.com/search?q=` fits the existing suggest/auto rewrite.

## Phase 2: on-frame text and spoken captions (later; opt-in)
- **Spoken captions:** TikTok's own captions/subtitles, when present in the DOM (a text track or caption element), are free text and can be read like the caption.
- **On-frame text** (e.g. a recipe title burned into the video):
  - would need on-device OCR of a sampled frame (e.g. the poster image);
  - must stay off by default and run only on visible items;
  - must never upload frames;
  - its result is weak evidence that can only confirm a caption hit, never flag on its own.
- **Audio:** out of scope (privacy and cost).

## Other infinite feeds
Instagram (web), X, Threads and Reddit use the same recipe: a per-item unit with stable attributes, text from caption/alt/aria-label/hashtags, creator names stripped, observers for new items, and an id-keyed re-check for recycled nodes.
