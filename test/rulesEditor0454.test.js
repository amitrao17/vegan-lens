'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const R = require('../rules/rules.js');
const clone = o => JSON.parse(JSON.stringify(o));
test('local edits take precedence over bundled and remote, and notify listeners', () => {
  R.reset(); const b = clone(R.active()); b.listVersion = '2000.01.01.1';
  let n = 0; R.onChange(() => n++);
  const r = R.useLocal(b); assert.ok(r.ok, r.error); assert.strictEqual(R.info().source, 'local'); assert.ok(R.info().localActive);
  assert.strictEqual(R.info().listVersion, '2000.01.01.1'); assert.ok(n >= 1);
  const newer = clone(b); newer.listVersion = '2999.01.01.1';
  R.useStored({ payload: JSON.stringify(newer) }); assert.strictEqual(R.info().source, 'local', 'remote must not override local');
  R.useLocal(null); assert.strictEqual(R.info().source, 'updated');
  R.reset(); assert.strictEqual(R.info().source, 'bundled');
});
test('invalid local edits are rejected with a path and leave the active list alone', () => {
  R.reset(); const b = clone(R.active());
  const k = Object.keys(b.data)[0]; b.data[k] = 5;
  const r = R.useLocal(b); assert.strictEqual(r.ok, false); assert.match(r.error, new RegExp(k));
  assert.strictEqual(R.info().source, 'bundled');
  const c = clone(R.active()); const s = JSON.stringify(c).replace(/"\$re":"[^"]*"/, '"$re":"(a+)+"');
  const r2 = R.useLocal(JSON.parse(s)); assert.strictEqual(r2.ok, false); assert.strictEqual(R.info().source, 'bundled');
});
test('editor page, popup link and manifest wiring', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'rules-editor.html'), 'utf8');
  for (const id of ['validate', 'apply', 'export', 'import', 'reset', 'json']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(/rulesData\.js[\s\S]*rules\.js[\s\S]*rules-editor\.js/.test(html));
  assert.ok(!/<script>/.test(html), 'no inline script (MV3 CSP)');
  const js = fs.readFileSync(path.join(root, 'rules-editor.js'), 'utf8');
  assert.ok(js.includes('window.vlRulesEditor') && !/fetch\(|XMLHttpRequest/.test(js), 'dev hook, no network');
  assert.ok(fs.readFileSync(path.join(root, 'popup.html'), 'utf8').includes('id="editRules"'));
  assert.ok(fs.readFileSync(path.join(root, 'popup.js'), 'utf8').includes('Local edits active'));
});
