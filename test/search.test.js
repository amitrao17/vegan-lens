const test = require('node:test');
const assert = require('node:assert');
const { rewriteQuery } = require('../searchRewrite.js');
const cases = [
  ['best steak recipe', 'best vegan steak recipe'],
  ['steak', 'vegan steak'],
  ['chicken wings', 'vegan chicken wings'],
  ['easy lasagna', 'easy vegan lasagna'],
  ['how to make cheesecake', 'how to make vegan cheesecake'],
  ['pancakes', 'vegan pancakes'],
  ['mac and cheese', 'vegan mac and cheese'],
  ['restaurant near me', 'vegan restaurant near me'],
  ['leather jacket', 'vegan leather jacket'],
  ['Burger King menu', 'vegan Burger King menu'],
  ['vegan steak recipe', null],
  ['plant-based burger', null],
  ['dairy-free ice cream', null],
  ['kevin bacon movies', null],
  ['phishing email examples', null],
  ['weather tomorrow', null],
  ['python tutorial', null],
  ['', null],
];
for (const [q, want] of cases) test(JSON.stringify(q), () => assert.strictEqual(rewriteQuery(q), want));
test('rewrite is idempotent (loop guard)', () => assert.strictEqual(rewriteQuery(rewriteQuery('best steak recipe')), null));
const yt = [
  ['how to grill steak', 'how to grill vegan steak'],
  ['mukbang', 'vegan mukbang'],
  ['bbq ribs', 'vegan bbq ribs'],
  ['fishing videos', 'vegan fishing videos'],
  ['korean fried chicken mukbang', 'vegan korean fried chicken mukbang'],
  ['lofi hip hop', null],
  ['minecraft speedrun', null],
];
for (const [q, want] of yt) test('youtube: ' + q, () => assert.strictEqual(rewriteQuery(q), want));
test('manifest runs search script on all youtube pages (SPA)', () => {
  const m = require('../manifest.json');
  const cs = m.content_scripts.find(c => c.js.includes('search.js'));
  assert.ok(cs.matches.includes('*://*.youtube.com/*'));
  assert.strictEqual(m.version, '0.4.8');
  assert.ok(m.icons['32']);
});
