// 0.4.48 Facebook Marketplace sponsored tiles (live DOM 2026-10-30: off-site links, empty img alt, last line '\u200bAd').
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const { parse } = require('./helpers/minidom.js');
const M = require('../marketplace.js'), C = require('../classifier.js');
const item = (id, p, t, loc) => '<div><a href="https://www.facebook.com/marketplace/item/' + id + '/?ref=browse_tab"><div><img alt="" src="x"></div><div><span>' + p + '</span></div><div><span>' + t + '</span></div><div><span>' + loc + '</span></div></a></div>';
const ad = (href, alt, title, sub) => '<div><div><a href="' + href + '"><img alt="' + alt + '" src="y"></a></div><div aria-label="Open Menu" role="button"></div><a href="' + href + '"><div><span>' + title + '</span></div><div><span>' + sub + '</span></div><div><span>\u200bAd</span></div></a></div>';
const grid = tiles => parse('<div role="main"><div><span>Today\'s picks</span><div>' + tiles.join('') + '</div></div></div>');
const verdict = el => { const t = M.adText(el); const r = C.classify(t, {}); return r.verdict === 'non-vegan' && M.dairyFreeOnly(t, r.matched) ? 'skip' : r.verdict; };

test('ad tile found; neighbors (item links) are never ad tiles', () => {
  const doc = grid([item(1, '$0', 'Free landscape stones', 'Washington, DC'), ad('https://konjoun.com/products/x', '', 'Konjoun Barefoot', "The Toughest Barefoot Sock We've Ever Made"), item(2, '$0', 'Dough maker', 'Leesburg, VA')]);
  const tiles = M.adTiles(doc); assert.strictEqual(tiles.length, 1);
  assert.ok(!tiles[0].querySelector('a[href*="/marketplace/item/"]'));
  assert.match(M.adText(tiles[0]), /Konjoun Barefoot/); assert.doesNotMatch(M.adText(tiles[0]), /\bAd\b|Open Menu/);
});
test('as observed live (empty alt, leather text only in pixels): not flagged - no fabricated verdict', () => {
  const t = M.adTiles(grid([ad('https://konjoun.com/p', '', 'Konjoun Barefoot', "The Toughest Barefoot Sock We've Ever Made")]))[0];
  assert.notStrictEqual(verdict(t), 'non-vegan');
});
test("alt with text that says '...cowhide...': leather ad flagged (0.4.40 rule)", () => {
  const t = M.adTiles(grid([ad('https://konjoun.com/p', "May be an image of shoes and text that says 'Rubber wears through. Leather wears in. Full-grain cowhide gets better with use, not thinner.'", 'Konjoun Barefoot', "The Toughest Barefoot Sock We've Ever Made")]))[0];
  assert.match(M.adText(t), /cowhide/); assert.strictEqual(verdict(t), 'non-vegan');
});
test('aria-label on the tile image is read too', () => {
  const doc = parse('<div role="main"><div><div><a href="https://x.example/p"><div role="img" aria-label="Full-grain leather boots"></div></a><a href="https://x.example/p"><span>Brand</span><span>Built to last</span><span>Ad</span></a></div></div></div>');
  assert.strictEqual(verdict(M.adTiles(doc)[0]), 'non-vegan');
});
test('dairy-free cheese ad (Rebel Cheese) and plant leathers are not flagged', () => {
  assert.strictEqual(verdict(M.adTiles(grid([ad('https://l.facebook.com/l.php?u=rebelcheese', 'Shop now', 'Rebel Cheese', 'Dairy-Free Meltable Mozzarella')]))[0]), 'skip');
  assert.notStrictEqual(verdict(M.adTiles(grid([ad('https://x.example', '', 'Desserto', 'Cactus leather tote, built to last')]))[0]), 'non-vegan');
  assert.strictEqual(C.classify('Dairy-Free Meltable Mozzarella', {}).verdict, 'vegan');
});
test('normal listings unchanged (0.4.36 live-animal rule)', () => {
  const p = M.cardParts('$450\nGreat Pyrenees Puppies\nWoodford, VA'); assert.strictEqual(M.animalListing(p.title, '', p.price), 'sale');
  assert.strictEqual(M.adTiles(grid([item(3, '$20', 'Leather jacket', 'Columbia, MD')])).length, 0);
});
test('wiring: marketplace.js also on facebook.com (SPA nav), self-gated; web.js stands down on /marketplace', () => {
  const m = JSON.parse(fs.readFileSync(__dirname + '/../manifest.json', 'utf8'));
  assert.ok(m.content_scripts.some(c => c.js.includes('marketplace.js') && c.matches.includes('*://*.facebook.com/*')));
  const mp = fs.readFileSync(__dirname + '/../marketplace.js', 'utf8'); assert.match(mp, /if \(!on\(\) \|\| !onMp\(\)\) return;/); assert.match(mp, /scanAds\(\)/);
  assert.match(fs.readFileSync(__dirname + '/../web.js', 'utf8'), /const active = \(\) => !\(.*facebook.*marketplace/);
  assert.match(fs.readFileSync(__dirname + '/../share.js', 'utf8'), /__vlShareInit/);
});
