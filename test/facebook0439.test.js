// 0.4.39: Facebook "about burgers" false positive; plant words in the unit rescue ambiguous foods; vegan author never dims.
const test = require('node:test'); const assert = require('node:assert');
const { classify } = require('../contentClassifier.js');
const { postAuthor, isFacebookHost } = require('../webUnits.js');
const POST = 'A diffusion model ran a million burger recipes through taste, nutrition and emissions, and the mushroom one won the blind trial 👇';
const NOETHICS = 'A diffusion model ran a million burger recipes and the mushroom one won the blind trial';
const el = (texts) => ({ getAttribute: () => null, querySelectorAll: () => texts.map(t => ({ innerText: t })) });
test('The Vegan Week post is not flagged', () => {
  for (const s of ['low', 'med', 'high']) assert.notStrictEqual(classify({ headline: POST, author: 'The Vegan Week' }, { sensitivity: s }).verdict, 'nonvegan');
  assert.notStrictEqual(classify({ headline: POST, alt: 'May be an image of burger', author: 'The Vegan Week' }).verdict, 'nonvegan');
});
test('same text from a non-vegan author: mushroom rescues the ambiguous burger', () => {
  for (const t of [POST, NOETHICS]) for (const s of ['low', 'med', 'high'])
    assert.notStrictEqual(classify({ headline: t, author: 'Food Science Daily' }, { sensitivity: s }).verdict, 'nonvegan', t + ' ' + s);
});
test('plant words anywhere in the unit rescue ambiguous foods', () => {
  for (const t of ['Black bean burger night', 'Sausages for the cookout, all made with seitan', 'Tofu nuggets and fries', 'Burgers tonight, lentil and walnut patties'])
    assert.notStrictEqual(classify(t).verdict, 'nonvegan', t);
});
test('explicit meat still flagged', () => {
  assert.strictEqual(classify({ headline: 'Double bacon cheeseburger deal', author: 'Burger Barn' }).verdict, 'nonvegan');
  assert.strictEqual(classify('Best beef burgers in town').verdict, 'nonvegan');
  assert.strictEqual(classify('Beef burgers with mushroom sauce').verdict, 'nonvegan');
});
test('vegan author never hidden, even mentioning beef', () => {
  assert.notStrictEqual(classify({ headline: 'Why we stopped making beef burgers', author: 'The Vegan Week' }).verdict, 'nonvegan');
  assert.notStrictEqual(classify({ headline: 'Best beef burgers in town', author: 'The Vegan Week' }).verdict, 'nonvegan');
  for (const a of ['Ex-Vegan Life', 'Antivegan Memes', 'Nonvegan Grill']) assert.strictEqual(classify({ headline: 'Best beef burgers in town', author: a }).verdict, 'nonvegan', a);
});
test('post author extraction from header text', () => {
  assert.ok(isFacebookHost('www.facebook.com') && isFacebookHost('m.facebook.com') && !isFacebookHost('notfacebook.com'));
  assert.strictEqual(postAuthor(el(['The Vegan Week\n2h', 'Follow'])), 'The Vegan Week');
  assert.strictEqual(postAuthor(el(['Sponsored', 'Burger Barn'])), 'Burger Barn');
  assert.strictEqual(postAuthor(el([])), '');
});
