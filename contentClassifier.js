// Vegan Lens general-web text classifier. Browser global (VeganContentClassifier) + Node module.
(function (root) {
  'use strict';
  // 0.4.52: rule data comes from rules/rules.json (see rules/rules.js); applyRules() re-runs when a signed list update lands.
  const Rules = (typeof module !== 'undefined' && module.exports) ? require('./rules/rules.js') : root.VeganRules;
  let ANIMAL, BOOST, VEGAN, ETHICS, PLANT_STEAK, MEAT_REJECT, STRONG_PAGE, FALSE_FRIENDS, COLOR_COSMETIC, HONEY_SHADE, THRESH, WEAR_CTX, BARE_LEATHER, PLANT_LEATHER, AMBIG, PLANT_UNIT, EXPLICIT_MEAT, STYLE_MATERIALS, CAUTION_WEB, HEADER_VEGAN, UNIT_VEGAN, EQUIPMENT_HEAD, DISCUSSION, FOOD_SHOW, MATERIAL_NAMES, ARTS_CTX, MATERIAL_PRODUCT, ARTS_MATERIAL, MIXED_VENUE, MIXED_GOODS, CULTIVATED_MEAT, CULTIVATED_DISH, DAIRY_FREE, DAIRY_FOODS, PAREVE, AMBIG_FOOD_CTX;
  let PLANT_WORD, ANIMAL_RX, VEGAN_RX, ANIMAL_ALT, NEGATED, RENOUNCE;
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
    const raw = String(name || '').toLowerCase();
    if (!raw) return false;
    if (/ex[- ]?vegan|anti[- ]?vegan|non[- ]?vegan/.test(raw)) return false;
    const n = raw.replace(/[^a-z0-9]/g, '');
    return /vegan|plantbased|plantpowered|wfpb/.test(n);
  }
  // 0.4.74: Facebook auto-generated alt ('May be an image of steak') is a weak guess; OCR in the same string is real text.
  const FB_AUTO_ALT = /^(?:may be an? )?(?:image|photo|picture) of(?: (?:a|an|some))?\s+/i;
  const FB_AUTO_OCR = /text that says ['"\u201c\u2018](.+?)['"\u201d\u2019]?\s*$/i;
  function fbAutoAlt(t) {
    const raw = String(t || '').replace(/\s+/g, ' ').trim();
    const ocr = ((raw.match(FB_AUTO_OCR) || [])[1] || '').trim();
    if (!FB_AUTO_ALT.test(raw)) return { auto: false, guess: '', ocr };
    const guess = raw.replace(FB_AUTO_ALT, '').replace(/\s+and text that says[\s\S]*$/i, '').trim();
    return { auto: true, guess, ocr };
  }
  const VEGAN_FOOD_CTX = /\bvegan(?:[- ](?:meal|meals|restaurant|restaurants|recipe|recipes|food|option|options|diet|dishes|dish))?s?\b/i;
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

  // 0.4.80: a "choice of chicken, pork, tofu or vegetables" list is a customizable protein, not evidence
  // that the dish itself contains meat. Same for "optional chicken" and "fried rice with egg for extra charge".
  // If every option is animal, the list still counts. Stated ingredients outside the list still count.
  const VEG_CHOICE = /\b(?:tofu|tofus|vegetables?|veggies|\bveg\b|plant[- ]based)\b/i;
  const ANIMAL_CHOICE = /\b(?:chicken|pork|beef|shrimp|prawns?|seafood|fish|steak|flank\s+steak|turkey|duck|lamb|bacon|ham|squid|calamari|wings?|eggs?|meat|meats)\b/i;
  const OPTION_ITEM = /^(?:(?:marinated|grilled|minced|steamed|fried|crispy|fresh|just|golden|sliced|butterflied|optional)\s+)*(?:tofu|tofus|vegetables?|veggies|veg|protein|proteins|meats?|chicken|pork|beef|shrimp|prawns?|seafood|fish|steak|flank\s+steak|turkey|duck|lamb|bacon|ham|squid|calamari|wings?|eggs?)\b/i;
  function skipListSep(s, i) {
    const n = s.length;
    while (i < n && /[\s,;/_]/.test(s[i])) i++;
    const rest = s.slice(i);
    const sep = /^(?:and|or|\/)\s+/i.exec(rest);
    if (sep) { i += sep[0].length; while (i < n && /[\s,;/_]/.test(s[i])) i++; }
    return i;
  }
  function endOfOptionList(s, start) {
    let i = skipListSep(s, start), end = start, found = 0;
    while (i < s.length) {
      i = skipListSep(s, i);
      const m = OPTION_ITEM.exec(s.slice(i));
      if (!m) break;
      i += m[0].length;
      end = i;
      found++;
    }
    return found ? end : start;
  }
  function neutralizeMenuChoices(text, acc) {
    let s = String(text || '');
    s = s.replace(/\bsubstitut(?:e|ion)\s+for\b[^.!?]{0,80}?\b(?:fried rice\s+)?with\s+egg\b[^.!?]{0,50}?\b(?:extra|additional)\s+charge\b/gi, ' _ ');
    s = s.replace(/\b(?:add(?:\s+an?)?\s+)?extra\s+charge\s+for\b[^.!?]{0,80}/gi, ' _ ');
    s = s.replace(/\boptional\s+(?:the\s+)?(?:grilled\s+|minced\s+|fried\s+|steamed\s+)?(?:chicken|pork|beef|shrimp|prawns?|seafood|fish|eggs?|turkey|bacon|ham|lamb|duck|steak|squid|calamari|meat|meats)\b/gi, ' _ ');
    const replaceChoice = (re, needBoth) => {
      let out = '', last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        const listStart = m.index + m[0].length;
        const listEnd = endOfOptionList(s, listStart);
        if (listEnd <= listStart) continue;
        const chunk = s.slice(m.index, listEnd);
        const list = s.slice(listStart, listEnd);
        const plant = VEG_CHOICE.test(chunk) || VEG_CHOICE.test(list);
        const animal = ANIMAL_CHOICE.test(list);
        if (!plant || (needBoth && !animal)) continue;
        if (acc) acc.choiceCleared = true;
        out += s.slice(last, m.index) + ' choice of protein ';
        last = listEnd;
      }
      return last ? out + s.slice(last) : s;
    };
    s = replaceChoice(/\b(?:your\s+)?choice\s+of(?:\s+(?:meat|meats|protein|proteins|topping|toppings))?(?:\s+_+(?:\s+_+)*)?(?:\s+are)?/gi, false);
    s = replaceChoice(/\bserved\s+with\b/gi, true);
    return s;
  }
  function classify(input, opts) {
    opts = opts || {};
    if (input && typeof input === 'object' && (communityVegan(input.community) || communityVegan(input.author))) opts = { ...opts, pageVegan: true, communityVegan: true };
    const thr = THRESH[opts.sensitivity] || THRESH.med;
    const parts = typeof input === 'string' ? { headline: input } : (input || {});
    // headline weighs double vs snippet/alt
    // 0.4.80: a dish/menu listing's own description is primary evidence (eggs, milk, a named meat), not a weak news snippet.
    const rawUnit = [parts.headline, parts.tags, parts.snippet, parts.alt].filter(Boolean).join(' ');
    const dishListing = !!(parts.kind === 'dish' || opts.dish ||
      /(?:[$\u20ac\u00a3]\s?\d|\d[\d.,]*\s?(?:USD|EUR|GBP)\b)/.test(rawUnit) ||
      /\b(?:stir[- ]fried|stuffed with|filled with|tossed (?:in|with)|topped with|wrapped in|wok[- ]fired|deep[- ]fried)\b/i.test(String(parts.snippet || '')));
    const segs = [[parts.headline, 2, 'title'], [parts.tags, 1.5, 'tag'], [parts.snippet, dishListing ? 2 : 1, 'snippet'], [parts.alt, 0.75, 'alt'], [parts.author, 1, 'author']].filter(s => s[0]).map(s => [stripPeople(s[0], parts.creators), s[1], s[2]]).filter(s => String(s[0]).replace(/[\s_]+/g, '')); // 0.4.45 tags: category chips (strong). 0.4.73: author/page name too, so a vegan brand in the byline is scored. 0.4.80: dish descriptions use title weight.
    let neg = 0, pos = 0, ethics = 0; const reasons = [], about = {};
    let veganHits = 0, headNeg = 0, rejects = 0, plantWord = false, headText = '', cultivated = false, cultivatedDish = false; const matches = [];
    const choiceAcc = { choiceCleared: false };
    const unitText = segs.map(x => String(x[0]).toLowerCase()).join(' ');
    // 0.4.73: a dairy-free claim anywhere in the post/ad unit clears cheese/butter/brie/cream/milk words in every segment.
    // Kosher Pareve supports "not dairy" but is not vegan on its own (pareve can include eggs or fish).
    const dairyFreeUnit = !!(DAIRY_FREE && (DAIRY_FREE.lastIndex = 0, DAIRY_FREE.test(unitText)));
    const pareveUnit = !!(PAREVE && PAREVE.test(unitText));
    const veganFoodCtx = !!(VEGAN_FOOD_CTX && VEGAN_FOOD_CTX.test([parts.headline, parts.snippet].filter(Boolean).join(' ')));
    const wearCtx = WEAR_CTX.test(unitText);
    // 0.4.64: fur/leather need positive material evidence. In a music/arts/game unit with no product/fashion context,
    // bare 'fur'/'leather'/'suede' tokens are not evidence (e.g. 'Fur Elise ... Ukulele TAB').
    const artsOnly = ARTS_CTX && ARTS_CTX.test(unitText) && !(MATERIAL_PRODUCT && MATERIAL_PRODUCT.test(unitText.replace(MATERIAL_NAMES || /$^/, ' ')));
    const plantUnit = PLANT_UNIT.test(unitText) && !/\b(?:exvegan|ex-vegan|antivegan|anti-vegan|non-?vegan)\b/.test(unitText);
    for (const [rawText, segW, where] of segs) {
      let t = ' ' + String(rawText).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u2010-\u2015]/g, '-') + ' ';
      t = neutralizeMenuChoices(t, choiceAcc);
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
      // 0.4.74: Facebook auto alt is not evidence on its own. In vegan context (group/author/vegan-food wording) it is
      // dropped entirely. OCR in the same alt ('text that says ...') is kept. A lone auto-guess never hides a post.
      const autoAlt = fbAutoAlt(rawText);
      if (autoAlt.auto && (where === 'alt' || where === 'title')) {
        const veganCtx = opts.communityVegan || veganFoodCtx || (Brands && Brands.match([parts.headline, parts.snippet, parts.author, parts.community].filter(Boolean).join('\n'), opts).length);
        if (autoAlt.ocr) t = ' ' + autoAlt.ocr.toLowerCase().replace(/[\u2018\u2019]/g, "'") + ' ';
        else if (veganCtx || where === 'alt') t = ' _ ';
        // title that is only an auto-guess (no OCR, no vegan context): also drop it so it cannot act as a headline steak.
        else t = ' _ ';
      }
      // 0.4.73: neutralize dairy-free claims first so "dairy" inside "dairy-free" / "non-dairy" / "zero dairy" never scores,
      // and (when the unit has such a claim) cheese, cheese board, butter, brie, cream and milk are cleared too.
      if (DAIRY_FREE) {
        DAIRY_FREE.lastIndex = 0;
        if (DAIRY_FREE.test(t) || dairyFreeUnit) {
          DAIRY_FREE.lastIndex = 0;
          t = t.replace(DAIRY_FREE, () => { veganHits += 1; return ' _ '; });
          if (DAIRY_FOODS) { DAIRY_FOODS.lastIndex = 0; t = t.replace(DAIRY_FOODS, () => { veganHits += 0.34; return ' _ '; }); }
        } else if (pareveUnit && DAIRY_FOODS) {
          DAIRY_FOODS.lastIndex = 0;
          t = t.replace(DAIRY_FOODS, ' _ ');
        }
      }
      // 0.4.72: cultivated/lab-grown meat is not slaughter-meat evidence and is never vegan (it still uses animal cells).
      // News/discussion about it is labelled, not hidden. Actual dishes, recipes and product listings stay non-vegan.
      if (CULTIVATED_MEAT) {
        CULTIVATED_MEAT.lastIndex = 0;
        if (CULTIVATED_MEAT.test(t)) {
          cultivated = true;
          const dish = (parts.kind === 'dish' || parts.kind === 'product') || (CULTIVATED_DISH && CULTIVATED_DISH.test(t));
          if (dish) cultivatedDish = true;
          else { CULTIVATED_MEAT.lastIndex = 0; t = t.replace(CULTIVATED_MEAT, ' _ '); }
        }
      }
      t = t.replace(PLANT_LEATHER, () => { veganHits += 1; return ' _ '; });
      if (plantUnit) t = t.replace(AMBIG, m => (EXPLICIT_MEAT.test(m) ? m : (veganHits += 0.34, ' _ ')));
      for (const ff of FALSE_FRIENDS) { if (ff.test(t)) { ff.lastIndex = 0; t = t.replace(ff, m => { veganHits += (PLANT_STEAK && new RegExp('\\b(?:' + PLANT_STEAK + ')\\b', 'i').test(m)) || /\b(?:vegan|plant|garden|oat|soy|almond|coconut|faux|pleather)\b/.test(m) ? 1 : 0; return ' _ '; }); } ff.lastIndex = 0; }
      // 0.4.62 noun-head rule: an animal word modifying equipment/supplies ('poultry fencing', 'chicken wire', 'fish tank filter',
      // 'cattle panel', 'pig ear tag') is not evidence; the head noun is the thing sold. Food heads (breast, fillets...) are excluded.
      if (MATERIAL_NAMES) t = t.replace(MATERIAL_NAMES, ' _ '); // 0.4.64: 'Für Elise', 'Fur Affinity', German 'für'
      if (artsOnly && ARTS_MATERIAL) t = t.replace(ARTS_MATERIAL, ' _ ');
      if (EQUIPMENT_HEAD) { EQUIPMENT_HEAD.lastIndex = 0; t = t.replace(EQUIPMENT_HEAD, ' _ '); }
      t = t.replace(MEAT_REJECT, () => { veganHits += 1; rejects++; return ' _ '; });
      t = t.replace(new RegExp('["\u201c\u201d\'](?:' + ANIMAL_ALT + ')\\b[^"\u201c\u201d]{0,25}["\u201c\u201d\']', 'g'), () => { veganHits += 1; return ' _ '; });
      t = t.replace(NEGATED, () => { veganHits += 1; return ' _ '; });
      // 0.4.71: 'stopped buying/eating X', 'quit X', 'gave up X', 'no more X', 'instead of / better than X'
      // when a plant alternative is in the same unit — the animal word is contrasted, not promoted.
      const plantAlt = veganHits || PLANT_WORD.test(t) || (PLANT_UNIT && PLANT_UNIT.test(t));
      if (plantAlt && RENOUNCE) t = t.replace(RENOUNCE, () => { veganHits += 1; return ' _ '; });
      if (where === 'title') { headText = t; if (PLANT_WORD.test(t)) plantWord = true; }
      for (const [re, w, l] of VEGAN_RX) { const n = count(re, t); if (n) { pos += w * segW * Math.min(n, 2); reasons.push('+' + l); } }
      const e = count(ETHICS, t); if (e) { ethics += e; reasons.push('+ethics/welfare framing'); }
      let segNeg = 0;
      for (const [re, w, l] of ANIMAL_RX) { const n = count(re, t); if (n) { re.lastIndex = 0; const m = re.exec(t); re.lastIndex = 0;
        matches.push({ term: m[0], label: l, where, snippet: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim() }); segNeg += w * Math.min(n, 2); about[l] = (about[l] || 0) + w * n; reasons.push('-' + l); } }
      if (wearCtx && !matches.some(m => m.where === where && m.label === 'animal fabrics' && /leather|suede|nubuck/.test(m.term))) { const n = count(BARE_LEATHER, t); if (n) { BARE_LEATHER.lastIndex = 0; const m = BARE_LEATHER.exec(t); BARE_LEATHER.lastIndex = 0;
        matches.push({ term: m[0], label: 'animal fabrics', where, snippet: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim() }); segNeg += 2.5 * Math.min(n, 2); about['animal fabrics'] = (about['animal fabrics'] || 0) + 2.5 * n; reasons.push('-animal fabrics'); } }
      if (segNeg) { const b = count(BOOST, t); if (b) { segNeg *= 1 + 0.3 * Math.min(b, 3); reasons.push('-context boost'); } }
      if (where === 'title') headNeg = segNeg;
      neg += segNeg * segW / 2;
    }
    pos += veganHits * 3;
    if (veganHits) reasons.push('+plant-based alternative');
    // 0.4.71: a YouTube/web creator name with vegan/plant-based/plant-powered words is context, not food evidence
    // (names are already stripped). It leans ambiguous titles vegan but does not override a clearly meaty title.
    if (!opts.communityVegan && [].concat(parts.creators || []).some(communityVegan)) { pos += 3; reasons.push('+vegan/plant-based creator'); }
    // Ethics / activism framing neutralises the animal terms entirely and leans positive.
    if (ethics) { pos += 3 * ethics; neg *= 0.1; }
    // Meat-rejection phrasing ("nobody wants meat anymore! These steaks..."): the remaining animal words describe the plant dish.
    if (rejects) neg *= 0.3;
    const score = Math.round((pos - neg) * 100) / 100;
    let verdict = 'neutral';
    // requireHeadline (YouTube): hidden/secondary text alone (description, alt) can't make a card non-vegan.
    if (opts.requireHeadline && !headNeg) neg = 0;
    // 0.4.75: "turkey" (and duck/ham/cod…) is a weak title term because it can be a country or idiom,
    // so a bare "Turkey" does not hide. A cut, dish or recipe word in the same title ("turkey thighs",
    // "braised turkey", "turkey gravy") is food, and the term is then as strong as "chicken".
    // 0.4.77: holiday/meal phrasing (Thanksgiving turkey, your turkey, turkey upgrade) is also food,
    // and a cooking/chef/kitchen channel is food context, unless the title is clearly geopolitics/travel.
    const foodHead = headText || String(parts.headline || '');
    const cookChannel = [].concat(parts.creators || [], parts.author || []).some(n => /\b(?:cook(?:ing|ery)|chef|kitchen|bbq|barbe(?:cue|que)|recipes?)\b/i.test(String(n || '')));
    const geoTitle = /\b(?:election|elections|ankara|istanbul|antalya|izmir|visa|lira|t[uü]rkiye|geopolitics|president|parliament|nato|earthquake|travel|vacation|tourism|protests?)\b/i.test(String(parts.headline || ''));
    const foodCtx = !!(AMBIG_FOOD_CTX && (AMBIG_FOOD_CTX.lastIndex = 0, AMBIG_FOOD_CTX.test(foodHead))) || (cookChannel && !geoTitle);
    const headStrong = opts.sensitivity !== 'low' && matches.some(m => (m.where === 'title' || m.where === 'tag' || (dishListing && m.where === 'snippet')) && (!/^(?:dairy\/eggs|honey)$/.test(m.label) || /^(?:(?:grass|butter|goat|sheep|cow|skim|whole)?milk|butter|eggs?|mayo|mayonnaise|honey|ghee|yogurt|aioli)$/.test(m.term)) && (!/^(?:turkey|duck|cod|bass|sole|ham|crab|wings?|nuggets?|jerky|bacon bits)$/.test(m.term) || foodCtx || dishListing) && (ANIMAL.find(a => a[2] === m.label) || [0, 0])[1] >= 1.5);
    const strongHead = matches.some(m => m.where === 'title' && STRONG_PAGE.test(m.label));
    if (opts.communityVegan) {
      // 0.4.74: a vegan group/author never hides a post, but "tried real steak again" is not a vegan verdict.
      const headMeat = matches.some(m => m.where === 'title' && (EXPLICIT_MEAT ? EXPLICIT_MEAT.test(m.term) : /steak|beef|pork|bacon|chicken|fish|salmon/i.test(m.term + ' ' + m.label)));
      if (headNeg && headMeat && !veganHits) { verdict = 'discussion'; reasons.push('meat mention in a vegan community'); }
      else verdict = 'vegan'; // vegan community: never dim
    }
    else if (opts.pageVegan) { if (pos >= 3) verdict = 'vegan'; } // vegan page/channel: never dim; meaty words there mean plant versions
    else if ((neg >= thr || (headStrong && !rejects)) && neg > pos) verdict = 'nonvegan';
    else if (pos >= 3 && pos > neg) verdict = 'vegan';
    // A "choice of chicken or tofu" dish is customizable, not itself vegan, unless the title says vegan.
    if (verdict === 'vegan' && choiceAcc.choiceCleared && !/\bvegan\b/i.test(String(parts.headline || '')) && !(UNIT_VEGAN && UNIT_VEGAN.test(String(parts.headline || '')))) {
      verdict = 'neutral'; reasons.push('protein choice includes a vegan option; dish is not inherently vegan');
    }
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
    // 0.4.72: lab-grown/cultivated meat is not vegan (animal cells). A recipe, menu dish or product listing stays
    // non-vegan like any meat. News, opinion or "will you try it?" discussion is labelled, not hidden, and never vegan.
    if (cultivated) {
      if (cultivatedDish) {
        if (verdict !== 'nonvegan') verdict = 'nonvegan';
        if (!reasons.includes('-cultivated meat')) reasons.push('-cultivated meat');
      } else {
        // Leftover animal words (e.g. "the future of fish" after "cell-based salmon") are still the same topic.
        verdict = 'discussion';
        reasons.push('cultivated meat discussion');
      }
    }
    const veganCreator = [].concat(parts.creators || []).some(communityVegan);
    const head = String(parts.headline || '');
    const clearRecipe = /\b(?:recipes?|how to (?:cook|grill|smoke|make|fry|bake)|grilled|smoked|baked|fried|homemade|mukbang|cook-?off)\b/i.test(head);
    const meatyDish = /\bmeat[- ]lovers?\b/i.test(head);
    const onlyGenericMeat = matches.length && matches.every(m => m.label === 'meat');
    // 0.4.76: a vegan/plant-based word used contrastively ("vegan vs beef", "I'm vegan but ate beef")
    // or as a person/role who then makes/tries meat ("Vegan Chef Makes Roast Beef") is not a product
    // modifier. Leftover animal evidence must not get a vegan verdict.
    const VEGAN_CONTRAST = /\b(?:vegan|plant[- ]based|veggie|meatless)\b(?:\s+\w+){0,4}\s+(?:vs\.?|versus)\b|\b(?:vegan|plant[- ]based|veggie|meatless)\b(?:\s+\w+){0,4}\s+but\s+(?:i\s+|we\s+|they\s+|he\s+|she\s+)?(?:ate|eaten|eat|eating|tried|tries|try|tasted|had)\b/i;
    const VEGAN_ROLE_VERB = /\b(?:vegan|plant[- ]based|veggie|meatless)\b(?:\s+\w+){0,3}\s+(?:makes?|made|making|tries?|tried|trying|tastes?|tasting)\s+(?:an? |the |some |real )?(?:(?:roast|deli|smoked|grilled|fried|baked|pulled|ground|sliced)\s+){0,2}(?:steaks?|burgers?|bacon|ribs|chicken|turkey|duck|meats?|fish|tuna|salmon|beef|pork|ham|lamb|veal|shrimp|seafood|jerky|nuggets?|hot dogs?|sausages?)\b/i;
    if (verdict === 'vegan' && matches.length && (VEGAN_CONTRAST.test(head) || VEGAN_ROLE_VERB.test(head))) {
      verdict = /\b(?:vs\.?|versus)\b/i.test(head) ? 'discussion' : 'nonvegan';
      reasons.push('vegan word used contrastively');
    }
    const titlePlantMod = /\b(?:vegan|plant[- ]based|veggie|meatless)\b/i.test(String(stripPeople(parts.headline, parts.creators)));
    // A vegan-named channel must not turn a clearly meaty dish or recipe vegan on its own.
    // 0.4.76: if the title itself already has a vegan/plant-based modifier, that wording — not the
    // channel name — produced the vegan verdict; do not flip it back.
    if (veganCreator && verdict === 'vegan' && matches.length && !veganHits && !titlePlantMod && (clearRecipe || meatyDish || !onlyGenericMeat)) {
      verdict = 'nonvegan';
    }
    if (veganCreator && !cultivatedDish && (verdict === 'nonvegan' || verdict === 'vegan') && onlyGenericMeat && !clearRecipe && !meatyDish) {
      verdict = 'discussion'; reasons.push('generic meat on a vegan-named channel');
    }
    // 0.4.74 safety net: the only animal evidence was a Facebook auto-alt guess → never hide (soft/neutral).
    if (verdict === 'nonvegan' && matches.length && matches.every(m => m.autoAlt)) {
      verdict = 'neutral'; reasons.push('weak Facebook auto alt');
    }
    const topic = Object.entries(about).sort((a, b) => b[1] - a[1])[0];
    return { verdict, score, reasons: [...new Set(reasons)], topic: topic ? topic[0] : null, about, matches, ...(mixed ? { mixed: true } : {}), ...(cultivated && verdict === 'discussion' ? { cultivated: true } : {}) };
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
  function altBlur(alt, opts, inUndimmedUnit, context) {
    const raw = String(alt || '').trim();
    const t = cleanAlt(raw); if (t.length < 3) return { blur: false, r: null, why: 'short' };
    // 0.4.73: image-level blur inside a post/ad must also apply the post's own text (dairy-free copy, brand, etc.).
    // 0.4.74: a lone Facebook auto-alt guess is not enough to blur; pass it as alt (not as a title) so it stays weak.
    const ctxObj = context && typeof context === 'object' && (context.headline || context.snippet || context.community || context.author)
      ? { headline: context.headline, snippet: context.snippet, author: context.author, community: context.community }
      : null;
    const ctx = ctxObj ? String(ctxObj.headline || ctxObj.snippet || '').replace(/\s+/g, ' ').trim() : String(context || '').replace(/\s+/g, ' ').trim();
    const auto = fbAutoAlt(raw);
    const input = ctxObj ? { ...ctxObj, alt: raw } : (ctx.length >= 8 ? { headline: ctx.slice(0, 1500), alt: raw } : (auto.auto ? { alt: raw } : t));
    const r = classify(input, opts || {});
    if (r.verdict !== 'nonvegan') return { blur: false, r, why: auto.auto && !auto.ocr ? 'weak-auto-alt' : 'not-nonvegan' };
    if (auto.auto && !auto.ocr && (r.matches || []).every(m => m.where === 'alt')) return { blur: false, r, why: 'weak-auto-alt' };
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
    ({ ANIMAL, BOOST, VEGAN, ETHICS, PLANT_STEAK, MEAT_REJECT, STRONG_PAGE, FALSE_FRIENDS, COLOR_COSMETIC, HONEY_SHADE, THRESH, WEAR_CTX, BARE_LEATHER, PLANT_LEATHER, AMBIG, PLANT_UNIT, EXPLICIT_MEAT, STYLE_MATERIALS, CAUTION_WEB, HEADER_VEGAN, UNIT_VEGAN, EQUIPMENT_HEAD, DISCUSSION, FOOD_SHOW, MATERIAL_NAMES, ARTS_CTX, MATERIAL_PRODUCT, ARTS_MATERIAL, MIXED_VENUE, MIXED_GOODS, CULTIVATED_MEAT, CULTIVATED_DISH, DAIRY_FREE, DAIRY_FOODS, PAREVE, AMBIG_FOOD_CTX } = D.classifier);
    PLANT_WORD = new RegExp('\\b(?:' + PLANT_STEAK + '|vegan|plant|vegetables?|veg|lentils?|chickpeas?|beans?|tofu|garden)\\b');
    ANIMAL_RX = ANIMAL.map(([s, w, l]) => [rx(s), w, l]);
    VEGAN_RX = VEGAN.map(([s, w, l]) => [rx(s), w, l]);
    ANIMAL_ALT = ANIMAL.map(a => a[0]).join('|');
    NEGATED = new RegExp('\\b(?:(?:needs?|need|with|has|have|had|contains?|uses?|using)\\s+no|zero|no|without|w/o|minus|skip(?:ping)?\\s+the|ditch(?:ing)?\\s+the|forget(?:\\s+about)?|instead\\s+of|replac(?:e|es|ing)(?:\\s+the)?|swap(?:ping)?\\s+(?:out\\s+)?(?:the\\s+)?|better\\s+than|not)\\s+(?:any\\s+|the\\s+|real\\s+)?(?:' + ANIMAL_ALT + ')\\b|\\b(?:' + ANIMAL_ALT + ')[- ](?:free|less)\\b', 'g');
    // 0.4.71: renouncing or contrasting an animal item (applied only when a plant alternative is also in the unit).
    RENOUNCE = new RegExp('\\b(?:(?:i|we|they|he|she|who)\\s+)?(?:stopped|quit(?:ted|ting)?|gave\\s+up|giving\\s+up|no\\s+more|cut(?:ting)?\\s+out|ditch(?:ed|ing)?)\\s+(?:buying|eating|getting|ordering|cooking|making|having|using)?\\s*(?:the\\s+|any\\s+|real\\s+)?(?:' + ANIMAL_ALT + ')\\b|\\b(?:instead\\s+of|better\\s+than|rather\\s+than)\\s+(?:the\\s+|any\\s+|real\\s+)?(?:' + ANIMAL_ALT + ')\\b', 'g');
    for (const k of Object.keys(LABEL_W)) delete LABEL_W[k]; for (const [, w, l] of ANIMAL) LABEL_W[l] = Math.min(LABEL_W[l] || 9, w);
    try { Object.assign(api, { CAUTION_WEB, STYLE_MATERIALS, HEADER_VEGAN, THRESH }); } catch (e) { /* first run: api not built yet */ }
  }
  applyRules(Rules.data()); Rules.onChange(applyRules);
  const api = { stripPeople, unitVegan, altBlur, cleanAlt, fbAutoAlt, ALT_HIGH, classify, neutralizeMenuChoices, shopCaution, CAUTION_WEB, STYLE_MATERIALS, communityVegan, pageContext, fabricQuery, HEADER_VEGAN, THRESH, LABEL_W };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganContentClassifier = api;
})(typeof self !== 'undefined' ? self : this);
