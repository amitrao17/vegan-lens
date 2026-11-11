// Vegan Lens partner offers (0.4.29). 100% on-device matching: the offer list ships with the extension (coupons.json) or
// comes from an optional list fetched identically for everyone; nothing about the page or the user is ever sent anywhere.
// Browser global (VeganOffers) + Node module. Offers never change a verdict: they are only rendered next to an existing dim.
(function (root) {
  'use strict';
  const CATS = ['milk', 'cheese', 'butter', 'yogurt', 'ice cream', 'eggs', 'honey', 'meat', 'fish', 'coats', 'shoes', 'bags', 'knitwear', 'cosmetics', 'condoms'];
  // [category, regex over chip topic / matched labels / fabricQuery / product text]
  const MAP = [
    ['condoms', /\bcondoms?\b/], ['cosmetics', /\b(?:cosmetics|lipsticks?|lip ?gloss|lip ?balm|mascara|eye ?shadow|blush|eyeliner|carmine|cochineal|beeswax|lanolin)\b/],
    ['ice cream', /\b(?:ice cream|gelato)\b/], ['yogurt', /\byog(?:h)?urt\b/], ['cheese', /\b(?:cheeses?|cheese board|brie|cheddar|mozzarella|parmesan)\b/],
    ['butter', /\b(?:butter|ghee)\b/], ['milk', /\b(?:milk|dairy|dairy\/eggs|cream|whey|casein|lactose)\b/], ['eggs', /\b(?:eggs?|mayo|mayonnaise)\b/],
    ['honey', /\b(?:honey|beeswax|royal jelly|propolis)\b/],
    ['fish', /\b(?:fish|seafood|salmon|tuna|shrimp|anchov(?:y|ies)|krill)\b/],
    ['meat', /\b(?:meat|beef|pork|bacon|poultry|chicken|turkey|steak|burgers?|brisket|bbq meat|ribs|wings|sausages?|ham|lamb|jerky|foie gras\/veal)\b/],
    ['shoes', /\b(?:boots?|booties?|shoes?|sneakers?|loafers?|heels?|sandals?|mules?|pumps?|footwear)\b/],
    ['bags', /\b(?:bags?|handbags?|totes?|wallets?|backpacks?|purses?|belts?)\b/],
    ['coats', /\b(?:coats?|jackets?|parkas?|puffers?|down(?:-alternative)?|fur|shearling|trench)\b/],
    ['knitwear', /\b(?:wool|cashmere|merino|alpaca|mohair|angora|sweaters?|knit(?:wear)?|scarf|scarves|cardigans?)\b/],
  ];
  // Categories for a dimmed item. parts: strings from the chip topic, matched labels, fabric query and the item title.
  function categoriesFor(...parts) {
    const t = parts.flat().filter(Boolean).join(' ').toLowerCase(); const out = [];
    for (const [c, re] of MAP) if (re.test(t)) out.push(c);
    return out;
  }
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const httpsUrl = u => { try { const x = new URL(u); return x.protocol === 'https:'; } catch (e) { return false; } };
  // Schema check for shipped and remote lists. Invalid entries are dropped, never repaired.
  function validOffer(o) {
    return !!o && typeof o === 'object' && typeof o.id === 'string' && o.id.length <= 64 && typeof o.brand === 'string' && o.brand.length <= 80 &&
      Array.isArray(o.categories) && o.categories.length > 0 && o.categories.every(c => CATS.includes(c)) &&
      typeof o.text === 'string' && o.text.length > 0 && o.text.length <= 80 && (o.code == null || (typeof o.code === 'string' && o.code.length <= 32)) &&
      httpsUrl(o.url) && DAY.test(o.expires || '') && httpsUrl(o.source) && typeof o.certified === 'string' && o.certified.length > 0 &&
      typeof o.example === 'boolean' && (o.ref == null || (typeof o.ref === 'string' && /^[\w.-]{1,40}=[\w.-]{1,80}$/.test(o.ref)));
  }
  function validate(list) { return Array.isArray(list) ? list.filter(validOffer) : []; }
  const todayStr = d => (d || new Date()).toISOString().slice(0, 10);
  // ctx: { categories, today 'YYYY-MM-DD', showExample, pageVegan, shownOnPage, enabled }
  function pick(list, ctx) {
    ctx = ctx || {};
    if (ctx.enabled === false || ctx.pageVegan || ctx.shownOnPage) return null; // max 1 per page; never on vegan pages
    const cats = new Set(ctx.categories || []); if (!cats.size) return null;
    const today = ctx.today || todayStr();
    return validate(list).find(o => (!o.example || ctx.showExample) && o.expires >= today && o.categories.some(c => cats.has(c))) || null;
  }
  // href built at click time; ref param only when the offer defines one.
  function hrefFor(o) { const u = new URL(o.url); if (o.ref) { const [k, v] = o.ref.split('='); u.searchParams.set(k, v); } return u.toString(); }
  const DISCLOSURE = 'Why this offer? Matched on your device to the item Vegan Lens flagged (no browsing data leaves your browser). ' +
    'Partners must be vegan-certified; some links may earn a commission that supports development and partner nonprofits.';

  // DOM: '🎟 <text>' link (+ code with copy button). onEvent(kind) is called with 'shown' / 'clicked'.
  function element(o, doc, onEvent) {
    doc = doc || document;
    const w = doc.createElement('span'); w.className = 'vl-offer';
    const a = doc.createElement('a'); a.className = 'vl-offer-link'; a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = '\uD83C\uDF9F ' + o.text + (o.example ? ' (example)' : ''); a.title = DISCLOSURE + (o.certified ? ' Certified: ' + o.certified + '.' : '') + ' Expires ' + o.expires + '.';
    a.addEventListener('click', e => { e.stopPropagation(); a.href = hrefFor(o); onEvent && onEvent('clicked'); }, true);
    w.append(a);
    if (o.code) {
      const c = doc.createElement('code'); c.className = 'vl-offer-code'; c.textContent = o.code;
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'vl-offer-copy'; b.textContent = 'Copy'; b.title = 'Copy code';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); try { navigator.clipboard.writeText(o.code).then(() => { b.textContent = 'Copied'; }); } catch (x) {} }, true);
      w.append(' ', c, ' ', b);
    }
    onEvent && onEvent('shown');
    return (typeof VeganLensBrand !== 'undefined' ? VeganLensBrand.mark : typeof require === 'function' ? require('./brand.js').mark : (e => e))(w, { compact: true, doc });
  }
  // Flip defaults here (popup, web.js and content.js all read this). showOffers: user-facing; showExampleOffers: dev only.
  const OFFER_DEFAULTS = { showOffers: true, showExampleOffers: false };
  const api = { OFFER_DEFAULTS, CATS, MAP, categoriesFor, validOffer, validate, pick, hrefFor, element, DISCLOSURE, todayStr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganOffers = api;
})(typeof self !== 'undefined' ? self : this);
