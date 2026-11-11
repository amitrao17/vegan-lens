'use strict';
// 0.4.64: fur/leather need positive material evidence; names (Für Elise, Fur Affinity, German 'für') and bare tokens in music/arts units are not evidence.
const test = require('node:test'); const assert = require('node:assert');
const C = require('../contentClassifier.js'); const R = require('../rules/rules.js');
const v = (t, c) => C.classify({ headline: t, creators: c }, { requireHeadline: true }).verdict;
test('music/arts titles with fur are not flagged', () => {
  assert.notEqual(v('Fur Elise - Beethoven | Complete Ukulele Fingerstyle TAB | Grade 7 | Low G and Baritone', ['MK Fingerstyle Academy']), 'nonvegan');
  for (const t of ['Für Elise piano tutorial', 'Fur Elise (Beethoven) easy piano', 'Musik für Kinder', 'Fur Affinity drawing stream', 'Leather - guitar cover']) assert.notEqual(v(t), 'nonvegan', t);
});
test('fur/leather products stay flagged; faux fur stays vegan', () => {
  for (const t of ['Real Fox Fur Coat Haul', 'Mink fur trim parka', 'Genuine leather jacket review', 'Fur coat drawing tutorial']) assert.equal(v(t), 'nonvegan', t);
  assert.notEqual(v('Faux fur throw blanket'), 'nonvegan');
});
test('rule data in rules.json and back-filled for older lists', () => {
  const b = JSON.parse(JSON.stringify(R.active())); b.listVersion = '2026.11.04.90';
  for (const k of ['MATERIAL_NAMES', 'ARTS_CTX', 'MATERIAL_PRODUCT', 'ARTS_MATERIAL']) { assert.ok(b.data.classifier[k].$re, k); delete b.data.classifier[k]; }
  assert.ok(R.validate(b).ok, JSON.stringify(R.validate(b)));
});
