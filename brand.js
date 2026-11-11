// Vegan Lens attribution helper (0.4.32). Every element Vegan Lens adds to a page goes through mark(): it gets the 16px
// extension icon, the words "Vegan Lens" (as visible text, or as aria-label/title where space is tight) and the tooltip
// "Added by Vegan Lens extension". Browser global (VeganLensBrand) + Node module.
(function (root) {
  'use strict';
  const TIP = 'Added by Vegan Lens extension';
  function iconUrl() { try { return chrome.runtime.getURL('icons/icon16.png'); } catch (e) { return ''; } }
  function icon(doc) {
    const i = doc.createElement('img');
    i.setAttribute('src', iconUrl()); i.setAttribute('alt', ''); i.setAttribute('aria-hidden', 'true');
    i.setAttribute('width', '16'); i.setAttribute('height', '16'); i.setAttribute('draggable', 'false');
    i.className = 'vl-mark-icon'; return i;
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
  const api = { TIP, mark, icon, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganLensBrand = api;
})(typeof self !== 'undefined' ? self : this);
