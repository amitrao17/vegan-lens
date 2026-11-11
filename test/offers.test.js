const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm');
const rd = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
const O = require('../offers.js');
const CC = require('../contentClassifier.js');
const shipped = JSON.parse(rd('coupons.json'));
const real = { id: 'r1', brand: 'Test Brand', categories: ['milk', 'cheese'], text: '10% off', code: 'T10', url: 'https://brand.test/p', expires: '2030-01-01', source: 'https://cert.test/b', certified: 'Certified Vegan', example: false };
const ctx = (o = {}) => ({ categories: ['milk'], today: '2026-10-28', showExample: false, pageVegan: false, shownOnPage: false, enabled: true, ...o });

test('shipped coupons.json: exactly one, clearly example, no real brand', () => {
  assert.strictEqual(shipped.length, 1); const e = shipped[0];
  assert.strictEqual(e.example, true); assert.match(e.brand, /^Example Oat Co\. \(example data\)$/); assert.match(e.url, /^https:\/\/example\.com/);
  assert.strictEqual(O.validate(shipped).length, 1);
});
test('category mapping from chip topics, labels, fabric queries', () => {
  assert.deepStrictEqual(O.categoriesFor('cheese'), ['cheese']);
  assert.ok(O.categoriesFor(['milk', 'butter']).includes('butter'));
  assert.ok(O.categoriesFor('honey').includes('honey'));
  assert.ok(O.categoriesFor('beef').includes('meat')); assert.ok(O.categoriesFor('seafood').includes('fish'));
  assert.ok(O.categoriesFor('vegan leather boots').includes('shoes')); assert.ok(O.categoriesFor('down alternative coat').includes('coats'));
  assert.ok(O.categoriesFor('leather handbag').includes('bags')); assert.deepStrictEqual(O.categoriesFor('animal sports', 'polo'), []);
});
test('matching picks offer for matching category only', () => {
  assert.strictEqual(O.pick([real], ctx()).id, 'r1');
  assert.strictEqual(O.pick([real], ctx({ categories: ['shoes'] })), null);
  assert.strictEqual(O.pick([real], ctx({ categories: [] })), null);
});
test('expiry: expired offers never show; expiry day inclusive', () => {
  assert.strictEqual(O.pick([{ ...real, expires: '2026-10-27' }], ctx()), null);
  assert.ok(O.pick([{ ...real, expires: '2026-10-28' }], ctx()));
});
test('max 1 per page, never on vegan pages, off when toggle off', () => {
  assert.strictEqual(O.pick([real], ctx({ shownOnPage: true })), null);
  assert.strictEqual(O.pick([real], ctx({ pageVegan: true })), null);
  assert.strictEqual(O.pick([real], ctx({ enabled: false })), null);
});
test('example offers hidden unless dev flag', () => {
  assert.strictEqual(O.pick(shipped, ctx()), null);
  assert.strictEqual(O.pick(shipped, ctx({ showExample: true })).id, 'example-oat-001');
  assert.strictEqual(O.OFFER_DEFAULTS.showExampleOffers, false); assert.strictEqual(O.OFFER_DEFAULTS.showOffers, true);
});
test('schema validation drops bad entries', () => {
  assert.strictEqual(O.validate([{ ...real, url: 'http://brand.test' }, { ...real, categories: ['puppies'] }, { ...real, expires: '2030/1/1' }, { ...real, example: 'no' }, null, real]).length, 1);
  assert.deepStrictEqual(O.validate({}), []);
});
test('ref appended only by hrefFor (click time), only if present', () => {
  assert.strictEqual(O.hrefFor(real), 'https://brand.test/p');
  assert.strictEqual(O.hrefFor({ ...real, ref: 'ref=vl' }), 'https://brand.test/p?ref=vl');
  const src = rd('offers.js'); assert.match(src, /a\.href = o\.url;/); assert.match(src, /'click', e => \{ e\.stopPropagation\(\); a\.href = hrefFor\(o\)/);
  assert.match(src, /rel = 'noopener noreferrer'/); assert.match(src, /target = '_blank'/); assert.match(src, /Why this offer\?/); assert.match(src, /clipboard\.writeText/);
});
test('verdict unchanged: offers are pure and only rendered after classification', () => {
  const r = CC.classify('Best brisket recipe smoked beef', {}); const before = JSON.stringify(r);
  O.pick([real, { ...real, id: 'm', categories: ['meat'] }], ctx({ categories: O.categoriesFor(r.topic) })); assert.strictEqual(JSON.stringify(r), before);
  const w = rd('web.js'), a = w.slice(w.indexOf('function addOffer'), w.indexOf('// 0.4.28 shopping caution'));
  assert.doesNotMatch(a, /verdict\s*=/); assert.match(a, /pageCtx\.vegan/); assert.match(a, /offerShown/);
  assert.doesNotMatch(rd('content.js').slice(rd('content.js').indexOf('function addOffer'), rd('content.js').indexOf('function addOffer') + 600), /verdict\s*=/);
});
function loadBg(storage) {
  const calls = [], listeners = [];
  const chrome = { runtime: { getManifest: () => ({ version: 'test' }), getURL: p => 'chrome-extension://x/' + p, onMessage: { addListener: f => listeners.push(f) }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    storage: { local: { get: async () => storage, set: async v => Object.assign(storage, v) }, sync: { get: async d => ({ ...d, ...storage.sync }), set: async () => {} }, onChanged: { addListener() {} } },
    action: new Proxy({}, { get: () => () => Promise.resolve() }), tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} }, onActivated: { addListener() {} }, query: async () => [] },
    alarms: { create() {}, onAlarm: { addListener() {} } } };
  const fetch = async u => { calls.push(String(u)); const p = String(u).replace('chrome-extension://x/', ''); const body = fs.readFileSync(__dirname + '/../' + p, 'utf8'); return { ok: true, json: async () => JSON.parse(body) }; };
  const sb = { chrome, fetch, console, setTimeout, clearTimeout, URL, self: null };
  sb.self = sb; sb.importScripts = (...f) => f.forEach(x => vm.runInContext(rd(x), sb, { filename: x }));
  vm.createContext(sb); vm.runInContext(rd('background.js'), sb, { filename: 'background.js' });
  return { sb, calls, listeners };
}
test('no network with blank COUPONS_URL: only the packaged coupons.json is read', async () => {
  assert.match(rd('background.js'), /const COUPONS_URL = '';/);
  const { sb, calls } = loadBg({});
  const list = await vm.runInContext('getCoupons()', sb);
  assert.strictEqual(list.length, 1); assert.ok(calls.every(u => u.startsWith('chrome-extension://')), calls.join());
  assert.match(rd('background.js'), /fetch\(COUPONS_URL, \{ credentials: 'omit'/);
});
test('stats: rounded offersShown/offersClicked only, allowed by worker', () => {
  const { sb } = loadBg({});
  const rep = vm.runInContext("buildReport({ day: '2026-10-28', counts: {}, reveals: 0, offersShown: 7, offersClicked: 2 }, { showOffers: true })", sb);
  assert.strictEqual(rep.offersShown % 5, 0); assert.strictEqual(rep.offersClicked % 5, 0);
  assert.doesNotMatch(JSON.stringify(rep), /brand|example\.com|http/);
  const w = rd('telemetry/worker.js'); assert.match(w, /'offersShown', 'offersClicked'/);
  const b = rd('background.js'); assert.match(b, /msg\.k === 'offerShown' \|\| msg\.k === 'offerClicked'/);
});
test('popup toggles and disclosure present', () => {
  const h = rd('popup.html'); assert.match(h, /id="showOffers"/); assert.match(h, /<summary>Advanced<\/summary>[\s\S]*id="showExampleOffers"/);
  const D = 'Vegan Lens may show partner offers matched on your device. Some links may earn a commission that supports development and partner nonprofits. No browsing data is collected.';
  assert.ok(rd('CHROMEWEBSTORE.md').includes(D)); assert.ok(rd('docs/PARTNERS.md').includes(D));
  const m = JSON.parse(rd('manifest.json')); assert.ok(m.content_scripts.some(c => c.js.includes('web.js') && c.js.indexOf('offers.js') < c.js.indexOf('web.js') && c.js.includes('offers.js')));
  assert.ok(m.content_scripts.some(c => c.js.includes('content.js') && c.js.includes('offers.js')));
});
