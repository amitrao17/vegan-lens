// v0.4.12: vegan page/channel context + plant "steaks" + meat-rejection phrasing (YouTube @Gesunde-Rezepte false positives).
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
test('pageVegan still dims a strong unnegated meat term with no plant word; off a vegan page old behaviour holds', () => {
  assert.strictEqual(C.classify('just potatoes and beef', YT).verdict, 'nonvegan');
  assert.strictEqual(C.classify('just potatoes and beef', { ...YT, pageVegan: true }).verdict, 'nonvegan');
  assert.strictEqual(C.classify('Smoked pork belly recipe', { ...YT, pageVegan: true }).verdict, 'nonvegan');
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
