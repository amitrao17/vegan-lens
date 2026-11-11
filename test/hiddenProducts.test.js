const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const C = require('../classifier.js');
const r = t => C.classify(t, {});
const NON = ['Watch with alligator strap', 'Beaver felt cowboy hat', 'Cultured pearl necklace', 'Freshwater pearl earrings', 'Horn buttons coat', 'Stag handle pocket knife', 'Camel hair coat', 'Vicuna coat', 'Nappa leather interior', 'Wrangler Jeans with Leather Patch', 'Honda Accord with Leather Seats'];
const CAUTION = ["Levi's 501 Original Fit Jeans", '2024 Honda Accord EX-L Sedan', 'Nike Air Max Sneakers', 'Mid-Century Modern Sofa', 'Fossil Chronograph Watch', 'Men\'s Winter Parka'];
const OK = ['Faux leather sofa', 'Pearl white guitar pickguard', 'Crocs Classic Clog', 'Synthetic leather seats', 'Microsuede couch'];
for (const t of NON) test('non-vegan hidden material: ' + t, () => assert.strictEqual(r(t).verdict, 'non-vegan'));
for (const t of CAUTION) test('caution: ' + t, () => { const x = r(t); assert.strictEqual(x.verdict, 'unknown'); assert.ok(x.caution.length, t); });
for (const t of OK) test('not non-vegan: ' + t, () => assert.notStrictEqual(r(t).verdict, 'non-vegan'));
test('jeans caution mentions the patch', () => assert.match(r('Slim Fit Jeans').caution[0], /patch/));
test('wiring: caution pill on cards and banner', () => {
  const c = fs.readFileSync(__dirname + '/../content.js', 'utf8');
  assert.match(c, /vl-badge-caution/); assert.match(c, /sometimes contains animal products/);
});
