// 0.4.68: product badges (compact + full) never show "Sponsored" or an ad dot.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('versions agree at 0.4.70', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.70');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.70');
});

test('content.js badge copy has no Sponsored prefix and no ad dot', () => {
  const c = R('content.js');
  // Display strings (badge + dim/hide label that shares `why`) never say Sponsored.
  assert.doesNotMatch(c, /Sponsored ·/);
  assert.doesNotMatch(c, /vl-badge-ad/);
  assert.doesNotMatch(c, /ad \? 'Sponsored/);
  assert.match(c, /badge\(el, 'vl-badge-vegan', '🌱 Vegan'/);
  assert.match(c, /badge\(el, 'vl-badge-probably', '🌱 Probably vegan'/);
  assert.match(c, /badge\(el, 'vl-badge-caution', '⚠ Caution: may contain animal products'/);
  assert.match(c, /badge\(el, 'vl-badge-unknown', '\?'/);
  assert.match(c, /const why = 'Not vegan: contains ' \+ r\.matched\.join\(', '\)/);
  // Detection and counting stay.
  assert.match(c, /dataset\.vlAd = '1'/);
  assert.match(c, /isAmazonSponsored|isAd\(/);
  assert.match(c, /v === 'non-vegan' && e\.dataset\.vlAd\) c\.ads\+\+/);
});

test('content.css has no sponsored-dot styles', () => {
  assert.doesNotMatch(R('content.css'), /\.vl-badge-ad\b/);
});

test('CHANGELOG mentions 0.4.68 no Sponsored labels', () => {
  assert.match(R('CHANGELOG.md'), /^## 0\.4\.68 — Badge labels without "Sponsored"/m);
});
