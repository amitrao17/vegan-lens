(() => {
  'use strict';
  const C = window.VeganClassifier;
  const P = window.VeganPage, A = window.VeganAdUnits, W = window.VeganSwaps, V = window.VeganSites;
  const SITE = (V && V.siteOf(location.hostname)) || 'amazon'; // 'amazon' | 'grocery'
  const GROCERY = SITE === 'grocery';
  const DEFAULTS = { checkAds: true, enabled: true, mode: 'dim', strictness: 'strict', showSwaps: true, groceryMode: 'hide', pageBlock: [], siteBlock: [], whitelist: [], whitelistDisabled: [], hideMeatSections: true };
  let S = { ...DEFAULTS };
  const M = () => V ? V.effectiveMode(SITE, S) : S.mode; // Amazon: S.mode; grocery sites: S.groceryMode (default hide)
  let revealed = false; // user clicked "show" on the grocery hidden-items notice
  const RESULT_SEL = "div[data-component-type='s-search-result'], div[data-asin].s-result-item, li[data-asin].s-result-item, div[data-asin][data-component-type='sp-sponsored-result']";

  const titleOf = el => V.amazonTitleOf(el);

  function clear(el) {
    el.classList.remove('vl-item', 'vl-vegan', 'vl-dim', 'vl-hidden');
    delete el.dataset.vlHid; delete el.dataset.vlId;
    el.querySelectorAll(':scope > .vl-badge, :scope > .vl-label, :scope > .vl-swap').forEach(n => n.remove());
    delete el.dataset.vlDone; delete el.dataset.vlVerdict; delete el.dataset.vlAd;
  }

  function badge(el, cls, text, title) {
    const b = document.createElement('span');
    b.className = 'vl-badge ' + cls; b.textContent = text; if (title) b.title = title;
    el.appendChild(b); return b;
  }

  // "Vegan swap: <link>" — extension-labelled, generic Amazon search on this origin. Never moves page elements.
  function swapEl(matched, text, cls) {
    if (!S.showSwaps || !W) return null;
    const sw = W.pickSwap(matched, text); if (!sw) return null;
    const w = document.createElement('span'); w.className = 'vl-swap ' + (cls || ''); w.title = 'Suggestion added by the Vegan Lens extension (generic ' + (GROCERY ? 'store' : 'Amazon') + ' search)';
    const ic = document.createElement('img'); ic.className = 'vl-swap-icon'; ic.alt = 'Vegan Lens'; try { ic.src = chrome.runtime.getURL('icons/icon32.png'); } catch (e) {}
    const a = document.createElement('a'); a.href = GROCERY ? V.swapUrl(location.origin, sw.query) : W.swapUrl(location.origin, sw.query); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = sw.label;
    a.addEventListener('click', e => e.stopPropagation(), true);
    w.append(ic, 'Vegan swap: ', a); return w;
  }

  // Sponsored cards in product-page ad widgets (#sp_detail, sponsored carousels, sims-fbt sponsored).
  const AD_WIDGETS = A.SITES.amazon.block.join(', ');
  const adTitleOf = el => { const n = el.querySelector('.a-truncate-full, .sponsored-products-truncator-truncated, [class*=truncate] span, a[title], h2');
    return ((n && (n.textContent || n.getAttribute('title'))) || (el.querySelector('img[alt]') || { alt: '' }).alt || '').trim(); };
  // Per-site adapters: how to find result tiles, their title/id, and sponsored status.
  const ADAPTERS = {
    amazon: { tiles: () => document.querySelectorAll(RESULT_SEL), title: titleOf, id: el => el.getAttribute('data-asin'), isAd: el => A.isAmazonSponsored(el), detail: () => processDetail() },
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
    const r = C.classify(title, S);
    if (el.dataset.vlPromo && r.verdict !== 'non-vegan') return; // homepage promo/weekly-ad cards: only hide non-vegan, no badges
    el.dataset.vlVerdict = r.verdict;
    el.classList.add('vl-item');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const mode = M();
    if (r.verdict === 'vegan') {
      if (mode !== 'badge') el.classList.add('vl-vegan');
      badge(el, 'vl-badge-vegan', ad ? 'Sponsored · 🌱 vegan' : '🌱 Vegan', 'Signals: ' + r.positives.join(', '));
    } else if (r.verdict === 'non-vegan') {
      const why = (ad ? 'Sponsored · non-vegan: ' : 'Not vegan: contains ') + r.matched.join(', ');
      const sw = GROCERY ? null : swapEl(r.matched, title, mode === 'badge' ? 'vl-swap-left' : ''); // grocery: swaps on product pages only
      if (mode === 'badge') { badge(el, 'vl-badge-nonvegan', '✕ ' + why); if (sw) el.appendChild(sw); return; }
      if (GROCERY && mode === 'hide') { el.dataset.vlHid = '1'; if (!revealed) el.classList.add('vl-hidden'); }
      else el.classList.add(mode === 'hide' ? 'vl-hidden' : 'vl-dim');
      const lab = document.createElement('span');
      lab.className = 'vl-label'; lab.textContent = why; lab.title = 'Click to show anyway';
      lab.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); el.classList.remove('vl-dim'); lab.remove(); }, true);
      el.appendChild(lab); if (sw) el.appendChild(sw);
    } else {
      badge(el, 'vl-badge-unknown', ad ? 'Sponsored · ?' : '?', 'Vegan Lens: unknown from title');
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
      document.querySelectorAll('#productOverview_feature_div tr, #prodDetails tr, #productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, [id^=productDetails] tr').forEach(tr => {
        const l = tr.querySelector('td.a-span3, th, td:first-child'); const v = tr.querySelector('td.a-span9, td:last-child');
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
  async function processDetail() {
    const titleEl = document.getElementById('productTitle');
    if (!titleEl || document.getElementById('vl-banner')) return;
    const title = titleEl.textContent.trim();
    const ingredients = findIngredients();
    const badges = txt('#acBadge_feature_div, .badge-wrapper, #climatePledgeFriendlyBadge, #brandSnapshot_feature_div');
    const bullets = txt('#feature-bullets');
    const attributes = findAttributes();
    const r = C.classify([title, ingredients, bullets, badges].join('\n'), { ...S, attributes });
    const rowsNote = r.attributeRows && r.attributeRows.length ? ' · from product details: ' + r.attributeRows.join(', ') : '';
    const b = document.createElement('div');
    b.id = 'vl-banner';
    const render = (verdict, extra) => {
      b.className = 'vl-banner vl-banner-' + verdict; b.dataset.verdict = verdict; report();
      const head = verdict === 'vegan' ? (r.materialsOnly ? '🌱 Likely vegan (materials; dyes/glues not verified)' : '🌱 Likely vegan') : verdict === 'non-vegan' ? '✕ Likely NOT vegan' : '? Vegan status unknown';
      const det = verdict === 'non-vegan' ? 'Matched: ' + r.matched.join(', ') : r.positives.length ? 'Signals: ' + r.positives.join(', ') : 'No clear signals found';
      b.innerHTML = '';
      const h = document.createElement('b'); h.textContent = 'Vegan Lens: ' + head;
      const d = document.createElement('span'); d.textContent = det + rowsNote + (ingredients || rowsNote ? '' : ' (no ingredients section found)');
      const ic = document.createElement('img'); ic.className = 'vl-banner-icon'; ic.alt = 'Vegan Lens'; ic.title = 'Added by the Vegan Lens extension'; try { ic.src = chrome.runtime.getURL('icons/icon32.png'); } catch (e) {}
      b.append(ic, h, d);
      if (extra) { const s = document.createElement('small'); s.textContent = extra; b.append(s); }
      if (verdict === 'non-vegan') { const sw = swapEl(r.matched, title, 'vl-swap-banner'); if (sw) b.append(sw); }
    };
    render(r.verdict);
    const anchor = document.getElementById('titleSection') || titleEl.parentElement;
    anchor.parentElement.insertBefore(b, anchor);
    const upc = findUPC();
    if (upc && chrome.runtime?.id) {
      chrome.runtime.sendMessage({ type: 'off-lookup', code: upc }, off => {
        if (chrome.runtime.lastError || !off) return;
        const v = (r.verdict === 'unknown' && off !== 'unknown') ? off : r.verdict;
        render(v, `Open Food Facts (UPC ${upc}): ${off}`);
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
    const head = r.verdict === 'vegan' ? '🌱 Likely vegan' : r.verdict === 'non-vegan' ? '✕ Likely NOT vegan' : '? Vegan status unknown';
    const det = r.verdict === 'non-vegan' ? 'Matched: ' + r.matched.join(', ') + (g.allergens.contains.length ? ' · allergen statement: Contains ' + g.allergens.contains.join(', ') : '')
      : r.positives.length ? 'Signals: ' + r.positives.join(', ') : 'No clear signals found';
    const h = document.createElement('b'); h.textContent = 'Vegan Lens: ' + head;
    const d = document.createElement('span'); d.textContent = det + (ingredients ? '' : ' (no ingredients section found)');
    const ic = document.createElement('img'); ic.className = 'vl-banner-icon'; ic.alt = 'Vegan Lens'; ic.title = 'Added by the Vegan Lens extension'; try { ic.src = chrome.runtime.getURL('icons/icon32.png'); } catch (e) {}
    b.append(ic, h, d);
    if (r.verdict === 'non-vegan') { const sw = swapEl(r.matched, name, 'vl-swap-banner'); if (sw) b.append(sw); }
    titleEl.parentElement.insertBefore(b, titleEl);
  }
  // One extension-labelled notice above the results: "Vegan Lens hid N non-vegan items · show".
  function updateNotice() {
    let n = document.getElementById('vl-hidden-notice');
    const hid = [...document.querySelectorAll('[data-vl-hid]')];
    if (!GROCERY || !hid.length || M() !== 'hide') { if (n) n.remove(); return; }
    if (!n) {
      n = document.createElement('div'); n.id = 'vl-hidden-notice'; n.className = 'vl-notice'; n.title = 'Added by the Vegan Lens extension';
      const ic = document.createElement('img'); ic.className = 'vl-swap-icon'; ic.alt = 'Vegan Lens'; try { ic.src = chrome.runtime.getURL('icons/icon32.png'); } catch (e) {}
      const sp = document.createElement('span'); sp.className = 'vl-notice-text';
      const a = document.createElement('a'); a.href = '#'; a.className = 'vl-notice-toggle';
      a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); revealed = !revealed;
        document.querySelectorAll('[data-vl-hid]').forEach(el => el.classList.toggle('vl-hidden', !revealed)); updateNotice(); }, true);
      n.append(ic, sp, ' · ', a);
    }
    const grid = hid[0].parentElement;
    if (grid && grid.parentElement && n.nextSibling !== grid) grid.parentElement.insertBefore(n, grid);
    const txt = V.hiddenNotice(hid.length) + (revealed ? ' (shown)' : '');
    const sp = n.querySelector('.vl-notice-text'), a = n.querySelector('.vl-notice-toggle');
    if (sp.textContent !== txt) sp.textContent = txt;
    const at = revealed ? 'hide' : 'show'; if (a.textContent !== at) a.textContent = at;
  }

  let lastUrl = location.href, sendT;
  function report() {
    clearTimeout(sendT);
    sendT = setTimeout(() => {
      const c = { vegan: 0, nonvegan: 0, unknown: 0, context: 0, ads: 0 };
      document.querySelectorAll('[data-vl-verdict]').forEach(e => { const v = e.dataset.vlVerdict; c[v === 'non-vegan' ? 'nonvegan' : v]++; if (v === 'non-vegan' && e.dataset.vlAd) c.ads++; });
      const b = document.getElementById('vl-banner');
      if (b) { const v = b.dataset.verdict; c[v === 'non-vegan' ? 'nonvegan' : v]++; }
      try { chrome.runtime.sendMessage({ type: 'counts', source: SITE, counts: c }); } catch (e) {}
    }, 300);
  }
  function run() {
    if (location.href !== lastUrl) { lastUrl = location.href; try { chrome.runtime.sendMessage({ type: 'reset' }); } catch (e) {} P.reportPage(); if (GROCERY || P.isDisabled(S, location.href)) undo(); }
    if (P.isDisabled(S, location.href)) return; // disabled on this page: do nothing
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

  chrome.storage.sync.get(DEFAULTS, s => { S = s; delete S.sortTop; // legacy setting removed in 0.4.0: ignored
    P.reportPage(); run(); });
  window.addEventListener('popstate', () => setTimeout(run, 50));
  if (GROCERY) setInterval(() => { if (location.href !== lastUrl) run(); }, 1000); // SPA pushState navigation without DOM churn
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const k in ch) if (k !== 'sortTop') S[k] = ch[k].newValue;
    reset();
  });
})();
