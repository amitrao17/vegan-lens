'use strict';
// 0.4.59: YouTube SPA badge counts + creator names are not food evidence.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const C = require('../contentClassifier.js');
const root = path.join(__dirname, '..'); const src = f => fs.readFileSync(path.join(root, f), 'utf8');

// Run the real background.js against a recording chrome mock.
function loadBackground() {
  const L = {}, badge = {}, sent = [];
  const ev = name => ({ addListener: fn => { (L[name] = L[name] || []).push(fn); }, removeListener() {} });
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : (t[k] = t[k] || stub())), apply: () => Promise.resolve(undefined) });
  const area = () => { const d = {}; return { get: async k => (typeof k === 'string' ? { [k]: d[k] } : (k && typeof k === 'object' ? { ...k, ...d } : { ...d })), set: async o => Object.assign(d, o), remove: async k => { delete d[k]; }, onChanged: ev('x') }; };
  const chrome = {
    runtime: { onMessage: ev('msg'), onInstalled: ev('inst'), onStartup: ev('start'), getManifest: () => ({ version: 't' }), getURL: x => x, lastError: undefined },
    storage: { session: area(), local: area(), sync: area(), onChanged: ev('stc') },
    tabs: { onUpdated: ev('upd'), onRemoved: ev('rm'), onReplaced: ev('rep'), onActivated: ev('act'), sendMessage: (id, m, cb) => { sent.push([id, m.type]); cb && cb(); } },
    action: { setBadgeText: (o, cb) => { badge[o.tabId] = o.text; cb && cb(); }, setBadgeBackgroundColor: (o, cb) => cb && cb(), setTitle: (o, cb) => cb && cb(), setIcon: (o, cb) => cb && cb() },
    alarms: { create() {}, onAlarm: ev('al') }, contextMenus: { create() {}, removeAll: cb => cb && cb(), onClicked: ev('cm') },
  };
  const ctx = { chrome: new Proxy(chrome, { get: (t, k) => (k in t ? t[k] : stub()) }), console, setTimeout, clearTimeout, URL, fetch: async () => ({ ok: false, json: async () => ({}) }), crypto: globalThis.crypto, TextEncoder, self: null };
  ctx.self = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  ctx.importScripts = (...fs_) => fs_.forEach(f => vm.runInContext(src(f), ctx, { filename: f }));
  vm.runInContext(src('background.js'), ctx, { filename: 'background.js' });
  const msg = (m, tab = 5) => L.msg.forEach(fn => fn(m, { tab: { id: tab }, frameId: 0, url: 'https://www.youtube.com/' }, () => {}));
  const upd = (tab, info) => L.upd.forEach(fn => fn(tab, info, {}));
  return { badge, sent, msg, upd, L };
}
const tick = ms => new Promise(r => setTimeout(r, ms));

test('YouTube SPA: a same-document loading+url update after the report triggers a recount, so the badge is restored', async () => {
  const B = loadBackground(); const counts = { nonvegan: 1, scanned: 5 };
  // web.js answers 'recount' by re-sending its current counts (as the real content script does).
  const respond = () => B.sent.filter(s => s[1] === 'recount').forEach(() => B.msg({ type: 'counts', source: 'web', counts }));
  B.msg({ type: 'counts', source: 'web', counts }); await tick(20);
  assert.equal(B.badge[5], '1');
  B.upd(5, { status: 'loading', url: 'https://www.youtube.com/' }); await tick(20);   // Chrome's SPA update arrives late
  assert.equal(B.badge[5], '', 'old behaviour: counts wiped');
  await tick(900); assert.ok(B.sent.some(s => s[0] === 5 && s[1] === 'recount'), 'background asked the tab to recount');
  respond(); await tick(20);
  assert.equal(B.badge[5], '1', 'badge shows the hidden unit again');
});
test('status complete also requests a recount; closed tabs are never messaged', async () => {
  const B = loadBackground();
  B.upd(9, { status: 'complete' }); await tick(900); assert.ok(B.sent.some(s => s[0] === 9));
  B.sent.length = 0; B.upd(10, { status: 'complete' }); B.L.rm.forEach(fn => fn(10, {})); await tick(900);
  assert.ok(!B.sent.some(s => s[0] === 10));
});
test('web.js, content.js and marketplace.js answer recount by re-reporting', () => {
  assert.match(src('web.js'), /m\.type === 'recount' && active\(\)\) \{ P\.reportPage\(\); send\(\); \}/);
  assert.match(src('content.js'), /m\.type === 'recount'\) \{ P\.reportPage\(\); report\(\); \}/);
  assert.match(src('marketplace.js'), /m\.type === 'recount'\) send\(\)/);
});

const JS = "If You're More Texan Than Me, You're... Mexican, Technically | Jason Salmon Comedy";
const yt = p => C.classify(p, { requireHeadline: true });
test('channel name "Jason Salmon" in the title is not fish evidence (with and without creator data)', () => {
  assert.notEqual(yt({ headline: JS, creators: ['Jason Salmon'] }).verdict, 'nonvegan');
  assert.notEqual(yt({ headline: JS, snippet: 'Jason Salmon · 120K views', alt: '', creators: ['Jason Salmon Comedy'] }).verdict, 'nonvegan');
  assert.notEqual(yt({ headline: JS }).verdict, 'nonvegan', 'given-name + surname guard without channel data');
});
test('other creator/person names across rules are not evidence', () => {
  for (const [h, cr] of [['My Week in Tokyo', ['Chef Lamb']], ['Reacting to Fans | The Bacon Brothers', ['The Bacon Brothers']], ['Kevin Bacon Answers Fan Questions', []], ['Daily Vlog #12 — Jason Fish', []], ['Q&A night', ['@HoneyBeeVlogs']]])
    assert.notEqual(yt({ headline: h, creators: cr }).verdict, 'nonvegan', h);
});
test('food titles still dim: poultry quesadilla, salmon recipe even from a salmon-named channel', () => {
  const q = yt({ headline: 'Crispy Chicken Quesadillas — Not Fried!', creators: ['Some Cook'] }); assert.equal(q.verdict, 'nonvegan'); assert.equal(q.topic, 'poultry');
  assert.equal(yt({ headline: 'Honey Garlic Salmon in 15 Minutes', creators: ['Salmon Kitchen'] }).verdict, 'nonvegan');
  assert.equal(yt({ headline: 'Jason Makes Grilled Salmon Tacos' }).verdict, 'nonvegan', 'only the name pair is removed');
});
test('web.js passes channel/byline names to the classifier', () => {
  const s = src('web.js'); assert.match(s, /creators: creators\(el\)/); assert.match(s, /ytd-channel-name, #channel-name/);
});
