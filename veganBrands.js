// Vegan Lens "Always vegan" list (internally: whitelist). Browser global (VeganBrands) + Node module.
// Built-in entries are brands whose WHOLE product line is vegan, plus unambiguous vegan product names.
// Deliberately excluded (sell non-vegan items or ambiguous words): Morningstar Farms, Boca, Quorn,
// Lightlife (historic egg-containing items), Silk (collides with silk fabric; handled by classifier),
// bare "Impossible"/"Ripple"/"Just" (common words) - only qualified forms are listed.
(function (root) {
  'use strict';
  // 0.4.52: rule data comes from rules/rules.json (see rules/rules.js); applyRules() re-runs when a signed list update lands.
  const Rules = (typeof module !== 'undefined' && module.exports) ? require('./rules/rules.js') : root.VeganRules;
  let BUILTIN, PICKS, NOT_VEGAN;

  // lower-case, drop apostrophes, every other non-alphanumeric run -> single space; padded for boundary matching
  const norm = s => ' ' + String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2018\u2019\u02bc`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';

  function activeEntries(opts) {
    opts = opts || {};
    const off = new Set((opts.whitelistDisabled || []).map(n => norm(n)));
    const out = BUILTIN.filter(e => !off.has(norm(e.name))).map(e => ({ ...e, user: false }));
    for (const n of opts.whitelist || []) if (norm(n).trim()) out.push({ name: String(n).trim(), kind: 'user', user: true });
    return out;
  }

  // Returns matched entries (user entries first), each {name, kind, user}.
  function match(text, opts) {
    const t = norm(text);
    const hits = activeEntries(opts).filter(e => t.includes(norm(e.name)));
    return hits.sort((a, b) => b.user - a.user);
  }
  const label = e => (e.kind === 'product' ? 'product: ' : 'brand: ') + e.name;

  // 0.4.51 vegan picks: vegan products/lines from generally non-vegan brands. Each checked by opening the brand's own page (2026-10-30).
  // A pick needs BOTH the brand and the product wording in the same text; "collection" is the verified vegan-line page for the brand-site strip.
  function pick(text) {
    const t = String(text || '').replace(/[\u2018\u2019]/g, "'");
    if (!t || NOT_VEGAN.test(t)) return null;
    return PICKS.find(p => p.brandRe.test(t) && p.re.test(t) && !(p.not && p.not.test(t))) || null;
  }
  const pickByDomain = host => { const h = String(host || '').toLowerCase().replace(/\.$/, ''); return PICKS.find(p => h === p.domain || h.endsWith('.' + p.domain)) || null; };
  function applyRules(D) {
    ({ BUILTIN, PICKS, NOT_VEGAN } = D.brands);
    try { Object.assign(api, { BUILTIN, PICKS }); } catch (e) { /* first run: api not built yet */ }
  }
  applyRules(Rules.data()); Rules.onChange(applyRules);
  const api = { BUILTIN, match, norm, label, activeEntries, PICKS, pick, pickByDomain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganBrands = api;
})(typeof self !== 'undefined' ? self : this);
