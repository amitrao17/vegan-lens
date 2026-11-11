// Vegan Lens open-database lookups (0.4.31). Browser global (VeganDB) + Node module. Runs in the background worker.
// Privacy: a request contains ONLY a barcode (8-14 digits) or a brand + product name (plain text, <= 80 chars each) of the
// product page being viewed. Never URLs, page text, history or identifiers. credentials:'omit', no referrer, 6 s timeout.
(function (root) {
  'use strict';
  const OFF = 'https://world.openfoodfacts.org', OBF = 'https://world.openbeautyfacts.org';
  const FIELDS = 'code,product_name,brands,ingredients_analysis_tags,labels_tags';
  const TTL_HIT = 7 * 864e5, TTL_MISS = 864e5, MAX_ENTRIES = 300, TIMEOUT = 6000;
  const BARNIVORE_SEARCH = 'https://www.barnivore.com/search?keyword='; // no public API (verified 2026-10-29): user-clicked link only

  const cleanCode = c => /^\d{8,14}$/.test(String(c || '').trim()) ? String(c).trim() : null;
  const cleanText = s => { s = String(s || '').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/[^\p{L}\p{N}&'’ .+-]/gu, ' ').replace(/\s+/g, ' ').trim(); return s.slice(0, 80); };
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  // Build the one URL for a lookup. Returns null when nothing allowed is available.
  function buildUrl(db, q) {
    const base = db === 'obf' ? OBF : db === 'off' ? OFF : null; if (!base) return null;
    const code = cleanCode(q.code);
    if (code) return { key: db + ':c:' + code, url: `${base}/api/v2/product/${code}.json?fields=${FIELDS}` };
    const brand = cleanText(q.brand), name = cleanText(q.name);
    if (!brand || !name) return null;
    return { key: db + ':s:' + norm(brand) + '|' + norm(name), url: `${base}/cgi/search.pl?search_simple=1&json=1&page_size=5&fields=${FIELDS}&search_terms=${encodeURIComponent(brand + ' ' + name)}`, brand, name };
  }
  // Map OFF/OBF tags to a verdict.
  function mapProduct(p) {
    if (!p) return null;
    const tags = p.ingredients_analysis_tags || [], labels = p.labels_tags || [];
    const certified = labels.some(l => /^en:(?:vegan|certified-vegan|vegan-society|vegan-action|beveg|vegan-certified|eve-vegan)/.test(l));
    const crueltyFree = labels.some(l => /cruelty-free|not-tested-on-animals|leaping-bunny/.test(l));
    let verdict = certified || tags.includes('en:vegan') ? 'vegan' : tags.includes('en:non-vegan') ? 'non-vegan' : tags.includes('en:maybe-vegan') ? 'maybe' : 'unknown';
    return { verdict, certified, crueltyFree, name: String(p.product_name || '').slice(0, 120), code: p.code || null };
  }
  // Search results: accept only a product whose brand matches and whose name shares >= 60% of the page's name words.
  function bestMatch(products, brand, name) {
    const b = norm(brand), words = norm(name).split(' ').filter(w => w.length > 2);
    let best = null, bestScore = 0;
    for (const p of products || []) {
      const pb = norm(p.brands); if (!pb || !(pb.includes(b) || b.includes(pb.split(' ')[0]))) continue;
      const pn = ' ' + norm(p.product_name) + ' '; if (!words.length) continue;
      const s = words.filter(w => pn.includes(' ' + w + ' ')).length / words.length;
      if (s > bestScore) { bestScore = s; best = p; }
    }
    return bestScore >= 0.6 ? best : null;
  }
  async function fetchJson(url, f, timeout) {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ac && ac.abort(), timeout || TIMEOUT);
    try {
      const r = await f(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'default', signal: ac ? ac.signal : undefined });
      if (!r || !r.ok) return null; return await r.json();
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  // store: { get(key) -> Promise<obj|undefined>, set(key, obj) -> Promise }. Cache map lives under one storage key.
  async function cacheGet(store, key, now) {
    const all = (await store.get()) || {}; const e = all[key];
    return e && now - e.t < (e.v ? TTL_HIT : TTL_MISS) ? e : null;
  }
  async function cachePut(store, key, v, now) {
    const all = (await store.get()) || {}; all[key] = { t: now, v };
    const ks = Object.keys(all); if (ks.length > MAX_ENTRIES) ks.sort((a, b) => all[a].t - all[b].t).slice(0, ks.length - MAX_ENTRIES).forEach(k => delete all[k]);
    await store.set(all);
  }
  async function lookup(db, q, deps) {
    const f = deps.fetch, now = deps.now ? deps.now() : Date.now();
    const req = buildUrl(db, q || {}); if (!req || !f) return null;
    const hit = deps.store && await cacheGet(deps.store, req.key, now); if (hit) return hit.v;
    const j = await fetchJson(req.url, f, deps.timeout);
    if (j === null) return null; // network failure: don't cache, fail quietly
    // 0.4.33: OBF files some cosmetics (e.g. e.l.f. lip oil sticks) under food -> ask Open Food Facts instead.
    if (db === 'obf' && j && j.status === 0 && /different product type:?\s*food/i.test(j.status_verbose || '') && !(q && q._fromObf)) return lookup('off', { ...q, _fromObf: true }, deps);
    const p = req.brand ? bestMatch(j.products, req.brand, req.name) : (j.status === 1 || j.product ? j.product : null);
    const m = mapProduct(p);
    const v = m ? { ...m, source: db === 'obf' ? 'Open Beauty Facts' : 'Open Food Facts', url: (db === 'obf' ? OBF : OFF) + '/product/' + (m.code || '') } : null;
    if (deps.store) await cachePut(deps.store, req.key, v, now);
    return v;
  }
  const barnivoreUrl = name => { const n = cleanText(name); return n ? BARNIVORE_SEARCH + encodeURIComponent(n) : null; };
  const ALCOHOL = /\b(?:beers?|ales?|lagers?|ipa|stouts?|porters?|pilsners?|ciders?|wines?|cabernet|merlot|pinot|chardonnay|sauvignon|riesling|ros[eé]|prosecco|champagne|vodka|gin|rum|whisk(?:e)?y|bourbon|tequila|mezcal|brandy|cognac|liqueurs?|spirits?|sake)\b/i;
  const api = { OFF, OBF, FIELDS, TTL_HIT, TTL_MISS, cleanCode, cleanText, buildUrl, mapProduct, bestMatch, lookup, barnivoreUrl, ALCOHOL, cacheGet, cachePut };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganDB = api;
})(typeof self !== 'undefined' ? self : this);
