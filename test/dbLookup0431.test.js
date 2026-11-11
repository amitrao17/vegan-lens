const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const rd = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
const D = require('../dbLookup.js'), C = require('../classifier.js'), CC = require('../contentClassifier.js'), PDB = require('../productdb.js'), U = require('../webUnits.js');
const { parse } = require('./helpers/minidom.js');
const mockFetch = (body, calls, ok = true) => async (url, opts) => { calls.push({ url, opts }); return { ok, json: async () => body }; };
const memStore = () => { let v = {}; return { get: async () => v, set: async x => { v = x; }, peek: () => v }; };

// ---- fix 1: honey shades
test('honey shade names are colours in cosmetics (Sephora audit title)', () => {
  for (const t of ['QuicklookCLINIQUEAlmost Lipstick in Black Honey and Pink Honey2 Colors5K$25.00Sponsored', 'Honey Nude Lip Gloss', 'Garnier Nutrisse Honey Blonde Hair Color'])
    assert.notStrictEqual(CC.classify(t).verdict, 'nonvegan', t);
  assert.notStrictEqual(C.classify('Clinique Almost Lipstick, Black Honey').verdict, 'non-vegan');
  assert.notStrictEqual(CC.classify('Honey Nude', { beauty: true }).verdict, 'nonvegan');
});
test('real honey still non-vegan', () => {
  assert.strictEqual(CC.classify('Burts Bees Honey Lip Balm').verdict, 'nonvegan');
  assert.strictEqual(C.classify('Lip balm. Ingredients: cera alba, honey, shea butter').verdict, 'non-vegan');
  assert.strictEqual(C.classify('Lipstick shade Black Honey. Ingredients: ricinus oil, honey extract', { beauty: true }).verdict, 'non-vegan');
  assert.strictEqual(CC.classify('Black Honey raw organic jar').verdict, 'nonvegan');
  assert.strictEqual(CC.classify('Honey-Roasted Squash With Spicy Peanut Sauce').verdict, 'nonvegan');
});
// ---- fix 2: missed meats (exact r/BBQ titles)
test('missed meats now dim', () => {
  for (const t of ['Smoked picanha', 'Smoked a Porketta Shoulder Roast for the first time', 'Planning on pit cooking a 185 lb pig, would love tips!', 'Porchetta for Sunday', 'Tri-tip on the kettle', 'Chuck roast burnt ends', 'Homemade pastrami', 'Braised short rib', 'Whole hog cookout', 'Brisket flat, 12 hours'])
    assert.strictEqual(CC.classify(t).verdict, 'nonvegan', t);
});
test('meat cuts: vegan versions and controls stay non-dimmed', () => {
  assert.notStrictEqual(CC.classify('Vegan pastrami from beets').verdict, 'nonvegan');
  assert.notStrictEqual(CC.classify('3rd Place Competition Pinto Beans').verdict, 'nonvegan');
  assert.notStrictEqual(CC.classify('Guinea pig care tips').verdict, 'nonvegan');
});
// ---- fix 3: blur scope
test('blur never takes another scanned unit\'s image (over-blur repro)', () => {
  // Reddit-like: dimmed text unit and a sibling unit (no h3) whose image sits in the shared wrapper.
  const doc = parse('<div class="feed"><div class="w"><div data-vl-w="nonvegan" class="t"><h3>Beef ribs</h3></div><div data-vl-w="neutral" class="m"><img src="other.jpg" width="300" height="200"></div></div></div>');
  assert.strictEqual(U.cardImages(doc.querySelector('div.t')).length, 0);
  // Allrecipes-home-like: image inside a different unit in the same row
  const d2 = parse('<div class="row"><div data-vl-w="neutral" class="a"><img src="stew.jpg" width="300" height="200"><span>Witches Brew</span></div><div data-vl-w="nonvegan" class="b"><span>Scary Baked Brie</span></div></div>');
  assert.strictEqual(U.cardImages(d2.querySelector('div.b')).length, 0);
});
test('blur still finds the unit\'s own sibling photo', () => {
  const doc = parse('<div class="c"><a href="/r/a"><figure><img src="a.jpg" width="300" height="200"></figure></a><div data-vl-w="nonvegan" class="meta"><h3>Rotisserie Chicken</h3></div></div>');
  assert.strictEqual(U.cardImages(doc.querySelector('div.meta'))[0].getAttribute('src'), 'a.jpg');
});
// ---- fix 4: banner
test('probably banner: short heading, wraps instead of squeezing', () => {
  const c = rd('content.js'), css = rd('content.css');
  assert.match(c, /verdict === 'probably' \? head : 'Vegan Lens: ' \+ head/); assert.match(c, /'Non-animal materials: '/);
  assert.match(css, /\.vl-banner\{[^}]*flex-wrap:wrap/); assert.match(css, /\.vl-banner>b\{white-space:nowrap/);
});
// ---- databases
test('OBF tags map: vegan / non-vegan / maybe / unknown; labels', () => {
  assert.strictEqual(D.mapProduct({ ingredients_analysis_tags: ['en:vegan'] }).verdict, 'vegan');
  assert.strictEqual(D.mapProduct({ ingredients_analysis_tags: ['en:non-vegan'] }).verdict, 'non-vegan');
  assert.strictEqual(D.mapProduct({ ingredients_analysis_tags: ['en:maybe-vegan'] }).verdict, 'maybe');
  assert.strictEqual(D.mapProduct({ ingredients_analysis_tags: ['en:vegan-status-unknown'] }).verdict, 'unknown');
  const l = D.mapProduct({ ingredients_analysis_tags: [], labels_tags: ['en:vegan', 'en:cruelty-free'] }); assert.strictEqual(l.verdict, 'vegan'); assert.ok(l.certified && l.crueltyFree);
});
test('OBF lookup by barcode: URL, credentials omitted, source credited', async () => {
  const calls = [];
  const v = await D.lookup('obf', { code: '0792850110991', brand: 'X', name: 'Y' }, { fetch: mockFetch({ status: 1, product: { code: '0792850110991', product_name: 'Balm', ingredients_analysis_tags: ['en:non-vegan'] } }, calls) });
  assert.strictEqual(v.verdict, 'non-vegan'); assert.strictEqual(v.source, 'Open Beauty Facts');
  assert.strictEqual(calls.length, 1); assert.match(calls[0].url, /^https:\/\/world\.openbeautyfacts\.org\/api\/v2\/product\/0792850110991\.json\?fields=/);
  assert.strictEqual(calls[0].opts.credentials, 'omit'); assert.strictEqual(calls[0].opts.referrerPolicy, 'no-referrer');
});
test('OBF search by brand+name: only a confident brand/name match is used', async () => {
  const body = { products: [{ brands: 'Other', product_name: 'Lip Balm', ingredients_analysis_tags: ['en:vegan'] }, { brands: 'Good Brand', product_name: 'Hydrating Lip Balm Vanilla', ingredients_analysis_tags: ['en:vegan'], code: '123' }] };
  const v = await D.lookup('obf', { brand: 'Good Brand', name: 'Hydrating Lip Balm' }, { fetch: mockFetch(body, []) }); assert.strictEqual(v.verdict, 'vegan');
  const n = await D.lookup('obf', { brand: 'Good Brand', name: 'Matte Liquid Foundation' }, { fetch: mockFetch(body, []) }); assert.strictEqual(n, null);
});
test('privacy: only barcode or brand+name are sent; URLs/junk stripped; nothing without allowed fields', async () => {
  const calls = [], f = mockFetch({ products: [] }, calls);
  await D.lookup('obf', { brand: 'Acme https://evil.example/track?id=1', name: 'Rouge <script> Lipstick', url: 'https://www.sephora.com/product/x', history: ['a'] }, { fetch: f });
  const u = new URL(calls[0].url); assert.strictEqual(u.origin, 'https://world.openbeautyfacts.org');
  assert.deepStrictEqual([...u.searchParams.keys()].sort(), ['fields', 'json', 'page_size', 'search_simple', 'search_terms']);
  assert.strictEqual(u.searchParams.get('search_terms'), 'Acme Rouge script Lipstick'); assert.doesNotMatch(calls[0].url, /sephora|evil|track/);
  assert.strictEqual(await D.lookup('off', { code: '12ab' }, { fetch: f }), null); assert.strictEqual(await D.lookup('obf', { name: 'only name' }, { fetch: f }), null);
  assert.strictEqual(await D.lookup('evil', { code: '12345678' }, { fetch: f }), null); assert.strictEqual(calls.length, 1);
});
test('cache: hits reuse storage within TTL, refetch after; failures not cached', async () => {
  const calls = [], store = memStore(); let now = 1e12;
  const deps = { fetch: mockFetch({ status: 1, product: { ingredients_analysis_tags: ['en:vegan'] } }, calls), store, now: () => now };
  await D.lookup('off', { code: '12345678' }, deps); await D.lookup('off', { code: '12345678' }, deps); assert.strictEqual(calls.length, 1);
  now += D.TTL_HIT + 1; await D.lookup('off', { code: '12345678' }, deps); assert.strictEqual(calls.length, 2);
  const s2 = memStore(); const bad = { fetch: async () => { throw new Error('offline'); }, store: s2 };
  assert.strictEqual(await D.lookup('off', { code: '87654321' }, bad), null); assert.deepStrictEqual(s2.peek(), {});
});
test('timeout: a hung request fails gracefully', async () => {
  const hang = (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  assert.strictEqual(await D.lookup('off', { code: '12345678' }, { fetch: hang, timeout: 30 }), null);
});
test('priority: database > ingredients > title; on-page animal ingredient wins as caution', () => {
  const db = v => ({ verdict: v, source: 'Open Beauty Facts' });
  assert.strictEqual(C.resolveDb({ verdict: 'unknown', matched: [] }, db('vegan')).verdict, 'vegan');
  assert.strictEqual(C.resolveDb({ verdict: 'vegan', matched: [] }, db('non-vegan')).verdict, 'non-vegan');
  const c = C.resolveDb({ verdict: 'non-vegan', matched: ['beeswax'] }, db('vegan'));
  assert.strictEqual(c.verdict, 'unknown'); assert.match(c.caution[0], /Open Beauty Facts.*vegan.*beeswax/);
  assert.strictEqual(C.resolveDb({ verdict: 'non-vegan', matched: ['honey'] }, db('maybe')).verdict, 'non-vegan');
  assert.strictEqual(C.resolveDb({ verdict: 'unknown', matched: [] }, null).source, 'page');
});
test('Sephora/Ulta JSON-LD extraction and banner tooltip source', () => {
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: 'Lip Glow Oil', brand: { '@type': 'Brand', name: 'Dior' }, gtin13: '3348901486385', description: 'Glossy oil' });
  const i = PDB.fromJsonLd([ld, 'not json']); assert.deepStrictEqual([i.code, i.brand, i.name], ['3348901486385', 'Dior', 'Lip Glow Oil']);
  const D2 = { resolve: C.resolveDb };
  const m = PDB.model({ verdict: 'unknown', matched: [], caution: [] }, { verdict: 'vegan', source: 'Open Beauty Facts', certified: true }, D2);
  assert.strictEqual(m.verdict, 'vegan'); assert.match(m.title, /from Open Beauty Facts \(vegan label\)/);
  const k = PDB.model({ verdict: 'non-vegan', matched: ['beeswax'], caution: [] }, { verdict: 'vegan', source: 'Open Beauty Facts' }, D2);
  assert.strictEqual(k.head, '⚠ Caution'); assert.match(k.title, /conflict/);
  assert.match(PDB.model({ verdict: 'unknown', matched: [], caution: [] }, null, D2).title, /from this page/);
});
test('Barnivore: no API, user-click link only', () => {
  assert.strictEqual(D.barnivoreUrl('Guinness Draught Stout https://x.y'), 'https://www.barnivore.com/search?keyword=Guinness%20Draught%20Stout');
  const c = rd('content.js'); assert.match(c, /Check on Barnivore/); assert.doesNotMatch(rd('background.js') + rd('dbLookup.js'), /fetch\([^)]*barnivore/i);
});
test('manifest/popup/disclosure: minimal hosts, toggle default on', () => {
  const m = JSON.parse(rd('manifest.json')); assert.deepStrictEqual(m.host_permissions, ['https://world.openfoodfacts.org/*', 'https://world.openbeautyfacts.org/*']);
  assert.ok(m.content_scripts.some(cs => cs.js.includes('productdb.js') && cs.matches.some(x => /sephora/.test(x))));
  assert.match(rd('popup.html'), /id="dbLookups"/); assert.match(rd('popup.js'), /dbLookups: true/);
  assert.match(rd('background.js'), /dbLookups: true \}\); if \(!dbLookups\) return null;/);
  const w = rd('CHROMEWEBSTORE.md'); assert.match(w, /Open Beauty Facts/); assert.match(w, /brand and product name/); assert.match(w, /Never|Nothing else is sent/);
});
