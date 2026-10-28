// Vegan Lens general-web "Content" mode. Purely visual: adds classes/chips, never removes or rewires page elements.
(() => {
  'use strict';
  if (window.top !== window && !/youtube\.com$/.test(location.hostname)) return; // skip iframes (ads, widgets)
  const A = window.VeganAdUnits, U = window.VeganWebUnits, C = window.VeganContentClassifier, T = window.VeganContextTopics, P = window.VeganPage, VP = window.VeganPeople;
  let PEOPLE = null, peopleIdx = null, peopleKey = '', peopleState = { counts: new Map() };
  let CARDS = null;
  const counts = { vegan: 0, nonvegan: 0, unknown: 0, context: 0, ads: 0 };
  const DEFAULTS = { checkAds: true, webEnabled: true, webMode: 'dim', sensitivity: 'med', siteBlock: [], siteAllow: [], webAllowOnly: false, contextCards: true, markPeople: true, markMeat: true, pageBlock: [], whitelist: [], whitelistDisabled: [], debug: false };
  let S = { ...DEFAULTS };
  const host = location.hostname.replace(/^www\./, '');
  const YT = U.isYouTubeHost(location.hostname);
  const seen = new WeakSet();
  const UNIT_SEL = [
    'article', '[role=article]',
    '#search .g, #rso > div > div[data-hveid], div.MjjYud', // Google
    '#b_results > li.b_algo, #b_results > li.b_ans',          // Bing
    'shreddit-post, div[data-testid=post-container], .thing.link', // Reddit
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model', // YouTube
    '[class*=card i]:has(a h1, a h2, a h3, h2 a, h3 a, h4 a)',
    'li:has(> a h2, > a h3, h2 > a, h3 > a)',
    '[class*=story i]:has(h2 a, h3 a, a h2, a h3)', '[class*=feed-item i], [class*=teaser i]:has(a)',
  ].join(',');

  function dbg(path, el, info) {
    if (!S.debug) return;
    try { console.log('[Vegan Lens]', path, (el && el.tagName || '').toLowerCase(), JSON.stringify((info && info.headline) || ''), info && info.verdict, info || {}, el); } catch (e) {}
  }
  const siteMatch = (list) => list.some(d => host === d || host.endsWith('.' + d));
  const active = () => S.webEnabled && !siteMatch(S.siteBlock) && !P.isPageDisabled(S.pageBlock, location.href) && (!S.webAllowOnly || siteMatch(S.siteAllow));

  // Google rich results (recipes, top stories, videos, shopping): generic structure, not class names.
  const RICH_ROOT = 'g-scrolling-carousel, [data-attrid], [role=list], g-section-with-header, block-component';
  function richCards(root) {
    const out = new Set();
    const roots = [...(root.querySelectorAll ? root.querySelectorAll(RICH_ROOT) : [])];
    // blocks introduced by an h2 / role=heading such as "Recipes", "Top stories", "Videos"
    (root.querySelectorAll ? root.querySelectorAll('h2, [role=heading][aria-level="2"]') : []).forEach(hd => { const sec = hd.parentElement && hd.parentElement.parentElement; if (sec && sec.querySelectorAll('a[href]').length <= 40) roots.push(sec); });
    for (const r of roots) {
      r.querySelectorAll('a[href]').forEach(a => {
        const img = a.querySelector('img, g-img, [role=img]') || (a.parentElement && a.parentElement.querySelector('img, g-img'));
        if (!img) return;
        if (img.tagName === 'IMG' && Math.max(img.width || 0, img.naturalWidth || 0, +img.getAttribute('width') || 0) < 48 && img.complete) return; // favicons
        const txt = (a.innerText || a.getAttribute('aria-label') || '').trim();
        if (txt.length < 8) return;
        out.add(a.closest('g-inner-card, [role=listitem], li') || a);
      });
    }
    return [...out].filter(c => c.isConnected && c !== document.body);
  }
  const isContainer = el => el.dataset.vlW === 'container';
  function skippable(el) {
    return el.isContentEditable || el.closest('input, textarea, select, [contenteditable=""], [contenteditable=true], form, nav, header, footer, [aria-modal=true]') ||
      !!el.closest('[data-vl-ad]') || !!(el.querySelector && el.querySelector('[data-vl-ad]')) ||
      (() => { const u = el.parentElement && el.parentElement.closest('.vl-w-unit'); return !!u && !isContainer(u); })();
  }
  function extract(el) {
    const h = el.querySelector('h1, h2, h3, h4, [role=heading], #video-title, [id=video-title-link], a[slot=title], [data-testid=post-title], a.title') || el.querySelector('a');
    const headline = (h && (h.innerText || h.textContent) || el.getAttribute('aria-label') || '').trim().slice(0, 300);
    const snippet = [...el.querySelectorAll('p, .VwiC3b, [data-sncf], #description-text, .b_caption')].slice(0, 2).map(p => p.innerText || '').join(' ').slice(0, 500);
    const alt = [...el.querySelectorAll('img[alt]')].slice(0, 2).map(i => i.alt).join(' ').slice(0, 200);
    return { headline, snippet, alt };
  }

  function chip(text, onShow) {
    const c = document.createElement('span');
    c.className = 'vl-w-chip';
    c.append(document.createTextNode(text + ' · '));
    if (onShow) { const a = document.createElement('button'); a.type = 'button'; a.className = 'vl-w-show'; a.textContent = 'show';
      a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onShow(); }, true); c.append(a); }
    return c;
  }

  function contextCard(topics) {
    const card = document.createElement('aside');
    card.className = 'vl-w-ctx'; card.setAttribute('role', 'note');
    const head = document.createElement('div'); head.className = 'vl-w-ctx-head';
    const lab = document.createElement('span'); lab.textContent = '🌿 Context';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'vl-w-ctx-x'; x.textContent = '×'; x.title = 'Dismiss';
    x.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); card.remove(); }, true);
    head.append(lab, x); card.append(head);
    const link = (o, cls) => { const a = document.createElement('a'); a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = o.label; if (cls) a.className = cls; return a; };
    const shown = topics.filter(t => CARDS.topics[t]).slice(0, 2);
    for (const t of shown) {
      const d = CARDS.topics[t];
      const sec = document.createElement('div'); sec.className = 'vl-w-ctx-sec';
      const h = document.createElement('b'); h.textContent = d.title; sec.append(h);
      const f = d.facts[0];
      const p = document.createElement('p');
      if (f) { p.append(document.createTextNode(f.text + ' ')); p.append(link({ url: f.source, label: 'Source' })); }
      else p.append(link(d.learn));
      sec.append(p);
      const act = document.createElement('p'); act.className = 'vl-w-ctx-act';
      act.append(document.createTextNode('Positive action: '), link(d.action)); sec.append(act);
      card.append(sec);
    }
    // stop clicks inside the card from triggering the host card's link handlers
    card.addEventListener('click', e => e.stopPropagation());
    return shown.length ? card : null;
  }

  function apply(el, r, ctx) {
    el.classList.add('vl-w-unit');
    if (ctx && ctx.isContext) {
      el.dataset.vlW = 'context'; count('context');
      if (S.contextCards && CARDS) { const card = contextCard(ctx.topics); if (card) { el.insertAdjacentElement('afterend', card); el._vlChip = card; } }
      return;
    }
    el.dataset.vlW = r.verdict; count(r.verdict);
    if (r.verdict === 'vegan') { el.classList.add('vl-w-vegan'); el.title = el.title || 'Vegan Lens: vegan-friendly'; return; }
    if (r.verdict !== 'nonvegan') return;
    // YouTube: dim/hide the card's contents but keep the chip inside the card (a sibling chip lands in the grid's flex/grid
    // flow, is clipped or re-rendered away by YouTube, and the filter on the card would blur the chip too).
    const inCard = YT;
    const dimCls = inCard ? 'vl-w-dim-in' : 'vl-w-dim', hideCls = inCard ? 'vl-w-hide-in' : 'vl-w-hide';
    const label = 'Hidden: about ' + (r.topic || 'animal products');
    const mode = S.webMode;
    let c;
    const reveal = () => { el.classList.remove(...U.DIM_CLASSES); el.classList.add('vl-w-revealed'); c && c.remove(); };
    c = mode === 'label' ? chip('Non-vegan: ' + (r.topic || 'animal products')) : chip(label, reveal);
    c.classList.add('vl-w-chip-' + mode);
    c.title = 'Vegan Lens: ' + (r.reasons || []).join(', ') + '\n' + U.matchText(r);
    showDim(el, c, inCard, mode === 'label' ? null : (mode === 'hide' ? hideCls : dimCls), 'content', r);
  }
  // The only place a tint/hide class is added. Invariants: chip attached to this element first; no multi-card element;
  // headline + video ids still equal the ones the verdict was computed from.
  function showDim(el, c, inside, cls, path, r) {
    if (inside) { c.classList.add('vl-w-chip-in'); el.prepend(c); } else el.insertAdjacentElement('beforebegin', c);
    el._vlChip = c;
    const st = { chip: c, keyThen: el._vlKey, keyNow: currentKey(el) };
    const chk = cls ? U.dimCheck(el, st) : (U.multiCard(el) ? { ok: false, why: 'contains 2+ video cards' } : { ok: true });
    const info = { headline: (extract(el).headline || '').slice(0, 120), verdict: r.verdict, reasons: r.reasons, matches: r.matches, cls };
    if (!chk.ok) { c.remove(); el._vlChip = null; el.classList.remove(...U.DIM_CLASSES); dbg(path + ':refused', el, { ...info, why: chk.why }); return false; }
    if (cls) { el.classList.add(cls); if (io) io.observe(el); }
    dbg(path, el, info);
    return true;
  }
  const currentKey = el => { if (el.dataset.vlAd) { const p = A.adParts(el); return (p.headline + p.snippet + p.alt).length < 6 ? null : adKey(el, p); }
    const p = extract(el); if (el.dataset.vlRich && p.headline.length < 8) p.headline = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 300); return p.headline.length < 8 ? null : unitKey(el, p); };
  const adKey = (el, p) => p.headline + '|' + [...U.videoIds(el)].join(',');

  function processUnit(el) {
    if (seen.has(el)) return; seen.add(el);
    if (skippable(el)) return;
    const role = U.unitRole(el, { youtube: YT, unitSel: UNIT_SEL });
    if (role === 'skip') return;
    if (role === 'container') { el.classList.add('vl-w-unit'); el.dataset.vlW = 'container'; dbg('container', el, { verdict: 'container' }); return; }
    // A result block that wraps a carousel: classify its cards individually, not the block.
    if (!el.dataset.vlRich && richCards(el).length >= 2) { el.classList.add('vl-w-unit'); el.dataset.vlW = 'container'; return; }
    const parts = extract(el);
    if (el.dataset.vlRich && parts.headline.length < 8) parts.headline = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 300);
    if (parts.headline.length < 8) { seen.delete(el); return; } // not rendered yet: retry on next mutation
    el._vlKey = unitKey(el, parts);
    const r = C.classify(parts, { ...S, requireHeadline: YT });
    if (r.verdict !== 'nonvegan') dbg('content', el, { headline: parts.headline, verdict: r.verdict, reasons: r.reasons, matches: r.matches });
    apply(el, r, T.detectTopics(parts));
  }

  // ---------- ads ----------
  const AD = A.selectors(location.hostname);
  function applyAd(el, r) {
    el.classList.add('vl-w-unit', 'vl-w-ad'); el.dataset.vlW = r.verdict; el.dataset.vlAd = r.verdict;
    if (r.verdict === 'neutral') return;
    count(r.verdict); if (r.verdict === 'nonvegan') count('ads');
    if (r.verdict === 'vegan') { el.classList.add('vl-w-vegan'); el.title = el.title || 'Vegan Lens: vegan-friendly ad'; return; }
    const mode = S.webMode; let c;
    const reveal = () => { el.classList.remove(...U.DIM_CLASSES); el.classList.add('vl-w-revealed'); c && c.remove(); };
    c = mode === 'label' ? chip(A.chipText('nonvegan', r.topic)) : chip(A.chipText('nonvegan', r.topic), reveal);
    c.classList.add('vl-w-chip-' + mode);
    c.title = 'Vegan Lens (ad): ' + (r.reasons || []).join(', ') + '\n' + U.matchText(r, 'ad detected by ' + (el._vlAdVia || '?'));
    showDim(el, c, true, mode === 'label' ? null : (mode === 'hide' ? 'vl-w-hide-in' : 'vl-w-dim-in'), 'ad', r);
  }
  function adVia(el, label) {
    if (label) return 'ad label "' + String(label.textContent || '').trim() + '"';
    const sel = AD.all.split(',').map(x => x.trim()).find(x => { try { return el.matches(x); } catch (e) { return false; } });
    return 'selector ' + (sel || '(ancestor)');
  }
  function processAd(el, label) {
    if (!el || seen.has(el) || el.dataset.vlAd) return;
    if (el.parentElement && el.parentElement.closest('[data-vl-ad]:not([data-vl-ad=container])')) return;
    seen.add(el);
    if (U.multiCard(el)) { dbg('ad:refused', el, { verdict: 'skip', why: 'contains 2+ video cards' }); return; } // never an ad unit, and don't mark it (would make its cards skippable)
    if (A.adRole(el, location.hostname) === 'container') { el.dataset.vlAd = 'container'; dbg('ad:container', el, { verdict: 'container' }); return; }
    el._vlAdVia = adVia(el, label);
    // an earlier generic verdict on the ad (or on a card wrapping it) yields to the ad verdict
    el.querySelectorAll('.vl-w-unit').forEach(resetUnit);
    const outer = el.parentElement && el.parentElement.closest('.vl-w-unit:not(.vl-w-ad)');
    if (outer && !isContainer(outer)) { resetUnit(outer); seen.add(outer); outer.classList.add('vl-w-unit'); outer.dataset.vlW = 'container'; }
    const parts = A.adParts(el);
    if ((parts.headline + parts.snippet + parts.alt).length < 6) { seen.delete(el); return; } // not rendered yet
    el._vlKey = adKey(el, parts);
    applyAd(el, A.classifyAd(parts, S, C.classify, C.LABEL_W));
  }
  function scanAds(root) {
    if (!S.checkAds || root.nodeType !== 1 && root !== document) return;
    const q = (sel) => { try { return [...(root.nodeType === 1 && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)]; } catch (e) { return []; } };
    if (AD.all) q(AD.all).forEach(e => processAd(e));
    let n = 0;
    for (const l of q('span, small, div, p, h2, h3, label, b')) {
      if (++n > 4000) break;
      if (l.childElementCount > 1 || !A.isAdLabelText(l.textContent)) continue;
      const ad = A.adRootFromLabel(l, location.hostname); if (ad) processAd(ad, l);
    }
  }

  // YouTube recycles card elements for different videos: a stale verdict (dim class) must not survive the swap.
  const unitKey = (el, parts) => parts.headline + '|' + [...U.videoIds(el)].join(',');
  function resetUnit(el) {
    el.classList.remove('vl-w-unit', 'vl-w-vegan', 'vl-w-revealed', ...U.DIM_CLASSES); el._vlKey = null;
    delete el.dataset.vlW; delete el.dataset.vlAd; el.classList.remove('vl-w-ad'); if (el._vlChip) { el._vlChip.remove(); el._vlChip = null; } seen.delete(el);
  }
  // Re-validate a decorated element. Any dimmed element whose chip is gone, that now holds 2+ cards, or whose
  // headline/video id no longer matches the verdict is un-dimmed immediately (and re-classified once readable).
  const isDimmed = el => U.DIM_CLASSES.some(k => el.classList.contains(k));
  function audit(u) {
    if (!u.isConnected) return;
    if (isDimmed(u)) {
      const chk = U.dimCheck(u, { chip: u._vlChip, keyThen: u._vlKey, keyNow: currentKey(u) });
      if (!chk.ok) { dbg('guard:undim', u, { headline: extract(u).headline, verdict: u.dataset.vlW, why: chk.why }); const ad = u.dataset.vlAd && u.dataset.vlAd !== 'container'; resetUnit(u); ad ? processAd(u) : processUnit(u); }
      return;
    }
    if (u._vlKey == null || isContainer(u) || u.dataset.vlAd === 'container') return;
    const k = currentKey(u);
    if (k != null && k !== u._vlKey) { const ad = !!u.dataset.vlAd; resetUnit(u); ad ? processAd(u) : processUnit(u); }
  }
  function recheck(n) {
    if (n.nodeType !== 1) n = n.parentElement; if (!n || !n.closest) return;
    if (YT) { const card = n.closest(U.YT_CARD); if (card && !seen.has(card)) { processUnit(card); } }
    for (let u = n.closest('.vl-w-unit, [data-vl-ad]'); u; u = u.parentElement && u.parentElement.closest('.vl-w-unit, [data-vl-ad]')) audit(u);
    if (n.querySelectorAll) n.querySelectorAll('.vl-w-dim, .vl-w-dim-in, .vl-w-hide, .vl-w-hide-in').forEach(audit);
  }
  const auditAll = () => document.querySelectorAll('.vl-w-dim, .vl-w-dim-in, .vl-w-hide, .vl-w-hide-in').forEach(audit);
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) audit(e.target); })) : null;

  let sendT, lastUrl = location.href;
  function count(v) { if (v === 'neutral') return; counts[v] = (counts[v] || 0) + 1; clearTimeout(sendT); sendT = setTimeout(send, 300); }
  function send() { try { chrome.runtime.sendMessage({ type: 'counts', source: 'web', counts: { ...counts } }); } catch (e) {} }
  function zero() { for (const k in counts) counts[k] = 0; }
  let pageDone = false;
  function processPage() {
    if (pageDone) return; pageDone = true;
    const isArticle = document.querySelector('meta[property="og:type"][content="article"]') || document.querySelectorAll('article').length === 1;
    const h1 = document.querySelector('article h1, main h1, h1');
    if (!isArticle || !h1) return;
    const paras = [...(h1.closest('article, main') || document.body).querySelectorAll('p')].slice(0, 4).map(p => p.innerText).join(' ').slice(0, 1200);
    const pp = { headline: h1.innerText, snippet: paras };
    const ctx = T.detectTopics(pp);
    if (ctx.isContext) { count('context'); if (S.contextCards && CARDS) { const card = contextCard(ctx.topics); if (card) { card.id = 'vl-w-banner'; card.classList.add('vl-w-ctx-page'); h1.insertAdjacentElement('afterend', card); } } return; }
    const r = C.classify(pp, S);
    if (r.verdict === 'neutral') return;
    count(r.verdict);
    const b = document.createElement('div');
    b.className = 'vl-w-banner vl-w-banner-' + r.verdict; b.id = 'vl-w-banner';
    b.textContent = r.verdict === 'vegan' ? '🌱 Vegan Lens: this page looks vegan-friendly' : '✕ Vegan Lens: this page is about ' + (r.topic || 'animal products');
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.addEventListener('click', () => b.remove());
    b.append(x); document.body.prepend(b);
  }

  // Public-figure pills (people.json). Text-only insertion after the name; never reorders layout.
  function markPeople(root) {
    if (!VP || !PEOPLE || !(S.markPeople || S.markMeat)) return;
    const statuses = [...(S.markPeople ? ['vegan', 'former'] : []), ...(S.markMeat ? ['meat'] : [])], k = statuses.join(',');
    if (k !== peopleKey) { peopleKey = k; peopleIdx = VP.buildIndex(PEOPLE, { statuses }); }
    try { VP.markRoot(root === document ? document.body : root, document, peopleIdx, peopleState); } catch (e) { dbg('people:error', null, { error: String(e) }); }
  }
  function scan(root) {
    if (!active()) return;
    markPeople(root);
    const start = performance.now();
    scanAds(root);
    const units = [];
    if (/(^|\.)google\./.test(location.hostname)) for (const c of richCards(root.nodeType === 1 ? root : document)) { c.dataset.vlRich = '1'; units.push(c); }
    if (root.nodeType === 1 && root.matches(UNIT_SEL)) units.push(root);
    try { units.push(...(root.querySelectorAll ? root.querySelectorAll(UNIT_SEL) : [])); } catch (e) { return; }
    for (const u of units) { processUnit(u); if (performance.now() - start > 40) { requestIdle(() => scan(root)); return; } } // yield on huge pages
    processPage();
  }
  const requestIdle = window.requestIdleCallback || (f => setTimeout(f, 50));

  function undo() {
    document.querySelectorAll('.vl-w-unit, .vl-w-dim, .vl-w-dim-in, .vl-w-hide, .vl-w-hide-in').forEach(el => { if (io) io.unobserve(el); el.classList.remove('vl-w-unit', 'vl-w-vegan', 'vl-w-revealed', 'vl-w-ad', ...U.DIM_CLASSES); delete el.dataset.vlW; delete el.dataset.vlAd; el._vlKey = null; seen.delete(el); });
    document.querySelectorAll('[data-vl-ad]').forEach(el => { delete el.dataset.vlAd; seen.delete(el); });
    document.querySelectorAll('.vl-w-chip, .vl-w-ctx, #vl-w-banner').forEach(n => n.remove());
    if (VP) VP.unmarkAll(document); peopleState = { counts: new Map() };
    pageDone = false; zero(); send();
  }

  let pending = new Set(), touched = new Set(), timer = null;
  const mo = new MutationObserver(muts => {
    for (const m of muts)  { const tg = m.target && (m.target.nodeType === 1 ? m.target : m.target.parentElement); if (tg && !tg.closest('.vl-w-chip')) touched.add(tg); if (m.type === 'characterData' && m.target.nodeType === 3) pending.add(m.target); for (const n of m.removedNodes || []) if (n.nodeType === 1 && n.classList && n.classList.contains('vl-w-chip') && tg) touched.add(tg); for (const n of m.addedNodes) if (n.nodeType === 1 ? !n.classList.contains('vl-w-chip') && !n.classList.contains('vl-w-ctx') && !n.classList.contains('vl-p-pill') : n.nodeType === 3 && !(n.previousSibling && n.previousSibling.classList && n.previousSibling.classList.contains('vl-p-pill'))) pending.add(n); }
    if (!timer) timer = setTimeout(() => { timer = null;
      if (location.href !== lastUrl) { lastUrl = location.href; try { chrome.runtime.sendMessage({ type: 'reset' }); } catch (e) {} P.reportPage(); undo(); scan(document); return; } const p = pending, t = touched; pending = new Set(); touched = new Set(); requestIdle(() => { t.forEach(n => n.isConnected && recheck(n)); p.forEach(n => n.isConnected && scan(n)); }); }, 400);
  });

  chrome.storage.sync.get(DEFAULTS, async s => {
    S = s; P.reportPage();
    try { CARDS = await chrome.runtime.sendMessage({ type: 'cards' }); } catch (e) {}
    try { const pj = await chrome.runtime.sendMessage({ type: 'people' }); PEOPLE = pj && pj.people; } catch (e) {}
    scan(document);
    // YouTube swaps href/title/text in place on recycled cards (no childList): watch those too, plus a periodic audit.
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'title', 'aria-label'] });
    setInterval(() => active() && auditAll(), YT ? 1000 : 3000);
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const k in ch) S[k] = ch[k].newValue;
    undo(); scan(document);
  });
})();
