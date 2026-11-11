// 0.4.46: every code path that adds the blur class must also add the 'Vegan Lens · blurred' label (blurLabel) in the same statement.
const fs = require('fs'), assert = require('node:assert');
function assertEveryBlurAttributed() {
  const dir = __dirname + '/../..'; let n = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(dir + '/' + f, 'utf8');
    for (const m of src.matchAll(/classList\.add\([^)]*'vl-img-blur'[^\n]*(?:\n[^\n]*){0,1}/g)) { n++; assert.match(m[0], /blurLabel\(/, f + ': blur without attribution: ' + m[0].slice(0, 120)); }
  }
  assert.ok(n >= 2, 'blur sites found'); return n;
}
module.exports = { assertEveryBlurAttributed };
