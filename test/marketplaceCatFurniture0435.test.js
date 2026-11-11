const test = require('node:test'); const assert = require('node:assert');
const { animalListing, cardParts } = require('../marketplace.js');
test('Cat Shelves $20 not flagged', () => {
  const p = cardParts('$20\nCat Shelves.\nChurchville, MD');
  assert.strictEqual(animalListing(p.title, '', p.price), null);
});
test('Large cat wheel $40 not flagged', () => {
  const p = cardParts('$40\nLarge cat wheel\nBaltimore, MD');
  assert.strictEqual(animalListing(p.title, '', p.price), null);
});
test('Wall mounted cat perches not flagged', () => { assert.strictEqual(animalListing('Wall mounted cat perches', '', 35), null); });
for (const t of ['Large cat wheel', 'Cat Shelves.', 'Dog crate XL', 'Horse saddle', 'Chicken coop', 'Cat tree', 'Rooster statue', 'Fish tank 20 gallon', 'Cat', 'Horse'])
  test('not flagged: ' + t, () => assert.strictEqual(animalListing(t, '', 40), null));
for (const [t, c] of [['Kittens for sale', 200], ['Puppies for sale', 800], ['Golden Retriever puppies 8 weeks', 1200], ['Laying hens $15 each', 15], ['Ragdoll kitten male', 900], ['Goats for sale', 250]])
  test('still flagged: ' + t, () => assert.strictEqual(animalListing(t, '', c), 'sale'));
test('Adoption listing left alone', () => { assert.strictEqual(animalListing('Cat for adoption', 'rescue, small rehome fee', 50), 'adoption'); });
