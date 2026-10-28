// v0.4.5: hidden animal materials in instruments and other non-food items.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../classifier.js');
const v = t => C.classify(t, {}).verdict;
const NON = [
  'Student Violin Bow with Mongolian Horsehair', 'Cello Bow, Brazilwood, Horse Hair', 'Viola Bow Real Horsehair Pernambuco',
  'Double Bass Bow Natural Bleached Hair', 'Acoustic Guitar with Bone Nut and Saddle', 'Bone Bridge Pins Set of 6',
  'Baroque Violin Gut Strings', 'Tennis Racket Natural Gut Strings', 'Hide Glue for Luthiers', 'Calfskin Drumhead 14"',
  'Goatskin Djembe Drum', 'Mandolin with Mother-of-Pearl Inlay', 'Ukulele Abalone Rosette', 'Violin with Shellac Finish',
  'Antique Ivory Piano Keys', 'Mammoth Ivory Guitar Nut', 'Walrus Tusk Carving',
  'Horsehair Shoe Shine Brush', 'Boar Bristle Hair Brush', 'Mulberry Silk Pillowcase', 'Goose Down Comforter',
  'Merino Wool Socks', 'Cashmere Sweater', 'Shearling Slippers', 'Mohair Throw Blanket', 'Lanolin Nipple Cream',
  'Casein Paint Set', 'Bone China Tea Cups', 'Lipstick with Carmine', 'Parka with Fur Trim Hood', 'Sable Brush Set for Watercolor',
];
const OK = [
  'Carbon Fiber Violin Bow with Synthetic Hair', 'Guitar with Tusq Nut and Saddle', 'Graph Tech Tusq Bridge Pins',
  'Vegan Leather Guitar Strap', 'Synthetic Drumhead 14"', 'Faux Fur Throw Blanket', 'Bone-Free Guitar Saddle',
  'Synthetic Gut Violin Strings', 'Nylon Guitar Strings', 'Ivory Color Sheer Curtains', 'Faux Shearling Slippers',
  'Down Alternative Comforter', 'Taklon Synthetic Watercolor Brush Set', 'Pearl White Guitar Pickguard',
];
for (const t of NON) test('hidden animal material: ' + t, () => assert.strictEqual(v(t), 'non-vegan', t));
for (const t of OK) test('synthetic alternative not flagged: ' + t, () => assert.notStrictEqual(v(t), 'non-vegan', t));
