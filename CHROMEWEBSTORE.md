# Chrome Web Store Listing — Vegan Lens

> Last Updated: 2026-10-28

## Store Listing

**Extension Name** [REQUIRED]
Vegan Lens

**Short Description** [REQUIRED]
Spot vegan and non-vegan products and content as you shop, search and browse, with sourced context and easy vegan swaps.

**Detailed Description** [REQUIRED]
Vegan Lens helps you spot vegan products and content at a glance while you shop, search and browse.

Key features:
• Product badges: marks products Vegan, Likely vegan, Not vegan or unknown on Amazon, Giant Food, Stop & Shop, Martin's and other supported stores, and dims or hides non-vegan products and ads with a label explaining why.
• General web content mode: dims or flags meat-, dairy- and animal-material content on other sites, including shop product tiles and product pages, and leaves pages that are vegan overall alone.
• Context cards with short, sourced facts.
• Per-tab toolbar count, plus an optional all-clear check when a page has nothing non-vegan.
• Search assist: suggests vegan searches on Google, Bing, DuckDuckGo, YouTube and Amazon.
• Easy swaps: a "Try:" pill next to non-vegan items and a vegan search chip that rewrites your own query.
• Audience slider: choose who it is for (Vegan, Flexitarian or Omni) to tune how results are presented.
• Brand-site banners (all-vegan brands, brands with a vegan line, plant-based ideas on meat brands) and curated vegan picks.
• Facebook and Marketplace posts and listings, and Gmail messages.
• Share a find: pick something Vegan Lens found and share it; public posts add #VeganLens. Nothing is sent until you choose a destination.
• Optional open-database lookups (off by default): sends only a barcode, or a brand + product name, to Open Food Facts / Open Beauty Facts.
• Editable, updatable rule lists: edit keywords, patterns and brand lists in the built-in editor (stays on your device), or receive signed list updates.
• Privacy: classification runs on your device and no browsing data is sent. Anonymous usage stats are opt-in and off by default.

How to use it:
1. Install the extension and browse as usual.
2. Click the Vegan Lens icon to adjust the effect (dim, blur, hide), strictness (e.g. honey, beeswax) and where it runs.
3. Use "Disable on this page" or "Disable on this site" anytime.

Privacy: all classification happens on your device. Vegan Lens does not collect, sell or send your browsing data. An optional "Share anonymous usage stats" setting, off by default, sends one daily report of rounded counts and which features are on. It contains no URLs, titles, searches or identifiers, and you can preview it in the popup. Network requests happen only for features you turn on or use: open-database lookups (barcode or brand + product name only), rule-list update checks from a URL you set, and shares you send.

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
| contextMenus | permissions | Adds one right-click item, "Share with Vegan Lens", that opens the share panel for the Vegan Lens-flagged item under the cursor. The menu item is static; it reads nothing until clicked, and nothing is sent until the user picks a destination. |
| alarms | permissions | (0.4.52) Schedules one daily check for an updated rule list (keyword/brand lists). It does nothing unless the user enters an update URL in Settings > About; it is off by default. Shows no install warning. |
| https://world.openfoodfacts.org/* | host_permissions | On grocery product pages, the product's barcode (UPC) is looked up in the public Open Food Facts database to read its ingredient vegan status. Only the barcode is sent; no user data. |
| https://world.openbeautyfacts.org/* | host_permissions | On beauty product pages (Sephora, Ulta, Amazon Beauty), the barcode — or if absent, the brand and product name — is looked up in the public Open Beauty Facts database. Nothing else is sent. |
| Content scripts on http(s)://*/* (plus Amazon, Giant Food, Stop & Shop, Martin's, Giant, Google/Bing/DuckDuckGo/YouTube search) | content_scripts matches | The single purpose is labeling vegan/non-vegan products, content and ads wherever the user browses, so the scripts must read page text locally to classify it and add the dim/label styling. Page content is processed on-device only and never transmitted. Users can limit it to an allowlist or turn off web content entirely in the popup. |

## Partner offers disclosure

Vegan Lens may show partner offers matched on your device. Some links may earn a commission that supports development and partner nonprofits. No browsing data is collected. Offers appear only next to an item Vegan Lens already flagged, at most one per page, never on vegan pages, and never change a verdict. Links open the brand's own page; any referral parameter is shown in the offer data and added only when you click. Toggle: popup → "Show partner offers".

## Affiliate links disclosure (0.4.58)
As an Amazon Associate, Vegan Lens earns from qualifying purchases. When enabled, some swap links to Amazon may earn Vegan Lens a small commission at no cost to you.
- Only links Vegan Lens itself adds (swap "Try:" pills and the vegan search chip) that point to Amazon search/product pages can carry the tag. The site's own links, search engines, defaults and verdicts are never changed, and an existing tag is never replaced.
- Off by default in the shipped list (no tag configured). Users can turn it off in Settings → "Support Vegan Lens with affiliate links".
- The disclosure appears in the link tooltip and in the About tab whenever it is active.
- No browsing data is sent anywhere; the tag is added locally to the link URL.

## Open database lookups

Toggle: popup → "Look up products in open databases" (on by default). Only on a product page you are viewing, Vegan Lens may send:
- **Open Food Facts** (world.openfoodfacts.org, Open Food Facts association): the product's barcode (UPC/EAN digits) only.
- **Open Beauty Facts** (world.openbeautyfacts.org, Open Food Facts association): the barcode, or if none is on the page, the brand and product name (plain text, max 80 characters each) — for beauty products on Sephora, Ulta and Amazon Beauty.

Nothing else is sent: no URLs, page text, browsing history, cookies (`credentials: 'omit'`), referrer or identifiers. Results are cached on your device (chrome.storage.local) for 7 days (misses 1 day). Barnivore has no public API, so Vegan Lens only shows a "Check on Barnivore" link on drink pages; it opens only when you click it.

## Privacy & Data Use

### Data Collection

**Rule lists (0.4.52):** the keyword, pattern and brand lists live in a versioned data file (rules/rules.json) bundled with the extension. Optional updates are off by default; if the user sets an update URL, the extension fetches that one file about once a day with a plain GET (no cookies, no referrer, no browsing data, no identifiers). An update is used only if it carries a valid Ed25519 signature from the developer key, passes schema checks, and is newer than the bundled list; otherwise the bundled list is used. Updates contain data only (no code); patterns are compiled locally after safety checks.

**Sharing (0.4.42):** the "Share a find" panel, the share button on Vegan Lens pills and the "Share with Vegan Lens" context-menu item compose a message on your device from one item's title, verdict, link and optional vegan-swap link. Nothing is sent until you press a destination (copy, email, X, Facebook, Reddit, WhatsApp, Telegram, LinkedIn or the system share sheet); the destination then receives only the text you see and can edit. Clipboard copy uses navigator.clipboard from your click, with no clipboard permission. If opt-in usage stats are on, only a rounded daily count per destination type is included ("sharesClicked"), never item text or URLs.

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

- Affiliate links (0.4.58): the tag is added locally to Vegan Lens's own Amazon swap links only; no browsing data, clicks or purchases are sent to or tracked by Vegan Lens.

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
TODO — host a policy stating: all processing is local; no data collected or sent; barcode-only lookups to Open Food Facts; barcode or brand + product name lookups to Open Beauty Facts (see "Open database lookups"); toggle in popup. Include: "Vegan Lens may show partner offers matched on your device. Some links may earn a commission that supports development and partner nonprofits. No browsing data is collected."

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

**Image-context stats (0.4.49):** if opt-in usage stats are on, the daily report also includes rounded totals of images Vegan Lens checked ("images": imagesSeen, imagesContextless = no alt/aria description and no meaningful visible text in its post/card/message, imagesContextlessUndecided = of those, left with no vegan/non-vegan verdict) and a separate ad breakdown ("adImages": adsSeen, adsWithImages, adsImageTextless, adsTextlessUndecided). Icons, logos and decorative images are not counted. These are aggregate numbers only: never URLs, advertiser names, text or images. When stats are off nothing is counted. Today's counts are shown in the popup's About tab.
