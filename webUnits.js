// Vegan Lens: which page elements are classifiable "units". Browser global (VeganWebUnits) + Node module.
(function (root) {
  'use strict';
  const YT_CARD = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model';
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
  // Human-readable "what matched" for a chip title.
  function matchText(r, extra) {
    const m = (r && r.matches) || [];
    const parts = m.slice(0, 4).map(x => '"' + x.term + '" (' + x.label + ') in ' + x.where + ': …' + x.snippet + '…');
    if (extra) parts.unshift(extra);
    return parts.join('\n');
  }
  const DIM_CLASSES = ['vl-w-dim', 'vl-w-hide', 'vl-w-dim-in', 'vl-w-hide-in'];
  const api = { YT_CARD, isYouTubeHost, videoIds, unitRole, multiCard, chipAttached, dimCheck, matchText, DIM_CLASSES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganWebUnits = api;
})(typeof self !== 'undefined' ? self : this);
