// Vegan Lens beauty product pages (Sephora, Ulta) — 0.4.31. Reads the page's JSON-LD Product (gtin, brand, name),
// classifies on-page text locally, then asks the background for an Open Beauty Facts lookup (barcode, else brand+name only).
(function (root) {
  'use strict';
  // Pure: JSON-LD blocks (strings) -> { code, brand, name, description }
  function fromJsonLd(blocks) {
    const flat = [];
    const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); flat.push(o); if (o['@graph']) walk(o['@graph']); if (o.hasVariant) walk(o.hasVariant); };
    for (const b of blocks || []) { try { walk(JSON.parse(b)); } catch (e) {} }
    const isP = o => [].concat(o['@type'] || []).some(t => /^(?:Product|ProductGroup)$/.test(t));
    const ps = flat.filter(isP); if (!ps.length) return null;
    const p = ps[0];
    const gt = ps.map(x => x.gtin13 || x.gtin12 || x.gtin14 || x.gtin8 || x.gtin || (x.offers && [].concat(x.offers)[0] && [].concat(x.offers)[0].gtin)).find(g => /^\d{8,14}$/.test(String(g || '')));
    const brand = typeof p.brand === 'string' ? p.brand : p.brand && p.brand.name;
    return { code: gt ? String(gt) : null, brand: brand || '', name: String(p.name || ''), description: String(p.description || '').slice(0, 4000) };
  }
  // 0.4.44: one 'Try:' / 'Easy swap:' pill on non-vegan beauty pages (same-store search). Returns [] or [pill].
  function swapPill(verdict, matched, name, S) {
    const W = typeof VeganSwaps !== 'undefined' ? VeganSwaps : null;
    if (verdict !== 'non-vegan' || !W || !S || S.showSwaps === false || document.querySelector('.vl-swap-pill')) return [];
    const sw = W.pickSwap(matched, name) || (W.swapForText((matched || []).join(' ') + ' ' + name) && { label: W.swapForText((matched || []).join(' ') + ' ' + name).query, query: W.swapForText((matched || []).join(' ') + ' ' + name).query });
    if (!sw) return [];
    const w = document.createElement('span'); w.className = 'vl-swap vl-swap-pill vl-swap-banner';
    const a = document.createElement('a'); a.href = W.storeSearchUrl(location.href, sw.query); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = sw.label;
    w.append(W.say(S.audience, 'swap'), a); return [(typeof VeganLensBrand !== 'undefined' ? VeganLensBrand.mark : e => e)(w)];
  }
  // Pure: page classification + db result -> banner model
  function model(page, dbRes, D) {
    // 0.4.34: an always-vegan brand match is the reason, not 'from this page'.
    if (page.brand && page.verdict === 'vegan') return { verdict: 'vegan', head: '\u2713 Vegan brand (' + page.brand + ')', det: 'whole product line is vegan', title: 'Vegan Lens — source: Vegan brand list (' + page.brand + ' is 100% vegan)', source: 'vegan brand list' };
    const res = D.resolve(page, dbRes);
    const verdict = res.verdict, caution = res.caution || page.caution || [];
    const head = verdict === 'vegan' ? '🌱 Likely vegan' : verdict === 'non-vegan' ? '✕ Likely NOT vegan' : caution.length ? '⚠ Caution' : '? Vegan status unknown';
    const source = res.source === 'conflict' ? 'conflict between ' + dbRes.source + ' and this page' : dbRes && res.source === dbRes.source ? 'from ' + dbRes.source + (dbRes.certified ? ' (vegan label)' : '') : 'from this page (title/description)';
    const det = caution.length ? caution.join(' ') : verdict === 'non-vegan' && page.matched.length && res.source !== (dbRes && dbRes.source) ? 'Matched: ' + page.matched.join(', ') : '';
    return { verdict, head, det, title: 'Vegan Lens — source: ' + source + (dbRes && dbRes.crueltyFree ? ' · cruelty-free label' : ''), source };
  }
  // 0.4.34 fallback when a page has no JSON-LD Product (seen on Ulta e.l.f. Flavor Balms): og:title / h1 + brand link.
  function fromDom(doc) {
    const meta = n => { const m = doc.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]'); return m ? m.getAttribute('content') || '' : ''; };
    const h1 = doc.querySelector('h1');
    const name = (h1 && h1.textContent.trim()) || meta('og:title'); if (!name) return null;
    const bl = doc.querySelector('a[href*="/brand/"], [class*="brand" i] a, [data-test*="brand" i]');
    const brand = meta('product:brand') || (bl && bl.textContent.trim()) || '';
    return { code: null, brand: brand.slice(0, 80), name: name.slice(0, 200), description: (meta('og:description') || meta('description')).slice(0, 2000) };
  }
  // 0.4.45 general retail product pages (Walmart /ip/, Target /p/): text under an 'Ingredients' / 'Specifications' /
  // 'Materials' heading, if the page shows one. Pure (doc in), capped.
  const SPEC_HEAD = /^\s*(?:ingredients?|specifications?|specs|materials?|fabric(?: content)?|details)\b/i;
  function specText(doc) {
    const out = [];
    for (const n of doc.querySelectorAll('h2, h3, h4, dt, button, [data-testid*=ingredient i], [data-test*=ingredient i], [data-test*=specification i]')) {
      const t = (n.textContent || '').trim(); if (!SPEC_HEAD.test(t) || t.length > 40 && !/ingredient|specification/i.test(n.getAttribute('data-test') || n.getAttribute('data-testid') || '')) continue;
      const box = n.nextElementSibling || n.parentElement; const x = box ? (box.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (x) out.push(x.slice(0, 1500));
    }
    return [...new Set(out)].join('\n').slice(0, 3000);
  }
  const BEAUTY_HOST = /(^|\.)(?:sephora|ulta)\.com$/;
  const api = { fromJsonLd, fromDom, model, specText, swapPill, BEAUTY_HOST };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.VeganProductDB = api;
  const C = root.VeganClassifier, D = { resolve: (p, d) => C.resolveDb(p, d) };
  let done = false;
  function run() {
    if (done || !C || document.getElementById('vl-banner')) return; // one banner per page
    const h1 = document.querySelector('h1'); if (!h1) return;
    const info = fromJsonLd([...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent)) || fromDom(document);
    if (!info) return;
    done = true;
    chrome.storage.sync.get({ enabled: true, webEnabled: true, strictness: 'strict', showSwaps: true, audience: 'vegan' }, S => {
      if (S.enabled === false || S.webEnabled === false) return;
      const beauty = BEAUTY_HOST.test(location.hostname);
      const r = C.classify([info.brand, info.name, info.description, beauty ? '' : specText(document)].join('\n'), { ...S, beauty });
      const page = { brand: (r.whitelisted || [])[0] || '', verdict: r.verdict, matched: r.matched, caution: r.caution, certifiedVegan: r.positives.includes('certified vegan') };
      const b = document.createElement('div'); b.id = 'vl-banner';
      const render = d => {
        const m = model(page, d, D);
        b.className = 'vl-banner vl-banner-' + (m.verdict === 'unknown' ? 'unknown' : m.verdict); b.dataset.verdict = m.verdict; b.title = m.title; b.textContent = ''; b.removeAttribute('data-vl-attr');
        const h = document.createElement('b'); h.textContent = m.head; b.append(h);
        const s = document.createElement('span'); s.textContent = m.det || m.title.replace('Vegan Lens — ', ''); b.append(s);
        if (d && d.url && m.source !== 'from this page (title/description)' && m.source !== 'vegan brand list') { const a = document.createElement('a'); a.href = d.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = d.source; b.append(a); }
        (typeof VeganLensBrand !== 'undefined' ? VeganLensBrand.mark : typeof require === 'function' ? require('./brand.js').mark : (e => e))(b);
        b.append(...swapPill(m.verdict, page.matched, info.name, S)); // 0.4.44
      };
      render(null); h1.parentElement.insertBefore(b, h1);
      if (page.brand && page.verdict === 'vegan') return; // vegan brand: no lookup needed
      if (!beauty) return; // 0.4.45: open-database lookups stay beauty-only
      try { chrome.runtime.sendMessage({ type: 'db-lookup', db: 'obf', code: info.code, brand: info.brand, name: info.name }, d => { if (!chrome.runtime.lastError && d) render(d); }); } catch (e) {}
    });
  }
  run(); setTimeout(run, 2500); setTimeout(run, 8000); setTimeout(run, 15000);
})(typeof self !== 'undefined' ? self : this);
