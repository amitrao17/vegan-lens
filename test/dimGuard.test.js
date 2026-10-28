const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const U = require('../webUnits.js');
const { classify } = require('../contentClassifier.js');
// Fake DOM with parent links: tag selectors + a[href].
function el(tag, kids = [], attrs = {}) {
  const n = { tagName: tag.toUpperCase(), kids, attrs, parentElement: null, isConnected: true, getAttribute: k => attrs[k] ?? null };
  kids.forEach(k => { k.parentElement = n; });
  n._all = () => n.kids.flatMap(k => [k, ...k._all()]);
  const m1 = (e, sel) => sel.split(',').map(x => x.trim()).some(x => x === 'a[href]' ? e.tagName === 'A' && e.attrs.href != null : e.tagName === x.toUpperCase());
  n.matches = sel => m1(n, sel);
  n.querySelectorAll = sel => n._all().filter(e => m1(e, sel));
  n.prepend = c => { n.kids.unshift(c); c.parentElement = n; };
  Object.defineProperty(n, 'nextElementSibling', { get() { const p = n.parentElement; if (!p) return null; const i = p.kids.indexOf(n); return p.kids[i + 1] || null; } });
  return n;
}
const a = id => el('a', [], { href: '/watch?v=' + id });
const lockup = id => el('yt-lockup-view-model', [a(id), el('h3', [a(id)])]);
const chip = () => el('span');
const KEY = 'Insulin Doctor|KVXnVe8eOkM';

test('invariant 1: no dim without a chip attached to the same element', () => {
  const card = lockup('KVXnVe8eOkM');
  assert.deepStrictEqual(U.dimCheck(card, { chip: null, keyThen: KEY, keyNow: KEY }).ok, false);
  const c = chip(); el('div', [c]); // chip living elsewhere (e.g. a neighbour / removed by re-render)
  assert.strictEqual(U.dimCheck(card, { chip: c, keyThen: KEY, keyNow: KEY }).why, 'no chip attached');
  const d = chip(); card.prepend(d);
  assert.strictEqual(U.dimCheck(card, { chip: d, keyThen: KEY, keyNow: KEY }).ok, true);
  d.isConnected = false; // YouTube re-render dropped the chip
  assert.strictEqual(U.dimCheck(card, { chip: d, keyThen: KEY, keyNow: KEY }).ok, false);
});
test('invariant 1: sibling chip directly before the element counts as attached', () => {
  const c = chip(), art = el('article', [a('zzzzzzzz')]); el('div', [c, art]);
  assert.ok(U.chipAttached(art, c));
  const c2 = chip(), art2 = el('article'); el('div', [c2, el('p'), art2]);
  assert.ok(!U.chipAttached(art2, c2));
});
test('invariant 2: recycled card (new headline / video id) loses its stale dim', () => {
  const card = lockup('KVXnVe8eOkM'), c = chip(); card.prepend(c);
  const stale = { chip: c, keyThen: 'Ribeye steak feast|oldvideo1', keyNow: KEY };
  assert.strictEqual(U.dimCheck(card, stale).why, 'headline/video id changed since verdict');
  assert.strictEqual(U.dimCheck(card, { chip: c, keyThen: KEY, keyNow: null }).ok, false); // unreadable mid-swap: undim
  assert.strictEqual(U.dimCheck(card, { chip: c, keyThen: null, keyNow: KEY }).ok, false);
});
test('invariant 3: never dim an element holding 2+ video cards', () => {
  const row = el('ytd-rich-grid-row', [el('ytd-rich-item-renderer', [lockup('aaaaaaaa')]), el('ytd-rich-item-renderer', [lockup('KVXnVe8eOkM')])]);
  const c = chip(); row.prepend(c);
  assert.ok(U.multiCard(row));
  assert.strictEqual(U.dimCheck(row, { chip: c, keyThen: 'x', keyNow: 'x' }).why, 'contains 2+ video cards');
  assert.ok(U.multiCard(el('div', [a('aaaaaaaa'), a('bbbbbbbb')])));       // #contents with bare links
  const section = el('ytd-rich-section-renderer', [el('ytd-ad-slot-renderer', [a('adadadad')]), lockup('KVXnVe8eOkM')]);
  assert.ok(U.multiCard(section));                                          // ad slot next to a video
  assert.ok(!U.multiCard(el('ytd-rich-item-renderer', [lockup('KVXnVe8eOkM')])));
});
test('CSS: tint/blur/hide rules only apply when the element has its own chip', () => {
  const css = fs.readFileSync(__dirname + '/../web.css', 'utf8');
  for (const rule of css.split('}')) {
    if (!/filter:\s*grayscale|display:\s*none/.test(rule)) continue;
    const sel = rule.split('{')[0];
    for (const s of sel.split(',')) {
      if (!/vl-w-(dim|hide)/.test(s)) continue;
      assert.ok(/:has\(>\.vl-w-chip\)|\.vl-w-chip\+\.vl-w-(dim|hide)/.test(s), 'ungated tint selector: ' + s);
    }
  }
});
test('classifier reports exactly what matched and where', () => {
  const r = classify({ headline: 'Eating only salmon for 3 days', snippet: 'then grilled steak' });
  assert.strictEqual(r.verdict, 'nonvegan');
  assert.deepStrictEqual(r.matches.map(m => [m.term, m.where]), [['salmon', 'title'], ['steak', 'snippet']]);
  const t = U.matchText(r, 'ad detected by ad label "Sponsored"');
  assert.match(t, /ad label "Sponsored"/); assert.match(t, /"salmon" \(fish\) in title: …eating only salmon for 3 days…/);
});
test('KVXnVe8eOkM card text is neutral (dim seen by user did not come from classification)', () => {
  const T = 'Insulin Doctor: This Is The First Sign Of Dementia! The Shocking Link Between Keto & Brain Decline!';
  for (const rh of [true, false]) assert.strictEqual(classify({ headline: T, snippet: 'The Diary Of A CEO · Dr. Boz' }, { requireHeadline: rh }).verdict, 'neutral');
});
test('popup has a default-off debug option', () => {
  const html = fs.readFileSync(__dirname + '/../popup.html', 'utf8'), js = fs.readFileSync(__dirname + '/../popup.js', 'utf8');
  assert.match(html, /id="debug"/); assert.match(html, /Debug: log decisions/); assert.match(js, /debug: false/);
});
test('manifest description no longer mentions Amazon', () => {
  const m = JSON.parse(fs.readFileSync(__dirname + '/../manifest.json', 'utf8'));
  assert.ok(!/amazon/i.test(m.description) && m.description.length <= 132);
});
