'use strict';
// 0.4.62 noun-head rule: an animal word that modifies equipment/supplies is not evidence of an animal product.
const test = require('node:test'); const assert = require('node:assert');
const C = require('../contentClassifier.js'); const K = require('../classifier.js'); const R = require('../rules/rules.js');
const web = t => C.classify(t, {}).verdict, store = t => K.classify(t).verdict;
const EQUIP = ['TITANKIT PRO 60 in. x 164 ft. 14 Gauge Reinforced Hot-Dip Galvanized Poultry Fencing, Expertly Woven',
  'TITANKIT PRO 48 in. x 100 ft. 19-Gauge Galvanized Poultry Fencing, 1/2 Grid with High Corrosion Resistance',
  'chicken wire', 'Chicken Coop Kit', 'Fish Tank Filter', 'Galvanized Chicken Wire Mesh Roll', 'Cattle Panel 16 ft.', 'Pig Ear Tag Applicator',
  'Automatic Egg Incubator 24 Eggs', 'Poultry Waterer 5 Gallon', 'Chick Brooder Heat Lamp', 'Fishing Line 20 lb Monofilament', 'Rabbit Hutch with Run', 'Bee Hive Frames and Supplies'];
const FOOD = ['Chicken Breast', 'Rotisserie Chicken', 'Frozen Fish Fillets', 'Crispy Chicken Quesadillas — Not Fried!', 'Chicken Breast Tenders Family Pack', 'Chicken Wing Sauce Recipe', 'Fish and Chips Night', 'Grilled Chicken and Rice Bowls'];
test('equipment titles are not flagged (web classifier)', () => { for (const t of EQUIP) assert.notEqual(web(t), 'nonvegan', t); });
test('equipment titles are not flagged (store classifier)', () => { for (const t of EQUIP.slice(0, 8)) assert.notEqual(store(t), 'non-vegan', t); });
test('food stays flagged', () => {
  for (const t of FOOD) assert.equal(web(t), 'nonvegan', t);
  for (const t of ['Chicken Breast Boneless Skinless', 'Wild Salmon Fillets', 'Rotisserie Chicken']) assert.equal(store(t), 'non-vegan', t);
  assert.equal(C.classify('Crispy Chicken Quesadillas — Not Fried!', { requireHeadline: true }).topic, 'poultry');
});
test('rule lives in rules.json; an older list without it is back-filled, other missing keys still rejected', () => {
  const b = JSON.parse(JSON.stringify(R.active())); b.listVersion = '2026.11.03.90';
  assert.ok(b.data.classifier.EQUIPMENT_HEAD && b.data.classifier.EQUIPMENT_HEAD.$re);
  delete b.data.classifier.EQUIPMENT_HEAD; assert.ok(R.validate(b).ok, JSON.stringify(R.validate(b)));
  delete b.data.classifier.ANIMAL; assert.equal(R.validate(b).ok, false);
});
