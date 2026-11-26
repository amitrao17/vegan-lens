// Vegan Lens attribution helper (0.4.32). Every element Vegan Lens adds to a page goes through mark(): it gets the 16px
// extension icon, the words "Vegan Lens" (as visible text, or as aria-label/title where space is tight) and the tooltip
// "Added by Vegan Lens extension". Browser global (VeganLensBrand) + Node module.
// 0.4.78: the 16px mark is an inline SVG (no extension-scheme URL or network fetch). Pages such as YouTube block
// extension-icon URLs even when they are listed in web_accessible_resources ("Unsafe attempt to load URL").
(function (root) {
  'use strict';
  const TIP = 'Added by Vegan Lens extension';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // After chrome://extensions reload, an already-injected content script keeps running but chrome.runtime.id is gone.
  // Callers should stop quietly (no runtime URL lookup, no messaging) instead of logging "Extension context invalidated".
  function alive() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime) return true;
      return typeof chrome.runtime.id === 'string' && !!chrome.runtime.id;
    } catch (e) { return false; }
  }
  function svgEl(doc, name, attrs) {
    const n = doc.createElementNS ? doc.createElementNS(SVG_NS, name) : doc.createElement(name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function add(parent, child) {
    if (parent.appendChild) parent.appendChild(child); else if (parent.append) parent.append(child);
  }
  function icon(doc) {
    const i = svgEl(doc, 'svg', {
      xmlns: SVG_NS, viewBox: '0 0 16 16', width: '16', height: '16',
      'aria-hidden': 'true', focusable: 'false', draggable: 'false', class: 'vl-mark-icon'
    });
    i.className = 'vl-mark-icon';
    add(i, svgEl(doc, 'rect', { width: '16', height: '16', rx: '3.5', fill: '#2E9D4A' }));
    // Stylized leaf, same silhouette as icons/icon16.png, drawn as vectors so CSP and Trusted Types cannot block it.
    add(i, svgEl(doc, 'path', { fill: '#fff', d: 'M4.2 5.6c0-1.3 1.6-1.8 3.8.4 2.2-2.2 3.8-1.7 3.8.4 0 3.2-2.2 6-3.8 7-1.6-1-3.8-3.8-3.8-7z' }));
    return i;
  }
  const textOf = el => String(el.textContent || '');
  const prepend = (el, ...nodes) => { if (el.prepend) el.prepend(...nodes); else if (el.children) el.children.unshift(...nodes); };
  // opts.compact: icon only + aria-label (tiny pills); otherwise icon + "Vegan Lens ·" unless the text already says Vegan Lens.
  function mark(el, opts) {
    opts = opts || {}; if (!el || el.getAttribute && el.getAttribute('data-vl-attr') === '1') return el;
    const doc = opts.doc || el.ownerDocument || (typeof document !== 'undefined' ? document : null);
    el.setAttribute('data-vl-attr', '1');
    el.className = (el.className ? el.className + ' ' : '') + 'vl-attr' + (opts.compact ? ' vl-attr-compact' : '');
    const nodes = [icon(doc)];
    if (!opts.compact && !/Vegan Lens/.test(textOf(el))) { const s = doc.createElement('span'); s.className = 'vl-mark-text'; s.textContent = 'Vegan Lens \u00b7 '; nodes.push(s); }
    prepend(el, ...nodes);
    const t = el.getAttribute('title') || '';
    el.setAttribute('title', t ? (/Vegan Lens/.test(t) ? t : 'Vegan Lens: ' + t) + ' \u2014 ' + TIP : TIP);
    if (opts.compact) { const a = el.getAttribute('aria-label'); el.setAttribute('aria-label', 'Added by Vegan Lens' + (a ? ': ' + a : textOf(el).trim() ? ': ' + textOf(el).trim().slice(0, 80) : '')); }
    return el;
  }
  const CSS = '.vl-attr{display:inline-flex;align-items:center;gap:3px;flex-wrap:wrap;max-width:100%}.vl-mark-icon{width:16px!important;height:16px!important;min-width:16px;flex:none;display:inline-block;vertical-align:-3px;margin:0 2px 0 0!important;border-radius:3px;filter:none!important;box-shadow:none!important;opacity:1!important}.vl-mark-text{font-weight:600;white-space:nowrap;color:inherit}div.vl-attr,aside.vl-attr{display:flex}';
  const api = { TIP, mark, icon, CSS, alive };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganLensBrand = api;
})(typeof self !== 'undefined' ? self : this);
