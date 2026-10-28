const test = require('node:test');
const assert = require('node:assert');
const { classify } = require('../contentClassifier.js');
const cases = [
  ['The 10 Best Steakhouses in Chicago for a Juicy Ribeye', 'nonvegan'],
  ['How to Smoke BBQ Ribs Low and Slow', 'nonvegan'],
  ['Our Weekend Fishing Trip on Lake Erie: Trout Galore', 'nonvegan'],
  ['Easy Creamy Mac and Cheese Recipe with Three Cheeses', 'nonvegan'],
  ['Restaurant review: a decadent foie gras tasting menu', 'nonvegan'],
  ['Best Buffalo Wings in Town, Ranked', 'nonvegan'],
  ['Texas Brisket Cook-off Draws Record Crowd', 'nonvegan'],
  ['Lobster Roll Season: Where to Eat in Maine', 'nonvegan'],
  ['Opening Day of Deer Hunting Season: Tips for Hunters', 'nonvegan'],
  ['The Ultimate Cheese Board for Your Holiday Party', 'nonvegan'],
  ['Crispy Bacon and Eggs Breakfast Recipe', 'nonvegan'],
  ['Fur Coats Are Back on the Runway This Winter', 'nonvegan'],
  ['Crispy Tofu Stir-Fry: A 20 Minute Vegan Dinner', 'vegan'],
  ['Plant-Based Burgers Outsell Beef at Campus Dining', 'vegan'],
  ['How to Cook the Perfect Cauliflower Steak', 'vegan'],
  ['Inside a Farm Animal Sanctuary Rescuing Pigs', 'vegan'],
  ['Tempeh and Seitan: A Beginner Guide', 'vegan'],
  ['Undercover investigation exposes cruelty at factory farms raising chicken', 'vegan'],
  ['Why I Quit Meat After 30 Years of Eating Steak', 'vegan'],
  ['Impossible Burger vs Beyond Burger taste test', 'vegan'],
  ['Kevin Bacon Joins Cast of New Thriller', 'neutral'],
  ['Francis Bacon Painting Sells for $50 Million', 'neutral'],
  ['Rappers Squash Long-Running Beef With Joint Album', 'neutral'],
  ['Senate Leaders Play Chicken Over Debt Ceiling', 'neutral'],
  ['New Phishing Scam Targets Bank Customers', 'neutral'],
  ['Ham Radio Operators Help After the Hurricane', 'neutral'],
  ['Stocks Rise as Fed Holds Rates Steady', 'neutral'],
  ['Turkey Election Results Spark Protests in Ankara', 'neutral'],
  ['Apple Releases iOS Update With Bug Fixes', 'neutral'],
  ['Company Goes on Fishing Expedition for Customer Data', 'neutral'],
  ['Oat Milk Latte Prices Rise at Coffee Chains', 'vegan'],
];
for (const [h, want] of cases) test(h, () => { const r = classify(h); assert.strictEqual(r.verdict, want, JSON.stringify(r)); });
test('snippet contributes', () => {
  assert.strictEqual(classify({ headline: 'Weekend plans', snippet: 'We grilled steaks, burgers and BBQ ribs at the cookout' }).verdict, 'nonvegan');
});
test('sensitivity thresholds', () => {
  const h = 'Chicken soup for a cold day';
  assert.strictEqual(classify(h, { sensitivity: 'low' }).verdict, 'neutral');
  assert.strictEqual(classify(h, { sensitivity: 'high' }).verdict, 'nonvegan');
});
test('returns shape', () => { const r = classify('Best steak recipe'); assert.ok(Array.isArray(r.reasons) && typeof r.score === 'number' && r.topic === 'steak'); });
