const test = require('node:test');
const assert = require('node:assert');
const A = require('../adUnits.js');
const C = require('../contentClassifier.js');
// Fake DOM with a tiny compound-selector matcher: tag, #id, .class, [attr], [attr=v], [attr^=v], [attr*=v i]; comma lists.
function matchOne(e, sel) {
  const re = /^([a-z0-9-]+|\*)?((?:#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?)*)$/i;
  const m = sel.trim().match(re); if (!m) return false;
  if (m[1] && m[1] !== '*' && e.tagName !== m[1].toUpperCase()) return false;
  for (const p of m[2].match(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?/g) || []) {
    if (p[0] === '#') { if (e.attrs.id !== p.slice(1)) return false; }
    else if (p[0] === '.') { if (!(e.attrs.class || '').split(' ').includes(p.slice(1))) return false; }
    else if (p[0] === ':') { if (p.startsWith(':not')) { if (matchOne(e, p.slice(5, -1))) return false; } }
    else { const a = p.slice(1, -1).match(/^([\w-]+)(?:([\^*]?=)["']?([^"'\]]*?)["']?(\s+i)?)?$/); const v = e.attrs[a[1]];
      if (v == null) return false; if (!a[2]) continue;
      const [x, y] = a[4] ? [String(v).toLowerCase(), a[3].toLowerCase()] : [String(v), a[3]];
      if (a[2] === '=' ? x !== y : a[2] === '^=' ? !x.startsWith(y) : !x.includes(y)) return false; }
  }
  return true;
}
const splitSel = s => s.split(/,(?![^\[]*\])/);
function el(tag, kids = [], attrs = {}) {
  if (typeof kids === 'string') kids = [kids];
  const n = { tagName: tag.toUpperCase(), attrs, parentElement: null, getAttribute: k => attrs[k] ?? null };
  n.kids = kids.filter(k => typeof k !== 'string'); n.kids.forEach(k => k.parentElement = n);
  Object.defineProperty(n, 'textContent', { get: () => kids.map(k => typeof k === 'string' ? k : k.textContent).join(' ') });
  Object.defineProperty(n, 'childElementCount', { get: () => n.kids.length });
  const all = () => n.kids.flatMap(k => [k, ...k._all()]); n._all = all;
  n.matches = sel => splitSel(sel).some(x => matchOne(n, x));
  n.querySelectorAll = sel => all().filter(e => e.matches(sel));
  n.querySelector = sel => n.querySelectorAll(sel)[0] || null;
  n.closest = sel => { for (let e = n; e; e = e.parentElement) if (e.matches(sel)) return e; return null; };
  return n;
}
const link = (t, href = 'https://x.example/') => el('a', [t], { href });
const S = { sensitivity: 'med', whitelist: [], whitelistDisabled: [] };
const judge = e => A.classifyAd(A.adParts(e), S, C.classify, C.LABEL_W);

test('siteOf', () => {
  assert.strictEqual(A.siteOf('www.google.com'), 'google'); assert.strictEqual(A.siteOf('www.google.co.uk'), 'google');
  assert.strictEqual(A.siteOf('www.bing.com'), 'bing'); assert.strictEqual(A.siteOf('duckduckgo.com'), 'ddg');
  assert.strictEqual(A.siteOf('m.youtube.com'), 'youtube'); assert.strictEqual(A.siteOf('www.amazon.com'), 'amazon');
  assert.strictEqual(A.siteOf('example.org'), null);
});
test('ad label text', () => {
  for (const t of ['Sponsored', 'Ad', ' Ads ', 'Advertisement', 'Sponsored results', 'Promoted', 'Ad ·']) assert.ok(A.isAdLabelText(t), t);
  for (const t of ['Adidas', 'Sponsored by the Gates Foundation, a long sentence', 'Add to cart', '']) assert.ok(!A.isAdLabelText(t), t);
});
test('google: #tads block with text ads is a container, each [data-text-ad] a unit', () => {
  const a1 = el('div', [link('Omaha Steaks - Ribeye Steaks Delivered')], { 'data-text-ad': '1' });
  const a2 = el('div', [link('Cheap flights to Paris')], { 'data-text-ad': '1' });
  const tads = el('div', [el('span', 'Sponsored'), a1, a2], { id: 'tads' });
  assert.strictEqual(A.adRole(tads, 'www.google.com'), 'container');
  assert.strictEqual(A.adRole(a1, 'www.google.com'), 'unit');
  assert.ok(el('div', [], { id: 'bottomads' }).matches(A.selectors('www.google.com').all));
});
test('google shopping PLA carousel: products judged individually', () => {
  const p1 = el('div', [el('img', [], { alt: 'Kerrygold Pure Irish Butter 8oz' }), link('Kerrygold Butter Pure Irish Butter')], { class: 'pla-unit' });
  const p2 = el('div', [link('Oatly Oat Milk Barista Edition')], { class: 'pla-unit' });
  const cu = el('div', [el('span', 'Sponsored'), p1, p2], { class: 'cu-container' });
  assert.strictEqual(A.adRole(cu, 'www.google.com'), 'container');
  assert.strictEqual(judge(p1).verdict, 'nonvegan');
  assert.notStrictEqual(judge(p2).verdict, 'nonvegan');
});
test('bing / duckduckgo / youtube ad selectors', () => {
  const sel = h => A.selectors(h).all;
  assert.ok(el('li', [], { class: 'b_ad' }).matches(sel('www.bing.com')));
  assert.ok(el('div', [], { class: 'b_adTop' }).matches(sel('www.bing.com')));
  assert.ok(el('div', [], { 'data-testid': 'ad' }).matches(sel('duckduckgo.com')));
  assert.ok(el('div', [], { class: 'result result--ad' }).matches(sel('duckduckgo.com')));
  for (const t of ['ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-display-ad-renderer', 'ytd-promoted-video-renderer', 'ytd-companion-slot-renderer', 'ytd-action-companion-ad-renderer'])
    assert.ok(el(t).matches(sel('www.youtube.com')), t);
  assert.ok(!el('ytd-video-renderer').matches(sel('www.youtube.com')));
});
test('generic display ad containers', () => {
  const sel = A.selectors('news.example.com').all;
  for (const n of [el('div', [], { id: 'google_ads_iframe_1' }), el('ins', [], { class: 'adsbygoogle' }), el('div', [], { 'aria-label': 'Advertisement' }), el('div', [], { 'data-ad': 'top' })])
    assert.ok(n.matches(sel));
  assert.ok(!el('div', [], { class: 'article' }).matches(sel));
  // amazon gets its own (content.js) handling, not generic
  assert.ok(!A.selectors('www.amazon.com').itemSel.includes('adsbygoogle'));
});
test('adRootFromLabel climbs to the labelled ad, not nav or the whole page', () => {
  const lab = el('span', 'Sponsored');
  const ad = el('div', [lab, link('Wagyu beef steaks shipped to your door'), el('p', 'Order prime cuts today')]);
  el('main', [el('div', [ad])]);
  assert.strictEqual(A.adRootFromLabel(lab, 'news.example.com'), ad);
  const navLab = el('span', 'Ads'); el('nav', [el('div', [navLab, link('Ads settings and more links')])]);
  assert.strictEqual(A.adRootFromLabel(navLab, 'news.example.com'), null);
  const t = el('span', 'Ad'); const inKnown = el('div', [el('div', [t]), link('Steakhouse')], { 'data-text-ad': '1' });
  assert.strictEqual(A.adRootFromLabel(t, 'www.google.com'), inKnown);
});
test('adParts uses visible text, link labels and img alt; strips Sponsored label; no headline double count', () => {
  const ad = el('div', [el('span', 'Sponsored'), el('h3', 'Fresh Lobster Delivered'), el('a', [], { href: '/x', 'aria-label': 'Shop seafood boxes' }), el('img', [], { alt: 'lobster tail' })]);
  const p = A.adParts(ad);
  assert.strictEqual(p.headline, 'Fresh Lobster Delivered');
  assert.ok(!/sponsored/i.test(p.headline + p.snippet));
  assert.ok(!p.snippet.includes('Fresh Lobster Delivered'));
  assert.ok(p.snippet.includes('Shop seafood boxes'));
  assert.strictEqual(p.alt, 'lobster tail');
  const r = judge(ad); assert.strictEqual(r.verdict, 'nonvegan'); assert.strictEqual(r.topic, 'seafood');
});
test('non-vegan ad copy is caught', () => {
  for (const t of ['Omaha Steaks - Ribeye & Filet Mignon Gift Boxes', 'Crispy Bacon Burgers Near You - Order Now', 'Butcher Box: Grass-fed Beef & Chicken Delivered', 'Fresh milk and eggs from local farms'])
    assert.strictEqual(judge(el('div', [link(t)], { 'data-text-ad': '1' })).verdict, 'nonvegan', t);
});
test('single weak word in ad copy is not enough', () => {
  for (const t of ['Get 20% off Butter-soft sheets', 'Chicken Soup for the Soul books', 'Milk frother - 2 year warranty', 'Shop fish tank filters', 'Turkey vacation packages'])
    assert.notStrictEqual(judge(el('div', [link(t)], { 'data-text-ad': '1' })).verdict, 'nonvegan', t);
});
test('vegan and neutral ads; allowlist respected', () => {
  assert.strictEqual(judge(el('div', [link('Beyond Meat Plant-Based Burgers - Try Today')])).verdict, 'vegan');
  assert.strictEqual(judge(el('div', [link('Cheap Flights to Paris - Book Now')])).verdict, 'neutral');
  const ad = el('div', [link('Acme Creamery cheese and milk sale')]);
  assert.strictEqual(judge(ad).verdict, 'nonvegan');
  const r = A.classifyAd(A.adParts(ad), { ...S, whitelist: ['Acme Creamery'] }, C.classify, C.LABEL_W);
  assert.notStrictEqual(r.verdict, 'nonvegan');
});
test('ads ignore requireHeadline: alt-only animal text still counts when strong', () => {
  const ad = el('div', [el('img', [], { alt: 'Bacon cheeseburger with crispy bacon' }), link('Order now')]);
  assert.strictEqual(A.classifyAd(A.adParts(ad), { ...S, requireHeadline: true }, C.classify, C.LABEL_W).verdict, 'nonvegan');
});
test('amazon sponsored recognition', () => {
  assert.ok(A.isAmazonSponsored(el('div', [], { 'data-component-type': 'sp-sponsored-result', 'data-asin': 'B1' })));
  assert.ok(A.isAmazonSponsored(el('div', [el('span', 'Sponsored', { class: 'puis-sponsored-label-text' })], { 'data-asin': 'B2' })));
  assert.ok(A.isAmazonSponsored(el('div', [el('span', ' Sponsored ')], { 'data-asin': 'B3' })));
  const card = el('div', [], { 'data-asin': 'B4' }); el('div', [el('ol', [el('li', [card])])], { id: 'sp_detail' });
  assert.ok(A.isAmazonSponsored(card));
  assert.ok(A.isAmazonSponsored(el('div', [], { class: 'AdHolder' })));
  assert.ok(!A.isAmazonSponsored(el('div', [el('h2', 'Oat milk 6 pack')], { 'data-asin': 'B5', 'data-component-type': 's-search-result' })));
});
test('chip text', () => {
  assert.strictEqual(A.chipText('nonvegan', 'dairy/eggs'), 'Ad · about dairy/eggs');
  assert.strictEqual(A.chipText('nonvegan', null), 'Ad · about animal products');
});
test('contentClassifier exposes about + LABEL_W', () => {
  assert.ok(C.classify('ribeye steak dinner').about.steak > 0);
  assert.strictEqual(C.LABEL_W['dairy/eggs'], 1.5); assert.strictEqual(C.LABEL_W.steak, 3);
});
test('manifest loads adUnits.js before content.js and web.js', () => {
  const m = require('../manifest.json');
  for (const cs of m.content_scripts) { const i = cs.js.indexOf('adUnits.js');
    for (const f of ['content.js', 'web.js']) if (cs.js.includes(f)) { assert.ok(i >= 0 && i < cs.js.indexOf(f), f); } }
});
