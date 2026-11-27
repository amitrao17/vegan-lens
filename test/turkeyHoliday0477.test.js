// 0.4.77: holiday/meal turkey (Thanksgiving, "your turkey", turkey upgrade, cooking
// channels) is food; country/travel/geopolitics, "cold turkey" and "turkey vulture"
// stay excluded. Vegan modifiers still clear turkey dishes.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../contentClassifier.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const YT = { requireHeadline: true };
const v = (t, c) => C.classify({ headline: t, creators: c }, YT);

test('versions agree at 0.4.79', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.79');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.79');
});

const FOOD = [
  'Your Thanksgiving Turkey Is About to Get a MASSIVE Upgrade!',
  'Thanksgiving Turkey',
  'Christmas turkey',
  'Friendsgiving turkey',
  'holiday turkey',
  'Your Turkey',
  'Turkey Upgrade',
  'deep-fry turkey',
  'stuffed turkey',
  'carve the turkey',
  'Roast Turkey',
  'turkey dinner',
  'turkey recipe'
];
for (const t of FOOD) {
  test('food: ' + t, () => {
    const r = v(t);
    assert.equal(r.verdict, 'nonvegan', t + ' -> ' + r.verdict + ' ' + JSON.stringify(r));
  });
}

test('reported Sam the Cooking Guy Thanksgiving turkey card is hidden', () => {
  const r = v('Your Thanksgiving Turkey Is About to Get a MASSIVE Upgrade!', ['SAM THE COOKING GUY']);
  assert.equal(r.verdict, 'nonvegan', JSON.stringify(r));
  assert.equal(r.topic, 'poultry');
});

test('a cooking-channel title "Turkey" is food; all-caps channel names still count', () => {
  assert.equal(v('Turkey', ['SAM THE COOKING GUY']).verdict, 'nonvegan');
  assert.equal(v('Turkey', ['Sam The Cooking Guy']).verdict, 'nonvegan');
  assert.equal(v('Turkey', ['Chef John']).verdict, 'nonvegan');
  assert.equal(v('Turkey').verdict, 'neutral');
});

const NOT_FOOD = [
  'Turkey',
  'Travel to Turkey',
  'Visit Turkey this summer',
  'Turkey Election Results Spark Protests in Ankara',
  'Elections in Turkey',
  'Turkey vacation packages',
  'holiday in turkey',
  'holiday to turkey',
  'cold turkey',
  'turkey vulture',
  'Turkish delight'
];
for (const t of NOT_FOOD) {
  test('not food: ' + t, () => {
    const r = v(t);
    assert.notEqual(r.verdict, 'nonvegan', t + ' -> ' + r.verdict + ' ' + JSON.stringify(r));
  });
}

test('geopolitics/travel turkey stays unflagged even on a cooking channel', () => {
  assert.notEqual(v('Turkey Election Results Spark Protests in Ankara', ['SAM THE COOKING GUY']).verdict, 'nonvegan');
  assert.notEqual(v('Travel to Turkey', ['SAM THE COOKING GUY']).verdict, 'nonvegan');
});

test('vegan-modifier turkey dishes stay vegan', () => {
  assert.equal(v('Vegan Thanksgiving Turkey').verdict, 'vegan');
  assert.equal(v('Tofurky').verdict, 'vegan');
  assert.equal(v('plant-based turkey roast').verdict, 'vegan');
  assert.equal(v('Vegan Thanksgiving Turkey', ['SAM THE COOKING GUY']).verdict, 'vegan');
});

test('CHANGELOG records holiday turkey and YouTube perf in 0.4.77', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.77/);
  assert.match(log, /Thanksgiving/i);
  assert.match(log, /unresponsive|performance|scroll/i);
});
