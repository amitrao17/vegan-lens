// Vegan Lens classifier. Works as a browser global (VeganClassifier) and a Node module.
(function (root) {
  'use strict';
  // [label, regex source]; "lenient" items are ignored in lenient mode.
  const NEGATIVE = [
    ['milk', 'milk(?:s)?|milk ?powder|milk ?fat|buttermilk|(?:grass|goat|sheep|cow|skim|whole)milk'], ['dairy', 'dairy'],
    ['whey', 'whey'], ['casein', 'casein(?:ate)?s?|caseinate'], ['butter', 'butter'],
    ['cheese', 'cheeses?|parmesan|cheddar|mozzarella'], ['cream', 'cream'], ['egg', 'eggs?|egg ?whites?|egg ?yolks?'],
    ['gelatin', 'gelatine?'], ['collagen', 'collagen'], ['carmine', 'carmine'], ['cochineal', 'cochineal'],
    ['lanolin', 'lanolin'], ['shellac', 'shellac|confectioner\'?s glaze'], ['fish', 'fish|fish ?oil|salmon|tuna|cod liver'],
    ['anchovy', 'anchov(?:y|ies)'], ['worcestershire (anchovy)', 'worcestershire'], ['shrimp', 'shrimp|crab|lobster|shellfish|oyster'], ['chicken', 'chicken'],
    ['beef', 'beef'], ['pork', 'pork|ham|pigs? in (?:a )?blankets?'], ['bacon', 'bacon'], ['lard', 'lard'], ['tallow', 'tallow'],
    ['meat', 'meat|turkey|lamb|venison|jerky'], ['leather', 'leather|suede'], ['wool', 'wool|merino|cashmere|alpaca'],
    ['silk', 'silk'], ['down feathers', 'down(?: feathers?| fill| filled| comforter| jacket)|goose down|duck down|feathers?'],
    ['bone char', 'bone ?char|bone ?meal'], ['isinglass', 'isinglass'], ['albumin', 'albumi?ne?'],
    ['lactose', 'lactose'], ['ghee', 'ghee'], ['lactic casein', 'lactalbumin|lactoglobulin'],
    ['pepsin', 'pepsin|rennet'], ['l-cysteine', 'l-cysteine'], ['vitamin D3 (lanolin)', 'vitamin d3|cholecalciferol'],
    // non-food / hidden animal materials (instruments, brushes, crafts, tableware)
    ['horsehair', 'horse ?hair|horsetail hair|mongolian (?:white )?hair|(?:bleached|unbleached|natural|real|genuine) (?:bow )?hair'],
    ['boar bristle', 'natural bristles?|boar(?: hair)? bristles?|boar hair|badger (?:hair|bristles?)|hog bristles?|sable (?:hair|brush(?:es)?)|squirrel hair|goat hair|pony hair|kolinsky'],
    ['bone', 'bone (?:nut|saddle|bridge pins?|pins|inlay|handle|china|beads?|comb)|(?:nut|saddle) (?:of|in) bone|bone china'],
    ['gut strings', '(?:sheep|natural|lamb)? ?gut strings?|catgut'],
    ['hide glue', 'hide glue|animal glue|hoof glue'],
    ['animal skin', 'calf ?skin|goat ?skin|lamb ?skin|sheep ?skin|cow ?hide|rawhide|deer ?skin|snake ?skin|python skin|(?:calf|goat|animal) (?:skin )?(?:drum ?)?heads?'],
    ['shearling', 'shearling'], ['mohair', 'mohair|angora'], ['fur', 'real fur|genuine fur|mink|fox fur|rabbit fur|raccoon fur|fur (?:trim|trimmed|coat|collar|hood|lined)'],
    ['mother-of-pearl', 'mother[- ]of[- ]pearl|abalone|nacre|pearl inlay'],
    ['ivory', 'ivory (?:nut|saddle|inlay|keys|carving|piano keys)|(?:genuine|real|antique|fossil|mammoth|walrus) ivory|tusks?|elephant ivory'],
    ['exotic skin', 'alligator|crocodile|croc skin|caiman|ostrich (?:leather|skin)|lizard skin|eel ?skin|stingray|shagreen|nappa|napa leather|cordovan'],
    ['fur felt', '(?:beaver|rabbit|fur) felt'], ['pearl', '(?:cultured|freshwater|akoya|tahitian|south sea|genuine|real|natural|baroque) pearls?|pearl (?:earrings|necklace|strand)'],
    ['horn', 'horn (?:buttons?|handle|comb|spoon|toggles?)|buffalo horn|ox horn|stag (?:handle|horn|antler)|antler (?:handle|knife)'],
    ['animal fiber', 'camel ?hair|vicu(?:n|ñ)a|llama wool|qiviut|guanaco|yak (?:hair|down)|horse ?hair'],
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
  const KEEP_SUFFIX = new Set(['lactose']); // '-free' here describes a dairy product, not a dairy-free one
  const NEG_SUFFIX = '(?:[- ]?(?:free|less|alternative|substitute|replacer|replacement)|\\s+style|[- ]like)\\b';
  const SAFE_PREFIX = '(?:vegan|faux|plant[- ]based|synthetic|vegetable|imitation|pu|oat|almond|soy|coconut|rice|cashew|peanut|cocoa|shea|nut|apple|sun ?butter|sunflower|mock|meatless|artificial|ice|egg ?plant)[- ]+';
  // Product types that often hide animal materials even when the title doesn't say so; shown as a caution on "?" items.
  const CAUTION = [
    [/\b(?:jeans|denim)\b/i, 'Jeans often have a leather back patch; check the tag.'],
    [/\b(?:sedan|suv|coupe|hatchback|minivan|pickup truck|crossover|convertible|ex-l|awd|4wd|cars?|vehicles?)\b/i, 'Cars often have leather seats, steering wheel or shift knob unless listed as cloth or synthetic.'],
    [/\b(?:shoes?|boots?|sneakers?|loafers?|sandals?|heels|oxfords?)\b/i, 'Shoes may use leather parts or animal-based glues.'],
    [/\b(?:sofas?|couch(?:es)?|sectional|recliner|armchair|ottoman)\b/i, 'Furniture may be leather or down-filled.'],
    [/\b(?:watch(?:es)?|smartwatch)\b/i, 'Watch straps are often leather.'],
    [/\b(?:belts?|wallets?|handbags?|purses?|briefcase)\b/i, 'Often made of leather.'],
    [/\b(?:jackets?|coats?|parkas?|puffers?|vests?|pillows?|comforters?|duvets?)\b/i, 'May contain down, wool or fur trim.'],
    [/\bcondoms?\b/i, 'Many latex condoms use casein (milk protein) \u2014 look for vegan-certified.'],
    [/\b(?:lipsticks?|lip ?gloss(?:es)?|lip ?balms?|mascaras?|eye ?shadows?|blush(?:es)?|eyeliners?|lip ?liners?)\b/i, 'May contain carmine, beeswax, lanolin \u2014 check ingredients.'],
    [/\b(?:baseball glove|mitt|football|basketball|saddle|bridle)\b/i, 'Often made of leather.'],
  ];
  const POSITIVE = [
    ['certified vegan', /\bcertified[- ]vegan\b|\bvegan[- ]certified\b|\bvegan society\b|\bvegan action\b/i, 3],
    ['vegan', /\b(?:100% )?vegan\b/i, 2],
    ['plant-based', /\bplant[- ]based\b|\b100% plant\b/i, 1],
    ['plant milk/cheese', /\bplantmilk\b/i, 1],
  ];
  const DAIRY_FREE = /\bdairy[- ]free\b/i, EGG_FREE = /\begg[- ]free\b/i;

  // 0.4.31: cosmetic shade names ('Black Honey', 'Honey Nude', 'honey blonde' hair dye) are colours, not honey. Only with a colour-cosmetic context.
  const COLOR_COSMETIC = /\b(?:lipsticks?|lip ?(?:gloss|stain|liner|tint|crayon|colou?r|oil|lacquer)s?|blush(?:es)?|eye ?shadows?|palettes?|nail (?:polish|lacquer|colou?r)s?|foundations?|concealers?|bronzers?|highlighters?|eye ?liners?|mascaras?|hair (?:dye|colou?r)|shades?|colou?rs)\b/i;
  const HONEY_SHADE = /\b(?:(?:black|pink|golden|gold|sweet|wild|nude|warm|dark|light|deep|medium|rose|rosy|bronze|amber|brown|red|peach|spiced|toasted|burnt|smoky|cool)[- ]honey|honey[- ](?:nude|blonde?|brown|beige|bronze|glow|gold|golden|pink|rose|peach|tan|caramel|sand|mauve|shimmer|matte|blush|toffee|dew|kiss)s?)\b(?![- ](?:extract|infused|ingredients?|scrub|mask|balm))/gi;
  const shadeNeutralize = (t, beauty) => (beauty || COLOR_COSMETIC.test(t)) ? t.replace(HONEY_SHADE, ' shade ') : t;
  // 0.4.33 drinks: food-pairing clauses ("pairs well with cheese", "serve with steak") describe other food, not the drink.
  const DRINK_WORD = /\b(?:wines?|cabernet|merlot|pinot|chardonnay|sauvignon|riesling|ros[eé]|prosecco|champagne|beers?|lagers?|ipa|stouts?|ciders?|sake|whisk(?:e)?y|bourbon|vodka|tequila|mezcal|brandy|cognac|liqueurs?|spirits)\b/;
  const PAIRING = /\b(?:pairs?|paired|pairing(?:s| suggestions?| notes?)?|goes|go|serve[sd]?|serving|enjoy(?:ed)?|delicious|perfect|great|excellent|best|wonderful|ideal|complements?|matches)\b(?:(?!\b(?:made|brewed|fined|contains?|containing|ingredients?|infused|flavou?red|aged|blended|crafted|produced|filtered|clarified|added|allergens?)\b)[^.;!?\n]){0,25}?\b(?:with|alongside|beside|next to|:)\s(?:(?!\b(?:made|brewed|fined|contains?|containing|ingredients?|infused|flavou?red|aged|blended|crafted|produced|filtered|clarified|added|allergens?)\b)[^.;!?\n]){0,120}/g;
  const DRINK_FOOD = new Set(['cheese', 'fish', 'shrimp', 'chicken', 'beef', 'pork', 'bacon', 'meat', 'anchovy']);
  const isDrink = t => DRINK_WORD.test(t.slice(0, 260));
  // 0.4.33 beauty: cosmetic butters are plant butters; "dairy butter"/"milk butter"/"butterfat"/"ghee" stay animal.
  const BEAUTY_WORD = /\b(?:lip ?(?:balms?|butters?|masks?|scrubs?|oils?|sticks?|gloss|treatments?|care)|lipsticks?|balms?|lotions?|moisturi[sz]ers?|skin ?care|body (?:wash|scrub|lotion|cream)|cosmetics?|makeup|hair ?masks?|conditioners?|shampoos?|serums?|hand cream|face cream|spf|sunscreen)\b/;
  const COSMETIC_BUTTER = /\b(?:shea|cocoa|cacao|mango|murumuru|kokum|cupuacu|cupua[cç]u|avocado|olive|illipe|sal|babassu|tucuma|tucum[aã]|aloe|coconut|almond|hemp|jojoba|lip|body|hair|face|hand|foot|whipped body)[- ]butters?\b|\bbutter[- ](?:balms?|lip|stick|cream|mask)\b/g;
  const BEAUTY_BARE_BUTTER = /\b(?<!dairy |cow'?s? |milk |goat'?s? |clarified |real |sweet cream |salted |unsalted )butters?\b(?![- ]?(?:milk|fat|oil|cream\b(?! (?:lip|balm))))/g;
  function preNeutralize(text, beauty, drink) {
    let t = ' ' + String(text || '').toLowerCase().replace(/[\u2010-\u2015]/g, '-') + ' ';
    if (drink || isDrink(t)) t = t.replace(PAIRING, ' foodpairing ');
    t = t.replace(COSMETIC_BUTTER, ' plantbutter ');
    if (beauty || BEAUTY_WORD.test(t)) t = t.replace(BEAUTY_BARE_BUTTER, ' plantbutter ');
    t = t.replace(/\b(?:non|not)[- ]vegan\b/g, ' NONVEGANMARK ');
    t = shadeNeutralize(t, beauty);
    // common false friends
    t = t.replace(/\b(?:peanut|almond|cashew|cocoa|shea|nut|seed|apple|sun|sunflower|soy|body|mango|cocoa)[- ]butter\b/g, ' plantbutter ');
    // Silk (the plant-milk brand) must be recognised before "oat milk" etc. collapse to plantmilk.
    t = t.replace(/\bsilk(?= (?:unsweetened|original|almond|oat|soy|organic|protein|nextmilk|creamer|vanilla|dairy|light|cashew|coconut|plant|chocolate|ultra|extra creamy)\b)/g, ' silkbrand');
    t = t.replace(/\b(?:coconut|oat|almond|soy|rice|cashew|plant|hemp|pea|macadamia|flax|pistachio)[- ]?(?:milk|cream|cheese|creamer|beverage|drink)s?\b/g, ' plantmilk ');
    // "Dairy Free Cheddar Slices": dairy-free cheese/milk analogues
    t = t.replace(/\b(?:(?:dairy|milk)[- ]free|vegan|plant[- ]based)\s+(?:(?!(?:and|or|with|plus|real|not)\b)[a-z]+\s+){0,2}(?:cheddar|mozzarella|parmesan|cheeses?|butter|creamer|cream cheese|ice cream|milk)(?:\s+cheeses?)?\b/g, ' plantmilk ');
    t = t.replace(/\b(?:cream of tartar|ice cream maker|butterfly|butternut|buttercup|eggplant|creamy peanut|cheesecloth|fish ?tank|milk ?thistle|milkweed|hamper|hammer|hamilton|graham|shampoo|silken tofu|silky|silk (?:finish|touch|matte|sheen|smooth|press|screen(?:ed)?|road|n silk|flower|plant|tree|oak|worm free)|silk ?finish|silkscreen|silk-like|liquid silk|silk ?therapy|silk ?skin|chickpeas?|hen of the woods)\b/g, ' ');
    // restaurant supply false friends (0.4.14): utensils/flavourings named after butter, cookie butter, vegan worcestershire
    t = t.replace(/\b(?:cookie|biscoff|speculoos|pistachio|hazelnut|nut|seed)[- ]butter\b|\bbutter[- ](?:spreaders?|knife|knives|dish(?:es)?|curlers?|warmers?|bells?|crocks?|molds?|moulds?|slicers?|pats? dispensers?|flavou?red|flavou?ring|substitute)\b|\b(?:butter|cheese|egg)[- ]?(?:slicers?|graters?|cutters?|separators?|rings?|poachers?|cookers?|cartons? holders?)\b/g, ' utensil ');
    t = t.replace(/\b(?:vegan|vegetarian|anchovy[- ]free|fish[- ]free)\s+worcestershire\b/g, ' plantsauce ');
    t = t.replace(/\b(?:(?:cactus|desserto|apple|mushroom|mycelium|mylo|reishi|pineapple|pi(?:ñ|n)atex|grape|wine|cork|corn|coconut|kombucha|paper|plant[- ]based|bio[- ]based|plant)[- ](?:leathers?|suede|nubuck))|pi(?:ñ|n)atex|desserto|leather[- ]?alternatives?|leatherette|leather[- ](?:look|like)\b/g, ' plantleather '); // 0.4.41 plant-based/faux leathers
    t = t.replace(/\b(?:beyond meat|impossible (?:burger|foods?)|meat[- ]free|meatless)\b/g, ' plantmeat ');
    // vegan supplement forms
    t = t.replace(/\b(?:algae|algal|seaweed|schizochytrium)(?:[- ]based|[- ]derived)?(?:\s+(?:dha|epa|omega[- ]?3s?|oil|vegan|and|\+))*(?:\s+(?:softgels?|soft gels?|capsules?))?/g, ' algaloil ');
    t = t.replace(/\b(?:vitamin d3|cholecalciferol|d3)\s*\(?\s*(?:from|derived from|sourced from)?\s*lichen\)?|\blichen(?:[- ]derived|[- ]based)?\s+(?:vitamin\s+)?d3\b|\bvegan\s+(?:vitamin\s+)?d3\b/g, ' lichend3 ');
    t = t.replace(/\b(?:veggie|vegetable|vegan|plant|hpmc|pullulan|cellulose)\s+(?:soft ?gels?|capsules?|caps)\b/g, ' vegcaps ');
    t = t.replace(/\bvegan\s+collagen(?:\s+(?:builder|booster|support))?\b|\bcollagen\s+(?:builder|booster)\b(?=[^\n]*\b(?:vegan|plant[- ]based)\b)/g, ' vegcollagen ');
    return t;
  }


  // ---------- Amazon attribute table ("Product details" / "Top highlights") ----------
  const MATERIAL_LABEL = /\b(?:fabric|material|materials|outer|sole|lining|upper|fill|filling|leather type|composition|shell|insole|strap|band|item form|specialty|ingredients?|embellishment|trim)\b/i;
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
  // 0.4.30 "Probably vegan": durable non-animal materials (watch cases/bands, hardware, etc.).
  const NONANIMAL = ['aluminum', 'aluminium', 'stainless steel', 'steel', 'titanium', 'metal', 'alloy', 'zinc alloy', 'brass', 'copper', 'silicone',
    'fluoroelastomer', 'sport band', 'sport loop', 'rubber', 'plastic', 'nylon', 'polyester', 'tpu', 'glass', 'sapphire', 'ceramic', 'cotton', 'linen',
    'synthetic', 'pu', 'polyurethane', 'faux leather', 'vegan leather', 'resin', 'carbon fiber', 'carbon fibre', 'wood', 'wooden', 'bamboo', 'acrylic',
    'canvas', 'polycarbonate', 'abs', 'eva', 'pvc', 'mesh', 'elastomer', 'microfiber', 'spandex', 'polypropylene'];
  const NONANIMAL_RE = new RegExp('\\b(?:' + NONANIMAL.map(x => x.replace(/ /g, '[- ]')).join('|') + ')\\b', 'gi');
  // Animal words anywhere on the page block "probably" (after removing faux/vegan forms).
  const ANIMAL_ANY = /\b(?:leathers?|genuine leather|cowhide|calfskin|lambskin|goatskin|pigskin|suede|nubuck|wool(?:en|len)?|merino|cashmere|mohair|angora|alpaca|silk|goose down|duck down|down[- ](?:filled|fill|feather)|feathers?|fur|mink|shearling|sheepskin|horn|bone|pearls?|mother[- ]of[- ]pearl|sea ?shells?|tortoise ?shell|casein|lanolin|beeswax|snakeskin|crocodile|ostrich|ivory|gelatin|carmine)\b/i;
  function probablyVegan(raw, A) {
    let t = String(raw || '').replace(MAT_SAFE, ' ').replace(/\bbone[- ]conduction\b/gi, ' ');
    if (ANIMAL_ANY.test(t) || (A && A.animal.length)) return null;
    const mats = [...new Set(((A && A.hard) || []).concat((String(raw || '').match(NONANIMAL_RE) || []).map(x => x.toLowerCase().replace('-', ' '))))];
    return mats.length ? mats.slice(0, 4) : null;
  }
  // phrases that look animal but aren't
  const MAT_SAFE = /\b(?:faux|vegan|pu|synthetic|man[- ]made|imitation|artificial|plant[- ]based|bio[- ]based|apple|cactus|desserto|mushroom|mycelium|mylo|reishi|pineapple|grape|wine|cork|corn|coconut|kombucha|paper|vegetable|pleather|bonded pu)[- ]+(?:leather|suede|fur|shearling|sheepskin|wool|silk|down|nubuck)\b|\b(?:leather|suede|fur|wool|silk|down|feathers?|shearling|sheepskin|cashmere)[- ]*(?:-?like|look|effect|feel|alternatives?|substitute|free)\b|\bpi(?:ñ|n)atex\b|\bleatherette\b|\bno (?:leather|wool|down|feathers?|fur)\b|\b(?:pull|zip|slip|button|drop|step|shut|break|tear)[- ]?down\b|\bdown(?:load|town|stairs|ward)\b|\b(?:horn|bone)[- ]?(?:-?like|effect|colou?r|white)\b|\bshell[- ]?fabric\b|\bsilky\b|\bsatin\b/gi;
  const SAFE_LABELS = { 'pu leather': 1, 'faux leather': 1, 'vegan leather': 1, 'synthetic leather': 1, 'faux fur': 1, 'faux suede': 1, 'down alternative': 1 };
  function esc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // pairs: [{label, value}] as scraped from the page. Pure function (no DOM).
  function analyzeAttributes(pairs) {
    const out = { hard: [], animal: [], plant: [], rows: [], diet: null, dietVegan: false, dietNonVegan: false, pairs: pairs || [] };
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
      for (const m of v.match(NONANIMAL_RE) || []) { used = true; const k = m.toLowerCase().replace('-', ' '); if (!out.hard.includes(k)) out.hard.push(k); }
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

  // 0.4.70: a bare "fur"/"shearling"/"sherpa" (e.g. Inner material: Fur) is not proof of animal fur.
  // Only fur-specific synthetic wording can clear it. "Faux leather", "vegan leather" or "recycled materials" do not.
  // Real-fur evidence still wins.
  const REAL_FUR = /\b(?:real|genuine|natural|authentic)\s+(?:furs?|shearling|sherpa)\b|\b(?:rabbit|fox|mink|sable|chinchilla|coyote|raccoon|beaver|ermine)\s*(?:furs?|trim|lining)?\b|\brabbit fur\b|\bfox fur\b|\bmink\b|\bsheepskin\b|\bcowhide\b|\bshearling\s*\(\s*genuine\s*\)\b|\bnatural fur\b/i;
  const FUR_SYNTH = /\b(?:faux|fake|imitation|artificial|synthetic|vegan|man[- ]made)\s+(?:furs?|shearling|sherpa)(?:\s+(?:trim|trimmed|lining|lined|collar|hood|cuffs?))?\b|\b(?:furs?|shearling|sherpa)\s*:\s*(?:polyester|acrylic|nylon|modacrylic|polyamide|synthetic|polyurethane|pu)\b|\b(?:polyester|acrylic|nylon|modacrylic)\s+(?:faux\s+)?(?:furs?|shearling|sherpa)\b|\bplush\s+lining\s*\(\s*polyester\s*\)\b/i;
  const LINING_LABEL = /\b(?:lining|inner|insole|fill|filling|lining-description|lining description)\b/i;
  const LINING_SYNTH = /\b(?:synthetic|polyester|acrylic|nylon|modacrylic|polyamide|faux|man[- ]made|plush)\b/i;
  const FURISH_LABEL = /^(?:fur|shearling|sherpa)(?:\s|\(|$)/i;
  function liningNamesSynthetic(pairs) {
    for (const p of pairs || []) {
      if (LINING_LABEL.test(String(p.label || '')) && LINING_SYNTH.test(String(p.value || '')) && !REAL_FUR.test(String(p.value || ''))) return String(p.label).trim() + ': ' + String(p.value).trim();
    }
    return '';
  }
  function resolveAmbiguousFur(raw, matched, A) {
    const drop = (matched || []).filter(m => FURISH_LABEL.test(String(m)));
    const attrFur = !!(A && (A.animal || []).some(m => FURISH_LABEL.test(String(m))));
    let rest = String(raw || '').replace(MAT_SAFE, ' ');
    const hasReal = REAL_FUR.test(rest);
    const synthM = String(raw || '').match(FUR_SYNTH);
    const lining = (A && A.pairs) ? liningNamesSynthetic(A.pairs) : liningNamesSynthetic(A && A._pairs);
    // If the same material row already names a synthetic next to fur, analyzeAttributes may have dropped it;
    // still honour an explicit faux-fur phrase or a lining/inner row that names a synthetic.
    const hasAmbiguous = drop.length || attrFur || (/\b(?:furs?|shearling|sherpa)\b/i.test(rest.replace(FUR_SYNTH, ' ').replace(REAL_FUR, ' ')) && !hasReal);
    if (hasReal && (drop.length || attrFur || /\b(?:furs?|shearling|sherpa)\b/i.test(rest))) return { action: 'real', drop: [], phrase: '' };
    if (!hasAmbiguous && !drop.length) return null;
    if (synthM) {
      const phrase = synthM[0].replace(/\s+/g, ' ').trim().toLowerCase();
      return { action: 'synth', drop, phrase: phrase + ' (from the product details)' };
    }
    if (lining) return { action: 'synth', drop, phrase: lining.toLowerCase() + ' (from the product details)' };
    return { action: 'caution', drop, phrase: '' };
  }

  const Brands = (typeof module !== 'undefined' && module.exports) ? require('./veganBrands.js') : root.VeganBrands;

  function classify(text, opts) {

    opts = opts || {};
    const strict = opts.strictness !== 'lenient';
    const A = opts.attributes ? analyzeAttributes(opts.attributes) : null;
    let raw = String(text || '') + (A && A.text ? '\n' + A.text : '');
    // 0.4.62 noun-head rule (shared rule data): 'Poultry Fencing', 'Chicken Wire Mesh', 'Fish Tank Filter' are equipment, not animal products.
    try { const RL = (typeof module !== 'undefined' && module.exports) ? require('./rules/rules.js') : root.VeganRules; const EQ = RL && RL.data().classifier.EQUIPMENT_HEAD;
      if (EQ instanceof RegExp) raw = raw.replace(new RegExp(EQ.source, 'gi'), ' _ '); } catch (e) {}
    let t = preNeutralize(raw, opts.beauty, opts.drink);
    const t0 = t;
    const negated = [];
    let matched = [];
    for (const [label, src, level] of NEGATIVE) {
      if (level === 'strict' && !strict) continue;
      if (level === 'strict-weak') continue; // too ambiguous; reported nowhere
      const term = '(?:' + src + ')';
      // remove negated / safe forms first
      // 0.4.45: '<x>-free' only negates x itself. Lactose-free (like hormone-, gluten-, antibiotic-, cage-free) is still dairy.
      const negRe = new RegExp('\\b' + NEG_PREFIX + term + '\\b|' + (KEEP_SUFFIX.has(label) ? '' : '\\b' + term + NEG_SUFFIX + '|') + '\\b' + SAFE_PREFIX + term + '\\b', 'g');
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
    // 0.4.34 drinks: a dish named on a drink page (pairing / serving / recipe text) never makes the drink non-vegan.
    else if (matched.length && (opts.drink || isDrink(' ' + raw.toLowerCase())) && matched.every(m => DRINK_FOOD.has(m))) verdict = 'unknown';
    else if (matched.length) verdict = 'non-vegan';
    else if (score >= 1) verdict = 'vegan';
    if (A && A.plant.length && !A.animal.length && !matched.length && !explicitNonVegan) {
      positives.push('materials: ' + A.plant.join(', '));
      if (verdict === 'unknown') verdict = 'vegan';
    }
    let caution = verdict === 'unknown' ? CAUTION.filter(c => c[0].test(String(text || ''))).map(c => c[1]).slice(0, 2) : [];
    // 0.4.30: unknown/caution + only non-animal materials listed (spec rows, or title/bullets for a caution category) -> 'probably'.
    let probable = null;
    if (opts.allowProbably && verdict === 'unknown' && !matched.length && !explicitNonVegan && ((A && A.hard.length) || caution.length)) {
      probable = probablyVegan(raw, A);
      if (probable) { verdict = 'probably'; caution = []; }
    }
    // 0.4.70: don't treat a bare fur/shearling row as non-vegan unless real-fur evidence is present.
    const furFix = resolveAmbiguousFur(raw, matched, A);
    if (furFix && furFix.action === 'real') { /* keep existing non-vegan matches */ }
    else if (furFix && (furFix.action === 'synth' || furFix.action === 'caution')) {
      if (furFix.drop && furFix.drop.length) matched = matched.filter(m => !furFix.drop.includes(m));
      const onlyFur = !matched.length && !explicitNonVegan && !(wl && wl.some(e => e.user || e.name));
      if (onlyFur || (furFix.action === 'caution' && !matched.length && !explicitNonVegan)) {
        if (furFix.action === 'synth') {
          if (opts.allowProbably) { verdict = 'probably'; caution = []; probable = furFix.phrase ? [furFix.phrase] : ['faux fur']; }
          else if (verdict === 'non-vegan') { verdict = 'unknown'; caution = []; }
          if (furFix.phrase && !positives.includes(furFix.phrase)) positives.push(furFix.phrase);
        } else {
          verdict = 'unknown';
          probable = null;
          caution = ['May contain animal products.'];
        }
      }
    }
    // A page that only names faux/synthetic fur (no leftover bare fur) should surface as probably vegan, not a generic unknown.
    if (opts.allowProbably && verdict === 'unknown' && !explicitNonVegan && !matched.length && !REAL_FUR.test(raw)) {
      const sm = String(raw || '').match(FUR_SYNTH);
      if (sm) {
        const phrase = sm[0].replace(/\s+/g, ' ').trim().toLowerCase() + ' (from the product details)';
        verdict = 'probably'; caution = []; probable = [phrase];
        if (!positives.includes(phrase)) positives.push(phrase);
      }
    }
    return { verdict, caution, probable, matched: verdict === 'vegan' ? [] : matched, positives, negated, whitelisted: wl.map(e => e.name), attributeRows: A ? A.rows : [], materialsOnly: !!(A && A.plant.length && verdict === 'vegan' && score < 1 && !wl.length) };
  }

  // 0.4.31 verdict priority: database > on-page ingredients > title guess; a clear on-page animal ingredient is never overridden
  // (conflict -> caution with both reasons). page: {verdict, matched, certifiedVegan}; db: {verdict, source, certified} | null.
  function resolveDb(page, db) {
    if (!db || db.verdict === 'unknown' || db.verdict === 'maybe') return { verdict: page.verdict, source: 'page', note: db && db.verdict === 'maybe' ? db.source + ': maybe vegan' : '' };
    const note = 'from ' + db.source + (db.certified ? ' (vegan label)' : '');
    if (db.verdict === 'vegan' && page.matched && page.matched.length)
      return { verdict: 'unknown', caution: [db.source + ' lists this as vegan, but the page mentions: ' + page.matched.join(', ') + '.'], source: 'conflict', note };
    if (db.verdict === 'non-vegan' && page.certifiedVegan)
      return { verdict: 'unknown', caution: [db.source + ' lists this as non-vegan, but the page says certified vegan.'], source: 'conflict', note };
    return { verdict: db.verdict, source: db.source, note };
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

  const api = { isDrink: t => isDrink(' ' + String(t || '').toLowerCase()), classify, analyzeAttributes, resolveAmbiguousFur, ANIMAL_MATERIALS, PLANT_SYNTH, lookupOpenFoodFacts, NEGATIVE, resolveDb };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VeganClassifier = api;
})(typeof self !== 'undefined' ? self : this);
