// Vegan Lens: which page elements are ads, and how to read/judge their text. Browser global (VeganAdUnits) + Node module.
// Pure: only uses matches/closest/querySelectorAll/getAttribute/parentElement/textContent, so tests can use fake DOM objects.
(function (root) {
  'use strict';
  // Per site: BLOCK = ad regions (may hold several ads), ITEM = one ad. A block holding items is a container.
  const SITES = {
    google: { host: /(^|\.)google\.[a-z.]+$/, block: ['#tads', '#tadsb', '#bottomads', '.commercial-unit-desktop-top', '.commercial-unit-desktop-rhs', '.cu-container'],
      item: ['[data-text-ad]', '.pla-unit', '.mnr-c.pla-unit'] },
    bing: { host: /(^|\.)bing\.com$/, block: ['.b_adTop', '.b_adBottom', '.b_adMiddle', 'li.b_ad'], item: ['li.b_adLastChild', '.sb_add', '.b_adSlug'] },
    ddg: { host: /(^|\.)duckduckgo\.com$/, block: [], item: ['[data-testid=ad]', '.result--ad', 'li[data-layout=ad]'] },
    youtube: { host: /(^|\.)youtube\.com$/, block: [], item: ['ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-display-ad-renderer',
      'ytd-promoted-video-renderer', 'ytd-companion-slot-renderer', 'ytd-action-companion-ad-renderer'] },
    amazon: { host: /(^|\.)amazon\.[a-z.]+$/, block: ['#sp_detail', '#sp_detail2', '#sp_detail_thematic', '[data-ad-feedback]', '[cel_widget_id*=sp_detail]', '[cel_widget_id*=sims-fbt][data-ad-feedback]'],
      item: ["[data-component-type='sp-sponsored-result']", '.AdHolder'] },
  };
  // Same-document display ads anywhere (cross-origin iframes inside them are unreadable and ignored).
  const GENERIC = ['[id^=google_ads]', 'ins.adsbygoogle', '[aria-label*=advertisement i]', '[aria-label=sponsored i]', '[data-ad]', '[data-ad-slot]', '[data-ad-unit]'];
  const LABEL_RX = /^\s*(?:sponsored(?: results?| products?| links?| content| post)?|ads?|advertisement|promoted|anzeige|publicidad)\s*[·:]?\s*$/i;
  const AMAZON_LABEL = '.puis-sponsored-label-text, .s-sponsored-label-text, .s-label-popover-default, [aria-label="Sponsored"], [aria-label="View Sponsored information or leave ad feedback"]';

  const siteOf = h => { h = String(h || ''); for (const k in SITES) if (SITES[k].host.test(h)) return k; return null; };
  const isAdLabelText = t => LABEL_RX.test(String(t || '')) && String(t).trim().length <= 24;
  function selectors(host, opts) {
    opts = opts || {}; const s = SITES[siteOf(host)];
    const block = s ? s.block.slice() : [], item = s ? s.item.slice() : [];
    if (opts.generic !== false && siteOf(host) !== 'amazon') item.push(...GENERIC);
    return { block, item, all: [...block, ...item].join(', '), itemSel: item.join(', ') };
  }
  // 'container' = holds individual ads (judge those instead); 'unit' = judge this element.
  function adRole(el, host) {
    const { itemSel } = selectors(host);
    if (itemSel && el.querySelectorAll(itemSel).length && !(el.matches(itemSel) && el.querySelectorAll(itemSel).length < 2)) return 'container';
    return 'unit';
  }
  const visible = t => String(t || '').replace(/\s+/g, ' ').trim();
  const textOf = el => visible(el.innerText != null ? el.innerText : el.textContent);
  const hasLink = el => (el.matches && el.matches('a[href]')) || el.querySelectorAll('a[href]').length > 0;
  const LANDMARK = 'nav, main, header, form, [role=navigation], [role=main], [role=banner], [role=region], [role=complementary], [role=search], [role=contentinfo]';
  const isShell = el => { try { return el.matches(LANDMARK) || !!el.querySelector(LANDMARK) || el.querySelectorAll('a[href]').length > 25; } catch (e) { return false; } };
  // From an "Ad"/"Sponsored" label element, find the ad it labels.
  function adRootFromLabel(label, host) {
    if (label.closest && label.closest('nav, header, footer, form, [role=navigation], [role=banner]')) return null;
    const { all } = selectors(host);
    const known = all && label.closest && label.closest(all);
    if (known) return known;
    let el = label.parentElement;
    for (let i = 0; el && i < 6; i++, el = el.parentElement) {
      const tag = el.tagName;
      if (tag === 'BODY' || tag === 'MAIN' || tag === 'HTML') return null;
      const len = textOf(el).length;
      if (len > 1500) return null;
      // 0.4.47: never climb into a page shell: a parent holding a landmark/region or many links is not an ad (e.g. a bare 'AD' over an empty slot in a webmail sidebar)
      if (isShell(el)) return null;
      if (len >= 20 && (hasLink(el) || el.querySelectorAll('img[alt]').length)) return el;
    }
    return null;
  }
  // Text to classify: headline (title/first link), the rest of the visible + link text, image alts. Ad labels removed.
  const JUNK_LABEL = /^\s*(?:for|from|by|rated)\b|\b(?:for|from|by)\s{2,}/i;
  function adParts(el) {
    const strip = t => visible(t).split(' ').filter((w, i, a) => !(i < 2 && isAdLabelText(w))).join(' ').replace(/^(?:sponsored|ad)\s*[·:]\s*/i, '');
    // 0.4.50: skip template labels with empty slots (Google PLA: ' for  from UGG US') and bare 'From X'/'Rated ...' labels
    const junk = e => { const l = e.getAttribute && e.getAttribute('aria-label'); return l != null && !visible(textOf(e)) && JUNK_LABEL.test(l); };
    const h = [...el.querySelectorAll('h1, h2, h3, h4, [role=heading], #video-title, .a-truncate-full, [data-text-ad] a, a[aria-label]')].find(e => !junk(e)) || el.querySelector('a[href]');
    let headline = strip(h ? (textOf(h) || h.getAttribute('aria-label') || h.getAttribute('title') || '') : '').slice(0, 200);
    let all = strip(textOf(el));
    const links = [...el.querySelectorAll('a[href]')].filter(a => !junk(a)).map(a => visible(a.getAttribute('aria-label') || a.getAttribute('title') || '')).filter(Boolean);
    if (!headline) headline = (links[0] || all).slice(0, 200);
    const idx = headline ? all.indexOf(headline) : -1;
    if (idx >= 0) all = (all.slice(0, idx) + ' ' + all.slice(idx + headline.length)).trim(); // don't count the headline twice
    const snippet = [all, ...links.filter(l => l !== headline && !all.includes(l))].join(' ').slice(0, 500);
    const alt = [...el.querySelectorAll('img[alt]')].map(i => visible(i.getAttribute('alt'))).filter(Boolean).slice(0, 3).join(' ').slice(0, 200);
    return { headline, snippet, alt };
  }
  // Ad copy is short: no requireHeadline, but a single weak mention ("milk", "chicken" once) isn't enough.
  const AD_PRODUCT = /\b(?:(?:grass|butter|goat|whole|skim)?milk|cheeses?|butter|yogurt|eggs?|ice cream|ghee|beef|pork|bacon|steaks?|sausages?|chicken|burgers?|salmon|tuna|shrimp)$/i; // head noun = last word
  function classifyAd(parts, S, classify, labelW) {
    const r = classify(parts, { ...(S || {}), requireHeadline: false });
    if (r.verdict !== 'nonvegan') return r;
    const about = r.about || {}, labels = Object.keys(about);
    const w = l => (labelW && labelW[l]) || 2;
    // 0.4.45: a headline that names a dairy/egg/meat product ('fairlife ... Milk') is clear on its own.
    const head = String(parts.headline || '').replace(/\s+[,|\u2013\u2014-]\s.*$|,.*$/, '').replace(/(?:\s+(?:\d[\d.\/]*\s*(?:fl\.? ?oz|oz|lbs?|gal(?:lon)?s?|qt|ct|count|pack|pk|g|kg|ml|l)?|half gallon|gallon|pack|carton))+\s*$/i, '').trim();
    const product = head.split(/\s+/).length <= 16 && AD_PRODUCT.test(head);
    const strong = product || labels.length >= 2 || labels.some(l => w(l) >= 2.5 || about[l] >= 2 * w(l)) || (r.reasons || []).includes('-context boost');
    return strong ? r : { ...r, verdict: 'neutral', reasons: [...(r.reasons || []), 'single weak mention in ad'] };
  }
  function isAmazonSponsored(el) {
    if (el.matches("[data-component-type='sp-sponsored-result'], .AdHolder") || (el.closest && el.closest("[data-component-type='sp-sponsored-result'], .AdHolder, #sp_detail, #sp_detail2, #sp_detail_thematic, [data-ad-feedback]"))) return true;
    if (el.querySelectorAll(AMAZON_LABEL).length) return true;
    return el.querySelectorAll('span, a').length < 400 && [...el.querySelectorAll('span')].some(s => /^\s*sponsored\s*$/i.test(s.textContent || ''));
  }
  const chipText = (verdict, topic) => verdict === 'vegan' ? 'Ad · vegan' : 'Ad · about ' + (topic || 'animal products');
  // 0.4.49: opt-in aggregate stat (sizing on-device OCR): does this ad have meaningful images, and do any of them carry a
  // usable description (alt / aria-label, incl. "text that says ...")? Icons/logos (< 64px when measurable,
  // role=presentation, aria-hidden) and player/menu button glyphs are ignored. Returns booleans only, never text.
  const IMG_UI = /^(?:play|pause|shop now|see details|learn more|download|sign up|open menu|close|more|loading.*|image|photo|picture|may be an image)$/i;
  function imgSize(i) {
    let w = Math.max(+i.width || 0, +i.naturalWidth || 0, +(i.getAttribute && i.getAttribute('width')) || 0), h = Math.max(+i.height || 0, +i.naturalHeight || 0, +(i.getAttribute && i.getAttribute('height')) || 0);
    if ((!w || !h) && i.getBoundingClientRect) { const r = i.getBoundingClientRect(); w = w || r.width; h = h || r.height; }
    return { w, h };
  }
  const attr = (i, a) => (i.getAttribute && i.getAttribute(a)) || '';
  function imgMeaningful(i) {
    if (attr(i, 'role') === 'presentation' || attr(i, 'aria-hidden') === 'true' || attr(i, 'alt') === '' && attr(i, 'role') === 'none') return false;
    const { w, h } = imgSize(i); return !((w && w < 64) || (h && h < 64));
  }
  const imgDescribed = i => [attr(i, 'alt'), attr(i, 'aria-label')].some(v => { const t = String(v || '').trim(); return t.length >= 3 && !IMG_UI.test(t); });
  // 0.4.49: visible verbal context of a unit, minus boilerplate (Ad/Sponsored, prices, menu/player buttons, counters).
  const BOILER = /\b(?:sponsored|ad|ads|advertisement|promoted|open menu|shop now|see details|learn more|sign up|download|play video|video player|play|pause|mute|unmute|enter fullscreen|change volume|change position|resume reel|just listed|partner listing|free|like|comment|share|follow|more)\b|[$€£]\s?[\d.,]+|\d+:\d+(?:\s*\/\s*\d+:\d+)?|\d+[kKmM]?\b|[\u200b\u00b7|·•…]+/gi;
  const meaningfulText = t => String(t || '').replace(BOILER, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const unitTextless = t => meaningfulText(t).length < 20;
  function adImageStats(el) {
    const imgs = [...el.querySelectorAll('img, [role=img]')].filter(imgMeaningful);
    return { images: imgs.length > 0, textless: imgs.length > 0 && !imgs.some(imgDescribed) };
  }
  // Image is contextless when it has no description AND its unit has no meaningful visible text.
  const imageContextless = (img, unitText) => !imgDescribed(img) && unitTextless(unitText);
  const api = { adImageStats, imgMeaningful, imgDescribed, meaningfulText, unitTextless, imageContextless, SITES, GENERIC, AMAZON_LABEL, siteOf, isAdLabelText, selectors, adRole, adRootFromLabel, adParts, classifyAd, isAmazonSponsored, chipText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganAdUnits = api;
})(typeof self !== 'undefined' ? self : this);
