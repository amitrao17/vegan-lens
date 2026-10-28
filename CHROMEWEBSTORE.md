# Chrome Web Store Listing — Vegan Lens

> Last Updated: 2026-10-28

## Store Listing

**Extension Name** [REQUIRED]
Vegan Lens

**Short Description** [REQUIRED]
Highlights vegan products and content across the web, and dims non-vegan products, content and ads.

**Detailed Description** [REQUIRED]
Vegan Lens helps you spot vegan products and content at a glance while you shop, search and browse.

Key features:
Marks vegan and non-vegan products on Amazon and on Giant Food, Stop & Shop, Martin's and Giant grocery sites.
Dims (or hides) non-vegan products, sponsored results and ads, with a small label explaining why.
Suggests vegan alternatives, such as a "Try: vegan cheese recipe" link on Google, Bing, DuckDuckGo, YouTube and Amazon searches.
Shows a running count of non-vegan items detected.
Lets you add your own "always vegan" brands, blocklist or allowlist sites, and disable it on any page or site.

How to use it:
1. Install the extension and browse as usual.
2. Click the Vegan Lens icon to adjust the effect (dim, blur, hide), strictness (e.g. honey, beeswax) and where it runs.
3. Use "Disable on this page" or "Disable on this site" anytime.

Privacy: all classification happens on your device. Vegan Lens does not collect, sell or send your browsing data. The only network request it makes is an optional ingredient lookup of a product barcode to the public Open Food Facts database.

Matching is heuristic and may sometimes be wrong; your own brand entries always take priority.

**Category** [REQUIRED]
Shopping

**Single Purpose** [REQUIRED]
Identifies vegan and non-vegan products and content on web pages and visually highlights or dims them.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon128.png |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 4 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 5 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

### Screenshot Notes
1. Amazon search results with non-vegan products dimmed and vegan products marked.
2. YouTube search with dimmed non-vegan videos, their labels, and the "Try: vegan …" suggestion.
3. Grocery site (Giant Food) product search with non-vegan items hidden or dimmed.
4. The popup: counts, mode settings, and per-page/per-site disable.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| storage | permissions | Saves the user's settings (mode, strictness, effect, block/allow lists, "always vegan" brands) in chrome.storage.sync, the running "non-vegan items detected" total in chrome.storage.local, and per-tab counts shown in the popup in chrome.storage.session. Nothing stored leaves the browser except through Chrome's own settings sync. |
| activeTab | permissions | Lets the popup act on the tab the user is viewing when they click the toolbar icon, e.g. "Disable on this page / this site" and showing that tab's counts, without requesting broad tabs access. |
| https://world.openfoodfacts.org/* | host_permissions | On grocery product pages, the product's barcode (UPC) is looked up in the public Open Food Facts database to read its ingredient vegan status. Only the barcode is sent; no user data. |
| Content scripts on http(s)://*/* (plus Amazon, Giant Food, Stop & Shop, Martin's, Giant, Google/Bing/DuckDuckGo/YouTube search) | content_scripts matches | The single purpose is labeling vegan/non-vegan products, content and ads wherever the user browses, so the scripts must read page text locally to classify it and add the dim/label styling. Page content is processed on-device only and never transmitted. Users can limit it to an allowlist or turn off web content entirely in the popup. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

Vegan Lens reads page text (website content) on-device only to classify items; it is not stored beyond per-tab counts, not transmitted, and not shared. The only outbound request is a product barcode to Open Food Facts, which contains no user information.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | No | No | — | No |
| Financial info | No | No | — | No |
| Authentication info | No | No | — | No |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | No | No | — | No |
| Website content | No (processed locally only) | No | Classify items on the page | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
TODO — host a policy stating: all processing is local; no data collected or sent; barcode-only lookups to Open Food Facts.

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
TODO

**Contact Email** [REQUIRED]
TODO

**Support URL / Email** [RECOMMENDED]
TODO

**Homepage URL** [RECOMMENDED]
TODO

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.4.2 | 2026-10-28 | Initial store submission | Draft |

## Review Notes

### Known Issues / Limitations
Broad host access via content scripts (http(s)://*/*) will draw in-depth review; justification above. Classification is heuristic keyword matching and may be wrong.

### Rejection History
None yet.
