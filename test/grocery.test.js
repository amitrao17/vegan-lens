const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const V = require('../sites.js');
const C = require('../classifier.js');
const W = require('../swaps.js');
// Fake DOM with a tiny compound-selector matcher: tag, #id, .class, [attr], [attr=v], [attr^=v], [attr*=v i]; comma lists.
function matchOne(e, sel) {
  const re = /^([a-z0-9-]+|\*)?((?:#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?)*)$/i;
  const m = sel.trim().match(re); if (!m) return false;
  if (m[1] && m[1] !== '*' && e.tagName !== m[1].toUpperCase()) return false;
  for (const p of m[2].match(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?/g) || []) {
    if (p[0] === '#') { if (e.attrs.id !== p.slice(1)) return false; }
    else if (p[0] === '.') { if (!(e.attrs.class || '').split(' ').includes(p.slice(1))) return false; }
    else if (p[0] === ':') { if (p.startsWith(':not')) { if (matchOne(e, p.slice(5, -1))) return false; } }
    else { const a = p.slice(1, -1).match(/^([\w-]+)(?:([\^*]?=)["']?([^"'\]]*?)["']?(\s+i)?)?$/); const v = e.attrs[a[1]];
      if (v == null) return false; if (!a[2]) continue;
      const [x, y] = a[4] ? [String(v).toLowerCase(), a[3].toLowerCase()] : [String(v), a[3]];
      if (a[2] === '=' ? x !== y : a[2] === '^=' ? !x.startsWith(y) : !x.includes(y)) return false; }
  }
  return true;
}
const splitSel = s => s.split(/,(?![^\[]*\])/);
function el(tag, kids = [], attrs = {}) {
  if (typeof kids === 'string') kids = [kids];
  const n = { tagName: tag.toUpperCase(), attrs, parentElement: null, getAttribute: k => attrs[k] ?? null };
  n.kids = kids.filter(k => typeof k !== 'string'); n.kids.forEach(k => k.parentElement = n);
  Object.defineProperty(n, 'textContent', { get: () => kids.map(k => typeof k === 'string' ? k : k.textContent).join(' ') });
  Object.defineProperty(n, 'childElementCount', { get: () => n.kids.length });
  const all = () => n.kids.flatMap(k => [k, ...k._all()]); n._all = all;
  n.matches = sel => splitSel(sel).some(x => matchOne(n, x));
  n.querySelectorAll = sel => all().filter(e => e.matches(sel));
  n.querySelector = sel => n.querySelectorAll(sel)[0] || null;
  n.closest = sel => { for (let e = n; e; e = e.parentElement) if (e.matches(sel)) return e; return null; };
  n.contains = o => o === n || all().includes(o);
  return n;
}
const doc = kids => el('body', kids);
const tile = (name, href, price = '$3.99', tag = 'li', attrs = {}) => el(tag, [el('a', [el('img', [], { alt: name })], { href }), el('h3', [name]), el('span', [price])], attrs);
// Detail-page classification the same way content.js does it.
function detail(parts) {
  const g = V.groceryDetailText(parts); const r = C.classify(g.text, {});
  if (g.allergens.animal.length && r.verdict !== 'non-vegan' && !(r.whitelisted.length && r.verdict === 'vegan')) { r.verdict = 'non-vegan'; r.matched = g.allergens.animal.map(V.allergenLabel); }
  return r;
}

test('siteOf: grocery banners vs amazon', () => {
  for (const h of ['giantfood.com', 'www.giantfood.com', 'stopandshop.com', 'martinsfoods.com', 'giantfoodstores.com']) assert.strictEqual(V.siteOf(h), 'grocery', h);
  assert.strictEqual(V.siteOf('www.amazon.com'), 'amazon');
  assert.strictEqual(V.siteOf('notgiantfood.com'), null);
  assert.strictEqual(V.siteOf('giantfood.com.evil.io'), null);
});
test('mode defaults: grocery hides, Amazon unaffected', () => {
  assert.strictEqual(V.effectiveMode('grocery', {}), 'hide');
  assert.strictEqual(V.effectiveMode('grocery', { mode: 'badge' }), 'hide');
  assert.strictEqual(V.effectiveMode('grocery', { groceryMode: 'dim' }), 'dim');
  assert.strictEqual(V.effectiveMode('grocery', { groceryMode: 'bogus' }), 'hide');
  assert.strictEqual(V.effectiveMode('amazon', { mode: 'dim', groceryMode: 'hide' }), 'dim');
  assert.strictEqual(V.effectiveMode('amazon', {}), 'dim');
});
test('allergens: "Contains: Milk, Egg" -> milk + egg', () => {
  const a = V.parseAllergens('Contains: Milk, Egg.');
  assert.deepStrictEqual(a.animal, ['milk', 'egg']); assert.deepStrictEqual(a.contains, ['Milk', 'Egg']);
  assert.deepStrictEqual(V.parseAllergens('Allergens: Contains: Wheat, Soy and Shellfish (Shrimp)').animal, ['shellfish']);
  assert.deepStrictEqual(V.parseAllergens('CONTAINS: FISH (ANCHOVY)').animal, ['fish']);
});
test('allergens: "may contain" / facility statements are not ingredients', () => {
  assert.deepStrictEqual(V.parseAllergens('May contain milk.').animal, []);
  assert.deepStrictEqual(V.parseAllergens('Contains: Wheat. May contain milk and egg.').animal, []);
  assert.deepStrictEqual(V.parseAllergens('Manufactured in a facility that also processes milk, eggs and fish.').animal, []);
  assert.deepStrictEqual(V.parseAllergens('Contains: Soy. Made on shared equipment with milk').animal, []);
});
test('detail: Contains: Milk -> non-vegan even if ingredients look clean', () => {
  const r = detail({ name: 'Giant Chocolate Chip Cookies', ingredients: 'Flour, sugar, chocolate chips (sugar, cocoa)', allergens: 'Contains: Milk, Wheat' });
  assert.strictEqual(r.verdict, 'non-vegan'); assert.ok(r.matched.includes('milk'));
});
test('detail: May contain milk is NOT non-vegan', () => {
  const r = detail({ name: 'Dark Chocolate Bar', ingredients: 'Cocoa mass, sugar, cocoa butter. May contain milk.', allergens: 'May contain milk' });
  assert.notStrictEqual(r.verdict, 'non-vegan');
});
test('detail: shellfish allergen maps to classifier label', () => {
  const r = detail({ name: 'Seasoning Mix', ingredients: 'salt, spices', allergens: 'Contains: Shellfish' });
  assert.strictEqual(r.verdict, 'non-vegan'); assert.deepStrictEqual(r.matched, ['shrimp']);
});
test('detail: Vegan label -> vegan', () => {
  const r = detail({ name: 'Oat Bites', ingredients: 'oats, sugar, salt', allergens: 'Contains: Oats', labels: 'Vegan' });
  assert.strictEqual(r.verdict, 'vegan');
});
test('detail: built-in vegan brand still loses to a Contains: Milk statement only when brand not whitelisted by user', () => {
  const r = detail({ name: 'Whole Milk Yogurt', ingredients: 'cultured milk', allergens: 'Contains: Milk' });
  assert.strictEqual(r.verdict, 'non-vegan');
});
test('product hrefs', () => {
  assert.ok(V.isProductHref('/product/giant-whole-milk-gallon/12345'));
  assert.ok(V.isProductHref('https://giantfood.com/groceries/product/x/9'));
  assert.ok(!V.isProductHref('/product-search/milk'));
  assert.ok(!V.isProductHref('/browse-aisles/categories/1/dairy'));
});
test('tiles: generic li with product link + price, one per product', () => {
  const grid = el('ul', [tile('Giant Whole Milk', '/product/giant-whole-milk/1'), tile('Silk Oat Milk', '/product/silk-oat/2'), tile('Large Eggs', '/product/eggs/3')]);
  const d = doc([el('main', [el('div', [el('h2', ['Results']), grid])])]);
  const ts = V.findTiles(d);
  assert.strictEqual(ts.length, 3); assert.ok(ts.every(t => t.tagName === 'LI'));
  assert.deepStrictEqual(ts.map(V.titleOfTile), ['Giant Whole Milk', 'Silk Oat Milk', 'Large Eggs']);
  assert.strictEqual(V.idOfTile(ts[0]), '/product/giant-whole-milk/1');
});
test('tiles: div cards without li stop at the smallest priced ancestor', () => {
  const card = n => el('div', [el('div', [el('a', [n], { href: '/product/' + n.replace(/\W+/g, '-') + '/7' })]), el('div', ['$2.50'])], { class: 'x' });
  const d = doc([el('div', [card('Butter'), card('Hummus')], { class: 'grid' })]);
  const ts = V.findTiles(d); assert.strictEqual(ts.length, 2); assert.ok(ts.every(t => t.attrs.class === 'x'));
});
test('tiles: explicit product-card hooks are used, nested hooks deduped', () => {
  const t = el('div', [el('div', [el('a', ['Cheddar Cheese'], { href: '/product/cheddar/5' }), el('span', ['$4'])], { 'data-testid': 'product-card-inner' })], { 'data-testid': 'ProductTile-123' });
  const ts = V.findTiles(doc([t]));
  assert.strictEqual(ts.length, 1); assert.strictEqual(ts[0], t);
});
test('tiles: links without price or non-product links are ignored', () => {
  const d = doc([el('nav', [el('a', ['Dairy'], { href: '/browse-aisles/dairy' }), el('div', [el('a', ['Milk'], { href: '/product/milk/1' })])])]);
  assert.strictEqual(V.findTiles(d).length, 0);
});
test('tiles: sponsored detection', () => {
  assert.ok(V.isSponsored(el('li', [el('span', ['Sponsored']), el('a', ['x'], { href: '/product/x/1' })])));
  assert.ok(!V.isSponsored(tile('Rice', '/product/rice/1')));
});
test('tile titles classify', () => {
  assert.strictEqual(C.classify('Giant Whole Milk, 1 gal').verdict, 'non-vegan');
  assert.strictEqual(C.classify('Oatly Oat Milk Original').verdict !== 'non-vegan', true);
});
test('swap URL uses the grocery site search', () => {
  assert.strictEqual(V.swapUrl('https://giantfood.com', 'Oatly oat milk'), 'https://giantfood.com/product-search/Oatly%20oat%20milk');
  assert.strictEqual(V.swapUrl('https://stopandshop.com', 'Just Egg'), 'https://stopandshop.com/product-search/Just%20Egg');
  assert.strictEqual(V.swapUrl('https://evil.example', 'x'), 'https://giantfood.com/product-search/x');
  const r = C.classify('Giant Whole Milk'); const sw = W.pickSwap(r.matched, 'Giant Whole Milk');
  assert.strictEqual(V.swapUrl('https://giantfood.com', sw.query), 'https://giantfood.com/product-search/Oatly%20oat%20milk');
});
test('hidden notice text', () => { assert.strictEqual(V.hiddenNotice(12), 'Vegan Lens hid 12 non-vegan items'); assert.strictEqual(V.hiddenNotice(1), 'Vegan Lens hid 1 non-vegan item'); });
test('manifest: grocery hosts run content.js (with sites.js), excluded from generic web script', () => {
  const m = require('../manifest.json'); const [shop, web] = m.content_scripts;
  for (const g of V.GROCERY_MATCHES) { assert.ok(shop.matches.includes(g), g); assert.ok(web.exclude_matches.includes(g), g); }
  assert.ok(shop.js.indexOf('sites.js') >= 0 && shop.js.indexOf('sites.js') < shop.js.indexOf('content.js'));
  assert.ok(shop.matches.includes('*://*.amazon.com/*'));
  assert.deepStrictEqual(m.host_permissions, ['https://world.openfoodfacts.org/*']);
});
test('popup: grocery mode setting defaults to hide', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8'), js = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');
  assert.match(html, /<select id="groceryMode"><option value="hide">/);
  assert.match(js, /groceryMode: 'hide'/); assert.match(js, /'groceryMode'/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8'), /groceryMode: 'hide'/);
});
test('content.js never reorders results', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
  assert.ok(!/\.prepend\(|insertBefore\(el|appendChild\(el\)|\.sort\(/.test(s));
});
