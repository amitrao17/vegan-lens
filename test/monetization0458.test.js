'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const R = require('../rules/rules.js'); const SW = require('../swaps.js');
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
function withTag(tag, extra) {
  const b = JSON.parse(JSON.stringify(R.active())); b.listVersion = '2026.10.30.91';
  b.data.monetization.affiliate.amazon.tag = tag; Object.assign(b.data.monetization, extra || {});
  return R.useLocal(b);
}
const fakeA = href => ({ href, title: 'Vegan Lens suggestion', rel: 'noopener', dataset: {} });
test.afterEach(() => { R.useLocal(null); R.reset(); });

test('bundled list ships inactive: empty tag and supportUrl', () => {
  const m = R.active().data.monetization;
  assert.equal(m.affiliate.amazon.tag, ''); assert.equal(m.supportUrl, '');
  assert.equal(SW.affiliateConfigured(), false); assert.equal(SW.supportUrl(), '');
});
test('tag empty -> VL links unchanged', () => {
  const u = SW.swapUrl('https://www.amazon.com', 'vegan boots');
  assert.equal(SW.affiliateUrl(u, {}), u);
  const a = fakeA(u); assert.equal(SW.tagLink(a, {}), false); assert.equal(a.href, u); assert.doesNotMatch(a.title, /Associate/);
});
test('tag set -> VL-created Amazon links get the tag, with disclosure in the title', () => {
  assert.ok(withTag('veganlens-20').ok);
  const u = SW.storeSearchUrl('https://www.amazon.co.uk/dp/B01', 'vegan boots');
  const a = fakeA(u); assert.equal(SW.tagLink(a, {}), true);
  assert.equal(new URL(a.href).searchParams.get('tag'), 'veganlens-20');
  assert.match(a.title, /As an Amazon Associate/); assert.match(a.rel, /sponsored/);
  assert.equal(new URL(SW.affiliateUrl(SW.swapUrl('https://www.amazon.com', 'x'), {})).searchParams.get('tag'), 'veganlens-20');
});
test('non-Amazon, look-alike, http, and already-tagged links are never touched', () => {
  assert.ok(withTag('veganlens-20').ok);
  for (const u of ['https://www.google.com/search?q=vegan', 'https://www.zappos.com/search?term=x', 'https://amazon.com.evil.example/s?k=x',
    'http://www.amazon.com/s?k=x', 'https://www.amazon.com/s?k=x&tag=someone-21']) assert.equal(SW.affiliateUrl(u, {}), u, u);
});
test('toggle off -> no tag, no disclosure', () => {
  assert.ok(withTag('veganlens-20').ok);
  const u = SW.swapUrl('https://www.amazon.com', 'x'); const a = fakeA(u);
  assert.equal(SW.affiliateActive({ affiliate: false }), false); assert.equal(SW.tagLink(a, { affiliate: false }), false); assert.equal(a.href, u);
});
test('only VL-created links are tagged: callers are the swap pill, Try: link and search chip; no auto-rewrite, no site links', () => {
  assert.match(src('content.js'), /a\.textContent = sw\.label; if \(W\.tagLink\) W\.tagLink\(a, S\)/);
  assert.match(src('web.js'), /className = 'vl-w-swap'[\s\S]{0,600}SW\.tagLink\(a, S\)/);
  const s = src('search.js'); assert.match(s, /link\(withQ\(rw\), rw \+ ' →'\); if \(SW && SW\.tagLink\) SW\.tagLink\(a, S\)/);
  assert.match(s, /location\.replace\(withQ\(rw\)\)/, 'auto-rewrite navigation stays untagged');
  for (const f of ['content.js', 'web.js', 'search.js', 'marketplace.js', 'background.js']) assert.equal((src(f).match(/tagLink|affiliateUrl/g) || []).length, f === 'search.js' || f === 'web.js' || f === 'content.js' ? (f === 'content.js' ? 2 : 2) : 0, f);
  assert.doesNotMatch(src('swaps.js'), /fetch\(|XMLHttpRequest|sendBeacon/);
});
test('schema: bad tag / non-https supportUrl rejected; older lists without monetization still load', () => {
  assert.equal(withTag('bad tag"><').ok, false);
  assert.equal(withTag('', { supportUrl: 'javascript:alert(1)' }).ok, false);
  assert.equal(withTag('', { supportUrl: 'http://x.example' }).ok, false);
  const old = JSON.parse(JSON.stringify(R.active())); old.listVersion = '2026.10.30.92'; delete old.data.monetization;
  assert.ok(R.useLocal(old).ok); assert.equal(R.active().data.monetization.affiliate.amazon.tag, '');
});
test('supportUrl hidden when empty, shown when set; popup hides toggle + disclosure until a tag exists', () => {
  assert.ok(withTag('', { supportUrl: 'https://example.org/support' }).ok); assert.equal(SW.supportUrl(), 'https://example.org/support');
  R.useLocal(null); R.reset(); assert.equal(SW.supportUrl(), '');
  const h = src('popup.html');
  assert.match(h, /id="affiliateRow" hidden/); assert.match(h, /id="affiliateDisclosure" hidden/); assert.match(h, /id="supportRow" hidden><a id="supportLink" target="_blank" rel="noopener noreferrer">/);
  const j = src('popup.js'); assert.match(j, /row\.hidden = !on/); assert.match(j, /d\.hidden = !SW\.affiliateActive\(s\)/); assert.match(j, /r\.hidden = !u/);
  assert.match(src('popup.css'), /\.row\[hidden\]\{display:none\}/);
});
