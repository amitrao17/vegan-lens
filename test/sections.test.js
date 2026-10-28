// v0.4.8: section hider (Meat / Seafood / Dairy & Eggs on grocery sites) with a fixture from the live Giant homepage.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const V = require('../sites.js');

// ---- tiny DOM: elements with attrs, classList, closest, querySelectorAll (tag, [attr], [attr=v], .class) ----
class E { constructor(tag, attrs = {}) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.children = []; this.parentNode = null; this.text = ''; }
  append(n) { n.parentNode = this; this.children.push(n); return n; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } setAttribute(k, v) { this.attrs[k] = String(v); } removeAttribute(k) { delete this.attrs[k]; }
  get classList() { const s = this, list = () => (s.attrs.class || '').split(/\s+/).filter(Boolean);
    return { contains: c => list().includes(c), add: c => { if (!list().includes(c)) s.attrs.class = [...list(), c].join(' '); }, remove: c => { s.attrs.class = list().filter(x => x !== c).join(' '); } }; }
  get textContent() { return this.text + this.children.map(c => c.textContent).join(''); }
  matches(sel) { return sel.split(',').map(x => x.trim()).some(x => {
    if (x[0] === '.') return this.classList.contains(x.slice(1));
    const m = x.match(/^([a-z]*)(?:\[([\w-]+)(?:=([\w-]+))?\])?$/i); if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && !(m[2] in this.attrs)) return false; if (m[3] && this.attrs[m[2]] !== m[3]) return false; return true; }); }
  closest(sel) { for (let e = this; e && e.nodeType === 1; e = e.parentNode) if (e.matches(sel)) return e; return null; }
  querySelectorAll(sel) { const o = []; (function w(n) { n.children.forEach(c => { if (c.matches(sel)) o.push(c); w(c); }); })(this); return o; } }
const dec = s => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'");
// parse the fixture's <li><a href><span>text</span></a></li> rows
function catbar() {
  const html = fs.readFileSync(__dirname + '/fixtures/giant-catbar.html', 'utf8');
  const root = new E('ul', { id: 'nav-categories-menu' });
  for (const [, href, t] of html.matchAll(/<li><a href="([^"]+)"><span>([^<]+)<\/span><\/a><\/li>/g)) {
    const li = root.append(new E('li')), a = li.append(new E('a', { href: dec(href) })), sp = a.append(new E('span')); sp.text = dec(t);
  }
  return root;
}
const RULES = V.sectionRulesFor('giantfood.com', {});
const visible = root => root.querySelectorAll('li').filter(li => !li.classList.contains(V.SEC_HIDDEN)).map(li => li.textContent);

test('fixture from live Giant homepage has the expected category bar', () => {
  const t = catbar().querySelectorAll('li').map(l => l.textContent);
  assert.ok(t.length >= 20); for (const n of ['Produce', 'Meat', 'Seafood', 'Deli & Prepared Food', 'Dairy & Eggs', 'Beverages']) assert.ok(t.includes(n), n);
});
test('hides Meat, Seafood, Dairy & Eggs tiles (whole <li>), keeps Deli & Prepared Food and the rest', () => {
  const root = catbar(), before = visible(root).length;
  const hit = V.hideSections(root, RULES);
  assert.deepStrictEqual(hit.map(h => h.name), ['Meat', 'Seafood', 'Dairy & Eggs']);
  assert.ok(hit.every(h => h.el.tagName === 'LI'));
  const v = visible(root); assert.strictEqual(v.length, before - 3);
  for (const n of ['Meat', 'Seafood', 'Dairy & Eggs']) assert.ok(!v.includes(n), n);
  for (const n of ['Deli & Prepared Food', 'Produce', 'Beverages', 'Frozen', 'Pets']) assert.ok(v.includes(n), n);
});
test('idempotent under re-scans (MutationObserver) and restore undoes everything', () => {
  const root = catbar(); V.hideSections(root, RULES);
  assert.strictEqual(V.hideSections(root, RULES).length, 0);
  assert.strictEqual(V.restoreSections(root), 3);
  assert.strictEqual(root.querySelectorAll('.' + V.SEC_HIDDEN).length, 0);
  assert.ok(root.querySelectorAll('[data-vl-sec]').length === 0);
  // SPA re-render: new nodes appear, next scan hides them again
  const li = root.append(new E('li')), a = li.append(new E('a', { href: '/browse-aisles/categories/1/categories/1563-meat' })); a.text = 'Meat';
  assert.strictEqual(V.hideSections(root, RULES).length, 4);
});
test('matches by href (subcategories, mega-menu) or exact text (filter buttons/labels), never partial text', () => {
  const s = (tag, attrs, text) => { const e = new E(tag, attrs); e.text = text; return e; };
  const yes = [s('a', { href: '/browse-aisles/categories/1/categories/1563-meat/1580-beef' }, 'Beef'),
    s('a', { href: 'https://giantfood.com/browse-aisles/categories/1/categories/805-dairy-eggs?x=1' }, 'Shop all'),
    s('button', {}, ' Dairy & Eggs (412) '), s('label', {}, 'Seafood'), s('div', { role: 'option' }, 'Meat')];
  const no = [s('a', { href: '/browse-aisles/categories/1/categories/921-deli-prepared-food' }, 'Deli & Prepared Food'),
    s('button', {}, 'Deli & Prepared Food'), s('label', {}, 'Meat Alternatives'), s('a', { href: '/product/123' }, 'Meat'),
    s('a', { href: '/browse-aisles/categories/1/categories/7000-meatless' }, 'Meatless'), s('button', {}, 'Plant-based milk')];
  for (const e of yes) assert.ok(V.sectionOf(e, RULES), e.textContent);
  for (const e of no) assert.strictEqual(V.sectionOf(e, RULES), null, e.textContent);
});
test('rules are per-site and respect the hideMeatSections toggle', () => {
  for (const h of ['giantfood.com', 'www.stopandshop.com', 'martinsfoods.com', 'giantfoodstores.com']) assert.strictEqual(V.sectionRulesFor(h, {}).length, 1, h);
  assert.strictEqual(V.sectionRulesFor('www.amazon.com', {}).length, 0);
  assert.strictEqual(V.sectionRulesFor('giantfood.com', { hideMeatSections: false }).length, 0);
  assert.deepStrictEqual(V.hideSections(catbar(), []), []);
});
test('wiring: content.js hides after the per-page disable check and restores on undo; popup toggle default on; CSS', () => {
  const c = fs.readFileSync(__dirname + '/../content.js', 'utf8');
  assert.match(c, /hideMeatSections: true/);
  assert.ok(c.indexOf('V.hideSections(') > c.indexOf('if (P.isDisabled(S, location.href)) return;'));
  assert.match(c, /function undo\(\) \{\s*if \(V && V\.restoreSections\) V\.restoreSections\(document\);/);
  assert.match(fs.readFileSync(__dirname + '/../popup.html', 'utf8'), /Hide meat &amp; dairy store sections.*id="hideMeatSections"/);
  const p = fs.readFileSync(__dirname + '/../popup.js', 'utf8'); assert.match(p, /hideMeatSections: true/); assert.match(p, /'hideMeatSections'/);
  assert.match(fs.readFileSync(__dirname + '/../content.css', 'utf8'), /\.vl-sec-hidden \{ display: none !important; \}/);
});
