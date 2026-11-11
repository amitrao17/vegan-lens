'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const R = require('../rules/rules.js'); const C = require('../contentClassifier.js');
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const H = { host: 'www.ugg.com' };
test('local rule edit flips a result and reset restores it (classifier re-applies on onChange)', () => {
  R.reset(); assert.equal(C.shopCaution('Bestseller Lowmel $150', H), null);
  const b = JSON.parse(JSON.stringify(R.active())); b.listVersion = '2026.10.30.90';
  b.data.classifier.STYLE_MATERIALS.push({ brand: 'UGG', brandRe: { $re: '\\bugg\\b', flags: 'i' }, style: 'Lowmel (test)', re: { $re: '\\blowmel\\b', flags: 'i' }, material: 'test material', source: 'local test', domain: 'ugg.com' });
  assert.ok(R.useLocal(b).ok);
  assert.match(C.shopCaution('Bestseller Lowmel $150', H).text, /test material/);
  R.useLocal(null); R.reset();
  assert.equal(C.shopCaution('Bestseller Lowmel $150', H), null);
});
test('web.js re-scans open tabs on rule changes: debounced undo() + scan(document)', () => {
  const s = src('web.js'); const i = s.indexOf('VR.onChange(');
  assert.ok(i > 0, 'web.js subscribes to VeganRules.onChange');
  const body = s.slice(i, i + 220);
  assert.match(body, /clearTimeout\(rulesTimer\)/); assert.match(body, /setTimeout\(/); assert.match(body, /undo\(\);\s*if \(active\(\)\) scan\(document\)/);
  assert.match(s, /function undo\(\)[\s\S]*?pageDone = false/, 'undo resets pageDone so the product/article banner is redone');
});
test('marketplace.js re-runs on rule changes', () => {
  const s = src('marketplace.js'); const i = s.indexOf('VeganRules.onChange(');
  assert.ok(i > 0); assert.match(s.slice(i, i + 200), /clearAll\(\);\s*run\(\)/);
});
