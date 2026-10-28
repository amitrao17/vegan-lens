// Vegan Lens "public figures" marker. Browser global (VeganPeople) + Node module.
// Adds a small pill after the names of people listed in people.json, each entry backed by a source URL where the
// person publicly said it themselves. Statuses: 'vegan' (green V), 'former' (grey, stated they stopped being vegan),
// 'meat' (🥩, publicly endorses eating meat). There is deliberately NO generic 'non-vegan' label: unlisted people get nothing.
(function (root) {
  'use strict';
  const STATUS = {
    vegan: { cls: 'vl-p-vegan', text: 'V', tip: 'Publicly vegan — source', setting: 'markPeople' },
    former: { cls: 'vl-p-former', text: 'former vegan', tip: 'Former vegan (publicly stated they stopped) — source', setting: 'markPeople' },
    meat: { cls: 'vl-p-meat', text: '🥩', tip: 'Publicly endorses eating meat — source', setting: 'markMeat' },
  };
  const MAX_PER_NAME = 3;
  const SKIP = 'script, style, code, pre, kbd, samp, textarea, input, select, option, noscript, svg, math, iframe, [contenteditable], .vl-p-pill, .vl-w-chip, .vl-w-ctx, #vl-w-banner';
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = s => String(s).normalize('NFC').replace(/[\u2019]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

  function buildIndex(people, opts) {
    opts = opts || {};
    const byKey = new Map();
    for (const p of people || []) {
      if (!STATUS[p.status] || !p.source || !/^https:\/\//.test(p.source)) continue; // unsourced entries are ignored
      if (opts.statuses && !opts.statuses.includes(p.status)) continue;
      for (const n of [p.name, ...(p.aliases || [])]) if (n && n.trim()) byKey.set(norm(n), p);
    }
    if (!byKey.size) return null;
    const names = new Map(); for (const p of byKey.values()) for (const n of [p.name, ...(p.aliases || [])]) names.set(n.trim(), p);
    const alts = [...names.keys()].sort((a, b) => b.length - a.length).map(k => esc(k).replace(/ /g, '\\s+').replace(/'/g, "['\u2019]"));
    // whole-name only: no letter/digit (or joining apostrophe/hyphen) directly before or after
    const re = new RegExp("(?<![\\p{L}\\p{N}_'\u2019-])(?:" + alts.join('|') + ")(?![\\p{L}\\p{N}_]|-\\p{L}|['\u2019](?!s(?![\\p{L}]))\\p{L})", 'gu'); // case-sensitive: proper names only
    return { re, byKey };
  }
  function findMatches(text, index) {
    if (!index || !text) return [];
    const out = []; index.re.lastIndex = 0; let m;
    while ((m = index.re.exec(text))) {
      // single-word names (Moby, Sia, Lizzo): skip when part of a longer capitalised name ("Moby Dick")
      if (!/\s/.test(m[0]) && (/^\s+\p{Lu}/u.test(text.slice(m.index + m[0].length)) || /\p{Lu}[\p{L}.]*\s+$/u.test(text.slice(0, m.index)))) continue;
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0], person: index.byKey.get(norm(m[0])) });
    }
    return out;
  }
  // Inside an existing link a nested <a> is invalid HTML: use a <span> whose tooltip carries the source URL instead.
  function pillFor(doc, p, inLink) {
    const st = STATUS[p.status]; if (!st) return null;
    const a = doc.createElement(inLink ? 'span' : 'a');
    a.className = 'vl-p-pill ' + st.cls;
    if (!inLink) { a.setAttribute('href', p.source); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    a.setAttribute('title', st.tip + (p.date ? ' (' + p.date + ')' : '') + ': ' + p.source);
    a.setAttribute('aria-label', st.tip);
    a.setAttribute('data-vl-person', p.name);
    a.textContent = st.text;
    return a;
  }
  // state: { counts: Map(name -> n) } persists across calls on one page so the cap is per page.
  function markRoot(rootNode, doc, index, state) {
    if (!index || !rootNode) return 0;
    state = state || { counts: new Map() };
    const el0 = rootNode.nodeType === 1 ? rootNode : rootNode.parentNode;
    if (el0 && el0.closest && el0.closest(SKIP)) return 0;
    if (el0 && el0.isContentEditable) return 0;
    const walker = doc.createTreeWalker(rootNode, 4 /* SHOW_TEXT */, {
      acceptNode: n => { const p = n.parentNode; return (!p || (p.closest && p.closest(SKIP)) || p.isContentEditable || !/\p{L}{2}/u.test(n.data)) ? 2 : 1; },
    });
    const nodes = []; for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    let added = 0;
    for (const node of nodes) {
      const ms = findMatches(node.data, index); if (!ms.length) continue;
      let cur = node, offset = 0;
      for (const m of ms) {
        const name = m.person.name, c = state.counts.get(name) || 0;
        if (c >= MAX_PER_NAME) continue;
        const rel = m.end - offset;
        if (rel === cur.data.length && alreadyMarked(cur, name)) continue; // re-scan of an already marked name
        const tail = cur.splitText(rel); // cur now ends with the name; tail holds the rest (no reordering)
        const par = cur.parentNode; par.insertBefore(pillFor(doc, m.person, !!(par.closest && par.closest('a[href]'))), tail);
        state.counts.set(name, c + 1); added++;
        cur = tail; offset = m.end;
      }
    }
    return added;
  }
  function alreadyMarked(textNode, name) { const s = textNode.nextSibling; return !!(s && s.getAttribute && s.getAttribute('data-vl-person') === name); }
  function unmarkAll(doc) { doc.querySelectorAll('.vl-p-pill').forEach(p => { const par = p.parentNode; p.remove(); if (par && par.normalize) par.normalize(); }); }
  const api = { STATUS, MAX_PER_NAME, SKIP, buildIndex, findMatches, markRoot, pillFor, unmarkAll, alreadyMarked, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganPeople = api;
})(typeof self !== 'undefined' ? self : this);
