'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const B = require('../badge.js');
const withChrome = async (lastError, fn) => { const prev = global.chrome; global.chrome = { runtime: { lastError } }; try { return await fn(); } finally { global.chrome = prev; } };
test('callback API with runtime.lastError ("No tab with id") resolves null and reads lastError', async () => {
  let read = 0; const err = { get message() { read++; return 'No tab with id: 483450527.'; } };
  await withChrome(undefined, async () => {
    global.chrome.runtime = { get lastError() { read++; return err; } };
    const r = await B.safeTabCall((opts, cb) => { setTimeout(() => cb()); }, { tabId: 483450527, text: '3' });
    assert.equal(r, null); assert.ok(read >= 1, 'lastError was read inside the callback');
  });
});
test('promise API that rejects resolves null (no unhandled rejection)', async () => {
  await withChrome(undefined, async () => {
    const r = await B.safeTabCall(() => Promise.reject(new Error('No tab with id: 1')), { tabId: 1 });
    assert.equal(r, null);
  });
});
test('throwing API resolves null; success passes the result through', async () => {
  await withChrome(undefined, async () => {
    assert.equal(await B.safeTabCall(() => { throw new Error('Invalid tab'); }), null);
    assert.equal(await B.safeTabCall((m, cb) => cb({ ok: 1 }), { type: 'x' }).then(r => r.ok), 1);
    assert.equal(await B.safeTabCall((o, cb) => cb(), {}), true);
  });
});
test('callback and promise both firing resolve once', async () => {
  await withChrome(undefined, async () => {
    const r = await B.safeTabCall((o, cb) => { cb('a'); return Promise.reject(new Error('late')); }, {});
    assert.equal(r, 'a');
  });
});
test('background.js routes every tab-scoped call through tabCall and clears state on close', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  for (const name of ['setBadgeText', 'setBadgeBackgroundColor', 'setTitle', 'setIcon']) {
    assert.ok(!new RegExp('chrome\\.action\\.' + name + '\\(').test(s), name + ' called directly');
    assert.ok(s.includes("tabCall(chrome.action, '" + name + "'"), name + ' via tabCall');
  }
  assert.ok(!/chrome\.tabs\.sendMessage\(/.test(s) && s.includes("tabCall(chrome.tabs, 'sendMessage'"));
  const rm = s.slice(s.indexOf('chrome.tabs.onRemoved.addListener'), s.indexOf('chrome.tabs.onRemoved.addListener') + 500);
  for (const k of ['closedTabs.add(tabId)', 'delete sources[tabId]', 'delete tabUrls[tabId]', 'offTabs.delete(tabId)', 'pendingShare = null']) assert.ok(rm.includes(k), k);
  assert.match(s, /async function setCounts[\s\S]*?if \(tabGone\(tabId\)\) return;[\s\S]*?await chrome\.storage\.session\.set[\s\S]*?if \(tabGone\(tabId\)\)/, 'setCounts re-checks after the await');
});
test('background.js badge path is safe end-to-end with a mocked chrome where the tab is gone', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const m = /const closedTabs[\s\S]*?\n}\n/.exec(src); assert.ok(m);
  let unhandled = 0; const onU = () => unhandled++; process.on('unhandledRejection', onU);
  const calls = [];
  const gone = name => (o, cb) => { calls.push(name); global.chrome.runtime.lastError = { message: 'No tab with id: ' + o.tabId }; cb(); global.chrome.runtime.lastError = undefined; };
  global.chrome = { runtime: {}, storage: { session: { set: async () => {}, remove: async () => {} } }, action: { setBadgeText: gone('t'), setBadgeBackgroundColor: gone('c'), setTitle: gone('ti') } };
  const fn = new Function('VeganBadge', 'offTabs', 'empty', 'key', 'allClearOn', m[0] + '; return { setCounts, closedTabs };');
  const env = fn(B, new Set(), () => ({}), t => 'c' + t, true);
  await env.setCounts(483450527, { nonvegan: 2 }); await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(calls.sort(), ['c', 't', 'ti']);
  env.closedTabs.add(7); calls.length = 0; await env.setCounts(7, {}); assert.equal(calls.length, 0, 'closed tab skipped');
  process.off('unhandledRejection', onU); assert.equal(unhandled, 0); delete global.chrome;
});
