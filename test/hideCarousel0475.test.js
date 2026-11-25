// 0.4.75: hide mode never display:none's card content (blank gray carousel cells);
// the label stays pinned top-left; horizontal carousels are scanned as they scroll.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('versions agree at 0.4.77', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.77');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.77');
});

test('hide CSS never display:none\'s card content and pins the label top-left', () => {
  const css = R('web.css');
  assert.doesNotMatch(css, /\.vl-w-chip\s*\+\s*\.vl-w-hide\s*\{[^}]*display\s*:\s*none/);
  assert.doesNotMatch(css, /\.vl-w-hide-in[^{]*\{[^}]*display\s*:\s*none/);
  assert.doesNotMatch(css, /\.vl-w-hide-in:has\(>\.vl-w-chip\)>:not\(\.vl-w-chip\)[^\{]*\{display:none/);
  assert.match(css, /\.vl-w-hide-in:has\(>\.vl-w-chip\)>:not\(\.vl-w-chip\)[\s\S]*?filter:blur/);
  assert.match(css, /\.vl-w-hide-in:has\(>\.vl-w-chip\) img[\s\S]*?visibility:visible!important[\s\S]*?opacity:1!important[\s\S]*?filter:blur/);
  assert.match(css, /\.vl-w-chip\.vl-w-chip-in\{position:absolute!important;top:6px;left:6px/);
  assert.match(css, /\.vl-w-hide-in,\.vl-w-hide\{position:relative!important[\s\S]*?overflow:visible!important/);
});

test('web.js hide mode is always in-card hide-in, never sibling vl-w-hide', () => {
  const js = R('web.js');
  assert.match(js, /inCard = YT \|\| PIN \|\| UE \|\| imageUnit \|\| mode === 'hide'/);
  assert.match(js, /hideCls = 'vl-w-hide-in'/);
  assert.doesNotMatch(js, /hideCls = inCard \? 'vl-w-hide-in' : 'vl-w-hide'/);
  assert.doesNotMatch(js, /mode === 'hide' \? hideCls[\s\S]{0,20}'vl-w-hide'/);
});

test('web.js watches overflow-x carousels and observes off-screen cards', () => {
  const js = R('web.js');
  assert.match(js, /function isHScroll/);
  assert.match(js, /function scrollerCards/);
  assert.match(js, /function watchOverflow/);
  assert.match(js, /addEventListener\('scroll'/);
  assert.match(js, /pendingIo/);
  assert.match(js, /observePendingUnits/);
  assert.match(js, /for \(const c of scrollerCards/);
});

test('CHANGELOG records hide-layout, turkey food, and carousel scan in 0.4.75', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.75/);
  assert.match(log, /display:none|blank gray|carousel/i);
  assert.match(log, /turkey thighs|Turkey Thighs|braised turkey/i);
  assert.match(log, /turkey vulture/i);
});
