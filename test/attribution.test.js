// 0.4.32: every element Vegan Lens adds to a page must carry attribution (icon16 + "Vegan Lens" + tooltip).
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const B = require('../brand.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
function fakeDoc() {
  const mk = tag => ({ tagName: tag.toUpperCase(), attrs: {}, children: [], className: '', ownerDocument: doc,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; }, addEventListener() {}, append(...n) { this.children.push(...n); }, prepend(...n) { this.children.unshift(...n); },
    get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent || '').join('') + (this._t || ''); },
    set textContent(v) { this.children = []; this._t = String(v); } });
  const doc = { createElement: mk }; return doc;
}
const isIcon = n => n && n.tagName === 'IMG' && /vl-mark-icon/.test(n.className) && n.getAttribute('width') === '16';
test('mark(): icon16 + "Vegan Lens ·" + tooltip', () => {
  const d = fakeDoc(); const el = d.createElement('span'); el.textContent = 'Hidden: about beef';
  B.mark(el, { doc: d });
  assert.ok(isIcon(el.children[0])); assert.match(el.textContent, /^Vegan Lens · Hidden: about beef/);
  assert.equal(el.getAttribute('title'), 'Added by Vegan Lens extension'); assert.equal(el.getAttribute('data-vl-attr'), '1');
});
test('mark(compact): icon + aria-label, no extra text; idempotent; keeps existing title', () => {
  const d = fakeDoc(); const el = d.createElement('span'); el.textContent = '✕ milk'; el.setAttribute('title', 'Matched milk');
  B.mark(el, { compact: true, doc: d }); B.mark(el, { compact: true, doc: d });
  assert.equal(el.children.filter(isIcon).length, 1); assert.doesNotMatch(el.textContent, /Vegan Lens ·/);
  assert.match(el.getAttribute('aria-label'), /^Added by Vegan Lens: /); assert.match(el.getAttribute('title'), /^Vegan Lens: Matched milk — Added by Vegan Lens extension$/);
});
test('mark(): no duplicate "Vegan Lens" prefix when text already names it', () => {
  const d = fakeDoc(); const el = d.createElement('div'); el.textContent = 'Vegan Lens: Likely vegan'; B.mark(el, { doc: d });
  assert.equal((el.textContent.match(/Vegan Lens/g) || []).length, 1); assert.ok(isIcon(el.children[0]));
});
test('offers.element() and people pills are attributed', () => {
  const O = require('../offers.js'); const d = fakeDoc();
  const w = O.element({ url: 'https://example.com', text: 'Deal', expires: '2099-01-01' }, d);
  assert.equal(w.getAttribute('data-vl-attr'), '1'); assert.ok(isIcon(w.children[0]));
  const P = require('../people.js'); const st = Object.keys(P.STATUS)[0];
  const p = P.pillFor(d, { status: st, name: 'X', source: 'https://example.com' }, false);
  assert.equal(p.getAttribute('data-vl-attr'), '1'); assert.match(p.getAttribute('aria-label'), /Vegan Lens/);
});
test('icon16 is web-accessible and brand.js loads first in every content script group', () => {
  const m = JSON.parse(R('manifest.json'));
  assert.ok(m.web_accessible_resources.some(w => w.resources.includes('icons/icon16.png')));
  for (const cs of m.content_scripts) assert.equal(cs.js[0], 'brand.js');
  for (const c of ['content.css', 'web.css', 'marketplace.css', 'search.css', 'pharmacy.css']) assert.match(R(c), /\.vl-mark-icon\{width:16px/);
});
// Static guard: each UI root created in a content script must be passed through mark()/MARK() (or be a child of one).
const ROOTS = {
  'content.js': [/className = 'vl-badge /, /className = 'vl-swap /, /id = 'vl-banner'/, /className = 'vl-label'/, /className = 'vl-barnivore'/, /className = 'vl-notice'/],
  'web.js': [/className = 'vl-w-chip'/, /'🌿 Context'/, /className = 'vl-w-caution'/, /className = 'vl-w-banner /],
  'productdb.js': [/id = 'vl-banner'/], 'marketplace.js': [/className = 'vl-mp-pill /], 'search.js': [/className = 'vl-s-banner'/],
  'offers.js': [/className = 'vl-offer'/], 'people.js': [/className = 'vl-p-pill /],
};
for (const [f, pats] of Object.entries(ROOTS)) test('every UI root in ' + f + ' goes through the attribution helper', () => {
  const s = R(f);
  for (const re of pats) { const i = s.search(re); assert.ok(i >= 0, f + ' ' + re); const win = s.slice(i, i + 1600);
    assert.match(win, /\b(?:mark|MARK)\(|VeganLensBrand\.mark : typeof require[^)]*\)\.mark : \(e => e\)\)\(/, f + ': ' + re + ' not attributed'); }
  // no stray (unattributed) top-level elements: every createElement for div/aside/span roots appended to the page is listed above
  assert.ok(/brand\.js|VeganLensBrand/.test(s), f + ' does not use brand.js');
});
test('blur, Try: links and vegan bars carry the tooltip', () => {
  const s = R('web.js');
  assert.equal((s.match(/blurred \(click to show\) — Added by Vegan Lens extension/g) || []).length, 2);
  assert.match(s, /Vegan Lens suggestion — Added by Vegan Lens extension/);
});
