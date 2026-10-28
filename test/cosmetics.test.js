// v0.4.5: animal-derived cosmetics & hygiene ingredients vs vegan alternatives.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../classifier.js');
const v = t => C.classify(t, {}).verdict;
const NON = [
  'Red Lipstick (contains carmine)', 'Blush with Cochineal Extract', 'Eyeshadow Ingredients: Mica, CI 75470', 'Lip Balm with Cera Alba',
  'Lanolin Hand Cream', 'Squalene Face Oil', 'Shark Liver Oil Cream', 'Keratin Hair Treatment', 'Collagen Night Cream', 'Elastin Firming Serum',
  'Shimmer Nail Polish with Guanine', 'Bar Soap: Sodium Tallowate, Water', 'Lotion with Animal-Derived Stearic Acid', 'Nail Glaze with Shellac',
  'Snail Mucin 96% Power Essence', 'Snail Secretion Filtrate Cream', 'Manuka Honey Face Mask', 'Royal Jelly Eye Cream', 'Propolis Ampoule',
  'Goat Milk Soap', 'Silk Powder Setting Powder', 'Sericin Serum', 'Ambergris Perfume', 'Musk Oil Fragrance', 'Civet Perfume', 'Castoreum Leather Scent',
  'Emu Oil Moisturizer', 'Mink Oil Hair Conditioner', 'Hyaluronic Acid from Rooster Comb', 'Boar Bristle Hair Brush', 'Badger Hair Shaving Brush',
  '3D Mink Lashes', 'Horsehair Makeup Brush', 'Kabuki Brush Goat Hair',
];
const OK = [
  'Vegan Lipstick Red', 'Plant-Based Lip Balm with Candelilla Wax', 'Carnauba Wax Mascara', 'Bar Soap: Sodium Palmate, Sodium Cocoate',
  'Olive Squalane Oil', 'Plant Squalane Face Oil', 'Sugarcane Squalane Serum', 'Synthetic Kabuki Brush Set', 'Faux Mink Lashes',
  'Taklon Synthetic Makeup Brushes', 'Hyaluronic Acid Serum (vegan, fermentation-derived)', 'Stearic Acid Lotion',
];
for (const t of NON) test('cosmetic non-vegan: ' + t, () => assert.strictEqual(v(t), 'non-vegan', t));
for (const t of OK) test('cosmetic vegan alternative not flagged: ' + t, () => assert.notStrictEqual(v(t), 'non-vegan', t));
