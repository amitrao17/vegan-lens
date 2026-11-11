// 0.4.50: Google 'Sponsored Products' (PLA) tiles. Structure mirrors the live google.com/search?q=ugg DOM (2026-10-30):
// an empty clickable <a aria-label=" for  from UGG US"> comes first; the full title is in the tile text.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { parse } = require('./helpers/minidom.js');
const A = require('../adUnits.js'), C = require('../contentClassifier.js');
const tile = (title, seller) => parse('<div class="pla-unit" data-dtld="ugg.com"><a href="/aclk?x"></a><div role="link"><a class="plantl" href="https://www.ugg.com/p" aria-label=" for  from ' + seller + '"></a></div>' +
  '<div class="pla-unit-container"><a href="https://www.ugg.com/p"><img src="x.png" alt=""></a><div><span>' + title + '</span></div><div>$130.00</div><div aria-label="From ' + seller + '">' + seller + '</div><span aria-label="Rated 4.6 out of 5, (3k+) user reviews">(3k+)</span></div></div>').querySelector('.pla-unit');
const cls = el => A.classifyAd(A.adParts(el), { sensitivity: 'med' }, C.classify, C.LABEL_W);
test('adParts skips empty template aria-labels and uses the full tile title', () => {
  const p = A.adParts(tile("UGG Women's Tasman II Sheepskin Slippers in Chestnut, Size 8", 'UGG US'));
  assert.match(p.headline, /Tasman II Sheepskin Slippers/); assert.doesNotMatch(p.headline, /^\s*for\s/);
  assert.doesNotMatch(p.snippet, / for {2}from/);
});
test('material words in PLA titles give a non-vegan verdict', () => {
  for (const t of ["UGG Women's Tasman II Sheepskin Slippers in Chestnut, Size 8", 'UGG Loria Clog | Women\'s | Sand Suede | Size 7 | Clogs', "UGG Women's Chestnut Ultra Mini Bailey Bow Boots | Suede Sheepskin Lining"])
    assert.equal(cls(tile(t, 'DSW')).verdict, 'nonvegan', t);
  assert.notEqual(cls(tile('Faux Sheepskin Slippers, Size 8', 'Target')).verdict, 'nonvegan');
  assert.notEqual(cls(tile('Vegan sheepskin-free slide, Size 8', 'Target')).verdict, 'nonvegan');
});
test('style knowledge: sourced UGG styles -> caution "likely not vegan: sheepskin", never certain', () => {
  const c = C.shopCaution("UGG Women's Classic Ultra Mini Boot, Chestnut $165.00 UGG US");
  assert.equal(c.kind, 'sheepskin'); assert.match(c.text, /^likely not vegan: sheepskin/); assert.match(c.source, /^https:\/\/www\.ugg\.com\//);
  assert.notEqual(cls(tile("UGG Women's Classic Ultra Mini Boot, Chestnut", 'UGG US')).verdict, 'nonvegan'); // no material text -> not certain
  assert.equal(C.shopCaution('Classic Ultra Mini fan art poster $20'), null); // brand required
  assert.equal(C.shopCaution('UGG Classic Ultra Mini vegan dupe $40'), null);
  for (const s of C.STYLE_MATERIALS) { assert.match(s.source, /^https:\/\/www\.ugg\.com\//); assert.ok(s.material && s.style); }
  assert.ok(C.STYLE_MATERIALS.length <= 10, 'keep the style list small');
});
test('web.js: neutral sponsored product tiles still get the caution pill', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'web.js'), 'utf8'), /verdict === 'neutral'\) \{ cautionPill\(el\); return; \}/);
});
