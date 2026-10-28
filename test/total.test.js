const test = require('node:test'), assert = require('node:assert');
const T = require('../total.js'), fs = require('fs');
const run = (reports, tab) => { let total = 0; for (const [url, src, n, off] of reports) { const r = T.applyReport(tab, url, src, { nonvegan: n }, off); tab = r.tab; total += r.delta; } return { total, tab }; };
test('repeated identical reports count once', () => assert.strictEqual(run([['https://a.com/x', 'web:0', 3], ['https://a.com/x', 'web:0', 3], ['https://a.com/x', 'web:0', 3]]).total, 3));
test('only positive deltas count (rechecks/re-renders dip and recover)', () => assert.strictEqual(run([['https://a.com/x', 'web:0', 3], ['https://a.com/x', 'web:0', 1], ['https://a.com/x', 'web:0', 3], ['https://a.com/x', 'web:0', 5]]).total, 5));
test('new URL resets the mark', () => assert.strictEqual(run([['https://a.com/x', 'web:0', 3], ['https://a.com/y', 'web:0', 2]]).total, 5));
test('hash change is the same page', () => assert.strictEqual(run([['https://a.com/x', 'web:0', 3], ['https://a.com/x#c', 'web:0', 3]]).total, 3));
test('sources tracked separately', () => assert.strictEqual(run([['https://a.com/x', 'web:0', 2], ['https://a.com/x', 'web:3', 4], ['https://a.com/x', 'web:0', 2]]).total, 6));
test('disabled pages do not count', () => assert.strictEqual(run([['https://a.com/x', 'web:0', 3, true]]).total, 0));
test('bad input is safe', () => { assert.strictEqual(T.applyReport(undefined, 'x', 's', null).delta, 0); assert.strictEqual(T.applyReport(undefined, 'x', 's', { nonvegan: -4 }).delta, 0); });
test('addToTotal sets since once', () => {
  let s = T.addToTotal(undefined, 0, 1); assert.deepStrictEqual(s, { count: 0, since: null });
  s = T.addToTotal(s, 2, 100); s = T.addToTotal(s, 3, 200); assert.deepStrictEqual(s, { count: 5, since: 100 });
});
test('reset clears count and since', () => { const r = T.resetTotal(); assert.deepStrictEqual(T.addToTotal(r, 0, 9), { count: 0, since: null }); assert.deepStrictEqual(T.addToTotal(r, 1, 9), { count: 1, since: 9 }); });
test('popup shows version and total UI', () => {
  const h = fs.readFileSync(__dirname + '/../popup.html', 'utf8'), j = fs.readFileSync(__dirname + '/../popup.js', 'utf8');
  assert.match(h, /id="version"/); assert.match(h, /Non-vegan items detected/); assert.match(h, /id="resetTotal"/);
  assert.match(j, /getManifest\(\)\.version/); assert.match(j, /confirm\(/);
});
test('versions agree at 0.4.9 and background loads total.js', () => {
  assert.strictEqual(require('../manifest.json').version, '0.4.9'); assert.strictEqual(require('../package.json').version, '0.4.9');
  assert.match(fs.readFileSync(__dirname + '/../background.js', 'utf8'), /importScripts\([^)]*'total\.js'/);
});
