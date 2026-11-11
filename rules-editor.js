// Vegan Lens rules editor (0.4.54). Local only: the edited list is stored in chrome.storage.local (vlRulesLocal) and every
// open tab picks it up through rules/rules.js (storage.onChanged). Same schema + pattern-safety checks as signed updates.
(function () {
  'use strict';
  const R = window.VeganRules, $ = id => document.getElementById(id);
  const ta = $('json'), sec = $('section'), msg = $('msg'), st = $('state');
  let draft = JSON.parse(JSON.stringify(R.active()));
  const say = (t, ok) => { msg.textContent = t; msg.className = 'msg ' + (ok ? 'ok' : 'err'); };
  function showState() { const i = R.info(); st.textContent = 'Active list ' + i.listVersion + ' \u2014 ' + (i.source === 'local' ? 'Local edits active' : i.source === 'updated' ? 'downloaded update' : 'built-in'); st.className = 'state' + (i.localActive ? ' local' : ''); }
  for (const k of Object.keys(draft.data)) for (const s of Object.keys(draft.data[k])) { const o = document.createElement('option'); o.value = k + '.' + s; o.textContent = k + ' \u203a ' + s; sec.append(o); }
  const view = () => { const p = sec.value; ta.value = JSON.stringify(p ? draft.data[p.split('.')[0]][p.split('.')[1]] : draft, null, 2); };
  // Pull the textarea back into the draft; returns an error string (with path) or ''.
  function pull() {
    let v; try { v = JSON.parse(ta.value); } catch (e) { return 'JSON syntax: ' + e.message; }
    const p = sec.value; if (p) { const [a, b] = p.split('.'); draft.data[a][b] = v; } else draft = v; return '';
  }
  function check(bundle) { const v = R.validate(bundle); return v.ok ? '' : v.error; }
  function store(bundle) { return new Promise(ok => chrome.storage.local.set({ [R.LOCAL_KEY]: bundle }, ok)); }
  // Dev/test hook (also used by the buttons): apply(bundle) -> {ok, error?}; reset(); get().
  const api = {
    get: () => JSON.parse(JSON.stringify(R.active())),
    validate: b => { const e = check(b); return e ? { ok: false, error: e } : { ok: true }; },
    async apply(b) { const e = check(b); if (e) return { ok: false, error: e }; await store(b); const r = R.useLocal(b); showState(); return r; },
    async reset() { await new Promise(ok => chrome.storage.local.remove(R.LOCAL_KEY, ok)); R.useLocal(null); draft = api.get(); view(); showState(); return { ok: true }; },
  };
  window.vlRulesEditor = api;
  sec.addEventListener('change', () => { const e = pull(); if (e) { say(e); return; } view(); });
  $('validate').addEventListener('click', () => { const e = pull() || check(draft); say(e || 'Valid: schema and all patterns OK.', !e); });
  $('apply').addEventListener('click', async () => { const e = pull(); if (e) return say(e); const r = await api.apply(draft); say(r.ok ? 'Applied: local edits are active in all open tabs.' : r.error, r.ok); });
  $('export').addEventListener('click', () => { const e = pull(); if (e) return say(e); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 1)], { type: 'application/json' })); a.download = 'vegan-lens-rules-' + draft.listVersion + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
  $('import').addEventListener('change', async ev => { const f = ev.target.files[0]; if (!f) return; try { const b = JSON.parse(await f.text()); const e = check(b); if (e) return say('Import rejected: ' + e); draft = b; sec.value = ''; view(); say('Imported (not applied yet). Press Apply to use it.', true); } catch (err) { say('Import: ' + err.message); } ev.target.value = ''; });
  $('reset').addEventListener('click', async () => { await api.reset(); say('Local edits removed; using the ' + (R.info().source === 'updated' ? 'downloaded' : 'built-in') + ' list.', true); });
  R.onChange(showState);
  chrome.storage.local.get({ [R.LOCAL_KEY]: null }, s => { if (s[R.LOCAL_KEY]) { R.useLocal(s[R.LOCAL_KEY]); draft = api.get(); } view(); showState(); });
})();
