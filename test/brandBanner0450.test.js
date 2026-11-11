// 0.4.50: brand-site banner on a manufacturer's own website.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const BS = require('../brandSites.js'); const B = require('../brand.js'); const SW = require('../swaps.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
function fakeDoc() {
  const mk = tag => ({ tagName: tag.toUpperCase(), attrs: {}, children: [], className: '', ownerDocument: doc,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    addEventListener() {}, append(...n) { this.children.push(...n); }, prepend(...n) { this.children.unshift(...n); },
    get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent || '').join('') + (this._t || ''); },
    set textContent(v) { this.children = []; this._t = String(v); } });
  const doc = { createElement: mk }; return doc;
}
const find = (el, cls) => el.children.find(c => typeof c === 'object' && (c.className || '').split(' ').includes(cls));
test('domain matching: exact, www., shop. subdomains; not lookalikes', () => {
  assert.equal(BS.match('oatly.com').brand, 'Oatly');
  assert.equal(BS.match('www.oatly.com').brand, 'Oatly');
  assert.equal(BS.match('shop.miyokos.com').brand, "Miyoko's Creamery");
  assert.equal(BS.match('WWW.OmahaSteaks.com').verdict, 'nonvegan');
  assert.equal(BS.match('notoatly.com'), null); assert.equal(BS.match('oatly.com.evil.io'), null);
  assert.equal(BS.match('example.com'), null); assert.equal(BS.match(''), null);
});
test('retailers never match, even with brand-ish paths/hosts', () => {
  for (const h of ['www.amazon.com', 'amazon.co.uk', 'www.walmart.com', 'www.target.com', 'www.sephora.com', 'www.ulta.com', 'www.ebay.com', 'www.instacart.com'])
    { assert.ok(BS.isRetailer(h), h); assert.equal(BS.match(h), null, h); }
  assert.equal(BS.isRetailer('www.oatly.com'), false); assert.equal(BS.isRetailer('amazonia-tours.com'), false);
});
test('wording per audience: vegan/flexitarian/omni; soft wording never judges', () => {
  const v = BS.match('oatly.com'), n = BS.match('omahasteaks.com');
  assert.equal(BS.bannerText(v, 'vegan'), 'Every product from this brand is vegan');
  assert.match(BS.bannerText(v, 'omni'), /plant-based/);
  assert.equal(BS.bannerText(n, 'vegan'), 'Looking for plant-based options? Here are some swaps');
  const all = ['vegan', 'flexitarian', 'omni', 'bogus'].map(a => BS.bannerText(n, a));
  assert.notEqual(all[1], all[0]); assert.notEqual(all[2], all[0]); assert.equal(all[3], all[0]);
  for (const t of all) assert.doesNotMatch(t, /not vegan|cruel|avoid|bad|kill|warning/i);
});
test('soft strip links a category-level swap search with no brand claim', () => {
  const u = BS.swapLink(BS.match('omahasteaks.com'), SW);
  assert.match(decodeURIComponent(u), /plant-based steak/); assert.doesNotMatch(u, /omaha/i);
});
test('build(): branded via mark(), green vs soft class, source link, dismiss button', () => {
  const d = fakeDoc();
  const g = BS.build(d, BS.match('www.elfcosmetics.com'), 'vegan', { brand: B, swaps: SW });
  assert.match(g.className, /vl-brand-vegan/); assert.equal(g.getAttribute('data-vl-attr'), '1');
  assert.match(g.textContent, /^Vegan Lens · Every product from this brand is vegan/);
  assert.equal(g.getAttribute('title'), 'Added by Vegan Lens extension');
  assert.match(find(g, 'vl-brand-link').getAttribute('href'), /^https:\/\/www\.elfcosmetics\.com\//);
  assert.ok(find(g, 'vl-brand-close'));
  const s = BS.build(d, BS.match('omahasteaks.com'), 'omni', { brand: B, swaps: SW });
  assert.match(s.className, /vl-brand-soft/); assert.match(s.textContent, /^Vegan Lens · Curious about plant-based/);
  assert.match(find(s, 'vl-brand-link').getAttribute('href'), /google\.com\/search\?q=plant-based/);
});
test('dismissal is per site (registrable domain) and remembered as a list', () => {
  const o = BS.match('oatly.com'), m = BS.match('miyokos.com');
  let list = BS.dismiss([], o); list = BS.dismiss(list, o);
  assert.deepEqual(list, ['oatly.com']); assert.ok(BS.isDismissed(list, BS.match('www.oatly.com'))); assert.ok(!BS.isDismissed(list, m));
  const src = R('brandSites.js');
  assert.match(src, /chrome\.storage\.local\.set\(\{ \[DISMISS_KEY\]/); assert.equal(BS.DISMISS_KEY, 'brandBannerDismissed');
});
test('data: every vegan entry has an https source + name; 15-30 vegan brands; tiny non-vegan set; unique domains', () => {
  const v = BS.SITES.filter(s => s.verdict === 'vegan'), n = BS.SITES.filter(s => s.verdict === 'nonvegan');
  assert.ok(v.length >= 15 && v.length <= 30, String(v.length)); assert.ok(n.length >= 1 && n.length <= 3);
  for (const s of BS.SITES) { assert.match(s.source, /^https:\/\//, s.brand); assert.ok(s.sourceName && s.sourceName.length > 3, s.brand); assert.ok(!BS.isRetailer(s.domain), s.domain); }
  assert.equal(new Set(BS.SITES.map(s => s.domain)).size, BS.SITES.length);
  for (const c of ['food', 'cosmetics', 'fashion']) assert.ok(v.some(s => s.cat === c), c);
});
test('settings + wiring: toggle default on, respects global/site/page off, loaded in the web group', () => {
  const src = R('brandSites.js');
  assert.match(src, /!S\.webEnabled \|\| !S\.brandBanners/); assert.match(src, /siteBlocked\(S\.siteBlock/); assert.match(src, /isPageDisabled\(S\.pageBlock/);
  assert.match(R('popup.html'), /Brand site banners[\s\S]*id="brandBanners"/); assert.match(R('popup.js'), /brandBanners: true/); assert.match(R('popup.js'), /'brandBanners'/);
  const m = JSON.parse(R('manifest.json')); const g = m.content_scripts.find(c => c.js.includes('web.js'));
  assert.ok(g.js.indexOf('brandSites.js') > g.js.indexOf('brand.js') && g.js.indexOf('brandSites.js') < g.js.indexOf('web.js'));
  assert.match(R('web.css'), /#vl-brand-banner\{position:fixed/);
});
