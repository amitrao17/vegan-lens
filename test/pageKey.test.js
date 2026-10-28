const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const P = require('../pageKey.js');
test('pageKey strips query and hash', () => assert.strictEqual(P.pageKey('https://ex.com/a/b?x=1#h'), 'https://ex.com/a/b'));
test('pageKey keeps port and root path', () => assert.strictEqual(P.pageKey('http://ex.com:8080'), 'http://ex.com:8080/'));
test('pageKey rejects non-http and junk', () => { assert.strictEqual(P.pageKey('chrome://extensions'), null); assert.strictEqual(P.pageKey('nope'), null); });
test('togglePage adds then removes', () => {
  const a = P.togglePage([], 'https://ex.com/p?q=1'); assert.deepStrictEqual(a, ['https://ex.com/p']);
  assert.deepStrictEqual(P.togglePage(a, 'https://ex.com/p#x'), []);
});
test('togglePage does not mutate input and ignores bad urls', () => { const l = ['x']; assert.deepStrictEqual(P.togglePage(l, 'about:blank'), ['x']); P.togglePage(l, 'https://a.com/'); assert.deepStrictEqual(l, ['x']); });
test('isPageDisabled is per page', () => {
  const l = ['https://ex.com/p'];
  assert.ok(P.isPageDisabled(l, 'https://ex.com/p?z'));
  assert.ok(!P.isPageDisabled(l, 'https://ex.com/other'));
  assert.ok(!P.isPageDisabled(l, 'http://ex.com/p'));
  assert.ok(!P.isPageDisabled(undefined, 'https://ex.com/p'));
});
test('isDisabled also honors site blocklist incl. subdomains', () => {
  assert.ok(P.isDisabled({ siteBlock: ['ex.com'] }, 'https://www.news.ex.com/x'));
  assert.ok(!P.isDisabled({ siteBlock: ['ex.com'] }, 'https://notex.com/x'));
  assert.ok(P.isDisabled({ pageBlock: ['https://a.com/'] }, 'https://a.com/'));
  assert.ok(!P.isDisabled({}, 'https://a.com/'));
});
test('iconPaths: red variants exist for every size', () => {
  const g = P.iconPaths(false), r = P.iconPaths(true), m = require('../manifest.json');
  assert.deepStrictEqual(Object.keys(g).sort(), Object.keys(m.action.default_icon).sort());
  for (const s in r) { assert.ok(r[s].endsWith('-red.png')); assert.ok(fs.existsSync(path.join(__dirname, '..', r[s]))); assert.strictEqual(g[s], m.action.default_icon[s]); }
});
test('manifest loads pageKey.js before every content script', () => {
  for (const c of require('../manifest.json').content_scripts) assert.strictEqual(c.js[0], 'pageKey.js');
});
