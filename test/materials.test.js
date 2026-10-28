const test = require('node:test');
const assert = require('node:assert');
const { classify, analyzeAttributes } = require('../classifier.js');
const c = (title, attributes) => classify(title, { attributes });

test('example dress: polyester/rayon/spandex -> vegan', () => {
  const r = c('Women\'s Ribbed Bodycon Midi Dress', [
    { label: 'Fabric type', value: 'Ribbed Fabric: 70% Polyester, 25% Rayon, 5% Spandex. Printed Fabric: 90% Polyester, 10% Spandex' },
    { label: 'Care instructions', value: 'Machine Wash' }, { label: 'Origin', value: 'Imported' }, { label: 'Closure type', value: 'Pull On' }]);
  assert.strictEqual(r.verdict, 'vegan');
  assert.ok(r.positives.some(p => p === 'materials: polyester, rayon, spandex'), r.positives.join());
  assert.deepStrictEqual(r.attributeRows, ['Fabric type']);
  assert.ok(r.materialsOnly);
});
test('leather shoes -> non-vegan', () => {
  const r = c('Men\'s Oxford Dress Shoe', [{ label: 'Outer material', value: 'Leather' }, { label: 'Sole material', value: 'Rubber' }]);
  assert.strictEqual(r.verdict, 'non-vegan');
  assert.ok(r.matched.includes('leather (Outer material)'));
});
test('PU leather bag -> vegan', () => {
  const r = c('Women\'s Tote Handbag', [{ label: 'Material', value: 'PU Leather' }, { label: 'Lining', value: 'Polyester' }]);
  assert.strictEqual(r.verdict, 'vegan');
});
test('faux leather / vegan leather / synthetic leather / faux fur -> vegan', () => {
  for (const v of ['Faux Leather', 'Vegan Leather', 'Synthetic leather upper', 'Faux Fur', 'Silk-like satin', 'Wool-like acrylic'])
    assert.strictEqual(c('Item', [{ label: 'Material', value: v }]).verdict, 'vegan', v);
});
test('wool blend -> non-vegan', () => {
  const r = c('Crew Neck Sweater', [{ label: 'Material composition', value: '60% Cotton, 30% Wool, 10% Nylon' }]);
  assert.strictEqual(r.verdict, 'non-vegan');
});
test('down-alternative comforter -> vegan', () => {
  const r = c('Queen Down Alternative Comforter', [{ label: 'Fill material', value: 'Down Alternative' }, { label: 'Material', value: 'Microfiber' }]);
  assert.strictEqual(r.verdict, 'vegan');
});
test('real down / silk / suede / cashmere -> non-vegan', () => {
  for (const v of ['90% White Goose Down', '100% Mulberry Silk', 'Suede', 'Cashmere', 'Sheepskin', 'Genuine leather'])
    assert.strictEqual(c('Item', [{ label: 'Fill material', value: v }]).verdict, 'non-vegan', v);
});
test('diet type vegan is a strong positive', () => {
  const r = c('Protein Bar', [{ label: 'Diet type', value: 'Vegan' }]);
  assert.strictEqual(r.verdict, 'vegan');
  assert.ok(r.positives.includes('diet type: vegan'));
});
test('animal ingredients elsewhere beat synthetic materials', () => {
  assert.strictEqual(c('Merino Wool Socks', [{ label: 'Material', value: 'Nylon, Spandex' }]).verdict, 'non-vegan');
});
test('food pages without material rows unchanged', () => {
  assert.strictEqual(c('Kraft Macaroni & Cheese', [{ label: 'Brand', value: 'Kraft' }, { label: 'Item weight', value: '7.25 oz' }]).verdict, 'non-vegan');
  assert.strictEqual(c('Haribo Goldbears', [{ label: 'Brand', value: 'Haribo' }]).verdict, 'unknown');
  assert.strictEqual(c('Haribo Goldbears', [{ label: 'Ingredients', value: 'sugar, gelatin' }]).verdict, 'non-vegan');
});
test('closure "pull down" and care rows ignored', () => {
  const a = analyzeAttributes([{ label: 'Care instructions', value: 'Hand wash wool cycle' }, { label: 'Closure type', value: 'Pull On' }]);
  assert.deepStrictEqual(a.animal, []); assert.deepStrictEqual(a.rows, []);
});
