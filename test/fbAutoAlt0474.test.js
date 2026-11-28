// 0.4.74: Facebook auto-generated alt text is a weak guess. Vegan groups, vegan-food
// posts and vegan authors supply context; a lone "May be an image of steak" does not hide.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../contentClassifier.js');
const U = require('../webUnits.js');
const { parse } = require('./helpers/minidom.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const POST = 'Looking for a restaurant where I can find a good vegan meal halfway between Chevy Chase and Baltimore for a meetup with an old and dear friend. All suggestions appreciated.';
const AUTO = 'May be an image of steak';
const EXACT = { headline: POST, alt: AUTO, author: 'Peg Nemoff', community: 'Baltimore Vegans' };

test('versions agree at 0.4.80', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.80');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.80');
});

test('Baltimore Vegans meetup post with auto "steak" alt is not hidden', () => {
  const r = C.classify(EXACT);
  assert.notEqual(r.verdict, 'nonvegan', JSON.stringify(r));
  assert.equal(r.verdict, 'vegan');
  assert.equal(C.altBlur(AUTO, {}, false, EXACT).blur, false);
  // Post text alone (no group name) is also enough
  assert.notEqual(C.classify({ headline: POST, alt: AUTO, author: 'Peg Nemoff' }).verdict, 'nonvegan');
});

test('same auto alt in a non-vegan group with meat text still dims', () => {
  const r = C.classify({ headline: 'Best steak in town?', alt: AUTO, community: 'Foodies of Maryland' });
  assert.equal(r.verdict, 'nonvegan');
  assert.equal(r.topic, 'steak');
  assert.equal(C.altBlur(AUTO, {}, false, { headline: 'Best steak in town?', community: 'Foodies of Maryland' }).blur, true);
});

test('vegan group post "tried real steak again" is discussion, not vegan and not hidden', () => {
  const r = C.classify({ headline: 'tried real steak again', alt: AUTO, community: 'Baltimore Vegans', author: 'Peg Nemoff' });
  assert.equal(r.verdict, 'discussion', JSON.stringify(r));
  assert.notEqual(r.verdict, 'vegan');
  assert.notEqual(r.verdict, 'nonvegan');
});

test('a lone Facebook auto-alt guess is not enough to hide or blur', () => {
  assert.notEqual(C.classify({ alt: AUTO }).verdict, 'nonvegan');
  assert.notEqual(C.classify(AUTO).verdict, 'nonvegan');
  const ab = C.altBlur(AUTO, {}, false);
  assert.equal(ab.blur, false);
  assert.equal(ab.why, 'weak-auto-alt');
  // Unprefixed, human-written alts still blur
  assert.equal(C.altBlur('pernil pork shoulder roast', {}, false).blur, true);
});

test('OCR inside a Facebook auto alt stays strong evidence', () => {
  const alt = 'May be an image of shoes and text that says "Rubber wears through. Leather wears in. Full-grain cowhide gets better with use, not thinner."';
  const r = C.classify({ headline: 'Konjoun Barefoot', alt, author: 'Konjoun Barefoot' });
  assert.equal(r.verdict, 'nonvegan');
});

test('group header link is community; author is the byline underneath; story body is read from dir=auto', () => {
  const doc = parse(
    '<div role="article">' +
      '<h2><a href="https://www.facebook.com/groups/baltimorevegans/">Baltimore Vegans</a></h2>' +
      '<h3><a href="https://www.facebook.com/peg">Peg Nemoff</a></h3>' +
      '<div dir="auto">' + POST + '</div>' +
      '<img alt="' + AUTO + '" width="400" height="600">' +
    '</div>'
  );
  const el = doc.querySelector('[role=article]');
  assert.equal(U.postGroup(el), 'Baltimore Vegans');
  assert.equal(U.postAuthor(el), 'Peg Nemoff');
  assert.match(U.fbExtraText(el).snippet, /vegan meal/);
  assert.match(U.fbExtraText(el).alt, /May be an image of steak/);
  // Auto alt is not promoted to a headline of its own
  const fig = parse('<figure><a href="/photo"><img alt="' + AUTO + '" width="400" height="600"></a></figure>');
  const h = U.fallbackHeadline(fig.querySelector('figure'));
  assert.ok(!h || !/steak/i.test(h), h);
});

test('web.js passes the Facebook group as community and uses hide-in on image units', () => {
  const w = R('web.js');
  assert.match(w, /U\.postGroup/);
  assert.match(w, /community: group \|\| community\(el\)/);
  assert.match(w, /imageUnit/);
  assert.match(w, /inCard = YT \|\| PIN \|\| UE \|\| imageUnit/);
  // Letterboxed photos keep the 0.4.73 hide-in "stay rendered and blurred" rule
  const css = R('web.css');
  assert.match(css, /\.vl-w-hide-in:has\(>\.vl-w-chip\) img[\s\S]*?visibility:visible!important[\s\S]*?opacity:1!important[\s\S]*?filter:blur/);
  assert.match(css, /\.vl-blur-host>\.vl-blur-label\{position:absolute!important;top:6px;left:6px/);
});

test('CHANGELOG records weak Facebook auto alt and vegan-group context in 0.4.74', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.74/);
  assert.match(log, /May be an image of/i);
  assert.match(log, /Baltimore Vegans|group/);
  assert.match(log, /vegan meal/);
});
