// Maps headline/snippet text to animal-industry news topics. Browser global + Node module.
(function (root) {
  'use strict';
  const TOPICS = {
    fur_farming: /\b(?:fur farms?|fur farming|fur industry|mink (?:farms?|farming|farmers?|industry)|fox farms?|raccoon dogs? farms?|(?:on|at) (?:a |the )?mink|minks?\b(?=.*\b(?:farm|outbreak|flu|virus|covid|cull)))/,
    factory_farming: /\b(?:factory farm(?:s|ing|ed)?|cafos?|concentrated animal feeding|battery cages?|gestation crates?|intensive (?:livestock|animal|poultry|pig) farm(?:s|ing)?|megafarms?|industrial (?:animal )?agriculture)\b/,
    avian_flu: /\b(?:bird flu|avian (?:flu|influenza)|h5n1|h5n\d|hpai)\b/,
    dairy: /\b(?:dairy (?:cows?|cattle|herds?|farms?|industry|workers?)|raw milk (?:recall|outbreak|warning)|calves separated|dairy farm)\b/,
    fishing_oceans: /\b(?:bycatch|overfish(?:ing|ed)|trawl(?:ing|ers?)|fish stocks?|fisheries collapse|ghost (?:nets|gear)|bottom trawling|illegal fishing|shark finning|whaling|dolphins? (?:killed|caught|deaths))\b/,
    slaughter_workers: /\b(?:slaughterhouses?|abattoirs?|meatpack(?:ing|ers?)|meat ?packing|meat processing plants?|poultry plants?|processing plant workers?|kill floor)\b/,
    antibiotics: /\b(?:antibiotic resistance|antimicrobial resistance|superbugs?|drug[- ]resistant (?:bacteria|infections?)|antibiotics? (?:in|on) (?:livestock|farms?|animals|meat|poultry))\b/,
    zoonotic: /\b(?:zoonotic|zoonos[ie]s|spillover|pandemic|spark (?:a |the )?(?:human )?(?:pandemic|outbreak)|jump(?:s|ed)? to humans|human (?:case|cases|infection|transmission))\b/,
    climate_deforestation: /\b(?:deforestation|amazon (?:rainforest|fires?)|cattle ranch(?:ing|es|ers)?|livestock emissions|methane from (?:cows|cattle|livestock)|(?:beef|meat|livestock|cattle)(?:'s)? (?:carbon|climate|emissions|footprint))\b/,
    animal_testing: /\b(?:animal testing|tested on animals|animal experiments?|lab(?:oratory)? animals|animal research|vivisection|beagles? (?:bred|lab|testing|rescued))\b/,
    live_export: /\b(?:live (?:animal )?exports?|live sheep|live cattle (?:exports?|ships?|shipments?)|livestock (?:ships?|carriers?|transport))\b/,
    wildlife_markets: /\b(?:wet markets?|wildlife (?:markets?|trade|trafficking)|bushmeat|pangolins?|exotic (?:animal|pet) trade)\b/,
  };
  const RECIPE = /\b(?:recipes?|how to (?:cook|grill|make|smoke)|best (?:steak|burger|bbq)|deals?|on sale)\b/;
  // News / ethics framing markers. A topic match plus one of these => context card.
  const NEWS = /\b(?:outbreaks?|experts?|officials?|study|studies|report(?:s|ed)?|investigat\w*|warn\w*|ban(?:s|ned)?|law|bill|risk|crisis|scientists?|health|workers?|cases?|spread\w*|says?|said|could|would|won't|fail\w*|exposes?|new|why|deaths?|died|kill\w*|cruelty|welfare|virus|pandemic|cull\w*|recall\w*|epa|usda|cdc|who|fda|un)\b/;
  const TEXT = s => String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, "'");

  function detectTopics(input) {
    const p = typeof input === 'string' ? { headline: input } : (input || {});
    const t = ' ' + TEXT(p.headline) + ' ' + TEXT(p.snippet) + ' ';
    const topics = Object.keys(TOPICS).filter(k => TOPICS[k].test(t));
    // zoonotic alone is too broad (generic pandemic news) unless an animal topic also matched
    const animal = topics.filter(k => k !== 'zoonotic');
    const final = animal.length ? topics : [];
    const isContext = final.length > 0 && !RECIPE.test(t) && NEWS.test(t);
    return { topics: final, isContext };
  }
  const api = { detectTopics, TOPICS: Object.keys(TOPICS) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganContextTopics = api;
})(typeof self !== 'undefined' ? self : this);
