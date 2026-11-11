// 0.4.33: fixes from the v0.4.31 live audit (exact audit titles).
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const C = require('../classifier.js'); const W = require('../contentClassifier.js'); const VB = require('../veganBrands.js'); const D = require('../dbLookup.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const v = (t, o) => C.classify(t, o || {}).verdict;

test('(1) drink pages: food pairings ignored', () => {
  assert.notEqual(v('Joyus Non-Alcoholic Cabernet Sauvignon Red Wine\nPairs well with cheese, steak and pasta', { drink: true }), 'non-vegan');
  assert.notEqual(v('Joyus Non-Alcoholic Cabernet Sauvignon. Pairs well with cheese.'), 'non-vegan');
  assert.notEqual(v('Pinot Noir red wine. Serve with steak or roast lamb.'), 'non-vegan');
  assert.notEqual(v('Guinness Nitrosurge stout. Goes great with burgers and oysters.'), 'non-vegan');
  // real animal ingredients in drinks still count
  assert.equal(v('Milk stout. Enjoy this ale made with lactose.'), 'non-vegan');
  assert.equal(v('Craft beer goes great with burgers. Brewed with honey.'), 'non-vegan');
  assert.equal(v('Red wine fined with isinglass'), 'non-vegan');
  // non-drink food is untouched
  assert.equal(v('Beef jerky. Pairs well with cheese.'), 'non-vegan');
});
test('(1) no food swaps on drink pages', () => {
  const s = R('content.js');
  assert.match(s, /const sw = isDrinkPage \? null : swapEl\(/);
  assert.match(s, /C\.isDrink\(title\)\) \? null : swapEl\(/);
  assert.ok(C.isDrink('Joyus Non-Alcoholic Cabernet Sauvignon')); assert.ok(!C.isDrink('Burt\'s Bees Lip Balm'));
});
test('(2) cosmetic butters are not dairy', () => {
  assert.notEqual(v('Summer Fridays Lip Butter Balm', { beauty: true }), 'non-vegan');
  assert.notEqual(v('Summer Fridays Lip Butter Balm'), 'non-vegan');
  assert.notEqual(v('e.l.f. Flavor Balms Lip Duo\nconditioning butter, vitamin E', { beauty: true }), 'non-vegan');
  for (const b of ['shea butter', 'cocoa butter', 'mango butter', 'murumuru butter', 'body butter', 'whipped body butter'])
    assert.notEqual(v('Moisturizer with ' + b), 'non-vegan', b);
  // still flagged
  assert.equal(v('Body lotion with dairy butter', { beauty: true }), 'non-vegan');
  assert.equal(v('Lip balm with milk', { beauty: true }), 'non-vegan');
  assert.equal(v("Burt's Bees 100% Natural Moisturizing Lip Balm, beeswax, lanolin", { beauty: true }), 'non-vegan');
  assert.equal(v('Salted butter 1 lb'), 'non-vegan'); // food untouched
  assert.equal(v('Garlic butter shrimp'), 'non-vegan');
});
test('(3) verified 100%-vegan cosmetics brands', () => {
  for (const t of ['e.l.f. Flavor Balms Lip Duo', 'e.l.f. Glow Reviver Lip Oil Stick', 'Milk Makeup Hydro Grip Primer', 'Pacifica Beauty Vegan Collagen', 'KVD Beauty Tattoo Liner', 'Youth To The People Superfood Cleanser'])
    assert.ok(VB.match(t).length, t);
  for (const t of ['Kosas Weightless Lip Color', 'Briogeo Honey Mask', 'Fenty Beauty Gloss Bomb', 'tarte Shape Tape', 'ColourPop Lux Lipstick', 'Shelf organizer'])
    assert.equal(VB.match(t).length, 0, t);
});
test('(4) alt blur: audit images in non-dimmed units stay sharp', () => {
  for (const a of ['r/BBQ - Grilled perfection on a stick', 'r/BBQ - Any love for Hibachi?', 'pizza skulls', 'cowboy soup with vegetables', 'Pizza skulls with pepperoni', 'a bowl of cowboy soup with ground beef and vegetables'])
    assert.equal(W.altBlur(a, {}, true).blur, false, a);
  assert.equal(W.cleanAlt('r/BBQ - Grilled perfection on a stick'), 'Grilled perfection on a stick');
  assert.equal(W.altBlur('r/BBQ - Grilled perfection on a stick', {}, false).blur, false); // subreddit name alone never blurs
  // high-confidence alts still blur even in an undimmed unit; normal alts blur outside units
  assert.equal(W.altBlur('pernil pork shoulder roast', {}, true).blur, true);
  assert.equal(W.altBlur('smoked brisket sliced on a cutting board', {}, true).blur, true);
  assert.equal(W.altBlur('teriyaki chicken', {}, false).blur, true);
  assert.equal(W.altBlur('teriyaki chicken', {}, true).blur, false);
  assert.match(R('web.js'), /C\.altBlur\(t, S, undimmed\)/);
});
test('(5) probably banner: details in tooltip, one line', () => {
  const s = R('content.js');
  assert.match(s, /d\.textContent = det \+ \(ingredients \|\| rowsNote/);
  assert.match(s, /rowsNote\.replace\(\/\^ · \/, ''\)/);
  assert.match(R('content.css'), /#vl-banner\.vl-banner-probably\{flex-wrap:nowrap!important;white-space:nowrap/);
});
test('(6) OBF "different product type: food" falls back to Open Food Facts', async () => {
  const urls = [];
  const f = async url => { urls.push(url); return { ok: true, json: async () => url.includes('openbeautyfacts')
    ? { code: '0609332833050', status: 0, status_verbose: 'product found with a different product type: food' }
    : { code: '0609332833050', status: 1, product: { code: '0609332833050', product_name: 'e.l.f. Glow Reviver Cara-Melt Lip Oil Stick', ingredients_analysis_tags: ['en:vegan'] } } }; };
  const r = await D.lookup('obf', { code: '609332833050' }, { fetch: f });
  assert.equal(urls.length, 2); assert.match(urls[1], /openfoodfacts/);
  assert.ok(r); assert.equal(r.source, 'Open Food Facts');
});
test('(7) pigs in a blanket', () => {
  assert.equal(W.classify('Jalapeño Popper Pigs in a Blanket', {}).verdict, 'nonvegan');
  assert.equal(W.classify('Pig in a Blanket Bites', {}).verdict, 'nonvegan');
  assert.notEqual(W.classify('Vegan Pigs in a Blanket', {}).verdict, 'nonvegan');
  assert.equal(v('Pigs in a Blanket, frozen, 24 ct'), 'non-vegan');
  assert.notEqual(v('Vegan pigs in a blanket'), 'non-vegan');
});
