# Vegan Lens partner offers

Vegan Lens may show partner offers matched on your device. Some links may earn a commission that supports development and partner nonprofits. No browsing data is collected.

## Rules
1. **Vegan-certified only.** Every offer must name a third-party certification (e.g. Certified Vegan / Vegan Society / BeVeg) in `certified`, verifiable at `source`. No certification, no listing.
2. **No paid placement over accuracy.** Offers are rendered *after* classification and never change a verdict, threshold or the swap suggestion. A partner cannot pay to be dimmed less, ranked higher, or shown on pages that weren't flagged.
3. **Brand's own page.** `url` must be an `https://` page on the brand's own site — no redirectors, link shorteners or tracking hops.
4. **Expiry.** Every entry needs `expires` (YYYY-MM-DD). Expired offers are skipped automatically; remove them on the next release.
5. **Disclosure.** The disclosure above appears in the store listing, privacy policy, popup toggle, and the "Why this offer?" tooltip on each offer link.
6. **Placement limits.** Only next to an item already dimmed/hidden, only when its category matches, max 1 offer per page, never on vegan pages/communities. Users can turn offers off (popup → Show partner offers).

## Privacy
Matching runs 100% locally. The list ships in `coupons.json`. `COUPONS_URL` in `background.js` is blank by default (no network calls). If set, the same list is fetched for everyone at most once a day with `credentials: 'omit'`, schema-validated, and cached in `chrome.storage.local`. With "Share anonymous usage stats" on, only rounded daily counts `offersShown` / `offersClicked` are reported — never brand, offer id, URL or page.

## Adding an entry (`coupons.json`)
```json
{
  "id": "brand-oatmilk-2027q1",
  "brand": "Brand Name",
  "categories": ["milk"],
  "text": "15% off oat milk",
  "code": "OPTIONALCODE",
  "url": "https://brand.example/oat-milk",
  "expires": "2027-03-31",
  "source": "https://certifier.example/brand",
  "certified": "Certified Vegan (Vegan Awareness Foundation)",
  "example": false,
  "ref": "ref=veganlens"
}
```
Categories: milk, cheese, butter, yogurt, ice cream, eggs, honey, meat, fish, coats, shoes, bags, knitwear, cosmetics, condoms. `ref` is optional (`key=value`). Invalid entries are dropped. Run `node --test test/` before shipping. Entries with `example: true` only render with the Advanced → "Show example offers" dev toggle.

## Chrome Web Store affiliate policy compliance
- Affiliate/referral use is disclosed in the listing, privacy policy and UI before any link is clicked.
- Referral parameters are appended **only on a user click** of a Vegan Lens–rendered offer link; the extension never rewrites, injects or replaces affiliate tags on other links, cookies or pages ("no silent tag injection").
- Offers are clearly labelled as added by Vegan Lens and can be disabled.
