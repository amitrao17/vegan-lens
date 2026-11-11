// v0.4.23: vegan page/channel context + plant "steaks" + meat-rejection phrasing (YouTube @Gesunde-Rezepte false positives).
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const C = require('../contentClassifier.js');
const YT = { requireHeadline: true };
const CHANNEL = [ // live titles from youtube.com/@Gesunde-Rezepte/videos ("Healthy Recipes"; description doesn't say vegan)
  'Summer season is here, nobody wants meat anymore! These steaks are incredible!',
  'Forget everything, this kohlrabi steak is better than any diet.',
  'Vegan King Oyster Mushroom Steaks', 'Glazed Cabbage Steaks', 'Vegan Celery Steaks',
  'Since I discovered this vegan steak, no one asks for meat anymore!', 'Cabbage Tastes Better Than Meat', 'Meatless Goulash',
  'Garden Fish Sticks? The Best Vegan Surprise', 'Stuffed Peppers Without Meat!', 'No One Believes This Steak is Vegan! The Best Tofu Recipe',
];
for (const t of CHANNEL) test('alone, not non-vegan: ' + t, () => assert.notStrictEqual(C.classify(t, YT).verdict, 'nonvegan'));
test('vegetable steaks are plant food', () => {
  for (const v of ['cabbage', 'cauliflower', 'celery', 'kohlrabi', 'mushroom', 'oyster mushroom', 'king oyster', 'tofu', 'seitan', 'eggplant', 'beet', 'portobello', 'watermelon', 'jackfruit', 'tempeh', 'zucchini', 'celeriac', 'squash', 'carrot'])
    assert.notStrictEqual(C.classify('Grilled ' + v + ' steaks', YT).verdict, 'nonvegan', v);
});
test('meat-rejection phrases count as vegan signals', () => {
  for (const p of ['nobody wants meat anymore', 'no one asks for meat', 'no one misses meat', 'better than any meat', 'tastes better than meat', 'who needs meat'])
    { const r = C.classify('This dish: ' + p + '!', YT); assert.notStrictEqual(r.verdict, 'nonvegan', p); assert.ok(r.reasons.includes('+plant-based alternative'), p); }
});
test('channel context: >=20% (min 3) vegan titles, or a vegan header', () => {
  const v = CHANNEL.map(t => C.classify(t, YT).verdict);
  assert.ok(C.pageContext({ header: 'Healthy Recipes', verdicts: v }).vegan);
  assert.ok(!C.pageContext({ verdicts: ['vegan', 'vegan', 'neutral', 'nonvegan'].slice(0, 2).concat(Array(20).fill('neutral')) }).vegan, 'only 2 vegan');
  assert.ok(!C.pageContext({ verdicts: ['vegan', 'vegan', 'vegan', ...Array(13).fill('neutral')] }).vegan, '3/16 < 20%');
  assert.ok(C.pageContext({ verdicts: ['vegan', 'vegan', 'vegan', ...Array(12).fill('nonvegan')] }).vegan, '3/15 = 20%');
  for (const h of ['Plant-Based Kitchen', 'Vegan recipes every week', 'Vegane Rezepte', 'Meatless Mondays']) assert.ok(C.pageContext({ header: h }).vegan, h);
  assert.ok(!C.pageContext({ header: 'Healthy Recipes' }).vegan);
});
test('no title on the vegan channel dims (pageVegan)', () => {
  for (const t of CHANNEL) assert.notStrictEqual(C.classify(t, { ...YT, pageVegan: true }).verdict, 'nonvegan', t);
  assert.notStrictEqual(C.classify('These steaks are incredible!', { ...YT, pageVegan: true }).verdict, 'nonvegan');
  assert.notStrictEqual(C.classify('Cheesy burger night', { ...YT, pageVegan: true }).verdict, 'nonvegan');
});
test('pageVegan never dims (vegan channels use meaty words for plant dishes); off a vegan page old behaviour holds', () => {
  assert.strictEqual(C.classify('just potatoes and beef', YT).verdict, 'nonvegan');
  assert.notStrictEqual(C.classify('just potatoes and beef', { ...YT, pageVegan: true }).verdict, 'nonvegan');
  assert.notStrictEqual(C.classify('Smoked pork belly recipe', { ...YT, pageVegan: true }).verdict, 'nonvegan');
  assert.notStrictEqual(C.classify('my version of "chicken + rice!"', YT).verdict, 'nonvegan');
  assert.strictEqual(C.pageContext({ header: 'cooking plantbased food on YouTube for 10+ years', verdicts: [] }).vegan, true);
  assert.notStrictEqual(C.classify('Tofu "pork" belly', { ...YT, pageVegan: true }).verdict, 'nonvegan');
  assert.strictEqual(C.classify('These steaks are incredible!', YT).verdict, 'nonvegan');
});
test('wiring: web.js uses channel/header context, recomputes as cards load, re-checks dimmed cards, resets on undo', () => {
  const w = fs.readFileSync(__dirname + '/../web.js', 'utf8');
  assert.match(w, /\(\?:@\[\^\/\]\+\|channel\\\/\[\^\/\]\+\|c\\\/\[\^\/\]\+\)/);
  assert.match(w, /titleVerdicts\.set\(parts\.headline, r\.verdict\); updatePageCtx\(\);/);
  assert.match(w, /pageVegan: true/);
  assert.match(w, /C\.pageContext\(\{ header: headerText\(\)/);
  assert.match(w, /resetUnit\(u\); processUnit\(u\);/);
  assert.match(w, /pageCtx = \{ vegan: false, why: '' \}; headerChecked = false; titleVerdicts\.clear\(\);/);
});
test('header: plant based variants qualify', () => {
  const { pageContext } = require('../contentClassifier.js');
  for (const h of ['Easy plant based recipes', 'Plant-based cooking', 'PLANTBASED meals', '#plantbased', '100% plant powered kitchen', 'WFPB recipes']) assert.strictEqual(pageContext({ header: h, verdicts: [] }).vegan, true, h);
  assert.strictEqual(pageContext({ header: 'Healthy recipes', verdicts: [] }).vegan, false);
});

test('vegan pages drop the green edge marker', () => {
  const w = fs.readFileSync(__dirname + '/../web.js', 'utf8'), css = fs.readFileSync(__dirname + '/../web.css', 'utf8');
  assert.match(w, /classList\.add\('vl-page-vegan'\)/); assert.match(w, /classList\.remove\('vl-page-vegan'\)/);
  assert.match(css, /\.vl-page-vegan \.vl-w-vegan::before\{display:none/);
});

test('non-animal hunting is not hunting', () => {
  for (const t of ['Hunting Red Leaves With Satellites', 'Hunting for exoplanets with JWST', 'Storm chasers hunting tornadoes', 'Mushroom hunting in Oregon'])
    assert.notStrictEqual(C.classify(t, {}).verdict, 'nonvegan', t);
  assert.strictEqual(C.classify('Deer hunting season opens with record trophy hunt', {}).verdict, 'nonvegan');
});

test('animal-fabric shopping content dims; alternatives and lookalikes do not', () => {
  for (const t of ['Tired of boring, bulky winter jackets? These are the best wool coats for cozy, classic style', 'Best down jackets of 2026', 'Cashmere sweaters we love', 'Merino base layers tested', 'The best silk pillowcases'])
    assert.strictEqual(C.classify(t, {}).verdict, 'nonvegan', t);
  for (const t of ['Best vegan leather bags', 'Wool-free winter coats', 'Steel wool pads review', 'Faux wool coats under $100', 'Best down alternative comforters', 'Down jackets? Try these vegan puffers'])
    assert.notStrictEqual(C.classify(t, {}).verdict, 'nonvegan', t);
});
test('fabric content offers a vegan alternative search', () => {
  const q = t => C.fabricQuery(C.classify(t, {}));
  assert.strictEqual(q('Tired of boring, bulky winter jackets? These are the best wool coats for cozy, classic style'), 'vegan coat');
  assert.strictEqual(q('Best down jackets of 2026'), 'synthetic insulated jacket');
  assert.strictEqual(q('The best silk pillowcases'), 'satin pillowcase');
  assert.strictEqual(q('The best leather boots for fall'), 'vegan leather boots');
  assert.strictEqual(q('Just potatoes and beef'), null);
  assert.match(fs.readFileSync(__dirname + '/../web.js', 'utf8'), /S\.showSwaps && fabricSwap\(r\)/);
});
