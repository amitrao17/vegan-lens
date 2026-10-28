// Vegan Lens general-web text classifier. Browser global (VeganContentClassifier) + Node module.
(function (root) {
  'use strict';
  // [regex source, weight, label]
  const ANIMAL = [
    ['steaks?|ribeye|sirloin|t-bone|filet mignon|porterhouse', 3, 'steak'],
    ['burgers?|cheeseburgers?|hamburgers?', 2, 'burgers'], ['brisket', 3, 'brisket'], ['bacon', 3, 'bacon'],
    ['(?:baby back |short |spare |bbq |pork )?ribs', 2, 'ribs'], ['(?:chicken |buffalo )?wings', 2, 'wings'],
    ['bbq|barbecue|barbeque|smokehouse|pulled pork', 2, 'BBQ meat'], ['pork|ham|prosciutto|salami|pepperoni|sausages?|hot dogs?|chorizo', 2, 'pork'],
    ['beef|meatballs?|meatloaf|roast beef|wagyu', 2, 'beef'], ['chicken|turkey|duck|poultry', 2, 'poultry'],
    ['lamb|mutton|veal|venison|goat meat', 3, 'meat'], ['meat|meats|carnivore diet|butcher', 2, 'meat'],
    ['seafood|shellfish|lobsters?|oysters?|crabs?|shrimp|prawns?|scallops?|clams?|mussels?|sushi|sashimi|caviar', 3, 'seafood'],
    ['salmon|tuna|cod|trout|halibut|fish tacos?|fish and chips|fish', 2, 'fish'],
    ['cheese ?boards?|charcuterie|fondue', 3, 'cheese board'], ['cheeses?|brie|cheddar|mozzarella|parmesan|burrata', 2, 'cheese'],
    ['dairy|milk|butter|cream|yogurt|ice cream|gelato|custard|eggs?|omelets?|omelettes?', 1.5, 'dairy/eggs'],
    ['foie gras|veal|escargot|frog legs', 4, 'foie gras/veal'],
    ['hunting|hunter|deer season|duck season|trophy hunt', 3, 'hunting'], ['fishing|angler|fly fishing|catch of the day', 2.5, 'fishing'],
    ['rodeo|bullfight(?:ing)?|horse racing|circus animals?', 3, 'animal entertainment'],
    ['fur coats?|fur|mink|leather (?:goods|jacket|boots|bag|handbag|sofa)|alligator skin|python skin|shearling', 2.5, 'fur/leather'],
  ];
  const BOOST = /\b(?:recipes?|best|top \d+|how to (?:cook|grill|smoke|make)|restaurant review|review|grill(?:ed|ing)?|smoked|roast(?:ed)?|fried|crispy|juicy|tender|cook-?off|feast|eat(?:ing)?|tasting|steakhouse)\b/g;
  const VEGAN = [
    ['vegan(?:ism|s)?', 3, 'vegan'], ['plant[- ]based', 3, 'plant-based'], ['tofu|tempeh|seitan|jackfruit|lentils?|chickpeas?|falafel|hummus', 1.5, 'plant protein'],
    ['beyond (?:meat|burger|sausage)|impossible (?:burger|foods|meat|sausage)', 3, 'Beyond/Impossible'],
    ['animal rights|animal sanctuar(?:y|ies)|farm sanctuary|sanctuary|cruelty[- ]free|meatless|meat[- ]free|dairy[- ]free|veganuary|vegetarian', 2.5, 'animal-friendly'],
  ];
  const ETHICS = /\b(?:factory farm(?:s|ing)?|slaughter(?:house)?s?|animal (?:cruelty|welfare|abuse|suffering|agriculture)|cruelty|undercover investigation|why i (?:quit|stopped|gave up)|(?:quit|quitting|giving up|gave up|stopped eating|ditch(?:ed|ing)?|cut(?:ting)? out|ban(?:s|ned|ning)?|less) (?:meat|dairy|beef|eating meat)|went vegan|go(?:ing)? vegan|meat (?:tax|reduction)|methane|emissions|rescued?|activists?|protest)\b/g;
  // Replace false friends before scoring.
  const FALSE_FRIENDS = [
    /\b(?:cauliflower|cabbage|mushroom|tofu|celeriac|portobello|eggplant|watermelon|seitan|jackfruit|vegan|plant[- ]based|veggie|black bean|beyond|impossible|meatless|bean)[- ](?:steaks?|burgers?|bacon|ribs|wings|sausages?|meatballs?|chicken|cheese|milk|butter|ice cream|bbq|meat|fish|tuna|jerky|nuggets?)\b/g,
    /\b(?:oat|soy|almond|coconut|cashew|rice|hemp|pea)[- ]?(?:milk|cheese|butter|yogurt|cream)\b/g,
    /\b(?:peanut|almond|cocoa|shea|apple|sun|cashew|body)[- ]butter\b/g,
    /\bkevin bacon\b|\bfrancis bacon\b|\bbacon number\b/g,
    /\b(?:game of chicken|play(?:ing|ed)? chicken|chicken out|chickened out|chicken little|chicken pox|chickenpox|chicken scratch|chicken[- ]and[- ]egg)\b/g,
    /\bbeef(?:s|ed|ing)? (?:with|between|over)\b|\b(?:their|a|the|long[- ]running|bitter|rap|twitter|online|public|old|ongoing|growing) beef\b|\bbeefs? up\b|\bbeefed[- ]up\b|\bwhere'?s the beef\b/g,
    /\bphishing\b|\bfishing (?:emails?|scams?|attacks?|expeditions?)\b|\bfishing for (?:compliments|information|votes|answers)\b/g,
    /\bham radio\b|\bham[- ]fisted\b|\bhamstrings?\b|\bhamburg(?! *er)\b|\bhamilton\b|\bhampshire\b|\bhammer\b/g,
    /\b(?:buttery smooth|butterfl(?:y|ies)|butterfingers|butternut|cream of the crop|crème de la crème|creamed (?:by|in)|ice cream sandwich android|cold turkey|turkey's|in turkey|türkiye|cheesy (?:pickup lines|movie|jokes)|big cheese|egged on|egghead|easter egg|egg on (?:their|his|her) face|milk(?:ing|ed)? (?:it|the)|chicken-hearted|duck(?:ed|ing|s)? (?:out|the question|question)|lame duck|sitting duck|red herring|fish out of water|cold fish|bigger fish to fry|plenty of fish|meat and potatoes of|meat of the|in the flesh|bring home the bacon|save (?:my|your|our) bacon|hot dog(?:ging)?! |top dog|witch hunt|job hunt(?:ing)?|house hunt(?:ing)?|treasure hunt|hunter biden|bug hunt|bounty hunter|hunting for (?:bugs|deals|jobs|a job|answers)|headhunt(?:er|ing)?|fur ?baby|fur ?babies|furry friends?|faux fur|vegan leather|leather[- ]free|fake fur|mushroom leather|pleather|cod(?:e|ing|ec)|salmon[- ]colou?red|tuna\.js)\b/g,
  ];
  const THRESH = { low: 4.5, med: 2.5, high: 1.5 };
  const rx = (src) => new RegExp('\\b(?:' + src + ')\\b', 'g');
  const ANIMAL_RX = ANIMAL.map(([s, w, l]) => [rx(s), w, l]);
  const VEGAN_RX = VEGAN.map(([s, w, l]) => [rx(s), w, l]);

  function count(re, t) { re.lastIndex = 0; const m = t.match(re); return m ? m.length : 0; }

  const Brands = (typeof module !== 'undefined' && module.exports) ? require('./veganBrands.js') : root.VeganBrands;

  function classify(input, opts) {
    opts = opts || {};
    const thr = THRESH[opts.sensitivity] || THRESH.med;
    const parts = typeof input === 'string' ? { headline: input } : (input || {});
    // headline weighs double vs snippet/alt
    const segs = [[parts.headline, 2, 'title'], [parts.snippet, 1, 'snippet'], [parts.alt, 0.75, 'alt']].filter(s => s[0]);
    let neg = 0, pos = 0, ethics = 0; const reasons = [], about = {};
    let veganHits = 0, headNeg = 0; const matches = [];
    for (const [rawText, segW, where] of segs) {
      let t = ' ' + String(rawText).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u2010-\u2015]/g, '-') + ' ';
      // "Always vegan" list: strong positive; strip the phrase so e.g. "Daiya cheese" isn't scored as dairy.
      if (Brands) for (const e of Brands.match(rawText, opts)) {
        pos += (e.user ? 4 : 3) * segW; reasons.push('+' + Brands.label(e));
        const words = Brands.norm(e.name).trim().split(' ').map(w => w.split('').join("['\u2019]?"));
        t = t.replace(new RegExp('\\b' + words.join('[^a-z0-9]+') + '\\b', 'g'), ' _ ');
      }
      for (const ff of FALSE_FRIENDS) { if (ff.test(t)) { ff.lastIndex = 0; t = t.replace(ff, m => { veganHits += /vegan|plant|cauliflower|tofu|mushroom|beyond|impossible|seitan|jackfruit|oat|soy|almond|coconut|meatless|faux|pleather/.test(m) ? 1 : 0; return ' _ '; }); } ff.lastIndex = 0; }
      for (const [re, w, l] of VEGAN_RX) { const n = count(re, t); if (n) { pos += w * segW * Math.min(n, 2); reasons.push('+' + l); } }
      const e = count(ETHICS, t); if (e) { ethics += e; reasons.push('+ethics/welfare framing'); }
      let segNeg = 0;
      for (const [re, w, l] of ANIMAL_RX) { const n = count(re, t); if (n) { re.lastIndex = 0; const m = re.exec(t); re.lastIndex = 0;
        matches.push({ term: m[0], label: l, where, snippet: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim() }); segNeg += w * Math.min(n, 2); about[l] = (about[l] || 0) + w * n; reasons.push('-' + l); } }
      if (segNeg) { const b = count(BOOST, t); if (b) { segNeg *= 1 + 0.3 * Math.min(b, 3); reasons.push('-context boost'); } }
      if (segW === 2) headNeg = segNeg;
      neg += segNeg * segW / 2;
    }
    pos += veganHits * 3;
    if (veganHits) reasons.push('+plant-based alternative');
    // Ethics / activism framing neutralises the animal terms entirely and leans positive.
    if (ethics) { pos += 3 * ethics; neg *= 0.1; }
    const score = Math.round((pos - neg) * 100) / 100;
    let verdict = 'neutral';
    // requireHeadline (YouTube): hidden/secondary text alone (description, alt) can't make a card non-vegan.
    if (opts.requireHeadline && !headNeg) neg = 0;
    if (neg >= thr && neg > pos) verdict = 'nonvegan';
    else if (pos >= 3 && pos > neg) verdict = 'vegan';
    const topic = Object.entries(about).sort((a, b) => b[1] - a[1])[0];
    return { verdict, score, reasons: [...new Set(reasons)], topic: topic ? topic[0] : null, about, matches };
  }

  // lowest weight per animal label (for ad weak-word checks)
  const LABEL_W = {}; for (const [, w, l] of ANIMAL) LABEL_W[l] = Math.min(LABEL_W[l] || 9, w);
  const api = { classify, THRESH, LABEL_W };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganContentClassifier = api;
})(typeof self !== 'undefined' ? self : this);
