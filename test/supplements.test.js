// v0.4.5: non-vegan dietary supplements vs vegan alternatives.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../classifier.js');
const v = t => C.classify(t, {}).verdict;
const NON = [
  'Turmeric 500mg Gelatin Capsules', 'Vitamin E 400 IU Softgels', 'Fish Oil Omega-3 1200mg', 'Antarctic Krill Oil', 'Norwegian Cod Liver Oil',
  'Collagen Peptides Powder', 'Bovine Collagen Peptides', 'Marine Collagen', 'Bone Broth Protein Powder', 'Whey Protein Isolate',
  'Micellar Casein Protein', 'Vitamin D3 5000 IU', 'Cholecalciferol 2000 IU', 'Glucosamine Chondroitin Joint Support',
  "Multivitamin Tablets with Confectioner's Glaze", 'Shellac Coated Probiotic Tablets', 'Chewable Vitamins (colored with carmine)',
  'Royal Jelly 1000mg', 'Bee Pollen Granules', 'Propolis Throat Spray', 'Lip Balm with Beeswax', 'Bovine Colostrum Powder',
  'Desiccated Beef Liver Capsules', 'Grass-Fed Organs Complex', 'New Zealand Deer Antler Velvet', 'Elk Antler Supplement', 'Chitosan 500mg Fat Binder',
];
const OK = [
  'Algae Omega-3 DHA EPA Softgels', 'Algal Oil Omega-3 Vegan Capsules', 'Vegan D3 from Lichen 2000 IU', 'Vitamin D3 (from lichen) 1000 IU',
  'Pea Protein Powder Unflavored', 'Organic Brown Rice Protein', 'Ashwagandha 600mg Veggie Capsules', 'Magnesium Glycinate HPMC Capsules',
  'Probiotic in Pullulan Capsules', 'Vegan Collagen Builder', 'Certified Vegan Multivitamin', 'Plant-Based Protein Powder',
];
for (const t of NON) test('supplement non-vegan: ' + t, () => assert.strictEqual(v(t), 'non-vegan', t));
for (const t of OK) test('supplement vegan alternative not flagged: ' + t, () => assert.notStrictEqual(v(t), 'non-vegan', t));
