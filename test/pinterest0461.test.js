'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const U = require('../webUnits.js'); const C = require('../contentClassifier.js');
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const alt = (a, q) => U.pinAltHeadline({ headline: '', alt: a, creators: [] }, q, C.classify, {});

test('title-less pin: alt stands in on a non-vegan search when it names the same topic', () => {
  assert.equal(alt('Chicken Quesadillas recipe card with ingredients', 'chicken quesadilla'), 'Chicken Quesadillas recipe card with ingredients');
});
test('title-less pin: no stand-in without a non-vegan query, or for a different topic, or a short/generic alt', () => {
  assert.equal(alt('Chicken Quesadillas recipe card', ''), '');
  assert.equal(alt('Chicken Quesadillas recipe card', 'living room ideas'), '');
  assert.equal(alt('Chicken Quesadillas recipe card', 'vegan quesadilla'), '');
  assert.equal(alt('grilled salmon on a plate', 'chicken quesadilla'), '', 'different topic');
  assert.equal(alt('a plate', 'chicken quesadilla'), '');
  assert.equal(alt('Jason Salmon on stage', 'salmon recipes'), '', 'names never count');
  assert.equal(U.pinAltHeadline({ headline: 'Has A Real Title', alt: 'Chicken Quesadillas' }, 'chicken quesadilla', C.classify, {}), '', 'only for title-less pins');
});
test('search query read only on /search/ pages', () => {
  assert.equal(U.pinSearchQuery({ href: 'https://www.pinterest.com/search/pins/?q=chicken%20quesadilla&rs=typed' }), 'chicken quesadilla');
  assert.equal(U.pinSearchQuery({ href: 'https://www.pinterest.co.uk/someone/board/?q=chicken' }), '');
});
test('web.js uses the stand-in only on Pinterest, before the title-length gate', () => {
  const s = src('web.js'); const i = s.indexOf('U.pinAltHeadline('), j = s.indexOf('if (parts.headline.length < 8) { seen.delete(el); return; }');
  assert.ok(i > 0 && i < j); assert.match(s.slice(i - 60, i), /if \(PIN && parts\.headline\.length < 8\)/);
});
test('every blur carries the green tint (alt-text image blur and dimmed-card images alike)', () => {
  const css = src('web.css'); const r = /\.vl-img-blur,[^{]*\{filter:([^!]*)!important/.exec(css); assert.ok(r);
  assert.match(r[1], /blur\(14px\)/); assert.match(r[1], /sepia\(1\) hue-rotate\(50deg\)/);
  assert.match(css, /\.vl-w-dim-in:has\(>\.vl-w-chip\)>:not\(\.vl-w-chip\)\{filter:[^}]*hue-rotate\(50deg\)/);
});
test('search-assist banner stays pinned to the top (sticky), stays dismissible; YouTube in-column banner not sticky', () => {
  const css = src('search.css');
  assert.match(css, /\.vl-s-banner\{all:initial;display:block;position:sticky;top:0;[^}]*z-index:2147483646/);
  assert.match(css, /\.vl-s-banner\.vl-s-yt\{position:relative/);
  assert.match(src('search.js'), /x\.title = 'Dismiss'/);
  assert.match(src('web.css'), /#vl-brand-banner\{position:fixed!important;[^}]*top:0!important/);
});
