// Vegan Lens classifier. Works as a browser global (VeganClassifier) and a Node module.
(function (root) {
  'use strict';
  // [label, regex source]; "lenient" items are ignored in lenient mode.
  const NEGATIVE = [
    ['milk', 'milk(?:s)?|milk ?powder|milk ?fat|buttermilk'], ['dairy', 'dairy'],
    ['whey', 'whey'], ['casein', 'casein(?:ate)?s?|caseinate'], ['butter', 'butter'],
    ['cheese', 'cheeses?|parmesan|cheddar|mozzarella'], ['cream', 'cream'], ['egg', 'eggs?|egg ?whites?|egg ?yolks?'],
    ['gelatin', 'gelatine?'], ['collagen', 'collagen'], ['carmine', 'carmine'], ['cochineal', 'cochineal'],
    ['lanolin', 'lanolin'], ['shellac', 'shellac|confectioner\'?s glaze'], ['fish', 'fish|fish ?oil|salmon|tuna|cod liver'],
    ['anchovy', 'anchov(?:y|ies)'], ['shrimp', 'shrimp|crab|lobster|shellfish|oyster'], ['chicken', 'chicken'],
    ['beef', 'beef'], ['pork', 'pork|ham'], ['bacon', 'bacon'], ['lard', 'lard'], ['tallow', 'tallow'],
    ['meat', 'meat|turkey|lamb|venison|jerky'], ['leather', 'leather|suede'], ['wool', 'wool|merino|cashmere|alpaca'],
    ['silk', 'silk'], ['down feathers', 'down(?: feathers?| fill| filled| comforter| jacket)|goose down|duck down|feathers?'],
    ['bone char', 'bone ?char|bone ?meal'], ['isinglass', 'isinglass'], ['albumin', 'albumi?ne?'],
    ['lactose', 'lactose'], ['ghee', 'ghee'], ['lactic casein', 'lactalbumin|lactoglobulin'],
    ['pepsin', 'pepsin|rennet'], ['l-cysteine', 'l-cysteine'], ['vitamin D3 (lanolin)', 'vitamin d3|cholecalciferol'],
    // non-food / hidden animal materials (instruments, brushes, crafts, tableware)
    ['horsehair', 'horse ?hair|horsetail hair|mongolian (?:white )?hair|(?:bleached|unbleached|natural|real|genuine) (?:bow )?hair'],
    ['boar bristle', 'boar(?: hair)? bristles?|boar hair|badger (?:hair|bristles?)|hog bristles?|sable (?:hair|brush(?:es)?)|squirrel hair|goat hair|pony hair|kolinsky'],
    ['bone', 'bone (?:nut|saddle|bridge pins?|pins|inlay|handle|china|beads?|comb)|(?:nut|saddle) (?:of|in) bone|bone china'],
    ['gut strings', '(?:sheep|natural|lamb)? ?gut strings?|catgut'],
    ['hide glue', 'hide glue|animal glue|hoof glue'],
    ['animal skin', 'calf ?skin|goat ?skin|lamb ?skin|sheep ?skin|cow ?hide|rawhide|deer ?skin|snake ?skin|python skin|(?:calf|goat|animal) (?:skin )?(?:drum ?)?heads?'],
    ['shearling', 'shearling'], ['mohair', 'mohair|angora'], ['fur', 'real fur|genuine fur|mink|fox fur|rabbit fur|raccoon fur|fur (?:trim|trimmed|coat|collar|hood|lined)'],
    ['mother-of-pearl', 'mother[- ]of[- ]pearl|abalone|nacre|pearl inlay'],
    ['ivory', 'ivory (?:nut|saddle|inlay|keys|carving|piano keys)|(?:genuine|real|antique|fossil|mammoth|walrus) ivory|tusks?|elephant ivory'],
    ['casein paint', 'casein paints?|milk paint'],
    // supplements
    ['krill', 'krill(?: oil)?'], ['bone broth', 'bone broth'], ['glucosamine', 'glucosamine'], ['chondroitin', 'chondroitin'],
    ['colostrum', 'colostrum'], ['organ meat', 'desiccated (?:beef )?(?:liver|organs?|heart|kidney|thymus|pancreas)|(?:beef|bovine) (?:liver|organs?)|grass[- ]fed organs?'],
    ['antler', '(?:elk|deer) antler(?: velvet)?|antler velvet'], ['chitosan', 'chitosan'], ['softgel (gelatin)', 'soft ?gels?'],
    ['bovine/marine', 'bovine|marine collagen|fish collagen|porcine'],
    // cosmetics & hygiene
    ['carmine', 'ci ?75470|crimson lake|natural red 4'], ['squalene (shark)', 'squalene|shark (?:liver )?(?:oil|squalane)'],
    ['keratin', 'keratin'], ['elastin', 'elastin'], ['guanine', 'guanine|fish scales?'], ['tallow', 'sodium tallowate|tallowate'],
    ['animal stearic acid', 'animal[- ](?:derived )?stearic acid|stearic acid \\(animal|stearic acid from animal'],
    ['snail mucin', 'snail (?:mucin|secretion|filtrate)|snail secretion filtrate'], ['silk', 'sericin|silk (?:powder|protein|peptide)s?'],
    ['ambergris', 'ambergris'], ['musk', 'musk(?: oil| pod)?|deer musk'], ['civet', 'civet'], ['castoreum', 'castoreum'],
    ['emu oil', 'emu oil'], ['mink oil', 'mink(?: oil| lashes| eyelashes| fur)?'], ['rooster comb', 'rooster comb|sodium hyaluronate \\(rooster'],
    ['honey', 'honey', 'strict'], ['beeswax', 'beeswax|cera alba', 'strict'], ['royal jelly', 'royal jelly', 'strict'],
    ['propolis', 'propolis', 'strict'], ['bee pollen', 'bee pollen', 'strict'],
    ['natural flavors', 'natural flavou?rs?', 'strict-weak'],
  ];
  // Phrases that neutralise a negative term.
  const NEG_PREFIX = '(?:no|non|without|free of|zero|not)[- ]+(?:added[- ]+)?';
  const NEG_SUFFIX = '(?:[- ]?(?:free|less|alternative|substitute|replacer|replacement)|\\s+style|[- ]like)\\b';
  const SAFE_PREFIX = '(?:vegan|faux|plant[- ]based|synthetic|vegetable|imitation|pu|oat|almond|soy|coconut|rice|cashew|peanut|cocoa|shea|nut|apple|sun ?butter|sunflower|mock|meatless|artificial|ice|egg ?plant)[- ]+';
  const POSITIVE = [
    ['certified vegan', /\bcertified[- ]vegan\b|\bvegan[- ]certified\b|\bvegan society\b|\bvegan action\b/i, 3],
    ['vegan', /\b(?:100% )?vegan\b/i, 2],
    ['plant-based', /\bplant[- ]based\b|\b100% plant\b/i, 1],
    ['plant milk/cheese', /\bplantmilk\b/i, 1],
  ];
  const DAIRY_FREE = /\bdairy[- ]free\b/i, EGG_FREE = /\begg[- ]free\b/i;

  function preNeutralize(text) {
    let t = ' ' + String(text || '').toLowerCase().replace(/[\u2010-\u2015]/g, '-') + ' ';
    t = t.replace(/\b(?:non|not)[- ]vegan\b/g, ' NONVEGANMARK ');
    // common false friends
    t = t.replace(/\b(?:peanut|almond|cashew|cocoa|shea|nut|seed|apple|sun|sunflower|soy|body|mango|cocoa)[- ]butter\b/g, ' plantbutter ');
    // Silk (the plant-milk brand) must be recognised before "oat milk" etc. collapse to plantmilk.
    t = t.replace(/\bsilk(?= (?:unsweetened|original|almond|oat|soy|organic|protein|nextmilk|creamer|vanilla|dairy|light|cashew|coconut|plant|chocolate|ultra|extra creamy)\b)/g, ' silkbrand');
    t = t.replace(/\b(?:coconut|oat|almond|soy|rice|cashew|plant|hemp|pea|macadamia|flax|pistachio)[- ]?(?:milk|cream|cheese|creamer|beverage|drink)s?\b/g, ' plantmilk ');
    // "Dairy Free Cheddar Slices": dairy-free cheese/milk analogues
    t = t.replace(/\b(?:(?:dairy|milk)[- ]free|vegan|plant[- ]based)\s+(?:(?:sharp|mild|medium|extra sharp|shredded|sliced|smoked|vegan|plant[- ]based)\s+)?(?:cheddar|mozzarella|parmesan|cheeses?|butter|creamer|cream cheese|ice cream|milk)(?:\s+cheeses?)?\b/g, ' plantmilk ');
    t = t.replace(/\b(?:cream of tartar|ice cream maker|butterfly|butternut|buttercup|eggplant|creamy peanut|cheesecloth|fish ?tank|milk ?thistle|milkweed|hamper|hammer|hamilton|graham|shampoo|silken tofu|silky|silk (?:finish|touch|matte|sheen|smooth|press|screen(?:ed)?|road|n silk|flower|plant|tree|oak|worm free)|silk ?finish|silkscreen|silk-like|liquid silk|silk ?therapy|silk ?skin|chickpeas?|hen of the woods)\b/g, ' ');
    t = t.replace(/\b(?:beyond meat|impossible (?:burger|foods?)|meat[- ]free|meatless)\b/g, ' plantmeat ');
    // vegan supplement forms
    t = t.replace(/\b(?:algae|algal|seaweed|schizochytrium)(?:[- ]based|[- ]derived)?(?:\s+(?:dha|epa|omega[- ]?3s?|oil|vegan|and|\+))*(?:\s+(?:softgels?|soft gels?|capsules?))?/g, ' algaloil ');
    t = t.replace(/\b(?:vitamin d3|cholecalciferol|d3)\s*\(?\s*(?:from|derived from|sourced from)?\s*lichen\)?|\blichen(?:[- ]derived|[- ]based)?\s+(?:vitamin\s+)?d3\b|\bvegan\s+(?:vitamin\s+)?d3\b/g, ' lichend3 ');
    t = t.replace(/\b(?:veggie|vegetable|vegan|plant|hpmc|pullulan|cellulose)\s+(?:soft ?gels?|capsules?|caps)\b/g, ' vegcaps ');
    t = t.replace(/\bvegan\s+collagen(?:\s+(?:builder|booster|support))?\b|\bcollagen\s+(?:builder|booster)\b(?=[^\n]*\b(?:vegan|plant[- ]based)\b)/g, ' vegcollagen ');
    return t;
  }


  // ---------- Amazon attribute table ("Product details" / "Top highlights") ----------
  const MATERIAL_LABEL = /\b(?:fabric|material|materials|outer|sole|lining|upper|fill|filling|leather type|composition|shell|insole|strap|band|item form|specialty|ingredients?)\b/i;
  const DIET_LABEL = /\bdiet\s*type\b/i;
  // [label, regex source] — animal-derived materials
  const ANIMAL_MATERIALS = [
    ['leather', 'genuine leather|full[- ]grain leather|top[- ]grain leather|cowhide|calfskin|lambskin|goatskin|pigskin|leather'],
    ['suede', 'suede'], ['nubuck', 'nubuck'], ['wool', 'wool|woolen|woollen'], ['merino', 'merino'], ['cashmere', 'cashmere'],
    ['mohair', 'mohair'], ['angora', 'angora'], ['alpaca', 'alpaca'], ['yak', 'yak'], ['camel hair', 'camel ?hair'],
    ['silk', 'silk|mulberry silk'], ['down', 'goose down|duck down|down'], ['feather', 'feathers?'],
    ['fur', 'fur|mink|rabbit fur|fox fur'], ['shearling', 'shearling'], ['sheepskin', 'sheepskin'], ['horn', 'horn'],
    ['pearl', 'pearls?|mother of pearl'], ['bone', 'bone'], ['seashell', 'sea ?shells?'], ['lanolin', 'lanolin'],
    ['beeswax', 'beeswax'], ['snakeskin/exotic skin', 'snakeskin|python skin|crocodile skin|ostrich'],
  ];
  const PLANT_SYNTH = ['polyester', 'rayon', 'viscose', 'spandex', 'elastane', 'lycra', 'nylon', 'polyamide', 'acrylic', 'cotton', 'linen', 'hemp',
    'bamboo', 'lyocell', 'tencel', 'modal', 'polyurethane', 'pu leather', 'faux leather', 'vegan leather', 'synthetic leather', 'faux fur', 'faux suede',
    'down alternative', 'microfiber', 'microfibre', 'fleece', 'synthetic', 'rubber', 'eva', 'tpr', 'tpu', 'pvc', 'canvas', 'jute', 'cork', 'mesh',
    'polypropylene', 'polyethylene', 'satin', 'polyester fill'];
  // phrases that look animal but aren't
  const MAT_SAFE = /\b(?:faux|vegan|pu|synthetic|man[- ]made|imitation|artificial|plant[- ]based|apple|cactus|mushroom|vegetable|pleather|bonded pu)[- ]+(?:leather|suede|fur|shearling|sheepskin|wool|silk|down|nubuck)\b|\b(?:leather|suede|fur|wool|silk|down|feathers?|shearling|sheepskin|cashmere)[- ]*(?:-?like|look|effect|feel|alternatives?|substitute|free)\b|\bno (?:leather|wool|down|feathers?|fur)\b|\b(?:pull|zip|slip|button|drop|step|shut|break|tear)[- ]?down\b|\bdown(?:load|town|stairs|ward)\b|\b(?:horn|bone)[- ]?(?:-?like|effect|colou?r|white)\b|\bshell[- ]?fabric\b|\bsilky\b|\bsatin\b/gi;
  const SAFE_LABELS = { 'pu leather': 1, 'faux leather': 1, 'vegan leather': 1, 'synthetic leather': 1, 'faux fur': 1, 'faux suede': 1, 'down alternative': 1 };
  function esc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // pairs: [{label, value}] as scraped from the page. Pure function (no DOM).
  function analyzeAttributes(pairs) {
    const out = { animal: [], plant: [], rows: [], diet: null, dietVegan: false, dietNonVegan: false };
    for (const p of pairs || []) {
      const label = String(p.label || '').replace(/[\s:\u200e\u200f]+$/g, '').trim();
      const value = String(p.value || '').trim();
      if (!label || !value) continue;
      if (DIET_LABEL.test(label)) {
        out.diet = value; out.rows.push(label);
        if (/\bvegan\b/i.test(value) && !/\bnon[- ]?vegan\b/i.test(value)) out.dietVegan = true;
        else if (/\bnon[- ]?vegan\b/i.test(value)) out.dietNonVegan = true;
        continue;
      }
      if (!MATERIAL_LABEL.test(label) || /\bcare\b|\binstructions?\b/i.test(label)) continue;
      if (/ingredients?/i.test(label) || /item form|specialty/i.test(label)) { out.rows.push(label); out.text = (out.text || '') + '\n' + value; if (/item form|specialty/i.test(label) && !/ingredients?/i.test(label)) { if (/\bvegan\b/i.test(value) && !/non[- ]?vegan/i.test(value)) out.dietVegan = true; } continue; }
      let used = false;
      let v = ' ' + value.toLowerCase().replace(/[\u2010-\u2015]/g, '-') + ' ';
      for (const k of PLANT_SYNTH) {
        const re = new RegExp('\\b' + esc(k) + '\\b', 'i');
        if (re.test(v) && !out.plant.includes(k)) { out.plant.push(k); }
        if (re.test(v)) used = true;
      }
      v = v.replace(MAT_SAFE, ' ');
      for (const [name, src] of ANIMAL_MATERIALS) {
        if (new RegExp('\\b(?:' + src + ')\\b', 'i').test(v)) { used = true; const lab = name + ' (' + label + ')'; if (!out.animal.includes(lab)) out.animal.push(lab); }
      }
      if (used) out.rows.push(label);
    }
    // drop generic entries already covered by more specific ones
    out.plant = out.plant.filter(k => !(k === 'synthetic' && out.plant.some(x => /synthetic /.test(x))));
    out.rows = [...new Set(out.rows)];
    return out;
  }

  const Brands = (typeof module !== 'undefined' && module.exports) ? require('./veganBrands.js') : root.VeganBrands;

  function classify(text, opts) {
    opts = opts || {};
    const strict = opts.strictness !== 'lenient';
    const A = opts.attributes ? analyzeAttributes(opts.attributes) : null;
    const raw = String(text || '') + (A && A.text ? '\n' + A.text : '');
    let t = preNeutralize(raw);
    const t0 = t;
    const negated = [];
    const matched = [];
    for (const [label, src, level] of NEGATIVE) {
      if (level === 'strict' && !strict) continue;
      if (level === 'strict-weak') continue; // too ambiguous; reported nowhere
      const term = '(?:' + src + ')';
      // remove negated / safe forms first
      const negRe = new RegExp('\\b' + NEG_PREFIX + term + '\\b|\\b' + term + NEG_SUFFIX + '|\\b' + SAFE_PREFIX + term + '\\b', 'g');
      if (negRe.test(t)) { negated.push(label); t = t.replace(negRe, ' '); }
      const re = new RegExp('\\b' + term + '\\b', 'i');
      const m = t.match(re);
      if (m) matched.push(label);
    }
    const explicitNonVegan = /NONVEGANMARK/i.test(t);
    let score = 0; const positives = [];
    const tp = t0.replace(/NONVEGANMARK/gi, ' ');
    for (const [label, re, w] of POSITIVE) if (re.test(tp)) { score += w; positives.push(label); }
    if (DAIRY_FREE.test(raw) && EGG_FREE.test(raw)) { score += 1; positives.push('dairy-free + egg-free'); }

    // "Always vegan" list. Precedence: user entry > explicit "non-vegan" label > built-in entry > keyword terms.
    const wl = Brands ? Brands.match(raw, opts) : [];
    for (const e of wl) positives.push(Brands.label(e));
    if (A) {
      for (const a of A.animal) matched.push(a);
      if (A.dietVegan) { score += 3; positives.push('diet type: vegan'); }
      if (A.dietNonVegan && !matched.length) matched.push('diet type: non-vegan');
    }
    let verdict = 'unknown';
    if (wl.some(e => e.user)) { verdict = 'vegan'; }
    else if (explicitNonVegan) { verdict = 'non-vegan'; matched.unshift('labelled non-vegan'); }
    else if (wl.length) verdict = 'vegan'; // fully-vegan brand: "cheese"/"milk" in its titles are plant-based
    else if (matched.length && score >= 3) verdict = 'vegan'; // certified vegan beats e.g. "leather" in "vegan... leather look"
    else if (matched.length) verdict = 'non-vegan';
    else if (score >= 1) verdict = 'vegan';
    if (A && A.plant.length && !A.animal.length && !matched.length && !explicitNonVegan) {
      positives.push('materials: ' + A.plant.join(', '));
      if (verdict === 'unknown') verdict = 'vegan';
    }
    return { verdict, matched: verdict === 'vegan' ? [] : matched, positives, negated, whitelisted: wl.map(e => e.name), attributeRows: A ? A.rows : [], materialsOnly: !!(A && A.plant.length && verdict === 'vegan' && score < 1 && !wl.length) };
  }

  async function lookupOpenFoodFacts(code, fetchImpl) {
    const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f || !/^\d{8,14}$/.test(String(code))) return null;
    try {
      const r = await f(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=ingredients_analysis_tags,product_name`);
      if (!r.ok) return null;
      const j = await r.json();
      const tags = (j.product && j.product.ingredients_analysis_tags) || [];
      if (tags.includes('en:vegan')) return 'vegan';
      if (tags.includes('en:non-vegan')) return 'non-vegan';
      if (tags.length) return 'unknown';
      return null;
    } catch (e) { return null; }
  }

  const api = { classify, analyzeAttributes, ANIMAL_MATERIALS, PLANT_SYNTH, lookupOpenFoodFacts, NEGATIVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganClassifier = api;
})(typeof self !== 'undefined' ? self : this);
