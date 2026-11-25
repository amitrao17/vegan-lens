// 0.4.73: dairy-free claims in a post/ad clear cheese words; image blur uses post
// context; hide-mode carousel photos stay rendered (blurred) with a top-left label.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../contentClassifier.js');
const P = require('../classifier.js');
const A = require('../adUnits.js');
const Brands = require('../veganBrands.js');
const Sites = require('../brandSites.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const REBEL = {
  headline: 'Eight Nights. Zero Dairy. The Hanukkah Cheese Board',
  snippet: 'Eight nights. Zero dairy. The Hanukkah Cheese Board: 100% dairy-free, Certified Kosher Pareve by KSA, made by hand in Austin.',
  alt: 'Rebel Cheese Brie. Soft. Buttery. Zero dairy. 100% dairy-free cheese, made from cashews',
  author: 'Rebel Cheese'
};

test('versions agree at 0.4.77', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.77');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.77');
});

test('dairy-free claims clear cheese, cheese board, butter, brie, cream and milk in the same unit', () => {
  for (const t of [
    'dairy-free cheese board',
    '100% dairy-free cheese board',
    'non-dairy cheese board',
    'Zero dairy. The Hanukkah Cheese Board',
    'Cheese board made from cashews',
    'dairy-free brie',
    'non-dairy butter',
    'zero dairy cream',
    '100% dairy-free milk'
  ]) {
    const r = C.classify(t);
    assert.notEqual(r.verdict, 'nonvegan', t + ' -> ' + r.verdict + ' ' + JSON.stringify(r.matches));
  }
  assert.equal(C.classify('Zero dairy. The Hanukkah Cheese Board').verdict, 'vegan');
  assert.equal(C.classify('dairy-free cheese board').verdict, 'vegan');
  assert.equal(C.classify('non-dairy cheese').verdict, 'vegan');
});

test('Rebel Cheese Hanukkah Cheese Board Facebook ad is vegan, not hidden', () => {
  const r = C.classify(REBEL);
  assert.equal(r.verdict, 'vegan', JSON.stringify({ verdict: r.verdict, reasons: r.reasons, matches: r.matches, score: r.score }));
  const ad = A.classifyAd(REBEL, {}, C.classify, C.LABEL_W);
  assert.equal(ad.verdict, 'vegan');
});

test('image alt "cheese board" does not blur when the post says dairy-free', () => {
  assert.equal(C.altBlur('cheese board', {}, false).blur, true, 'alt alone still blurs');
  assert.equal(C.altBlur('The Hanukkah Cheese Board', {}, false).blur, true);
  const ctx = REBEL.headline + ' ' + REBEL.snippet + ' ' + REBEL.author;
  assert.equal(C.altBlur('cheese board', {}, false, ctx).blur, false);
  assert.equal(C.altBlur('The Hanukkah Cheese Board', {}, false, ctx).blur, false);
  assert.equal(C.altBlur(REBEL.alt, {}, false, ctx).blur, false);
});

test('Kosher Pareve is supporting (clears dairy words) but not vegan on its own; eggs/fish still count', () => {
  const pareve = C.classify('Certified Kosher Pareve cheese board');
  assert.notEqual(pareve.verdict, 'nonvegan', 'pareve cheese is not dairy');
  assert.notEqual(pareve.verdict, 'vegan', 'pareve alone is not a vegan verdict');
  assert.equal(C.classify('Kosher Pareve smoked salmon').verdict, 'nonvegan');
  assert.equal(C.classify('real cheddar cheese board').verdict, 'nonvegan');
  assert.equal(C.classify('Meat Lovers Pizza').verdict, 'nonvegan');
});

test('lactose-free milk stays dairy; "dairy" inside dairy-free / zero dairy / non-dairy does not', () => {
  assert.equal(C.classify('fairlife Lactose-Free 2% Reduced Fat Ultra-Filtered Milk').verdict, 'nonvegan');
  assert.notEqual(C.classify('zero dairy').verdict, 'nonvegan');
  assert.notEqual(C.classify('non-dairy creamer').verdict, 'nonvegan');
});

test('product classifier: zero dairy / non-dairy cheese board is vegan; lactose-free milk is not', () => {
  assert.equal(P.classify('Zero dairy. The Hanukkah Cheese Board', {}).verdict, 'vegan');
  assert.equal(P.classify('non-dairy cheese board', {}).verdict, 'vegan');
  assert.equal(P.classify('Dairy-Free Meltable Mozzarella', {}).verdict, 'vegan');
  assert.equal(P.classify('fairlife Lactose-Free 2% Reduced Fat Ultra-Filtered Milk', {}).verdict, 'non-vegan');
});

test('Rebel Cheese is a built-in vegan brand and brand site', () => {
  const hits = Brands.match('Rebel Cheese Hanukkah Cheese Board');
  assert.ok(hits.some(e => e.name === 'Rebel Cheese'), hits);
  const site = (Sites.SITES || []).find(s => s.domain === 'rebelcheese.com');
  assert.ok(site, 'rebelcheese.com should be in brandSites');
  assert.equal(site.verdict, 'vegan');
  assert.match(site.source, /rebelcheese\.com/);
  const r = C.classify({ headline: 'The Hanukkah Cheese Board', author: 'Rebel Cheese' });
  assert.ok((r.reasons || []).some(x => /Rebel Cheese/.test(x)), r.reasons);
});

test('web.js passes post text into altBlur; blur labels pin top-left; images are not unloaded', () => {
  const w = R('web.js');
  assert.match(w, /C\.altBlur\([^;]*postCtx/);
  assert.match(w, /function blurLabel[\s\S]*?vl-blur-host[\s\S]*?appendChild/);
  assert.match(w, /function unblurImg[\s\S]*?clearBlurLabel/);
  assert.doesNotMatch(w, /img\.src\s*=\s*['"]{2}/);
  assert.doesNotMatch(w, /img\.removeAttribute\(\s*['"]src['"]/);
  assert.match(w, /function blurLabel[\s\S]*?'blurred: '[\s\S]*?\\u00b7 show'; MARK\(l\)/);
});

test('hide-in CSS keeps carousel images rendered and blurred; labels sit top-left', () => {
  const css = R('web.css');
  // The old rule hid every non-chip child, which emptied Facebook carousel cells.
  // 0.4.75 goes further: hide mode never uses display:none on any card content.
  assert.doesNotMatch(css, /\.vl-w-hide-in:has\(>\.vl-w-chip\)>:not\(\.vl-w-chip\)\{display:none/);
  assert.doesNotMatch(css, /\.vl-w-chip\+\.vl-w-hide\{display:none/);
  assert.match(css, /\.vl-w-hide-in:has\(>\.vl-w-chip\) img[\s\S]*?visibility:visible!important[\s\S]*?opacity:1!important[\s\S]*?filter:blur/);
  assert.match(css, /\.vl-img-blur[\s\S]*?visibility:visible!important[\s\S]*?opacity:1!important/);
  assert.match(css, /\.vl-blur-host>\.vl-blur-label\{position:absolute!important;top:6px;left:6px/);
  assert.match(css, /\.vl-w-chip\.vl-w-chip-in\{position:absolute!important;top:6px;left:6px/);
});

test('CHANGELOG records dairy-free posts and carousel blur layout in 0.4.73', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.73/);
  assert.match(log, /[Zz]ero dairy/);
  assert.match(log, /dairy-free/i);
  assert.match(log, /Rebel Cheese/);
  assert.match(log, /carousel|blank gray|display:none/i);
  assert.match(log, /top-left/);
});
