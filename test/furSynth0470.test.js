// 0.4.70: fur is only cleared by fur-specific synthetic evidence; Faux Leather does not clear it.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../classifier.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const P = { allowProbably: true };
const TITLE = 'Womens Over The Knee High Boots Chunky Heel Slip On Faux Leather Riding Surgical Stretch Thigh High Boots';

test('versions agree at 0.4.70', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.70');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.70');
});

test('Faux Leather title + Inner material Fur is Caution, not vegan', () => {
  const r = C.classify(TITLE, { attributes: [{ label: 'Inner material', value: 'Fur' }, { label: 'Outer material', value: 'Polyurethane (PU)' }], ...P });
  assert.equal(r.verdict, 'unknown');
  assert.ok(r.caution.some(c => /may contain animal/i.test(c)), r.caution);
  assert.ok(!r.matched.length, r.matched);
});

test('Inner material Fur + Real rabbit fur is non-vegan', () => {
  const r = C.classify(TITLE + '\nReal rabbit fur lining', { attributes: [{ label: 'Inner material', value: 'Fur' }], ...P });
  assert.equal(r.verdict, 'non-vegan');
  assert.ok(r.matched.some(m => /fur|rabbit/i.test(m)), r.matched);
});

test('bare Inner material Fur with no other evidence is Caution', () => {
  const r = C.classify('Winter boots', { attributes: [{ label: 'Inner material', value: 'Fur' }], ...P });
  assert.equal(r.verdict, 'unknown');
  assert.ok(r.caution.some(c => /may contain animal/i.test(c)), r.caution);
});

test('faux fur lining or Faux Fur Trim is Probably vegan and names the phrase', () => {
  const lining = C.classify('Winter boots with faux fur lining', P);
  assert.equal(lining.verdict, 'probably');
  assert.ok((lining.probable || []).some(p => /faux fur lining/i.test(p)), lining.probable);

  const trim = C.classify(TITLE + '\nEmbellishment Feature: Faux Fur Trim, zipper', {
    attributes: [
      { label: 'Inner material', value: 'Fur' },
      { label: 'Embellishment Feature', value: 'Faux Fur Trim, zipper' },
    ],
    ...P,
  });
  assert.equal(trim.verdict, 'probably');
  assert.ok((trim.probable || []).some(p => /faux fur trim/i.test(p)), trim.probable);
});

test('B0DG5N6JQ4-like attributes (Faux Fur Trim + lining-description Synthetic) are Probably vegan', () => {
  const attrs = [
    { label: 'Outer material', value: 'Polyurethane (PU)' },
    { label: 'Inner material', value: 'Fur' },
    { label: 'Sole material', value: 'Rubber' },
    { label: 'lining-description', value: 'Synthetic' },
    { label: 'Embellishment Feature', value: 'Faux Fur Trim, zipper' },
    { label: 'Material Fabric', value: 'Polyurethane' },
  ];
  const about = 'crafted with PU leather upper material, short plush/thick fur lining, and anti-skid rubber sole';
  const r = C.classify(TITLE + '\n' + about + '\nEmbellishment Feature: Faux Fur Trim, zipper', { attributes: attrs, ...P });
  assert.equal(r.verdict, 'probably');
  assert.ok((r.probable || []).some(p => /faux fur/i.test(p)), r.probable);
  assert.ok(!r.matched.length, r.matched);
});

test('recycled materials / sustainability wording does not clear a bare fur row', () => {
  const r = C.classify(TITLE + '\nRecycled materials. Climate Pledge Friendly.', { attributes: [{ label: 'Inner material', value: 'Fur' }], ...P });
  assert.equal(r.verdict, 'unknown');
  assert.ok(r.caution.some(c => /may contain animal/i.test(c)), r.caution);
});

test('Material: Faux Fur is still vegan (existing materials rule)', () => {
  const r = C.classify('Item', { attributes: [{ label: 'Material', value: 'Faux Fur' }] });
  assert.equal(r.verdict, 'vegan');
  assert.ok(r.positives.some(p => /faux fur/i.test(p)), r.positives);
});

test('content.js scans voyager / prodDet tables and re-evaluates the banner when deeper copy appears', () => {
  const c = R('content.js');
  assert.match(c, /table\.prodDetTable/);
  assert.match(c, /prodDetSectionEntry/);
  assert.match(c, /voyager-ns-desktop-side-sheet-container/);
  assert.match(c, /#aplus_feature_div|#aplus/);
  assert.match(c, /#productFactsDesktop_feature_div|#productFactsDesktopExpander/);
  assert.match(c, /#feature-bullets/);
  assert.match(c, /#productDescription/);
  assert.match(c, /#productOverview_feature_div/);
  assert.match(c, /#detailBullets_feature_div/);
  assert.match(c, /#prodDetails/);
  assert.match(c, /#poExpander/);
  assert.match(c, /#twister|#variation_color_name/);
  assert.match(c, /dataset\.vlSig/);
  assert.match(c, /if \(b && b\.dataset\.vlSig === String\(sig\)\) return/);
});

test('CHANGELOG records the faux-fur PDP rule and the verified B0DG5N6JQ4 location', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /## 0\.4\.70/);
  assert.match(log, /Faux Fur Trim/i);
  assert.match(log, /B0DG5N6JQ4/);
  assert.match(log, /Faux Leather/i);
});
