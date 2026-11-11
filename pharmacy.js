// Vegan Lens pharmacy caution (0.4.14): Walgreens, CVS, GoodRx, Amazon Pharmacy.
// Product/drug pages get a caution chip when the text names a commonly animal-derived ingredient. Nothing is hidden;
// the chip never advises stopping a medication. On Walgreens/CVS search results, supplement tiles that look non-vegan
// are dimmed (like Amazon), never hidden. Browser global (VeganPharmacy) + Node module.
(function (root) {
  'use strict';
  const PHARMACY_HOST = /(^|\.)(?:walgreens\.com|cvs\.com|goodrx\.com|pharmacy\.amazon\.com|health\.amazon\.com)$/i;
  const SEARCH_HOST = /(^|\.)(?:walgreens\.com|cvs\.com)$/i;
  // [label, regex source]; a match followed by "-free"/" free", or preceded by "no"/"without"/"free of", is ignored.
  const RULES = [
    ['gelatin (capsule/softgel)', 'gelatine?'],
    ['lactose', 'lactose(?: monohydrate| anhydrous)?'],
    ["shellac / confectioner's glaze", "shellac|confectioner'?s glaze|pharmaceutical glaze"],
    ['lanolin', 'lanolin|wool (?:fat|wax|alcohols?)|adeps lanae'],
    ['carmine', 'carmine|cochineal|carminic acid|ci ?75470|natural red 4'],
    ['stearic acid / magnesium stearate (animal-derived)', '(?:animal[- ](?:derived|sourced?)|bovine|porcine|tallow)[^.;\\n]{0,40}(?:stearic acid|(?:magnesium|calcium) stearate)|(?:stearic acid|(?:magnesium|calcium) stearate)[^.;\\n]{0,40}(?:from|of|derived from|source:?)\\s*(?:animal|bovine|porcine|tallow|beef|pork)'],
    ['fish / krill oil', 'fish oil|krill(?: oil)?|cod liver oil|anchovy oil|salmon oil|menhaden'],
    ['bovine / porcine', 'bovine|porcine'],
    ['honey', 'honey'], ['beeswax', 'beeswax|cera alba'], ['chitosan', 'chitosan'],
    ['vitamin D3 (often from lanolin)', 'vitamin d3|cholecalciferol'],
  ].map(([l, s]) => [l, new RegExp('\\b(?:' + s + ')\\b', 'gi')]);
  const NEGATED_BEFORE = /\b(?:no|non|without|free of|free from|zero|not)\s+(?:added\s+)?$/i;
  const FREE_AFTER = /^(?:-|\s)?free\b/i;
  const D3_VEGAN = /\b(?:vegan|lichen|plant[- ]based|algae)\b[^.\n]{0,40}\b(?:vitamin d3|d3|cholecalciferol)\b|\b(?:vitamin d3|d3|cholecalciferol)\b[^.\n]{0,40}\b(?:vegan|lichen|plant[- ]based|algae)\b/i;
  function flags(text) {
    const t = String(text || '').replace(/[\u2018\u2019]/g, "'").replace(/[\u2010-\u2015]/g, '-');
    const out = [];
    for (const [label, re] of RULES) {
      re.lastIndex = 0; let m, hit = false;
      while ((m = re.exec(t))) {
        const before = t.slice(Math.max(0, m.index - 20), m.index), after = t.slice(m.index + m[0].length, m.index + m[0].length + 6);
        if (NEGATED_BEFORE.test(before) || FREE_AFTER.test(after)) continue;
        hit = true; break;
      }
      re.lastIndex = 0;
      if (!hit) continue;
      if (/^vitamin D3/.test(label) && D3_VEGAN.test(t)) continue;
      out.push(label);
    }
    return out;
  }
  const chipText = labels => 'May contain animal-derived ingredients: ' + labels.join(', ') + ' \u2014 ask your pharmacist';
  const SUPPLEMENT = /\b(?:vitamins?|supplements?|multivitamins?|soft ?gels?|capsules?|gummies|gummy|omega|fish oil|krill|collagen|probiotics?|protein powder|glucosamine|chondroitin|biotin|d3|calcium|magnesium|zinc|melatonin|elderberry|electrolytes?)\b/i;
  const isSupplement = title => SUPPLEMENT.test(String(title || ''));
  // Walgreens: /store/c/<slug>/ID=prod123-product ; CVS: /shop/<slug>-prodid-123 ; generic /product/
  const PRODUCT_HREF = /\/store\/c\/[^?#]*ID=(?:prod|sku)|-prodid-\d+|\/product\/|\/p\/\d+/i;
  const isProductHref = h => PRODUCT_HREF.test(String(h || ''));
  const PRICE = /\$\s?\d/;
  const hrefsIn = el => new Set([...el.querySelectorAll('a[href]')].map(x => x.getAttribute('href')).filter(isProductHref).map(h => h.replace(/[?#].*$/, '')));
  function tileOf(a) {
    let el = a.parentElement, best = null;
    for (let i = 0; el && i < 7; i++, el = el.parentElement) {
      if (/^(?:body|main|html)$/i.test(el.tagName)) break;
      if (hrefsIn(el).size > 1) break;
      if (PRICE.test(el.textContent || '')) { best = el; if (/^(?:li|article)$/i.test(el.tagName)) break; }
    }
    return best;
  }
  function findTiles(doc) {
    const out = [];
    for (const a of doc.querySelectorAll('a[href]')) { if (!isProductHref(a.getAttribute('href'))) continue; const t = tileOf(a); if (t && !out.includes(t)) out.push(t); }
    return out.filter(t => !out.some(o => o !== t && o.contains(t)));
  }
  function titleOf(tile) {
    const n = tile.querySelector('h2, h3, h4') || [...tile.querySelectorAll('a[href]')].find(a => isProductHref(a.getAttribute('href')));
    return String((n && (n.getAttribute('aria-label') || n.textContent)) || '').replace(/\s+/g, ' ').trim();
  }
  function pageText(doc) {
    const main = doc.querySelector('main') || doc.body || doc.documentElement;
    return String((main && (main.innerText || main.textContent)) || '').slice(0, 60000);
  }
  const api = { PHARMACY_HOST, SEARCH_HOST, RULES, flags, chipText, isSupplement, isProductHref, findTiles, titleOf, pageText };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.VeganPharmacy = api;
  /*WIRING*/
})(typeof self !== 'undefined' ? self : this);
