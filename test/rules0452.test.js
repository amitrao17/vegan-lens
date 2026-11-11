const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const vm = require('vm');
const R = require('../rules/rules.js'); const C = require('../contentClassifier.js'); const V = require('../veganBrands.js');
const bundled = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'rules.json'), 'utf8'));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
const sign = payload => crypto.sign(null, Buffer.from(payload), privateKey).toString('base64');
const clone = o => JSON.parse(JSON.stringify(o));
const newer = () => { const b = clone(bundled); b.listVersion = '2099.01.01.1'; return b; };
const fakeFetch = env => async () => ({ ok: true, status: 200, json: async () => env });
test.afterEach(() => R.reset());

test('loading: bundled list is valid, versioned, and rulesData.js is the same data', () => {
  assert.equal(bundled.schemaVersion, 1); assert.match(bundled.listVersion, /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
  assert.ok(R.validate(bundled).ok); assert.equal(R.info().source, 'bundled');
  const ctx = { self: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'rules', 'rulesData.js'), 'utf8'), ctx);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.self.VeganRulesBundled)), bundled);
  for (const s of ['classifier', 'brands', 'brandSites', 'swaps']) assert.ok(bundled.data[s], s);
  assert.ok(R.data().classifier.HEADER_VEGAN instanceof RegExp);
  assert.equal(V.PICKS.length, bundled.data.brands.PICKS.length);
});
test('signature: valid accepted; tampered, wrong key, placeholder key rejected', async () => {
  const p = JSON.stringify(newer()), s = sign(p);
  assert.equal(await R.verifySignature(p, s, PUB), true);
  assert.equal(await R.verifySignature(p.replace('2099', '2098'), s, PUB), false);
  const other = crypto.generateKeyPairSync('ed25519').publicKey;
  assert.equal(await R.verifySignature(p, s, Buffer.from(other.export({ format: 'jwk' }).x, 'base64url').toString('base64')), false);
  assert.equal(await R.verifySignature(p, s, R.PUBLIC_KEY), false);
  const r = await R.fetchUpdate('https://example.test/rules.json', { fetch: fakeFetch({ payload: p, signature: sign(p + ' ') }), publicKey: PUB });
  assert.equal(r.ok, false); assert.match(r.error, /signature/); assert.equal(R.info().source, 'bundled');
});
test('schema: wrong schemaVersion, missing section/key, wrong type, unsafe or broken regex rejected', () => {
  const bad = [];
  let b = newer(); b.schemaVersion = 2; bad.push(b);
  b = newer(); b.listVersion = 'latest'; bad.push(b);
  b = newer(); delete b.data.swaps; bad.push(b);
  b = newer(); delete b.data.classifier.ANIMAL; bad.push(b);
  b = newer(); b.data.classifier.THRESH = 'x'; bad.push(b);
  b = newer(); b.data.classifier.HEADER_VEGAN = { $re: '(a+)+$', flags: '' }; bad.push(b);
  b = newer(); b.data.classifier.HEADER_VEGAN = { $re: '([unclosed', flags: '' }; bad.push(b);
  b = newer(); b.data.classifier.HEADER_VEGAN = { $re: 'x', flags: 'gZ' }; bad.push(b);
  for (const x of bad) assert.equal(R.validate(x).ok, false, JSON.stringify(R.validate(x)));
});
test('update: signed, valid, newer list is applied live and stored; classifier uses it', async () => {
  const b = newer(); b.data.brands.PICKS.push({ ...clone(bundled.data.brands.PICKS[0]), brand: 'Testco', brandRe: { $re: '\\btestco\\b', flags: 'i' }, re: { $re: '\\bzork\\b', flags: 'i' } });
  const p = JSON.stringify(b); let saved = null;
  const r = await R.fetchUpdate('https://example.test/r', { fetch: fakeFetch({ payload: p, signature: sign(p) }), publicKey: PUB, save: rec => { saved = rec; } });
  assert.equal(r.ok, true); assert.equal(r.listVersion, '2099.01.01.1'); assert.equal(saved.listVersion, '2099.01.01.1');
  assert.equal(R.info().source, 'updated'); assert.equal(C.classify('Testco Zork bar').verdict, 'vegan');
  R.reset(); assert.equal(C.classify('Testco Zork bar').verdict, 'neutral');
});
test('fallback: any failure keeps / returns to the bundled list', async () => {
  const p = JSON.stringify(newer());
  assert.equal(R.useStored({ payload: p, signature: 'x' }), true); assert.equal(R.info().source, 'updated');
  assert.equal(R.useStored({ payload: '{not json' }), false); assert.equal(R.info().source, 'bundled');
  const old = clone(bundled); old.listVersion = '2020.01.01.1';
  assert.equal(R.useStored({ payload: JSON.stringify(old) }), false); assert.equal(R.useStored(null), false);
  const bad = newer(); bad.schemaVersion = 9; assert.equal(R.useStored({ payload: JSON.stringify(bad) }), false);
  assert.equal(R.info().source, 'bundled');
  for (const f of [async () => { throw new Error('offline'); }, async () => ({ ok: false, status: 500 }), fakeFetch({ nope: 1 })]) {
    const r = await R.fetchUpdate('https://example.test/r', { fetch: f, publicKey: PUB }); assert.equal(r.ok, false); assert.equal(R.info().source, 'bundled');
  }
  assert.equal((await R.fetchUpdate('', {})).ok, false); assert.equal((await R.fetchUpdate('http://insecure.test/r', { publicKey: PUB })).ok, false);
  assert.equal(C.classify('Ribeye steak recipe').verdict, 'nonvegan');
});
test('signing tool round-trip', async () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vlsign-'));
  const cp = require('child_process'); const tool = path.join(__dirname, '..', 'tools', 'sign-rules.js');
  const pub = cp.execFileSync('node', [tool, '--genkey', dir]).toString().trim();
  fs.writeFileSync(path.join(dir, 'r.json'), JSON.stringify(newer()));
  cp.execFileSync('node', [tool, path.join(dir, 'private.pem'), path.join(dir, 'r.json'), path.join(dir, 'out.json')]);
  const env = JSON.parse(fs.readFileSync(path.join(dir, 'out.json'), 'utf8'));
  assert.equal(await R.verifySignature(env.payload, env.signature, pub), true);
  fs.rmSync(dir, { recursive: true, force: true });
});
