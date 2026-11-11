// 0.4.46 Gmail: a vegan newsletter's images never blur; every blur is attributed; SPA hash navigation rescans.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs');
const { parse } = require('./helpers/minidom.js');
const U = require('../webUnits.js'), CC = require('../contentClassifier.js');
const { assertEveryBlurAttributed } = require('./helpers/blurAttr.js');
const web = fs.readFileSync(__dirname + '/../web.js', 'utf8');
// Same decision order as web.js blurImages(): alt must be blur-worthy, then the nearest content unit must not be vegan overall.
const decide = img => { const ab = CC.altBlur(img.getAttribute('alt'), {}, false); if (!ab.blur) return false; const u = U.contentUnit(img); return !(u && CC.unitVegan(U.unitText(u), {})); };
const gmail = body => parse('<div role="main"><h2 class="hP">Subject</h2><div role="list"><div role="listitem"><div class="a3s aiL">' + body + '</div></div></div></div>');

test('vegan newsletter: Chicken Filets / Spicy Beef Ramen images not blurred, not dimmed', () => {
  const doc = gmail('<h1>Meet Some of Our Favorite Vegan Brands</h1><p>Offbeast is changing dinner with its Premium Plant-Based Filet Mignons or Chicken Filets.</p>' +
    '<a href="https://offbeast.com"><img alt="Chicken Filets" width="600" height="400"></a><a href="https://offbeast.com">EXPLORE OFFBEAST</a>' +
    '<p>immi makes high-protein plant-based ramen.</p><a href="https://immieats.com"><img alt="Spicy Beef Ramen" width="600" height="600"></a>');
  const imgs = doc.querySelectorAll('img'); assert.strictEqual(imgs.length, 2);
  for (const i of imgs) { assert.strictEqual(U.contentUnit(i).className, 'a3s aiL'); assert.strictEqual(decide(i), false, i.getAttribute('alt')); }
  assert.notStrictEqual(CC.classify(U.unitText(U.contentUnit(imgs[0]))).verdict, 'nonvegan');
});
test('steakhouse promo email: ribeye image blurs, with attribution label wired', () => {
  const doc = gmail('<h1>This weekend at the Chophouse</h1><p>Our USDA prime cuts are back. Reserve your table for date night and enjoy a complimentary dessert with every entree ordered.</p><img alt="ribeye steak" width="600" height="400">');
  assert.strictEqual(decide(doc.querySelector('img')), true);
  assert.match(web, /img\.classList\.add\('vl-img-blur'\);[^\n]*\n\s*blurLabel\(img, blurReason\(r\)\)/);
  assert.match(web, /function blurLabel[\s\S]*?'blurred: '[\s\S]*?\\u00b7 show'; MARK\(l\)/);
  assert.match(web, /function unblurImg[\s\S]*?vl-blur-label[\s\S]*?remove\(\)/);
});
test('every blur code path carries attribution', () => assert.ok(assertEveryBlurAttributed() >= 2));
test('content unit is the message, never the page; vegan words in another unit do not leak', () => {
  const doc = parse('<div role="listitem"><div class="a3s">Plant-based vegan brands we love, vegan everything</div></div><div role="listitem"><div class="a3s">Steak night! Our ribeye steak special with lobster, every Friday. Book now for your party.<img alt="ribeye steak"></div></div>');
  const img = doc.querySelector('img'); assert.match(U.unitText(U.contentUnit(img)), /^Steak night/); assert.strictEqual(decide(img), true);
});
test('false-positive guards for unitVegan', () => {
  assert.strictEqual(CC.unitVegan('Not vegan: our bacon-wrapped filet mignon special this weekend only, book now'), false);
  assert.strictEqual(CC.unitVegan('Gluten-free pasta night with parmesan and bacon this weekend'), false);
});
test('SPA navigation: hashchange/popstate rescan, units reset', () => {
  assert.match(web, /addEventListener\('hashchange', onNav\)/); assert.match(web, /const onNav[\s\S]*?undo\(\); scan\(document\)/);
  assert.match(web, /function undo[\s\S]*?vl-blur-label/);
});
