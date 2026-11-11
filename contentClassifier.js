// Vegan Lens general-web text classifier. Browser global (VeganContentClassifier) + Node module.
(function (root) {
  'use strict';
  // 0.4.52: rule data comes from rules/rules.json (see rules/rules.js); applyRules() re-runs when a signed list update lands.
  const Rules = (typeof module !== 'undefined' && module.exports) ? require('./rules/rules.js') : root.VeganRules;
  let ANIMAL, BOOST, VEGAN, ETHICS, PLANT_STEAK, MEAT_REJECT, STRONG_PAGE, FALSE_FRIENDS, COLOR_COSMETIC, HONEY_SHADE, THRESH, WEAR_CTX, BARE_LEATHER, PLANT_LEATHER, AMBIG, PLANT_UNIT, EXPLICIT_MEAT, STYLE_MATERIALS, CAUTION_WEB, HEADER_VEGAN, UNIT_VEGAN, EQUIPMENT_HEAD, DISCUSSION, FOOD_SHOW, MATERIAL_NAMES, ARTS_CTX, MATERIAL_PRODUCT, ARTS_MATERIAL, MIXED_VENUE, MIXED_GOODS;
  let PLANT_WORD, ANIMAL_RX, VEGAN_RX, ANIMAL_ALT, NEGATED;
  // [regex source, weight, label]
  // Plants that are commonly cut and cooked as "steaks" (0.4.12: kohlrabi, celery, king oyster, beet, zucchini, ...).
  // "Nobody wants meat anymore", "no one asks for meat", "tastes better than meat", "who needs meat": meat-rejection = vegan signal.
  // A word that marks a title as plant food (used with opts.pageVegan).
  // Unambiguous animal terms that still dim on a vegan page/channel (steak, burgers, "meat", cheese... are often plant recipes there).
  // Replace false friends before scoring.
  // 0.4.31: cosmetic shade names ('Black Honey', 'Honey Nude', 'honey blonde' hair dye) are colours, not honey. Only with a colour-cosmetic context.
  const shadeNeutralize = (t, beauty) => (beauty || COLOR_COSMETIC.test(t)) ? t.replace(HONEY_SHADE, ' shade ') : t;
  const rx = (src) => new RegExp('\\b(?:' + src + ')\\b', 'g');

  // Negated mentions ("needs no beef", "without chicken", "beef-free", "instead of pork") are a vegan signal, not a meat one.
  function count(re, t) { re.lastIndex = 0; const m = t.match(re); return m ? m.length : 0; }

  const Brands = (typeof module !== 'undefined' && module.exports) ? require('./veganBrands.js') : root.VeganBrands;

  // Community / subreddit / source label that is vegan-ish (r/vegan, r/AskVegans, c/PlantBasedDiet, r/WFPB...). exvegan(s) is not.
  function communityVegan(name) {
    const n = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!n || /exvegan|antivegan|nonvegan/.test(n)) return false;
    return /vegan|plantbased|wfpb/.test(n);
  }
  // 0.4.39: ambiguous foods (burger, sausage, nuggets, patty, meatballs, hot dogs, "meat") are commonly plant-based. When the same
  // unit (title + snippet + alt) names a plant protein or vegan word anywhere, they are not scored as animal. Explicit meats
  // (beef, bacon, pork, chicken, steak...) still score.
  // 0.4.40: bare "leather"/"suede" counts when the unit is about footwear, socks, apparel or accessories.
  // 0.4.41: plant-based / faux leathers are vegan (general qualifier before 'leather'); real-leather words elsewhere still score.
  // 0.4.59: a person's or channel's name is never evidence about food ('Jason Salmon Comedy', 'Kevin Bacon', 'Chef John Lamb').
  // Strips the unit's creator/channel/byline names (from the page) and 'Given-name Capitalized-surname' pairs before matching.
  const GIVEN = 'aaron|adam|alex|alexander|amanda|amy|andrew|andy|anna|anthony|ben|benjamin|bob|brandon|brian|carl|charles|charlie|chris|christopher|daniel|dan|dave|david|ed|emily|emma|eric|gary|george|greg|harry|henry|jake|james|jamie|jason|jeff|jennifer|jessica|jim|joe|john|jon|jonathan|jordan|josh|joshua|julia|justin|karen|kate|kevin|kyle|laura|lisa|luke|marc|matt|matthew|michael|mike|nate|nathan|nicholas|olivia|patrick|paul|pete|peter|phil|rachel|robert|ryan|sarah|scott|sean|steve|steven|tim|timothy|tom|tony|william|zach';
  const NAME_PAIR = new RegExp('\\b(?:' + GIVEN.split('|').map(g => g[0].toUpperCase() + g.slice(1)).join('|') + ')\\s+(?:[A-Z]\\.\\s+)?[A-Z][a-z]+\\b', 'g');
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function stripPeople(text, creators) {
    let t = String(text);
    for (const c of [].concat(creators || [])) { const n = String(c || '').replace(/^@/, '').trim(); if (n.length >= 3 && n.length <= 60) t = t.replace(new RegExp('@?' + esc(n).replace(/\s+/g, '\\s+'), 'gi'), ' _ '); }
    return t.replace(NAME_PAIR, ' _ ');
  }
  function classify(input, opts) {
    opts = opts || {};
    if (input && typeof input === 'object' && (communityVegan(input.community) || communityVegan(input.author))) opts = { ...opts, pageVegan: true, communityVegan: true };
    const thr = THRESH[opts.sensitivity] || THRESH.med;
    const parts = typeof input === 'string' ? { headline: input } : (input || {});
    // headline weighs double vs snippet/alt
    const segs = [[parts.headline, 2, 'title'], [parts.tags, 1.5, 'tag'], [parts.snippet, 1, 'snippet'], [parts.alt, 0.75, 'alt']].filter(s => s[0]).map(s => [stripPeople(s[0], parts.creators), s[1], s[2]]).filter(s => String(s[0]).replace(/[\s_]+/g, '')); // 0.4.45 tags: category chips (strong)
    let neg = 0, pos = 0, ethics = 0; const reasons = [], about = {};
    let veganHits = 0, headNeg = 0, rejects = 0, plantWord = false, headText = ''; const matches = [];
    const unitText = segs.map(x => String(x[0]).toLowerCase()).join(' ');
    const wearCtx = WEAR_CTX.test(unitText);
    // 0.4.64: fur/leather need positive material evidence. In a music/arts/game unit with no product/fashion context,
    // bare 'fur'/'leather'/'suede' tokens are not evidence (e.g. 'Fur Elise ... Ukulele TAB').
    const artsOnly = ARTS_CTX && ARTS_CTX.test(unitText) && !(MATERIAL_PRODUCT && MATERIAL_PRODUCT.test(unitText.replace(MATERIAL_NAMES || /$^/, ' ')));
    const plantUnit = PLANT_UNIT.test(unitText) && !/\b(?:exvegan|ex-vegan|antivegan|anti-vegan|non-?vegan)\b/.test(unitText);
    for (const [rawText, segW, where] of segs) {
      let t = ' ' + String(rawText).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u2010-\u2015]/g, '-') + ' ';
      // "Always vegan" list: strong positive; strip the phrase so e.g. "Daiya cheese" isn't scored as dairy.
      if (Brands) for (const e of Brands.match(rawText, opts)) {
        pos += (e.user ? 4 : 3) * segW; reasons.push('+' + Brands.label(e));
        const words = Brands.norm(e.name).trim().split(' ').map(w => w.split('').join("['\u2019]?"));
        t = t.replace(new RegExp('\\b' + words.join('[^a-z0-9]+') + '\\b', 'g'), ' _ ');
      }
      // 0.4.51 vegan picks (vegan product from a mostly non-vegan brand): strong positive; strip product words ("mayo", "non-dairy") so they don't score.
      const pk = Brands && Brands.pick && Brands.pick(rawText);
      if (pk) { pos += 3 * segW; reasons.push('+vegan pick: ' + pk.brand + ' ' + pk.line); t = t.replace(/\b(?:mayo(?:nnaise)?|ice cream|dairy|milk|cream)\b/g, ' _ '); }
      t = shadeNeutralize(t, opts.beauty);
      t = t.replace(PLANT_LEATHER, () => { veganHits += 1; return ' _ '; });
      if (plantUnit) t = t.replace(AMBIG, m => (EXPLICIT_MEAT.test(m) ? m : (veganHits += 0.34, ' _ ')));
      for (const ff of FALSE_FRIENDS) { if (ff.test(t)) { ff.lastIndex = 0; t = t.replace(ff, m => { veganHits += /vegan|plant|cauliflower|cabbage|celery|celeriac|kohlrabi|beet|zucchini|courgette|squash|carrot|eggplant|aubergine|portobello|tempeh|garden|tofu|mushroom|beyond|impossible|seitan|jackfruit|oat|soy|almond|coconut|meatless|faux|pleather/.test(m) ? 1 : 0; return ' _ '; }); } ff.lastIndex = 0; }
      // 0.4.62 noun-head rule: an animal word modifying equipment/supplies ('poultry fencing', 'chicken wire', 'fish tank filter',
      // 'cattle panel', 'pig ear tag') is not evidence; the head noun is the thing sold. Food heads (breast, fillets...) are excluded.
      if (MATERIAL_NAMES) t = t.replace(MATERIAL_NAMES, ' _ '); // 0.4.64: 'Für Elise', 'Fur Affinity', German 'für'
      if (artsOnly && ARTS_MATERIAL) t = t.replace(ARTS_MATERIAL, ' _ ');
      if (EQUIPMENT_HEAD) { EQUIPMENT_HEAD.lastIndex = 0; t = t.replace(EQUIPMENT_HEAD, ' _ '); }
      t = t.replace(MEAT_REJECT, () => { veganHits += 1; rejects++; return ' _ '; });
      t = t.replace(new RegExp('["\u201c\u201d\'](?:' + ANIMAL_ALT + ')\\b[^"\u201c\u201d]{0,25}["\u201c\u201d\']', 'g'), () => { veganHits += 1; return ' _ '; });
      t = t.replace(NEGATED, () => { veganHits += 1; return ' _ '; });
      if (where === 'title') { headText = t; if (PLANT_WORD.test(t)) plantWord = true; }
      for (const [re, w, l] of VEGAN_RX) { const n = count(re, t); if (n) { pos += w * segW * Math.min(n, 2); reasons.push('+' + l); } }
      const e = count(ETHICS, t); if (e) { ethics += e; reasons.push('+ethics/welfare framing'); }
      let segNeg = 0;
      for (const [re, w, l] of ANIMAL_RX) { const n = count(re, t); if (n) { re.lastIndex = 0; const m = re.exec(t); re.lastIndex = 0;
        matches.push({ term: m[0], label: l, where, snippet: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim() }); segNeg += w * Math.min(n, 2); about[l] = (about[l] || 0) + w * n; reasons.push('-' + l); } }
      if (wearCtx && !matches.some(m => m.where === where && m.label === 'animal fabrics' && /leather|suede|nubuck/.test(m.term))) { const n = count(BARE_LEATHER, t); if (n) { BARE_LEATHER.lastIndex = 0; const m = BARE_LEATHER.exec(t); BARE_LEATHER.lastIndex = 0;
        matches.push({ term: m[0], label: 'animal fabrics', where, snippet: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim() }); segNeg += 2.5 * Math.min(n, 2); about['animal fabrics'] = (about['animal fabrics'] || 0) + 2.5 * n; reasons.push('-animal fabrics'); } }
      if (segNeg) { const b = count(BOOST, t); if (b) { segNeg *= 1 + 0.3 * Math.min(b, 3); reasons.push('-context boost'); } }
      if (segW === 2) headNeg = segNeg;
      neg += segNeg * segW / 2;
    }
    pos += veganHits * 3;
    if (veganHits) reasons.push('+plant-based alternative');
    // Ethics / activism framing neutralises the animal terms entirely and leans positive.
    if (ethics) { pos += 3 * ethics; neg *= 0.1; }
    // Meat-rejection phrasing ("nobody wants meat anymore! These steaks..."): the remaining animal words describe the plant dish.
    if (rejects) neg *= 0.3;
    const score = Math.round((pos - neg) * 100) / 100;
    let verdict = 'neutral';
    // requireHeadline (YouTube): hidden/secondary text alone (description, alt) can't make a card non-vegan.
    if (opts.requireHeadline && !headNeg) neg = 0;
    const headStrong = opts.sensitivity !== 'low' && matches.some(m => (m.where === 'title' || m.where === 'tag') && (!/^(?:dairy\/eggs|honey)$/.test(m.label) || /^(?:(?:grass|butter|goat|sheep|cow|skim|whole)?milk|butter|eggs?|mayo|mayonnaise|honey|ghee|yogurt|aioli)$/.test(m.term)) && !/^(?:turkey|duck|cod|bass|sole|ham|crab|wings?|nuggets?|jerky|bacon bits)$/.test(m.term) && (ANIMAL.find(a => a[2] === m.label) || [0, 0])[1] >= 1.5);
    const strongHead = matches.some(m => m.where === 'title' && STRONG_PAGE.test(m.label));
    if (opts.communityVegan) verdict = 'vegan'; // vegan community: never dim
    else if (opts.pageVegan) { if (pos >= 3) verdict = 'vegan'; } // vegan page/channel: never dim; meaty words there mean plant versions
    else if ((neg >= thr || (headStrong && !rejects)) && neg > pos) verdict = 'nonvegan';
    else if (pos >= 3 && pos > neg) verdict = 'vegan';
    // 0.4.63 discussion rule: a title that asks/debates something about eating animal products (question form, debate,
    // ethics, religion/spiritual context) gets a light non-dimming label; titles that show the food itself (recipe, cooking
    // verb, mukbang/review/best, product/restaurant/deal, 'how to' + cooking verb) keep the normal verdict.
    if (verdict === 'nonvegan' && DISCUSSION && parts.headline) { const h = String(stripPeople(parts.headline, parts.creators)).replace(/[\u2018\u2019]/g, "'");
      if (DISCUSSION.test(h) && !(FOOD_SHOW && FOOD_SHOW.test(h))) { verdict = 'discussion'; reasons.push('discussion title'); } }
    // 0.4.65 mixed-venue rule: a market/fair/co-op title with no animal word of its own, whose unit also lists plant goods
    // (produce, baked goods, flowers...), is a mixed venue; animal words in its vendor list are incidental. Light label, no hide.
    // Titles naming the animal product ('Fresh Seafood Market', 'Buy Fresh Fish') score in the title and keep the normal verdict.
    let mixed = false;
    if (verdict === 'nonvegan' && MIXED_VENUE && MIXED_GOODS && parts.headline && !headNeg && MIXED_VENUE.test(headText) && MIXED_GOODS.test(unitText)) { verdict = 'discussion'; mixed = true; reasons.push('mixed venue listing'); }
    const topic = Object.entries(about).sort((a, b) => b[1] - a[1])[0];
    return { verdict, score, reasons: [...new Set(reasons)], topic: topic ? topic[0] : null, about, matches, ...(mixed ? { mixed: true } : {}) };
  }

  // 0.4.28 shopping cautions (never dims): cosmetics that often contain carmine/beeswax/lanolin; latex condoms (casein).
  // 0.4.50: well-known styles whose standard build is animal-based, each checked on the brand's own product page (2026-10-30).
  // Caution-level only ("likely"); explicit material words in the text still decide on their own.
  // 0.4.53: on the brand's own site (opts.host) the brand name is implied (tiles say just 'Tasman II').
  const onDomain = (h, d) => !!h && !!d && (h === d || h.endsWith('.' + d));
  const styleMaterial = (t, host) => STYLE_MATERIALS.find(s => (s.brandRe.test(t) || onDomain(String(host || '').toLowerCase(), s.domain)) && s.re.test(t) && !/\b(?:vegan|faux|synthetic)\b/i.test(t)) || null;
  function shopCaution(text, opts) {
    const t = String(text || ''); if (!t) return null;
    if (/\b(?:vegan|plant[- ]based|casein[- ]free|cruelty[- ]free & vegan)\b/i.test(t)) return null;
    if (Brands && Brands.match(t, opts || {}).length) return null;
    for (const [re, kind, msg] of CAUTION_WEB) if (re.test(t)) return { kind, text: msg };
    const st = styleMaterial(t, (opts || {}).host); if (st) return { kind: st.material, text: 'likely not vegan: ' + st.material + ' (' + st.brand + ' ' + st.style + ')', source: st.source };
    return null;
  }
  // lowest weight per animal label (for ad weak-word checks)
  const LABEL_W = {};
  // Page / channel context (0.4.12). header: channel name, tagline, description, or a page's h1/top header text.
  // verdicts: classify() verdicts of the visible titles on the page (computed without pageVegan).
  // "Try:" query for animal-fabric / leather matches; null otherwise.
  function fabricQuery(r) {
    const m = (r && r.matches || []).find(x => x.where === 'title' && /^(?:animal fabrics|fur\/leather)$/.test(x.label)) || (r && r.matches || []).find(x => /^(?:animal fabrics|fur\/leather)$/.test(x.label));
    if (!m) return null;
    const t = String(m.term || '').toLowerCase().trim();
    const SW = (typeof root !== 'undefined' && root.VeganSwaps) || (typeof require === 'function' ? require('./swaps.js') : null);
    const hit = SW && SW.swapForText(t); if (hit) return hit.query; // 0.4.44: shared swap map first
    if (/^(?:leather|suede)\b/.test(t)) return 'vegan ' + t;
    if (/^(?:fur|mink|shearling)/.test(t)) return 'faux fur ' + (t.replace(/^(?:fur|mink|shearling) ?/, '') || 'coats').replace(/^coat$/, 'coats');
    const noun = t.replace(/^(?:wool|cashmere|merino|alpaca|mohair|angora|goose down|duck down|down|silk)\s*/, '').trim();
    if (/^(?:goose |duck )?down/.test(t)) return 'vegan down-alternative ' + (noun || 'jackets');
    if (/^silk/.test(t)) return 'vegan silk-alternative ' + (noun || 'sheets');
    return 'vegan ' + (noun && noun !== 'blend' ? noun : 'wool-free knitwear');
  }
  function pageContext(ctx) {
    const c = ctx || {}, v = (c.verdicts || []), nVegan = v.filter(x => x === 'vegan').length;
    if (c.header && HEADER_VEGAN.test(String(c.header))) return { vegan: true, why: 'header says vegan/plant-based' };
    if (v.length && nVegan >= 3 && nVegan / v.length >= 0.2) return { vegan: true, why: nVegan + '/' + v.length + ' titles vegan' };
    return { vegan: false, why: '' };
  }
  // 0.4.33 image blur by alt text. Reddit alts start "r/BBQ - <title>": the subreddit name is not about the photo.
  // inUndimmedUnit: the image sits in a classified unit that was NOT dimmed -> blur only on a high-confidence alt.
  const ALT_HIGH = -3;
  const cleanAlt = t => String(t || '').replace(/^\s*(?:r|u)\/[\w-]+\s*[-\u2013\u2014:|]\s*/i, '').replace(/^(?:may be an? )?(?:image|photo|picture) of /i, '');
  function altBlur(alt, opts, inUndimmedUnit) {
    const t = cleanAlt(alt); if (t.length < 3) return { blur: false, r: null, why: 'short' };
    const r = classify(t, opts || {});
    if (r.verdict !== 'nonvegan') return { blur: false, r, why: 'not-nonvegan' };
    if (inUndimmedUnit && r.score > ALT_HIGH) return { blur: false, r, why: 'low-confidence-in-undimmed-unit' };
    return { blur: true, r, why: inUndimmedUnit ? 'high-confidence' : 'alt' };
  }
  // 0.4.46: is the nearest content unit (an email body, article, post) vegan overall? Then none of its images blur, whatever
  // their alt says ('Chicken Filets', 'tonkotsu pork ramen' in a plant-based newsletter). Vegan if it classifies vegan, or names
  // vegan/plant-based at least twice (or once with another plant protein word) with no anti-vegan wording.
  function unitVegan(text, opts) {
    const t = String(text || '').replace(/\s+/g, ' ').slice(0, 6000); if (t.length < 20) return false;
    if (/\b(?:ex-?vegan|anti-?vegan|non-?vegan|not vegan)\b/i.test(t)) return false;
    const hits = (t.match(UNIT_VEGAN) || []).length;
    if (hits >= 2 || (hits && PLANT_UNIT.test(t.toLowerCase().replace(UNIT_VEGAN, ' ')))) return true;
    return classify(t.slice(0, 1500), opts || {}).verdict === 'vegan';
  }
  function applyRules(D) {
    ({ ANIMAL, BOOST, VEGAN, ETHICS, PLANT_STEAK, MEAT_REJECT, STRONG_PAGE, FALSE_FRIENDS, COLOR_COSMETIC, HONEY_SHADE, THRESH, WEAR_CTX, BARE_LEATHER, PLANT_LEATHER, AMBIG, PLANT_UNIT, EXPLICIT_MEAT, STYLE_MATERIALS, CAUTION_WEB, HEADER_VEGAN, UNIT_VEGAN, EQUIPMENT_HEAD, DISCUSSION, FOOD_SHOW, MATERIAL_NAMES, ARTS_CTX, MATERIAL_PRODUCT, ARTS_MATERIAL, MIXED_VENUE, MIXED_GOODS } = D.classifier);
    PLANT_WORD = new RegExp('\\b(?:' + PLANT_STEAK + '|vegan|plant|vegetables?|veg|lentils?|chickpeas?|beans?|tofu|garden)\\b');
    ANIMAL_RX = ANIMAL.map(([s, w, l]) => [rx(s), w, l]);
    VEGAN_RX = VEGAN.map(([s, w, l]) => [rx(s), w, l]);
    ANIMAL_ALT = ANIMAL.map(a => a[0]).join('|');
    NEGATED = new RegExp('\\b(?:(?:needs?|need|with|has|have|had|contains?|zero|uses?|using)\\s+no|no|without|w/o|minus|skip(?:ping)?\\s+the|ditch(?:ing)?\\s+the|forget(?:\\s+about)?|instead\\s+of|replac(?:e|es|ing)(?:\\s+the)?|swap(?:ping)?\\s+(?:out\\s+)?(?:the\\s+)?|better\\s+than|not)\\s+(?:any\\s+|the\\s+|real\\s+)?(?:' + ANIMAL_ALT + ')\\b|\\b(?:' + ANIMAL_ALT + ')[- ](?:free|less)\\b', 'g');
    for (const k of Object.keys(LABEL_W)) delete LABEL_W[k]; for (const [, w, l] of ANIMAL) LABEL_W[l] = Math.min(LABEL_W[l] || 9, w);
    try { Object.assign(api, { CAUTION_WEB, STYLE_MATERIALS, HEADER_VEGAN, THRESH }); } catch (e) { /* first run: api not built yet */ }
  }
  applyRules(Rules.data()); Rules.onChange(applyRules);
  const api = { stripPeople, unitVegan, altBlur, cleanAlt, ALT_HIGH, classify, shopCaution, CAUTION_WEB, STYLE_MATERIALS, communityVegan, pageContext, fabricQuery, HEADER_VEGAN, THRESH, LABEL_W };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganContentClassifier = api;
})(typeof self !== 'undefined' ? self : this);
