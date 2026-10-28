// Fixture tests: small markup excerpts captured from the live sites (see test/fixtures/*.html headers).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { parse } = require('./helpers/minidom.js');
const V = require('../sites.js');
const C = require('../classifier.js');
const R = require('../searchRewrite.js');
const fx = n => parse(fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8'));
const RESULT_SEL = "div[data-component-type='s-search-result']";

test('amazon card: title skips hidden cart-popover h2s', () => {
  const cards = fx('amazon-cards.html').querySelectorAll(RESULT_SEL);
  assert.strictEqual(cards.length, 3);
  assert.ok(cards[0].querySelectorAll('h2').length >= 3, 'fixture keeps the popover h2s');
  assert.deepStrictEqual(cards.map(V.amazonTitleOf), ['Sharp Cheddar Cheese, Shred, 8oz', 'Dairy Free Cheddar Slices, 7.8oz', 'Violife Cheddar Shreds, 8oz']);
});
test('amazon card: cheddar cheese non-vegan, plant-based cheddar vegan', () => {
  const v = fx('amazon-cards.html').querySelectorAll(RESULT_SEL).map(c => C.classify(V.amazonTitleOf(c), {}).verdict);
  assert.deepStrictEqual(v, ['non-vegan', 'vegan', 'vegan']);
});
test('plant cheese titles stay vegan; dairy cheese stays non-vegan', () => {
  for (const t of ['Dairy Free Cheddar Shreds, 7.1oz', 'Daiya Dairy-Free Mozzarella Style Shreds', 'Violife Just Like Cheddar', 'Vegan Cheddar Cheese Slices']) assert.strictEqual(C.classify(t, {}).verdict, 'vegan', t);
  for (const t of ['Medium Cheddar Cheese, 8oz', 'Raw Sharp Cheddar, 12ct 8oz', 'Lactose Free Cheddar Cheese']) assert.strictEqual(C.classify(t, {}).verdict, 'non-vegan', t);
});
test('giant tiles: found via li.product-cell, name without icon svg / size text', () => {
  const ts = V.findTiles(fx('giant-tiles.html'));
  assert.strictEqual(ts.length, 3);
  assert.deepStrictEqual(ts.map(V.titleOfTile), ['Giant Vitamin D Whole Milk', 'Giant 2% Reduced Fat Milk', 'Giant 2% Reduced Fat Milk']);
  assert.deepStrictEqual(ts.map(V.idOfTile), ['58049', '362945', '362946']);
  for (const t of ts) { assert.strictEqual(C.classify(V.titleOfTile(t), {}).verdict, 'non-vegan'); assert.strictEqual(V.isSponsored(t), false); }
});
test('giant product page: title from h2.item-detail_product-name, ingredients + allergens -> non-vegan', () => {
  const d = fx('giant-pdp.html');
  const h = V.detailTitleEl(d);
  assert.ok(h); assert.strictEqual(h.textContent.trim(), 'Giant Vitamin D Whole Milk');
  const t = d.innerText;
  assert.match(t, /Ingredients\s*\n\s*Milk, Vitamin D3\./);
  const g = V.groceryDetailText({ name: h.textContent.trim(), ingredients: 'Milk, Vitamin D3.', allergens: (t.match(/contains\s*:[^\n]*/i) || [''])[0] });
  assert.deepStrictEqual(g.allergens.animal, ['milk']);
  assert.strictEqual(C.classify(g.text, {}).verdict, 'non-vegan');
});
test('plant milks are vegan (Silk, Oatly, almond/soy/oat)', () => {
  for (const t of ['Silk Oat Milk', 'Silk Unsweetened Almond Milk, Half Gallon', 'Silk Original Soymilk', 'Oatly Oat Milk', 'Almondmilk Unsweetened', 'Soy Milk Original', 'Oat Milk Barista Edition', 'Califia Farms Almond Milk'])
    assert.strictEqual(C.classify(t, {}).verdict, 'vegan', t);
  for (const t of ['Silk Scarf', 'Mulberry Silk Pillowcase', 'Giant Vitamin D Whole Milk', 'Milk Chocolate with Almond Milk']) assert.strictEqual(C.classify(t, {}).verdict, 'non-vegan', t);
});
test('search assist: Amazon banner only when result cards exist', () => {
  assert.strictEqual(R.amazonHasResults(fx('amazon-cards.html')), true);
  // Minimal stand-in for Amazon's "Sorry! Something went wrong!" (dogs of Amazon) page: no result cards.
  const err = parse('<div id="g"><a href="/ref=cs_503_logo"><img alt="Amazon.com"></a><h2>Sorry! Something went wrong!</h2><img alt="Dogs of Amazon"></div>');
  assert.strictEqual(R.amazonHasResults(err), false);
  assert.strictEqual(R.amazonHasResults(parse('<div class="s-main-slot"><div data-asin="" class="s-result-item">No results for xyz</div></div>')), false);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'search.js'), 'utf8'), /isAmazon && !amazonHasResults\(\)/);
});
