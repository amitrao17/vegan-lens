const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const W = require('../swaps.js'); const C = require('../classifier.js'); const CC = require('../contentClassifier.js'); const SH = require('../share.js');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('swap map: specific beats general', () => {
  assert.strictEqual(W.swapForText('Ground beef 80/20').query, 'plant-based ground');
  assert.strictEqual(W.swapForText('Beef stew meat').query, 'plant-based beef');
  assert.strictEqual(W.swapForText('Chicken nuggets 2 lb').query, 'plant-based nuggets');
  assert.strictEqual(W.swapForText('Leather boots for men').query, 'vegan leather boots');
  assert.strictEqual(W.swapForText('Genuine leather').query, 'vegan leather');
  assert.strictEqual(W.swapForText('Goose down jacket').query, 'synthetic insulated jacket');
  assert.strictEqual(W.swapForText('Wool coat, camel').query, 'vegan coat');
  for (const [t, q] of [['cow milk', 'oat milk'], ['cheddar cheese', 'vegan cheddar'], ['salted butter', 'vegan butter'], ['vanilla yogurt', 'plant-based yogurt'], ['ice cream pint', 'dairy-free ice cream'], ['dozen eggs', 'plant-based egg'], ['beef burgers', 'plant-based burgers'], ['bacon', 'plant-based bacon'], ['pork sausage', 'plant-based sausage'], ['deli meat', 'plant-based deli slices'], ['canned tuna', 'plant-based tuna'], ['raw honey', 'maple syrup or vegan honey'], ['silk scarf', 'satin'], ['unflavored gelatin', 'agar']])
    assert.strictEqual(W.swapForText(t).query, q, t);
});
test('vegan / faux / plant-based inputs produce no swap', () => {
  for (const t of ['vegan cheese', 'faux leather boots', 'plant-based burgers', 'dairy-free ice cream', 'oat milk', 'peanut butter', 'eggplant parm']) assert.strictEqual(W.swapForText(t), null, t);
});
test('queries are category-level (no capitalised brand names)', () => {
  for (const e of W.KEYWORDS) assert.match(e.q, /^[a-z][a-z -]*$/, e.q);
  for (const r of W.RULES) assert.match(r.query, /^[a-z][a-z -]*$/, r.query);
});
test('store search URLs, encoded, with web fallback', () => {
  const q = 'oat milk & co';
  assert.strictEqual(W.storeSearchUrl('https://www.amazon.com/dp/B000', q), 'https://www.amazon.com/s?k=oat%20milk%20%26%20co');
  assert.strictEqual(W.storeSearchUrl('https://giantfood.com/product/1', q), 'https://giantfood.com/product-search/oat%20milk%20%26%20co');
  assert.strictEqual(W.storeSearchUrl('https://www.sephora.com/product/x', 'vegan lip balm'), 'https://www.sephora.com/search?keyword=vegan%20lip%20balm');
  assert.strictEqual(W.storeSearchUrl('https://www.ulta.com/p/x', 'vegan lip balm'), 'https://www.ulta.com/search?search=vegan%20lip%20balm');
  assert.strictEqual(W.storeSearchUrl('https://www.target.com/p/x', 'vegan leather bag'), 'https://www.target.com/s?searchTerm=vegan%20leather%20bag');
  assert.strictEqual(W.storeSearchUrl('https://shop.example/boots', 'vegan leather boots'), 'https://www.google.com/search?q=vegan%20leather%20boots');
  assert.strictEqual(W.storeSearchUrl('javascript:alert(1)', 'x'), 'https://www.google.com/search?q=x');
});
test('one swap pill per product page; setting off means no pill', () => {
  const c = rd('content.js'), p = rd('productdb.js');
  assert.match(c, /if \(!S\.showSwaps \|\| !W\) return null;/);
  assert.match(c, /if \(banner && document\.querySelector\('\.vl-swap-pill'\)\) return null;/);
  assert.match(p, /S\.showSwaps === false \|\| document\.querySelector\('\.vl-swap-pill'\)\) return \[\]/);
  // productdb functional check with a tiny DOM
  const nodes = []; let pill = false;
  global.VeganSwaps = W; global.location = { href: 'https://www.sephora.com/product/x' };
  global.document = { querySelector: () => pill ? {} : null, createElement: t => { const e = { tag: t, kids: [], className: '', append(...k) { this.kids.push(...k); } }; nodes.push(e); return e; } };
  const src = p.match(/function swapPill[\s\S]*?\n  }\n/)[0]; const swapPill = new Function(src + 'return swapPill;')();
  assert.strictEqual(swapPill('non-vegan', ['beeswax'], 'Lip Balm', { showSwaps: false }).length, 0);
  const one = swapPill('non-vegan', ['beeswax'], 'Lip Balm', { showSwaps: true, audience: 'vegan' });
  assert.strictEqual(one.length, 1); assert.strictEqual(one[0].kids[0], 'Try: '); assert.match(one[0].kids[1].href, /sephora\.com\/search\?keyword=vegan%20lip%20balm/);
  pill = true; assert.strictEqual(swapPill('non-vegan', ['beeswax'], 'Lip Balm', { showSwaps: true }).length, 0);
  assert.strictEqual(swapPill('vegan', [], 'Lip Balm', { showSwaps: true }).length, 0);
  delete global.document; delete global.location; delete global.VeganSwaps;
});
test('search chip: triggers on ground beef recipes / leather boots, not vegan cheese / faux leather boots', () => {
  assert.strictEqual(W.swapQuery('ground beef recipes'), 'plant-based ground recipes');
  assert.strictEqual(W.swapQuery('leather boots'), 'vegan leather boots');
  assert.strictEqual(W.swapQuery('vegan cheese'), null);
  assert.strictEqual(W.swapQuery('faux leather boots'), null);
  const s = rd('search.js'); assert.match(s, /SW\.swapQuery\(q\)/); assert.match(s, /SW\.say\(S\.audience, 'searchChip'\)/);
  assert.strictEqual(W.say('vegan', 'searchChip'), 'Try the vegan version: ');
  const m = JSON.parse(rd('manifest.json')); for (const cs of m.content_scripts) assert.ok(cs.js.includes('swaps.js'), cs.js.join());
});
test('web fabric Try: uses the shared swap map', () => {
  assert.strictEqual(CC.fabricQuery(CC.classify('The best leather boots for fall', {})), 'vegan leather boots');
  assert.match(rd('web.js'), /say\('swap', 'Try: '\)/);
});
test('audience strings switch; verdicts unchanged', () => {
  const t = 'Angus Beef Burger Patties'; const r = C.classify(t);
  assert.strictEqual(r.verdict, 'non-vegan');
  assert.strictEqual(W.verdictHead('vegan', r.matched), 'Likely NOT vegan');
  assert.strictEqual(W.verdictHead('flexitarian', r.matched), 'Contains meat');
  assert.strictEqual(W.verdictHead('omni', ['milk']), 'Contains dairy');
  assert.strictEqual(W.say('vegan', 'swap'), 'Try: '); assert.strictEqual(W.say('flexitarian', 'swap'), 'Easy swap: ');
  assert.strictEqual(W.say('omni', 'totalLabel'), 'items flagged'); assert.strictEqual(W.say('vegan', 'totalLabel'), 'Non-vegan items detected');
  assert.match(W.say('flexitarian', 'tagline'), /eat less meat, one easy swap at a time/i);
  assert.strictEqual(W.say('bogus', 'swap'), 'Try: ');
  const it = { title: 'Burger', verdict: 'about beef', url: 'https://e.com/', swap: 'https://e.com/s' };
  assert.match(SH.buildMessage(it, { audience: 'vegan', storeUrl: '' }), /Vegan swap: .*Found with Vegan Lens$/);
  assert.match(SH.buildMessage(it, { audience: 'flexitarian', storeUrl: '' }), /Easy swap: .*Found a plant-based swap with Vegan Lens$/);
  assert.strictEqual(C.classify(t, { audience: 'omni' }).verdict, r.verdict);
  for (const k of Object.keys(W.AUDIENCE.vegan)) for (const a of W.AUDIENCES) assert.ok(k in W.AUDIENCE[a], a + '.' + k);
});
test('slider defaults to Vegan; wording only', () => {
  const h = rd('popup.html'), j = rd('popup.js');
  assert.match(h, /<section role="tabpanel" id="panel-settings"[^>]*>\s*<div class="audience">/);
  assert.match(h, /id="audience" min="0" max="2" step="1" value="0"/);
  assert.match(j, /audience: 'vegan'/); assert.match(rd('content.js'), /audience: 'vegan'/); assert.match(rd('web.js'), /audience: 'vegan'/);
  assert.deepStrictEqual(W.AUDIENCES, ['vegan', 'flexitarian', 'omni']);
  assert.ok(!/audience[^\n]*(?:webMode|mode)\s*:/.test(j), 'slider never sets dim/hide');
});
test('no new stats keys (0.4.49: images + adImages approved by Amit)', () => {
  const w = rd('telemetry/worker.js');
  assert.match(w, /new Set\(\['v', 'day', 'features', 'mode', 'webMode', 'sensitivity', 'searchAssist', 'counts', 'reveals', 'offersShown', 'offersClicked', 'sharesClicked', 'images', 'adImages'\]\)/);
  const b = rd('background.js'); assert.ok(!/audience|swapClick|rewriteCount|vegan[A-Z]\w*:/.test(b));
  for (const f of ['content.js', 'web.js', 'search.js', 'productdb.js', 'swaps.js']) assert.ok(!/type: 'stat', k: '(?:swap|audience|rewrite)/.test(rd(f)), f);
});
