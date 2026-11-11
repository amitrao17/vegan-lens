'use strict';
// 0.4.63 discussion rule: titles that ask/debate something about eating animal products get a light label, not a dim.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
const C = require('../contentClassifier.js'); const R = require('../rules/rules.js');
const v = (t, c) => C.classify({ headline: t, creators: c }, { requireHeadline: true }).verdict;
test('discussion titles are labelled, not dimmed', () => {
  const r = C.classify({ headline: 'Why Did Shirdi Sai Baba Eat Meat? I Mohanji', creators: ['Mohanji Official'] }, { requireHeadline: true });
  assert.equal(r.verdict, 'discussion'); assert.equal(r.topic, 'meat');
  for (const t of ['Is Fish Healthy? The Truth', 'Should Christians Eat Pork?', 'Is Eating Meat a Sin?']) assert.equal(v(t), 'discussion', t);
  for (const t of ['Should Vegans Eat Eggs?', 'Why I Stopped Eating Meat']) assert.ok(!['nonvegan'].includes(v(t)), t); // already vegan-leaning: never dimmed
});
test('titles that show the food itself stay dimmed', () => {
  for (const t of ['How to Cook the Perfect Steak', 'Crispy Chicken Quesadillas — Not Fried!', 'Best Burger in NYC?', 'Is this the best fried chicken?',
    'Is Expensive Honey a Scam?', 'Why this steak costs $500', 'Can you eat raw chicken? Gordon tries', 'Steak Myths Busted by a Chef']) assert.equal(v(t), 'nonvegan', t);
});
test('rule data in rules.json; older lists without the keys are back-filled', () => {
  const b = JSON.parse(JSON.stringify(R.active())); b.listVersion = '2026.11.03.91';
  assert.ok(b.data.classifier.DISCUSSION.$re && b.data.classifier.FOOD_SHOW.$re);
  delete b.data.classifier.DISCUSSION; delete b.data.classifier.FOOD_SHOW; assert.ok(R.validate(b).ok, JSON.stringify(R.validate(b)));
});
test('web.js: discussion gets a non-dimming chip before the dim path, is not counted as nonvegan, ads stay promos', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'web.js'), 'utf8');
  const i = s.indexOf("r.verdict === 'discussion'"), j = s.indexOf("const dimCls");
  assert.ok(i > 0 && i < j); assert.match(s.slice(i, j), /vl-w-chip-discuss/); assert.doesNotMatch(s.slice(i, s.indexOf('return; }', i)), /showDim|blurCard|count\('nonvegan'\)/);
  assert.match(s, /verdict === 'discussion'\) r = \{ \.\.\.r, verdict: 'nonvegan' \}/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'badge.js'), 'utf8'), /c\.nonvegan/);
});
