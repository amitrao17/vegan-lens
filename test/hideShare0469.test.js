// 0.4.69: hide the share/feedback arrow on a resting compact pill; show it once the pill expands.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('versions agree at 0.4.70', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.70');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.70');
});

test('compact CSS hides the share arrow at rest and shows it when expanded', () => {
  const css = R('content.css') + R('share.js');
  assert.match(css, /\.vl-badge-compact\s*>\s*\.vl-share-btn\{display:none!important\}/);
  assert.match(css, /\.vl-badge-compact:hover\s*>\s*\.vl-share-btn/);
  assert.match(css, /\.vl-badge-compact:focus\s*>\s*\.vl-share-btn/);
  assert.match(css, /\.vl-badge-compact\.vl-badge-open\s*>\s*\.vl-share-btn/);
  assert.match(css, /display:inline-flex!important/);
  assert.match(R('content.css'), /\.vl-badge\.vl-badge-compact\{[^}]*width:22px/);
});

test('share button is still appended inside the badge (clickable after expand); full style untouched', () => {
  const s = R('share.js');
  assert.match(s, /p\.append\(b\)/);
  assert.match(s, /className = 'vl-share-btn'/);
  assert.match(s, /PILL = '\.vl-w-chip, \.vl-label, \.vl-badge, \.vl-mp-pill'/);
  // Full (non-compact) badges are not targeted by the hide rule alone.
  const hide = /\.vl-badge(?!-compact)\s*>\s*\.vl-share-btn\{display:none/;
  assert.doesNotMatch(R('content.css'), hide);
});

test('CHANGELOG mentions 0.4.69 hidden resting arrow', () => {
  assert.match(R('CHANGELOG.md'), /^## 0\.4\.69 — Hide feedback arrow on resting compact pills/m);
});
