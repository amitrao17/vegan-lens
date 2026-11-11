// v0.4.25: dimmed card's photo outside the chosen element (sibling figure / wrapping link) gets blurred too.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const { parse } = require('./helpers/minidom.js');
const U = require('../webUnits.js'), C = require('../contentClassifier.js');
const card = (t, src) => `<div class="c"><a href="/r/${src}"><figure><img src="${src}.jpg" width="300" height="200"></figure></a><div class="meta"><h3><a href="/r/${src}">${t}</a></h3><p>45 min</p></div></div>`;
test('Honey-Roasted Squash is honey (dimming correct)', () => {
  const r = C.classify('Honey-Roasted Squash With Spicy Peanut Sauce'); assert.strictEqual(r.verdict, 'nonvegan'); assert.strictEqual(r.topic, 'honey');
});
test('sibling figure image is found for a text-only card element', () => {
  const doc = parse('<section><h2>Recipes</h2><div class="row">' + card('Honey-Roasted Squash With Spicy Peanut Sauce', 'a') + card('Crispy Tofu Bowls', 'b') + '</div></section>');
  const metas = doc.querySelectorAll('div.meta');
  const im = U.cardImages(metas[0]);
  assert.strictEqual(im.length, 1); assert.strictEqual(im[0].getAttribute('src'), 'a.jpg');
  assert.strictEqual(U.cardImages(metas[1])[0].getAttribute('src'), 'b.jpg');
});
test('image inside same link as the title', () => {
  const doc = parse('<ul><li><a href="/x"><img src="x.jpg"><span class="t"><h3>Honey Cake</h3></span></a></li><li><a href="/y"><img src="y.jpg"><span class="t"><h3>Other</h3></span></a></li></ul>');
  const im = U.cardImages(doc.querySelectorAll('span.t')[0]);
  assert.strictEqual(im.length, 1); assert.strictEqual(im[0].getAttribute('src'), 'x.jpg');
});
test('stops at ancestors with other cards; skips tiny images', () => {
  const doc = parse('<div class="row"><img src="hero.jpg"><div class="meta"><h3>Honey Cake</h3></div><div class="meta"><h3>Other</h3></div></div>');
  assert.strictEqual(U.cardImages(doc.querySelectorAll('div.meta')[0]).length, 0);
  const d2 = parse('<div class="c"><img src="icon.png" width="16" height="16"><div class="meta"><h3>Honey Cake</h3></div></div>');
  assert.strictEqual(U.cardImages(d2.querySelector('div.meta')).length, 0);
  const d3 = parse('<div class="c"><img src="1.jpg"><img src="2.jpg"><div class="meta"><h3>Honey Cake</h3></div></div>');
  assert.strictEqual(U.cardImages(d3.querySelector('div.meta')).length, 0, 'ambiguous: 2 images');
});
test('wiring: blur on dim, show unblurs, vegan page and option respected', () => {
  const w = fs.readFileSync(__dirname + '/../web.js', 'utf8');
  assert.match(w, /function blurCard[\s\S]*?S\.blurImages \|\| pageCtx\.vegan/);
  assert.match(w, /isDimmed\(el\)\) blurCard\(el\)/);
  assert.match(w, /vl-w-revealed'\); unblurCard\(el\)/);
  assert.match(w, /_vlCardImgs \|\| \[\]\)\.forEach\(i => \{ i\.classList\.remove/);
  require('./helpers/blurAttr.js').assertEveryBlurAttributed();
});
