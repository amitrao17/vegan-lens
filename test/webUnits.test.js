const test = require('node:test');
const assert = require('node:assert');
const { unitRole, videoIds, isYouTubeHost } = require('../webUnits.js');
const { classify } = require('../contentClassifier.js');
// Minimal fake DOM: tag-name selectors + a[href] only.
function el(tag, kids = [], attrs = {}) {
  const n = { tagName: tag.toUpperCase(), kids, attrs, getAttribute: k => attrs[k] ?? null };
  const all = () => kids.flatMap(k => [k, ...k._all()]);
  n._all = all;
  const m1 = (e, sel) => sel.split(',').map(x => x.trim()).some(x => x === 'a[href]' ? e.tagName === 'A' && e.attrs.href != null : e.tagName === x.toUpperCase());
  n.matches = sel => m1(n, sel);
  n.querySelectorAll = sel => all().filter(e => m1(e, sel));
  return n;
}
const a = id => el('a', [], { href: '/watch?v=' + id });
const lockup = id => el('yt-lockup-view-model', [a(id), el('h3', [a(id)])]);
test('youtube: rich-item wrapping a lockup defers to the innermost card', () => {
  const inner = lockup('t_jGAK0LRRk'), item = el('ytd-rich-item-renderer', [inner]);
  assert.strictEqual(unitRole(item, { youtube: true }), 'container');
  assert.strictEqual(unitRole(inner, { youtube: true }), 'unit');
});
test('youtube: row/shelf/generic card containers are never units', () => {
  const row = el('ytd-rich-grid-row', [el('ytd-rich-item-renderer', [lockup('aaaaaaaa')]), el('ytd-rich-item-renderer', [lockup('t_jGAK0LRRk')])]);
  assert.strictEqual(unitRole(row, { youtube: true }), 'skip');
  assert.strictEqual(unitRole(el('div', [a('x1234567'), a('y1234567')]), { youtube: true }), 'skip');
});
test('youtube: a card linking several videos is a container', () => {
  assert.strictEqual(unitRole(el('ytd-video-renderer', [a('aaaaaaaa'), a('bbbbbbbb')]), { youtube: true }), 'container');
  assert.deepStrictEqual([...videoIds(el('div', [a('t_jGAK0LRRk'), el('a', [], { href: 'https://youtu.be/t_jGAK0LRRk?si=x' })]))], ['t_jGAK0LRRk']);
});
test('generic: element wrapping 2+ units is a container', () => {
  const list = el('ul', [el('article'), el('article')]);
  assert.strictEqual(unitRole(list, { unitSel: 'article' }), 'container');
  assert.strictEqual(unitRole(el('article'), { unitSel: 'article' }), 'unit');
});
test('isYouTubeHost', () => { assert.ok(isYouTubeHost('www.youtube.com')); assert.ok(isYouTubeHost('m.youtube.com')); assert.ok(!isYouTubeHost('notyoutube.co')); });
// Real metadata of https://youtu.be/t_jGAK0LRRk (oEmbed + watch page, 2026-10-28)
const T = 'How SpaceX Is Making America Uncatchable';
const DESC = "SpaceX carries 90% of everything headed to orbit this year, but the spectacular rocket landing back on the pad is a distraction from what actually matters. The useful space around Earth is far smaller than it looks: one patch of ice at the Moon's south pole roughly the size of Switzerland. Thumbnail: Tom Grillo & Xingpei Shen. Earn up to 4.30% APY with Wealthfront's high-yield cash account.";
test('t_jGAK0LRRk card text is neutral', () => {
  for (const p of [{ headline: T }, { headline: T, snippet: 'Maxinomics 1.7M views 4 months ago' }, { headline: T, snippet: DESC }, { headline: T, snippet: DESC, alt: 'maxinomics morning brew investing business economics' }])
    assert.strictEqual(classify(p, { requireHeadline: true }).verdict, 'neutral');
});
test('youtube requireHeadline: description-only animal terms do not dim a card', () => {
  const p = { headline: T, snippet: 'Sponsored by our friends at the steakhouse: best BBQ ribs and brisket recipes' };
  assert.strictEqual(classify(p).verdict, 'nonvegan');
  assert.strictEqual(classify(p, { requireHeadline: true }).verdict, 'neutral');
  assert.strictEqual(classify({ headline: 'Best Texas Brisket Recipe', snippet: 'smoked low and slow' }, { requireHeadline: true }).verdict, 'nonvegan');
});
test('web.css keeps the in-card chip unfiltered and visible', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'web.css'), 'utf8');
  assert.match(css, /\.vl-w-dim-in:has\(>\.vl-w-chip\)>:not\(\.vl-w-chip\)\{filter/);
  assert.match(css, /\.vl-w-chip\.vl-w-chip-in\{position:absolute/);
  const m = require('../manifest.json'); const js = m.content_scripts.find(c => c.js.includes('web.js')).js;
  assert.ok(js.indexOf('webUnits.js') > -1 && js.indexOf('webUnits.js') < js.indexOf('web.js'));
});
