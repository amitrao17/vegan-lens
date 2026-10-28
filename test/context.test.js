const test = require('node:test');
const assert = require('node:assert');
const { detectTopics } = require('../contextTopics.js');
const { classify } = require('../contentClassifier.js');
const { computeBadge } = require('../badge.js');
const cards = require('../cards.json');
const MINK = "Bird Flu Is Raging on a Mink Farm. It Could Spark a Human Pandemic, Experts Say, but Officials Won't Act.";

test('ProPublica mink headline -> fur farming + zoonotic, context (not dimmed)', () => {
  const r = detectTopics(MINK);
  assert.ok(r.topics.includes('fur_farming'), JSON.stringify(r));
  assert.ok(r.topics.includes('zoonotic'), JSON.stringify(r));
  assert.strictEqual(r.isContext, true);
});
const ctx = [
  ['Undercover footage shows conditions inside factory farms, report says', 'factory_farming'],
  ['H5N1 detected in dairy herds in three more states, USDA says', 'avian_flu'],
  ['Bycatch kills thousands of dolphins each year, study finds', 'fishing_oceans'],
  ['Meatpacking workers face injury risks, investigation finds', 'slaughter_workers'],
  ['Antibiotic use on farms fuels superbugs, scientists warn', 'antibiotics'],
  ['Cattle ranching drives Amazon deforestation, new report shows', 'climate_deforestation'],
  ['Beagles rescued from animal testing facility find new homes', 'animal_testing'],
  ['Live sheep export ban passes Australian parliament', 'live_export'],
  ['Experts warn wildlife markets could spark next pandemic', 'wildlife_markets'],
  ['Dairy farm workers test positive for bird flu, CDC says', 'dairy'],
];
for (const [h, topic] of ctx) test('context: ' + h, () => { const r = detectTopics(h); assert.ok(r.topics.includes(topic) && r.isContext, JSON.stringify(r)); });
const notCtx = [
  'Best BBQ Ribs Recipe for Summer', 'Stocks rise as Fed holds rates', 'New pandemic preparedness bill passes Senate',
  'How to cook the perfect steak', 'Kevin Bacon joins new thriller',
];
for (const h of notCtx) test('not context: ' + h, () => assert.strictEqual(detectTopics(h).isContext, false, JSON.stringify(detectTopics(h))));
test('recipes with topic words are not context', () => assert.strictEqual(detectTopics('Fish recipe: how to cook trawler-caught cod').isContext, false));

test('badge: red non-vegan+context count', () => assert.deepStrictEqual(computeBadge({ vegan: 3, nonvegan: 4, context: 1 }), { text: '5', color: '#B3261E' }));
test('badge: green vegan count when no non-vegan', () => assert.deepStrictEqual(computeBadge({ vegan: 7, nonvegan: 0 }), { text: '7', color: '#2E9D4A' }));
test('badge: empty when nothing', () => assert.strictEqual(computeBadge({}).text, ''));
test('badge: caps at 999+', () => assert.strictEqual(computeBadge({ nonvegan: 1500 }).text, '999+'));

test('cards.json: every detected topic has a card; every fact has an https source', () => {
  const { TOPICS } = require('../contextTopics.js');
  for (const t of TOPICS) {
    const c = cards.topics[t]; assert.ok(c, 'missing card ' + t);
    assert.ok(c.learn.url.startsWith('https://') && c.action.url.startsWith('https://'));
    for (const f of c.facts) assert.ok(f.source.startsWith('https://') && f.text.length < 260, t);
  }
});
test('mink headline still classified by content classifier without crashing', () => assert.ok(classify(MINK).verdict));
