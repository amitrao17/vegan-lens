// Pure badge logic, shared by background.js (importScripts) and tests (require).
(function (root) {
  // 0.4.26 all-clear: nothing non-vegan, no caution items, and enough content evaluated (>= 3 units or a vegan page).
  const ALL_CLEAR = { text: '\u2713', color: '#2e7d32', title: 'Vegan Lens: no non-vegan content found' };
  function isAllClear(c) {
    c = c || {};
    return !(c.nonvegan | 0) && !(c.context | 0) && !(c.caution | 0) && ((c.scanned | 0) >= 3 || (c.pageVegan | 0) > 0);
  }
  function computeBadge(c, opts) {
    c = c || {}; opts = opts || {};
    if (opts.allClear !== false && isAllClear(c)) return { ...ALL_CLEAR };
    const nv = c.nonvegan | 0, v = c.vegan | 0, ctx = c.context | 0;
    const fmt = n => (n > 999 ? '999+' : String(n));
    if (nv + ctx > 0) return { text: fmt(nv + ctx), color: '#B3261E' };
    if (v > 0) return { text: fmt(v), color: '#2E9D4A' };
    return { text: '', color: '#2E9D4A' };
  }
  // 0.4.57: call a tab-scoped chrome API (action.setBadgeText, setIcon, tabs.sendMessage, ...) on a tab that may be gone
  // (closed, or a prerender/discarded tab id). Always passes a callback that reads chrome.runtime.lastError (so Chrome never
  // logs 'Unchecked runtime.lastError: No tab with id'), and also swallows a promise rejection or a thrown error.
  // Resolves to the callback result, or null on any error. Never rejects.
  function safeTabCall(fn, ...args) {
    return new Promise(resolve => {
      let done = false; const fin = v => { if (!done) { done = true; resolve(v); } };
      try {
        const r = fn(...args, res => { const rt = typeof chrome !== 'undefined' && chrome.runtime; const err = rt && rt.lastError; fin(err ? null : (res === undefined ? true : res)); });
        if (r && typeof r.then === 'function') r.then(v => fin(v === undefined ? true : v), () => fin(null));
      } catch (e) { fin(null); }
    });
  }
  const api = { computeBadge, isAllClear, ALL_CLEAR, safeTabCall };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganBadge = api;
})(typeof self !== 'undefined' ? self : this);
