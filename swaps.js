// Vegan Lens "Vegan swaps": curated, local suggestions for non-vegan items. Browser global (VeganSwaps) + Node module.
// Only generic Amazon SEARCH links are built (never ASINs, prices or product claims).
// Brand queries use only brands from veganBrands.js (whole-line vegan).
(function (root) {
  'use strict';
  // 0.4.52: rule data comes from rules/rules.json (see rules/rules.js); applyRules() re-runs when a signed list update lands.
  const Rules = (typeof module !== 'undefined' && module.exports) ? require('./rules/rules.js') : root.VeganRules;
  let RULES, KEYWORDS, ALREADY, FALSE_FRIENDS, AUDIENCES, AUDIENCE, CAT;
  // Rules in priority order (most specific first). `terms`: classifier matched labels (base label before " (")
  // that trigger the rule; `text`: optional regex the item title must also match.
  // 0.4.44 keyword map (one source of truth for product pills, web 'Try:' fabric links and the search chip).
  // Category-level vegan search terms only: no brands, no product claims. Longest (most specific) key wins.
  // Search chip: put the swap into the user's own query ('ground beef recipes' -> 'plant-based ground recipes').
  function swapQuery(q) {
    const s = String(q || '').trim(); const m = swapForText(s); if (!m) return null;
    const e = KEYWORDS.find(x => x.k === m.key); return s.replace(e.re, m.query).replace(/\s+/g, ' ');
  }
  function swapForText(text) {
    const t = String(text || '');
    if (!t.trim() || ALREADY.test(t) || FALSE_FRIENDS.test(t)) return null;
    let best = null;
    for (const e of KEYWORDS) if (e.re.test(t) && (!best || e.k.length > best.k.length)) best = e;
    return best ? { key: best.k, query: best.q } : null;
  }
  // Same-store search URL; web search fallback. Only http(s) store origins are reused.
  const STORES = [
    [/(^|\.)amazon\.[a-z.]+$/, (o, q) => o + '/s?k=' + q],
    [/(^|\.)(?:giantfood|stopandshop|martinsfoods|giantfoodstores)\.com$/, (o, q) => o + '/product-search/' + q],
    [/(^|\.)webstaurantstore\.com$/, (o, q) => o + '/search/' + q.replace(/%20/g, '-') + '.html'],
    [/(^|\.)sephora\.com$/, (o, q) => o + '/search?keyword=' + q],
    [/(^|\.)ulta\.com$/, (o, q) => o + '/search?search=' + q],
    [/(^|\.)target\.com$/, (o, q) => o + '/s?searchTerm=' + q],
    [/(^|\.)walmart\.com$/, (o, q) => o + '/search?q=' + q],
    [/(^|\.)zappos\.com$/, (o, q) => 'https://www.zappos.com/search?term=' + q],
    [/(^|\.)etsy\.com$/, (o, q) => 'https://www.etsy.com/search?q=' + q],
    [/(^|\.)instacart\.com$/, (o, q) => o + '/store/s?k=' + q],
  ];
  function storeSearchUrl(href, query) {
    const q = encodeURIComponent(String(query || ''));
    try { const u = new URL(href); if (/^https?:$/.test(u.protocol)) for (const [re, f] of STORES) if (re.test(u.hostname)) return f(u.origin, q); } catch (e) {}
    return 'https://www.google.com/search?q=' + q;
  }
  // 0.4.44 audience wording (Settings > 'Who is this for?'). Wording only: verdicts and dim/hide never change.
  function audienceOf(a) { return AUDIENCES.includes(a) ? a : 'vegan'; }
  function say(aud, key) { return AUDIENCE[audienceOf(aud)][key]; }
  // Softer headline for flexitarian/omni: 'Contains meat' etc. Vegan wording stays 'Likely NOT vegan'.
  function verdictHead(aud, matched) {
    const a = audienceOf(aud); if (a === 'vegan') return AUDIENCE.vegan.notVegan;
    const t = (matched || []).join(' '); const c = CAT.find(([re]) => re.test(t));
    return c ? 'Contains ' + c[1] : AUDIENCE[a].notVegan;
  }
  const base = m => String(m || '').replace(/\s*\(.*$/, '').trim().toLowerCase();

  // matched: classifier `matched` labels; text: item title (+ details). Returns {id,label,query} or null.
  function pickSwap(matched, text) {
    const terms = new Set((matched || []).map(base));
    if (!terms.size) return null;
    const t = String(text || '');
    for (const r of RULES) if (r.terms.some(x => terms.has(x)) && (!r.text || r.text.test(t))) return { id: r.id, label: r.label, query: r.query };
    return null;
  }
  // Generic Amazon search on the user's own Amazon origin.
  function swapUrl(origin, query) {
    let o = '';
    try { const u = new URL(origin); if (/^https?:$/.test(u.protocol) && /(^|\.)amazon\.[a-z.]+$/.test(u.hostname)) o = u.origin; } catch (e) {}
    return (o || 'https://www.amazon.com') + '/s?k=' + encodeURIComponent(query);
  }
  // 0.4.58 affiliate links (inactive while the tag is empty). Only for links Vegan Lens itself creates (swap pills,
  // 'Try:' links, the vegan search chip) that point to a listed Amazon domain. Never site links, never verdicts, no network.
  let MON = { affiliate: { amazon: { tag: '', param: 'tag', domains: [], disclosure: '' } }, supportUrl: '' };
  const amz = () => (MON.affiliate && MON.affiliate.amazon) || {};
  function affiliateConfigured() { return !!amz().tag; }
  function affiliateActive(S) { return affiliateConfigured() && !(S && S.affiliate === false); }
  function affiliateUrl(href, S) {
    if (!affiliateActive(S)) return href;
    const A = amz();
    try {
      const u = new URL(href); const h = u.hostname.replace(/^www\./, '');
      if (u.protocol !== 'https:' || !(A.domains || []).some(d => h === d || h.endsWith('.' + d))) return href;
      if (u.searchParams.has(A.param || 'tag')) return href; // never replace a tag that is already there
      u.searchParams.set(A.param || 'tag', A.tag); return u.toString();
    } catch (e) { return href; }
  }
  const affiliateDisclosure = () => amz().disclosure || 'As an Amazon Associate, Vegan Lens earns from qualifying purchases.';
  const supportUrl = () => (MON.supportUrl && /^https:\/\//.test(MON.supportUrl)) ? MON.supportUrl : '';
  // Applies the tag; returns true when it was added (caller then shows the disclosure in the link title).
  function tagLink(a, S) { const before = a.href, after = affiliateUrl(before, S); if (after === before) return false; a.href = after; a.title = ((a.title ? a.title + '\n' : '') + affiliateDisclosure()); a.rel = 'noopener noreferrer sponsored'; a.dataset.vlAffiliate = '1'; return true; }
  function applyRules(D) {
    if (D.monetization) MON = D.monetization;
    ({ RULES, KEYWORDS, ALREADY, FALSE_FRIENDS, AUDIENCES, AUDIENCE, CAT } = D.swaps);
    try { Object.assign(api, { RULES, KEYWORDS, AUDIENCES, AUDIENCE }); } catch (e) { /* first run: api not built yet */ }
  }
  applyRules(Rules.data()); Rules.onChange(applyRules);
  const api = { affiliateConfigured, affiliateActive, affiliateUrl, affiliateDisclosure, supportUrl, tagLink, RULES, KEYWORDS, pickSwap, swapUrl, swapForText, swapQuery, storeSearchUrl, AUDIENCES, AUDIENCE, audienceOf, say, verdictHead };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganSwaps = api;
})(typeof self !== 'undefined' ? self : this);
