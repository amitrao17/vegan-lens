// 0.4.71: plant-protein modifiers, contrast/renounce phrasing, and vegan-named YouTube creators.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../contentClassifier.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const YT = { requireHeadline: true };
const TITLE = "I Stopped Buying Ribeyes - This Lion's Mane Steak Is Better";
const TITLE_CURLY = "I Stopped Buying Ribeyes - This Lion\u2019s Mane Steak Is Better";

test('versions agree at 0.4.72', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.72');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.72');
});

test("Lion's Mane Steak title is vegan, including a curly apostrophe", () => {
  for (const t of [TITLE, TITLE_CURLY, "Lion's Mane Steak", "Lion\u2019s Mane Mushroom Steak"]) {
    const r = C.classify({ headline: t }, YT);
    assert.equal(r.verdict, 'vegan', t + ' -> ' + r.verdict + ' ' + r.reasons);
  }
});

test('channel PlantbasedBrandon is vegan context, not food evidence', () => {
  const r = C.classify({ headline: TITLE, creators: ['PlantbasedBrandon'] }, YT);
  assert.equal(r.verdict, 'vegan');
  assert.ok(r.reasons.includes('+vegan/plant-based creator'), r.reasons);
  for (const a of ['plantbasedbrandon', 'Plant-Based Kitchen', 'Vegan Chef', 'Plant-Powered Cook']) {
    assert.equal(C.classify({ headline: TITLE, creators: [a] }, YT).verdict, 'vegan', a);
    assert.ok(C.communityVegan(a), a);
  }
});

test('Best Ribeye Steak Recipe still dims, even from a vegan-named channel', () => {
  assert.equal(C.classify({ headline: 'Best Ribeye Steak Recipe' }, YT).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'Best Ribeye Steak Recipe', creators: ['PlantbasedBrandon'] }, YT).verdict, 'nonvegan');
});

test('Mushroom Steak and other plant-modifier steaks are vegan', () => {
  for (const t of ['Mushroom Steak', 'Cauliflower Steak', 'Tofu steak', 'Seitan steaks', 'Jackfruit steak', 'Eggplant steak', 'Watermelon steak', 'Beet steak', 'Carrot steak']) {
    assert.equal(C.classify({ headline: t }, YT).verdict, 'vegan', t);
  }
});

test('stopped eating plants and only eat steak is not cleared', () => {
  const r = C.classify({ headline: 'I stopped eating plants and only eat steak' }, YT);
  assert.notEqual(r.verdict, 'vegan', r);
});

test('renouncing an animal food is neutralized only when a plant alternative is present', () => {
  assert.equal(C.classify({ headline: 'I Stopped Buying Ribeyes' }, YT).verdict, 'nonvegan');
  assert.equal(C.classify({ headline: 'I quit bacon for tofu scrambles' }, YT).verdict, 'vegan');
  assert.equal(C.classify({ headline: 'I gave up steak — this jackfruit is better' }, YT).verdict, 'vegan');
  assert.notEqual(C.classify({ headline: 'No more ribeyes, I cook cauliflower instead' }, YT).verdict, 'nonvegan');
});

test('0.4.59 still strips creator names so they are not food evidence', () => {
  assert.equal(C.classify({ headline: 'Stand-up with Jason Salmon', creators: ['Jason Salmon'] }, YT).verdict, 'neutral');
});

test('CHANGELOG records the plant-steak / contrast / vegan-creator rule', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.71/);
  assert.match(log, /Lion'?s Mane/i);
  assert.match(log, /PlantbasedBrandon|plant-based creator|vegan-named/i);
  assert.match(log, /stopped buying/i);
});
