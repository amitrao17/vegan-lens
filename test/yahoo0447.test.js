// 0.4.47 Yahoo-like webmail: a bare sidebar 'AD' label never turns the app shell into an ad unit; the open
// message body (role=region / data-test-id=message-view-body) is the content unit for its images.
const test = require('node:test'); const assert = require('node:assert');
const { parse } = require('./helpers/minidom.js');
const U = require('../webUnits.js'), CC = require('../contentClassifier.js'), A = require('../adUnits.js');
const decide = img => { const ab = CC.altBlur(img.getAttribute('alt'), {}, false); if (!ab.blur) return false; const u = U.contentUnit(img); return !(u && CC.unitVegan(U.unitText(u), {})); };
const app = body => parse('<div id="mail-app-component-container"><nav role="navigation"><a href="/inbox">Inbox</a><a href="/sent">Sent</a><a href="/trash">Trash</a> Folders New Folder Storage</nav>' +
  '<div data-test-id="virtual-list"><div role="link">Yahoo Password changed for your account</div><div role="link">PayPal legal agreements update</div></div>' +
  '<div data-test-id="message-view-body" role="region"><table><tbody><tr><td>' + body + '</td></tr></tbody></table></div>' +
  '<section><div data-test-id="right-rail-container"><div><div>AD</div><div><div></div></div></div></div></section></div>');
const VEGAN = '<h1>This week in plant-based cooking</h1><p>Our favorite vegan brands: try the plant-based Chicken Filets from Offbeast, totally vegan and dairy-free.</p><a href="https://x.example"><img alt="Chicken Filets" width="600"></a><table><tbody><tr><td><p>Unsubscribe from this vegan newsletter. Footer text for the plant-based weekly digest.</p><img alt="logo" width="80"></td></tr></tbody></table>';
const PROMO = '<h1>This weekend at the Chophouse</h1><p>Our USDA prime cuts are back. Reserve your table for date night and enjoy a complimentary dessert with every entree ordered.</p><img alt="ribeye steak" width="600">';

test('bare sidebar AD label: no ad root, app container never ad-marked', () => {
  const doc = app(VEGAN); const shell = doc.querySelector('#mail-app-component-container');
  const lab = [...doc.querySelectorAll('div')].find(d => d.textContent.trim() === 'AD' && !d.querySelector('div'));
  assert.ok(A.isAdLabelText(lab.textContent));
  const root = A.adRootFromLabel(lab, 'mail.yahoo.com');
  assert.notStrictEqual(root, shell); assert.strictEqual(root, null);
  assert.ok(!shell.getAttribute('data-vl-ad'));
});
test('vegan newsletter in message-body region: chicken alt image not blurred; all images share the region unit', () => {
  const doc = app(VEGAN); const region = doc.querySelector('[data-test-id=message-view-body]');
  for (const i of doc.querySelectorAll('img')) { assert.strictEqual(U.contentUnit(i), region); assert.strictEqual(decide(i), false, i.getAttribute('alt')); }
});
test('non-vegan promo in message body: ribeye image blurs (with attribution label path)', () => {
  const doc = app(PROMO); const img = doc.querySelector('img');
  assert.strictEqual(U.contentUnit(img), doc.querySelector('[role=region]')); assert.strictEqual(decide(img), true);
  assert.match(require('fs').readFileSync(__dirname + '/../web.js', 'utf8'), /img\.classList\.add\('vl-img-blur'\);[^\n]*\n\s*blurLabel\(img/);
});
test('ad-marked shell or landmark-holding ancestor is never a content unit', () => {
  const doc = parse('<div data-vl-w="neutral" data-vl-ad="neutral"><nav><a href="/a">A</a></nav><div><table><tbody><tr><td><p>' + 'Weekly specials on steak and lobster at our grill, reserve now. '.repeat(4) + '</p><img alt="steak"></td></tr></tbody></table><table><tbody><tr><td><p>' + 'More of the same footer text for the newsletter, unsubscribe here. '.repeat(4) + '</p><img alt="logo"></td></tr></tbody></table></div></div>');
  const imgs = doc.querySelectorAll('img');
  const u0 = U.contentUnit(imgs[0]), u1 = U.contentUnit(imgs[1]);
  assert.ok(u0 && !u0.getAttribute('data-vl-ad')); assert.notStrictEqual(u0.tagName, 'NAV');
  assert.strictEqual(U.contentUnit(imgs[0]), U.contentUnit(imgs[0]));
  assert.ok(u1 && !u1.getAttribute('data-vl-ad'));
});
test('table email without region: images in nested tables share the outermost table', () => {
  const doc = parse('<div><table id="outer"><tbody><tr><td><table><tbody><tr><td><p>' + 'Header copy for this promotional email about our new seasonal menu items. '.repeat(3) + '</p><img alt="a"></td></tr></tbody></table><table><tbody><tr><td><p>' + 'Footer copy with addresses and legal notices for this message. '.repeat(4) + '</p><img alt="b"></td></tr></tbody></table></td></tr></tbody></table></div>');
  const [a, b] = doc.querySelectorAll('img'); assert.strictEqual(U.contentUnit(a), U.contentUnit(b));
});
