# Uber Eats (0.4.66)

Same standards as everywhere else: clear positive evidence only, never fabricate dish counts, every change carries the Vegan Lens icon and name, and nothing about browsing is sent anywhere. No orders, sign-ins, or cart actions.

Uber Eats is a React SPA with obfuscated class names and Cloudflare on many public fetches. Vegan Lens finds units by **stable attributes only**.

## Verified selectors (from independent rendered-DOM scrapers, 2025–2026)

| What | Selector / signal | Confidence |
| --- | --- | --- |
| Menu item | `[data-testid^="store-item-"]` (often on `<li>`) | High — ScrapingBee, Scrape.do |
| Item name / price text | `span[data-testid="rich-text"]` inside the item | High |
| Menu section | `[data-testid="store-catalog-section-vertical-grid"]` | High |
| Restaurant card (feed/search) | `[data-testid="store-card"]`, including `a[data-testid="store-card"]` | High — Scrape.do, Browserless, Angelolloti |
| Store link | `a[href*="/store/"]` | High |
| Search query | URL path `/search` (any locale prefix) + `q` param | High — Browserless skill URL shape |
| Embedded catalog | `__REACT_QUERY_STATE__` / `catalogSectionsMap` → `catalogItems` | High in-app; not required for classification |

Live curl of ubereats.com without a delivery address and without JS rendering returns an app shell (few `data-testid`s, no cards). Store pages often challenge Cloudflare from datacenter IPs. The selectors above come from JS-rendered public storefronts documented by multiple scrapers; fixture tests model those attributes and are **not** a live DOM dump.

## Assumed / fallback selectors

| What | Selector | Notes |
| --- | --- | --- |
| Alt menu item | `[data-testid="menu-item"]` | Reported by AlterLab; kept as fallback |
| Explicit name/price/description | `[data-testid="item-name"]`, `item-price`, `item-description` | Medium; used when present |
| Restaurant title | `h1[data-testid="restaurant-name"]` | Medium; also plain `h1` |
| Cuisine chips on a card | short `rich-text` / `[data-baseweb="tag"]` / `*cuisine*` / `*category*` | Assumed; ratings, ETAs, prices and promos are filtered out |

JSON-LD `Menu` / `MenuItem` is often present on store pages after render. This build does **not** parse JSON-LD; the visible DOM is enough and stays in sync with what the user sees.

## Units and actions

- **Dish (store page):** one `store-item-*` (or `menu-item`) = one unit. Headline = name; snippet = description. Image alt is ignored so a photo caption cannot invent a verdict.
- **Restaurant card (feed/search):** one `store-card` = one unit. Outer wrappers that contain another `store-card` are containers. Headline = `h3` / aria-label; tags = cuisine chips when present.
- **Badges:** vegan → green accent + "Vegan" (dishes) or "all-vegan" (cards); plant signal without a vegan verdict → light "Likely vegan"; non-vegan → dim/hide/label per settings; no clear evidence → unlabeled.
- **Page context:** if the store header name + cuisine chips say vegan/plant-based, the page becomes a vegan context (same as a vegan YouTube channel), so plant versions of meaty dish names are not dimmed.
- **Infinite scroll / SPA:** existing MutationObserver + 0.4.59 recount handle late-loaded items and in-page navigations.
- **Search assist:** `/search?q=` suggest or auto rewrite, same as Google/Amazon/Pinterest.

## Out of scope (this build)

- Customize / "make it vegan" option hints
- Cart warnings
- Dish counts on restaurant cards (the feed card does not expose a menu)
- Grubhub / DoorDash (same design later)
- Mobile apps (browser only; Firefox for Android uses the same web build)

## How to live-check

1. Set a delivery address on Uber Eats (desktop Chrome).
2. Feed/search: a clearly vegan-tagged restaurant should show an "all-vegan" chip; a steakhouse/seafood/BBQ/wings place should dim; a generic pizza place should be untouched.
3. Open a mixed menu: "Crispy Chicken Sandwich" dims; "Impossible Burger" / "Tofu Scramble" get a vegan badge; "House Special" stays unlabeled.
4. Open an all-vegan restaurant (e.g. a store whose chips say Vegan): plant burgers should not dim.
5. Search for `chicken`: the suggest banner should offer a vegan rewrite.
6. Toolbar badge should count non-vegan dishes/cards and survive in-page navigation.
