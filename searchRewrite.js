// Pure search-query rewriting. Browser global (VeganSearchRewrite) + Node module.
(function (root) {
  'use strict';
  const ALREADY = /\b(?:vegan|plant[- ]based|dairy[- ]free|meat[- ]?free|meatless|vegetarian|egg[- ]free)\b/i;
  const FALSE_FRIENDS = /\b(?:kevin bacon|francis bacon|bacon number|phishing|ham radio|hamilton|game of chicken|chicken pox|chickenpox|beef (?:with|between)|rap beef|cold turkey|turkey (?:election|earthquake|travel|visa|lira)|steak ?(?:holder|knife sharpen)|witch hunt|job hunt|house hunt|fishing (?:scam|email|attack)|fur ?baby|butterfly|buttercup|butternut|eggplant)\b/i;
  const FOOD = /\b(?:steaks?|burgers?|cheeseburgers?|(?:chicken )?wings|chicken|beef|pork|bacon|ribs|brisket|meatballs?|meatloaf|sausages?|hot dogs?|ham|turkey|lamb|veal|tacos?|burritos?|nachos|chili|lasagna|pizza|spaghetti carbonara|carbonara|alfredo|mac and cheese|mac ?n ?cheese|macaroni and cheese|cheesecake|cheese|pancakes?|waffles?|french toast|omelett?es?|scrambled eggs|eggs?|brownies?|cookies?|cakes?|cupcakes?|muffins?|ice cream|milkshakes?|smoothies?|quiche|meringue|custard|tiramisu|butter chicken|curry|ramen|pho|sushi|salmon|tuna|shrimp|lobster|crab|seafood|fish|jerky|bbq|barbecue|nuggets?|fried chicken|gravy|mayonnaise|mayo|protein powder|gummies|gummy bears|marshmallows?|mukbang|asmr eating|food challenge|eating challenge|carnivore diet|steakhouse|grilling|smoking meat|fishing|hunting|deer hunting|fly fishing)\b/i;
  const INTENT = /\b(?:recipes?|restaurants?(?: near me)?|food near me|delivery|takeout|where to eat|meal prep|dinner ideas?|lunch ideas?|breakfast ideas?)\b/i;
  const FASHION = /\b(?:leather|suede|wool|cashmere|silk|fur|down) (?:jackets?|coats?|boots|shoes|bags?|handbags?|belts?|wallets?|sofas?|couch|sweaters?|scarf|scarves|comforters?|pillows?|gloves|sneakers)\b/i;
  const LEAD = /^(?:(?:the )?(?:best|easy|easiest|quick|simple|healthy|homemade|authentic|ultimate|perfect|cheap|good|top \d+)\s+)+|^how to (?:make|cook|bake|grill|smoke|fry|bbq)\s+(?:a |an |the )?|^where to (?:buy|get|eat)\s+/i;

  function rewriteQuery(q) {
    const s = String(q || '').trim().replace(/\s+/g, ' ');
    if (!s || s.length > 120) return null;
    if (ALREADY.test(s) || FALSE_FRIENDS.test(s)) return null;
    if (!(FOOD.test(s) || INTENT.test(s) || FASHION.test(s))) return null;
    const m = s.match(LEAD);
    if (m && m[0].length < s.length) return s.slice(0, m[0].length) + 'vegan ' + s.slice(m[0].length);
    return 'vegan ' + s;
  }
  // Amazon search page shows result cards? False on the "Sorry! Something went wrong" (dogs of Amazon) error page
  // and on empty searches: the search-assist banner is suppressed there.
  const RESULT_CARD = "[data-component-type='s-search-result'], div[data-asin].s-result-item";
  function amazonHasResults(doc) {
    if (!doc || !doc.querySelector) return false;
    return [...doc.querySelectorAll(RESULT_CARD)].some(n => n.getAttribute('data-asin'));
  }
  const api = { rewriteQuery, amazonHasResults };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VeganSearchRewrite = api;
})(typeof self !== 'undefined' ? self : this);
