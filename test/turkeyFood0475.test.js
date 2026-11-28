// 0.4.75: "turkey" as food (a cut, dish or recipe) is non-vegan; Turkey the country,
// travel, Turkish, "cold turkey" and "turkey vulture" are not.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../contentClassifier.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('versions agree at 0.4.80', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.80');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.80');
});

const FOOD = [
  'Cider-Braised Turkey Thighs With Potatoes and Apples',
  'Turkey Thighs',
  'Braised Turkey',
  'Turkey breast sandwich',
  'Smoked turkey wings',
  'Brined turkey',
  'Turkey gravy',
  'Roast Turkey',
  'French Bread Stuffing With Pancetta, Figs and Hazelnuts',
  'Gluten-Free Brown Butter Pumpkin Pie',
  'Duck confit',
  'Ham sandwich'
];
const NOT_FOOD = [
  'Turkey',
  'Travel to Turkey',
  'Visit Turkey this summer',
  'Turkey Election Results Spark Protests in Ankara',
  'Elections in Turkey',
  'Turkey vacation packages',
  'cold turkey',
  'turkey vulture',
  'Turkish delight',
  'Duck dynasty',
  'Ham radio'
];

for (const t of FOOD) {
  test('food: ' + t, () => {
    const r = C.classify({ headline: t });
    assert.equal(r.verdict, 'nonvegan', t + ' -> ' + r.verdict + ' ' + JSON.stringify(r));
  });
}
for (const t of NOT_FOOD) {
  test('not food: ' + t, () => {
    const r = C.classify({ headline: t });
    assert.notEqual(r.verdict, 'nonvegan', t + ' -> ' + r.verdict + ' ' + JSON.stringify(r));
  });
}

test('AMBIG_FOOD_CTX is a compiled rule and later key', () => {
  const rules = JSON.parse(R('rules/rules.json'));
  assert.ok(rules.data.classifier.AMBIG_FOOD_CTX);
  assert.match(rules.data.classifier.AMBIG_FOOD_CTX.$re, /thighs\?/);
  assert.match(R('rules/rules.js'), /AMBIG_FOOD_CTX/);
  assert.match(R('contentClassifier.js'), /foodCtx/);
});
