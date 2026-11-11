(() => {
  'use strict';
  const C = window.VeganClassifier;
  const P = window.VeganPage, A = window.VeganAdUnits, W = window.VeganSwaps, V = window.VeganSites;
  const SITE = (V && V.siteOf(location.hostname)) || 'amazon'; // 'amazon' | 'grocery'
  const GROCERY = SITE === 'grocery';
  const DEFAULTS = { checkAds: true, enabled: true, mode: 'dim', strictness: 'strict', showSwaps: true, audience: 'vegan', groceryMode: 'hide', pageBlock: [], siteBlock: [], whitelist: [], whitelistDisabled: [], hideMeatSections: true, restaurantSites: true, badgeStyle: 'compact' };
  const O = window.VeganOffers; if (O) Object.assign(DEFAULTS, O.OFFER_DEFAULTS);
  let COUPONS = [], offerShown = false; // 0.4.29 max 1 partner offer per page
  function addOffer(el, matched, title) {
    if (!O || !S.showOffers || offerShown || !COUPONS.length) return;
    const o = O.pick(COUPONS, { categories: O.categoriesFor(matched, title), showExample: S.showExampleOffers, shownOnPage: offerShown, enabled: S.showOffers });
    if (!o) return; offerShown = true;
    el.append(O.element(o, document, k => { try { chrome.runtime.sendMessage({ type: 'stat', k: k === 'shown' ? 'offerShown' : 'offerClicked' }); } catch (e) {} }));
  }
  let S = { ...DEFAULTS };
  const M = () => V ? V.effectiveMode(SITE, S) : S.mode; // Amazon: S.mode; grocery sites: S.groceryMode (default hide)
  let revealed = false; // user clicked "show" on the grocery hidden-items notice
  const RESULT_SEL = (V && V.AMAZON_TILE_SEL) || "div[data-component-type='s-search-result'], div[data-asin].s-result-item, li[data-asin].s-result-item, div[data-asin][data-component-type='sp-sponsored-result'], [id^='p13n-asin-index-'], .p13n-grid-content";

  const titleOf = el => V.amazonTitleOf(el);
  const asinOf = el => (V && V.amazonIdOf ? V.amazonIdOf(el) : el.getAttribute('data-asin'));

  function clear(el) {
    el.classList.remove('vl-item', 'vl-vegan', 'vl-dim', 'vl-hidden');
    delete el.dataset.vlHid; delete el.dataset.vlId;
    el.querySelectorAll(':scope > .vl-badge, :scope > .vl-label, :scope > .vl-swap').forEach(n => n.remove());
    delete el.dataset.vlDone; delete el.dataset.vlVerdict; delete el.dataset.vlAd;
  }

  const mark = (window.VeganLensBrand ? window.VeganLensBrand.mark : (e => e));
  // 0.4.67: Compact (default) = icon-only pill; Full = classic text badge. Hover/focus/tap shows the full label.
  // 0.4.68: badge text is the verdict only — Amazon already labels those cards; no sponsored copy or ad dot.
  function badge(el, cls, text, title, extra) {
    const compact = (S.badgeStyle || 'compact') !== 'full';
    const b = document.createElement('span');
    b.className = 'vl-badge ' + cls + (compact ? ' vl-badge-compact' : '');
    b.setAttribute('role', 'status');
    if (title) b.title = title;
    if (compact) {
      b.tabIndex = 0;
      const tip = document.createElement('span'); tip.className = 'vl-badge-tip';
      const lab = document.createElement('span'); lab.className = 'vl-badge-text'; lab.textContent = text; tip.appendChild(lab);
      if (extra) tip.appendChild(extra);
      b.appendChild(tip);
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); b.classList.toggle('vl-badge-open'); }, true);
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); b.classList.toggle('vl-badge-open'); } }, true);
      b.addEventListener('blur', () => { setTimeout(() => { if (!b.contains(document.activeElement)) b.classList.remove('vl-badge-open'); }, 0); });
    } else {
      b.textContent = text;
      if (extra) b.appendChild(extra);
    }
    mark(b, { compact: true }); el.appendChild(b); return b;
  }

  // "Vegan swap: <link>" — extension-labelled, generic Amazon search on this origin. Never moves page elements.
  const nvHead = r => '✕ ' + (W && W.verdictHead ? W.verdictHead(S.audience, r.matched) : 'Likely NOT vegan'); // 0.4.44 audience wording
  function swapEl(matched, text, cls) {
    if (!S.showSwaps || !W) return null;
    const banner = /vl-swap-banner/.test(cls || '');
    if (banner && document.querySelector('.vl-swap-pill')) return null; // 0.4.44: at most one swap pill per product page
    const sw = W.pickSwap(matched, text); if (!sw) return null;
    const w = document.createElement('span'); w.className = 'vl-swap ' + (banner ? 'vl-swap-pill ' : '') + (cls || ''); w.title = 'Suggestion added by the Vegan Lens extension (search on this store)';
    const a = document.createElement('a'); a.href = W.storeSearchUrl ? W.storeSearchUrl(location.href, sw.query) : W.swapUrl(location.origin, sw.query); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = sw.label; if (W.tagLink) W.tagLink(a, S);
    w.append(W.say ? W.say(S.audience, 'swap') : 'Try: ', a); return mark(w, banner ? {} : { compact: true });
  }


  // Sponsored cards in product-page ad widgets (#sp_detail, sponsored carousels, sims-fbt sponsored).
  const AD_WIDGETS = A.SITES.amazon.block.join(', ');
  const adTitleOf = el => { const n = el.querySelector('.a-truncate-full, .sponsored-products-truncator-truncated, [class*=truncate] span, a[title], h2');
    return ((n && (n.textContent || n.getAttribute('title'))) || (el.querySelector('img[alt]') || { alt: '' }).alt || '').trim(); };
  // Per-site adapters: how to find result tiles, their title/id, and sponsored status.
  const ADAPTERS = {
    amazon: { tiles: () => document.querySelectorAll(RESULT_SEL), title: titleOf, id: asinOf, isAd: el => A.isAmazonSponsored(el), detail: () => processDetail() },
    grocery: { tiles: () => [...V.findTiles(document), ...V.findPromoCards(document)], title: el => el.dataset.vlPromo ? V.promoTitleOf(el) : V.titleOfTile(el), id: el => el.dataset.vlPromo ? 'promo:' + V.promoTitleOf(el) : V.idOfTile(el), isAd: el => V.isSponsored(el), detail: () => processGroceryDetail() },
  };
  const AD = ADAPTERS[SITE];
  function processResult(el, isAdCard) {
    if (el.dataset.vlDone && GROCERY && el.dataset.vlId !== AD.id(el)) clear(el); // SPA re-used the tile for another product
    if (el.dataset.vlDone) return;
    if (el.parentElement && el.parentElement.closest('[data-vl-done]')) return; // nested card inside a badged one: no double badge
    const ad = isAdCard ? A.isAmazonSponsored(el) : AD.isAd(el);
    if (ad && !S.checkAds) return; // ads check off: leave sponsored products untouched
    const title = isAdCard ? adTitleOf(el) : AD.title(el);
    const id = isAdCard ? el.getAttribute('data-asin') : AD.id(el);
    if (!title || !id) return;
    el.dataset.vlDone = '1';
    if (GROCERY) el.dataset.vlId = id;
    if (ad) el.dataset.vlAd = '1';
    const r = C.classify(title, { ...S, allowProbably: true });
    if (el.dataset.vlPromo && r.verdict !== 'non-vegan') return; // homepage promo/weekly-ad cards: only hide non-vegan, no badges
    el.dataset.vlVerdict = r.verdict;
    el.dataset.vlWhy = r.verdict === 'vegan' ? 'Vegan' : r.verdict === 'non-vegan' ? 'contains ' + r.matched.join(', ') : ''; // share (0.4.42)
    el.classList.add('vl-item');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const mode = M();
    if (r.verdict === 'vegan') {
      if (mode !== 'badge') el.classList.add('vl-vegan');
      badge(el, 'vl-badge-vegan', '🌱 Vegan', 'Signals: ' + r.positives.join(', '));
    } else if (r.verdict === 'non-vegan') {
      const why = 'Not vegan: contains ' + r.matched.join(', '); // 0.4.68: verdict-only copy (Amazon already labels ads)
      const sw = GROCERY || (C.isDrink && C.isDrink(title)) ? null : swapEl(r.matched, title, mode === 'badge' ? 'vl-swap-left' : ''); // 0.4.33: no food swaps on drinks // grocery: swaps on product pages only
      { const sa = sw && (sw.matches && sw.matches('a[href]') ? sw : sw.querySelector && sw.querySelector('a[href]')); if (sa) el.dataset.vlSwap = sa.href; }
      if (mode === 'badge') {
        if (sw && (S.badgeStyle || 'compact') !== 'full') { badge(el, 'vl-badge-nonvegan', '✕ ' + why, null, sw); addOffer(sw, r.matched, title); }
        else { badge(el, 'vl-badge-nonvegan', '✕ ' + why); if (sw) { el.appendChild(sw); addOffer(sw, r.matched, title); } }
        return;
      }
      if (GROCERY && mode === 'hide') { el.dataset.vlHid = '1'; if (!revealed) el.classList.add('vl-hidden'); }
      else el.classList.add(mode === 'hide' ? 'vl-hidden' : 'vl-dim');
      const lab = document.createElement('span');
      lab.className = 'vl-label'; lab.textContent = why; lab.title = 'Click to show anyway';
      mark(lab, { compact: true });
      lab.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); try { chrome.runtime.sendMessage({ type: 'stat', k: 'reveal' }); } catch (x) {} el.classList.remove('vl-dim'); lab.remove(); }, true);
      el.appendChild(lab); if (sw) { el.appendChild(sw); addOffer(sw, r.matched, title); }
    } else if (r.verdict === 'probably') {
      badge(el, 'vl-badge-probably', '🌱 Probably vegan', 'Listed materials are non-animal (e.g. aluminum, silicone) — not certified' + (r.probable ? ': ' + r.probable.join(', ') : ''));
    } else {
      if (r.caution && r.caution.length) badge(el, 'vl-badge-caution', '⚠ Caution: may contain animal products', r.caution.join(' '));
      else badge(el, 'vl-badge-unknown', '?', 'Vegan Lens: unknown from title');
    }
  }

  // ---------- product detail ----------
  const txt = sel => [...document.querySelectorAll(sel)].map(n => n.innerText || n.textContent).join('\n');
  function findIngredients() {
    const out = [];
    document.querySelectorAll('#important-information .content, #important-information div, #nic-ingredients-content, #productDescription, #feature-bullets, #productFactsDesktopExpander, #productOverview_feature_div').forEach(n => {
      const t = n.innerText || '';
      const m = t.match(/ingredients?\s*:?\s*([\s\S]{0,1500})/i);
      if (m) out.push(m[1]);
    });
    return out.join('\n');
  }
  // Amazon "Product details" / "Top highlights" attribute tables -> [{label, value}]
  function findAttributes() {
    const pairs = [], seen = new Set();
    const clean = x => String(x || '').replace(/[\u200e\u200f\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
    const add = (l, v) => { l = clean(l).replace(/\s*:\s*$/, ''); v = clean(v); if (!l || !v || l.length > 60) return; const k = l.toLowerCase() + '|' + v.toLowerCase(); if (seen.has(k)) return; seen.add(k); pairs.push({ label: l, value: v }); };
    const T = n => n ? (n.innerText || n.textContent || '') : '';
    try {
      document.querySelectorAll('#productOverview_feature_div tr, #prodDetails tr, #productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, [id^=productDetails] tr, table.prodDetTable tr, table.a-keyvalue tr, #voyager-ns-desktop-side-sheet-container tr, #voyagerNorthstarATFData_feature_div tr').forEach(tr => {
        const l = tr.querySelector('th.prodDetSectionEntry, td.a-span3, th, td:first-child'); const v = tr.querySelector('td.prodDetAttrValue, td.a-span9, td:last-child');
        if (l && v && l !== v) add(T(l), T(v));
      });
      document.querySelectorAll('#productFactsDesktopExpander .a-row, #productFactsDesktop_feature_div .a-row, [id*=product-facts] .a-row, [class*=product-facts] .a-row, .product-facts-detail').forEach(r => {
        const l = r.querySelector('.a-col-left'), v = r.querySelector('.a-col-right');
        if (l && v) return add(T(l), T(v));
        const b = r.querySelector('span.a-text-bold');
        if (b) { const full = clean(T(r)); const lb = clean(T(b)); if (full.startsWith(lb)) add(lb, full.slice(lb.length)); }
      });
      document.querySelectorAll('#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li').forEach(li => {
        const b = li.querySelector('span.a-text-bold');
        const full = clean(T(li));
        if (b) { const lb = clean(T(b)); const i = full.indexOf(lb); add(lb, i >= 0 ? full.slice(i + lb.length) : ''); }
        else { const m = full.match(/^([^:]{1,60}):\s*(.+)$/); if (m) add(m[1], m[2]); }
      });
    } catch (e) {}
    return pairs;
  }
  function findUPC() {
    const t = txt('#detailBullets_feature_div, #productDetails_techSpec_section_1, #productDetails_detailBullets_sections1, #prodDetails');
    const m = t.match(/\b(?:UPC|EAN|GTIN)[^\d]{0,20}(\d{8,14})/i);
    return m ? m[1] : null;
  }
  const BEAUTY_CAT = /\b(?:beauty|personal care|makeup|make-up|cosmetics?|skin ?care|hair ?care|fragrance|nail)\b/i;
  const DRINK_CAT = /\b(?:beer|wine|spirits|alcohol(?:ic)?|liquor)\b/i;
  const DRINK = /\b(?:beers?|ales?|lagers?|ipa|stouts?|porters?|pilsners?|ciders?|wines?|cabernet|merlot|pinot|chardonnay|sauvignon|riesling|ros[eé]|prosecco|champagne|vodka|gin|rum|whiske?y|bourbon|tequila|mezcal|brandy|cognac|liqueurs?|sake)\b/i;
  function findBrand(attrs) {
    const row = (attrs || []).find(p => /^brand(?: name)?$/i.test(String(p.label || '').trim())); if (row) return String(row.value).trim().slice(0, 80);
    const by = document.getElementById('bylineInfo'); const t = by ? (by.textContent || '').trim() : '';
    const m = t.match(/^Visit the (.+?) Store$/i) || t.match(/^Brand:\s*(.+)$/i); return m ? m[1].trim().slice(0, 80) : '';
  }
  // 0.4.70: deeper PDP copy, including hidden/lazy-loaded voyager prodDet tables and A+ / description.
  const DETAIL_COPY = '#feature-bullets, #productDescription, #aplus, #aplus_feature_div, [id^=aplus], #productFactsDesktop_feature_div, #productFactsDesktopExpander, #productOverview_feature_div, #detailBullets_feature_div, #detailBulletsWrapper_feature_div, #prodDetails, [id^=productDetails], #poExpander, #voyager-ns-desktop-side-sheet-container, #voyagerNorthstarATFData_feature_div, table.prodDetTable, #twister, #twister_feature_div, #variation_color_name';
  async function processDetail() {
    const titleEl = document.getElementById('productTitle');
    if (!titleEl) return;
    const title = titleEl.textContent.trim();
    const ingredients = findIngredients();
    const badges = txt('#acBadge_feature_div, .badge-wrapper, #climatePledgeFriendlyBadge, #brandSnapshot_feature_div');
    const bullets = txt('#feature-bullets');
    const attributes = findAttributes();
    const detail = txt(DETAIL_COPY);
    const attrsText = attributes.map(p => p.label + ': ' + p.value).join('\n');
    const crumbs = txt('#wayfinding-breadcrumbs_feature_div');
    const isDrinkPage = (DRINK_CAT.test(crumbs) && DRINK.test(title)) || !!(C.isDrink && C.isDrink(title));
    const payload = [title, ingredients, bullets, badges, detail, attrsText].join('\n');
    const sig = payload.length + ':' + (title.length + ingredients.length + bullets.length + badges.length + detail.length + attrsText.length + attributes.length);
    let b = document.getElementById('vl-banner');
    if (b && b.dataset.vlSig === String(sig)) return;
    const first = !b;
    const r = C.classify(payload, { ...S, attributes, allowProbably: true, beauty: BEAUTY_CAT.test(crumbs), drink: isDrinkPage });
    const rowsNote = r.attributeRows && r.attributeRows.length ? ' · from product details: ' + r.attributeRows.join(', ') : '';
    if (first) { b = document.createElement('div'); b.id = 'vl-banner'; }
    b.dataset.vlSig = String(sig);
    const render = (verdict, extra) => {
      b.className = 'vl-banner vl-banner-' + verdict; b.dataset.verdict = verdict; b.title = (verdict === 'probably' ? 'Listed materials are non-animal (e.g. aluminum, silicone) \u2014 not certified' : '') + (rowsNote ? (verdict === 'probably' ? '\n' : '') + rowsNote.replace(/^ · /, '') : ''); report();
      const head = verdict === 'probably' ? '🌱 Probably vegan' : verdict === 'vegan' ? (r.materialsOnly ? '🌱 Likely vegan (materials; dyes/glues not verified)' : '🌱 Likely vegan') : verdict === 'non-vegan' ? nvHead(r) : (r.caution && r.caution.length ? '⚠ Caution: sometimes contains animal products' : '? Vegan status unknown');
      const det = verdict === 'probably' ? 'Non-animal materials: ' + (r.probable || []).join(', ') + ' (not certified)' : verdict === 'unknown' && r.caution && r.caution.length ? r.caution.join(' ') : verdict === 'non-vegan' ? 'Matched: ' + r.matched.join(', ') : r.positives.length ? 'Signals: ' + r.positives.join(', ') : 'No clear signals found';
      b.innerHTML = '';
      const h = document.createElement('b'); h.textContent = verdict === 'probably' ? head : 'Vegan Lens: ' + head;
      const d = document.createElement('span'); d.textContent = det + (ingredients || rowsNote ? '' : ' (no ingredients section found)'); // 0.4.33: product-details note lives in the tooltip
      if (verdict === 'probably') b.title = det + '\n' + b.title; // full text if the one-line banner truncates
      b.append(h, d); b.removeAttribute('data-vl-attr'); mark(b);
      if (extra) { const s = document.createElement('small'); s.textContent = extra; b.append(s); }
      if (verdict === 'non-vegan') { const sw = isDrinkPage ? null : swapEl(r.matched, title, 'vl-swap-banner'); if (sw) b.append(sw); addOffer(b, r.matched, title); }
    };
    render(r.verdict);
    if (first) {
      const anchor = document.getElementById('titleSection') || titleEl.parentElement;
      if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(b, anchor);
    }
    if (!first) return;
    // Barnivore has no public API: offer a user-clicked search link on drinks (nothing is sent automatically).
    if (DRINK_CAT.test(crumbs) && DRINK.test(title)) { const a = document.createElement('a'); a.className = 'vl-barnivore'; a.href = 'https://www.barnivore.com/search?keyword=' + encodeURIComponent(title.replace(/https?:\/\/\S+/g, '').slice(0, 80)); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Check on Barnivore'; a.title = 'Opens Barnivore (vegan drinks directory) with this product name'; b.append(mark(a, { compact: true })); }
    // 0.4.31 open databases: barcode only (or brand + name for beauty products). Database > ingredients > title guess.
    const upc = findUPC(), beauty = BEAUTY_CAT.test(crumbs), brand = findBrand(attributes);
    if ((upc || (beauty && brand)) && chrome.runtime?.id) {
      chrome.runtime.sendMessage({ type: 'db-lookup', db: beauty ? 'obf' : 'off', code: upc, brand: beauty ? brand : '', name: beauty ? title : '' }, d => {
        if (chrome.runtime.lastError || !d) return;
        const res = C.resolveDb({ verdict: r.verdict === 'probably' ? 'unknown' : r.verdict, matched: r.matched, certifiedVegan: r.positives.includes('certified vegan') }, d);
        if (res.source === 'page') return;
        if (res.caution) r.caution = res.caution;
        render(res.verdict, (res.source === 'conflict' ? 'Sources: ' + d.source + ' and this page' : 'Source: ' + d.source + (d.certified ? ' (vegan label)' : '') + (d.crueltyFree ? ' · cruelty-free' : '')) + (upc ? ` (UPC ${upc})` : ''));
        b.title = 'Vegan Lens — ' + (res.source === 'conflict' ? 'conflict: ' + d.source + ' vs. on-page ingredients' : 'from ' + d.source);
      });
    }
  }

  // ---------- grocery product detail (Giant Food / Stop & Shop / Martin's / Giant) ----------
  const SECTION_END = /\n\s*(?:allergens?|nutrition(?:al)?(?: facts| info(?:rmation)?)?|directions|warnings?|preparation|storage|product details|description|reviews?|disclaimer)\b/i;
  function grocerySection(text, head) {
    const m = String(text || '').match(new RegExp('\\b' + head + '\\b\\s*:?\\s*([\\s\\S]{0,1500})', 'i'));
    if (!m) return '';
    const cut = m[1].search(SECTION_END); return cut > 0 ? m[1].slice(0, cut) : m[1];
  }
  function processGroceryDetail() {
    if (document.getElementById('vl-banner') || !V.isProductHref(location.pathname)) return;
    const titleEl = V.detailTitleEl(document); if (!titleEl) return;
    const name = (titleEl.textContent || '').trim(); if (!name) return;
    // Detail area: the closest container around the title that holds the ingredients (avoid "similar items" carousels).
    let area = titleEl.parentElement;
    for (let i = 0; area && i < 6 && !/\bingredients?\b/i.test(area.innerText || ''); i++) area = area.parentElement;
    if (!area || /^(?:body|html)$/i.test(area.tagName)) area = document.querySelector('main') || document.body;
    const t = area.innerText || area.textContent || '';
    const ingredients = grocerySection(t, 'ingredients?');
    const allergens = (t.match(/\b(?:allergens?[^:\n]{0,20}:\s*)?contains\s*:[^\n]{0,200}/gi) || []).join('\n') + '\n' + grocerySection(t, 'allergens?(?: info(?:rmation)?)?');
    const labels = [...area.querySelectorAll("[class*='attribute' i], [class*='dietary' i], [class*='badge' i], [class*='tag' i], [class*='lifestyle' i], [aria-label*='vegan' i], img[alt*='vegan' i]")]
      .map(n => n.getAttribute('aria-label') || n.getAttribute('alt') || n.textContent || '').filter(x => /\bvegan\b/i.test(x)).join('\n');
    const g = V.groceryDetailText({ name, ingredients, allergens, labels });
    const r = C.classify(g.text, S);
    if (g.allergens.animal.length && r.verdict !== 'non-vegan' && !(r.whitelisted.length && r.verdict === 'vegan')) { r.verdict = 'non-vegan'; r.matched = g.allergens.animal.map(V.allergenLabel); }
    const b = document.createElement('div'); b.id = 'vl-banner';
    b.className = 'vl-banner vl-banner-' + r.verdict; b.dataset.verdict = r.verdict;
    const head = r.verdict === 'vegan' ? '🌱 Likely vegan' : r.verdict === 'non-vegan' ? nvHead(r) : '? Vegan status unknown';
    const det = r.verdict === 'non-vegan' ? 'Matched: ' + r.matched.join(', ') + (g.allergens.contains.length ? ' · allergen statement: Contains ' + g.allergens.contains.join(', ') : '')
      : r.positives.length ? 'Signals: ' + r.positives.join(', ') : 'No clear signals found';
    const h = document.createElement('b'); h.textContent = 'Vegan Lens: ' + head;
    const d = document.createElement('span'); d.textContent = det + (ingredients ? '' : ' (no ingredients section found)');
    b.append(h, d); mark(b);
    if (r.verdict === 'non-vegan') { const sw = swapEl(r.matched, name, 'vl-swap-banner'); if (sw) b.append(sw); addOffer(b, r.matched, name); }
    titleEl.parentElement.insertBefore(b, titleEl);
  }
  // One extension-labelled notice above the results: "Vegan Lens hid N non-vegan items · show".
  function updateNotice() {
    let n = document.getElementById('vl-hidden-notice');
    const hid = [...document.querySelectorAll('[data-vl-hid]')];
    if (!GROCERY || !hid.length || M() !== 'hide') { if (n) n.remove(); return; }
    if (!n) {
      n = document.createElement('div'); n.id = 'vl-hidden-notice'; n.className = 'vl-notice'; n.title = 'Added by the Vegan Lens extension';
      const sp = document.createElement('span'); sp.className = 'vl-notice-text';
      const a = document.createElement('a'); a.href = '#'; a.className = 'vl-notice-toggle';
      a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); revealed = !revealed;
        document.querySelectorAll('[data-vl-hid]').forEach(el => el.classList.toggle('vl-hidden', !revealed)); updateNotice(); }, true);
      n.append(sp, ' · ', a); mark(n);
    }
    const grid = hid[0].parentElement;
    if (grid && grid.parentElement && n.nextSibling !== grid) grid.parentElement.insertBefore(n, grid);
    const txt = V.hiddenNotice(hid.length) + (revealed ? ' (shown)' : '');
    const sp = n.querySelector('.vl-notice-text'), a = n.querySelector('.vl-notice-toggle');
    if (sp.textContent !== txt) sp.textContent = txt;
    const at = revealed ? 'hide' : 'show'; if (a.textContent !== at) a.textContent = at;
  }

  let lastUrl = location.href, sendT;
  try { chrome.runtime.onMessage.addListener(m => { if (m && m.type === 'recount') { P.reportPage(); report(); } }); } catch (e) {} // 0.4.59
  function report() {
    clearTimeout(sendT);
    sendT = setTimeout(() => {
      const c = { vegan: 0, probably: 0, nonvegan: 0, unknown: 0, context: 0, ads: 0, scanned: 0, caution: 0 };
      document.querySelectorAll('[data-vl-verdict]').forEach(e => { const v = e.dataset.vlVerdict; c[v === 'non-vegan' ? 'nonvegan' : v]++; if (v === 'non-vegan' && e.dataset.vlAd) c.ads++; c.scanned++; });
      c.caution = document.querySelectorAll('.vl-badge-caution').length;
      const b = document.getElementById('vl-banner');
      if (b) { const v = b.dataset.verdict; c[v === 'non-vegan' ? 'nonvegan' : v]++; c.scanned += 3; if (/Caution/.test(b.textContent || '')) c.caution++; } // a product page verdict is a full evaluation
      try { chrome.runtime.sendMessage({ type: 'counts', source: SITE, counts: c }); } catch (e) {}
    }, 300);
  }
  function run() {
    if (location.href !== lastUrl) { lastUrl = location.href; try { chrome.runtime.sendMessage({ type: 'reset' }); } catch (e) {} P.reportPage(); if (GROCERY || P.isDisabled(S, location.href)) undo(); }
    if (P.isDisabled(S, location.href)) return; // disabled on this page: do nothing
    if (V.isRestaurantHost(location.hostname) && S.restaurantSites === false) { undo(); return; } // restaurant-supply toggle off
    if (V && V.hideSections) V.hideSections(document, V.sectionRulesFor(location.hostname, S)); // store sections (own toggle)
    if (!S.enabled) { report(); return; }
    AD.tiles().forEach(el => processResult(el));
    if (!GROCERY && S.checkAds) document.querySelectorAll(AD_WIDGETS).forEach(w => w.querySelectorAll('[data-asin]:not([data-asin=""])').forEach(el => processResult(el, true)));
    AD.detail();
    updateNotice();
    report();
  }
  function undo() {
    if (V && V.restoreSections) V.restoreSections(document);
    document.querySelectorAll('[data-vl-done], .vl-item').forEach(clear);
    document.getElementById('vl-banner')?.remove();
    document.getElementById('vl-hidden-notice')?.remove(); revealed = false;
  }
  function reset() {
    undo();
    run();
  }

  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 250); })
    .observe(document.documentElement, { childList: true, subtree: true });

  chrome.storage.sync.get(DEFAULTS, async s => { S = s; delete S.sortTop; // legacy setting removed in 0.4.0: ignored
    if (S.showOffers) try { COUPONS = (await chrome.runtime.sendMessage({ type: 'coupons' })) || []; } catch (e) {}
    P.reportPage(); run(); });
  window.addEventListener('popstate', () => setTimeout(run, 50));
  if (GROCERY) setInterval(() => { if (location.href !== lastUrl) run(); }, 1000); // SPA pushState navigation without DOM churn
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const k in ch) if (k !== 'sortTop') S[k] = ch[k].newValue;
    reset();
  });
})();
