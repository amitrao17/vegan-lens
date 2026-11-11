// Vegan Lens rule lists (0.4.52): keywords, patterns, brand lists, vegan picks, swaps... live in rules/rules.json
// (schemaVersion + listVersion), like an ad-blocker filter list. Data only: regexes are strings compiled here after
// validation; no remote code is ever loaded. Optional updates (background, off unless an update URL is set) must be
// Ed25519-signed with the key below, schema-valid and newer than the bundled list; anything else falls back to the bundle.
// Browser global (VeganRules) + Node module.
(function (root) {
  'use strict';
  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'vlRules', LOCAL_KEY = 'vlRulesLocal';
  // PLACEHOLDER public key (raw Ed25519, base64). Replace with your own (tools/sign-rules.js --genkey) before publishing lists.
  const PUBLIC_KEY = 'PLACEHOLDER_ED25519_PUBLIC_KEY';
  const MAX_RE = 20000;
  // Catastrophic-backtracking guard: a quantified group that itself ends in a quantifier, e.g. (a+)+ or (?:\w*)*
  const NESTED_Q = /\((?:[^()\\]|\\.)*[+*}]\)(?:[+*]|\{\d+,\d*\})/;

  const isRe = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.$re === 'string';
  function compile(v) {
    if (v.$re.length > MAX_RE) throw new Error('pattern too long');
    if (!/^[gimsuy]*$/.test(v.flags || '')) throw new Error('bad flags');
    if (NESTED_Q.test(v.$re)) throw new Error('unsafe pattern');
    return new RegExp(v.$re, v.flags || '');
  }
  function hydrate(v) {
    if (isRe(v)) return compile(v);
    if (Array.isArray(v)) return v.map(hydrate);
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = hydrate(v[k]); return o; }
    return v;
  }
  const kind = v => isRe(v) ? 're' : Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
  // Shape check against the bundled list: same sections and keys, same value kinds (strings/numbers/regex/arrays/objects).
  function sameShape(ref, v, p) {
    if (kind(ref) !== kind(v)) throw new Error('schema: ' + p + ' should be ' + kind(ref));
    if (kind(ref) === 'object') for (const k of Object.keys(ref)) { if (!(k in v)) throw new Error('schema: missing ' + p + '.' + k); sameShape(ref[k], v[k], p + '.' + k); }
    if (kind(ref) === 'array' && ref.length && v.length) { const r0 = ref[0]; for (let i = 0; i < v.length; i++) if (kind(v[i]) !== kind(r0) && !(kind(r0) === 'object' && kind(v[i]) === 'object')) throw new Error('schema: ' + p + '[' + i + ']'); }
  }
  const OPTIONAL_SECTIONS = ['monetization'];
  const LATER_KEYS = { classifier: ['EQUIPMENT_HEAD', 'DISCUSSION', 'FOOD_SHOW', 'MATERIAL_NAMES', 'ARTS_CTX', 'MATERIAL_PRODUCT', 'ARTS_MATERIAL', 'MIXED_VENUE', 'MIXED_GOODS'] };
  // Affiliate tag: empty (inactive) or a plain Associates id; domains: bare hostnames; supportUrl: empty or https.
  function checkMonetization(m) {
    if (!m) return;
    const a = m.affiliate && m.affiliate.amazon;
    if (a) {
      if (!/^(?:[A-Za-z0-9][A-Za-z0-9-]{0,39})?$/.test(a.tag)) throw new Error('monetization.affiliate.amazon.tag: letters, digits and - only (e.g. yourtag-20)');
      if (!/^[a-z][a-z0-9_]{0,15}$/.test(a.param)) throw new Error('monetization.affiliate.amazon.param: invalid');
      a.domains.forEach((h, i) => { if (!/^amazon\.[a-z.]{2,10}$/.test(h)) throw new Error('monetization.affiliate.amazon.domains[' + i + ']: must be an amazon.* hostname'); });
    }
    if (m.supportUrl && !/^https:\/\/[^\s"'<>]+$/.test(m.supportUrl)) throw new Error('monetization.supportUrl: must be empty or an https:// URL');
  }
  const VER = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
  const cmpVersion = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

  const bundledRaw = (typeof module !== 'undefined' && module.exports) ? require('./rules.json') : root.VeganRulesBundled;
  // Returns {ok, error, bundle, data}. ref: bundle whose shape is required (defaults to the bundled list).
  function validate(bundle, ref) {
    try {
      if (!bundle || typeof bundle !== 'object') throw new Error('not an object');
      if (bundle.schemaVersion !== SCHEMA_VERSION) throw new Error('schemaVersion ' + bundle.schemaVersion + ' unsupported');
      if (!VER.test(String(bundle.listVersion))) throw new Error('bad listVersion');
      const R0 = (ref || bundledRaw).data;
      // 0.4.58: sections added after a list was saved (e.g. monetization) are back-filled from the built-in list.
      if (bundle.data && typeof bundle.data === 'object') for (const k of OPTIONAL_SECTIONS) if (!(k in bundle.data) && R0 && k in R0) bundle = { ...bundle, data: { ...bundle.data, [k]: JSON.parse(JSON.stringify(R0[k])) } };
      // 0.4.62: keys added in later versions (listed in LATER_KEYS) are back-filled; any other missing key still fails.
      if (bundle.data && R0) for (const [k, keys] of Object.entries(LATER_KEYS)) { const a = bundle.data[k]; if (a && typeof a === 'object' && R0[k]) { const miss = keys.filter(x => !(x in a) && x in R0[k]); if (miss.length) { const c = { ...a }; for (const x of miss) c[x] = JSON.parse(JSON.stringify(R0[k][x])); bundle = { ...bundle, data: { ...bundle.data, [k]: c } }; } } }
      sameShape(R0, bundle.data, 'data');
      checkMonetization(bundle.data.monetization);
      return { ok: true, bundle, data: hydrate(bundle.data) };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }
  const b64 = s => { const bin = (typeof atob === 'function') ? atob(s) : Buffer.from(s, 'base64').toString('binary'); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  async function verifySignature(payload, sigB64, pubB64, subtle) {
    try {
      subtle = subtle || (root.crypto && root.crypto.subtle) || require('crypto').webcrypto.subtle;
      if (!pubB64 || /PLACEHOLDER/.test(pubB64)) return false;
      const key = await subtle.importKey('raw', b64(pubB64), { name: 'Ed25519' }, false, ['verify']);
      return await subtle.verify({ name: 'Ed25519' }, key, b64(sigB64), new TextEncoder().encode(payload));
    } catch (e) { return false; }
  }

  const base = validate(bundledRaw, bundledRaw);
  if (!base.ok) throw new Error('Vegan Lens bundled rules invalid: ' + base.error);
  // Precedence (0.4.54): local edits (rules editor) > signed remote update > bundled.
  let cur = base, remote = null, local = null; const listeners = [];
  const data = () => cur.data;
  const info = () => ({ listVersion: cur.bundle.listVersion, bundledVersion: base.bundle.listVersion, remoteVersion: remote ? remote.bundle.listVersion : '', schemaVersion: SCHEMA_VERSION, source: cur === base ? 'bundled' : cur === local ? 'local' : 'updated', localActive: !!local });
  const active = () => cur.bundle; // raw (string patterns) for the editor / export
  function onChange(fn) { listeners.push(fn); }
  function recompute() { const next = local || remote || base; if (next !== cur) { cur = next; for (const fn of listeners) try { fn(cur.data); } catch (e) {} } }
  function set(v) { remote = v; recompute(); }
  function reset() { local = null; remote = null; recompute(); }
  // Applies a stored (already signature-checked) bundle: must be schema-valid and newer than the bundled list.
  function useStored(stored) {
    let b = null; try { b = stored && typeof stored.payload === 'string' ? JSON.parse(stored.payload) : null; } catch (e) { b = null; }
    const v = b && validate(b);
    remote = v && v.ok && cmpVersion(b.listVersion, base.bundle.listVersion) > 0 ? v : null; recompute(); return !!remote;
  }
  // Local edits: no signature (never leaves the device) but the same schema + pattern-safety checks. null clears.
  function useLocal(bundle) {
    if (bundle == null) { local = null; recompute(); return { ok: true, cleared: true }; }
    const v = validate(bundle); if (!v.ok) { local = null; recompute(); return v; }
    local = v; recompute(); return { ok: true, listVersion: bundle.listVersion };
  }
  // Background update: GET url -> {payload: "<rules.json text>", signature: "<base64 Ed25519 over payload>"}.
  // No browsing data is sent (plain GET, no query, no cookies). Any failure keeps the current list.
  async function fetchUpdate(url, deps) {
    deps = deps || {};
    if (!url) return { ok: false, error: 'no update URL set' };
    try {
      if (!/^https:\/\//i.test(url)) throw new Error('update URL must be https');
      const f = deps.fetch || root.fetch;
      const res = await f(url, { method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const env = await res.json();
      if (!env || typeof env.payload !== 'string' || typeof env.signature !== 'string') throw new Error('bad envelope');
      if (!(await verifySignature(env.payload, env.signature, deps.publicKey || PUBLIC_KEY, deps.subtle))) throw new Error('signature rejected');
      const b = JSON.parse(env.payload); const v = validate(b);
      if (!v.ok) throw new Error(v.error);
      if (cmpVersion(b.listVersion, base.bundle.listVersion) <= 0) return { ok: true, listVersion: base.bundle.listVersion, note: 'bundled list is current' };
      const rec = { payload: env.payload, signature: env.signature, listVersion: b.listVersion, fetchedAt: Date.now() };
      if (deps.save) await deps.save(rec);
      set(v); return { ok: true, listVersion: b.listVersion };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }
  const api = { SCHEMA_VERSION, STORAGE_KEY, LOCAL_KEY, useLocal, active, PUBLIC_KEY, validate, hydrate, compile, verifySignature, cmpVersion, data, info, onChange, useStored, fetchUpdate, reset, bundled: () => base };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.VeganRules = api;
  // Every context (content, popup, worker) picks up a stored update; falls back to the bundle on any problem.
  if (root.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ [STORAGE_KEY]: null, [LOCAL_KEY]: null }, st => { useStored(st && st[STORAGE_KEY]); useLocal(st && st[LOCAL_KEY]); });
    if (chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch, area) => { if (area !== 'local') return; if (ch[STORAGE_KEY]) useStored(ch[STORAGE_KEY].newValue); if (ch[LOCAL_KEY]) useLocal(ch[LOCAL_KEY].newValue); });
  }
})(typeof self !== 'undefined' ? self : this);
