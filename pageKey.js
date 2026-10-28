// Pure per-page disable logic, shared by background, popup, content scripts and tests.
(function (root) {
  function pageKey(url) {
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) return null; return u.origin + u.pathname; } catch (e) { return null; }
  }
  const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  function siteBlocked(siteBlock, url) {
    const h = hostOf(url);
    return !!h && (siteBlock || []).some(d => h === d || h.endsWith('.' + d));
  }
  function isPageDisabled(pageBlock, url) { const k = pageKey(url); return !!k && (pageBlock || []).includes(k); }
  // Disabled = this page is off, or the whole site is on the blocklist.
  function isDisabled(s, url) { s = s || {}; return isPageDisabled(s.pageBlock, url) || siteBlocked(s.siteBlock, url); }
  function togglePage(pageBlock, url) {
    const k = pageKey(url), list = (pageBlock || []).slice();
    if (!k) return list;
    const i = list.indexOf(k);
    if (i >= 0) list.splice(i, 1); else list.push(k);
    return list;
  }
  const iconPaths = disabled => { const o = {}; for (const s of [16, 32, 48, 128]) o[s] = 'icons/icon' + s + (disabled ? '-red' : '') + '.png'; return o; };
  // Content-script helper: tell the background the top-frame URL (for the per-tab icon).
  // Re-sent after a delay to win any race with tabs.onUpdated resetting the icon.
  function reportPage() {
    if (typeof chrome === 'undefined' || !chrome.runtime || (typeof window !== 'undefined' && window.top !== window)) return;
    const send = () => { try { chrome.runtime.sendMessage({ type: 'page', url: location.href }); } catch (e) {} };
    send(); setTimeout(send, 1500);
  }
  const api = { reportPage, pageKey, siteBlocked, isPageDisabled, isDisabled, togglePage, iconPaths };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganPage = api;
})(typeof self !== 'undefined' ? self : this);
