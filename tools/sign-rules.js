// Sign a rule list for the optional update URL (local tool, not shipped).
//   node tools/sign-rules.js --genkey keys/            -> writes ed25519 private.pem (keep secret!) and prints the base64 public key
//                                                       to paste into PUBLIC_KEY in rules/rules.js
//   node tools/sign-rules.js private.pem rules/rules.json out.json   -> {payload, signature} envelope to host anywhere (https)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const a = process.argv.slice(2);
if (a[0] === '--genkey') {
  const dir = a[1] || '.'; fs.mkdirSync(dir, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(dir, 'private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const raw = publicKey.export({ format: 'jwk' }).x; // base64url raw key
  console.log(Buffer.from(raw, 'base64url').toString('base64'));
} else if (a.length >= 3) {
  const key = crypto.createPrivateKey(fs.readFileSync(a[0]));
  const payload = JSON.stringify(JSON.parse(fs.readFileSync(a[1], 'utf8')));
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), key).toString('base64');
  fs.writeFileSync(a[2], JSON.stringify({ payload, signature }));
  console.log('signed', JSON.parse(payload).listVersion, '->', a[2]);
} else { console.error('usage: --genkey DIR | PRIVATE.pem RULES.json OUT.json'); process.exit(1); }
