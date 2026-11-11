const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const C = require('../classifier.js');
const rd = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
const P = { allowProbably: true };
// Real data from https://www.amazon.com/dp/B09PDY4YWF (read 2026-10-29)
const TITLE = 'Apple Watch Series 7 (GPS, 41MM) - Green Aluminum Case with Clover Sport Band (Renewed)';
const BULLETS = 'About this item Always-on Retina display has nearly 20% more screen area than Series 6, making everything easier to see and use than ever before The most crack-resistant front crystal yet on an Apple Watch, IP6X dust resistance, and swimproof design just to name a few awesome features Take an anytime, anywhere - Get high and low heart rate, and irregular heart rhythm notifications - Measure your blood oxygen with a powerful sensor and app Track your daily activity on Apple Watch, and see your trends in the Fitness app - Stay in the moment with the new Mindfulness app, and reach your sleep goals with the Sleep app Track new tai chi and pilates workouts, in addition to favorites like running, yoga, swimming, and dance - Sync your favorite music, podcasts, and audiobooks - Pay instantly and securely from your wrist with Apple Pay';
const ATTR = [{ label: 'Operating System', value: 'WatchOS' }, { label: 'Band Material Type', value: 'Aluminum' }, { label: 'Case Material Type', value: 'Aluminum' }, { label: 'Brand', value: 'Apple' }];

test('B09PDY4YWF Apple Watch (aluminum case, sport band) -> probably vegan', () => {
  const r = C.classify([TITLE, '', BULLETS].join('\n'), { ...P, attributes: ATTR });
  assert.strictEqual(r.verdict, 'probably'); assert.deepStrictEqual(r.caution, []); assert.ok(r.probable.includes('aluminum'));
});
test('without opt-in the old caution verdict is kept (other callers unaffected)', () => {
  const r = C.classify(TITLE, { attributes: ATTR }); assert.strictEqual(r.verdict, 'unknown'); assert.ok(r.caution.length);
});
test('animal word anywhere wins', () => {
  assert.strictEqual(C.classify('Apple Watch Aluminum Case with Leather Link band', P).verdict, 'non-vegan');
  assert.notStrictEqual(C.classify(TITLE + '\nPremium silk strap included', { ...P, attributes: ATTR }).verdict, 'probably');
  assert.notStrictEqual(C.classify('Smartwatch', { ...P, attributes: [{ label: 'Band Material Type', value: 'Genuine Leather, Stainless Steel' }] }).verdict, 'probably');
  assert.notStrictEqual(C.classify('Stainless steel watch with mother of pearl dial', P).verdict, 'probably');
  assert.notStrictEqual(C.classify('Boots with wool lining, rubber sole', P).verdict, 'probably');
});
test('listing titles: caution category + non-animal material -> probably', () => {
  for (const t of ['Silicone Band Compatible with Apple Watch 41mm', 'Smartwatch with Nylon Sport Loop', 'Titanium Watch for Men', 'Faux Leather Wallet for Men', 'Rubber Rain Boots for Women'])
    assert.strictEqual(C.classify(t, P).verdict, 'probably', t);
});
test('no material listed or not a caution item -> unchanged', () => {
  assert.strictEqual(C.classify('Smartwatch for Men', P).verdict, 'unknown');
  assert.strictEqual(C.classify('Stainless Steel Water Bottle', P).verdict, 'unknown');
  assert.strictEqual(C.classify('Bone conduction headphones titanium', P).verdict, 'unknown');
});
test('explicit vegan and non-vegan verdicts are not downgraded', () => {
  assert.strictEqual(C.classify('Vegan leather watch band', P).verdict, 'vegan');
  assert.strictEqual(C.classify('Milk chocolate', P).verdict, 'non-vegan');
});
test('UI: pill, tooltip, lighter green, counts', () => {
  const c = rd('content.js'), css = rd('content.css');
  assert.match(c, /'vl-badge-probably'/); assert.match(c, /Probably vegan/); assert.match(c, /Listed materials are non-animal \(e\.g\. aluminum, silicone\) \\u2014 not certified|Listed materials are non-animal \(e\.g\. aluminum, silicone\) — not certified/);
  assert.match(css, /\.vl-badge-probably\{background:#7cc58f/); assert.match(c, /probably: 0, nonvegan: 0/);
  assert.match(c, /allowProbably: true/);
});
