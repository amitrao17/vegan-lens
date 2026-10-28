// Pure badge logic, shared by background.js (importScripts) and tests (require).
(function (root) {
  function computeBadge(c) {
    c = c || {};
    const nv = c.nonvegan | 0, v = c.vegan | 0, ctx = c.context | 0;
    const fmt = n => (n > 999 ? '999+' : String(n));
    if (nv + ctx > 0) return { text: fmt(nv + ctx), color: '#B3261E' };
    if (v > 0) return { text: fmt(v), color: '#2E9D4A' };
    return { text: '', color: '#2E9D4A' };
  }
  const api = { computeBadge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganBadge = api;
})(typeof self !== 'undefined' ? self : this);
