// Vegan Lens "Always vegan" list (internally: whitelist). Browser global (VeganBrands) + Node module.
// Built-in entries are brands whose WHOLE product line is vegan, plus unambiguous vegan product names.
// Deliberately excluded (sell non-vegan items or ambiguous words): Morningstar Farms, Boca, Quorn,
// Lightlife (historic egg-containing items), Silk (collides with silk fabric; handled by classifier),
// bare "Impossible"/"Ripple"/"Just" (common words) - only qualified forms are listed.
(function (root) {
  'use strict';
  const BUILTIN = [
    ['Follow Your Heart', 'brand'], ['Vegenaise', 'product'], ['Beyond Meat', 'brand'], ['Beyond Burger', 'product'],
    ['Impossible Foods', 'brand'], ['Impossible Burger', 'product'], ['Impossible Sausage', 'product'],
    ['Tofurky', 'brand'], ['Daiya', 'brand'], ['Oatly', 'brand'], ['Violife', 'brand'], ["Miyoko's", 'brand'],
    ['Field Roast', 'brand'], ['Gardein', 'brand'], ['So Delicious Dairy Free', 'brand'], ['Kite Hill', 'brand'],
    ['Just Egg', 'product'], ['Earth Balance', 'brand'], ['Ripple Foods', 'brand'], ['Ripple Plant-Based', 'brand'],
    ['Tofutti', 'brand'], ["Upton's Naturals", 'brand'], ['No Evil Foods', 'brand'], ['Nutiva', 'brand'],
    ["Daring Foods", 'brand'], ['Simulate', 'brand'], ["Nurishh", 'brand'], ['Good Planet Foods', 'brand'],
  ].map(([name, kind]) => ({ name, kind }));

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

  const api = { BUILTIN, match, norm, label, activeEntries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganBrands = api;
})(typeof self !== 'undefined' ? self : this);
