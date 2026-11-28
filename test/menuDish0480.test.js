// 0.4.80: restaurant menu cards were missing dishes whose animal ingredients
// lived only in a non-<p> description (Pad Thai / Pad See-Ew eggs, Bangkok
// Noodles shrimp and chicken). A "choice of" protein that includes tofu or
// vegetables must not hide the whole dish. Squid is seafood.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const { parse } = require('./helpers/minidom.js');
const C = require('../contentClassifier.js');
const U = require('../webUnits.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const PT_DESC = 'Thin rice noodles stir-fried with bean sprouts, bean curd, scallions, eggs & topped with crushed peanuts. Not spicy.';
const PSE_DESC = 'Wide rice noodles stir-fried with broccoli, Chinese broccoli, eggs & sweet black soy sauce. Not spicy.';
const BK_DESC = 'Medium spicy. Pad Thai meets drunken noodles! Stir-fried thin rice noodles with shrimp, chicken, eggs, onions, basil & bell peppers with spicy chili paste, topped with fried shallots.';
const DRUNK_DESC = 'Medium spicy. Wide rice noodles stir-fried with basil, bell peppers, onions, Thai chilies, mixed vegetables & garlic';
const RED_DESC = 'Mild Spicy. Red curry paste derived from Thai red chilis, cooked in coconut milk with eggplants, green beans, bamboo shoots, bell peppers & basil. Cannot be served not spicy to preserve authentic taste. Choice of chicken, pork, steamed tofu, fried tofu, just vegetables, beef, shrimp or seafood. Served with Thai jasmine rice, substitute for brown rice or fried rice with egg for extra charge';
const KHAO_DESC = 'a flavorful and aromatic dish originating from Northern Thailand. It is a type of curry egg noodle soup that features a rich, creamy spiced coconut milk base. Served with marinated grilled chicken, grilled Flank Steak, Steamed Tofu, or Fried Tofu. Garnished with crispy fried egg noodles, cilantro, pickles mustard greens, shallots, and lime. (Mild) V';
const TFR_DESC = 'Fried rice with eggs, onions, scallions & tomatoes, stir-fried with choice of chicken, pork, steamed tofu, fried tofu, beef, shrimp or seafood. Served with cucumber slices and a lime wedge';
const SUMMER_DESC = 'Fresh rice paper rolls filled with shrimp, vegetables & cellophane noodles served with a tamarind sauce. Gluten free.';
const VEGPUFF_DESC = 'Carrot, potato, curry powder & optional chicken, deep fried in pastry puff, served with a sweet cucumber relish sauce';
const TEA_DESC = 'Delicious Thai cold drink made from Thai black tea, milk, and sugar. It is also known as cha yen.';
const WOON_DESC = 'Choice of minced chicken or steamed tofu, cellophane noodles soup with carrots, mixed vegetables & cilantro';
const DUMP_DESC = 'Four steamed dumplings stuffed with pork, chicken, shrimp, carrot, scallion & water chestnut, served with a sweet soy sauce';
const KRA_DESC = 'Medium spicy. Choice of protein or just vegetables, stir-fried with basil, bell peppers, Thai chilies, onion and garlic. Served with Thai jasmine rice, substitute for brown rice or fried rice with egg for additional charge. Choice of meat are chicken, pork, steamed tofu, fried tofu, just vegetable, add extra charge for beef, shrimp or seafood';
const GCFR_DESC = 'A fragrant, wok-fired blend of jasmine rice and aromatic green curry paste. Tossed with tender Thai eggplant, fresh basil, garlic, and egg, then finished with a kick of fresh Thai chilies. Served with your choice of protein. (Mild-little spicy)';

function card(name, desc, href, extras) {
  return '<a href="' + (href || '/menu?item=' + name.toLowerCase().replace(/\s+/g, '-') + '-x') + '">' +
    '<h3>' + name + '</h3>' +
    '<div class="sXH12">' + desc + '</div>' +
    '<span>$15.95+</span>' +
    (extras || '') +
    '</a>';
}

function noodleSection() {
  return parse(
    '<section class="menu-section">' +
      '<h2>Noodle</h2>' +
      '<div class="menu-grid">' +
        card('Pad Thai', PT_DESC, '/menu?item=pad-thai-kUod', '<div>Beef $1.00</div><div>Shrimp $2.00</div>') +
        card('Pad See-Ew', PSE_DESC, '/menu?item=pad-seeew-mWE7') +
        card('Bangkok Noodles', BK_DESC, '/menu?item=bangkok-noodles-1N5Z') +
        card('Drunken Noodles', DRUNK_DESC, '/menu?item=drunken-noodles-a2FB', '<div>Beef $1.00</div><div>Shrimp $2.00</div>') +
      '</div>' +
    '</section>'
  );
}

function verdict(parts, opts) {
  return C.classify(parts, opts || {});
}

test('versions agree at 0.4.80', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.80');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.80');
});

test('CHANGELOG records the restaurant menu fixes in 0.4.80', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.80/);
  assert.match(log, /Pad Thai/);
  assert.match(log, /choice of/i);
  assert.match(log, /[Ss]quid/);
});

test('squid, calamari, octopus and cuttlefish are seafood; eggplant and coconut milk are not dairy', () => {
  for (const name of ['Manow Squid', 'Fried calamari', 'Grilled octopus', 'cuttlefish salad']) {
    const r = C.classify({ headline: name }, {});
    assert.equal(r.verdict, 'nonvegan', name + ' ' + JSON.stringify(r));
    assert.equal(r.topic, 'seafood', name);
  }
  assert.notEqual(C.classify({ headline: 'Crispy Eggplant', snippet: 'Sliced eggplant lightly battered & deep fried' }, { dish: true }).verdict, 'nonvegan');
  const kha = C.classify({ headline: 'Tom Kha Soup', snippet: 'Coconut milk soup with mushrooms, cilantro, napa cabbage', kind: 'dish' }, {});
  assert.notEqual(kha.verdict, 'nonvegan', JSON.stringify(kha));
  assert.ok(!(kha.matches || []).some(m => m.label === 'dairy/eggs' && /milk|cream/.test(m.term)), JSON.stringify(kha.matches));
});

test('stated eggs, shrimp or milk in a dish description are enough to flag', () => {
  const cases = [
    ['Pad Thai', PT_DESC, 'dairy/eggs'],
    ['Pad See-Ew', PSE_DESC, 'dairy/eggs'],
    ['Bangkok Noodles', BK_DESC, 'seafood'],
    ['Summer Rolls (2)', SUMMER_DESC, 'seafood'],
    ['Thai Iced Tea', TEA_DESC, 'dairy/eggs'],
    ['Steamed Dumplings (4)', DUMP_DESC, 'seafood'],
    ['Green Curry Fried Rice', GCFR_DESC, 'dairy/eggs'],
    ['Thai Fried Rice', TFR_DESC, 'dairy/eggs'],
  ];
  for (const [h, s, topic] of cases) {
    const r = verdict({ headline: h, snippet: s, kind: 'dish' });
    assert.equal(r.verdict, 'nonvegan', h + ' ' + JSON.stringify({ topic: r.topic, score: r.score, matches: r.matches }));
    assert.equal(r.topic, topic, h + ' got ' + r.topic);
  }
});

test('choice-of-protein lists that include tofu or vegetables do not hide the dish', () => {
  const stay = [
    ['Red Curry', RED_DESC],
    ['Pad Kra Prow', KRA_DESC],
    ['Woon Sen Soup', WOON_DESC],
    ['Curry Puffs (2) -Veggie', VEGPUFF_DESC],
    ['Drunken Noodles', DRUNK_DESC],
    ['Tom Yum Soup', 'Mild. Choice of chicken, pork, beef, steamed tofu, fried tofu, veggies, shrimp or seafood. Spicy & sour soup with mushrooms, lemongrass, cilantro, tomato, other Thai herbs & a hint of chili'],
  ];
  for (const [h, s] of stay) {
    const r = verdict({ headline: h, snippet: s, kind: 'dish' });
    assert.notEqual(r.verdict, 'nonvegan', h + ' should stay visible: ' + JSON.stringify({ topic: r.topic, score: r.score, matches: r.matches, reasons: r.reasons }));
    assert.notEqual(r.verdict, 'vegan', h + ' is customizable, not inherently vegan: ' + JSON.stringify({ score: r.score, reasons: r.reasons }));
  }
  const longSong = verdict({ headline: 'Pra Ram Long Song', snippet: 'Your choice of Protein stir-fried with peanut sauce, ginger & curry powder, served with steamed broccoli & topped with fried onions. Served with Thai jasmine rice, substitute for brown rice or fried rice with egg for additional charge. Choice of meat are chicken, pork, steamed tofu, fried tofu, just vegetable, add extra charge for beef, shrimp or seafood', kind: 'dish' });
  assert.notEqual(longSong.verdict, 'nonvegan', 'Pra Ram Long Song ' + JSON.stringify(longSong));
  assert.notEqual(longSong.verdict, 'vegan', 'Pra Ram Long Song vegan? ' + JSON.stringify(longSong));
  const woon = verdict({ headline: 'Pad Woon Sen', snippet: 'Choice of meat or just vegetables, stir-fried with cellophane noodles, baby corn, bell peppers, onions, scallions, Napa cabbage, carrots & eggs. Served with Thai jasmine rice, substitute for brown rice or fried rice with egg for additional charge. Choice of meat are chicken, pork, steamed tofu, fried tofu, just vegetable, add extra charge for beef, shrimp or seafood', kind: 'dish' });
  assert.equal(woon.verdict, 'nonvegan', JSON.stringify(woon));
  assert.equal(woon.topic, 'dairy/eggs');
  assert.ok(!(woon.matches || []).some(m => /pork|chicken|beef|shrimp/.test(m.term)), 'choice meats leaked: ' + JSON.stringify(woon.matches));
  // Title still wins when the item itself is named as chicken.
  const chickenPuff = verdict({ headline: 'Curry Puffs (2) -Chicken', snippet: VEGPUFF_DESC, kind: 'dish' });
  assert.equal(chickenPuff.verdict, 'nonvegan', JSON.stringify(chickenPuff));
});

test('ingredients outside a choice list still count: fried rice eggs, khao soi egg noodles', () => {
  const rice = verdict({ headline: 'Thai Fried Rice', snippet: TFR_DESC, kind: 'dish' });
  assert.equal(rice.verdict, 'nonvegan');
  assert.ok((rice.matches || []).some(m => /eggs?/.test(m.term)), JSON.stringify(rice.matches));
  const khao = verdict({ headline: 'Chiang Mai Noodles (Khao Soi)', snippet: KHAO_DESC, kind: 'dish' });
  assert.equal(khao.verdict, 'nonvegan', JSON.stringify({ topic: khao.topic, matches: khao.matches }));
  assert.ok((khao.matches || []).some(m => /eggs?/.test(m.term)), 'egg noodles should remain: ' + JSON.stringify(khao.matches));
  assert.ok(!(khao.matches || []).some(m => /chicken|steak|beef/.test(m.term)), 'choice proteins should be stripped: ' + JSON.stringify(khao.matches));
});

test('a vegan-named or tofu-only dish stays clear, including plant-based "beef"', () => {
  const vegan = [
    { headline: 'Salted and Pepper Golden Tofu (Vegan)', snippet: 'golden-fried tofu cubes tossed with salt, pepper, garlic, and chilies', kind: 'dish' },
    { headline: 'Tamarind Golden Tofu (NEW ITEM)', snippet: 'Crispy golden tofu tossed in a rich, sweet-tangy tamarind sauce', kind: 'dish' },
    { headline: 'Garden Rolls (2)', snippet: 'Fresh rice paper rolls filled with tofu, vegetables & noodles served with a tamarind sauce (GF)', kind: 'dish' },
    { headline: 'Pra Ram Jae', snippet: 'Choice of fried or steamed tofu stir-fried with peanut sauce, ginger & curry powder, served with steamed broccoli', kind: 'dish' },
    { headline: 'Vegan Pad Ka Prow', snippet: 'Medium spicy. Vegan Plant-Based ground "beef" stir-fried with basil, green beans, bell peppers, Thai chilies & garlic.', kind: 'dish' },
    { headline: 'Crispy Eggplant', snippet: 'Sliced eggplant lightly battered & deep fried, served with a spicy basil sauce', kind: 'dish' },
    { headline: 'Fried Rice without egg', snippet: '', kind: 'dish' },
  ];
  for (const p of vegan) {
    const r = verdict(p);
    assert.notEqual(r.verdict, 'nonvegan', p.headline + ' ' + JSON.stringify({ verdict: r.verdict, matches: r.matches }));
  }
  assert.equal(verdict({ headline: 'Vegan Pad Ka Prow', snippet: 'Vegan Plant-Based ground "beef" stir-fried with basil', kind: 'dish' }).verdict, 'vegan');
});

test('a news blurb with a lone shrimp mention is not treated as a dish listing', () => {
  const r = C.classify({ headline: 'Committee meets downtown', snippet: 'The brief also mentioned shrimp once in passing.' }, {});
  assert.notEqual(r.verdict, 'nonvegan', JSON.stringify(r));
});

test('named fish sauce in a dish description is evidence, but it is not invented when unstated', () => {
  const named = verdict({ headline: 'Som Tum (Green Papaya)', snippet: 'Shredded green papaya in a palm sugar, lime and fish sauce dressing', kind: 'dish' });
  assert.equal(named.verdict, 'nonvegan', JSON.stringify(named));
  const unstated = verdict({ headline: 'Som Tum (Green Papaya)', snippet: 'Shredded green papaya, carrot, garlic, tomatoes, green bean, Thai chili & roasted peanuts in a palm sugar-lime dressing', kind: 'dish' });
  assert.notEqual(unstated.verdict, 'nonvegan', JSON.stringify(unstated));
});

test('ownDescription reads a hashed-class blurb before the price and ignores later add-ons', () => {
  const doc = noodleSection();
  const items = doc.querySelectorAll('a[href*="?item="]');
  assert.equal(items.length, 4);
  const pad = items[0];
  const desc = U.ownDescription(pad, 'Pad Thai');
  assert.match(desc, /eggs/);
  assert.doesNotMatch(desc, /Beef|Shrimp \$/);
  const drunk = items[3];
  const d = U.ownDescription(drunk, 'Drunken Noodles');
  assert.match(d, /mixed vegetables & garlic/i);
  assert.doesNotMatch(d, /Beef \$|Shrimp \$/);
});

test('ownDescription also uses an explicit description node', () => {
  const doc = parse('<a href="/menu?item=tea-1"><h3>Thai Iced Tea</h3><div class="item-description">' + TEA_DESC + '</div><span>$4.95</span></a>');
  const el = doc.querySelector('a');
  const desc = U.ownDescription(el, 'Thai Iced Tea');
  assert.match(desc, /\bmilk\b/);
});

test('menu item links are units; a section wrapping several is a container', () => {
  const doc = noodleSection();
  const section = doc.querySelector('section');
  assert.match(U.storeUnitSel('manowthaiclarksville.com').join(','), /\?item=/);
  assert.match(U.MENU_ITEM, /\?item=/);
  assert.equal(U.unitRole(section, { unitSel: U.MENU_ITEM }), 'container');
  const pad = doc.querySelector('a[href*="pad-thai"]');
  assert.equal(U.isMenuUnit(pad), true);
  assert.equal(U.unitRole(pad, { unitSel: U.MENU_ITEM }), 'unit');
});

test('classified Owner.com-like cards match the intended 0.4.80 verdicts', () => {
  const doc = noodleSection();
  const expect = {
    'Pad Thai': 'nonvegan',
    'Pad See-Ew': 'nonvegan',
    'Bangkok Noodles': 'nonvegan',
    'Drunken Noodles': 'neutral',
  };
  for (const a of doc.querySelectorAll('a[href*="?item="]')) {
    const headline = (a.querySelector('h3').textContent || '').trim();
    const snippet = U.ownDescription(a, headline);
    const r = C.classify({ headline, snippet, kind: 'dish' }, {});
    const want = expect[headline];
    if (want === 'neutral') assert.notEqual(r.verdict, 'nonvegan', headline + ' ' + JSON.stringify(r));
    else assert.equal(r.verdict, want, headline + ' ' + JSON.stringify({ topic: r.topic, matches: r.matches, snippet }));
  }
});

test('web.js extract looks at SNIPPET_SEL and ownDescription, not only p tags', () => {
  const src = R('web.js');
  assert.match(src, /U\.SNIPPET_SEL/);
  assert.match(src, /U\.ownDescription/);
  assert.match(src, /kind: dishKind \? 'dish'/);
  assert.match(R('webUnits.js'), /ownDescription/);
  assert.match(R('rules\/rules.json'), /squid\|calamari/);
});
