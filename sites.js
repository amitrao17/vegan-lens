// Vegan Lens site adapters helpers (pure, DOM-light). Browser global (VeganSites) + Node module.
// Grocery adapter: Ahold Delhaize USA banners (Giant Food, Stop & Shop, Martin's, Giant/The Giant Company) share one platform.
// Tiles (from live giantfood.com DOM, Oct 2026): li.product-cell[data-product-id] > a[href^='/product/'] +
// a.product-grid-cell_name-text. Generic fallback: smallest ancestor of one product link that also shows a price.
(function (root) {
  'use strict';
  const GROCERY_HOST = /(^|\.)(?:giantfood|stopandshop|martinsfoods|giantfoodstores)\.com$/i;
  const AMAZON_HOST = /(^|\.)amazon\.[a-z.]+$/i;
  const GROCERY_MATCHES = ['*://*.giantfood.com/*', '*://*.stopandshop.com/*', '*://*.martinsfoods.com/*', '*://*.giantfoodstores.com/*'];
  const MODES = ['hide', 'dim', 'badge'];
  function siteOf(host) { host = String(host || ''); return GROCERY_HOST.test(host) ? 'grocery' : AMAZON_HOST.test(host) ? 'amazon' : null; }
  // Amazon keeps S.mode; grocery sites have their own setting (default hide).
  function effectiveMode(site, S) { S = S || {};
    if (site === 'grocery') return MODES.includes(S.groceryMode) ? S.groceryMode : 'hide';
    return MODES.includes(S.mode) ? S.mode : 'dim'; }

  // ---------- allergen statements ----------
  // "May contain ...", "made in a facility that also processes ..." are precautionary: NOT ingredients.
  const PRECAUTION = /\b(?:may\s+contain|may\s+also\s+contain|may\s+have\s+come\s+in\s+contact|(?:produced|processed|made|manufactured|packaged|packed)\s+(?:in|on)\s+(?:a\s+)?(?:shared\s+)?(?:facility|equipment|plant|line)s?|shared\s+(?:facility|equipment))[^.\n;]*/gi;
  const ANIMAL_ALLERGENS = [['milk', /\bmilk\b|\bdairy\b/i], ['egg', /\beggs?\b/i], ['fish', /\bfish\b|\banchov|\bsalmon\b|\btuna\b|\bcod\b|\btilapia\b|\bpollock\b/i], ['shellfish', /\bshellfish\b|\bcrustacean|\bshrimp\b|\bcrab\b|\blobster\b|\bmollus|\bclams?\b|\boysters?\b|\bscallops?\b/i]];
  function stripPrecautionary(text) { return String(text || '').replace(PRECAUTION, ' '); }
  // Returns { contains: ['Milk','Egg'], animal: ['milk','egg'] } from "Contains: Milk, Egg." (precautionary text ignored).
  function parseAllergens(text) {
    const t = stripPrecautionary(text), contains = [], animal = [];
    const re = /\b(?:allergens?\s*(?:info(?:rmation)?)?\s*:\s*(?:contains\s*:?)?|contains\s*:)\s*([^.\n;]{1,200})/gi;
    let m;
    while ((m = re.exec(t))) {
      for (const part of m[1].split(/,|\band\b|&|\//i).map(s => s.trim()).filter(Boolean)) {
        if (/^(?:no|none|free)\b/i.test(part) || /\bfree\b/i.test(part)) continue;
        if (!contains.includes(part)) contains.push(part);
        for (const [lab, rx] of ANIMAL_ALLERGENS) if (rx.test(part) && !animal.includes(lab)) animal.push(lab);
      }
    }
    return { contains, animal };
  }
  // Classifier label for an allergen (shellfish -> the classifier's "shrimp" family; others are identical).
  const allergenLabel = a => a === 'shellfish' ? 'shrimp' : a;

  // ---------- grocery tiles ----------
  const PRODUCT_HREF = /\/(?:groceries\/)?products?\/[^?#]*[a-z0-9]/i;
  const PRICE = /\$\s?\d|\d+\s?¢|\b\d+\.\d{2}\b/;
  const TILE_SEL = "[data-testid*='product-tile' i], [data-testid*='product-card' i], [data-testid*='productTile' i], [data-testid*='productCard' i], [class*='product-tile' i], [class*='product-card' i], [class*='ProductTile' i], [class*='ProductCard' i], [class*='product-cell' i], [data-product-id], [data-productid], [data-sku]";
  const LINK_SEL = "a[href*='/product/'], a[href*='/products/']";
  const TITLE_SEL = "[data-testid*='name' i], [data-testid*='title' i], [class*='product-name' i], [class*='productName' i], [class*='product-title' i], [class*='title' i], [class*='name' i], h2, h3, h4";
  const isProductHref = h => PRODUCT_HREF.test(String(h || '').replace(/^https?:\/\/[^/]+/i, ''));
  const hrefKey = h => String(h || '').replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  const textOf = el => String((el && (el.innerText || el.textContent)) || '');
  function productHrefs(el) { const s = new Set(); for (const a of el.querySelectorAll(LINK_SEL)) { const h = a.getAttribute('href'); if (isProductHref(h)) s.add(hrefKey(h)); } return s; }
  // Smallest ancestor (<= 7 levels) that shows a price and holds exactly one distinct product link.
  function tileFromLink(a) {
    let el = a.parentElement, best = null;
    for (let i = 0; el && i < 7; i++, el = el.parentElement) {
      const tag = String(el.tagName || '').toLowerCase();
      if (tag === 'body' || tag === 'main' || tag === 'html') break;
      if (productHrefs(el).size > 1) break; // reached the grid
      if (PRICE.test(textOf(el))) { best = el; if (tag === 'li' || tag === 'article') break; }
    }
    return best;
  }
  function findTiles(doc) {
    const out = new Set();
    for (const el of doc.querySelectorAll(TILE_SEL)) { const hs = productHrefs(el); if (hs.size === 1 || (hs.size === 0 && titleOfTile(el))) out.add(el); }
    for (const a of doc.querySelectorAll(LINK_SEL)) {
      if (!isProductHref(a.getAttribute('href'))) continue;
      if ([...out].some(t => t.contains(a))) continue;
      const t = tileFromLink(a); if (t) out.add(t);
    }
    // keep outermost only (nested card hooks)
    const arr = [...out];
    return arr.filter(t => !arr.some(o => o !== t && o.contains(t)));
  }
  // Giant/Stop & Shop tiles: a.product-grid-cell_name-text (holds an inline <svg><title>Ahold Icon</title>); the wrapping
  // button.product-tile_detail-title also contains the size/unit price, so the name hooks are tried first.
  const NAME_SEL = "[class*='name-text' i], [class*='cell_name' i], [data-testid*='name' i], [class*='product-name' i], [class*='productName' i]";
  // Text without inline icon <svg> (its <title> leaks into textContent).
  function nameText(n) {
    if (n && n.cloneNode && n.querySelector && n.querySelector('svg')) { const c = n.cloneNode(true); c.querySelectorAll('svg').forEach(s => s.remove()); return textOf(c); }
    return textOf(n);
  }
  // Product page title: <h1> on most banners; Giant's PDP uses h2.item-detail_product-name.
  function detailTitleEl(doc) {
    return doc.querySelector('main h1') || doc.querySelector('h1') || doc.querySelector("[class*='item-detail_product-name' i]") || doc.querySelector("[class*='product-detail' i] [class*='product-name' i]");
  }
  function titleOfTile(el) {
    const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
    for (const n of el.querySelectorAll(NAME_SEL)) { const t = clean(nameText(n)); if (t && t.length > 2 && !PRICE.test(t.slice(0, 6))) return t; }
    for (const n of el.querySelectorAll(TITLE_SEL)) { const t = clean(nameText(n)); if (t && t.length > 2 && !PRICE.test(t.slice(0, 6))) return t; }
    for (const a of el.querySelectorAll(LINK_SEL)) { const t = clean(a.getAttribute('aria-label') || a.getAttribute('title') || textOf(a)); if (t.length > 2) return t; }
    const img = el.querySelector('img[alt]'); return clean(img && img.getAttribute('alt'));
  }
  function idOfTile(el) {
    const a = [...el.querySelectorAll(LINK_SEL)].find(x => isProductHref(x.getAttribute('href')));
    return el.getAttribute('data-product-id') || el.getAttribute('data-productid') || el.getAttribute('data-sku') || (a ? hrefKey(a.getAttribute('href')) : '');
  }
  const isSponsored = el => /\bsponsored\b/i.test(textOf(el).slice(0, 400)) || !!(el.querySelector && el.querySelector("[class*='sponsor' i], [data-testid*='sponsor' i]"));

  // ---------- Amazon search card title ----------
  // Cards also hold hidden cart-popover <h2>s ("Quantity not updated", "Maximum Quantity Reached") before the product
  // title, so the title recipe / labelled title heading wins over the first bare h2.
  function amazonTitleOf(el) {
    const n = el.querySelector('[data-cy=title-recipe] h2') || el.querySelector('h2[aria-label]') || el.querySelector('[data-cy=title-recipe]')
      || el.querySelector('h2.a-size-base-plus, h2.a-size-medium, .a-size-base-plus.a-text-normal, .a-size-medium.a-text-normal');
    return String((n ? n.getAttribute('aria-label') || n.textContent : el.getAttribute('aria-label')) || '').replace(/\s+/g, ' ').trim();
  }

  // ---------- grocery product detail (text in, verdict-ready text out) ----------
  // parts: {name, ingredients, allergens, labels}. Precautionary statements are removed before classification,
  // and "Contains:" animal allergens are passed as strong signals.
  function groceryDetailText(parts) {
    const p = parts || {};
    const al = parseAllergens([p.allergens, p.ingredients].join('\n'));
    const body = stripPrecautionary([p.name, p.ingredients, p.labels].filter(Boolean).join('\n'))
      .replace(/\b(?:allergens?[^:\n]{0,20}:\s*)?contains\s*:[^.\n;]*/gi, ' ');
    return { text: body + (al.animal.length ? '\n' + al.animal.map(allergenLabel).join(', ') : ''), allergens: al };
  }
  function swapUrl(origin, query) {
    let o = '';
    try { const u = new URL(origin); if (/^https?:$/.test(u.protocol) && GROCERY_HOST.test(u.hostname)) o = u.origin; } catch (e) {}
    return (o || 'https://giantfood.com') + '/product-search/' + encodeURIComponent(query);
  }

  // ---------- section hider (generic; per-site rules) ----------
  // Hides store navigation entries (category bar tiles, Categories mega-menu, search-page category filters)
  // matched by link href or exact visible text - never by the site's CSS classes.
  // A rule: { hosts: RegExp, sections: [{ name, texts: [exact labels], href: RegExp }] }.
  const SECTION_RULES = [
    { id: 'grocery-meat-dairy', setting: 'hideMeatSections', hosts: GROCERY_HOST, sections: [
      { name: 'Meat', texts: ['meat'], href: /\/categories\/(?:\d+\/)*(?:categories\/)?\d+-meat(?:[\/?#]|$)/i },
      { name: 'Seafood', texts: ['seafood'], href: /\/categories\/(?:\d+\/)*(?:categories\/)?\d+-seafood(?:[\/?#]|$)/i },
      { name: 'Dairy & Eggs', texts: ['dairy & eggs', 'dairy and eggs', 'dairy & egg'], href: /\/categories\/(?:\d+\/)*(?:categories\/)?\d+-dairy-eggs(?:[\/?#]|$)/i },
    ] },
  ];
  const SECTION_CANDIDATES = 'a[href], button, label, [role=menuitem], [role=option], [role=treeitem], [role=checkbox]';
  const SEC_HIDDEN = 'vl-sec-hidden';
  const secText = t => String(t || '').replace(/\u00a0/g, ' ').replace(/\(\s*[\d,]+\s*\)/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  function sectionRulesFor(host, settings) {
    const st = settings || {};
    return SECTION_RULES.filter(r => r.hosts.test(String(host || '')) && st[r.setting] !== false);
  }
  // Which section (if any) an element names. Exact text only, so "Deli & Prepared Food" or "Meat Alternatives" never match.
  function sectionOf(el, rules) {
    const href = el.getAttribute && el.getAttribute('href');
    const txt = secText(el.textContent);
    for (const r of rules) for (const sec of r.sections) {
      if (href && sec.href.test(href)) return sec;
      if (!href && txt && sec.texts.includes(txt)) return sec;
      if (href && txt && sec.texts.includes(txt) && !/^https?:|^\//.test(href)) return sec;
    }
    return null;
  }
  // The element to hide: the enclosing list item when it holds only this entry, otherwise the entry itself.
  function sectionContainer(el) {
    const li = el.closest && el.closest('li, [role=menuitem], [role=option], [role=treeitem]');
    if (li && li !== el && li.querySelectorAll(SECTION_CANDIDATES).length <= 2) return li;
    return el;
  }
  function hideSections(root, rules) {
    const hit = [];
    if (!rules || !rules.length || !root || !root.querySelectorAll) return hit;
    root.querySelectorAll(SECTION_CANDIDATES).forEach(el => {
      if (el.closest && el.closest('.' + SEC_HIDDEN)) return;
      const sec = sectionOf(el, rules); if (!sec) return;
      const c = sectionContainer(el);
      c.classList.add(SEC_HIDDEN); c.setAttribute('data-vl-sec', sec.name); hit.push({ el: c, name: sec.name });
    });
    return hit;
  }
  function restoreSections(root) {
    if (!root || !root.querySelectorAll) return 0;
    let n = 0; root.querySelectorAll('.' + SEC_HIDDEN).forEach(el => { el.classList.remove(SEC_HIDDEN); el.removeAttribute('data-vl-sec'); n++; });
    return n;
  }
  const hiddenNotice = n => `Vegan Lens hid ${n} non-vegan item${n === 1 ? '' : 's'}`;
  const api = { GROCERY_HOST, GROCERY_MATCHES, siteOf, effectiveMode, parseAllergens, stripPrecautionary, allergenLabel, isProductHref, hrefKey, productHrefs, tileFromLink, findTiles, titleOfTile, detailTitleEl, amazonTitleOf, idOfTile, isSponsored, groceryDetailText, swapUrl, hiddenNotice, TILE_SEL, LINK_SEL, SECTION_RULES, SECTION_CANDIDATES, SEC_HIDDEN, sectionRulesFor, sectionOf, sectionContainer, hideSections, restoreSections };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganSites = api;
})(typeof self !== 'undefined' ? self : this);
