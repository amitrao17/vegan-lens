const test = require('node:test'); const assert = require('node:assert');
const V = require('../veganBrands.js'); const C = require('../contentClassifier.js'); const B = require('../brandSites.js');
function fakeDoc() {
  const mk = tag => ({ tagName: tag.toUpperCase(), attrs: {}, children: [], className: '', ownerDocument: doc,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    addEventListener() {}, append(...n) { this.children.push(...n); }, prepend(...n) { this.children.unshift(...n); },
    get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent || '').join('') + (this._t || ''); },
    set textContent(v) { this.children = []; this._t = String(v); } });
  const doc = { createElement: mk }; return doc;
}
test('picks: every entry has brand-page source + collection', () => {
  for (const p of V.PICKS) { assert.match(p.source, new RegExp('^https://[^/]*' + p.domain.replace('.', '\\.'))); assert.ok(p.collection.includes(p.domain)); }
});
test('pick products are vegan, regular products are not', () => {
  for (const t of ['Dr. Martens Vegan 1460 Felix Rub Off Boots', "Hellmann's Plant Based Mayo", "Ben & Jerry's Non-Dairy Chocolate Fudge Brownie", 'Magnum Non-Dairy Classic', 'Garnier Micellar Cleansing Water All-in-1']) assert.equal(C.classify(t).verdict, 'vegan', t);
  for (const t of ['Dr. Martens 1460 Smooth Leather Boots', "Hellmann's Real Mayonnaise"]) assert.equal(C.classify(t).verdict, 'nonvegan', t);
  assert.equal(V.pick('Trojan Magnum Non-Dairy condoms'), null); assert.equal(V.pick('Dr. Martens 1460 not vegan'), null);
});
test('mixed brand strip on brand site, not on retailers', () => {
  const e = B.match('www.drmartens.com'); assert.equal(e.verdict, 'mixed'); assert.match(e.source, /vegan-footwear/);
  assert.equal(B.match('www.amazon.com'), null); assert.equal(B.match('oatly.com').verdict, 'vegan');
  assert.match(B.bannerText(e, 'vegan'), /^This brand has a vegan line/); assert.match(B.bannerText(e, 'flexitarian'), /plant-based line/); assert.match(B.bannerText(e, 'omni'), /plant-based line/);
  const doc = fakeDoc();
  const b = B.build(doc, e, 'vegan', { brand: { mark() {} } });
  assert.match(b.className, /vl-brand-vegan/); assert.match(b.className, /vl-brand-mixed/);
});
