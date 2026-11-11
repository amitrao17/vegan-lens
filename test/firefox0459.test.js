'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const FF = require('../tools/build-firefox.js');
const root = path.join(__dirname, '..'); const src = f => fs.readFileSync(path.join(root, f), 'utf8');
const chromeM = JSON.parse(src('manifest.json'));
const ff = FF.firefoxManifest(chromeM);

test('Chrome manifest is untouched: service worker, no gecko keys', () => {
  assert.deepEqual(chromeM.background, { service_worker: 'background.js' });
  assert.equal(chromeM.browser_specific_settings, undefined);
});
test('Firefox manifest: background.scripts (importScripts list + background.js), no service_worker', () => {
  assert.equal(ff.background.service_worker, undefined);
  assert.deepEqual(ff.background.scripts.slice(-1), ['background.js']);
  assert.deepEqual(ff.background.scripts.slice(0, -1), ['rules/rulesData.js', 'rules/rules.js', 'classifier.js', 'badge.js', 'pageKey.js', 'total.js', 'offers.js', 'dbLookup.js']);
  for (const f of ff.background.scripts) assert.ok(fs.existsSync(path.join(root, f)), f);
});
test('Firefox manifest: gecko id, min versions, data collection declaration', () => {
  const g = ff.browser_specific_settings;
  assert.equal(g.gecko.id, 'vegan-lens@veganlens.app'); assert.match(g.gecko.strict_min_version, /^\d+\.0$/); assert.ok(parseInt(g.gecko.strict_min_version) >= 128);
  assert.ok(parseInt(g.gecko_android.strict_min_version) >= 128);
  assert.deepEqual(g.gecko.data_collection_permissions.required, ['none']);
});
test('Firefox manifest: everything else identical (content scripts, popup, permissions, version)', () => {
  for (const k of ['version', 'name', 'content_scripts', 'action', 'icons', 'host_permissions', 'web_accessible_resources', 'manifest_version']) assert.deepEqual(ff[k], chromeM[k], k);
  for (const p of ['offscreen', 'sidePanel', 'declarativeNetRequest', 'webNavigation']) assert.ok(!ff.permissions.includes(p));
  assert.deepEqual(FF.firefoxManifest({ ...chromeM, permissions: ['storage', 'offscreen', 'sidePanel'], minimum_chrome_version: '110', key: 'x' }).permissions, ['storage']);
});
test('package file list excludes tests/tools/docs and the Chrome manifest is replaced', () => {
  const f = FF.files(); assert.ok(f.includes('background.js') && f.includes('rules/rulesData.js'));
  assert.ok(!f.some(x => /^(test|tools|docs|node_modules)\//.test(x) || x === 'manifest.json' || /\.zip$/.test(x)));
});
test('background scripts run as a Firefox event page (no importScripts global)', () => {
  const L = []; const ev = () => ({ addListener: fn => L.push(fn) });
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : (t[k] = t[k] || stub())), apply: () => Promise.resolve(undefined) });
  const chrome = new Proxy({ runtime: { onMessage: ev(), onInstalled: ev(), onStartup: ev(), getManifest: () => ({ version: 't' }), getURL: x => x }, tabs: { onUpdated: ev(), onRemoved: ev() } }, { get: (t, k) => (k in t ? t[k] : stub()) });
  const ctx = { chrome, console, setTimeout, clearTimeout, URL, fetch: async () => ({ ok: false }), crypto: globalThis.crypto, TextEncoder }; ctx.self = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ff.background.scripts) vm.runInContext(src(f), ctx, { filename: f }); // Android: no contextMenus / onReplaced -> guarded
  assert.ok(L.length >= 3 && typeof ctx.VeganBadge === 'object');
});
test('popup: Android opens the popup as a tab, so "This page" uses the last other tab', () => {
  const s = src('popup.js'); assert.match(s, /function pageTab\(cb\)/); assert.ok(!/chrome\.tabs\.query\(\{ active: true, currentWindow: true \}, \(\[tab\]\) => \{\n    if/.test(s));
  const body = s.slice(s.indexOf('function pageTab'), s.indexOf('const SENS'));
  const tabs = [{ id: 1, url: 'moz-extension://x/popup.html', active: true }, { id: 2, url: 'https://a/', lastAccessed: 5 }, { id: 3, url: 'https://b/', lastAccessed: 9 }];
  const run = active => new Promise(res => { const chrome = { runtime: { getURL: () => 'moz-extension://x/' }, tabs: { query: (q, cb) => cb(q.active ? [active] : tabs) } }; new Function('chrome', 'cb', body + '; pageTab(cb)')(chrome, res); });
  return Promise.all([run(tabs[0]).then(t => assert.equal(t.id, 3)), run(tabs[1]).then(t => assert.equal(t.id, 2))]);
});
