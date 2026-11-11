// v0.4.27: animal sports (polo, dog sledding, horse racing, rodeo, bullfighting...).
const test = require('node:test'), assert = require('node:assert');
const { classify } = require('../contentClassifier.js');
const POS = ['Polo match at Palm Beach Polo Club', 'Iditarod 2026: sled dogs reach Nome', 'Dog sledding tours in Lapland', 'Yukon Quest mushers set off',
  'Kentucky Derby picks and odds', 'Jockey wins on longshot thoroughbred', 'Preakness Stakes preview', 'Belmont Stakes results', 'Grand National 2026 runners',
  'Harness racing at the fair', 'Steeplechase at Cheltenham', 'Rodeo bull riding finals', 'Barrel racing and calf roping championship', 'Steer wrestling highlights',
  'Running of the bulls in Pamplona', 'Matador gored in corrida', 'Greyhound racing returns to the track', 'Police raid cockfighting ring', 'Camel racing in Dubai',
  'Pigeon racing club annual race', 'Show jumping at the Olympics', 'Dressage world cup', 'Equestrian eventing team named', 'Jallikattu festival begins',
  'Elephant polo tournament in Nepal', 'Bass tournament results', 'Fox hunting season opens'];
const NEG = ['Water polo team wins gold', 'Polo shirts on sale', 'Polo Ralph Lauren fall collection', 'VW Polo review', 'Marco Polo travels', 'Polo neck sweaters for winter',
  'Bike polo league forms', 'Derby County beat Leeds', 'Roller derby league', 'Demolition derby tonight', 'Soapbox derby winners', 'Belmont University news',
  'Not my first rodeo', 'Rodeo Drive shopping guide', 'Disc jockey sets the mood', "Women's 3000m steeplechase final", 'Jockeying for position in the Senate race'];
test('animal sports dim', () => { for (const t of POS) { const r = classify(t); assert.strictEqual(r.verdict, 'nonvegan', t); } assert.strictEqual(classify('Polo match at Palm Beach').topic, 'animal sports'); });
test('false friends stay neutral', () => { for (const t of NEG) assert.notStrictEqual(classify(t).verdict, 'nonvegan', t); });
test('critique / ethics framing is vegan-leaning', () => {
  for (const t of ['Ban horse racing now', 'End greyhound racing', 'Protest against rodeos', 'Racehorse deaths spark outrage', 'Spain moves to abolish bullfighting'])
    assert.strictEqual(classify(t).verdict, 'vegan', t);
});
test('vegan pages never dim; image alt text blurs', () => {
  assert.notStrictEqual(classify('Rodeo bull riding finals', { pageVegan: true }).verdict, 'nonvegan');
  for (const alt of ['polo match', 'rodeo cowboy on a bull', 'jockey on a racehorse', 'sled dogs pulling a musher']) assert.strictEqual(classify(alt).verdict, 'nonvegan', alt);
});
