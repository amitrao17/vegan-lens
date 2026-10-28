// Search assist: suggest or auto-apply a vegan rewrite of the search query.
// Handles full page loads and SPA navigation (YouTube).
(() => {
  'use strict';
  if (window.top !== window) return;
  const R = window.VeganSearchRewrite, P = window.VeganPage;
  const h = location.hostname;
  const isYT = /(^|\.)youtube\.com$/.test(h);
  function engineParam() {
    const p = location.pathname;
    if (/(^|\.)google\.[a-z.]+$/.test(h) && p === '/search') return 'q';
    if (/(^|\.)bing\.com$/.test(h) && p === '/search') return 'q';
    if (/(^|\.)duckduckgo\.com$/.test(h)) return 'q';
    if (isYT && p === '/results') return 'search_query';
    if (/(^|\.)amazon\.com$/.test(h) && p === '/s') return 'k';
    return null;
  }
  let S = { searchAssist: 'suggest', siteBlock: [], pageBlock: [] };
  let current = null; // {q, content}
  let lastHref = null;

  const link = (href, text, onclick) => { const a = document.createElement('a'); a.href = href; a.textContent = text; if (onclick) a.addEventListener('click', onclick); return a; };
  function buildBanner(content) {
    const b = document.createElement('div'); b.className = 'vl-s-banner'; b.id = 'vl-s-banner';
    b.append('🌱 ', ...content);
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.title = 'Dismiss';
    x.addEventListener('click', () => { b.remove(); if (current) current.dismissed = true; }); b.append(x);
    return b;
  }
  function ytTarget() {
    // results column on youtube.com/results
    return document.querySelector('ytd-search ytd-section-list-renderer #contents') || document.querySelector('ytd-search #contents');
  }
  // Amazon: no banner on error ("dogs of Amazon") pages or searches with no result cards.
  const isAmazon = /(^|\.)amazon\.com$/.test(h);
  const amazonHasResults = () => R.amazonHasResults(document);
  function place() {
    if (!current || current.dismissed || !current.content) return;
    if (isAmazon && !amazonHasResults()) { document.getElementById('vl-s-banner')?.remove(); return; }
    if (document.getElementById('vl-s-banner')) return;
    const b = buildBanner(current.content());
    if (isYT) { const t = ytTarget(); if (!t) return; b.classList.add('vl-s-yt'); t.parentElement.insertBefore(b, t); }
    else if (document.body) document.body.prepend(b);
  }

  function evaluate() {
    if (location.href === lastHref) { place(); return; }
    lastHref = location.href;
    document.getElementById('vl-s-banner')?.remove();
    current = null;
    const param = engineParam();
    if (!param || S.searchAssist === 'off' || P.isDisabled(S, location.href)) return;
    const url = new URL(location.href);
    const q = url.searchParams.get(param);
    if (!q) return;
    const withQ = v => { const u = new URL(url); u.searchParams.set(param, v); ['start', 'first', 'page', 'sp'].forEach(k => u.searchParams.delete(k)); return u.toString(); };
    const key = q.toLowerCase();
    const orig = sessionStorage.getItem('vl-orig:' + key);
    if (orig) {
      current = { q, content: () => ['Vegan Lens searched "' + q + '" for you. ', link(withQ(orig), 'Search original "' + orig + '" →', () => sessionStorage.setItem('vl-skip:' + orig.toLowerCase(), '1'))] };
      place(); return;
    }
    const rw = R.rewriteQuery(q);
    if (!rw || sessionStorage.getItem('vl-skip:' + key)) return;
    if (S.searchAssist === 'auto' && !sessionStorage.getItem('vl-rewrote:' + key)) {
      sessionStorage.setItem('vl-rewrote:' + key, '1'); // loop guard
      sessionStorage.setItem('vl-orig:' + rw.toLowerCase(), q);
      location.replace(withQ(rw));
      return;
    }
    current = { q, content: () => ['Try: ', link(withQ(rw), rw + ' →')] };
    place();
  }

  chrome.storage.sync.get(S, s => {
    S = s;
    evaluate();
    // SPA navigation + YouTube re-renders: listen and poll lightly.
    document.addEventListener('yt-navigate-finish', () => setTimeout(evaluate, 50));
    window.addEventListener('popstate', () => setTimeout(evaluate, 50));
    setInterval(evaluate, isYT ? 700 : 1500);
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const k in ch) if (k in S) S[k] = ch[k].newValue;
    lastHref = null; evaluate();
  });
})();
