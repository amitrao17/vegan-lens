// 0.4.70: Amazon Best Sellers / p13n list cards (zgbs, new-releases, etc.).
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { parse } = require('./helpers/minidom.js');
const V = require('../sites.js');
const C = require('../classifier.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const fx = parse(R('test/fixtures/amazon-bestsellers.html'));
const cards = fx.querySelectorAll("[id^='p13n-asin-index-']");

test('versions agree at 0.4.70', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.70');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.70');
});

test('bestsellers fixture has three p13n cards (vegan, suede, generic)', () => {
  assert.equal(cards.length, 3);
  assert.deepStrictEqual(cards.map(c => c.getAttribute('id')), ['p13n-asin-index-0', 'p13n-asin-index-1', 'p13n-asin-index-2']);
  assert.deepStrictEqual(cards.map(V.amazonIdOf), ['B0VLVEGAN1', 'B0756SS7HN', 'B094J7L6NY']);
  assert.deepStrictEqual(cards.map(V.amazonTitleOf), [
    "DREAM PAIRS Women's Vegan Leather Over The Knee Boots | Stretch Thigh High",
    "Shoe'N Tale Women Stretch Suede Chunky Heel Over The Knee Boots Thigh High for Women",
    "Hawkwell Women's Thigh High Fashion Boots Over The Knee Black Low Flat Heel Boots",
  ]);
});

test('title falls back to image alt when the line-clamp is missing', () => {
  const bare = parse('<div id="p13n-asin-index-9"><div data-asin="B0ALTTEST1"><a href="/dp/B0ALTTEST1"><img class="p13n-product-image" alt="Vegan Leather Ankle Boot"></a></div></div>');
  const card = bare.querySelector("[id^='p13n-asin-index-']");
  assert.equal(V.amazonTitleOf(card), 'Vegan Leather Ankle Boot');
  assert.equal(V.amazonIdOf(card), 'B0ALTTEST1');
});

test('amazonIdOf reads data-asin on a descendant, the faceout id, or a /dp/ href', () => {
  assert.equal(V.amazonIdOf(parse('<div id="p13n-asin-index-0"><div data-asin="B00CHILD01"></div></div>').querySelector("[id^='p13n-asin-index-']")), 'B00CHILD01');
  assert.equal(V.amazonIdOf(parse('<div id="p13n-asin-index-0"><div class="p13n-sc-uncoverable-faceout" id="B00FACEOUT"></div></div>').querySelector("[id^='p13n-asin-index-']")), 'B00FACEOUT');
  assert.equal(V.amazonIdOf(parse('<div id="p13n-asin-index-0"><a href="/dp/B00FROMHRF/ref=zg"></a></div>').querySelector("[id^='p13n-asin-index-']")), 'B00FROMHRF');
});

test('vegan leather is vegan, stretch suede stays non-vegan (leather), generic is unknown', () => {
  const v = cards.map(c => C.classify(V.amazonTitleOf(c), {}).verdict);
  assert.deepStrictEqual(v, ['vegan', 'non-vegan', 'unknown']);
  const suede = C.classify(V.amazonTitleOf(cards[1]), {});
  assert.ok(suede.matched.some(m => /leather/i.test(m)), suede.matched);
});

test('AMAZON_TILE_SEL matches each p13n card once and still matches search cards', () => {
  const tiles = fx.querySelectorAll(V.AMAZON_TILE_SEL);
  assert.equal(tiles.length, 3);
  const search = parse('<div data-component-type="s-search-result" data-asin="B00SEARCH1"><h2><a href="/dp/B00SEARCH1"><span>Vegan Cheese</span></a></h2></div>');
  assert.equal(search.querySelectorAll(V.AMAZON_TILE_SEL).length, 1);
});

test('content.js uses the shared tile selector, amazonIdOf, and line-clamp / image-alt titles', () => {
  const c = R('content.js'), s = R('sites.js');
  assert.match(s, /AMAZON_TILE_SEL/);
  assert.match(s, /id\^='p13n-asin-index-'/);
  assert.match(s, /p13n-sc-css-line-clamp/);
  assert.match(s, /p13n-product-image/);
  assert.match(s, /function amazonIdOf/);
  assert.match(c, /V\.AMAZON_TILE_SEL/);
  assert.match(c, /V\.amazonIdOf|asinOf = V\.amazonIdOf/);
  assert.match(R('manifest.json'), /\*:\/\/\*\.amazon\.com\/\*/);
});

test('CHANGELOG records Best Sellers / p13n coverage in 0.4.70', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.70/);
  assert.match(log, /Best Sellers/);
  assert.match(log, /p13n/);
});
