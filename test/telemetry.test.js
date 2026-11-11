const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const rd = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
test('stats are opt-in and off by default', () => {
  assert.match(rd('popup.js'), /shareStats: false/); assert.match(rd('background.js'), /shareStats: false/);
  assert.match(rd('background.js'), /if \(!shareStats\) return;/); assert.match(rd('popup.html'), /id="shareStats"/);
});
test('report contains no URLs/titles, counts are rounded', () => {
  const b = rd('background.js'), fn = b.slice(b.indexOf('function buildReport'), b.indexOf('let statsChain'));
  assert.doesNotMatch(fn, /url|title|href|host/i); assert.match(fn, /round5/); assert.match(b, /credentials: 'omit'/);
});
test('report button opens a pre-filled GitHub issue', () => {
  assert.match(rd('popup.js'), /github\.com\/amitrao17\/vegan-lens\/issues\/new/); assert.match(rd('popup.html'), /id="report"/);
});
test('receiver rejects unexpected fields', () => { assert.match(rd('telemetry/worker.js'), /ALLOWED/); });
