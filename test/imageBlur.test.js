const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const C = require('../contentClassifier.js');
test('alt-text style captions classify', () => {
  assert.strictEqual(C.classify('grilled steak with chimichurri', {}).verdict, 'nonvegan');
  assert.strictEqual(C.classify('raw salmon fillets on ice', {}).verdict, 'nonvegan');
  assert.notStrictEqual(C.classify('red leaves seen from a satellite', {}).verdict, 'nonvegan');
  assert.notStrictEqual(C.classify('vegan seitan ribs', {}).verdict, 'nonvegan');
});
test('wiring: blurImages option, popup toggle, CSS, vegan pages skip', () => {
  const w = fs.readFileSync(__dirname + '/../web.js', 'utf8'), css = fs.readFileSync(__dirname + '/../web.css', 'utf8');
  assert.match(w, /blurImages: true/); assert.match(w, /S\.blurImages \|\| pageCtx\.vegan/);
  assert.match(css, /\.vl-img-blur/); assert.match(css, /\.vl-blur-images \.vl-w-dim img/);
  assert.match(fs.readFileSync(__dirname + '/../popup.html', 'utf8'), /id="blurImages"/);
  assert.match(fs.readFileSync(__dirname + '/../popup.js', 'utf8'), /'blurImages'/);
});
