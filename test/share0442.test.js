// 0.4.42 share feature: message template, hashtag on public destinations only, URL encoding, trimming, empty list, stats allow-list.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const S = require('../share.js');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const ITEM = { title: 'Boots & Bags #1 🥾 "Classic"', verdict: 'real leather', url: 'https://shop.example/p?id=1&c=a b#top', swap: 'https://www.google.com/search?q=vegan%20boots' };
const qs = (u, k) => new URL(u).searchParams.get(k);

test('template with swap link and no STORE_URL', () => {
  assert.strictEqual(S.STORE_URL, '');
  assert.strictEqual(S.buildMessage(ITEM), 'Heads up: Boots & Bags #1 🥾 "Classic" \u2014 real leather. Vegan swap: https://www.google.com/search?q=vegan%20boots. https://shop.example/p?id=1&c=a b#top. Found with Vegan Lens');
});
test('template without swap, with a store URL', () => {
  const m = S.buildMessage({ ...ITEM, swap: '' }, { storeUrl: 'https://chromewebstore.google.com/detail/x' });
  assert.doesNotMatch(m, /Vegan swap/); assert.match(m, /Found with Vegan Lens https:\/\/chromewebstore\.google\.com\/detail\/x$/);
});
test('non-http links are dropped', () => {
  const m = S.buildMessage({ title: 'x', verdict: 'y', url: 'javascript:alert(1)', swap: 'data:x' });
  assert.doesNotMatch(m, /javascript|data:/);
});
test('hashtag only on public destinations', () => {
  const m = S.buildMessage(ITEM);
  for (const d of ['x', 'facebook', 'linkedin', 'telegram']) assert.match(S.destination(d, ITEM, m).text, / #VeganLens$/, d);
  assert.match(qs(S.destination('reddit', ITEM, m).url, 'title'), / #VeganLens$/);
  for (const d of ['copy', 'email', 'whatsapp', 'native']) assert.doesNotMatch(S.destination(d, ITEM, m).text, /#VeganLens/, d);
  assert.strictEqual(S.withTag('already #VeganLens', 'x'), 'already #VeganLens');
  for (const [d, o] of Object.entries(S.DESTS)) assert.strictEqual(typeof o.public, 'boolean', d);
});
test('URL encoding round-trips for every destination', () => {
  const m = S.buildMessage(ITEM) + ' & more # 100% 🌱';
  const tag = d => S.withTag(m, d);
  assert.strictEqual(qs(S.destination('x', ITEM, m).url, 'text'), tag('x'));
  assert.strictEqual(qs(S.destination('whatsapp', ITEM, m).url, 'text'), m);
  const fb = S.destination('facebook', ITEM, m); assert.strictEqual(qs(fb.url, 'u'), ITEM.url); assert.strictEqual(fb.copy, tag('facebook')); assert.match(fb.note, /copied/);
  const rd_ = S.destination('reddit', ITEM, m).url; assert.strictEqual(qs(rd_, 'url'), ITEM.url); assert.match(qs(rd_, 'title'), /^Vegan Lens find: Boots & Bags #1 🥾/);
  const tg = S.destination('telegram', ITEM, m).url; assert.strictEqual(qs(tg, 'url'), ITEM.url); assert.match(qs(tg, 'text'), / & more # 100% 🌱 #VeganLens$/); assert.ok(!qs(tg, 'text').includes(ITEM.url));
  assert.strictEqual(qs(S.destination('linkedin', ITEM, m).url, 'url'), ITEM.url);
  assert.ok(S.destination('linkedin', ITEM, m).url.startsWith('https://www.linkedin.com/sharing/share-offsite/?url='));
  const em = S.destination('email', ITEM, m).mailto; assert.ok(em.startsWith('mailto:?subject='));
  const sp = new URLSearchParams(em.slice('mailto:?'.length)); assert.strictEqual(sp.get('subject'), 'Vegan Lens find: ' + ITEM.title); assert.strictEqual(sp.get('body'), m);
  for (const d of ['x', 'facebook', 'reddit', 'whatsapp', 'telegram', 'linkedin']) { const u = S.destination(d, ITEM, m).url; assert.doesNotMatch(u.split('?')[1], /[ #🥾]/u, d); }
  assert.strictEqual(S.destination('copy', ITEM, m).copy, m);
  assert.strictEqual(S.destination('native', ITEM, m).native.url, ITEM.url);
  assert.strictEqual(S.destination('nope', ITEM, m), null);
});
test('title trimming', () => {
  const long = 'Word '.repeat(40);
  const t = S.trimTitle(long); assert.ok(t.length <= 100, t.length); assert.ok(t.endsWith('…'));
  assert.strictEqual(S.trimTitle('  a\n  b  '), 'a b');
  assert.strictEqual(S.normItem({}).title, 'this item');
  assert.ok(S.buildMessage({ title: 'x'.repeat(300), verdict: 'v' }).length < 200);
});
test('empty item list', () => {
  const doc = { querySelectorAll: () => [] };
  assert.deepStrictEqual(S.collectItems(doc, 'https://a.example/'), []);
});
test('collectItems reads flagged units, caps at 20, uses item link', () => {
  const unit = i => ({ dataset: { vlW: 'nonvegan', vlWhy: 'about steak', vlSwap: i ? '' : 'https://www.google.com/search?q=x' }, parentElement: null, matches: () => false,
    querySelector: s => (/a\[href\]/.test(s) ? { innerText: 'Steak night ' + i, href: '/p/' + i, getAttribute: () => '/p/' + i } : null), getAttribute: () => null });
  const doc = { querySelectorAll: () => Array.from({ length: 30 }, (_, i) => unit(i)) };
  const items = S.collectItems(doc, 'https://a.example/list');
  assert.strictEqual(items.length, 20);
  assert.deepStrictEqual(items[0], { title: 'Steak night 0', verdict: 'about steak', url: 'https://a.example/p/0', swap: 'https://www.google.com/search?q=x' });
});
test('stats allow-list: sharesClicked in extension and worker, destination only', () => {
  assert.match(rd('telemetry/worker.js'), /'sharesClicked'/);
  const b = rd('background.js'); const src = b.slice(b.indexOf('const SHARE_DESTS'), b.indexOf('let statsChain'));
  const sb = { chrome: { runtime: { getManifest: () => ({ version: 't' }) } } }; vm.createContext(sb);
  vm.runInContext('const round5 = n => Math.round(n / 5) * 5;' + src + ';this.r = buildReport({ day: "2026-10-30", counts: {}, reveals: 0, shares: { x: 7, copy: 2, "https://evil": 9 } }, {});', sb);
  assert.deepStrictEqual({ ...sb.r.sharesClicked }, { x: 5, copy: 0 });
  assert.match(b, /msg\.k === 'share' && SHARE_DESTS\.includes\(msg\.dest\)/);
});
test('wiring: manifest, popup, permissions', () => {
  const m = require('../manifest.json');
  assert.ok(m.permissions.includes('contextMenus')); assert.ok(!m.permissions.includes('clipboardWrite')); assert.ok(!m.permissions.includes('tabs'));
  for (const c of m.content_scripts) if (!c.js.includes('search.js')) assert.ok(c.js.includes('share.js'));
  assert.match(rd('popup.html'), /id="shareItems"/); assert.match(rd('popup.html'), /share\.js/); assert.match(rd('popup.html'), /Nothing is sent until you press a destination/);
  assert.match(rd('CHROMEWEBSTORE.md'), /\| contextMenus \|/);
});
