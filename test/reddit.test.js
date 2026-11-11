// v0.4.24: Reddit vegan communities + industry-critique phrasing never dim.
const test = require('node:test');
const assert = require('node:assert');
const { classify, communityVegan } = require('../contentClassifier.js');
const T = 'Just learned about the dairy industry as a milk lover, what do I do now?';
const B = "I'm vegetarian and was planning to start a dairy farm. I researched how the dairy industry works and I'm trying to make it ethical.";
test('AskVegans dairy-industry post is not hidden', () => {
  for (const c of ['r/AskVegans', 'c/AskVegans', 'AskVegans', undefined]) {
    const r = classify({ headline: T, snippet: B, community: c });
    assert.notStrictEqual(r.verdict, 'nonvegan', String(c));
  }
  for (const s of ['low', 'med', 'high']) assert.notStrictEqual(classify({ headline: T, snippet: B }, { sensitivity: s }).verdict, 'nonvegan');
});
test('vegan community names', () => {
  for (const n of ['r/vegan', 'r/AskVegans', 'r/vegancirclejerk', 'r/PlantBasedDiet', 'r/veganrecipes', 'r/WFPB', 'c/vegan']) assert.ok(communityVegan(n), n);
  for (const n of ['r/exvegans', 'r/smoking', 'r/BBQ', '', null]) assert.ok(!communityVegan(n), String(n));
  assert.notStrictEqual(classify({ headline: 'Best brisket recipe', community: 'r/vegancirclejerk' }).verdict, 'nonvegan');
});
test('industry critique phrasing leans vegan', () => {
  for (const t of ['Is dairy ethical?', 'Dairy industry cruelty explained', 'How I quit dairy', 'Going vegan after learning about eggs', 'Is eating meat wrong?'])
    assert.notStrictEqual(classify(t).verdict, 'nonvegan', t);
});
test('controls still dim', () => {
  assert.strictEqual(classify({ headline: 'Best brisket recipe', community: 'r/smoking' }).verdict, 'nonvegan');
  assert.strictEqual(classify({ headline: 'Best brisket recipe', community: 'r/exvegans' }).verdict, 'nonvegan');
  assert.strictEqual(classify('Crispy Bacon and Eggs Breakfast Recipe').verdict, 'nonvegan');
});
