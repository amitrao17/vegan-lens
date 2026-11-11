const test = require('node:test'); const assert = require('node:assert');
const C = require('../contentClassifier.js'); const U = require('../webUnits.js'); const R = require('../rules/rules.json');
const H = { host: 'www.ugg.com' };
test('verified UGG styles: caution on ugg.com tiles (brand implied by the site)', () => {
  assert.match(C.shopCaution('Bestseller Tasman II $130 130.00 USD 11 Colors', H).text, /suede and sheepskin \(UGG Tasman II\)/);
  assert.match(C.shopCaution('Bestseller Tazz II $150', H).text, /suede and sheepskin/);
  assert.match(C.shopCaution('Bestseller Classic Mini II $175', H).text, /sheepskin/);
  assert.match(C.shopCaution('Bestseller Classic Tall II $225', H).text, /sheepskin/);
  assert.match(C.shopCaution('Bestseller Classic Short II $195', H).text, /sheepskin/);
});
test('unverified or non-sheepskin styles and other sites: no caution', () => {
  for (const t of ['Tazz Whipstitch Knit $170', 'Bestseller Lowmel $150', 'Member Exclusive Classic Short Spillseam $205', 'Bestseller Sunburst Tall $295']) assert.equal(C.shopCaution(t, H), null, t);
  assert.equal(C.shopCaution('Tasman II $130', { host: 'www.example.com' }), null); // no brand, not the brand's site
  assert.ok(C.shopCaution('UGG Tasman II slipper', { host: 'www.example.com' })); // brand named
  assert.equal(C.shopCaution('UGG Tasman II vegan', H), null);
});
test('every style entry has a brand-page source and quoted material line', () => {
  for (const s of R.data.classifier.STYLE_MATERIALS) { assert.match(s.source, /^https:\/\/www\.ugg\.com\//); assert.equal(s.domain, 'ugg.com'); }
  for (const s of R.data.classifier.STYLE_MATERIALS.slice(3)) assert.match(s.quote, /sheepskin/i);
});
test('PDP text with material lines classifies non-vegan; generic product-tile selector', () => {
  assert.equal(C.classify({ headline: 'Tasman II', snippet: 'a lush sheepskin interior . Suede upper. 17mm sheepskin vamp lining' }).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'Tazz Whipstitch Knit', snippet: 'UGGplush Lining' }).verdict, 'neutral');
  assert.match(U.PRODUCT_TILE, /\[data-pid\]:has\(a\[href\]\):has\(img\)/); assert.match(U.PRODUCT_TILE, /product-tile i/);
});
