// 0.4.45 live-test gaps: store tiles, retail PDPs, lactose-free, Food Network, Yelp tags, empty chips, Bing chip, Zappos.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs');
const { parse } = require('./helpers/minidom.js');
const U = require('../webUnits.js'), CC = require('../contentClassifier.js'), C = require('../classifier.js');
const A = require('../adUnits.js'), SW = require('../swaps.js'), R = require('../searchRewrite.js'), P = require('../productdb.js');
// minimal ':has()' support on top of minidom: "X:has(Y):has(Z)"
function sel(root, s) {
  const out = new Set();
  for (const one of s.split(/,(?![^(]*\))/).map(x => x.trim())) {
    const has = [...one.matchAll(/:has\(([^)]*)\)/g)].map(m => m[1]); const base = one.replace(/:has\([^)]*\)/g, '') || '*';
    for (const e of root.querySelectorAll(base)) if (has.every(h => e.querySelector(h))) out.add(e);
  }
  return [...out];
}
const units = (html, host) => sel(parse(html), U.storeUnitSel(host).join(', '));
const verdict = (parts) => CC.classifyParts ? CC.classifyParts(parts).verdict : CC.classify([parts.headline, parts.tags, parts.snippet].join('\n')).verdict;

test('Walmart search tiles are units', () => {
  const html = '<div data-item-id="123"><a href="/ip/Great-Value-Whole-Milk/10450114"><span data-automation-id="product-title">Great Value Whole Milk, 1 Gallon</span></a></div>' +
    '<div role="group"><a href="/ip/Oreo/1"><img alt="Oreo"></a></div>';
  assert.strictEqual(units(html, 'www.walmart.com').length, 2);
  assert.ok(U.TITLE_SEL.includes('product-title'));
});
test('Target tiles are units', () => {
  const html = '<div data-test="@web/site-top-of-funnel/ProductCardWrapper"><a href="/p/fairlife/-/A-1">fairlife Lactose-Free 2% Milk - 52 fl oz</a></div>';
  assert.strictEqual(units(html, 'www.target.com').length, 1);
});
test('Food Network recipe / promo cards are units', () => {
  const html = '<div class="o-PromoItem"><a href="/recipes/ree-drummond/mac-and-cheese">Mac and Cheese</a></div>' +
    '<ul><li><h3>Baked Ziti</h3><a href="/recipes/food-network-kitchen/baked-ziti">Get recipe</a></li></ul>' +
    '<div class="m-MediaBlock__a-Card"><a href="/recipes/x">x</a></div>';
  assert.strictEqual(units(html, 'www.foodnetwork.com').length, 3);
  assert.strictEqual(CC.classify('Mac and Cheese').verdict, 'nonvegan');
});
test('Walmart / Target PDP: one banner + one pill wired, store search links', () => {
  const m = JSON.parse(fs.readFileSync(__dirname + '/../manifest.json', 'utf8'));
  const g = m.content_scripts.find(c => c.js.includes('productdb.js'));
  assert.ok(g.matches.includes('*://*.walmart.com/ip/*') && g.matches.includes('*://*.target.com/p/*'));
  assert.ok(g.js.includes('swaps.js') && g.js.includes('brand.js'));
  const src = fs.readFileSync(__dirname + '/../productdb.js', 'utf8');
  assert.match(src, /getElementById\('vl-banner'\)\) return; \/\/ one banner/);
  assert.match(src, /vl-swap-pill/);
  assert.match(SW.storeSearchUrl('https://www.walmart.com/ip/x/1', 'oat milk'), /^https:\/\/www\.walmart\.com\/search\?q=oat%20milk$/);
  assert.match(SW.storeSearchUrl('https://www.target.com/p/x/-/A-1', 'oat milk'), /^https:\/\/www\.target\.com\/s\?searchTerm=oat%20milk$/);
  assert.ok(!P.BEAUTY_HOST.test('www.walmart.com') && P.BEAUTY_HOST.test('www.sephora.com'));
});
test('PDP ingredients/specifications text is read', () => {
  const doc = parse('<h1>Great Value Mac</h1><h2>Ingredients</h2><div>Enriched macaroni, whey, milkfat, cheese culture</div><h3>Specifications</h3><div>Brand: Great Value</div>');
  const t = P.specText(doc); assert.match(t, /whey/); assert.match(t, /Great Value/);
  assert.strictEqual(C.classify('Great Value Mac\n' + t).verdict === 'vegan', false);
});
test('lactose-free milk is dairy; dairy-free and oat milk stay vegan', () => {
  for (const t of ['fairlife Lactose-Free 2% Reduced Fat Ultra-Filtered Milk', 'Lactaid Lactose Free Whole Milk']) assert.strictEqual(CC.classify(t).verdict, 'nonvegan', t);
  for (const t of ['Silk Dairy-Free Oat Milk', 'Oatly Oat Milk', 'So Delicious Dairy Free Coconutmilk']) assert.notStrictEqual(CC.classify(t).verdict, 'nonvegan', t);
  assert.strictEqual(A.classifyAd({ headline: 'fairlife Lactose Free 2% Reduced Fat Ultra-Filtered Milk', snippet: '', alt: '' }, {}, CC.classify, CC.LABEL_W).verdict, 'nonvegan');
  assert.notStrictEqual(A.classifyAd({ headline: 'Milk frother - 2 year warranty', snippet: '', alt: '' }, {}, CC.classify, CC.LABEL_W).verdict, 'nonvegan');
});
test('Grassmilk is dairy', () => assert.strictEqual(CC.classify('Organic Valley Grassmilk Whole Milk').verdict, 'nonvegan'));
test('Yelp category tags are a strong signal; vegan places are not dimmed', () => {
  const doc = parse('<li><h3><a href="/biz/the-capital-grille">The Capital Grille</a></h3><a href="/search?cflt=steak">Steakhouses</a></li>' +
    '<li><h3><a href="/biz/great-sage">Great Sage</a></h3><a href="/search?cflt=vegan">Vegan</a></li>');
  const [a, b] = sel(doc, U.storeUnitSel('www.yelp.com').join(', '));
  assert.match(U.tagText(a), /Steakhouses/);
  assert.strictEqual(CC.classify({ headline: 'The Capital Grille', tags: U.tagText(a) }).verdict, 'nonvegan');
  assert.strictEqual(CC.classify({ headline: 'The Ruxton', tags: 'Steakhouses' }).verdict, 'nonvegan');
  assert.notStrictEqual(CC.classify({ headline: 'Great Sage', tags: U.tagText(b) }).verdict, 'nonvegan');
});
test('never an empty chip', () => {
  for (const t of ['', '   ', 'Hidden: about ', 'Non-vegan: ']) assert.match(U.chipLabel(t), /[a-z]{3,}\s*$/i);
  assert.strictEqual(U.chipLabel('Non-vegan: beef'), 'Non-vegan: beef');
  assert.match(fs.readFileSync(__dirname + '/../web.css', 'utf8'), /\.vl-w-chip,\.vl-w-chip \*\{visibility:visible!important/);
});
test('Bing gets the "Try the vegan version" chip for chicken nuggets (assist defaults to suggest)', () => {
  assert.ok(SW.swapQuery('chicken nuggets') || R.rewriteQuery('chicken nuggets'));
  const src = fs.readFileSync(__dirname + '/../search.js', 'utf8');
  assert.match(src, /searchAssist: 'suggest'/); assert.match(src, /b_content/);
  assert.match(fs.readFileSync(__dirname + '/../popup.js', 'utf8'), /searchAssist: 'suggest'/);
});
test('Zappos AllSaints leather title; Zappos / Etsy swaps use the store search', () => {
  const doc = parse('<article><a href="/p/allsaints-clive/1"><img alt="AllSaints Clive"></a><a href="/p/allsaints-clive/1" aria-label="AllSaints Clive Leather Chelsea, Black">AllSaints</a></article>');
  const h = U.fallbackHeadline(doc.querySelector('article')); assert.match(h, /Leather Chelsea/);
  assert.strictEqual(CC.classify(h).verdict, 'nonvegan');
  assert.strictEqual(SW.storeSearchUrl('https://www.zappos.com/p/x', 'vegan chelsea boots'), 'https://www.zappos.com/search?term=vegan%20chelsea%20boots');
  assert.strictEqual(SW.storeSearchUrl('https://www.etsy.com/listing/1', 'cork wallet'), 'https://www.etsy.com/search?q=cork%20wallet');
});
test('false-positive guards', () => {
  assert.notStrictEqual(CC.classify('Cage-free').verdict, 'vegan');
  assert.strictEqual(CC.classify('Vital Farms Cage-Free Large Eggs').verdict, 'nonvegan');
  assert.notStrictEqual(CC.classify('Barilla Gluten Free Penne Pasta').verdict, 'nonvegan');
  assert.notStrictEqual(CC.classify({ headline: 'Golden Era Vegan Restaurant', tags: 'Vegan, Vegetarian' }).verdict, 'nonvegan');
});
