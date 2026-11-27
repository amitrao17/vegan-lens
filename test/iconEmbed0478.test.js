// 0.4.78: the page mark is an inline SVG (no chrome-extension:// load). After a
// reload, an orphaned content script whose chrome.runtime.id is gone must stop quietly.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const B = require('../brand.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
function fakeDoc() {
  const mk = tag => ({ tagName: tag.toUpperCase(), attrs: {}, children: [], className: '', ownerDocument: doc,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; }, addEventListener() {},
    append(...n) { this.children.push(...n); }, appendChild(n) { this.children.push(n); return n; },
    prepend(...n) { this.children.unshift(...n); },
    get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent || '').join('') + (this._t || ''); },
    set textContent(v) { this.children = []; this._t = String(v); } });
  const doc = { createElement: mk, createElementNS: (_ns, tag) => mk(tag) }; return doc;
}
const isMark = n => n && n.tagName === 'SVG' && /vl-mark-icon/.test(n.className || n.getAttribute('class') || '') && n.getAttribute('width') === '16';
const PAGE_JS = ['brand.js', 'web.js', 'content.js', 'search.js', 'marketplace.js', 'productdb.js', 'pharmacy.js', 'offers.js', 'people.js', 'share.js', 'adUnits.js', 'webUnits.js', 'contentClassifier.js', 'classifier.js', 'swaps.js', 'pageKey.js', 'sites.js', 'brandSites.js', 'contextTopics.js', 'searchRewrite.js'];
const PAGE_CSS = ['content.css', 'web.css', 'marketplace.css', 'search.css', 'pharmacy.css'];

test('versions agree at 0.4.79', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.79');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.79');
});

test('mark() uses an inline SVG leaf, not a chrome-extension or http icon URL', () => {
  const d = fakeDoc(); const el = d.createElement('span'); el.textContent = 'Hidden: about beef';
  const prev = global.chrome;
  global.chrome = { runtime: { id: 'fdokmaphccipnkaiihbpklflbggcceda', getURL: p => 'chrome-extension://fdokmaphccipnkaiihbpklflbggcceda/' + p } };
  try {
    B.mark(el, { doc: d });
    const icon = el.children[0];
    assert.ok(isMark(icon));
    const src = (icon.getAttribute('src') || '') + (icon.getAttribute('href') || '') + (icon.getAttribute('xlink:href') || '');
    assert.equal(src, '');
    assert.ok(icon.children.some(c => c.tagName === 'RECT' && c.getAttribute('fill')));
    assert.ok(icon.children.some(c => c.tagName === 'PATH' && c.getAttribute('d')));
    assert.doesNotMatch(JSON.stringify(icon.attrs), /chrome-extension:|icons\/icon16/);
  } finally { if (prev === undefined) delete global.chrome; else global.chrome = prev; }
});

test('alive() is true without chrome, false when runtime.id is missing, true when it is set', () => {
  const prev = global.chrome;
  try {
    delete global.chrome;
    assert.equal(B.alive(), true);
    global.chrome = { runtime: {} };
    assert.equal(B.alive(), false);
    global.chrome = { runtime: { id: undefined } };
    assert.equal(B.alive(), false);
    global.chrome = { runtime: { id: 'abc' } };
    assert.equal(B.alive(), true);
  } finally { if (prev === undefined) delete global.chrome; else global.chrome = prev; }
});

test('content scripts stop when chrome.runtime.id is gone', () => {
  for (const f of ['web.js', 'content.js', 'search.js', 'marketplace.js', 'productdb.js']) {
    const s = R(f);
    assert.match(s, /VeganLensBrand\.alive && !VeganLensBrand\.alive\(\)\) return/, f + ' missing orphaned-script guard');
  }
  assert.match(R('web.js'), /extAlive\(\) && /);
  assert.match(R('web.js'), /if \(!extAlive\(\)\) return;/);
});

test('no page-facing script or stylesheet loads a chrome-extension URL into the page', () => {
  const srcOrUrl = /(?:setAttribute\(\s*['"]src['"]|setAttribute\(\s*['"]href['"]|\.src\s*=|\.href\s*=|url\s*\()\s*(?:chrome\.runtime\.getURL|['"]chrome-extension:)/;
  for (const f of PAGE_JS.concat(PAGE_CSS)) {
    const s = R(f);
    assert.doesNotMatch(s, srcOrUrl, f + ' assigns a chrome-extension URL to a page resource');
    if (f === 'brand.js') assert.doesNotMatch(s, /getURL\s*\(/);
  }
  // popup / background may use getURL for their own extension pages and fetches; they must not be injected as content scripts.
  const m = JSON.parse(R('manifest.json'));
  const cs = new Set(m.content_scripts.flatMap(c => c.js.concat(c.css || [])));
  assert.ok(!cs.has('popup.js') && !cs.has('background.js'));
});

test('web_accessible_resources still lists icon16 for all URLs, without use_dynamic_url', () => {
  const m = JSON.parse(R('manifest.json'));
  const war = (m.web_accessible_resources || []).find(w => (w.resources || []).includes('icons/icon16.png'));
  assert.ok(war, 'icons/icon16.png missing from web_accessible_resources');
  assert.ok((war.matches || []).includes('<all_urls>'));
  assert.ok((war.resources || []).includes('icons/icon32.png'));
  assert.ok(!war.use_dynamic_url);
});

test('CHANGELOG records the YouTube icon load fix in 0.4.78', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /^## 0\.4\.78\b/m);
  assert.match(log, /Unsafe attempt to load URL/);
  assert.match(log, /inline SVG/i);
  assert.match(log, /icon16\.png/);
  assert.match(log, /runtime\.id/);
});
