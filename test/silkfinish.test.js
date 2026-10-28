const test=require('node:test'),assert=require('node:assert');
const {classify}=require('../classifier.js');
test('silk finish lipstick is not flagged',()=>{assert.notStrictEqual(classify('wet n wild Silk Finish Lipstick, Hydrating Rich Buildable Lip Color').verdict,'non-vegan');});
test('silkscreen print not flagged',()=>{assert.notStrictEqual(classify('Silkscreen Printed Cotton T-Shirt').verdict,'non-vegan');});
test('real silk still flagged',()=>{assert.strictEqual(classify('100% Mulberry Silk Pillowcase').verdict,'non-vegan');});
