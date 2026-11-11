const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = rd('popup.html'); const js = rd('popup.js');
function panel(id) { const m = html.match(new RegExp('<section role="tabpanel" id="panel-' + id + '"[\\s\\S]*?</section>')); assert.ok(m, id); return m[0]; }
test('three ARIA tabs and panels', () => {
  assert.match(html, /role="tablist"/);
  for (const [id, label] of [['page', 'This page'], ['settings', 'Settings'], ['about', 'About']]) {
    assert.match(html, new RegExp('role="tab" id="tab-' + id + '" aria-controls="panel-' + id + '" aria-selected="(true|false)"[^>]*>' + label + '<'));
    panel(id);
  }
  assert.match(html, /id="tab-page"[^>]*aria-selected="true"/);
  assert.match(js, /ArrowRight/); assert.match(js, /ArrowLeft/); assert.match(rd('popup.css'), /focus-visible/);
});
test('header stays above the tabs', () => { assert.ok(html.indexOf('<h1>') < html.indexOf('role="tablist"')); assert.match(html.slice(0, html.indexOf('role="tablist"')), /id="version"/); });
test('This page: counts, disable, share, report', () => { const p = panel('page'); for (const id of ['stats', 'pageOff', 'shareItems', 'shareCompose', 'shareText', 'shareDests', 'report', 'allClearLine']) assert.match(p, new RegExp('id="' + id + '"'), id); });
test('Settings: toggles and modes', () => { const p = panel('settings'); for (const id of ['enabled', 'mode', 'strictness', 'showSwaps', 'groceryMode', 'webEnabled', 'webMode', 'sensitivity', 'searchAssist', 'checkAds', 'contextCards', 'marketplace', 'allClear', 'showOffers', 'dbLookups', 'blurImages', 'webAllowOnly', 'wlForm']) assert.match(p, new RegExp('id="' + id + '"'), id); assert.ok(!/id="shareStats"|id="total"/.test(p)); });
test('About: all-time counter, stats opt-in, dev flags', () => { const p = panel('about'); for (const id of ['total', 'resetTotal', 'shareStats', 'previewStats', 'debug', 'showExampleOffers', 'aboutVersion']) assert.match(p, new RegExp('id="' + id + '"'), id); });
test('every id used by popup.js exists exactly once', () => {
  const ids = new Set([...js.matchAll(/\$\('([\w-]+)'\)|getElementById\('([\w-]+)'\)/g)].map(m => m[1] || m[2]));
  assert.ok(ids.size > 20);
  for (const id of ids) assert.strictEqual((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
});
test('last tab remembered, pending share forces This page', () => {
  assert.match(js, /storage\.local\.set\(\{ popupTab: id \}\)/); assert.match(js, /storage\.local\.get\(\{ popupTab/);
  assert.match(js, /if \(pre\) VL_TABS\.select\('page', false\)/);
});
