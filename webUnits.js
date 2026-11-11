// Vegan Lens: which page elements are classifiable "units". Browser global (VeganWebUnits) + Node module.
(function (root) {
  'use strict';
  const YT_CARD = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model';
  // 0.4.60 Pinterest (all country domains). Pinterest class names are obfuscated, so only stable attributes are used:
  // data-test-id="pin"/"pinWrapper", data-grid-item, role=listitem holding a /pin/ link. One pin = one unit.
  const isPinterestHost = h => /(^|\.)pinterest\.(?:[a-z]{2,3})(?:\.[a-z]{2})?$/.test(String(h || ''));
  const PIN_CARD = '[data-test-id="pin"], [data-test-id="pinWrapper"], [data-grid-item="true"], [role="listitem"]:has(a[href*="/pin/"])';
  const PIN_BASE = '[data-test-id="pin"], [data-test-id="pinWrapper"], [data-grid-item="true"]';
  const isPin = el => !!el && (el.matches(PIN_BASE) || (el.getAttribute('role') === 'listitem' && !!el.querySelector('a[href*="/pin/"]')));
  function pinIds(el) {
    const ids = new Set();
    for (const a of el.querySelectorAll('a[href*="/pin/"]')) { const m = (a.getAttribute('href') || '').match(/\/pin\/([\w-]+)/); if (m) ids.add(m[1]); }
    return ids;
  }
  const pclean = t => String(t || '').replace(/\s+/g, ' ').trim();
  // Title / description / image alt / pin-link aria-label, plus the outbound domain of product pins (words only).
  function pinParts(el) {
    const q = s => [...el.querySelectorAll(s)];
    const titles = q('[data-test-id*="title" i], h2, h3').map(n => pclean(n.innerText != null ? n.innerText : n.textContent)).filter(t => t.length >= 3);
    const aria = q('a[href*="/pin/"][aria-label], [data-test-id="pin"][aria-label]').map(a => pclean(a.getAttribute('aria-label')));
    const headline = (titles[0] || aria.find(t => t.length >= 8) || '').slice(0, 300);
    const desc = q('[data-test-id*="desc" i]').map(n => pclean(n.innerText != null ? n.innerText : n.textContent));
    const alt = q('img[alt]').slice(0, 2).map(i => pclean(i.getAttribute('alt'))).filter(Boolean).join(' . ').slice(0, 300);
    const domains = new Set();
    for (const a of q('a[href^="http"]')) { try { const h = new URL(a.getAttribute('href')).hostname.replace(/^www\./, ''); if (!isPinterestHost(h)) domains.add(h); } catch (e) {} }
    q('[data-test-id*="domain" i]').forEach(n => { const t = pclean(n.textContent).replace(/^www\./, ''); if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) domains.add(t); });
    const site = [...domains].slice(0, 2).map(d => d.replace(/\.[a-z.]+$/i, '').replace(/[.-]+/g, ' ')).join(' ');
    return { headline, tags: '', snippet: [...desc, ...aria.filter(t => t !== headline)].join(' . ').slice(0, 500) + (site ? ' . ' + site : ''), alt, community: '', author: '', domains: [...domains] };
  }
  // 0.4.61: a pin with no title (text-in-image pins, e.g. a 'Chicken Quesadillas' recipe card). Its image alt may stand in
  // for the title only on a search whose own query is clearly non-vegan, and only when the alt names the same topic.
  // Otherwise the pin is left alone (no title = not enough evidence).
  function pinAltHeadline(parts, query, classify, opts) {
    if (!parts || (parts.headline || '').length >= 8 || !query || !classify) return '';
    const alt = String(parts.alt || '').split(' . ')[0].trim(); if (alt.length < 8) return '';
    const q = classify({ headline: query }, opts); if (!q || q.verdict !== 'nonvegan' || !q.topic) return '';
    const a = classify({ headline: alt, creators: parts.creators }, { ...opts, requireHeadline: true });
    return a && a.verdict === 'nonvegan' && a.topic === q.topic ? alt : '';
  }
  const pinSearchQuery = loc => { try { const u = new URL(loc.href); return /^\/search\//.test(u.pathname) ? (u.searchParams.get('q') || '') : ''; } catch (e) { return ''; } };
  // 0.4.66 Uber Eats. Class names are obfuscated; use stable data-testid / link shapes only.
  // Verified (scraper docs + rendered store/feed HTML, 2025–2026): store-item-*, rich-text, store-card, store-catalog-section-vertical-grid.
  // Assumed fallbacks: menu-item / item-name / item-price (alterlab), cuisine chips from short rich-text / data-baseweb=tag.
  const isUberEatsHost = h => /(^|\.)ubereats\.com$/.test(String(h || ''));
  const UE_ITEM = '[data-testid^="store-item-"], [data-testid="menu-item"]';
  const UE_STORE = '[data-testid="store-card"]';
  const UE_CARD = UE_ITEM + ', ' + UE_STORE;
  const ueClean = t => String(t || '').replace(/\s+/g, ' ').trim();
  const isUeMenuItem = el => !!el && ((el.getAttribute && /^store-item-/i.test(el.getAttribute('data-testid') || '')) || (el.matches && el.matches('[data-testid="menu-item"]')));
  const isUeStoreCard = el => !!el && el.matches && el.matches(UE_STORE);
  const isUeUnit = el => isUeMenuItem(el) || isUeStoreCard(el);
  // Cuisine / category chips on a store card or store header. Short labels only; skip ratings, ETAs, prices, promos.
  const UE_NOT_CUISINE = /^(?:\$|€|£|\d|closed|open|delivery|pickup|fee|min|mi\b|km\b|asap|offers?|buy\b|get\b|sponsored|promo|new\b|ad\b|\(|•|·)/i;
  function ueCuisineTags(el) {
    const out = [];
    const nodes = [...el.querySelectorAll('[data-testid="rich-text"], [data-baseweb="tag"], [data-testid*="cuisine" i], [data-testid*="category" i]')].slice(0, 24);
    for (const n of nodes) {
      const t = ueClean(n.innerText != null ? n.innerText : n.textContent);
      if (!t || t.length < 3 || t.length > 28 || UE_NOT_CUISINE.test(t) || /%|\d+\.\d/.test(t)) continue;
      if (!out.includes(t)) out.push(t);
    }
    return out.slice(0, 8).join(', ');
  }
  function ueMenuParts(el) {
    const texts = [...el.querySelectorAll('span[data-testid="rich-text"], [data-testid="item-name"], [data-testid="item-description"], p, h1, h2, h3, h4')]
      .map(n => ueClean(n.innerText != null ? n.innerText : n.textContent))
      .filter(t => t && t.length >= 2 && !/^\$/.test(t) && !/%/.test(t) && !/^\d+%$/.test(t));
    // Prefer an explicit item-name when present.
    const named = el.querySelector('[data-testid="item-name"]');
    let headline = named ? ueClean(named.innerText != null ? named.innerText : named.textContent) : '';
    if (!headline) headline = texts.find(t => t.length >= 3 && t.length <= 120) || '';
    const descEl = el.querySelector('[data-testid="item-description"]');
    let snippet = descEl ? ueClean(descEl.innerText != null ? descEl.innerText : descEl.textContent).slice(0, 500) : '';
    if (!snippet) {
      const rest = texts.filter(t => t !== headline && t.length >= 8);
      snippet = rest.slice(0, 2).join(' . ').slice(0, 500);
    }
    return { headline: headline.slice(0, 200), tags: '', snippet, alt: '', community: '', author: '', kind: 'dish' };
  }
  function ueStoreParts(el) {
    const a = el.matches('a[data-testid="store-card"]') ? el : (el.querySelector('a[data-testid="store-card"]') || el.querySelector('a[href*="/store/"]'));
    const h3 = el.querySelector('h3, h2') || (a && a.querySelector('h3, h2'));
    let name = h3 ? ueClean(h3.innerText != null ? h3.innerText : h3.textContent) : '';
    if (!name && a) name = ueClean(a.getAttribute('aria-label') || a.getAttribute('title') || '');
    if (!name && a) name = ueClean(a.innerText != null ? a.innerText : a.textContent).split('\n')[0];
    const tags = ueCuisineTags(el);
    // Cuisine chips are on-card identity (like Yelp categories). Fold into the headline so clear
    // vegan / steakhouse / seafood / wings / BBQ tags count as title evidence, not weak snippet text.
    const headline = [name, tags].filter(Boolean).join(' · ').slice(0, 200);
    return { headline, tags, snippet: '', alt: '', community: '', author: '', kind: 'store', storeName: name };
  }
  function ueParts(el) {
    if (isUeMenuItem(el)) return ueMenuParts(el);
    if (isUeStoreCard(el)) return ueStoreParts(el);
    return { headline: '', tags: '', snippet: '', alt: '', community: '', author: '', kind: '' };
  }
  // Soft plant signal with no animal hit: show a light "Likely vegan" badge (never dims, never counts as non-vegan).
  function ueLikelyVegan(r) {
    if (!r || r.verdict !== 'neutral') return false;
    const reasons = (r.reasons || []).join(' ');
    return r.score > 0 && /\+plant|\+vegan|\+product:/i.test(reasons);
  }
  const isYouTubeHost = h => /(^|\.)youtube\.com$/.test(String(h || ''));
  // distinct video ids linked from an element
  function videoIds(el) {
    const ids = new Set();
    for (const a of el.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href') || '';
      const m = h.match(/[?&]v=([\w-]{6,})/) || h.match(/\/shorts\/([\w-]{6,})/) || h.match(/youtu\.be\/([\w-]{6,})/);
      if (m) ids.add(m[1]);
    }
    return ids;
  }
  // 'unit' = classify it; 'container' = holds other units, classify those instead; 'skip' = ignore.
  function unitRole(el, opts) {
    opts = opts || {};
    if (opts.pinterest) {
      if (!isPin(el)) return 'skip';
      if (el.querySelector(PIN_BASE) || pinIds(el).size > 1) return 'container'; // grid / wrapper: use the innermost pin
      return 'unit';
    }
    if (opts.ubereats) {
      if (!isUeUnit(el)) return 'skip';
      // Outer store-card wrapping an inner a[data-testid=store-card], or a section wrapping items: use the innermost unit.
      if (el.querySelector(UE_CARD)) return 'container';
      return 'unit';
    }
    if (opts.youtube) {
      // On YouTube only real video cards count; generic card/li/story selectors would grab rows/shelves.
      if (!el.matches(YT_CARD)) return 'skip';
      if (el.querySelectorAll(YT_CARD).length) return 'container'; // e.g. rich-item wrapping a lockup: use the innermost card
      if (videoIds(el).size > 1) return 'container';
      return 'unit';
    }
    if (opts.unitSel && el.querySelectorAll(opts.unitSel).length >= 2) return 'container';
    return 'unit';
  }
  // Invariant 3: an element holding 2+ video cards / videos (a row, shelf, #contents, grid) is never dimmed.
  function multiCard(el) {
    if (!el || !el.querySelectorAll) return false;
    return el.querySelectorAll(YT_CARD).length >= 2 || videoIds(el).size >= 2;
  }
  // Invariant 1: the chip must be inside the element (direct child) or directly attached before it.
  function chipAttached(el, chip) {
    if (!el || !chip || chip.isConnected === false) return false;
    return chip.parentElement === el || (chip.nextElementSibling === el && chip.parentElement === el.parentElement);
  }
  // Decide whether a dim may be shown / kept. Returns { ok, why }.
  // st: { chip, keyThen, keyNow } where keyNow is the element's current headline|videoIds (null = not readable).
  function dimCheck(el, st) {
    st = st || {};
    if (multiCard(el)) return { ok: false, why: 'contains 2+ video cards' };
    if (!chipAttached(el, st.chip)) return { ok: false, why: 'no chip attached' };
    if (st.keyThen == null || st.keyNow == null || st.keyNow !== st.keyThen) return { ok: false, why: 'headline/video id changed since verdict' };
    return { ok: true, why: '' };
  }

  // 0.4.45 store/card units. Stable attributes and link shapes only (no hashed classes).
  function storeUnitSel(host) {
    const h = String(host || ''), out = [
      // recipe / promo cards anywhere (Food Network o-PromoItem / m-MediaBlock, generic Card + /recipes/ link)
      '[class*=PromoItem]:has(a)', '[class*=MediaBlock]:has(h2 a, h3 a, h4 a, a h3, a h4)',
      '[class*=Card]:has(a[href*="/recipes/"])', 'li:has(a[href*="/recipes/"]):has(h2, h3, h4, [class*=Headline i])',
    ];
    if (/(^|\.)walmart\.com$/.test(h)) out.push('[data-item-id]:has(a[href*="/ip/"])', 'div[role=group]:has(a[href*="/ip/"])');
    if (/(^|\.)target\.com$/.test(h)) out.push('[data-test="@web/site-top-of-funnel/ProductCardWrapper"]', '[data-test*=ProductCard]:has(a[href*="/p/"])');
    if (/(^|\.)yelp\.[a-z.]+$/.test(h)) out.push('[data-testid=serp-ia-card]', 'li:has(a[href^="/biz/"]):has(h3, h4)');
    return out;
  }
  // 0.4.53 generic product tiles: product-id data attributes or product-tile/card classes, holding a link and an image.
  // web.js also requires a price before a tile's short name is used, and nested matches are skipped (outermost wins).
  const PRODUCT_TILE = ['[data-pid]', '[data-product-id]', '[data-productid]', '[data-product-sku]', '[itemtype$="schema.org/Product"]', '[class*=product-tile i]', '[class*=product-card i]', '[class*=productTile]', '[class*=productCard]', '[class*=product-item i]']
    .map(s => s + ':has(a[href]):has(img)').join(', ');
  const TITLE_SEL = '[data-automation-id=product-title], [data-test=product-title], [itemprop=name], [class*=Headline i]';
  const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
  // Headline when no heading element exists: longest link text / aria-label / title among the unit's links (<= 200).
  function fallbackHeadline(el) {
    let best = '';
    const links = el.tagName === 'A' ? [el, ...el.querySelectorAll('a[href]')] : [...el.querySelectorAll('a[href]')];
    for (const a of links) for (const t of [a.getAttribute('aria-label'), a.getAttribute('title'), a.innerText != null ? a.innerText : a.textContent]) { const c = clean(t); if (c.length > best.length && c.length <= 200) best = c; }
    if (best.length < 8) { const i = el.querySelector('img[alt]'); const c = clean(i && i.getAttribute('alt')); if (c.length > best.length) best = c.slice(0, 200); }
    return best;
  }
  // Category / tag chips: Yelp category links (cflt= / find_desc=), [class*=categor] and [class*=tag] text. Short words only.
  function tagText(el) {
    const n = [...el.querySelectorAll('a[href*="cflt="], a[href*="find_desc="], [class*=categor i], [class*=tag i]:not(a[href*="/biz/"])')];
    return [...new Set(n.map(x => clean(x.innerText != null ? x.innerText : x.textContent)).filter(t => t && t.length <= 40))].slice(0, 6).join(', ');
  }
  // Never render an empty chip: fall back to a category label.
  function chipLabel(text) { let t = clean(text); if (!/[a-z0-9]/i.test(t)) return 'Vegan Lens: animal products'; if (/(?:\babout|[:\u00b7])$/i.test(t)) t += ' animal products'; return t; }
  // Human-readable "what matched" for a chip title.
  function matchText(r, extra) {
    const m = (r && r.matches) || [];
    const parts = m.slice(0, 4).map(x => '"' + x.term + '" (' + x.label + ') in ' + x.where + ': …' + x.snippet + '…');
    if (extra) parts.unshift(extra);
    return parts.join('\n');
  }
  // 0.4.25: the photo of a dimmed card often sits outside the element we chose (sibling <figure>, wrapping <a>).
  // Return the card's associated prominent image(s) outside el: the image in the same <a href> as the title, else the
  // nearest ancestor (<= 3 levels, stopping at one holding other titles) that has exactly one prominent image.
  const CARD_IMG = 'img, picture, [style*="background-image"]';
  const CARD_TITLE = 'h1, h2, h3, h4, [role=heading]';
  function tinyImg(i) {
    const n = (k) => { const v = parseFloat(i.getAttribute && i.getAttribute(k)); return isNaN(v) ? null : v; };
    const w = n('width'), h = n('height');
    if ((w != null && w < 48) || (h != null && h < 48)) return true;
    if (i.tagName === 'IMG' && i.complete && i.naturalWidth && i.naturalWidth < 48) return true;
    return false;
  }
  // A scanned unit (data-vl-w) inside root that is neither el, an ancestor of el, nor inside el.
  function otherUnit(root, el) { for (const u of root.querySelectorAll('[data-vl-w]')) if (u !== el && !u.contains(el) && !el.contains(u)) return true; return false; }
  function prominent(root, el) {
    const out = [];
    for (const i of root.querySelectorAll(CARD_IMG)) {
      if (el.contains(i) || tinyImg(i)) continue;
      const owner = i.closest && i.closest('[data-vl-w]'); if (owner && owner !== el && !owner.contains(el)) continue; // another unit's image
      if (i.tagName === 'IMG' && i.parentElement && i.parentElement.tagName === 'PICTURE') continue; // count <picture> once
      if (out.some(o => o.contains(i))) continue;
      out.push(i);
    }
    return out;
  }
  function cardImages(el) {
    if (!el || !el.querySelectorAll) return [];
    const ownTitles = el.querySelectorAll(CARD_TITLE).length || 1;
    const a = el.closest && el.parentElement && el.parentElement.closest('a[href]');
    if (a) { const im = prominent(a, el); if (im.length === 1) return im; }
    let p = el.parentElement;
    for (let d = 0; p && d < 3; d++, p = p.parentElement) {
      if (p.tagName === 'BODY' || p.tagName === 'HTML') break;
      if (p.querySelectorAll(CARD_TITLE).length > ownTitles) break; // holds other cards
      if (otherUnit(p, el)) break; // 0.4.31: holds another scanned unit (its photo isn't ours)
      const im = prominent(p, el);
      if (im.length === 1) return im;
      if (im.length > 1) break;
    }
    return [];
  }
  // 0.4.34: an image may be blurred for a dimmed unit only if it lives in that unit's own post/card container:
  // its nearest post boundary (Reddit post, article, scanned unit) must be the unit itself or contain the unit,
  // and no other scanned unit may sit between the image and that boundary.
  const POST_BOUNDARY = 'shreddit-post, article, [data-vl-w]:not([data-vl-w=container])';
  function ownsImage(el, img) {
    if (!el || !img || !img.closest) return false;
    if (el.contains && el.contains(img)) return true;
    const box = img.closest(POST_BOUNDARY);
    if (!box) return true; // plain card markup with no post boundary: cardImages() already bounded the search
    if (box !== el && !(box.contains && box.contains(el))) return false; // image belongs to a neighbouring post/unit
    const u = img.closest('[data-vl-w]:not([data-vl-w=container])');
    return !u || u === el || u === box || (u.contains && u.contains(el));
  }
  const DIM_CLASSES = ['vl-w-dim', 'vl-w-hide', 'vl-w-dim-in', 'vl-w-hide-in'];
  // 0.4.39: social post author/page name from the post header (Facebook etc.): the first short heading/strong/link text
  // in the unit. Structural selectors only, no generated class names.
  const isFacebookHost = h => /(^|\.)facebook\.com$/.test(String(h || ''));
  function postAuthor(el) {
    if (!el || !el.querySelectorAll) return '';
    const al = el.getAttribute && el.getAttribute('aria-labelledby'); // FB articles point at their header
    const cands = [...el.querySelectorAll('h2, h3, h4, [role=heading], strong, a[role=link] > span, a[href] > strong, a[href] > span > strong')].slice(0, 8);
    for (const c of cands) {
      const t = String(c.innerText || c.textContent || '').split('\n')[0].replace(/\s+/g, ' ').trim();
      if (t.length >= 2 && t.length <= 80 && !/^(?:sponsored|suggested for you|follow|join|see more|like|comment|share)$/i.test(t)) return t;
    }
    return '';
  }
  // 0.4.40: extra Facebook post text the visible innerText misses: text inside images (FB auto alt 'May be an image of ...
  // and text that says "..."'), image aria-labels, link-preview headline/domain, and collapsed 'See more' text already in the DOM
  // (textContent includes hidden nodes; nothing is clicked).
  function altSays(t) {
    const m = String(t || '').match(/text that says ['"\u201c\u2018](.+?)['"\u201d\u2019]?\s*$/i);
    return m ? m[1].trim() : '';
  }
  function fbExtraText(el) {
    if (!el || !el.querySelectorAll) return { snippet: '', alt: '' };
    const said = [], alts = [], link = [];
    for (const i of [...el.querySelectorAll('img[alt], img[aria-label], [role=img][aria-label]')].slice(0, 6)) {
      for (const v of [i.getAttribute('alt'), i.getAttribute('aria-label')]) { if (!v) continue; alts.push(v); const q = altSays(v); if (q) said.push(q); }
    }
    for (const a of [...el.querySelectorAll('a[href]')].slice(0, 40)) {
      const h = a.getAttribute('href') || '';
      if (/^https?:\/\/(?:l\.|lm\.)?facebook\.com\/l\.php|^https?:\/\/(?!(?:[\w-]+\.)?facebook\.com)/i.test(h)) { const t = String(a.textContent || '').replace(/\s+/g, ' ').trim(); if (t) link.push(t.slice(0, 200)); }
    }
    const msg = [...el.querySelectorAll('[data-ad-preview=message], [data-ad-comet-preview=message], [data-ad-rendering-role=story_message]')].map(m => String(m.textContent || '').replace(/\s+/g, ' ').trim()).join(' ');
    return { snippet: [msg, ...said, ...link].filter(Boolean).join(' . ').slice(0, 900), alt: alts.join(' . ').slice(0, 300) };
  }
  // 0.4.46: the nearest content unit for an image: an open email body (Gmail div.a3s / message list item), article or post;
  // otherwise the closest ancestor holding a real amount of text. Never the whole page/body.
  const CONTENT_UNIT = 'div.a3s, [data-message-id], [role=listitem], article, [role=article], [data-vl-w]:not([data-vl-w=container])';
  // 0.4.47: candidates holding page landmarks (app shells) or ad-marked units never count; a message-body region
  // (role=region, or data-test-id/aria-label containing 'message-body') is a message boundary; table email markup
  // resolves to its outermost table so every image of one message shares one unit.
  const LANDMARK = 'nav, main, header, form, [role=navigation], [role=main], [role=banner], [role=region], [role=complementary], [role=search]';
  const hasLandmark = e => { try { return !!e.querySelector(LANDMARK); } catch (x) { return false; } };
  const attr = (e, k) => (e.getAttribute && e.getAttribute(k)) || '';
  const isMsgBody = e => attr(e, 'role') === 'region' || /message-?body/i.test(attr(e, 'data-test-id') + ' ' + attr(e, 'aria-label'));
  const isTop = e => !e || e.tagName === 'BODY' || e.tagName === 'HTML';
  const TABLEISH = /^(TABLE|TBODY|THEAD|TR|TD|CENTER)$/;
  function contentUnit(img) {
    if (!img || !img.parentElement) return null;
    for (let e = img.parentElement; !isTop(e); e = e.parentElement) {
      if (isMsgBody(e)) return e;
      let m = false; try { m = e.matches(CONTENT_UNIT); } catch (x) {}
      if (m && !attr(e, 'data-vl-ad') && !hasLandmark(e)) return e;
      if (hasLandmark(e)) break;
    }
    let n = null;
    for (let e = img.parentElement, i = 0; !isTop(e) && i < 12; e = e.parentElement, i++) {
      if (hasLandmark(e) || attr(e, 'data-vl-ad')) break;
      if ((e.textContent || '').replace(/\s+/g, ' ').trim().length >= 200) { n = e; break; }
    }
    if (!n) return null;
    for (let p = n.parentElement; !isTop(p) && (TABLEISH.test(p.tagName) || TABLEISH.test(n.tagName)) && !hasLandmark(p) && !isMsgBody(p) && !attr(p, 'data-vl-ad'); p = p.parentElement) {
      if (!TABLEISH.test(p.tagName) && !p.querySelector('table')) break;
      n = p;
      if (!TABLEISH.test(p.tagName)) break;
    }
    return n;
  }
  const unitText = el => el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6000) : '';
  const api = { pinAltHeadline, pinSearchQuery, isPinterestHost, PIN_CARD, PIN_BASE, isPin, pinIds, pinParts, isUberEatsHost, UE_CARD, UE_ITEM, UE_STORE, isUeUnit, isUeMenuItem, isUeStoreCard, ueParts, ueCuisineTags, ueLikelyVegan, PRODUCT_TILE, contentUnit, unitText, CONTENT_UNIT, storeUnitSel, TITLE_SEL, fallbackHeadline, tagText, chipLabel, altSays, fbExtraText, isFacebookHost, postAuthor, YT_CARD, isYouTubeHost, videoIds, unitRole, multiCard, chipAttached, dimCheck, matchText, DIM_CLASSES, cardImages, ownsImage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganWebUnits = api;
})(typeof self !== 'undefined' ? self : this);
