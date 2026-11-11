// Vegan Lens general-web "Content" mode. Purely visual: adds classes/chips, never removes or rewires page elements.
(() => {
  'use strict';
  if (window.top !== window && !/youtube\.com$/.test(location.hostname)) return; // skip iframes (ads, widgets)
  const A = window.VeganAdUnits, U = window.VeganWebUnits, C = window.VeganContentClassifier, T = window.VeganContextTopics, P = window.VeganPage, VP = window.VeganPeople;
  let PEOPLE = null, peopleIdx = null, peopleKey = '', peopleState = { counts: new Map() };
  let CARDS = null;
  const counts = { vegan: 0, nonvegan: 0, unknown: 0, context: 0, ads: 0, scanned: 0, caution: 0 };
  const DEFAULTS = { checkAds: true, webEnabled: true, webMode: 'dim', sensitivity: 'med', siteBlock: [], siteAllow: [], webAllowOnly: false, contextCards: true, markPeople: true, markMeat: true, blurImages: true, showSwaps: true, audience: 'vegan', pageBlock: [], whitelist: [], whitelistDisabled: [], debug: false };
  const O = window.VeganOffers; Object.assign(DEFAULTS, O ? O.OFFER_DEFAULTS : {});
  let S = { ...DEFAULTS };
  let COUPONS = [], offerShown = false; // max 1 offer per page
  const host = location.hostname.replace(/^www\./, '');
  const YT = U.isYouTubeHost(location.hostname);
  const PIN = U.isPinterestHost(location.hostname); // 0.4.60
  const UE = U.isUberEatsHost(location.hostname); // 0.4.66
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
    // 0.4.28: link cards whose <a> IS the card (Allrecipes/Dotdash Meredith a.mntl-card), product tiles (Sephora)
    'a.mntl-card', 'a[class*=card i]:has(h2, h3, h4, .card__title, [class*=card__title])',
    ...(/(^|\.)sephora\./.test(location.hostname) ? ['a[href*="/product/"]:has(img)'] : []),
    U.PRODUCT_TILE, // 0.4.53 generic store product tiles (brand sites, SFCC/Shopify grids)
    ...U.storeUnitSel(location.hostname),
    ...(PIN ? [U.PIN_CARD] : []), // 0.4.60 Pinterest pins // 0.4.45 Walmart / Target / Yelp / recipe promo cards
    ...(UE ? [U.UE_CARD] : []), // 0.4.66 Uber Eats dishes + restaurant cards
  ].join(',');

  function dbg(path, el, info) {
    if (!S.debug) return;
    try { console.log('[Vegan Lens]', path, (el && el.tagName || '').toLowerCase(), JSON.stringify((info && info.headline) || ''), info && info.verdict, info || {}, el); } catch (e) {}
  }
  const siteMatch = (list) => list.some(d => host === d || host.endsWith('.' + d));
  const active = () => !(/(^|\.)facebook\.com$/.test(location.hostname) && /^\/marketplace(?:\/|$)/.test(location.pathname)) && S.webEnabled && // 0.4.48: marketplace.js owns Marketplace (also after SPA navigation)
     !siteMatch(S.siteBlock) && !P.isPageDisabled(S.pageBlock, location.href) && (!S.webAllowOnly || siteMatch(S.siteAllow));

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
    const h = el.querySelector('h1, h2, h3, h4, [role=heading], #video-title, [id=video-title-link], a[slot=title], [data-testid=post-title], a.title, .card__title-text, .card__title, [class*=ProductName i], [data-at=sku_item_name], ' + U.TITLE_SEL) || (el.tagName === 'A' ? null : el.querySelector('a'));
    let headline = (h && (h.innerText || h.textContent) || el.getAttribute('aria-label') || '').trim().slice(0, 300);
    if (!headline && el.tagName === 'A') headline = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200); // product tile link
    if (headline.length < 8) headline = U.fallbackHeadline(el) || headline; // 0.4.45: image-first links (Zappos), aria-label titles
    const tags = U.tagText(el); // 0.4.45: category chips (Yelp 'Steakhouses')
    const snippet = [...el.querySelectorAll('p, .VwiC3b, [data-sncf], #description-text, .b_caption')].slice(0, 2).map(p => p.innerText || '').join(' ').slice(0, 500);
    const alt = [...el.querySelectorAll('img[alt]')].slice(0, 2).map(i => i.alt).join(' ').slice(0, 200);
    if (PIN) { const pp = U.pinParts(el); return { ...pp, creators: creators(el) }; } // 0.4.60
    if (UE) return U.ueParts(el); // 0.4.66: name + description / cuisine tags only (no image-alt guessing)
    if (U.isFacebookHost(location.hostname)) { const x = U.fbExtraText(el); return { headline, tags, snippet: [snippet, x.snippet].filter(Boolean).join(' . ').slice(0, 1400), alt: [alt, x.alt].filter(Boolean).join(' . ').slice(0, 400), community: community(el), author: U.postAuthor(el) }; }
    return { headline, tags, snippet, alt, community: community(el), author: '', creators: creators(el) };
  }
  // 0.4.59: channel / creator / byline names in the unit; the classifier strips them (a name is not food evidence).
  const CREATOR_SEL = '[data-test-id*=creator i], [data-test-id*=pinner i], [data-test-id*=attribution i], [data-test-id*="user-name" i], [data-test-id*="board-name" i], ytd-channel-name, #channel-name, #byline, a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], [itemprop=author], [rel=author], .byline, [class*=author i], [class*=byline i]';
  function creators(el) {
    const out = new Set();
    for (const n of [...el.querySelectorAll(CREATOR_SEL)].slice(0, 6)) { const t = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').replace(/^by\s+/i, '').trim(); if (t.length >= 3 && t.length <= 60) out.add(t); }
    if (YT) { const m = /\bby (.{3,60}?)(?: \d[\d,.]*[KMB]? views| \d+ (?:second|minute|hour|day|week|month|year)s? ago|$)/i.exec(el.querySelector('#video-title, a#video-title-link, [aria-label]')?.getAttribute('aria-label') || ''); if (m) out.add(m[1].trim()); }
    return [...out];
  }
  // Reddit/Lemmy-style community label: shreddit-post attributes, or an 'r/Name' / 'c/Name' link/text in the card.
  function community(el) {
    const a = el.getAttribute && (el.getAttribute('subreddit-prefixed-name') || el.getAttribute('subreddit-name') || el.getAttribute('data-subreddit') || el.getAttribute('data-subreddit-prefixed') || el.getAttribute('data-community'));
    if (a) return a;
    const l = el.querySelector && el.querySelector('a[href*="/r/"][data-testid=subreddit-name], a[data-click-id=subreddit], a.subreddit, a[href^="/r/"], a[href*="/c/"]');
    const m = String((l && (l.textContent || l.getAttribute('href'))) || '').match(/\b[rc]\/([A-Za-z0-9_]+)/) || String(el.textContent || '').slice(0, 400).match(/\b[rc]\/([A-Za-z0-9_]+)/);
    return m ? m[0] : '';
  }

  // Vegan alternative search for animal-fabric/leather content, e.g. "wool coats" -> "vegan coats".
  const SW = window.VeganSwaps;
  const say = (k, d) => (SW && SW.say && SW.say(S.audience, k)) || d; // 0.4.63: unknown key falls back to the default
  function fabricSwap(r) { return C.fabricQuery ? C.fabricQuery(r) : null; }
  const MARK = (typeof VeganLensBrand !== 'undefined' ? VeganLensBrand.mark : typeof require === 'function' ? require('./brand.js').mark : (e => e));
  function chip(text, onShow) {
    const c = document.createElement('span');
    c.className = 'vl-w-chip';
    c.append(document.createTextNode(U.chipLabel(text) + ' · ')); MARK(c); // 0.4.45: never an empty label
    if (onShow) { const a = document.createElement('button'); a.type = 'button'; a.className = 'vl-w-show'; a.textContent = 'show';
      a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onShow(); }, true); c.append(a); }
    return c;
  }

  function contextCard(topics) {
    const card = document.createElement('aside');
    card.className = 'vl-w-ctx'; card.setAttribute('role', 'note');
    const head = document.createElement('div'); head.className = 'vl-w-ctx-head';
    const lab = document.createElement('span'); lab.textContent = '🌿 Context'; MARK(lab);
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
    el.classList.add('vl-w-unit'); counts.scanned++; clearTimeout(sendT); sendT = setTimeout(send, 300); // evaluated units (all-clear check)
    if (ctx && ctx.isContext) {
      el.dataset.vlW = 'context'; count('context');
      if (S.contextCards && CARDS) { const card = contextCard(ctx.topics); if (card) { el.insertAdjacentElement('afterend', card); el._vlChip = card; } }
      return;
    }
    el.dataset.vlW = r.verdict; count(r.verdict);
    el.dataset.vlWhy = r.verdict === 'vegan' ? 'Vegan-friendly' : r.verdict === 'nonvegan' ? 'about ' + (r.topic || 'animal products') : ''; // share (0.4.42)
    if (r.verdict === 'vegan') {
      el.classList.add('vl-w-vegan'); el.title = el.title || 'Vegan Lens: vegan-friendly — Added by Vegan Lens extension';
      // 0.4.66 Uber Eats: explicit chip on restaurant cards ("all-vegan") and dishes ("Vegan"); green accent stays.
      if (UE && !el.querySelector('.vl-w-chip-vegan')) {
        const lab = U.isUeStoreCard(el) ? 'all-vegan' : 'Vegan';
        const d = chip(lab); d.classList.add('vl-w-chip-vegan'); d.title = 'Vegan Lens: vegan-friendly\n' + U.matchText(r) + '\nAdded by Vegan Lens extension';
        el.prepend(d);
      }
      return;
    }
    // 0.4.66 Uber Eats: plant signal without a vegan verdict → light "Likely vegan" chip (no dim, not counted as non-vegan).
    if (UE && U.ueLikelyVegan(r) && !el.querySelector('.vl-w-chip-likely')) {
      const d = chip('Likely vegan'); d.classList.add('vl-w-chip-likely'); d.title = 'Vegan Lens: likely vegan (plant signal, not certified)\n' + U.matchText(r) + '\nAdded by Vegan Lens extension';
      el.prepend(d); el.dataset.vlW = 'likely'; el.title = el.title || 'Vegan Lens: likely vegan — Added by Vegan Lens extension';
      return;
    }
    if (r.verdict === 'discussion') { // 0.4.63: light label, no dim/blur/hide; not counted in the toolbar number (counts.discussion only)
      if (!el.querySelector('.vl-w-chip-discuss')) { const d = chip((r.mixed ? say('mixed', 'Mixed listing: includes ') : say('discussion', 'Discussion: about ')) + (r.topic || 'animal products')); d.classList.add('vl-w-chip-discuss'); d.title = 'Vegan Lens: ' + (r.mixed ? 'mixed venue listing' : 'discussion title') + ' (not dimmed)\n' + U.matchText(r) + '\nAdded by Vegan Lens extension'; el.prepend(d); }
      el.dataset.vlWhy = (r.mixed ? 'mixed listing including ' : 'discussion about ') + (r.topic || 'animal products'); return; }
    if (r.verdict !== 'nonvegan') { cautionPill(el); return; }
    // YouTube: dim/hide the card's contents but keep the chip inside the card (a sibling chip lands in the grid's flex/grid
    // flow, is clipped or re-rendered away by YouTube, and the filter on the card would blur the chip too).
    const inCard = YT || PIN || UE; // Pinterest/Uber Eats: keep the chip inside the card
    const dimCls = inCard ? 'vl-w-dim-in' : 'vl-w-dim', hideCls = inCard ? 'vl-w-hide-in' : 'vl-w-hide';
    const label = say('hidden', 'Hidden: about ') + (r.topic || 'animal products');
    const mode = S.webMode;
    let c;
    const reveal = () => { try { chrome.runtime.sendMessage({ type: 'stat', k: 'reveal' }); } catch (e) {} el.classList.remove(...U.DIM_CLASSES); el.classList.add('vl-w-revealed'); unblurCard(el); c && c.remove(); };
    c = mode === 'label' ? chip(say('label', 'Non-vegan: ') + (r.topic || 'animal products')) : chip(label, reveal);
    c.classList.add('vl-w-chip-' + mode);
    c.title = 'Vegan Lens: ' + (r.reasons || []).join(', ') + '\n' + U.matchText(r) + '\n' + 'Added by Vegan Lens extension';
    const q = S.showSwaps && fabricSwap(r);
    if (q) { const a = document.createElement('a'); a.className = 'vl-w-swap'; a.href = SW && SW.storeSearchUrl ? SW.storeSearchUrl(location.href, q) : 'https://www.google.com/search?q=' + encodeURIComponent(q); a.target = '_blank'; a.rel = 'noopener';
      el.dataset.vlSwap = a.href; a.textContent = say('swap', 'Try: ') + q; a.title = 'Vegan Lens suggestion — Added by Vegan Lens extension'; if (SW && SW.tagLink && SW.tagLink(a, S)) el.dataset.vlSwap = a.href; a.addEventListener('click', e => e.stopPropagation(), true); c.append(' · ', a); }
    addOffer(c, [r.topic, Object.keys(r.about || {}), q, (r.matches || []).map(m => m.term)]);
    showDim(el, c, inCard, mode === 'label' ? null : (mode === 'hide' ? hideCls : dimCls), 'content', r);
    if (mode !== 'label' && isDimmed(el)) blurCard(el);
  }
  // 0.4.29 partner offer: appended to an existing dim chip only (never changes the verdict), max 1 per page, never on vegan pages.
  function addOffer(chipEl, catParts) {
    if (!O || !S.showOffers || offerShown || pageCtx.vegan || !COUPONS.length) return;
    const o = O.pick(COUPONS, { categories: O.categoriesFor(catParts), showExample: S.showExampleOffers, pageVegan: pageCtx.vegan, shownOnPage: offerShown, enabled: S.showOffers });
    if (!o) return;
    offerShown = true;
    chipEl.append(' · ', O.element(o, document, k => { try { chrome.runtime.sendMessage({ type: 'stat', k: k === 'shown' ? 'offerShown' : 'offerClicked' }); } catch (e) {} }));
  }
  // 0.4.28 shopping caution (cosmetics: carmine/beeswax/lanolin; condoms: casein). Product tiles only (price or product link):
  // never on articles, so sex-ed / health content is untouched. A pill, never a dim.
  const PRICE = /(?:[$\u20ac\u00a3]\s?\d|\d[\d.,]*\s?(?:USD|EUR|GBP)\b)/;
  const isProductTile = el => (el.matches && el.matches('a[href*="/product/"], a[href*="/dp/"], [class*=product i], [data-testid*=product i]')) || PRICE.test((el.innerText || el.textContent || '').slice(0, 600));
  function cautionPill(el) {
    if (pageCtx.vegan || el.querySelector('.vl-w-caution') || !C.shopCaution || !isProductTile(el)) return;
    const cau = C.shopCaution((el.innerText || el.textContent || '').slice(0, 400), { ...S, host: location.hostname }); if (!cau) return;
    const pill = document.createElement('span'); pill.className = 'vl-w-caution'; pill.textContent = '\u26a0 Caution: ' + cau.text; pill.title = 'Vegan Lens: ' + cau.kind; MARK(pill);
    el.prepend(pill); el.dataset.vlCaution = cau.kind; counts.caution = (counts.caution || 0) + 1; clearTimeout(sendT); sendT = setTimeout(send, 300);
    dbg('caution', el, { headline: extract(el).headline, verdict: 'caution', kind: cau.kind });
  }
  // 0.4.25: blur the card's photo that lives outside the dimmed element (sibling figure / wrapping link).
  function blurCard(el) {
    if (!S.blurImages || pageCtx.vegan) return;
    const imgs = U.cardImages(el).filter(i => !(i.dataset && i.dataset.vlShown) && (!U.ownsImage || U.ownsImage(el, i))); // 0.4.34
    imgs.forEach(i => { if (inVeganUnit(i)) return; i.classList.add('vl-img-blur', 'vl-img-card'); i.title = i.title || 'Vegan Lens: blurred (click to show) — Added by Vegan Lens extension'; blurLabel(i, el.dataset.vlTopic || 'animal products'); });
    el._vlCardImgs = imgs; if (imgs.length) dbg('img:card-blur', el, { n: imgs.length });
  }
  function unblurCard(el) { (el._vlCardImgs || []).forEach(unblurImg); el._vlCardImgs = null; }
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

  // ---------- page / channel vegan context (0.4.12) ----------
  // A YouTube channel (/@handle, /channel/, /c/) or a page whose h1/top header says vegan/plant-based suppresses dims below it.
  // YouTube channels also become a vegan context once >= 20% (min 3) of the visible titles classify vegan; recomputed as cards load.
  const YT_CHANNEL = () => YT && /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+)/.test(location.pathname);
  let pageCtx = { vegan: false, why: '' }, headerChecked = false; const titleVerdicts = new Map();
  function headerText() {
    if (YT_CHANNEL()) return [...document.querySelectorAll('yt-page-header-renderer, #page-header, ytd-c4-tabbed-header-renderer, #channel-header, #channel-tagline, yt-description-preview-view-model')].map(n => n.innerText || n.textContent || '').join(' ').slice(0, 2000);
    if (YT) return '';
    if (UE) { // 0.4.66: restaurant name + cuisine chips (e.g. "Vegan · Healthy") so an all-vegan store becomes page context
      const h = document.querySelector('h1[data-testid="restaurant-name"], main h1, h1');
      const head = h ? (h.innerText || h.textContent || '') : '';
      const near = h && h.parentElement ? h.parentElement : document.querySelector('[data-testid*="store-header" i], [data-testid*="store-info" i]');
      const tags = near ? U.ueCuisineTags(near) : '';
      return (head + (tags ? ' · ' + tags : '')).slice(0, 500);
    }
    const h = document.querySelector('main h1, article h1, header h1, h1'); return h ? (h.innerText || h.textContent || '').slice(0, 300) : '';
  }
  function updatePageCtx() {
    if (pageCtx.vegan) return;
    const c = C.pageContext({ header: headerText(), verdicts: YT_CHANNEL() ? [...titleVerdicts.values()] : [] });
    if (!c.vegan) return;
    pageCtx = c; document.querySelectorAll('.vl-offer').forEach(n => n.remove()); document.documentElement.classList.add('vl-page-vegan'); document.querySelectorAll('.vl-img-blur').forEach(i => i.classList.remove('vl-img-blur')); document.querySelectorAll('.vl-blur-label').forEach(n => n.remove()); dbg('page:vegan-context', null, { why: c.why });
    // re-evaluate cards dimmed before the context was known
    document.querySelectorAll('.vl-w-dim, .vl-w-dim-in, .vl-w-hide, .vl-w-hide-in').forEach(u => { if (u.dataset.vlAd) return; resetUnit(u); processUnit(u); });
  }

  function processUnit(el) {
    if (seen.has(el)) return; seen.add(el);
    if (skippable(el)) return;
    const role = U.unitRole(el, { youtube: YT, pinterest: PIN, ubereats: UE, unitSel: UNIT_SEL });
    if (role === 'skip') return;
    if (role === 'container') { el.classList.add('vl-w-unit'); el.dataset.vlW = 'container'; dbg('container', el, { verdict: 'container' }); return; }
    // A result block that wraps a carousel: classify its cards individually, not the block.
    if (!el.dataset.vlRich && richCards(el).length >= 2) { el.classList.add('vl-w-unit'); el.dataset.vlW = 'container'; return; }
    const parts = extract(el);
    if (el.dataset.vlRich && parts.headline.length < 8) parts.headline = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 300);
    if (parts.headline.length < 8 && el.matches(U.PRODUCT_TILE) && PRICE.test(el.textContent || '')) parts.headline = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200); // 0.4.53 short names ('Lowmel')
    if (PIN && parts.headline.length < 8) { const h = U.pinAltHeadline(parts, U.pinSearchQuery(location), C.classify, S); if (h) { parts.headline = h; parts.alt = ''; } } // 0.4.61
    if (parts.headline.length < 8) { seen.delete(el); return; } // not rendered yet: retry on next mutation
    el._vlKey = unitKey(el, parts);
    let r = C.classify(parts, { ...S, requireHeadline: YT || PIN });
    if (YT_CHANNEL() && !titleVerdicts.has(parts.headline)) { titleVerdicts.set(parts.headline, r.verdict); updatePageCtx(); }
    else if (!pageCtx.vegan && !headerChecked) { headerChecked = true; updatePageCtx(); } // non-channel pages: h1/top header once
    if (pageCtx.vegan) r = C.classify(parts, { ...S, requireHeadline: YT || PIN, pageVegan: true });
    if (r.verdict !== 'nonvegan') dbg('content', el, { headline: parts.headline, verdict: r.verdict, reasons: r.reasons, matches: r.matches });
    apply(el, r, T.detectTopics(parts));
  }

  // ---------- ads ----------
  const AD = A.selectors(location.hostname);
  // 0.4.49: one opt-in aggregate stat per ad unit (booleans only; background drops it unless stats are on)
  // 0.4.49: per-image opt-in aggregate (dedupe data-vl-img-stat): meaningful images in a checked unit; contextless = no
  // alt/aria/'text that says' AND the unit has no meaningful visible text; undecided = unit verdict neutral/unknown/none.
  function imageStats(root) {
    if (!root.querySelectorAll) return; let n = 0, cl = 0, clu = 0;
    for (const img of root.querySelectorAll('img:not([data-vl-img-stat]), [role=img]:not([data-vl-img-stat])')) {
      if (img.closest('.vl-w-chip, .vl-blur-label, [class*=vl-p-]') || !A.imgMeaningful(img)) continue;
      const unit = img.closest('[data-vl-w]:not([data-vl-w=container])') || U.contentUnit(img); if (!unit) continue;
      img.dataset.vlImgStat = '1'; n++;
      if (A.imageContextless(img, U.unitText(unit))) { cl++; const v = unit.dataset && unit.dataset.vlW; if (!v || v === 'neutral' || v === 'unknown' || v === 'context') clu++; }
    }
    if (n) try { chrome.runtime.sendMessage({ type: 'stat', k: 'img', n, contextless: cl, undecided: clu }); } catch (e) {}
  }
  function adStat(el, undecided) {
    if (el.dataset.vlAdStat) return; el.dataset.vlAdStat = '1';
    const st = A.adImageStats(el); try { chrome.runtime.sendMessage({ type: 'stat', k: 'adImg', images: st.images, textless: st.textless, undecided: !!undecided }); } catch (e) {}
  }
  function applyAd(el, r) {
    if (r.verdict === 'discussion') r = { ...r, verdict: 'nonvegan' }; // 0.4.63: sponsored units are promos, never 'discussion'
    el.classList.add('vl-w-unit', 'vl-w-ad'); el.dataset.vlW = r.verdict; el.dataset.vlAd = r.verdict;
    adStat(el, r.verdict === 'neutral' || r.verdict === 'unknown');
    if (r.verdict === 'neutral') { cautionPill(el); return; } // 0.4.50: style-level caution on sponsored product tiles
    count(r.verdict); if (r.verdict === 'nonvegan') count('ads');
    if (r.verdict === 'vegan') { el.classList.add('vl-w-vegan'); el.title = el.title || 'Vegan Lens: vegan-friendly ad — Added by Vegan Lens extension'; return; }
    const mode = S.webMode; let c;
    const reveal = () => { try { chrome.runtime.sendMessage({ type: 'stat', k: 'reveal' }); } catch (e) {} el.classList.remove(...U.DIM_CLASSES); el.classList.add('vl-w-revealed'); c && c.remove(); };
    c = mode === 'label' ? chip(A.chipText('nonvegan', r.topic)) : chip(A.chipText('nonvegan', r.topic), reveal);
    c.classList.add('vl-w-chip-' + mode);
    c.title = 'Vegan Lens (ad): ' + (r.reasons || []).join(', ') + '\n' + U.matchText(r, 'ad detected by ' + (el._vlAdVia || '?')) + '\n' + 'Added by Vegan Lens extension';
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
    (el._vlCardImgs || []).forEach(i => { i.classList.remove('vl-img-blur', 'vl-img-card'); const n = i.nextElementSibling; if (n && n.classList.contains('vl-blur-label')) n.remove(); }); el._vlCardImgs = null;
    const cp = el.querySelector && el.querySelector(':scope > .vl-w-caution'); if (cp) { cp.remove(); counts.caution = Math.max(0, (counts.caution || 0) - 1); } delete el.dataset.vlCaution;
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
    if (UE) { const card = n.closest(U.UE_CARD); if (card && !seen.has(card)) processUnit(card); }
      if (PIN) { const card = n.closest(U.PIN_CARD); if (card && !seen.has(card) && !card.querySelector(U.PIN_BASE)) processUnit(card); } // 0.4.60 pins filled in after insert
    for (let u = n.closest('.vl-w-unit, [data-vl-ad]'); u; u = u.parentElement && u.parentElement.closest('.vl-w-unit, [data-vl-ad]')) audit(u);
    if (n.querySelectorAll) n.querySelectorAll('.vl-w-dim, .vl-w-dim-in, .vl-w-hide, .vl-w-hide-in').forEach(audit);
  }
  const auditAll = () => document.querySelectorAll('.vl-w-dim, .vl-w-dim-in, .vl-w-hide, .vl-w-hide-in').forEach(audit);
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) audit(e.target); })) : null;

  let sendT, lastUrl = location.href;
  function count(v) { if (v === 'neutral') return; counts[v] = (counts[v] || 0) + 1; clearTimeout(sendT); sendT = setTimeout(send, 300); }
  try { chrome.runtime.onMessage.addListener(m => { if (m && m.type === 'recount' && active()) { P.reportPage(); send(); } }); } catch (e) {} // 0.4.59
  function send() { try { chrome.runtime.sendMessage({ type: 'counts', source: 'web', counts: { ...counts, pageVegan: pageCtx.vegan ? 1 : 0 } }); } catch (e) {} }
  function zero() { for (const k in counts) counts[k] = 0; }
  let pageDone = false;
  // 0.4.53 product detail pages (JSON-LD Product / og:type product): classify the name + description + material lines
  // (leaf text such as 'Suede upper', '17mm sheepskin lining', read even inside collapsed accordions).
  function productPage() {
    if (document.querySelector('meta[property="og:type"][content="product" i], [itemtype$="schema.org/Product"]')) return true;
    return [...document.querySelectorAll('script[type="application/ld+json"]')].some(s => /"@type"\s*:\s*"Product"/.test(s.textContent || ''));
  }
  function productText() {
    let desc = '';
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { const m = /"@type"\s*:\s*"Product"[\s\S]*?"description"\s*:\s*"((?:[^"\\]|\\.){0,600})/.exec(s.textContent || ''); if (m) { desc = m[1].replace(/<[^>]+>/g, ' '); break; } }
    const mat = [...new Set([...document.querySelectorAll('main li, main p, main span, main dd, main td, li, dd')].filter(e => !e.children.length).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(t => t.length < 120 && /\b(?:upper|lining|insole|sockliner|outsole|material|materials|made (?:from|with|of)|composition|fabric)\b/i.test(t)))].slice(0, 12).join('. ');
    return { desc, mat };
  }
  function productBanner(h1) {
    const name = (h1.innerText || h1.textContent || '').replace(/\s+/g, ' ').trim(), x = productText();
    const pp = { headline: name, snippet: [x.desc, x.mat].filter(Boolean).join(' . ').slice(0, 1400) };
    let r = C.classify(pp, S), text;
    if (r.verdict === 'nonvegan') text = '\u2715 Vegan Lens: this product contains ' + ([...new Set((r.matches || []).map(m => String(m.term).trim().toLowerCase()))].slice(0, 3).join(', ') || r.topic || 'animal products');
    else if (r.verdict === 'vegan') text = '\ud83c\udf31 Vegan Lens: this product looks vegan';
    else { const cau = C.shopCaution(name, { ...S, host: location.hostname }); if (!cau) return; r = { verdict: 'caution' }; text = '\u26a0 Vegan Lens: ' + cau.text; }
    count(r.verdict === 'caution' ? 'caution' : r.verdict);
    const b = document.createElement('div'); b.className = 'vl-w-banner vl-w-banner-' + (r.verdict === 'caution' ? 'nonvegan' : r.verdict) + ' vl-w-banner-product'; b.id = 'vl-w-banner';
    b.textContent = text; const xb = document.createElement('button'); xb.type = 'button'; xb.textContent = '\u00d7'; xb.addEventListener('click', () => b.remove());
    b.append(xb); MARK(b); document.body.prepend(b); dbg('product-page', null, { headline: name, verdict: r.verdict, matches: r.matches });
  }
  function processPage() {
    if (pageDone) return; pageDone = true;
    const isArticle = document.querySelector('meta[property="og:type"][content="article"]') || document.querySelectorAll('article').length === 1;
    const h1 = document.querySelector('article h1, main h1, h1');
    if (!isArticle && h1 && productPage()) return productBanner(h1);
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
    b.append(x); MARK(b); document.body.prepend(b);
  }

  // Public-figure pills (people.json). Text-only insertion after the name; never reorders layout.
  function markPeople(root) {
    if (!VP || !PEOPLE || !(S.markPeople || S.markMeat)) return;
    const statuses = [...(S.markPeople ? ['vegan', 'former'] : []), ...(S.markMeat ? ['meat'] : [])], k = statuses.join(',');
    if (k !== peopleKey) { peopleKey = k; peopleIdx = VP.buildIndex(PEOPLE, { statuses }); }
    try { VP.markRoot(root === document ? document.body : root, document, peopleIdx, peopleState); } catch (e) { dbg('people:error', null, { error: String(e) }); }
  }
  // Image blur (step 1, no model): blur images whose alt/title/caption is about animal products, and images inside dimmed cards (CSS).
  function imgText(img) {
    const fig = img.closest('figure'), cap = fig && fig.querySelector('figcaption');
    return [img.alt, img.title, img.getAttribute('aria-label'), cap && cap.textContent].filter(Boolean).join(' . ').replace(/^(?:may be an? )?(?:image|photo|picture) of /i, '').slice(0, 300);
  }
  // 0.4.46: every blur carries attribution: 'Vegan Lens · blurred: <reason> · show' right after the image (click = unblur).
  function blurLabel(img, reason) {
    if (!img.parentElement || (img.nextElementSibling && img.nextElementSibling.classList.contains('vl-blur-label'))) return;
    const l = document.createElement('span'); l.className = 'vl-blur-label'; l.setAttribute('role', 'button'); l.tabIndex = 0;
    l.textContent = 'blurred: ' + String(reason || 'animal products').slice(0, 40) + ' \u00b7 show'; MARK(l);
    const show = e => { e.preventDefault(); e.stopPropagation(); unblurImg(img); };
    l.addEventListener('click', show, true); l.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && show(e));
    img.insertAdjacentElement('afterend', l);
  }
  function unblurImg(img) {
    img.classList.remove('vl-img-blur', 'vl-img-card'); if (img.dataset) img.dataset.vlShown = '1'; img.classList.add('vl-img-shown');
    const n = img.nextElementSibling; if (n && n.classList.contains('vl-blur-label')) n.remove();
  }
  function blurReason(r) { return (r && (r.topic || (r.labels && r.labels[0]) || (r.matches && r.matches[0] && r.matches[0].label))) || 'animal products'; }
  const veganUnitCache = new WeakMap();
  function inVeganUnit(img) {
    const u = U.contentUnit(img); if (!u) return false;
    if (!veganUnitCache.has(u)) veganUnitCache.set(u, C.unitVegan(U.unitText(u), S));
    return veganUnitCache.get(u);
  }
  function blurImages(root) {
    document.documentElement.classList.toggle('vl-blur-images', !!S.blurImages);
    if (!S.blurImages || pageCtx.vegan || !root.querySelectorAll) return;
    for (const img of root.querySelectorAll('img:not([data-vl-img])')) {
      img.dataset.vlImg = '1';
      const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      if ((w && w < 60) || (h && h < 60)) continue;
      const t = imgText(img); if (t.length < 3) continue;
      // 0.4.33: any classified unit (incl. containers/neutral posts) that is not dimmed -> only high-confidence alts blur.
      const owner = img.closest('[data-vl-w]');
      const undimmed = !!owner && owner.dataset.vlW !== 'nonvegan' && !isDimmed(owner);
      const ab = C.altBlur ? C.altBlur(t, S, undimmed) : { blur: C.classify(t, S).verdict === 'nonvegan', r: null };
      if (!ab.blur) { if (ab.r && ab.r.verdict === 'nonvegan') dbg('img:skip-' + ab.why, img, ab.r); continue; }
      const r = ab.r;
      if (inVeganUnit(img)) { dbg('img:skip-vegan-unit', img, r); continue; } // 0.4.46 email/article is vegan overall
      // 0.4.28: the image's card decides. A vegan card never gets a blurred photo; a non-vegan card is dimmed too.
      const unit = img.closest('[data-vl-w]:not([data-vl-w=container])');
      if (unit && unit.dataset.vlW === 'vegan') continue;
      const card = unit || img.closest('a[href], article, li, figure, [class*=card i]');
      if (card && card !== document.body) {
        const ct = (card.innerText || card.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        const cr = ct.length >= 8 ? C.classify({ headline: ct, alt: t, author: U.isFacebookHost(location.hostname) ? U.postAuthor(card) : '' }, S) : null;
        if (cr && cr.verdict === 'vegan') { dbg('img:skip-vegan-card', img, cr); continue; }
        if (!unit && cr && cr.verdict === 'nonvegan' && ct.length < 400 && card.querySelectorAll('img').length <= 3 && !skippable(card)) processUnit(card);
      }
      img.classList.add('vl-img-blur'); img.title = img.title || 'Vegan Lens: blurred (click to show) — Added by Vegan Lens extension';
      blurLabel(img, blurReason(r));
      dbg('img:blur', img, r);
    }
  }
  document.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest('.vl-img-blur, .vl-blur-images .vl-w-dim img, .vl-blur-images .vl-w-dim-in img');
    if (!img || img.dataset.vlShown) return;
    e.preventDefault(); e.stopPropagation(); unblurImg(img);
  }, true);

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
    blurImages(root.nodeType === 1 || root.nodeType === 9 ? root : document); // after cards: blur follows the card verdict (0.4.28)
    imageStats(root.nodeType === 1 || root.nodeType === 9 ? root : document); // 0.4.49 opt-in aggregate, after verdicts
    processPage();
  }
  const requestIdle = window.requestIdleCallback || (f => setTimeout(f, 50));

  function undo() {
    document.querySelectorAll('.vl-w-unit, .vl-w-dim, .vl-w-dim-in, .vl-w-hide, .vl-w-hide-in').forEach(el => { if (io) io.unobserve(el); el.classList.remove('vl-w-unit', 'vl-w-vegan', 'vl-w-revealed', 'vl-w-ad', ...U.DIM_CLASSES); delete el.dataset.vlW; delete el.dataset.vlAd; el._vlKey = null; seen.delete(el); });
    document.querySelectorAll('[data-vl-ad]').forEach(el => { delete el.dataset.vlAd; seen.delete(el); });
    document.querySelectorAll('.vl-w-chip, .vl-w-ctx, #vl-w-banner, .vl-w-caution, .vl-blur-label').forEach(n => n.remove());
    document.querySelectorAll('.vl-img-blur').forEach(i => i.classList.remove('vl-img-blur', 'vl-img-card')); document.querySelectorAll('img[data-vl-img]').forEach(i => delete i.dataset.vlImg);
    if (VP) VP.unmarkAll(document); peopleState = { counts: new Map() };
    offerShown = false; pageDone = false; pageCtx = { vegan: false, why: '' }; headerChecked = false; titleVerdicts.clear(); document.documentElement.classList.remove('vl-page-vegan'); zero(); send();
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
    if (S.showOffers) try { COUPONS = (await chrome.runtime.sendMessage({ type: 'coupons' })) || []; } catch (e) {}
    try { const pj = await chrome.runtime.sendMessage({ type: 'people' }); PEOPLE = pj && pj.people; } catch (e) {}
    scan(document);
    // 0.4.28: delayed rescans for late-rendered grids (Nordstrom showed 0 cards at ~6s, 72 at ~12s).
    for (const ms of [3000, 10000]) setTimeout(() => { if (active()) scan(document); }, ms);
    // YouTube swaps href/title/text in place on recycled cards (no childList): watch those too, plus a periodic audit.
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'title', 'aria-label'] });
    setInterval(() => active() && auditAll(), YT ? 1000 : 3000);
  });
  // 0.4.46 SPA navigation (Gmail opens a message by changing the hash): rescan even before the next DOM mutation.
  const onNav = () => setTimeout(() => { if (location.href === lastUrl || !active()) return; lastUrl = location.href; try { chrome.runtime.sendMessage({ type: 'reset' }); } catch (e) {} P.reportPage(); undo(); scan(document); }, 600);
  window.addEventListener('hashchange', onNav); window.addEventListener('popstate', onNav);
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const k in ch) S[k] = ch[k].newValue;
    undo(); scan(document);
  });
  // 0.4.55: rule-list changes (editor apply/reset, signed update) re-evaluate open tabs live, with the same reset as navigation.
  let rulesTimer = null;
  const VR = window.VeganRules;
  if (VR && VR.onChange) VR.onChange(() => { clearTimeout(rulesTimer); rulesTimer = setTimeout(() => { undo(); if (active()) scan(document); }, 250); });
})();
