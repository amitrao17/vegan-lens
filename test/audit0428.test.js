// v0.4.28: live-audit fixes (Nordstrom leather/wool, Allrecipes link cards, Sephora tiles, cosmetics/condom cautions, blur consistency).
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const C = require('../contentClassifier.js'), P = require('../classifier.js'), B = require('../veganBrands.js');
const rd = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
const DIM = ['Stuart Weitzman Bacari Leather Bootie', 'Vince Lilith Tall Leather Boot', 'Max Mara Poldo Wool Belted Coat',
  'SENTALER Baby Alpaca & Wool Large Notched Lapel Wrap Coat', 'Manière De Voir Esma Suede Asymmetric Coat', 'Madewell The Simone Cocoon Coat in Boiled Wool',
  'Balmain No Wedge textured leather thigh-high boots with tassel', 'Dolce Vita Bayra Leather Bootie', 'Vince Pace Knee High Leather Boot',
  'Nordstrom Manhattan Leather Bootie', 'Børn Campbell Leather Knee High Boot', 'Söfft Kristen Leather Knee High Boot',
  'VIVAIA Filipa Round-Toe Stretchy Wool Knee-High Boots', 'Mackage Mai Wool Long Wrap Coat', 'Donna Karan New York Herringbone Wool Double Breasted Coat',
  'COS Belted Wool-blend Mock-neck Coat', 'Leather Ankle Boot with Buckle', 'Cashmere Crewneck Sweater', 'Mohair Blend Cardigan', 'Suede Penny Loafer'];
const NOT = ['Naked Wardrobe Faux Leather Trench Coat', 'Sam Edelman Milla Knee High Boot', 'Vegan Suede Boot', 'Microsuede Chelsea Boot', 'Faux Leather Knee High Boot',
  'Wool-free knit sweater', 'Leather-look Moto Jacket', 'Leather Care Kit for boots', 'Suede Protector Spray for Shoes', 'Steel wool for shoes', 'Vegan Leather Ankle Boot'];
test('audit titles: leather/wool/suede/alpaca garments + footwear dim', () => { for (const t of DIM) assert.strictEqual(C.classify(t).verdict, 'nonvegan', t); });
test('audit negatives: faux/vegan/microsuede/untagged stay undimmed', () => { for (const t of NOT) assert.notStrictEqual(C.classify(t).verdict, 'nonvegan', t); });
test('Allrecipes link cards + Sephora tiles + delayed rescans wired', () => {
  const w = rd('web.js');
  assert.match(w, /'a\.mntl-card'/); assert.match(w, /\.card__title-text/); assert.match(w, /sephora[\s\S]{0,40}a\[href\*="\/product\/"\]:has\(img\)/);
  assert.match(w, /for \(const ms of \[3000, 10000\]\) setTimeout/);
  assert.match(w, /el\.tagName === 'A'\) headline =/);
});
test('blur follows card verdict: vegan cards never blurred, blur runs after cards', () => {
  const w = rd('web.js');
  assert.match(w, /unit\.dataset\.vlW === 'vegan'\) continue/); assert.match(w, /cr\.verdict === 'vegan'\) \{ dbg\('img:skip-vegan-card'/);
  assert.ok(w.indexOf('blurImages(root.nodeType') > w.indexOf('for (const u of units) { processUnit(u)'));
  for (const t of ['Vegan Brownies', 'Vegan Zucchini Bread', 'Vegan Pancakes', "Vegan Shepherd's Pie"]) assert.strictEqual(C.classify(t).verdict, 'vegan', t);
});
test('cosmetics caution on shopping tiles unless vegan', () => {
  for (const t of ['MAC Cosmetics M·A·Cximal Silky Matte 12HR Wear Lipstick', 'Anastasia Beverly Hills Full-Pigment Matte & Satin Velvet Lipstick', 'Lash Sensational Mascara', 'Cream Blush Stick', 'Eyeshadow Palette 12 shades', 'Tinted Lip Balm'])
    assert.strictEqual((C.shopCaution(t) || {}).kind, 'cosmetics', t);
  assert.strictEqual(C.shopCaution('Vegan Matte Lipstick'), null);
  assert.strictEqual(C.shopCaution('Hydrating Face Moisturizer'), null);
  assert.match(C.shopCaution('MAC Lipstick').text, /carmine, beeswax, lanolin/);
  assert.strictEqual(C.classify('MAC Silky Matte Lipstick').verdict, 'neutral', 'caution never dims');
});
test('condoms: caution unless verified vegan brand; casein -> non-vegan; articles untouched', () => {
  for (const t of ['Trojan ENZ Lubricated Condoms 12ct', 'Durex Extra Sensitive Condoms']) {
    assert.match(C.shopCaution(t).text, /casein \(milk protein\).*vegan-certified/); assert.notStrictEqual(C.classify(t).verdict, 'nonvegan');
    const r = P.classify(t); assert.strictEqual(r.verdict, 'unknown'); assert.ok(r.caution.some(c => /casein/.test(c)), t);
  }
  for (const t of ['GLYDE Ultra Vegan Condoms', 'SKYN Original Non-Latex Condoms', 'HANX Ultra Thin Condoms', 'Sustain Natural Ultra Thin Condoms', 'Lovability Condoms 10 pack', 'MyBliss Condoms', 'L. Condoms Classic', 'Einhorn Condoms 7 pack', 'Fair Squared Condoms']) {
    assert.strictEqual(C.shopCaution(t), null, t); assert.strictEqual(P.classify(t).verdict, 'vegan', t);
  }
  assert.strictEqual(P.classify('Latex condoms processed with casein').verdict, 'non-vegan');
  assert.ok(!B.match('Unbound Condoms').length, 'unverified brands not listed');
  const w = rd('web.js'); assert.match(w, /isProductTile\(el\)\) return/); assert.match(w, /PRICE = /);
  assert.notStrictEqual(C.classify('Condom use reduces HIV risk, study finds').verdict, 'nonvegan');
});
