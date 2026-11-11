'use strict';
// 0.4.68 Uber Eats. Fixture markup models verified stable attributes (data-testid store-item-*, rich-text,
// store-card, /store/ links). It is NOT a live DOM dump (ubereats.com serves a JS shell / Cloudflare to curl).
// Class names are deliberately obfuscated to prove nothing depends on them.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const { parse } = require('./helpers/minidom.js');
const U = require('../webUnits.js'); const C = require('../contentClassifier.js');
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const dish = (id, name, desc = '', price = '$12.00') => `<li data-testid="store-item-${id}" class="ab cd12">
  <div data-testid="item-thumbnail-label" class="xy9">
    <span data-testid="rich-text" class="rt1">${name}</span>
    <span data-testid="rich-text" class="rt2">${price}</span>
    ${desc ? `<span data-testid="rich-text" class="rt3">${desc}</span>` : ''}
  </div>
  <button type="button" aria-label="Add ${name}">+</button>
</li>`;

const store = (slug, name, tags = []) => {
  const chips = tags.map(t => `<span data-testid="rich-text" class="tg">${t}</span>`).join('');
  return `<div data-testid="store-card" class="sc9">
    <a data-testid="store-card" href="/store/${slug}/abc123" class="lnk">
      <h3 class="nm">${name}</h3>
      <span data-testid="rich-text" class="rt">4.8</span>
      <span data-testid="rich-text" class="rt">(200+)</span>
      ${chips}
    </a>
  </div>`;
};

const MENU = parse(`<div data-testid="store-catalog-section-vertical-grid" class="sec">
  <h3 class="h">Mains</h3>
  <ul>
    ${dish('1', 'Crispy Chicken Sandwich', 'fried chicken breast, pickles, mayo')}
    ${dish('2', 'Impossible Burger', '100% plant-based patty with lettuce and tomato')}
    ${dish('3', 'Tofu Scramble Bowl', 'organic tofu, kale, avocado')}
    ${dish('4', 'House Special', 'chef selection of the day')}
    ${dish('5', 'Beyond Chicken Nuggets', 'plant-based nuggets')}
    ${dish('6', 'Guac Burger', 'housemade black bean-sweet potato patty, avocado, multigrain bun')}
  </ul>
</div>`);

const FEED = parse(`<div class="feed" role="list">
  ${store('chloes', "CHLOE'S", ['Vegan', 'Healthy', 'Bakery'])}
  ${store('peter-luger', 'Peter Luger Steakhouse', ['Steakhouses', 'American'])}
  ${store('joes-seafood', "Joe's Seafood", ['Seafood', 'Fish'])}
  ${store('smokehouse', 'Smokehouse BBQ', ['BBQ', 'Smokehouse'])}
  ${store('wingstop', 'Wingstop', ['Wings', 'American'])}
  ${store('generic-pizza', 'Generic Pizza Place', ['Pizza', 'Italian'])}
  ${store('sweetgreen', 'Sweetgreen', ['Healthy', 'Salads'])}
</div>`);

const dishes = () => [...MENU.querySelectorAll('[data-testid^="store-item-"]')];
const cards = () => [...FEED.querySelectorAll('a[data-testid="store-card"]')];
const verdict = parts => C.classify(parts, {}).verdict;

test('host detection covers ubereats.com, not look-alikes', () => {
  for (const h of ['www.ubereats.com', 'ubereats.com', 'm.ubereats.com']) assert.ok(U.isUberEatsHost(h), h);
  for (const h of ['ubereats.com.evil.example', 'notubereats.com', 'uber.com', 'doordash.com', 'example.com']) assert.ok(!U.isUberEatsHost(h), h);
});

test('one dish / one store card = one unit; wrappers are containers; other nodes skipped', () => {
  const section = MENU.querySelector('[data-testid="store-catalog-section-vertical-grid"]');
  assert.equal(U.unitRole(section, { ubereats: true }), 'skip'); // section itself is not a UE unit selector match
  for (const d of dishes()) assert.equal(U.unitRole(d, { ubereats: true }), 'unit', d.getAttribute('data-testid'));
  const outer = FEED.querySelector('div[data-testid="store-card"]');
  const inner = outer.querySelector('a[data-testid="store-card"]');
  assert.equal(U.unitRole(outer, { ubereats: true }), 'container');
  assert.equal(U.unitRole(inner, { ubereats: true }), 'unit');
  assert.equal(U.unitRole(MENU.querySelector('button'), { ubereats: true }), 'skip');
  assert.equal(U.unitRole(FEED.querySelector('.feed'), { ubereats: true }), 'skip');
});

test('dish text: name + description from rich-text; no class names; price ignored as headline', () => {
  const p = U.ueParts(dishes()[0]);
  assert.equal(p.headline, 'Crispy Chicken Sandwich');
  assert.match(p.snippet, /fried chicken breast/);
  assert.equal(p.kind, 'dish');
  assert.equal(p.alt, '');
  const block = src('webUnits.js').slice(src('webUnits.js').indexOf('isUberEatsHost'), src('webUnits.js').indexOf('function ueLikelyVegan'));
  assert.doesNotMatch(block, /\[class\*=|\.[A-Za-z]{2,3}\d /);
});

test('verdicts: chicken dims, Impossible/tofu vegan, House Special unlabeled, Beyond vegan, Guac Burger likely', () => {
  const vs = dishes().map(d => {
    const parts = U.ueParts(d);
    const r = C.classify(parts, {});
    return { name: parts.headline, verdict: r.verdict, likely: U.ueLikelyVegan(r), topic: r.topic };
  });
  assert.equal(vs[0].verdict, 'nonvegan'); assert.equal(vs[0].topic, 'poultry');
  assert.equal(vs[1].verdict, 'vegan', 'Impossible Burger');
  assert.equal(vs[2].verdict, 'vegan', 'Tofu Scramble');
  assert.equal(vs[3].verdict, 'neutral', 'House Special unlabeled');
  assert.equal(vs[3].likely, false);
  assert.equal(vs[4].verdict, 'vegan', 'Beyond Chicken Nuggets');
  assert.ok(vs[5].verdict === 'vegan' || vs[5].likely, 'Guac Burger with black bean patty is vegan or likely vegan');
});

test('restaurant cards: vegan chip evidence, steakhouse/seafood/BBQ/wings dim, generic untouched', () => {
  const rows = cards().map(c => {
    const parts = U.ueParts(c);
    const r = C.classify(parts, {});
    return { name: parts.headline, tags: parts.tags, verdict: r.verdict, topic: r.topic };
  });
  assert.match(rows[0].tags, /Vegan/i);
  assert.equal(rows[0].verdict, 'vegan', "CHLOE'S with Vegan tag");
  assert.equal(rows[1].verdict, 'nonvegan', 'Peter Luger Steakhouse');
  assert.equal(rows[2].verdict, 'nonvegan', "Joe's Seafood");
  assert.equal(rows[3].verdict, 'nonvegan', 'Smokehouse BBQ');
  assert.equal(rows[4].verdict, 'nonvegan', 'Wingstop + Wings tag');
  assert.notEqual(rows[5].verdict, 'nonvegan', 'Generic Pizza Place untouched');
  assert.notEqual(rows[5].verdict, 'vegan');
  assert.notEqual(rows[6].verdict, 'nonvegan', 'Sweetgreen untouched');
});

test('web.js wiring: UE unit selector, role, in-card chip, ueParts, vegan/likely chips, page header tags', () => {
  const s = src('web.js');
  assert.match(s, /const UE = U\.isUberEatsHost\(location\.hostname\)/);
  assert.match(s, /\.\.\.\(UE \? \[U\.UE_CARD\] : \[\]\)/);
  assert.match(s, /unitRole\(el, \{ youtube: YT, pinterest: PIN, ubereats: UE/);
  assert.match(s, /const inCard = YT \|\| PIN \|\| UE/);
  assert.match(s, /if \(UE\) return U\.ueParts\(el\)/);
  assert.match(s, /vl-w-chip-vegan/);
  assert.match(s, /all-vegan/);
  assert.match(s, /ueLikelyVegan/);
  assert.match(s, /ueCuisineTags\(near\)/);
  assert.match(s, /if \(UE\) \{ const card = n\.closest\(U\.UE_CARD\)/);
});

test('search assist on Uber Eats /search?q=, in the manifest; web.js still runs on ubereats', () => {
  assert.match(src('search.js'), /ubereats\\.com\$\/\.test\(h\) && \/\\\/search\(\?:\\\/\|\$\)\/\.test\(p\)\) return 'q'/);
  const m = JSON.parse(src('manifest.json'));
  assert.equal(m.version, '0.4.70');
  const g = m.content_scripts.find(c => c.js.includes('search.js'));
  for (const pat of ['*://*.ubereats.com/search*', '*://ubereats.com/search*', '*://*.ubereats.com/*/search*'])
    assert.ok(g.matches.includes(pat), pat);
  const web = m.content_scripts.find(c => c.js.includes('web.js'));
  assert.ok(web.matches.includes('https://*/*') && !(web.exclude_matches || []).some(x => /ubereats/.test(x)));
});

test('docs/UBEREATS.md records verified vs assumed selectors; no dish-count fabrication', () => {
  const d = src('docs/UBEREATS.md');
  assert.match(d, /Verified selectors/);
  assert.match(d, /Assumed/);
  assert.match(d, /store-item-/);
  assert.match(d, /store-card/);
  assert.match(d, /Never invents a dish count|does \*\*not\*\* expose a menu|Never invents|never fabricate|Never invent/i);
  assert.doesNotMatch(d, /\d+ vegan dishes/);
});
