const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const W = require('../swaps.js');
const C = require('../classifier.js');
const B = require('../veganBrands.js');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const pick = title => { const r = C.classify(title); return r.verdict === 'non-vegan' ? W.pickSwap(r.matched, title) : null; };
const cases = [
  ['Horizon Organic Whole Milk, Half Gallon', 'milk'],
  ['Tillamook Sharp Cheddar Cheese Block', 'cheese'],
  ['Kerrygold Pure Irish Butter', 'butter'],
  ['Chobani Greek Yogurt made with whole milk', 'yogurt'],
  ['Vanilla Ice Cream Pint made with fresh milk', 'ice-cream'],
  ["Hellmann's Real Mayonnaise with cage-free eggs", 'mayo'],
  ['Large Brown Eggs, 12 count', 'egg'],
  ['Tyson Chicken Breast Strips', 'chicken'],
  ['Angus Beef Burger Patties', 'burger'],
  ['Johnsonville Pork Sausage Links', 'sausage'],
  ['Oscar Mayer Bacon', 'bacon'],
  ['Hillshire Farm Deli Ham Slices', 'deli'],
  ['StarKist Chunk Light Tuna in Water', 'tuna'],
  ['Wild Alaskan Salmon Fillets', 'salmon'],
  ['Frozen Cooked Shrimp', 'shrimp'],
  ['Raw Wildflower Honey 16 oz', 'honey'],
  ['Haribo Gold-Bears Gummi Candy (gelatin)', 'gummies'],
  ['Optimum Nutrition Gold Standard Whey Protein Powder', 'whey-protein'],
  ["Dr. Martens Men's Leather Boots", 'leather-shoes'],
  ['Genuine Leather Crossbody Bag', 'leather-bag'],
  ['Mens Leather Belt Brown', 'leather-belt'],
  ['Womens Leather Moto Jacket', 'leather-jacket'],
  ['Merino Wool Crewneck Sweater', 'wool'],
  ['Goose Down Comforter Queen', 'down-comforter'],
  ['Mulberry Silk Pillowcase', 'silk'],
];
for (const [t, id] of cases) test('swap: ' + t, () => { const s = pick(t); assert.ok(s, 'no swap'); assert.strictEqual(s.id, id); assert.ok(s.label && s.query); });
test('one swap per item; strongest/most specific rule wins', () => {
  assert.strictEqual(W.pickSwap(['milk', 'cheese'], 'milk cheese').id, 'cheese');
  assert.strictEqual(W.pickSwap(['whey', 'milk'], 'whey protein').id, 'whey-protein');
});
test('no swap when nothing matched or unmapped term', () => {
  assert.strictEqual(W.pickSwap([], 'anything'), null);
  assert.strictEqual(W.pickSwap(['carmine'], 'lipstick'), null);
});
test('attribute-row labels like "leather (Upper)" map', () => assert.strictEqual(W.pickSwap(['leather (Upper)'], 'Sneaker').id, 'leather-shoes'));
test('brand queries only use brands from veganBrands.js; no ASINs/prices', () => {
  const brands = B.BUILTIN.map(e => e.name.toLowerCase());
  for (const r of W.RULES) {
    assert.ok(!/\b[B0][0-9A-Z]{9}\b|\$|\/dp\//.test(r.query + r.label), r.id);
    if (!/^vegan |vegan|down alternative|plant/i.test(r.query)) assert.ok(brands.some(b => r.query.toLowerCase().includes(b)), 'unknown brand in ' + r.query);
  }
});
test('URL uses the current Amazon origin', () => {
  assert.strictEqual(W.swapUrl('https://www.amazon.co.uk', 'Violife cheese'), 'https://www.amazon.co.uk/s?k=Violife%20cheese');
  assert.strictEqual(W.swapUrl('https://www.amazon.de/dp/x', 'vegan leather'), 'https://www.amazon.de/s?k=vegan%20leather');
  assert.strictEqual(W.swapUrl('https://smile.amazon.com', "Miyoko's & co"), 'https://smile.amazon.com/s?k=Miyoko\'s%20%26%20co');
  assert.strictEqual(W.swapUrl('https://evil.example', 'x'), 'https://www.amazon.com/s?k=x');
});
test('no sort-to-top code or setting remains', () => {
  const c = rd('content.js').replace(/delete S\.sortTop;|k !== 'sortTop'/g, '');
  assert.ok(!/sortTop|sortVegan|sortResults|vlSorted/.test(c.replace(/\/\/.*$/gm, '')), 'content.js only ignores legacy sortTop');
  for (const f of ['popup.html', 'manifest.json', 'README.md']) assert.ok(!/sortTop|sortVegan|sortResults|vlSorted|sort vegan/i.test(rd(f)), f);
  assert.ok(!/insertBefore\(v|s-main-slot/.test(rd('content.js')));
  assert.ok(!/sortTop\s*:/.test(rd('popup.js')));
  assert.ok(/storage\.sync\.remove\('sortTop'\)/.test(rd('popup.js')), 'stale setting cleaned');
});
test('popup has showSwaps toggle, default on', () => {
  assert.ok(/id="showSwaps"/.test(rd('popup.html')));
  assert.ok(/showSwaps: true/.test(rd('popup.js')) && /showSwaps: true/.test(rd('content.js')));
});
test('swaps.js loaded before content.js on Amazon', () => {
  const js = require('../manifest.json').content_scripts.find(c => c.js.includes('content.js')).js;
  assert.ok(js.indexOf('swaps.js') > -1 && js.indexOf('swaps.js') < js.indexOf('content.js'));
});
test('cleanup: undo removes swaps; links open in new tab with noopener', () => {
  const c = rd('content.js');
  assert.ok(/:scope > \.vl-swap/.test(c), 'clear() removes card swaps');
  assert.ok(/getElementById\('vl-banner'\)\?\.remove\(\)/.test(c), 'banner (with swap) removed');
  assert.ok(/target = '_blank'/.test(c) && /rel = 'noopener/.test(c));
  assert.ok(/icons\/icon32\.png/.test(c) && /Vegan swap: /.test(c));
});
