// 0.4.76: plant compounds that contain an animal word are not animal evidence;
// a vegan/plant-based modifier clears the meat noun it modifies, but contrast
// phrasing ("vegan vs beef", "I'm vegan but ate beef") does not.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../contentClassifier.js');
const P = require('../classifier.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const YT = { requireHeadline: true };
const v = (t, c) => C.classify({ headline: t, creators: c }, YT);

test('versions agree at 0.4.78', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.78');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.78');
});

const PLANT_COMPOUNDS = [
  'These Viral Butter Beans Are Actually Worth the Hype',
  'Butter Beans',
  'garlic butter beans',
  'salted butter beans',
  'butternut squash soup',
  'buttercup squash',
  'butterhead lettuce',
  'butter lettuce salad',
  'peanut butter cookies',
  'almond butter',
  'cashew butter',
  'nut butter toast',
  'seed butter',
  'sunflower seed butter',
  'apple butter',
  'cocoa butter',
  'shea butter',
  'eggplant curry',
  'egg plant curry'
];

for (const t of PLANT_COMPOUNDS) {
  test('plant compound is not animal evidence: ' + t, () => {
    const r = v(t);
    assert.notEqual(r.verdict, 'nonvegan', t + ' -> ' + r.verdict + ' ' + JSON.stringify(r.matches));
    const p = P.classify(t);
    assert.notEqual(p.verdict, 'non-vegan', 'product: ' + t + ' -> ' + p.verdict + ' ' + JSON.stringify(p.matched));
  });
}

test('reported YouTube butter-beans card is not hidden as dairy', () => {
  const r = v('These Viral Butter Beans Are Actually Worth the Hype', ["Merle O'Neal"]);
  assert.notEqual(r.verdict, 'nonvegan', JSON.stringify(r));
  assert.equal(r.verdict, 'neutral');
});

const REAL_ANIMAL = [
  'salted butter',
  'Irish butter',
  'brown butter pumpkin pie',
  'Gluten-Free Brown Butter Pumpkin Pie',
  'butter chicken',
  'garlic butter shrimp',
  'egg noodles',
  'egg fried rice',
  'eggs benedict'
];

for (const t of REAL_ANIMAL) {
  test('real animal food still counts: ' + t, () => {
    assert.equal(v(t).verdict, 'nonvegan', t + ' -> ' + JSON.stringify(v(t)));
  });
}

test('Vegan Deli Roast Beef is vegan, including from a vegan-named channel', () => {
  const title = 'New & Improved Vegan Deli Roast Beef + French Dip';
  assert.equal(v(title).verdict, 'vegan');
  const r = v(title, ['Gluten Free Vegan Takes']);
  assert.equal(r.verdict, 'vegan', JSON.stringify({ verdict: r.verdict, reasons: r.reasons, matches: r.matches }));
  for (const t of [
    'Vegan Deli Roast Beef',
    'Vegan Roast Beef',
    'Vegan Beef',
    'Plant-Based Deli Roast Beef',
    'Plant-Based Roast Beef',
    'Veggie Deli Roast Beef',
    'Vegan Slow Cooked Roast Beef'
  ]) {
    assert.equal(v(t).verdict, 'vegan', t);
    assert.equal(v(t, ['Gluten Free Vegan Takes']).verdict, 'vegan', t + ' + channel');
  }
  assert.equal(P.classify('Vegan Deli Roast Beef Slices').verdict, 'vegan');
});

test('vegan vs beef and I ate beef are not cleared', () => {
  for (const t of [
    'vegan vs beef',
    "I'm vegan but ate beef",
    'I am vegan but ate beef',
    'vegan vs chicken',
    'Vegan YouTuber tries beef',
    'vegan chicken vs beef',
    'Vegan Chef Makes Roast Beef'
  ]) {
    const r = v(t);
    assert.notEqual(r.verdict, 'vegan', t + ' -> ' + r.verdict + ' ' + JSON.stringify(r.reasons));
    const r2 = v(t, ['Gluten Free Vegan Takes']);
    assert.notEqual(r2.verdict, 'vegan', t + ' + channel -> ' + r2.verdict);
  }
});

test('meaty titles on a vegan-named channel still dim', () => {
  assert.equal(v('Best Ribeye Steak Recipe', ['PlantbasedBrandon']).verdict, 'nonvegan');
  assert.equal(v('Grilled Chicken Recipe', ['Vegan Hacks']).verdict, 'nonvegan');
  assert.equal(v('Roast Beef Recipe').verdict, 'nonvegan');
});

test('CHANGELOG records plant compounds and vegan noun-phrase modifiers in 0.4.76', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.76/);
  assert.match(log, /[Bb]utter beans/);
  assert.match(log, /Vegan Deli Roast Beef|noun-?phrase|plant-based modifier/i);
  assert.match(log, /vegan vs beef/i);
});
