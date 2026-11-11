// 0.4.49 opt-in aggregate image-context stats (sizing on-device OCR). Numbers only, deduped per image / ad unit.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const { parse } = require('./helpers/minidom.js');
const A = require('../adUnits.js');
const rd = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');

test('meaningful images: icons, decorative and presentation images are skipped', () => {
  const d = parse('<div><img alt="" width="600" height="400"><img alt="" width="24" height="24"><img role="presentation" width="600" height="400"><img aria-hidden="true" width="300" height="300"><div role="img" aria-label="x"></div></div>');
  const imgs = d.querySelectorAll('img, [role=img]');
  assert.deepStrictEqual(imgs.map(A.imgMeaningful), [true, false, false, false, true]); // unmeasurable role=img counts
});
test('described: alt / aria-label / text-that-says; UI glyph labels do not count', () => {
  const d = parse('<div><img alt="Full-grain leather boots"><img alt="May be an image of text that says \'Leather wears in\'"><img alt="Shop now"><img alt="play"><img alt=""><div role="img" aria-label="cheese board"></div></div>');
  assert.deepStrictEqual(d.querySelectorAll('img, [role=img]').map(A.imgDescribed), [true, true, false, false, false, true]);
});
test('unit text: boilerplate (Ad, Sponsored, prices, menu/player buttons) is not context', () => {
  assert.ok(A.unitTextless('\u200bAd · Sponsored · Open Menu · Shop now · $19.99 · 0:00 / 0:34'));
  assert.ok(A.unitTextless('Konjoun Barefoot'));
  assert.ok(!A.unitTextless("Konjoun Barefoot The Toughest Barefoot Sock We've Ever Made"));
  assert.doesNotMatch(A.meaningfulText('Ad Sponsored $5'), /\S/);
});
test('contextless image = no description AND textless unit (the Konjoun-style case)', () => {
  const d = parse('<div><img alt="" width="600" height="600"></div>');
  const img = d.querySelector('img');
  assert.strictEqual(A.imageContextless(img, 'Konjoun Barefoot · Ad'), true);
  assert.strictEqual(A.imageContextless(img, "Konjoun Barefoot · The Toughest Barefoot Sock We've Ever Made · Ad"), false);
  const d2 = parse('<div><img alt="ribeye steak" width="600" height="600"></div>');
  assert.strictEqual(A.imageContextless(d2.querySelector('img'), 'Ad'), false);
});
test('ad breakdown: images / textless', () => {
  assert.deepStrictEqual(A.adImageStats(parse('<div><a href="https://konjoun.com"><img alt="" width="600" height="600"></a><span>Konjoun Barefoot</span></div>')), { images: true, textless: true });
  assert.deepStrictEqual(A.adImageStats(parse('<div><img alt="leather boots" width="600" height="600"></div>')), { images: true, textless: false });
  assert.deepStrictEqual(A.adImageStats(parse('<div><img alt="" width="20" height="20"><span>Text ad</span></div>')), { images: false, textless: false });
});
test('background: opt-in gated (bumpStats), counts only, rounded in report', () => {
  const b = rd('background.js');
  assert.match(b, /msg\.k === 'img'\)[\s\S]*?bumpStats\(st => \{ const a = st\.images/);
  assert.match(b, /msg\.k === 'adImg'\)[\s\S]*?bumpStats\(st => \{ const a = st\.adImages/);
  assert.match(b, /const \{ shareStats \} = await chrome\.storage\.sync\.get\(\{ shareStats: false \}\); if \(!shareStats\) return;/);
  assert.match(b, /images: imagesReport\(st\), adImages: adImagesReport\(st\)/);
  assert.match(b, /round5\(\(st\.images/); assert.match(b, /round5\(\(st\.adImages/);
  const w = rd('telemetry/worker.js'); assert.match(w, /'images', 'adImages'\]\)/);
});
test('content side: dedupe markers, no text/URL in the messages', () => {
  const web = rd('web.js'), mp = rd('marketplace.js');
  assert.match(web, /img\.dataset\.vlImgStat = '1'/); assert.match(web, /if \(el\.dataset\.vlAdStat\) return; el\.dataset\.vlAdStat = '1'/);
  assert.match(mp, /img\.dataset\.vlImgStat = '1'/);
  for (const src of [web, mp]) for (const m of src.match(/sendMessage\(\{ type: 'stat', k: '(?:img|adImg)'[^}]*\}/g)) { const keys = [...m.matchAll(/(\w+):/g)].map(x => x[1]); assert.ok(keys.length >= 4 && keys.every(k => ['type', 'k', 'n', 'contextless', 'undecided', 'images', 'textless'].includes(k)), m); }
});
test('About tab wording and disclosures', () => {
  assert.match(rd('popup.js'), /Images with no description or text: /); assert.match(rd('popup.js'), /\(ads: /);
  assert.match(rd('popup.html'), /id="adImgStats"/);
  assert.match(rd('CHROMEWEBSTORE.md'), /imagesContextless/); assert.match(rd('CHROMEWEBSTORE.md'), /never URLs, advertiser names, text or images/);
});
