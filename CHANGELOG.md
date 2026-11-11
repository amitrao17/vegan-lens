## 0.4.70 — Amazon Best Sellers pills and faux-fur PDP details
- Amazon Best Sellers and related p13n list pages (`/gp/bestsellers/`, `/zgbs/`, `/gp/new-releases/`, `/gp/movers-and-shakers/`, `/gp/most-wished-for/`, `/gp/most-gifted/`) now get the same compact product pills as search results. Cards are found by stable hooks (`id^=p13n-asin-index-`, a descendant `data-asin`, or a `/dp/` link), and the title is read from the line-clamp text or the product-image alt. Dim/hide, toolbar counts, and the MutationObserver for lazy-loaded or paginated cards all apply. Suede verdicts are unchanged (still usually treated as leather when not called out as microsuede/faux).
- Amazon product pages now scan deeper, sometimes lazy-loaded sections: feature bullets, the product description, A+ content, product facts / overview, detail bullets, the production details tables (including the hidden voyager `prodDetTable`), the poExpander, and twister / color-variant titles. The banner is re-evaluated when those sections appear, instead of being left at the first early result.
- A bare "Fur" row (for example Inner material: Fur) is no longer treated as proof of animal fur. Only clear evidence that the fur itself is fake — "faux fur", "synthetic fur", "vegan fur", "fur: polyester/acrylic", "faux fur lining", "plush lining (polyester)", or a lining/inner row that names a synthetic — can clear it, and then the banner is **Probably vegan** and names the matched text. "Faux leather", "vegan leather", or "recycled materials" do not clear fur. Real-fur wording (real/genuine/natural fur, rabbit, fox, mink, sheepskin, cowhide, genuine shearling) still wins and stays non-vegan. Without either, the banner is **Caution: may contain animal products.**
- Verified on ASIN B0DG5N6JQ4 (title names Faux Leather only): "Faux Fur Trim" appears once as **Embellishment Feature** in the hidden voyager `table.prodDetTable` (`#voyager-ns-desktop-side-sheet-container`, class `btf-lazy-load-data aok-hidden`). The same table also lists lining-description = Synthetic. The visible facts row still says Inner material: Fur, and About this item mentions "short plush/thick fur lining". The Climate Pledge "Recycled materials" badge is not used as fur evidence.

## 0.4.69 — Hide feedback arrow on resting compact pills
- The share/feedback arrow (⤴) on Amazon and grocery compact badges is hidden while the pill is at rest, so only the Vegan Lens icon sits in a 22px circle.
- On hover, keyboard focus, or tap, the arrow comes back after the verdict text and any swap link, and stays clickable. Full badge style is unchanged.
- No change to verdicts (including caution on titles like "Lace up Design with Fur Lining", where fur is usually faux on budget boots but is not stated).

## 0.4.68 — Badge labels without "Sponsored"
- Amazon and grocery product badges no longer say "Sponsored" in compact or full style. Amazon already labels those cards, so the badge shows only the verdict (e.g. "Probably vegan", "Caution: may contain animal products") plus a swap link when there is one. Screen-reader text follows the same wording.
- The small sponsored dot on compact resting pills is removed.
- Internal sponsored detection and the toolbar ad count are unchanged.

## 0.4.67 — Compact product badges
- Amazon and grocery product-card badges default to a small icon pill (≈22px) in the top-left of the image, colored by verdict (green / amber / red). Full label (e.g. "Sponsored · Probably vegan") appears on hover, keyboard focus, or tap; screen readers get it via aria-label. A tiny white dot marks sponsored cards.
- Settings → Amazon products → Badge style: Compact (default) or Full text (previous look).
- Compact non-vegan "badges only" mode keeps the vegan-swap link inside the expanded tip so it stays clickable.
- Verdict logic unchanged. Web/search/Uber Eats chips are unchanged.


## 0.4.66 — Uber Eats
- Uber Eats (ubereats.com, all locale paths): dish badges on store/menu pages and restaurant chips on feed/search/category pages. Same content classifier as the rest of the web; clear positive evidence only; no fabricated dish counts.
- **Dishes** (`[data-testid^="store-item-"]`, fallback `[data-testid="menu-item"]`): name + description from `rich-text` / `item-name` / `item-description`. Vegan → green accent + "Vegan" chip; plant signal without a vegan verdict → light "Likely vegan" chip (no dim); non-vegan → dim/hide per settings; ambiguous titles (e.g. "House Special") stay unlabeled. Impossible/Beyond/tofu/seitan/tempeh/jackfruit/plant-based neutralize burger/chicken-style words as elsewhere. An all-vegan store header becomes page context so plant versions of meaty names on that menu are not dimmed.
- **Restaurant cards** (`[data-testid="store-card"]` / `a[data-testid="store-card"]`): name + cuisine tags. Clear vegan/plant-based tags → "all-vegan" chip + green accent; clear animal-focused name/tags (steakhouse, BBQ/smokehouse, seafood, wings, butcher, fish market) → dim; generic restaurants untouched. Never invents a dish count.
- **Search assist** on `/search?q=` (suggest or auto, as on Google/Amazon/Pinterest).
- Toolbar badge recount works across Uber Eats SPA navigations (existing 0.4.59 recount).
- Selectors are stable `data-testid` / `/store/` links only — never hashed CSS classes. Findings and verified-vs-assumed notes in `docs/UBEREATS.md`.
- Fixture tests in `test/ubereats0466.test.js`.
- `npm test` runs `node --test test/*.js` (Node 24 treats `test/` as a single broken test file).

## 0.4.65
- Fix: farmers-market false positive on Google Search. "Kensington Farmers' Market" (tok.md.gov) was hidden "about seafood" because its snippet listed "organic meats, seafood, cheese" among baked goods, fruits and vegetables. New mixed-venue rule (`classifier.MIXED_VENUE` + `classifier.MIXED_GOODS` in rules/rules.json, back-filled for older lists):
  - **Mixed listing:** a market/fair/co-op/festival title with no animal word of its own, whose unit also lists plant goods (produce, fruits, vegetables, baked goods, bread, flowers, plants, herbs, crafts...), gets a light, non-hiding label "Mixed listing: includes seafood" (same handling as discussion: no dim/blur, not counted).
  - **Still hidden:** titles naming the animal product ("Fresh Seafood Market", "Joe's Fish Market", "Buy Fresh Seafood", "Farmers Market Butcher Stall"), and market listings with no plant goods at all.

## 0.4.64
- Fix: fur false positive on YouTube. "Fur Elise - Beethoven | Complete Ukulele Fingerstyle TAB ..." (MK Fingerstyle Academy) was dimmed "about fur/leather" with a faux-fur swap. Fur and leather now need positive material evidence (rule data in rules/rules.json):
  - `MATERIAL_NAMES`: "Für/Fur Elise", "Fur Affinity" and German "für" are never fur evidence.
  - `ARTS_CTX` + `MATERIAL_PRODUCT` + `ARTS_MATERIAL`: in a music, arts or game unit (Beethoven, piano, ukulele, guitar, TAB, cover, chords, sonata, fingerstyle, lyrics, tutorial, drawing, gameplay...), bare fur/leather/suede tokens are ignored unless the unit has product or fashion context (real, genuine, mink, fox, trim, collar, coat, jacket, boots, bag, sofa, haul, price...).
- Faux fur stays vegan; sheepskin and cowhide tests unchanged.

## 0.4.63
- Fix: discussion false positive on YouTube. "Why Did Shirdi Sai Baba Eat Meat? I Mohanji" was dimmed "about meat". New discussion rule (`classifier.DISCUSSION` + `classifier.FOOD_SHOW` in rules/rules.json):
  - **Discussion:** a title that asks or debates something about eating animal products gets a light, non-dimming label, "Discussion: about meat". This covers question forms, "why", "I stopped eating", and myth/truth/explained when the title mentions eating, diet, health or ethics, plus ethics, religion and spiritual context.
  - **Still dimmed:** titles that show the food itself (recipe, cooking verbs, mukbang/review/best/taste test, price, restaurant, "how to" + cooking verb).
- Discussion units are not counted in the toolbar number and are never blurred. Sponsored units are never treated as discussion.
- Applies on the web/YouTube/Pinterest/Facebook text path.
- docs/BACKLOG.md: opt-in on-device semantic title classification (Chrome built-in AI / Gemini Nano Prompt API, or a tiny local model); nothing uploaded.

## 0.4.62
- Fix: equipment false positive. TITANKIT PRO "Poultry Fencing" tiles (Home Depot-style store) were dimmed "about poultry". New noun-head rule (`classifier.EQUIPMENT_HEAD` in rules/rules.json): an animal word modifying equipment/supplies (fencing, wire, coop, feeder, incubator, tank, filter, panel, tag, line...) is not evidence; food heads (breast, fillets, wings, sauce...) are still flagged. Egg-capacity phrases ("Incubator 24 Eggs") are also neutral.
- Applied in both the web/content classifier and the store (Amazon/grocery) classifier.
- Rules lists published before 0.4.62 without the new key are back-filled; other missing keys are still rejected.

## 0.4.61 — Pinterest fixes, tinted blur, pinned search banner
- Pinterest: some pins have no title in the page (text-in-image recipe cards). 0.4.60 needs a title, so these were skipped. Now a title-less pin's image alt can stand in for the title, but only on a Pinterest search whose own query is clearly non-vegan, and only when the alt names the same topic (e.g. poultry for 'chicken quesadilla'). Names never count. Everything else is still left alone.
- Blur tint: blurred images that the alt-text image path or a dimmed card blurred had a plain blur with no green tint, because the tint came only from the dimmed unit's own filter. `.vl-img-blur` now carries the same green tint wherever blur is applied.
- Search-assist banner ('Try the vegan version') is sticky at the top of the window while scrolling, with a light shadow, and stays dismissible. The YouTube in-column banner is unchanged. The brand banner was already fixed at the top.
- 6 tests (725 total).

## 0.4.60 — Pinterest
- Pinterest home feed, search and board grids on all country domains: each pin is one unit, found by stable attributes only (`data-test-id="pin"`/`pinWrapper`, `data-grid-item`, `role=listitem` holding a `/pin/` link), never class names. Grid wrappers are containers. Pins that are inserted or filled in later are scanned by the existing MutationObserver and audit loop, including after in-page navigation without a reload.
- Text read: pin title, description, `/pin/` link aria-label, image alt, and the outbound domain words of product pins. Pinner, creator and board-owner names are stripped (0.4.59). A title is required (`requireHeadline`), so an image alt alone never flags a pin.
- Labelled chip inside the pin (dim, hide or label per settings, with a show link); the toolbar count and 0.4.59 recount apply.
- Search assist on `pinterest.*/search/...?q=` (suggest or auto, as on other engines).
- docs/TIKTOK.md: design note for TikTok and other infinite feeds (not implemented).
- Fixture tests are modelled on Pinterest's stable attributes; they are not verified against the live DOM. 6 tests (719 total).

## 0.4.59 — YouTube badge count + creator names
- Badge: Chrome fires tabs.onUpdated 'loading'+url for same-document (SPA) navigations such as YouTube, sometimes after the page already reported. The background then wiped the tab's counts, and nothing re-reported them, so units were hidden but the icon showed no count. This existed since 0.3; it was not caused by the 0.4.57 tab guard. Fix: after 'loading'+url or 'complete', the background asks the tab to recount; web.js, content.js and marketplace.js re-send their current counts and page state. Closed tabs are skipped.
- Classifier: a channel, creator or byline name, or a person's name such as 'Jason Salmon' or 'Kevin Bacon', is no longer evidence for any food or animal rule. web.js passes the unit's channel and byline names (and YouTube's 'by …' aria-label) as `creators`. The classifier strips them and 'Given-name Surname' pairs before matching.
- 7 new tests (706 total).
- Firefox port (desktop and Android): `tools/build-firefox.js` writes `/workspace/vegan-lens-firefox-<ver>.zip` with a Firefox manifest (`background.scripts`, gecko id, min 140 desktop / 142 Android). `background.js` guards `importScripts`. On Android, where the popup opens as a tab, the popup uses the last other tab. See docs/FIREFOX.md. `web-ext lint` reports 0 errors and 0 warnings. 7 tests (713 total).

## 0.4.58 — affiliate tag + support link (inactive until configured)
- New `data.monetization` in the rule list: `affiliate.amazon.{tag,param,domains,disclosure}` and `supportUrl`. Shipped empty = inactive.
- When a tag is set: only Vegan Lens-created Amazon links (swap pills, web "Try:" links, vegan search chip) get `tag=`; never site links, auto-rewrites, other domains, http, or links already carrying a tag. Links get rel="sponsored" and the disclosure in their tooltip.
- Settings: "Support Vegan Lens with affiliate links" (default on; hidden while no tag). About: disclosure when active; "Support Vegan Lens" link (new tab) when supportUrl set.
- Rules validation: tag must be letters/digits/-, domains amazon.*, supportUrl https only; older lists without monetization are back-filled.
- 8 new tests (699 total).

## 0.4.57 — 2026-10-30
- Fix: "Unchecked runtime.lastError: No tab with id" on the Errors page. setCounts() awaited a session-storage write, then called action.setBadgeText / setBadgeBackgroundColor / setTitle with no callback or catch. Count messages from a tab that had just closed, or from a prerendered page whose tab id never became a real tab, made those calls fail.
- New VeganBadge.safeTabCall(fn, ...args) in badge.js. It always passes a callback that reads chrome.runtime.lastError, also catches promise rejections and thrown errors, and resolves null instead of failing.
- All tab-scoped calls in background.js now go through it: the three badge calls, setIcon, and the right-click share tabs.sendMessage.
- Per-tab state is cleared on close: tabs.onRemoved records the tab id (last 200 kept) and clears its counts, URL, disabled state, any pending share and its session keys. setCounts and setIconState skip closed tabs, and setCounts checks again after its await. A tab replaced by a prerendered page (tabs.onReplaced) is cleared the same way.
- Tests: test/tabSafety0457.test.js (6 tests, with a mocked chrome that sets lastError or rejects).

## 0.4.56 — 2026-10-30
- Icon refresh (approved preview 0.4.56d, generated by audit/make_icons_v0456d.py). Lens, ring and stub handle are unchanged, and the leaves still clear the ring:
  - the bottom point where the leaves meet is about 4px lower at 128px;
  - the leaves are more clearly separated (narrower near the base, so the notch between them sits lower);
  - a short stem angled toward the handle, at 32px and up;
  - curved midrib veins in the lens colour, tapering toward the tip (3px at 128px, 1px at 32/48px);
  - a tapered centre line from the notch, ending about 60% of the way down so there is space above the stem.
  - At 16px the icon has no stem, veins or centre line, to keep it legible.

## 0.4.55 — 2026-10-30
- Icon: bigger leaves that fill more of the lens (about 39% more leaf area). Lens size, ring and stub handle are unchanged, and the leaves still clear the ring at 16px. Green and red icons regenerated at 16/32/48/128 (tools: audit/make_icons_v0455.py).
- Manifest description rewritten as a one-line summary under 132 characters. The Chrome Web Store detailed description and the README now have a "Key features" bullet list that matches what the extension does. The store privacy text lists every network request (database lookups, rule-update checks, shares).
- Fix: rule-list changes (editor Apply/Reset, signed update) now update open tabs live. web.js waits 250 ms after a change, then clears its marks and re-scans the page, the same reset it does on navigation, so the product/article banner is redone too. marketplace.js does the same with clearAll() + run(). Before this, pills that were already drawn stayed until a reload.

## 0.4.54 — 2026-10-30
- New rules editor (rules-editor.html), opened from popup About › Advanced › "Edit rules": edit the whole list or one section as JSON; Validate (same schema + regex-safety checks as signed updates, errors show their path), Apply, Export/Import JSON, Reset to built-in.
- Local edits are stored only in chrome.storage.local (`vlRulesLocal`), take precedence over the built-in list and remote updates, and apply live to open tabs. No signature, no network.
- Popup About shows "Local edits active" when an override is in use.
- Dev hook: `window.vlRulesEditor.apply(bundle)` / `.reset()` / `.get()` on the editor page for CDP sessions.
- rules.js: `useLocal`, `active()`, `LOCAL_KEY`; info() reports `source:'local'` and `localActive`.

## 0.4.53
- Root cause (ugg.com/women showed 0 checked): brand-site product grids (Salesforce Commerce div.product[data-pid] tiles) matched no unit selector, so tiles were never scanned; and tile names ("Tasman II") don't contain the brand, so the UGG style list couldn't apply on ugg.com itself.
- Generic product tiles: elements with product-id attributes (data-pid, data-product-id, ...), schema.org Product microdata or product-tile/card classes that hold a link and an image are scanned as units (outermost wins); short names next to a price are used as the title.
- Style materials: the brand is implied on the brand's own domain. New entries verified on ugg.com product pages (2026-10-30): Tasman II ("Suede upper", "17mm sheepskin vamp lining"), Tazz II ("Suede upper", "10mm sheepskin lining"), Classic Mini II and Classic Tall II ("17mm Twinface sheepskin upper"). Classic Short no longer matches Classic Short Spillseam (its page lists "UGGplush Lining"). Tazz Whipstitch Knit, Lowmel and Sunburst Tall list UGGplush lining only: not flagged. Rule list 2026.10.30.2.
- Product pages (JSON-LD Product / og:type product): top banner from the name, description and material lines (also inside collapsed accordions), e.g. "this product contains sheepskin, suede"; falls back to the style caution.
- Tests: test/uggTiles0453.test.js.

## 0.4.52
- Rule data separated from code, like ad-blocker filter lists: rules/rules.json (schemaVersion 1, listVersion 2026.10.30.1) holds the classifier keyword/pattern lists, neutralizers (false friends, honey shades, plant-leather, etc.), thresholds, shop cautions and style materials, the Always-vegan brand list and vegan picks, brand-site lists and banner wording, and swap rules/keywords/audience wording. Regexes are stored as strings and compiled after validation (length, flags, nested-quantifier guard). rules/rulesData.js is the generated bundled copy (tools/build-rules.js). Behavior with the bundled list is unchanged.
- Optional list updates: off unless an update URL is set (Settings > About). The background checks it daily (chrome.alarms; new "alarms" permission, no install warning), plain GET with no browsing data. It accepts only an Ed25519-signed ({payload, signature}), schema-valid list newer than the bundled one, stores it in chrome.storage.local, and every context falls back to the bundled list on any failure. The public key in rules/rules.js is a PLACEHOLDER (no update can verify until it is replaced); tools/sign-rules.js generates a key and signs lists. No backend is included.
- About shows the rule-list version (built-in/updated), the optional update URL and "Update now" (disabled with an explanation while no URL is set).
- Tests: test/rules0452.test.js (loading, signature reject, schema reject, fallback, live update, signing tool).

## 0.4.51
- Vegan picks: vegan products from mostly non-vegan brands, each checked on the brand's own page (2026-10-30): Dr. Martens vegan line (Vegan 1460 Felix + vegan collection), Hellmann's Plant Based Mayo ("Certified Vegan"), Ben & Jerry's Non-Dairy ("certified vegan"), Magnum Non-Dairy, Garnier Micellar Cleansing Water. Brand + product wording together get a vegan verdict/pill on retailers, search and brand sites; the brand's regular products are unaffected.
- Brand-site strip for those mixed brands: "This brand has a vegan line" (plant-based wording for flexitarian/omni) linking the verified vegan collection page; same toggle, dismissal and site/page blocks as 0.4.50 banners.
- brandSites sources for Follow Your Heart, Kite Hill, Field Roast, Upton's Naturals and Herbivore re-verified by opening each page; exact quotes now shown.
- Tests: test/veganPicks0451.test.js.

## 0.4.50
- Brand-site banners (new brandSites.js, loaded in the general web group before web.js). On a brand's own site (registrable domain, any subdomain such as www./shop.), a slim fixed strip appears at the top, branded with mark(). Retailers and marketplaces never get it (amazon, walmart, target, sephora, ulta, ebay, instacart and others). Mixed brands get no strip.
  - All-vegan brands (17, each with a source checked 2026-10-30): green strip "Every product from this brand is vegan" (flexitarian/omni: "plant-based") with a Source link. Food: Oatly, Daiya, Miyoko's, Tofurky, Follow Your Heart, Kite Hill, Field Roast, Upton's Naturals. Cosmetics: e.l.f., Milk Makeup, Pacifica, KVD Beauty, Youth To The People, Herbivore Botanicals. Fashion: Matt & Nat, Will's Vegan Store, NAE. Left out for lack of a whole-line statement: Beyond Meat, Violife, Impossible.
  - All-non-vegan (only Omaha Steaks): soft grey strip worded by the audience slider ("Looking for plant-based options? Here are some swaps", gentler for flexitarian/omni) linking a category-level "plant-based steak" search. No brand claim.
  - The × hides it for that site (chrome.storage.local brandBannerDismissed). New Settings toggle "Brand site banners" (default on). Also respects Web content off, the site block and the page disable.
- Google "Sponsored Products" (PLA) fix, from Amit's 'ugg' report. Each tile was already detected as an ad unit, but its headline came from an empty template link label (" for  from UGG US"), so it was classified on junk.
  - adParts now skips template labels with empty slots and bare "From X"/"Rated …" labels, so it uses the full tile title. Checked on the live tiles on 2026-10-30: "Tasman II Sheepskin Slippers", "Sand Suede", "Suede Sheepskin Lining".
  - sheepskin, lambskin, goatskin, pigskin and deerskin now count as leather-grade (faux/vegan exceptions still apply).
  - New small STYLE_MATERIALS list: UGG Classic Ultra Mini, Classic Short and Ultra Mini Bailey Bow → "likely not vegan: sheepskin". Each was checked live on its ugg.com product page ("Sheepskin Lining"). It only gives a caution pill, never a certain verdict. Neutral sponsored product tiles now also get caution pills.
- Tests: brandBanner0450, googlePla0450.

## 0.4.49
- Opt-in image-context stats (approved by Amit, to size on-device OCR). They are only counted while "Share anonymous usage stats" is on (default off). Aggregate numbers only, rounded to 5 in the report. No URLs, advertiser names, text or images.
  - `images`: imagesSeen (meaningful images in units Vegan Lens checks, deduped per image), imagesContextless (no alt/aria-label/'text that says' AND the unit has under 20 meaningful characters once Ad/Sponsored, prices and menu/player buttons are dropped), imagesContextlessUndecided (of those, the unit verdict is neutral/unknown/none).
  - `adImages` (ads only, deduped per ad unit): adsSeen, adsWithImages, adsImageTextless, adsTextlessUndecided. Covers generic/Facebook feed ads (web.js applyAd) and Marketplace sponsored tiles.
  - Icons/logos under 64px, role=presentation and aria-hidden images are skipped.
- About tab shows today's local counts: "Images with no description or text: N of M (… left undecided) (ads: X of Y …)".
- telemetry/worker.js allow-list and aggregation include `images` and `adImages` (not deployed). CHROMEWEBSTORE.md, telemetry/README.md and the popup stats text are updated.
- adUnits.js now also loads in the Marketplace content-script groups (pure helpers).

## 0.4.48
- Facebook Marketplace after in-app navigation: marketplace.js now also loads on facebook.com and gates itself on /marketplace paths, and web.js stands down there. Before this, opening Marketplace from the Facebook tab bar (ref=app_tab) left the grid unscanned (no tile was checked at all).
- Marketplace sponsored tiles (off-site link, last line 'Ad'/'Sponsored', never a /marketplace/item/ link) are found and classified. The text comes from the visible lines plus image alt/aria-label (incl. "text that says '...'") and link labels; player and menu chrome is dropped. The 0.4.40 leather/cowhide rule applies, a dairy-free-only dairy match is not flagged, and listings and the live-animal rule are unchanged.
- Dairy-free/vegan cheese analogues allow up to two descriptive words ('Dairy-Free Meltable Mozzarella').
- share.js wires its listeners once even when two content-script groups load it.
- Limit: when an ad's claim exists only in the image pixels (empty alt, as on the observed Konjoun tile), it is not detectable without OCR (backlog).

## 0.4.47
- Ad labels never climb into a page shell: a parent holding a landmark/region (nav, main, header, form, role=navigation/main/banner/region/complementary/search) or more than 25 links is not an ad. Fixes Yahoo Mail, where a bare sidebar 'AD' over an empty slot marked the whole app container as an ad unit.
- Image content unit skips ad-marked and landmark-holding ancestors; a message-body boundary (role=region, or data-test-id/aria-label containing 'message-body') is the unit for its images (Gmail div.a3s unchanged).
- Table-based emails without such a boundary resolve to their outermost table, so all images of one message share one unit.

## 0.4.46
- Image blur respects the nearest content unit (Gmail message body, article, post): a unit that is vegan overall (vegan/plant-based wording) never blurs its images, whatever their alt says ('Chicken Filets', 'Spicy Beef Ramen'). Fixes blurred images in vegan newsletters on Gmail, where the page (the inbox) never counted as vegan.
- Every blurred image now carries a branded 'Vegan Lens · blurred: <reason> · show' label; clicking it unblurs.
- SPA navigation (hash/popstate, e.g. opening a Gmail message) triggers a clean rescan.

## 0.4.45
- Walmart (`[data-item-id]`, `div[role=group]` with `/ip/` links) and Target (ProductCardWrapper, `/p/` cards) search tiles are detected; Walmart `/ip/` and Target `/p/` product pages get one banner and one swap pill linking to the store's own search, reading the title plus Ingredients/Specifications text.
- Lactose-free milk counts as dairy (only negations of the animal term itself clear it); Grassmilk and other *-milk compounds are dairy; milk/cheese/egg product ads ending in the product noun pass the ad gate.
- Food Network PromoItem/Card/recipe-list cards detected; Yelp category tags (Steakhouses, Seafood, Barbeque...) are a strong signal.
- Chips never render empty (label fallback plus CSS resets against host text-hiding styles).
- Zappos/Etsy tiles without headings use the link label; Chelsea/chukka/brogue etc. count as wear context; Zappos and Etsy swaps search the store itself.
- Bing banner is placed inside the results column.

## 0.4.44
- Product-page swap pill: on product pages classified as meat, dairy, eggs, honey or animal materials (Amazon, grocery sites, Sephora/Ulta, other handled stores) one branded "Try: <alternative>" pill sits next to the verdict and opens a search on the same store (amazon /s?k=, grocery /product-search/, Sephora, Ulta, Target, Walmart, Instacart; web search otherwise). At most one per page, never reorders, respects Show vegan swaps.
- One curated swap map in swaps.js (KEYWORDS + RULES), category-level terms only (brand queries removed); longest match wins; vegan/faux/plant-based text never gets a swap. The web fabric 'Try:' link and the search chip use it too.
- Search chip: "Try the vegan version: <query>" on Google, Bing, DuckDuckGo, YouTube and Amazon, built from the swap map (e.g. ground beef recipes -> plant-based ground recipes).
- Settings: "Who is this for?" slider (Vegan / Flexitarian / Omni, default Vegan). Changes wording only (Easy swap, Contains meat, items flagged, share sign-off, popup tagline); verdicts and dim/hide unchanged. All strings in swaps.js AUDIENCE.
- No new stats.

## 0.4.43
- Popup split into three accessible tabs (This page, Settings, About) under the compact header. ARIA tablist/tab/tabpanel, arrow/Home/End keys, visible focus, fixed panel height so switching doesn't jump.
- This page: counts, disable-on-page, Share a find, Report a mistake, all-clear line. Settings: all toggles and modes with subheadings, site lists, Always vegan. About: all-time counter and Reset, anonymous stats opt-in, version, privacy/help, Advanced dev flags.
- Last tab is remembered in chrome.storage.local; a pending share from a pill or the context menu always opens This page with that item.

## 0.4.42
- Share a find: new "Share a find" section in the popup lists up to 20 items Vegan Lens found on the page (title, verdict, link, vegan-swap link), each with a Share button. The message is composed on-device in an editable preview ("Heads up: <title> — <verdict>. Vegan swap: <link>. <link>. Found with Vegan Lens"), then sent only when you pick a destination: copy for DMs (Instagram, Messenger, iMessage), email, X, Facebook (link + text copied), Reddit, WhatsApp, Telegram, LinkedIn, or the system share sheet.
- Public destinations (X, Facebook, Reddit, LinkedIn, Telegram) append #VeganLens; email, DMs/clipboard and WhatsApp don't (one config map in share.js). STORE_URL constant (blank for now) is appended when set.
- Share button on every Vegan Lens pill/chip (keeps brand attribution): opens the popup share flow when Chrome allows, otherwise a small fixed-position in-page menu (keyboard + aria labels, never reflows the page). New right-click item "Share with Vegan Lens" (new permission: contextMenus). No clipboard permission needed.
- Opt-in stats: "sharesClicked" rounded daily count per destination type only (extension + worker allow-list).

## 0.4.41
- Plant-based leathers count as vegan in both the web and product classifiers via a general qualifier before 'leather'/'suede': cactus (Desserto), apple, mushroom/mycelium (Mylo, Reishi), pineapple (Piñatex), grape/wine, cork, corn, coconut, kombucha, paper, plant-based and bio-based leather, plus 'leather alternative', 'leatherette' and 'leather-look'. Real-leather words (genuine leather, full-grain, cowhide) elsewhere in the text still dim.

## 0.4.40
- Facebook: post units now also read text inside images (FB auto alt 'May be an image of ... and text that says "..."'), image aria-labels, the link-preview headline/domain, and collapsed 'See more' text already in the DOM (no clicking). Fixes a Konjoun barefoot-sock ad whose 'Full-grain cowhide' claim was only in the image.
- Leather: cowhide, calfskin, full-grain/top-grain, genuine/real leather count as leather on their own; bare 'leather'/'suede'/'nubuck' counts when the post is about footwear, socks, apparel or accessories. Vegan/faux/cactus/apple/mushroom leather still excluded.

## 0.4.39
- Web/Facebook: ambiguous foods (burger, sausage, nuggets, patty, meatballs, hot dogs, "meat") are no longer scored as animal when the same unit names a plant protein or vegan word anywhere (mushroom, bean, lentil, tofu, tempeh, seitan, jackfruit, chickpea, quinoa, veggie, vegan, plant-based, Beyond, Impossible...). Previously only adjacent words ("mushroom burger") counted. Explicit meats (beef, bacon, pork, chicken, steak...) still dim.
- Facebook: the post author/page name (from the post header heading/strong/link text, no class names) is an author signal; names containing vegan, plant-based or WFPB (not ex-/anti-/non-vegan) never dim or blur, like the Reddit vegan-community rule. Fixes 'The Vegan Week' burger-recipes post hidden as "about burgers".

## 0.4.38
- Toolbar icon maximized: lens is now ~93% of the canvas (was 84%) with ~0 padding top-left, the handle is a short thick stub peeking out at the bottom-right corner (~2px at 16px), and the white V leaves fill ~73% of the lens interior. Thin darker outline kept. Normal and red variants regenerated at 16/32/48/128.

## 0.4.37
- Toolbar icon redesigned to match neighbor icon sizes: the lens is now 84% of the canvas (was about 69%), pushed top-left, with a short thick handle reaching the bottom-right corner, a thin darker-green outline for light/dark toolbars, and larger V leaves legible at 16px. All sizes (16/32/48/128) regenerated for the normal and red (page-off) variants.

## 0.4.36
- Marketplace: animal-for-sale dimming now requires a positive live-animal signal (young/plural animal nouns like kittens/puppies/chicks, breed names or purebred/AKC/CKC/TICA, age or sex like "8 weeks"/male/female/pair, care terms like vaccinated/dewormed/ready to go home/rehoming fee, for sale, breeder, litter of, hatching eggs, laying hens, roosters, pullets, livestock). A bare animal noun with another noun ("Large cat wheel", "Rooster statue") or a bare animal-only title ("Cat" with a price) stays neutral. Adoption handling unchanged; supplies list kept only as an extra guard.

## 0.4.35
- Marketplace: pet furniture and accessories (cat shelves, perches, trees, condos, hammocks, wall-mounted climbers, treats, toys) are no longer treated as live animals, so listings like "Cat Shelves." are not dimmed as "Animal for sale". Real animal sales (kittens/puppies for sale, breeders, livestock) still dim; adoption listings still left alone.

## 0.4.33
- Drinks: food-pairing clauses ("pairs well with cheese", "serve with steak", "goes great with") are ignored; no food swaps on drink pages. Fining agents/lactose/honey still flagged.
- Beauty: cosmetic butters (lip/body/shea/cocoa/mango/murumuru/... butter, "butter balm", bare "butter" in beauty context) are plant butters; "dairy butter" and milk still flagged.
- Always-vegan cosmetics brands (brand-site sources): e.l.f. (elfcosmetics.com/pages/elf-cares-furry-friends; PETA Global Animal Test-Free and Vegan), Milk Makeup (milkmakeup.com/pages/clean), Pacifica Beauty (pacificabeauty.com; pacifica-beauty.gorgias.help FAQ, PETA certified), KVD Beauty (kvdbeauty.com/pages/about-kvd), Youth To The People (youthtothepeople.com FAQ). Excluded: Kosas, Briogeo (official FAQs list non-vegan items), Fenty, Tarte, ColourPop, Cover FX (no live brand source).
- Image blur: Reddit "r/<sub> - " alt prefix stripped; images in classified but undimmed units blur only with a high-confidence alt (score <= -3).
- Probably-vegan banner: one line, product-details note and full text in tooltip.
- Open Beauty Facts "different product type: food" falls back to Open Food Facts.
- "pig(s) in a blanket" is meat unless vegan-qualified.

## 0.4.34
- Drinks: if every matched term is a dish word (cheese, steak/beef, chicken, fish, pork, bacon, meat, shellfish, anchovy), verdict is unknown, never NOT vegan. Lactose, honey, isinglass, gelatin, egg white, casein still flag.
- Image-blur classifier: cosmetic butters (lip/body/shea/... butter, butter balm, butter near balm/lotion/lipstick) are not dairy.
- Sephora/Ulta: fallback to h1/og:title + brand link when no JSON-LD Product; always-vegan brand shows "✓ Vegan brand (<brand>)" with source "Vegan brand list" and skips the database lookup; extra retry at 15 s.
- Card-photo blur: only images inside the dimmed unit's own post/card container (webUnits.ownsImage).
