// 0.4.34: fixes from the v0.4.33 live check. No network.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const C = require('../classifier.js'); const W = require('../contentClassifier.js'); const U = require('../webUnits.js');
const PDB = require('../productdb.js'); const { parse } = require('./helpers/minidom.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('(1) Joyus-like drink page: food words never set NOT vegan', () => {
  const title = 'JØYUS Non-Alcoholic Red Wine, Dealcoholized Cabernet Sauvignon, 750ml';
  for (const body of ['A bold red that loves a charcuterie board, aged cheeses and grilled steak.', 'Perfect for date night: cheese boards, burgers or roast chicken.', 'Tasting notes: blackberry, oak. Cheese.'])
    for (const drink of [true, false]) assert.notEqual(C.classify(title + '\n' + body, { drink }).verdict, 'non-vegan', body);
  for (const [t, term] of [['Red wine. Fined with isinglass.', 'isinglass'], ['Cabernet fined with egg white', 'egg'], ['Milk stout with lactose', 'lactose'], ['Honey wine (mead)', 'honey'], ['Wine clarified with gelatin', 'gelatin'], ['Wine fined with casein', 'casein']]) {
    const r = C.classify(t, { drink: true }); assert.equal(r.verdict, 'non-vegan', t); assert.ok(r.matched.includes(term), t);
  }
  assert.equal(C.classify('Beef jerky with cheese', {}).verdict, 'non-vegan'); // not a drink
});
test('(2) image blur ignores cosmetic butter', () => {
  for (const a of ['Summer Fridays - Lip Butter Balm Treatment for Hydration + Nourishing', 'Summer Fridays Lip Butter Balm Treatment for Hydration + Nourishing Shea Butter', 'Whipped body butter'])
    for (const u of [true, false]) assert.equal(W.altBlur(a, {}, u).blur, false, a);
  assert.equal(W.altBlur('Garlic butter shrimp', {}, false).blur, true);
});
test('(3) vegan brand banner on Ulta e.l.f. pages', () => {
  const m = PDB.model({ brand: 'e.l.f.', verdict: 'vegan', matched: [], caution: [] }, null, { resolve: () => { throw new Error('no resolve'); } });
  assert.equal(m.head, '\u2713 Vegan brand (e.l.f.)'); assert.equal(m.source, 'vegan brand list'); assert.match(m.title, /Vegan brand list/);
  const r = C.classify('e.l.f. Cosmetics\nGlow Reviver Flavor Balms Lip Duo\nconditioning butter', { beauty: true });
  assert.equal(r.verdict, 'vegan'); assert.equal(r.whitelisted[0], 'e.l.f.');
  const doc = parse('<html><head><meta property="og:title" content="Glow Reviver Flavor Balms Lip Duo"></head><body><a href="/brand/elf-cosmetics">e.l.f. Cosmetics</a><h1>Pink Peppermint and Pumpkin Glaze Glow Reviver Flavor Balms Lip Duo</h1></body></html>');
  const i = PDB.fromDom(doc); assert.equal(i.brand, 'e.l.f. Cosmetics'); assert.match(i.name, /Flavor Balms Lip Duo/);
  const s = R('productdb.js');
  assert.match(s, /\|\| fromDom\(document\)/); assert.match(s, /VeganLensBrand\.mark/);
  assert.match(s, /if \(page\.brand && page\.verdict === 'vegan'\) return; \/\/ vegan brand: no lookup/);
});
test('(4) card-image blur only inside the dimmed unit\'s own post', () => {
  const doc = parse('<main><shreddit-post id="a"><div id="ua" data-vl-w="nonvegan">Brisket</div><img id="ia" alt=""></shreddit-post>' +
    '<shreddit-post id="b"><div id="ub" data-vl-w="neutral">Hibachi</div><img id="ib" alt=""></shreddit-post>' +
    '<div id="free"><img id="ifree" alt=""></div></main>');
  const g = id => doc.querySelector('#' + id);
  assert.equal(U.ownsImage(g('ua'), g('ia')), true);   // gallery image in the dimmed post's own container
  assert.equal(U.ownsImage(g('ua'), g('ib')), false);  // neighbouring post
  assert.equal(U.ownsImage(g('ub'), g('ia')), false);
  assert.match(R('web.js'), /U\.ownsImage\(el, i\)/);
});
