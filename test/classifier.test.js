const test = require('node:test');
const assert = require('node:assert');
const { classify, lookupOpenFoodFacts } = require('../classifier.js');
const cases = [
  ['Daiya Dairy-Free Cheddar Style Shreds, Vegan Cheese', 'vegan'],
  ['Beyond Meat Plant-Based Burger Patties', 'vegan'],
  ['Kraft Macaroni & Cheese Dinner, 7.25 oz', 'non-vegan'],
  ['Organic Whole Milk, 1 Gallon', 'non-vegan'],
  ['Silk Unsweetened Almond Milk', 'vegan-or-unknown'],
  ['Haribo Goldbears Gummi Candy', 'unknown'],
  ['Ingredients: sugar, glucose syrup, gelatin, citric acid', 'non-vegan'],
  ['Ingredients: oats, cane sugar, sea salt. Milk-free, egg-free', 'unknown'],
  ['Allergy friendly cookies - Dairy Free and Egg Free', 'vegan'],
  ['Vegan Leather Tote Bag for Women', 'vegan'],
  ['Genuine Leather Wallet for Men', 'non-vegan'],
  ['Merino Wool Hiking Socks', 'non-vegan'],
  ["Burt's Bees Beeswax Lip Balm", 'non-vegan'],
  ['Nature Nate\'s 100% Raw Honey', 'non-vegan'],
  ['Skippy Creamy Peanut Butter, 16.3 oz', 'unknown'],
  ['Vital Proteins Collagen Peptides Powder', 'non-vegan'],
  ['Certified Vegan Protein Powder - Pea & Rice', 'vegan'],
  ['Gummies made with no gelatin, pectin based', 'unknown'],
  ['Wild Caught Anchovy Fillets in Olive Oil', 'non-vegan'],
  ['Goose Down Comforter, Queen', 'non-vegan'],
  ['Ingredients: water, sugar, carmine (color)', 'non-vegan'],
  ['Eggplant Parmigiana Seasoning, plant-based', 'vegan'],
  ['Non-vegan dog treats with whey', 'non-vegan'],
  ['Ingredients: wheat flour, whey protein, salt', 'non-vegan'],
];
for (const [text, want] of cases) {
  test(text, () => {
    const r = classify(text);
    if (want === 'vegan-or-unknown') assert.notStrictEqual(r.verdict, 'non-vegan', JSON.stringify(r));
    else assert.strictEqual(r.verdict, want, JSON.stringify(r));
  });
}
test('lenient mode ignores honey', () => {
  assert.strictEqual(classify('Raw Clover Honey', { strictness: 'lenient' }).verdict, 'unknown');
  assert.strictEqual(classify('Raw Clover Honey', { strictness: 'strict' }).verdict, 'non-vegan');
});
test('matched ingredients reported', () => {
  assert.deepStrictEqual(classify('Milk chocolate with eggs and butter').matched.sort(), ['butter', 'egg', 'milk']);
});
test('Open Food Facts lookup parses tags', async () => {
  const mk = tags => async () => ({ ok: true, json: async () => ({ product: { ingredients_analysis_tags: tags } }) });
  assert.strictEqual(await lookupOpenFoodFacts('0123456789012', mk(['en:vegan'])), 'vegan');
  assert.strictEqual(await lookupOpenFoodFacts('0123456789012', mk(['en:non-vegan'])), 'non-vegan');
  assert.strictEqual(await lookupOpenFoodFacts('abc', mk([])), null);
});
