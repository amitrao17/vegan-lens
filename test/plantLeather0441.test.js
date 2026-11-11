// 0.4.41: plant-based leathers count as vegan in both classifiers; real-leather words still win.
const test = require('node:test'); const assert = require('node:assert');
const CC = require('../contentClassifier.js'), PC = require('../classifier.js');
const notDim = t => { assert.notStrictEqual(CC.classify(t).verdict, 'nonvegan', 'web: ' + t); assert.notStrictEqual(PC.classify(t, {}).verdict, 'non-vegan', 'product: ' + t); };
const dim = t => { assert.strictEqual(CC.classify(t).verdict, 'nonvegan', 'web: ' + t); assert.strictEqual(PC.classify(t, {}).verdict, 'non-vegan', 'product: ' + t); };
test('plant leathers not dimmed', () => {
  for (const t of ['Cactus leather sneakers', 'Apple leather tote', 'Piñatex jacket', 'Pinatex jacket', 'Mushroom leather boots', 'Mycelium leather bag', 'Cork leather wallet', 'Grape leather handbag', 'Pineapple leather sneakers', 'Bio-based leather jacket', 'Leather alternative wallet', 'Leatherette chair', 'Leather-look boots'])
    notDim(t);
});
test('real leather still dimmed', () => {
  dim('Genuine leather wallet');
  dim('Cactus leather and genuine leather wallet');
});
test('Konjoun cowhide ad still flagged', () => {
  const ALT = 'May be an image of shoes and text that says "Rubber wears through. Leather wears in. Full-grain cowhide gets better with use, not thinner."';
  const r = CC.classify({ headline: "The Toughest Barefoot Sock We've Ever Made", snippet: "Worried a barefoot sock won't survive the first month? . Rubber wears through. Leather wears in. Full-grain cowhide gets better with use, not thinner.", alt: ALT });
  assert.strictEqual(r.verdict, 'nonvegan');
});
