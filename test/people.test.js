// v0.4.6: public-figure pills (people.json + people.js).
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const P = require('../people.js'), DATA = require('../people.json');

// ---- tiny DOM with text nodes, splitText, insertBefore, closest, createTreeWalker ----
class T { constructor(d) { this.nodeType = 3; this.data = d; this.parentNode = null; }
  get nextSibling() { const k = this.parentNode.childNodes; return k[k.indexOf(this) + 1] || null; }
  get previousSibling() { const k = this.parentNode.childNodes; return k[k.indexOf(this) - 1] || null; }
  splitText(i) { const t = new T(this.data.slice(i)); this.data = this.data.slice(0, i); const k = this.parentNode.childNodes; k.splice(k.indexOf(this) + 1, 0, t); t.parentNode = this.parentNode; return t; } }
class E { constructor(tag, attrs = {}, kids = []) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.childNodes = []; this.parentNode = null; kids.forEach(k => this.append(typeof k === 'string' ? new T(k) : k)); }
  append(n) { n.parentNode = this; this.childNodes.push(n); }
  insertBefore(n, ref) { n.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, n); }
  get nextSibling() { const k = this.parentNode.childNodes; return k[k.indexOf(this) + 1] || null; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } setAttribute(k, v) { this.attrs[k] = String(v); }
  set className(v) { this.attrs.class = v; } get className() { return this.attrs.class || ''; }
  get classList() { const s = this; return { contains: c => s.className.split(/\s+/).includes(c) }; }
  set textContent(v) { this.childNodes = []; this.append(new T(v)); }
  get textContent() { return this.childNodes.map(c => c.nodeType === 3 ? c.data : c.textContent).join(''); }
  get isContentEditable() { for (let e = this; e; e = e.parentNode) { const v = e.attrs && e.attrs.contenteditable; if (v === '' || v === 'true') return true; } return false; }
  matches(sel) { return sel.split(',').map(s => s.trim()).some(s => s[0] === '.' ? this.className.split(/\s+/).includes(s.slice(1)) : s[0] === '#' ? this.attrs.id === s.slice(1) : s === 'a[href]' ? this.tagName === 'A' && 'href' in this.attrs : s[0] === '[' ? s.slice(1, -1) in this.attrs : this.tagName === s.toUpperCase()); }
  closest(sel) { for (let e = this; e && e.nodeType === 1; e = e.parentNode) if (e.matches(sel)) return e; return null; } }
const doc = { createElement: t => new E(t),
  createTreeWalker(root, _w, f) { const out = []; (function walk(n) { if (n.nodeType === 3) { if (f.acceptNode(n) === 1) out.push(n); } else n.childNodes.forEach(walk); })(root); let i = 0; return { nextNode: () => out[i++] || null }; } };
const h = (tag, ...kids) => new E(tag, {}, kids);
const pills = root => { const o = []; (function w(n) { if (n.nodeType === 1) { if (n.className.includes('vl-p-pill')) o.push(n); n.childNodes.forEach(w); } })(root); return o; };
const IDX = P.buildIndex(DATA.people);
const mark = (root, st) => P.markRoot(root, doc, IDX, st);

test('people.json: 25-45 entries, valid statuses, https sources, dates, no duplicates', () => {
  const ps = DATA.people; assert.ok(ps.length >= 25 && ps.length <= 45, String(ps.length));
  const names = new Set();
  for (const p of ps) {
    assert.ok(['vegan', 'former', 'meat'].includes(p.status), p.name);
    assert.match(p.source, /^https:\/\/[^\s]+\.[a-z]{2,}\//, p.name); assert.ok(p.date && p.date.length >= 4, p.name);
    assert.ok(Array.isArray(p.aliases)); assert.ok(!names.has(p.name), 'dup ' + p.name); names.add(p.name);
  }
  assert.ok(ps.some(p => p.status === 'former') && ps.some(p => p.status === 'meat') && ps.filter(p => p.status === 'vegan').length >= 15);
});
test('no "non-vegan" person label exists anywhere in the feature', () => {
  const src = fs.readFileSync(__dirname + '/../people.js', 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /non-?vegan/i);
  assert.deepStrictEqual(Object.keys(P.STATUS).sort(), ['former', 'meat', 'vegan']);
  for (const s of Object.values(P.STATUS)) assert.doesNotMatch(s.text + s.tip + s.cls, /non-?vegan/i);
  assert.ok(!DATA.people.some(p => /non/i.test(p.status)));
  assert.strictEqual(P.STATUS.vegan.text, 'V'); assert.strictEqual(P.STATUS.vegan.tip, 'Publicly vegan — source');
  assert.strictEqual(P.STATUS.meat.tip, 'Publicly endorses eating meat — source');
});
test('unlisted or unsourced people get nothing', () => {
  const idx = P.buildIndex([{ name: 'Jane Nobody', aliases: [], status: 'vegan', source: '' }, { name: 'Bob Meat', aliases: [], status: 'nonvegan', source: 'https://x.com/a' }]);
  assert.strictEqual(idx, null);
  const r = h('p', 'Tom Hanks and Taylor Swift met.'); assert.strictEqual(mark(r), 0);
});
test('whole-name matching; no partial-word matches', () => {
  const f = t => P.findMatches(t, IDX).map(m => m.text);
  assert.deepStrictEqual(f('Yesterday Joaquin Phoenix spoke.'), ['Joaquin Phoenix']);
  assert.deepStrictEqual(f('Mike Tyson’s fight'), ['Mike Tyson']);
  for (const t of ['Joaquin Phoenixes', 'XJoaquin Phoenix', 'joaquin phoenix', 'Mike Tyson-like', 'Liver Kingdom', 'Moby Dick is a novel', 'Herman Moby', 'Sian', 'Lizzos', 'Phoenix', 'Hamilton won'])
    assert.deepStrictEqual(f(t), [], t);
  assert.deepStrictEqual(f('Moby played.'), ['Moby']);
  assert.deepStrictEqual(f('Joaquin\n  Phoenix'), ['Joaquin\n  Phoenix']);
  assert.strictEqual(P.findMatches('Nusret Gökçe', IDX)[0].person.name, 'Salt Bae');
});
test('pill inserted right after the name, text order preserved, links to source', () => {
  const p = h('p', 'Hi Billie Eilish and Lizzo and Joe Rogan!'); const before = p.textContent;
  assert.strictEqual(mark(p), 3);
  const ps = pills(p); assert.deepStrictEqual(ps.map(x => x.className), ['vl-p-pill vl-p-vegan', 'vl-p-pill vl-p-former', 'vl-p-pill vl-p-meat']);
  assert.strictEqual(p.childNodes[0].data, 'Hi Billie Eilish'); assert.strictEqual(p.childNodes[1], ps[0]);
  assert.strictEqual(p.textContent.replace(/V|former vegan|🥩/g, ''), before.replace(/V/g, ''));
  assert.strictEqual(ps[0].getAttribute('href'), DATA.people.find(x => x.name === 'Billie Eilish').source);
  assert.match(ps[0].getAttribute('title'), /^Publicly vegan — source/); assert.strictEqual(ps[0].getAttribute('target'), '_blank');
});
test('no double marking on re-scan (MutationObserver re-runs)', () => {
  const p = h('div', h('p', 'Lewis Hamilton won.'), h('p', 'Lewis Hamilton')); const st = { counts: new Map() };
  assert.strictEqual(mark(p, st), 2); assert.strictEqual(mark(p, st), 0); assert.strictEqual(mark(p, { counts: new Map() }), 0);
  assert.strictEqual(pills(p).length, 2);
  p.childNodes.forEach(c => c.childNodes.filter(n => n.nodeType === 3).forEach(t => mark(t, st))); assert.strictEqual(pills(p).length, 2);
});
test('inside an existing link the pill is a span (no nested anchors), tooltip still has the source', () => {
  const a = new E('a', { href: '/x' }, ['Ricky Gervais']); const r = h('p', a); mark(r);
  const [pl] = pills(r); assert.strictEqual(pl.tagName, 'SPAN'); assert.match(pl.getAttribute('title'), /plantbasednews\.org/);
});
test('only the first 3 occurrences per name per page', () => {
  const st = { counts: new Map() }, a = h('p', 'Moby, Moby, Moby, Moby.'), b = h('p', 'Moby again; Sia too.');
  mark(a, st); mark(b, st);
  assert.strictEqual(pills(a).length, 3); assert.deepStrictEqual(pills(b).map(x => x.getAttribute('data-vl-person')), ['Sia']);
});
test('skips inputs, editable, script, style, code, existing chips', () => {
  for (const tag of ['script', 'style', 'code', 'pre', 'textarea', 'noscript']) { const r = h('div', h(tag, 'Joaquin Phoenix')); assert.strictEqual(mark(r), 0, tag); }
  const ed = new E('div', { contenteditable: 'true' }, [h('span', 'Joaquin Phoenix')]); assert.strictEqual(mark(h('section', ed)), 0);
  const chip = new E('span', { class: 'vl-w-chip' }, ['Joaquin Phoenix']); assert.strictEqual(mark(h('div', chip)), 0);
  assert.strictEqual(mark(h('div', h('code', 'Moby'), h('b', 'Moby'))), 1);
});
test('status filter: meat toggle off leaves vegan/former only', () => {
  const idx = P.buildIndex(DATA.people, { statuses: ['vegan', 'former'] });
  assert.deepStrictEqual(P.findMatches('Joe Rogan met Moby', idx).map(m => m.text), ['Moby']);
  assert.strictEqual(P.buildIndex(DATA.people, { statuses: [] }), null);
});
test('wiring: manifest loads people.js before web.js; popup toggles default on; web respects per-page disable', () => {
  const m = require('../manifest.json'), web = m.content_scripts.find(c => c.js.includes('web.js')).js;
  assert.ok(web.indexOf('people.js') > -1 && web.indexOf('people.js') < web.indexOf('web.js'));
  const html = fs.readFileSync(__dirname + '/../popup.html', 'utf8'), pj = fs.readFileSync(__dirname + '/../popup.js', 'utf8'), w = fs.readFileSync(__dirname + '/../web.js', 'utf8');
  assert.match(html, /Mark vegan public figures[\s\S]*id="markPeople"/); assert.match(html, /Mark public meat endorsers[\s\S]*id="markMeat"/);
  assert.match(pj, /markPeople: true, markMeat: true/); assert.match(w, /markPeople: true, markMeat: true/);
  assert.match(w, /function scan\(root\) \{\s*if \(!active\(\)\) return;\s*markPeople\(root\);/); // active() includes isPageDisabled
  assert.match(w, /P\.isPageDisabled\(S\.pageBlock/); assert.match(w, /VP\.unmarkAll\(document\)/);
  assert.match(fs.readFileSync(__dirname + '/../background.js', 'utf8'), /type === 'people'/);
});
