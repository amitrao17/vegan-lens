// Vegan Lens "Vegan swaps": curated, local suggestions for non-vegan items. Browser global (VeganSwaps) + Node module.
// Only generic Amazon SEARCH links are built (never ASINs, prices or product claims).
// Brand queries use only brands from veganBrands.js (whole-line vegan).
(function (root) {
  'use strict';
  // Rules in priority order (most specific first). `terms`: classifier matched labels (base label before " (")
  // that trigger the rule; `text`: optional regex the item title must also match.
  const RULES = [
    { id: 'whey-protein', terms: ['whey', 'casein', 'milk'], text: /\bprotein\b/i, label: 'plant protein powder', query: 'vegan protein powder' },
    { id: 'ice-cream', terms: ['cream', 'milk', 'dairy'], text: /\bice[- ]?cream\b|\bgelato\b/i, label: 'dairy-free ice cream', query: 'So Delicious Dairy Free ice cream' },
    { id: 'yogurt', terms: ['milk', 'dairy', 'cream'], text: /\by[oa]gh?urt\b/i, label: 'plant-based yogurt', query: 'vegan yogurt' },
    { id: 'mayo', terms: ['egg'], text: /\bmayo(?:nnaise)?\b|\baioli\b/i, label: 'egg-free mayo', query: 'Vegenaise vegan mayo' },
    { id: 'gummies', terms: ['gelatin'], label: 'gelatin-free gummies', query: 'vegan gummies' },
    { id: 'whey', terms: ['whey', 'casein'], label: 'plant protein powder', query: 'vegan protein powder' },
    { id: 'cheese', terms: ['cheese'], label: 'plant-based cheese', query: 'Violife cheese' },
    { id: 'butter', terms: ['butter', 'ghee'], label: 'plant butter', query: 'Earth Balance vegan butter' },
    { id: 'burger', terms: ['beef', 'meat'], text: /\bburgers?\b|\bpatt(?:y|ies)\b|\bground beef\b/i, label: 'plant-based burger', query: 'Beyond Burger' },
    { id: 'sausage', terms: ['pork', 'meat', 'beef', 'chicken'], text: /\bsausages?\b|\bbratwurst\b|\bhot dogs?\b/i, label: 'plant-based sausage', query: 'Field Roast sausage' },
    { id: 'bacon', terms: ['bacon'], label: 'plant-based bacon', query: 'vegan bacon' },
    { id: 'deli', terms: ['pork', 'meat'], text: /\bham\b|\bdeli\b|\bturkey\b|\bslices?\b/i, label: 'plant-based deli slices', query: 'Tofurky deli slices' },
    { id: 'chicken', terms: ['chicken'], label: 'plant-based chicken', query: 'Gardein chicken' },
    { id: 'beef', terms: ['beef'], label: 'plant-based meat', query: 'Beyond Meat' },
    { id: 'tuna', terms: ['fish'], text: /\btuna\b/i, label: 'plant-based tuna', query: 'vegan tuna' },
    { id: 'salmon', terms: ['fish'], text: /\bsalmon\b/i, label: 'plant-based salmon', query: 'vegan salmon' },
    { id: 'fish', terms: ['fish', 'anchovy'], label: 'plant-based seafood', query: 'vegan fish' },
    { id: 'shrimp', terms: ['shrimp'], label: 'plant-based shrimp', query: 'vegan shrimp' },
    { id: 'meat', terms: ['meat', 'pork'], label: 'plant-based meat', query: 'vegan meat' },
    { id: 'egg', terms: ['egg', 'albumin'], label: 'plant-based egg', query: 'Just Egg' },
    { id: 'milk', terms: ['milk', 'dairy', 'lactose', 'cream'], label: 'oat or soy milk', query: 'Oatly oat milk' },
    { id: 'honey', terms: ['honey'], label: 'maple or agave syrup', query: 'vegan honey alternative' },
    { id: 'leather-shoes', terms: ['leather', 'suede', 'nubuck'], text: /\b(?:shoes?|boots?|sneakers?|loafers?|sandals?|heels|oxfords?)\b/i, label: 'faux leather shoes', query: 'vegan leather shoes' },
    { id: 'leather-bag', terms: ['leather', 'suede', 'nubuck'], text: /\b(?:bags?|purses?|handbags?|totes?|wallets?|backpacks?)\b/i, label: 'faux leather bag', query: 'vegan leather bag' },
    { id: 'leather-belt', terms: ['leather', 'suede'], text: /\bbelts?\b/i, label: 'faux leather belt', query: 'vegan leather belt' },
    { id: 'leather-jacket', terms: ['leather', 'suede'], text: /\bjackets?\b|\bcoats?\b/i, label: 'faux leather jacket', query: 'vegan leather jacket' },
    { id: 'leather', terms: ['leather', 'suede', 'nubuck'], label: 'faux leather', query: 'vegan leather' },
    { id: 'down-comforter', terms: ['down feathers', 'down', 'feather'], text: /\bcomforters?\b|\bduvets?\b|\bpillows?\b|\bquilts?\b/i, label: 'down-alternative bedding', query: 'down alternative comforter' },
    { id: 'down', terms: ['down feathers', 'down', 'feather'], label: 'synthetic-fill jacket', query: 'vegan down alternative jacket' },
    { id: 'wool', terms: ['wool', 'merino', 'cashmere', 'alpaca', 'mohair', 'angora'], label: 'cotton or acrylic knit', query: 'vegan sweater cotton' },
    { id: 'silk', terms: ['silk'], label: 'satin or Tencel alternative', query: 'vegan silk alternative' },
  ];
  const base = m => String(m || '').replace(/\s*\(.*$/, '').trim().toLowerCase();

  // matched: classifier `matched` labels; text: item title (+ details). Returns {id,label,query} or null.
  function pickSwap(matched, text) {
    const terms = new Set((matched || []).map(base));
    if (!terms.size) return null;
    const t = String(text || '');
    for (const r of RULES) if (r.terms.some(x => terms.has(x)) && (!r.text || r.text.test(t))) return { id: r.id, label: r.label, query: r.query };
    return null;
  }
  // Generic Amazon search on the user's own Amazon origin.
  function swapUrl(origin, query) {
    let o = '';
    try { const u = new URL(origin); if (/^https?:$/.test(u.protocol) && /(^|\.)amazon\.[a-z.]+$/.test(u.hostname)) o = u.origin; } catch (e) {}
    return (o || 'https://www.amazon.com') + '/s?k=' + encodeURIComponent(query);
  }
  const api = { RULES, pickSwap, swapUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganSwaps = api;
})(typeof self !== 'undefined' ? self : this);
