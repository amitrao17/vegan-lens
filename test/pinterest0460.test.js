'use strict';
// 0.4.60 Pinterest. Fixture markup is modelled on Pinterest's documented stable attributes (data-test-id="pin",
// data-grid-item, /pin/ links, aria-label, img alt). It is NOT verified against the live DOM (pinterest.com serves
// a JS-only shell to curl). Class names are deliberately obfuscated to prove nothing depends on them.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const { parse } = require('./helpers/minidom.js');
const U = require('../webUnits.js'); const C = require('../contentClassifier.js');
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const pin = (id, title, alt, extra = '') => `<div data-grid-item="true" class="Yl- MIw Hb7"><div data-test-id="pin" class="XiG zI7 iyn Hsu">
  <a href="/pin/${id}/" aria-label="${title}" class="Hsu"><img alt="${alt}" src="https://i.pinimg.com/236x/${id}.jpg"></a>
  ${title ? `<div data-test-id="pinrep-footer" class="hs0"><div data-test-id="pin-title" class="tBJ dyH">${title}</div></div>` : ''}${extra}</div></div>`;
const GRID = parse(`<div role="list" class="vbI XiG">
  ${pin('111', 'Crispy Chicken Quesadillas — Not Fried!', 'quesadilla on a plate', '<a data-test-id="pinner-name" href="/someone/">Some Cook</a>')}
  ${pin('222', "If You're More Texan Than Me, You're... Mexican, Technically | Jason Salmon Comedy", 'man on stage', '<div data-test-id="creator-name">Jason Salmon</div>')}
  ${pin('333', 'Easy Vegan Lentil Soup', 'bowl of soup')}
  ${pin('444', 'Cozy Fall Living Room Ideas', 'sofa with blankets')}
  ${pin('555', 'Leather Crossbody Bag', 'brown bag', '<a href="https://www.example-shop.com/p/bag-1" data-test-id="pinrep-domain">example-shop.com</a>')}
  ${pin('666', '', 'grilled steak on a board')}
</div>`);
const pins = () => GRID.querySelectorAll('[data-test-id="pin"]');
const parts = el => ({ ...U.pinParts(el), creators: [...el.querySelectorAll('[data-test-id*=creator i], [data-test-id*=pinner i]')].map(n => n.textContent.trim()) });
const verdict = el => { const p = parts(el); return p.headline.length < 8 ? 'skipped' : C.classify(p, { requireHeadline: true }).verdict; };

test('host detection covers country domains, not look-alikes', () => {
  for (const h of ['www.pinterest.com', 'pinterest.co.uk', 'www.pinterest.ca', 'pinterest.com.au', 'de.pinterest.de', 'www.pinterest.fr', 'jp.pinterest.jp']) assert.ok(U.isPinterestHost(h), h);
  for (const h of ['pinterest.com.evil.example', 'notpinterest.com', 'pinterest-recipes.com', 'example.com']) assert.ok(!U.isPinterestHost(h), h);
});
test('one pin = one unit: grid and grid-item wrappers are containers, the inner pin is the unit; other nodes skipped', () => {
  const grid = GRID.querySelector('[role="list"]'); const item = GRID.querySelector('[data-grid-item="true"]');
  assert.equal(U.unitRole(grid, { pinterest: true }), 'skip');
  assert.equal(U.unitRole(item, { pinterest: true }), 'container');
  for (const p of pins()) assert.equal(U.unitRole(p, { pinterest: true }), 'unit');
  assert.equal(U.unitRole(GRID.querySelector('img'), { pinterest: true }), 'skip');
  const li = parse('<div role="listitem" class="q1"><a href="/pin/9/" aria-label="Beef Stew Recipe"><img alt="stew"></a></div>').querySelector('[role="listitem"]');
  assert.ok(U.isPin(li)); assert.equal(U.unitRole(li, { pinterest: true }), 'unit');
});
test('pin text: title, aria-label, image alt and outbound domain words; no class names', () => {
  const p = U.pinParts(pins()[0]);
  assert.equal(p.headline, 'Crispy Chicken Quesadillas — Not Fried!'); assert.equal(p.alt, 'quesadilla on a plate');
  const shop = U.pinParts(pins()[4]); assert.deepEqual(shop.domains, ['example-shop.com']); assert.match(shop.snippet, /example shop/);
  assert.doesNotMatch(src('webUnits.js').slice(src('webUnits.js').indexOf('PIN_CARD ='), src('webUnits.js').indexOf('function pinParts')), /\[class|\.[A-Za-z]{2,3}\d? /);
});
test('verdicts: poultry pin dims, creator-name pin does not, vegan/neutral pins do not, leather bag dims, title-less image pin never dims', () => {
  const v = [...pins()].map(verdict);
  assert.equal(v[0], 'nonvegan'); assert.equal(C.classify(parts(pins()[0]), { requireHeadline: true }).topic, 'poultry');
  assert.notEqual(v[1], 'nonvegan', 'Jason Salmon is a person');
  assert.notEqual(v[2], 'nonvegan'); assert.notEqual(v[3], 'nonvegan');
  assert.equal(v[4], 'nonvegan');
  assert.equal(v[5], 'skipped', 'image alt alone is not enough evidence');
});
test('web.js wiring: pin unit selector, per-pin role, in-card chip, requireHeadline, creators, late-filled pins', () => {
  const s = src('web.js');
  assert.match(s, /const PIN = U\.isPinterestHost\(location\.hostname\)/);
  assert.match(s, /\.\.\.\(PIN \? \[U\.PIN_CARD\] : \[\]\)/);
  assert.match(s, /unitRole\(el, \{ youtube: YT, pinterest: PIN/);
  assert.match(s, /const inCard = YT \|\| PIN/);
  assert.match(s, /requireHeadline: YT \|\| PIN \}/);
  assert.match(s, /if \(PIN\) \{ const pp = U\.pinParts\(el\); return \{ \.\.\.pp, creators: creators\(el\) \}; \}/);
  assert.match(s, /if \(PIN\) \{ const card = n\.closest\(U\.PIN_CARD\)/);
  assert.match(s, /\[data-test-id\*=creator i\], \[data-test-id\*=pinner i\]/);
});
test('search assist on Pinterest search (all listed country domains), in the manifest', () => {
  assert.match(src('search.js'), /pinterest\\\.\[a-z\]\{2,3\}\(\\\.\[a-z\]\{2\}\)\?\$\/\.test\(h\) && \/\^\\\/search\\\/\/\.test\(p\)\) return 'q'/);
  const m = JSON.parse(src('manifest.json')); const g = m.content_scripts.find(c => c.js.includes('search.js'));
  for (const d of ['com', 'co.uk', 'ca', 'com.au', 'de', 'fr']) assert.ok(g.matches.includes('*://*.pinterest.' + d + '/*'), d);
  const web = m.content_scripts.find(c => c.js.includes('web.js'));
  assert.ok(web.matches.includes('https://*/*') && !(web.exclude_matches || []).some(x => /pinterest/.test(x)), 'web.js runs on Pinterest (SPA handled by its MutationObserver + URL checks)');
});
