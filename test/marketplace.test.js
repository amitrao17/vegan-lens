const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const M = require('../marketplace.js'), C = require('../classifier.js');
const card = s => M.cardParts(s.replace(/ \| /g, '\n'));
const live = [ // real card texts from a Marketplace search
  ['Free | Puppies | Bowie, MD', 'adoption'], ['Free | German Sheppard puppies ready Nov 28th first shots and dewormed | King George, VA', 'adoption'],
  ['$100 | Puppies | Stephens City, VA', 'sale'], ['$450 | 🐾 Only 3 Great Pyrenees Puppies Left! 🐾 | Woodford, VA', 'sale'],
  ['Just listed | $2,000 | Puppies for sale | Fredericksburg, VA', 'sale'], ['$750 | Yorkiepoo female puppy | Dauphin, PA', 'sale'],
  ['$2,500 | Miniature bull terrier puppies | Bridgeton, NJ', 'sale'], ['Just listed | $855 | Puppies need rehoming | Hagerstown, MD', 'sale'],
  ['Partner listing | $37.20 | Ravensburger Puppies Collectie: Puppy En Beer, 500 Stukken, Puzzel, 500 Stukjes | Citrus Heights, CA', null],
];
for (const [s, want] of live) test('marketplace card: ' + s, () => { const p = card(s); assert.strictEqual(M.animalListing(p.title, '', p.price), want); });
test('adoption listings', () => {
  assert.strictEqual(M.animalListing('Sweet cat needs a forever home', '', 50), 'adoption');
  assert.strictEqual(M.animalListing('Rescue dog for adoption', 'Adoption fee covers shots', 150), 'adoption');
  assert.strictEqual(M.animalListing('Kittens free to a good home', '', 0), 'adoption');
  assert.strictEqual(M.animalListing('Rehoming my 2 rabbits', 'small rehoming fee', 40), 'adoption');
  assert.strictEqual(M.animalListing('AKC Golden puppies, rehoming', 'breeder, deposits taken', 1500), 'sale');
});
test('animal supplies and lookalikes are not animal listings', () => {
  for (const t of ['Large dog crate', 'Chicken coop with run', 'Cat tree tower', 'Dodge Ram 1500', 'Wireless mouse', 'Horse saddle', 'Fish tank 55 gallon'])
    assert.strictEqual(M.animalListing(t, '', 50), null, t);
});
test('card title parsing drops price, tags and location', () => {
  assert.deepStrictEqual(card('Just listed | $130 | $180 | Dark Brown Vegan Leather Chesterfield Sofa | Baltimore, MD'), { title: 'Dark Brown Vegan Leather Chesterfield Sofa', price: 130 });
});
test('furniture from the live search: leather dims, vegan/faux not, plain sofa gets caution', () => {
  assert.strictEqual(C.classify('Genuine Leather Sofa', {}).verdict, 'non-vegan');
  assert.notStrictEqual(C.classify('Dark Brown Vegan Leather Chesterfield Sofa', {}).verdict, 'non-vegan');
  assert.notStrictEqual(C.classify('Faux Leather Sectional with Ottoman', {}).verdict, 'non-vegan');
  assert.ok(C.classify('Mario Bellini Camaleonda Sofa', {}).caution.length);
});
test('wiring: manifest, popup toggle, web.js excluded on Marketplace', () => {
  const m = JSON.parse(fs.readFileSync(__dirname + '/../manifest.json', 'utf8'));
  assert.ok(m.content_scripts.some(c => c.js.includes('marketplace.js') && c.matches.includes('*://*.facebook.com/marketplace*')));
  assert.ok(m.content_scripts.find(c => c.js.includes('web.js')).exclude_matches.includes('*://*.facebook.com/marketplace*'));
  assert.match(fs.readFileSync(__dirname + '/../popup.html', 'utf8'), /id="marketplace"/);
});
