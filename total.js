// Pure cumulative-total logic (background.js via importScripts; tests via require).
// Per tab we keep a high-water mark of each source's non-vegan count (ads are already
// included in `nonvegan`) for the current page URL. Only increases above the mark are
// added to the all-time total, so re-renders, rechecks and repeated reports don't inflate it.
(function (root) {
  function pageOf(url) { try { const u = new URL(url); return u.origin + u.pathname + u.search; } catch (e) { return String(url || ''); } }
  // tab: {url, peaks:{src:n}} | undefined. Returns {tab, delta}.
  function applyReport(tab, url, src, counts, disabled) {
    const p = pageOf(url);
    if (!tab || tab.url !== p) tab = { url: p, peaks: {} };
    else tab = { url: p, peaks: { ...tab.peaks } };
    if (disabled) return { tab, delta: 0 };
    const n = Math.max(0, (counts && counts.nonvegan) | 0), prev = tab.peaks[src] | 0;
    if (n <= prev) return { tab, delta: 0 };
    tab.peaks[src] = n;
    return { tab, delta: n - prev };
  }
  function addToTotal(stats, delta, now) {
    stats = { count: 0, since: null, ...(stats || {}) };
    if (delta > 0) { stats.count += delta; if (!stats.since) stats.since = now; }
    return stats;
  }
  const resetTotal = () => ({ count: 0, since: null });
  const api = { pageOf, applyReport, addToTotal, resetTotal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganTotal = api;
})(typeof self !== 'undefined' ? self : this);
