# Vegan Lens (Chrome MV3 prototype)

Highlights vegan products and content across the web, and dims non-vegan products, content and ads.

## Install (Chrome on Windows)
1. Unzip `vegan-lens.zip` to a folder (e.g. `C:\Users\<you>\vegan-lens`).
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Pin the leaf icon, then open an Amazon search such as "gummy candy".

## What it does
- **Search results**: green 🌱 badge + outline = likely vegan; dimmed/grayscale with "Not vegan: contains …" label = likely not vegan (click the label to restore); grey **?** = unknown.
- **Product pages**: banner above the title with the verdict and matched ingredients, using title, ingredients/important-information, description, bullets and badges. If a UPC/EAN is listed, it also asks Open Food Facts (`ingredients_analysis_tags`).
- **Vegan swaps** (Amazon only): non-vegan search cards and product-page banners get a small leaf-labelled "Vegan swap: …" link — a generic Amazon search on your current Amazon domain (e.g. `Violife cheese`, `vegan leather shoes`), picked from the classifier's matched terms via the curated local list in `swaps.js`. No ASINs, prices or claims. Toggle in the popup; removed on undo / page or site disable.
- **Popup**: on/off, mode (dim / hide / badge-only), strictness (strict treats honey, beeswax, royal jelly, propolis as non-vegan; lenient ignores them), show vegan swaps. Vegan Lens never reorders results. Settings sync via `chrome.storage.sync` and apply live.

## Web content mode (all other sites)
A second content script (`contentClassifier.js` + `web.js`) runs on every http(s) site except Amazon. It finds articles, `[role=article]`, cards and list items with headline links, Google and Bing results, Reddit posts, YouTube videos and news feed items. It scores each one's headline, snippet and image alt text:
- **Non-vegan** (steak, BBQ ribs, fishing trips, dairy recipes, hunting, fur…): green-tinted, faded and blurred with a "Hidden: about steak · show" chip, collapsed to a chip, or just labelled (popup **Effect**).
- **Vegan** (vegan, plant-based, tofu, Beyond/Impossible, sanctuaries…): subtle green left border.
- Animal-welfare and activism framing (factory-farm investigations, "why I quit meat") counts as positive, not suppressed.
- Common false friends are ignored: cauliflower steak, Kevin/Francis Bacon, a rap "beef", the game of chicken, phishing, ham radio, Turkey the country.
- On single-article pages a dismissible banner shows the verdict from the H1 and first paragraphs.
- Popup: global on/off, effect, sensitivity slider (low/med/high), **Disable on this site**, blocklist, and an optional allowlist-only mode.

## Toolbar badge (v0.3)
The icon shows a per-tab count: red = non-vegan items + context cards found; green = vegan count when nothing non-vegan was found. It resets on navigation (including single-page-app URL changes). The popup shows a breakdown: vegan, non-vegan dimmed, unknown (Amazon), context cards.

## Context cards (v0.3)
News about animal agriculture or animal use (fur/mink farms, factory farming, bird flu, dairy, fishing/bycatch, slaughterhouses, antibiotic resistance, zoonotic disease, deforestation, animal testing, live export, wildlife markets) is **not dimmed**. Instead a small dismissible "Context" card appears under the item with a short sourced fact (or a link-only "Learn more"), plus a "Positive action" link. All card text lives in `cards.json`, with a source URL for every claim, so it's easy to audit and edit. Toggle with "Show context cards" in the popup.

## Search assist (v0.3)
On Google, Bing, DuckDuckGo, YouTube and Amazon searches for food, recipe, restaurant or animal-material queries (e.g. "best steak recipe", "leather jacket"), Vegan Lens can:
- **Suggest** (default): a banner "Try: best vegan steak recipe →".
- **Auto**: redirect once to the vegan query, with a "Search original" link to opt out for that search.
- **Off**.
Queries already containing vegan/plant-based/dairy-free, and non-food senses (Kevin Bacon, phishing…), are left alone. Logic: `searchRewrite.js` (`rewriteQuery`).

## Google rich results (v0.3)
Recipe carousels, top stories, video and shopping cards are classified card-by-card (found structurally: links with a real image inside carousels, `[data-attrid]`, lists or blocks under an h2 heading).

## Limitations
- Search results are classified from the **title only**, so most items show "?".
- Keyword heuristic: it can be wrong (brand names, "milk chocolate"-style phrasing, hidden ingredients like natural flavors, sugar filtered with bone char, vitamin D3 sources). Always check the label.
- Amazon changes its markup often; selectors may need updates.
- Web mode is keyword-based on short text; expect misses and some wrong calls. Site layouts vary, so some sites' content units won't be detected; unusual CSS can make chips look odd. Use **Disable on this site** if a page misbehaves.
- Context-card facts were verified on 2026-10-28; numbers (e.g. CDC case counts) change, so re-check `cards.json` periodically. Topic detection is keyword-based.
- Open Food Facts coverage is sparse for Amazon items, and UPCs are often missing.

## Dev
`node --test test/` (Node 18+) runs the classifier unit tests.

## Ads (0.3.8)

"Check ads" (popup, on by default) labels ads by their text, using the same classifiers and "Always vegan" list. The effect follows the web setting (dim + blur / collapse / label only), with a chip such as `Ad · about dairy/eggs` inside the ad (hover for reasons, **show** to reveal). Vegan ads get the green side bar; neutral ads are left alone. Ad copy is short, so a single weak mention ("milk", "chicken" once) isn't enough on its own. Non-vegan ads count toward the toolbar badge and appear as "non-vegan ads" in the popup. Per-page and per-site disable apply.

Covered: Google sponsored results (`#tads`, `#bottomads`, `[data-text-ad]`, "Sponsored" blocks) and Shopping ad carousels; Bing (`li.b_ad`, `.b_adTop/.b_adBottom`); DuckDuckGo (`[data-testid=ad]`, `.result--ad`); YouTube ad cards (`ytd-ad-slot-renderer`, in-feed, promoted, display, and companion renderers); same-page display ads (`[id^=google_ads]`, `ins.adsbygoogle`, `[aria-label*=Advertisement]`, `[data-ad]`, and elements labeled "Sponsored"/"Advertisement"/"Ad"); Amazon sponsored products in search results and product-page sponsored widgets (`#sp_detail`, `[data-ad-feedback]`), badged "Sponsored · …" by the Amazon classifier (one badge per item).

**Not handled:** image-only ads with no text or alt text; ads inside cross-origin iframes (most display-network creatives, which the browser keeps unreadable); YouTube video pre-roll and mid-roll ads; ads whose text loads after Vegan Lens has already checked them; and ad markup that sites change without notice.

## Debugging (0.3.9)
Popup → "Debug: log decisions". Then open DevTools (F12) → Console, filter `Vegan Lens`. Each decision logs path (content/ad/container/guard), element tag, headline, verdict, reasons and matched terms. Hover a chip to see the exact matched text and where it was found (title/snippet/alt/ad label).
