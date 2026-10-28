const test = require('node:test');
const assert = require('node:assert');
const { classify } = require('../classifier.js');
const web = require('../contentClassifier.js');
const B = require('../veganBrands.js');

test('Vegenaise title classifies vegan with brand signal', () => {
  const r = classify('Follow Your Heart, Vegenaise, 32 Ounce');
  assert.strictEqual(r.verdict, 'vegan');
  assert.ok(r.positives.includes('brand: Follow Your Heart'), JSON.stringify(r));
  assert.ok(r.positives.includes('product: Vegenaise'));
});
test('apostrophes/punctuation/case tolerated', () => {
  for (const t of ["MIYOKOS Cultured Vegan Butter", "Miyoko\u2019s Creamery Cheese Wheel", "Upton's-Naturals Jackfruit", 'JUST Egg Plant Egg 12oz'])
    assert.strictEqual(classify(t).verdict, 'vegan', t);
});
test('word boundary: no partial matches', () => {
  assert.deepStrictEqual(B.match('Oatlyish Daiyas'), []);
  assert.strictEqual(classify('Gardeinx Chicken Strips').verdict, 'non-vegan');
});
test('built-in brand beats ingredient terms (fully vegan brands)', () => {
  assert.strictEqual(classify('Violife Just Like Cheddar Cheese Slices').verdict, 'vegan');
  assert.strictEqual(classify('Gardein Seven Grain Crispy Chicken Tenders').verdict, 'vegan');
  assert.strictEqual(classify('Oatly Oat Milk Full Fat').verdict, 'vegan');
});
test('explicit non-vegan label beats built-in, user entry beats all', () => {
  assert.strictEqual(classify('Daiya pizza (not vegan)').verdict, 'non-vegan');
  assert.strictEqual(classify('Acme Foods Chicken (non-vegan label)', { whitelist: ['Acme Foods'] }).verdict, 'vegan');
});
test('user entries and disabling built-ins', () => {
  assert.strictEqual(classify('Acme Bakery Bread').verdict, 'unknown');
  const r = classify('Acme Bakery Bread', { whitelist: ['acme bakery'] });
  assert.strictEqual(r.verdict, 'vegan'); assert.ok(r.positives.includes('brand: acme bakery'));
  assert.strictEqual(classify('Tofurky Plant-Based Deli Slices Smoked Ham', { whitelistDisabled: ['Tofurky'] }).verdict, 'non-vegan');
  assert.strictEqual(classify('Tofurky Plant-Based Deli Slices Smoked Ham').verdict, 'vegan');
});
test('excluded non-fully-vegan brands are not built in', () => {
  const names = B.BUILTIN.map(e => B.norm(e.name));
  for (const n of ['Morningstar Farms', 'Quorn', 'Boca', 'Silk']) assert.ok(!names.includes(B.norm(n)), n);
  assert.strictEqual(classify('Morningstar Farms Veggie Sausage Patties').verdict, 'unknown');
  assert.strictEqual(classify('Mulberry Silk Pillowcase').verdict, 'non-vegan');
});
test('web classifier: brand is a vegan signal and neutralizes dairy words', () => {
  const r = web.classify('Daiya cheese pizza review: the best frozen pizza');
  assert.strictEqual(r.verdict, 'vegan', JSON.stringify(r));
  assert.ok(r.reasons.includes('+brand: Daiya'));
  assert.strictEqual(web.classify('Acme Grill opens downtown', { whitelist: ['Acme Grill'] }).verdict, 'vegan');
  assert.strictEqual(web.classify('Daiya launches new line', { whitelistDisabled: ['Daiya'] }).verdict, 'neutral');
});
test('manifest loads veganBrands before classifiers', () => {
  const m = require('../manifest.json');
  for (const cs of m.content_scripts.slice(0, 2)) assert.ok(cs.js.indexOf('veganBrands.js') > -1 && cs.js.indexOf('veganBrands.js') < cs.js.length - 1);
});
