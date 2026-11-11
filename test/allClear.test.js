// v0.4.26: all-clear check on the toolbar icon.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const { computeBadge, isAllClear } = require('../badge.js');
const rd = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
test('check when >=3 units scanned and nothing non-vegan', () => {
  assert.deepStrictEqual(computeBadge({ vegan: 0, nonvegan: 0, scanned: 5 }), { text: '✓', color: '#2e7d32', title: 'Vegan Lens: no non-vegan content found' });
  assert.strictEqual(computeBadge({ vegan: 4, scanned: 4 }).text, '✓');
  assert.strictEqual(computeBadge({ scanned: 0, pageVegan: 1 }).text, '✓');
});
test('no check when too little content was scanned', () => {
  assert.strictEqual(computeBadge({}).text, '');
  assert.strictEqual(computeBadge({ scanned: 2 }).text, '');
  assert.strictEqual(computeBadge({ vegan: 2, scanned: 2 }).text, '2');
});
test('non-vegan / context switch back to red count; caution blocks the check', () => {
  assert.deepStrictEqual(computeBadge({ scanned: 9, nonvegan: 1 }), { text: '1', color: '#B3261E' });
  assert.strictEqual(computeBadge({ scanned: 9, context: 1 }).color, '#B3261E');
  assert.strictEqual(computeBadge({ scanned: 9, caution: 1 }).text, '');
  assert.ok(!isAllClear({ scanned: 9, caution: 2 }));
  assert.ok(!isAllClear({ scanned: 9, nonvegan: 1, pageVegan: 1 }));
});
test('option off disables the check', () => {
  assert.strictEqual(computeBadge({ scanned: 9 }, { allClear: false }).text, '');
  assert.strictEqual(computeBadge({ scanned: 9, vegan: 3 }, { allClear: false }).text, '3');
});
test('wiring: background, content scripts, popup', () => {
  const bg = rd('background.js');
  assert.match(bg, /computeBadge\(counts, \{ allClear: allClearOn \}\)/); assert.match(bg, /setTitle/); assert.match(bg, /scanned: 0, caution: 0, pageVegan: 0/);
  assert.match(bg, /offTabs\.has\(tabId\)\) counts = empty\(\)/); assert.match(bg, /tabState/);
  assert.match(rd('web.js'), /counts\.scanned\+\+/); assert.match(rd('web.js'), /pageVegan: pageCtx\.vegan \? 1 : 0/);
  assert.match(rd('content.js'), /c\.scanned\+\+/); assert.match(rd('content.js'), /vl-badge-caution'\)\.length/);
  assert.match(rd('marketplace.js'), /counts\.caution\+\+/);
  assert.match(rd('popup.html'), /id="allClear"/); assert.match(rd('popup.html'), /No non-vegan content found on this page/);
  assert.match(rd('popup.js'), /allClear: true/); assert.match(rd('popup.js'), /'allClear'/);
});
