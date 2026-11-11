'use strict';
// 0.4.65 mixed-venue rule: a market/fair title whose vendor list includes animal products among produce gets a light label, not a hide.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
const C = require('../contentClassifier.js'); const R = require('../rules/rules.js');
const KENS = { headline: "Kensington Farmers' Market", snippet: 'Every Saturday year-round | 9 to 1. Local and regional vendors offer fresh baked goods, seasonal fruits and vegetables, organic meats, seafood, cheese, ...' };
test('farmers market snippet with seafood among produce is labelled, not hidden', () => {
  const r = C.classify(KENS, {}); assert.equal(r.verdict, 'discussion'); assert.equal(r.mixed, true); assert.equal(r.topic, 'seafood');
  for (const h of ['Downtown Holiday Market', 'Springfield Community Co-op', 'County Fair 2026']) assert.equal(C.classify({ ...KENS, headline: h }, {}).verdict, 'discussion', h);
});
test('dedicated seafood / meat listings stay hidden', () => {
  for (const p of [{ headline: 'Fresh Seafood Market | Buy Fresh Seafood Online', snippet: 'Buy fresh fish, shrimp, oysters and crab. Fresh vegetables sides too.' },
    { headline: 'Buy Fresh Seafood Near You', snippet: 'Lobster, crab, oysters delivered.' },
    { headline: "Joe's Fish Market", snippet: 'Fresh fish and seafood daily, plus produce.' },
    { headline: 'Farmers Market Butcher Stall', snippet: 'Grass-fed beef, pork and bacon.' }]) assert.equal(C.classify(p, {}).verdict, 'nonvegan', p.headline);
  // a market title with no plant goods in the unit keeps the normal verdict
  assert.equal(C.classify({ headline: 'Saturday Market', snippet: 'Organic meats, seafood, cheese and sausages.' }, {}).verdict, 'nonvegan');
});
test('rule data in rules.json; older lists back-filled; web.js mixed chip', () => {
  const b = JSON.parse(JSON.stringify(R.active())); b.listVersion = '2026.11.03.91';
  assert.ok(b.data.classifier.MIXED_VENUE.$re && b.data.classifier.MIXED_GOODS.$re);
  delete b.data.classifier.MIXED_VENUE; delete b.data.classifier.MIXED_GOODS; assert.ok(R.validate(b).ok, JSON.stringify(R.validate(b)));
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'web.js'), 'utf8'), /r\.mixed \? say\('mixed', 'Mixed listing: includes '\)/);
});
