// 0.4.72: cultivated/lab-grown meat is not vegan. News/discussion is labelled, not hidden;
// product listings, menu dishes and recipes stay non-vegan like any meat.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../contentClassifier.js');
const P = require('../classifier.js');
const U = require('../webUnits.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const YT = { requireHeadline: true };
const TITLE = 'Lab Grown Meat is For Sale in California Will you Try it?';

test('versions agree at 0.4.80', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.80');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.80');
});

test('YouTube news/discussion about cultivated meat is labelled, not vegan, not hidden', () => {
  for (const input of [{ headline: TITLE }, { headline: TITLE, creators: ['Vegan Hacks'] }, { headline: TITLE, author: 'Vegan Hacks' }]) {
    const r = C.classify(input, YT);
    assert.equal(r.verdict, 'discussion', JSON.stringify(input) + ' -> ' + r.verdict);
    assert.equal(r.cultivated, true, 'expected cultivated flag');
  }
  const taste = C.classify({ headline: 'Best Lab Grown Chicken Taste Test' }, YT);
  assert.equal(taste.verdict, 'discussion');
  assert.equal(taste.cultivated, true);
});

test('cultivated meat products, menu dishes and recipes stay non-vegan', () => {
  assert.equal(C.classify({ headline: 'How to Cook Lab Grown Chicken' }, YT).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'Lab Grown Chicken recipe' }, YT).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'Lab Grown Chicken Sandwich', kind: 'dish' }, YT).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'Cultivated Beef Burger Recipe' }, YT).verdict, 'nonvegan');
  const prod = P.classify('Lab Grown Chicken Breast 8oz', {});
  assert.equal(prod.verdict, 'non-vegan');
  assert.ok(prod.matched.some(m => /chicken|meat/i.test(m)), prod.matched);
});

test('cultured butter stays dairy; plain cultured only counts before a meat noun', () => {
  const r = C.classify({ headline: 'Best Cultured Butter Recipe' }, YT);
  assert.equal(r.verdict, 'nonvegan');
  assert.ok(!r.cultivated);
  assert.equal(r.topic, 'dairy/eggs');
  assert.notEqual(C.classify({ headline: 'Cultured Meat Explained' }, YT).verdict, 'nonvegan');
});

test('ordinary meat still dims, including from a vegan-named channel when the title is a dish or recipe', () => {
  assert.equal(C.classify({ headline: 'Grilled Chicken Recipe' }, YT).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'Grilled Chicken Recipe', creators: ['Vegan Hacks'] }, YT).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'Meat Lovers Pizza' }, YT).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'Meat Lovers Pizza', creators: ['Vegan Grill'] }, YT).verdict, 'nonvegan');
});

test('LIVE card aria-labels expose the channel, including "N watching"', () => {
  assert.equal(U.channelFromAria(TITLE + ' by Vegan Hacks 1,234 watching'), 'Vegan Hacks');
  assert.equal(U.channelFromAria(TITLE + ' by Vegan Hacks 12K views 3 days ago'), 'Vegan Hacks');
  assert.equal(U.channelFromAria(TITLE + ' by Vegan Hacks LIVE 234 watching'), 'Vegan Hacks');
  const w = R('web.js');
  assert.match(w, /U\.channelFromAria/);
  assert.match(w, /Cultivated meat/);
  assert.match(w, /r\.cultivated/);
});

test('CHANGELOG records cultivated-meat news vs product handling in 0.4.72', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.72/);
  assert.match(log, /[Cc]ultivated meat/);
  assert.match(log, /not vegan/i);
  assert.match(log, /watching/);
});
