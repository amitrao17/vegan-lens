// v0.4.9: giantfood.com homepage "This Week's Ad" cards and promo tiles are classified; non-vegan ones hidden.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const V = require('../sites.js'), C = require('../classifier.js'), { parse } = require('./helpers/minidom.js');
const load = () => parse(fs.readFileSync(__dirname + '/fixtures/giant-home-promos.html', 'utf8'));
const S = { strictness: 'strict', whitelist: [], whitelistDisabled: [] };

test('finds the 5 weekly-ad cards and the 2 real promo tiles, one card each', () => {
  const cards = V.findPromoCards(load());
  assert.strictEqual(cards.length, 7);
  assert.ok(cards.every(c => c.getAttribute('data-vl-promo') === '1'));
  assert.ok(cards.slice(0, 5).every(c => c.tagName === 'LI'), 'weekly-ad card climbs to its carousel slot');
});
test('titles come from the name under the price, not price/coupon/button text', () => {
  const t = V.findPromoCards(load()).map(V.promoTitleOf);
  assert.deepStrictEqual(t.slice(0, 5), ['Fresh Chicken Drumsticks or Thighs', 'Salmon Fillets', 'Raspberries or Blackberries', 'Hass Avocados', 'Granny Smith, Cosmic Crisp, Fuji, Red Delicious Apples']);
  assert.match(t[5], /^5 for \$5 avocados/); assert.match(t[6], /^2\/\$4 Chobani Protein Flips/);
});
test('chicken and salmon are non-vegan (hidden); berries, avocados, apples and promo tiles are not', () => {
  const v = V.findPromoCards(load()).map(c => C.classify(V.promoTitleOf(c), S).verdict);
  assert.deepStrictEqual(v.slice(0, 2), ['non-vegan', 'non-vegan']);
  for (const x of v.slice(2)) assert.notStrictEqual(x, 'non-vegan');
});
test('wiring: grocery adapter includes promo cards; only non-vegan promos get marked, so they count in the hid-N notice', () => {
  const c = fs.readFileSync(__dirname + '/../content.js', 'utf8');
  assert.match(c, /tiles: \(\) => \[\.\.\.V\.findTiles\(document\), \.\.\.V\.findPromoCards\(document\)\]/);
  assert.match(c, /if \(el\.dataset\.vlPromo && r\.verdict !== 'non-vegan'\) return;/);
  assert.match(c, /querySelectorAll\('\[data-vl-hid\]'\)/);
});
