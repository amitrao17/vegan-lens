// Vegan Lens brand-site banner (0.4.50). On a brand's OWN website: a slim, dismissible strip.
// all-vegan brands: green "Every product from this brand is vegan" + source; all-non-vegan (meat companies): a soft
// plant-based swaps note worded by the audience slider; mixed brands with a verified vegan line (0.4.51 picks): "This brand has a vegan line"; retailers: nothing.
// Every vegan entry carries the source checked on 2026-10-30 (brand statement or certifier). Browser global (VeganBrandSites) + Node module.
(function (root) {
  'use strict';
  // 0.4.52: rule data comes from rules/rules.json (see rules/rules.js); applyRules() re-runs when a signed list update lands.
  const Rules = (typeof module !== 'undefined' && module.exports) ? require('./rules/rules.js') : root.VeganRules;
  let SITES, RETAILERS, AUD;
  // Retailers/marketplaces never get a brand strip (per-product pills handle those).
  const hostOf = h => String(h || '').toLowerCase().replace(/\.$/, '');
  const isRetailer = h => { h = hostOf(h); return RETAILERS.some(r => r.endsWith('.') || !r.includes('.') ? new RegExp('(^|\\.)' + r.replace(/\./g, '\\.') + (r.includes('.') ? '' : '\\.')).test(h) : h === r || h.endsWith('.' + r)); };
  function match(host) {
    const h = hostOf(host); if (!h || isRetailer(h)) return null;
    const s = SITES.find(x => h === x.domain || h.endsWith('.' + x.domain)); if (s) return s;
    // 0.4.51: mixed brand with a verified vegan line (vegan picks) -> "This brand has a vegan line" strip.
    const B = (typeof module !== 'undefined' && module.exports) ? require('./veganBrands.js') : root.VeganBrands;
    const p = B && B.pickByDomain && B.pickByDomain(h);
    return p ? { brand: p.brand, domain: p.domain, verdict: 'mixed', cat: p.cat, line: p.line, source: p.collection, sourceName: p.sourceName } : null;
  }
  const aud = a => AUD[a] ? a : 'vegan';
  function bannerText(entry, audience) { return AUD[aud(audience)][entry.verdict === 'vegan' || entry.verdict === 'mixed' ? entry.verdict : 'nonvegan'] + (entry.verdict === 'mixed' && entry.line && aud(audience) === 'vegan' ? ': ' + entry.line : ''); }
  function swapLink(entry, SW) {
    const q = (SW && SW.swapQuery && SW.swapQuery(entry.swap || entry.cat)) || 'plant-based ' + (entry.swap || 'options');
    return 'https://www.google.com/search?q=' + encodeURIComponent(q);
  }
  const DISMISS_KEY = 'brandBannerDismissed';
  const isDismissed = (list, entry) => (list || []).includes(entry.domain);
  const dismiss = (list, entry) => [...new Set([...(list || []), entry.domain])];
  // Builds the strip (DOM); used by the content side and by tests (minidom-compatible createElement/setAttribute/append).
  function build(doc, entry, audience, opts) {
    opts = opts || {}; const Brand = opts.brand || root.VeganLensBrand;
    const b = doc.createElement('div'); b.id = 'vl-brand-banner';
    b.className = 'vl-brand-banner ' + (entry.verdict === 'vegan' || entry.verdict === 'mixed' ? 'vl-brand-vegan' : 'vl-brand-soft') + (entry.verdict === 'mixed' ? ' vl-brand-mixed' : '');
    b.setAttribute('role', 'note'); b.setAttribute('data-vl-brand', entry.domain);
    const t = doc.createElement('span'); t.className = 'vl-brand-text'; t.textContent = bannerText(entry, audience); b.append(t);
    const a = doc.createElement('a'); a.className = 'vl-brand-link'; a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer');
    if (entry.verdict === 'vegan') { a.setAttribute('href', entry.source); a.textContent = 'Source'; a.setAttribute('title', entry.sourceName); }
    else if (entry.verdict === 'mixed') { a.setAttribute('href', entry.source); a.textContent = AUD[aud(audience)].mixedLink; a.setAttribute('title', entry.sourceName); }
    else { a.setAttribute('href', swapLink(entry, opts.swaps || root.VeganSwaps)); a.textContent = 'Plant-based ideas'; }
    b.append(a);
    const x = doc.createElement('button'); x.className = 'vl-brand-close'; x.setAttribute('type', 'button'); x.setAttribute('aria-label', 'Hide on this site'); x.setAttribute('title', 'Hide on this site'); x.textContent = '\u00d7'; b.append(x);
    if (Brand && Brand.mark) Brand.mark(b, { doc });
    return b;
  }
  function applyRules(D) {
    ({ SITES, RETAILERS, AUD } = D.brandSites);
    try { Object.assign(api, { SITES, RETAILERS, AUD }); } catch (e) { /* first run: api not built yet */ }
  }
  applyRules(Rules.data()); Rules.onChange(applyRules);
  const api = { SITES, RETAILERS, isRetailer, match, bannerText, swapLink, build, DISMISS_KEY, isDismissed, dismiss, AUD };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.VeganBrandSites = api;
  if (typeof document === 'undefined' || !root.chrome || !chrome.storage || window.top !== window) return;

  const entry = match(location.hostname); if (!entry) return;
  const DEF = { webEnabled: true, brandBanners: true, siteBlock: [], pageBlock: [], audience: 'vegan' };
  chrome.storage.sync.get(DEF, S => {
    const P = root.VeganPage;
    if (!S.webEnabled || !S.brandBanners || (P && (P.siteBlocked(S.siteBlock, location.href) || P.isPageDisabled(S.pageBlock, location.href)))) return;
    chrome.storage.local.get({ [DISMISS_KEY]: [] }, st => {
      if (isDismissed(st[DISMISS_KEY], entry) || document.getElementById('vl-brand-banner')) return;
      const b = build(document, entry, S.audience);
      b.querySelector('.vl-brand-close').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); b.remove();
        chrome.storage.local.get({ [DISMISS_KEY]: [] }, s2 => chrome.storage.local.set({ [DISMISS_KEY]: dismiss(s2[DISMISS_KEY], entry) })); }, true);
      (document.body || document.documentElement).appendChild(b);
    });
  });
})(typeof self !== 'undefined' ? self : this);
