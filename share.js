// Vegan Lens share (0.4.42). Composes a short message about one found item, entirely on-device, and builds share-intent
// URLs. Nothing is sent anywhere until the user presses a destination. Browser global (VeganShare) + Node module.
(function (root) {
  'use strict';
  const STORE_URL = ''; // Chrome Web Store link once published; omitted from messages while blank.
  const HASHTAG = '#VeganLens';
  const MAX_ITEMS = 20, MAX_TITLE = 100;
  // One place to change behaviour per destination. public: appends the hashtag (aggregation on public posts only).
  const DESTS = {
    copy:     { label: 'Copy for DMs (Instagram, Messenger, iMessage)', public: false },
    email:    { label: 'Email', public: false },
    x:        { label: 'X', public: true },
    facebook: { label: 'Facebook (text copied)', public: true },
    reddit:   { label: 'Reddit', public: true },
    whatsapp: { label: 'WhatsApp', public: false },
    telegram: { label: 'Telegram', public: true },
    linkedin: { label: 'LinkedIn', public: true },
    native:   { label: 'More…', public: false },
  };
  const ORDER = ['copy', 'email', 'x', 'facebook', 'reddit', 'whatsapp', 'telegram', 'linkedin', 'native'];
  function trimTitle(s, n) {
    n = n || MAX_TITLE; const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (t.length <= n) return t;
    const cut = t.slice(0, n - 1), sp = cut.lastIndexOf(' ');
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:–—-]+$/, '') + '…';
  }
  const isHttp = u => /^https?:\/\//i.test(String(u || ''));
  function normItem(it) {
    it = it || {};
    return { title: trimTitle(it.title) || 'this item', verdict: trimTitle(it.verdict, 60) || 'flagged by Vegan Lens', url: isHttp(it.url) ? it.url : '', swap: isHttp(it.swap) ? it.swap : '' };
  }
  // 'Heads up: <title> — <verdict>. Vegan swap: <swap>. <url>. Found with Vegan Lens <store>'
  function buildMessage(item, opts) {
    const it = normItem(item), store = opts && 'storeUrl' in opts ? opts.storeUrl : STORE_URL;
    const parts = ['Heads up: ' + it.title + ' \u2014 ' + it.verdict + '.'];
    const A = opts && opts.audience && root.VeganSwaps ? root.VeganSwaps : (opts && opts.audience && typeof require === 'function' ? require('./swaps.js') : null);
    if (it.swap) parts.push((A ? A.say(opts.audience, 'shareSwap') : 'Vegan swap: ') + it.swap + '.');
    if (it.url) parts.push(it.url + '.');
    parts.push((A ? A.say(opts.audience, 'shareTag') : 'Found with Vegan Lens') + (store ? ' ' + store : ''));
    return parts.join(' ');
  }
  const withTag = (text, dest) => (DESTS[dest] && DESTS[dest].public && !/#VeganLens\b/i.test(text)) ? String(text).trimEnd() + ' ' + HASHTAG : String(text);
  const enc = encodeURIComponent;
  // Returns { url?, copy?, mailto?, native?, text } for a destination. text is the user's (possibly edited) message.
  function destination(dest, item, text) {
    const it = normItem(item), t = withTag(text, dest), u = it.url;
    switch (dest) {
      case 'copy': return { copy: t, text: t };
      case 'email': return { mailto: 'mailto:?subject=' + enc('Vegan Lens find: ' + it.title) + '&body=' + enc(t), text: t };
      case 'x': return { url: 'https://x.com/intent/post?text=' + enc(t), text: t };
      case 'facebook': return { url: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(u), copy: t, text: t, note: 'Facebook ignores pre-filled text, so the message was copied: paste it into your post.' };
      case 'reddit': return { url: 'https://www.reddit.com/submit?url=' + enc(u) + '&title=' + enc(withTag('Vegan Lens find: ' + it.title + ' \u2014 ' + it.verdict, dest)), text: t };
      case 'whatsapp': return { url: 'https://wa.me/?text=' + enc(t), text: t };
      case 'telegram': return { url: 'https://t.me/share/url?url=' + enc(u) + '&text=' + enc(u ? t.replace(u + '.', '').replace(u, '').replace(/\s{2,}/g, ' ').trim() : t), text: t };
      case 'linkedin': return { url: 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(u), copy: t, text: t, note: 'LinkedIn only takes the link, so the message was copied too.' };
      case 'native': return { native: { title: 'Vegan Lens find: ' + it.title, text: t, url: u || undefined }, text: t };
      default: return null;
    }
  }
  // ---- Collect found items from the page (content scripts). Reads the per-element state the classifiers already set.
  const UNIT = '[data-vl-w=nonvegan], [data-vl-w=vegan], [data-vl-verdict=non-vegan], [data-vl-verdict=vegan], [data-vl-why]';
  function unitTitle(el) {
    const h = el.querySelector && el.querySelector('h1, h2, h3, h4, [role=heading], #video-title, a[href] span, a[href]');
    const t = (h && (h.innerText || h.textContent)) || el.getAttribute && el.getAttribute('aria-label') || el.innerText || el.textContent || '';
    return trimTitle(String(t).replace(/Vegan Lens\s*·?/g, ''));
  }
  function unitVerdict(el) {
    const d = el.dataset || {};
    if (d.vlWhy) return d.vlWhy;
    const v = d.vlW || d.vlVerdict;
    return v === 'vegan' ? 'Vegan' : v ? 'not vegan' : 'flagged';
  }
  function unitUrl(el, pageUrl) {
    const a = (el.matches && el.matches('a[href]')) ? el : el.querySelector && el.querySelector('a[href]:not(.vl-w-swap):not([class*=vl-])');
    const h = a && (a.href || a.getAttribute('href'));
    try { return h ? new URL(h, pageUrl).href : pageUrl; } catch (e) { return pageUrl; }
  }
  function collectItems(doc, pageUrl) {
    const out = [], seen = new Set();
    for (const el of doc.querySelectorAll(UNIT)) {
      if (out.length >= MAX_ITEMS) break;
      if (el.parentElement && el.parentElement.closest && el.parentElement.closest(UNIT)) continue; // outermost unit only
      const it = { title: unitTitle(el), verdict: unitVerdict(el), url: unitUrl(el, pageUrl), swap: (el.dataset && el.dataset.vlSwap) || '' };
      if (!it.title || seen.has(it.title + '|' + it.url)) continue; seen.add(it.title + '|' + it.url); out.push(normItem(it));
    }
    return out;
  }
  const api = { STORE_URL, HASHTAG, DESTS, ORDER, MAX_ITEMS, trimTitle, normItem, buildMessage, withTag, destination, collectItems, UNIT };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.VeganShare = api;
  if (typeof document === 'undefined' || !root.chrome || !chrome.runtime || !chrome.runtime.id || location.protocol === 'chrome-extension:') return;
  if (root.__vlShareInit) return; root.__vlShareInit = true; // 0.4.48: loaded by two content-script groups on facebook.com; wire listeners once

  // ---- Content-script side: answer the popup, add a share button to Vegan Lens pills, context-menu target, in-page menu.
  const Brand = root.VeganLensBrand;
  const itemFor = el => { const u = el && el.closest && el.closest(UNIT); return u ? normItem({ title: unitTitle(u), verdict: unitVerdict(u), url: unitUrl(u, location.href), swap: (u.dataset && u.dataset.vlSwap) || '' }) : null; };
  let ctxTarget = null;
  document.addEventListener('contextmenu', e => { ctxTarget = e.target; }, true);
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (!msg) return;
    if (msg.type === 'shareItems') { if (window.top === window) send({ items: collectItems(document, location.href) }); return; }
    if (msg.type === 'shareContext') { const it = itemFor(ctxTarget); if (it) openShare(it, ctxTarget); return; }
  });
  function openShare(item, anchor) {
    try { chrome.runtime.sendMessage({ type: 'shareOpen', item }, r => { if (chrome.runtime.lastError || !r || !r.ok) menu(item, anchor); }); } catch (e) { menu(item, anchor); }
  }
  let open = null;
  function close() { if (open) { open.remove(); open = null; } }
  // In-page menu: fixed-position overlay (never in the page flow, so nothing reorders), keyboard and screen-reader friendly.
  function menu(item, anchor) {
    close();
    const m = document.createElement('div'); m.className = 'vl-share-menu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Share with Vegan Lens');
    const head = document.createElement('div'); head.className = 'vl-share-head'; head.textContent = 'Share'; if (Brand) Brand.mark(head);
    const ta = document.createElement('textarea'); ta.className = 'vl-share-text'; ta.value = buildMessage(item); ta.rows = 4; ta.setAttribute('aria-label', 'Message (editable)');
    const note = document.createElement('div'); note.className = 'vl-share-note'; note.setAttribute('role', 'status');
    const list = document.createElement('div'); list.className = 'vl-share-dests';
    for (const d of ORDER) {
      if (d === 'native' && !navigator.share) continue;
      const b = document.createElement('button'); b.type = 'button'; b.textContent = DESTS[d].label;
      b.addEventListener('click', async e => { e.preventDefault(); e.stopPropagation(); note.textContent = await go(d, item, ta.value); }, true);
      list.append(b);
    }
    const x = document.createElement('button'); x.type = 'button'; x.className = 'vl-share-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Close share menu');
    x.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); close(); }, true);
    head.append(x); m.append(head, ta, list, note);
    m.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); anchor && anchor.focus && anchor.focus(); } e.stopPropagation(); });
    m.addEventListener('click', e => e.stopPropagation());
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 20, bottom: 20 };
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - 300)) + 'px'; m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - 320)) + 'px';
    document.documentElement.append(m); open = m; ta.focus();
  }
  async function go(d, item, text) {
    const r = destination(d, item, text); if (!r) return '';
    try { chrome.runtime.sendMessage({ type: 'stat', k: 'share', dest: d }); } catch (e) {}
    let msg = '';
    if (r.copy) { try { await navigator.clipboard.writeText(r.copy); msg = r.note || 'Copied. Paste it into your message.'; } catch (e) { msg = 'Could not copy: select the text and copy it.'; } }
    if (r.native) { try { await navigator.share(r.native); } catch (e) {} }
    if (r.mailto) location.href = r.mailto;
    if (r.url) window.open(r.url, '_blank', 'noopener');
    return msg;
  }
  // Share button on each Vegan Lens pill/chip (appended inside the pill, so page layout is untouched).
  const PILL = '.vl-w-chip, .vl-label, .vl-badge, .vl-mp-pill';
  function decorate(rootEl) {
    for (const p of (rootEl.querySelectorAll ? rootEl.querySelectorAll(PILL) : [])) {
      if (p.querySelector('.vl-share-btn')) continue;
      const unit = p.closest(UNIT) || (p.nextElementSibling && p.nextElementSibling.matches(UNIT) ? p.nextElementSibling : null);
      if (!unit) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'vl-share-btn'; b.textContent = '\u2934\ufe0e'; b.setAttribute('aria-label', 'Share this find with Vegan Lens'); b.title = 'Share — Added by Vegan Lens extension';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const u = p.closest(UNIT) || unit; openShare(itemFor(u), b); }, true);
      p.append(b);
    }
  }
  const st = document.createElement('style');
  st.textContent = '.vl-share-btn{all:unset;cursor:pointer;margin-left:4px;padding:0 4px;border-radius:8px;font:600 12px/1.2 Arial,sans-serif;color:inherit}.vl-share-btn:hover,.vl-share-btn:focus-visible{background:rgba(0,0,0,.08);outline:2px solid #2e9d4a}'
    + '.vl-badge-compact>.vl-share-btn{display:none!important}.vl-badge-compact:hover>.vl-share-btn,.vl-badge-compact:focus>.vl-share-btn,.vl-badge-compact:focus-within>.vl-share-btn,.vl-badge-compact.vl-badge-open>.vl-share-btn{display:inline-flex!important;align-items:center}'
    + '.vl-share-menu{position:fixed;z-index:2147483646;width:280px;background:#fff;color:#202124;border:1px solid #dadce0;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.2);padding:8px;font:12px/1.4 Arial,sans-serif;text-align:left}'
    + '.vl-share-head{display:flex;align-items:center;gap:4px;font-weight:600;color:#1e6b33;margin-bottom:6px}.vl-share-x{all:unset;margin-left:auto;cursor:pointer;font-size:16px;padding:0 4px}'
    + '.vl-share-text{width:100%;box-sizing:border-box;font:12px Arial,sans-serif;border:1px solid #ccc;border-radius:6px;padding:4px}'
    + '.vl-share-dests{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.vl-share-dests button{all:unset;cursor:pointer;background:#f1f3f4;border:1px solid #dadce0;border-radius:10px;padding:2px 8px}.vl-share-dests button:focus-visible,.vl-share-x:focus-visible{outline:2px solid #2e9d4a}.vl-share-note{color:#5f6368;margin-top:4px;min-height:1em}';
  (document.head || document.documentElement).append(st);
  let t = null; const run = () => { t = null; decorate(document); };
  new MutationObserver(() => { if (!t) t = setTimeout(run, 400); }).observe(document.documentElement, { childList: true, subtree: true });
  run();
  document.addEventListener('click', e => { if (open && !open.contains(e.target)) close(); });
})(typeof self !== 'undefined' ? self : this);
