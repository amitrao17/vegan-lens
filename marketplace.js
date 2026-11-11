// Vegan Lens on Facebook Marketplace: materials badges (Vegan / Not vegan / Caution) and live-animal sales.
// Adoption listings (adopt, rescue, rehome with a small fee, free to a good home) are left alone; animals sold for profit are dimmed.
// Only the item text is read; seller names and locations are ignored and no people marks run here.
(function (root) {
  'use strict';
  const ANIMAL = /\b(?:pupp(?:y|ies)|pups?|kittens?|kitties|dogs?|cats?|chicks?|chickens?|hens?|pullets?|roosters?|ducks?|ducklings?|geese|goslings?|turkeys?|quail|goats?|kids? goats?|sheep|lambs?|ewes?|rams?|pigs?|piglets?|hogs?|boars?|sows?|cows?|calf|calves|heifers?|steers?|bulls?|cattle|horses?|ponies|pony|mares?|fill(?:y|ies)|colts?|geldings?|donkeys?|alpacas?|llamas?|rabbits?|bunn(?:y|ies)|parrots?|parakeets?|budgies?|cockatiels?|lovebirds?|finches|canar(?:y|ies)|snakes?|ball pythons?|boas?|bearded dragons?|geckos?|lizards?|tortoises?|turtles?|hamsters?|gerbils?|guinea pigs?|ferrets?|chinchillas?|rats?|mice|koi|goldfish|bettas?|cichlids?|tarantulas?|hatching eggs|fertile eggs)\b/i;
  const BREED = /\b(?:yorkie|yorkiepoo|\w*doodle|\w*poo|shih tzu|maltese|pomeranian|chihuahua|dachshund|beagle|corgi|husky|huskies|malamute|labrador|lab pupp|retriever|golden(?:s)? pupp|german she(?:p|pp)h?(?:e|a)rd|great pyrenees|pyrenees|terriers?|bulldogs?|frenchies?|pit ?bulls?|rottweiler|doberman|boxer pupp|cane corso|mastiff|aussie|australian shepherd|border collie|collie|cavalier|havanese|bichon|schnauzer|ragdoll|maine coon|sphynx|bengal kitten|jack russell?|nubian|nigerian dwarf|boer|angus|holstein|silkie|orpington|leghorn|rhode island red|brahma|quarter horse|thoroughbred|mini(?:ature)? horse)\b/i;
  // Supplies, toys and lookalikes are not animals.
  const NOT_ANIMAL = /\b(?:toys?|plush|stuffed|puzzles?|puzzel|stukjes|stukken|\d+ (?:pieces?|pcs)|figurines?|statues?|ornaments?|prints?|posters?|paintings?|books?|costumes?|crates?|kennels?|cages?|coops?|hutch(?:es)?|tanks?|aquariums?|terrariums?|beds?|collars?|leash(?:es)?|harness(?:es)?|food|feed|feeders?|waterers?|bowls?|carriers?|strollers?|gates?|fences?|doors?|incubators?|brooders?|heat lamps?|saddles?|bridles?|trailers?|tack|clippers?|grooming|litter|scratch(?:er|ing)|trees?|shel(?:f|ves)|perch(?:es)?|condos?|hammocks?|furniture|cat walls?|wall[- ]mounted|climbers?|treats?|toys?|towers?|ramps?|playpens?|pens?|blankets?|clothes|sweaters?|shirts?|mugs?|decals?|stickers?|signs?|lamps?|mats?|pillows?|rugs?|cart|jack|bed liner|mouse pad|mice pad|computer mouse|gaming mouse|wireless mouse|hot ?wheels|dodge ram|ram (?:1500|2500|3500|truck)|mustang|jaguar|bronco|beetle|hornet|cobra|impala|charger|challenger|scrubs?)\b/i;
  const ADOPT = /\b(?:adopt(?:ion|ing|able)?|rescue[ds]?|rehom(?:e|es|ed|ing)|free to (?:a )?(?:good|loving|forever) home|forever home|need(?:s)? (?:a )?(?:new )?home|surrender(?:ed)?|shelter|foster(?:ing)?)\b/i;
  const SALE = /\b(?:for sale|breeder|breeding|bred|akc|ckc|registered|champion (?:lines?|bloodlines?)|stud|deposits?|reserve (?:yours|now)|litter|ready (?:for|to go)|available now|left!?)\b/i;
  const price = s => { const m = String(s || '').match(/(?:^|\|)\s*(free|\$\s?[\d,]+(?:\.\d+)?)/i); if (!m) return null; return /free/i.test(m[1]) ? 0 : +m[1].replace(/[$,\s]/g, ''); };
  // Positive live-animal signals. A bare animal noun next to any other noun ("cat wheel", "rooster statue") is not one.
  const LIVE = /\b(?:kittens?|kitties|pupp(?:y|ies)|pups|piglets?|chicks|ducklings?|goslings?|foals?|calves|lambs|kids? goats?|goat kids|bunnies|purebred|pure ?bred|mixed breed|akc|ckc|tica|\d+\s*(?:wks?|weeks?|mos?|months?|years?|yrs?)(?:\s*old)?|males?|females?|m\/f|pairs?|vaccinated|vaccines?|shots|de-?wormed|vet checked|health (?:guarantee|certificate)|ready (?:to go|for (?:their |a )?(?:new |forever )?homes?)|go home|rehoming fee|for sale|sale|breeders?|breeding|litter of|hatching eggs|fertile eggs|laying hens|layers|roosters|pullets|livestock|head of cattle|cattle|bred|registered|deposits?|reserve (?:yours|now)|(?:only )?\d+ left|left!)\b/i;
  // Returns 'adoption' | 'sale' | null (not a live-animal listing). A bare animal-only title ("Cat", $50) stays neutral (null).
  function animalListing(title, desc, cost) {
    const t = String(title || ''), all = t + ' ' + String(desc || '');
    if (!(ANIMAL.test(t) || BREED.test(t))) return null;
    if (NOT_ANIMAL.test(t)) return null; // extra guard only
    const adopt = ADOPT.test(all), sale = SALE.test(all);
    if (cost === 0 && !sale) return 'adoption';
    if (adopt && !/\bbreeder|akc|ckc|stud\b/i.test(all) && (cost == null || cost <= 300)) return 'adoption';
    return BREED.test(t) || LIVE.test(all) ? 'sale' : null;
  }
  // Card innerText is "Just listed | $130 | $180 | Title | City, ST": the title is the first line that isn't a price or tag, and the last line (location) is dropped.
  function cardParts(text) {
    const lines = String(text || '').split(/\n| \| /).map(s => s.trim()).filter(Boolean);
    const body = lines.filter(l => !/^(?:just listed|partner listing|sponsored|free|\$[\d,.]+|price dropped|pending|sold)$/i.test(l));
    return { title: body.length > 1 ? body.slice(0, -1).join(' ') : (body[0] || ''), price: price(lines.join(' | ')) };
  }
  // 0.4.48: sponsored tiles in the browse grid link off-site (not /marketplace/item/) and end with an 'Ad' line.
  // Their text = visible lines (minus the Ad label) + image alt / aria-label (incl. "text that says '...'") + link labels.
  const AD_LINE = /^[\s\u200b]*(?:ad|sponsored)[\s\u200b]*$/i;
  const UI_LABEL = /^(?:open menu|shop now|see details|learn more|download|sign up|play|pause|resume reel|left arrow|right arrow|loading.*|more|close|video player|play video|change position|enter fullscreen|exit fullscreen|change volume|mute|unmute|settings|[0-9:]+ \/ [0-9:]+)$/i;
  const altSays = t => { const m = String(t || '').match(/text that says ['"\u201c\u2018](.+?)['"\u201d\u2019]?\s*$/i); return m ? m[1].trim() : ''; };
  const isItemLink = a => /\/marketplace\/item\//.test(a.getAttribute('href') || '');
  function adTiles(root) {
    const out = new Set();
    for (const l of root.querySelectorAll('span, div')) {
      if (l.querySelector('span, div') || !AD_LINE.test(l.textContent || '')) continue;
      let el = l.parentElement;
      for (let i = 0; el && i < 12; i++, el = el.parentElement) {
        if (el.tagName === 'BODY' || el.getAttribute('role') === 'main') { el = null; break; }
        const links = [...el.querySelectorAll('a[href]')];
        if (links.some(isItemLink)) { el = null; break; } // climbed into the grid
        if (links.length && el.querySelector('img, [role=img]')) break;
      }
      if (el) out.add(el);
    }
    return [...out];
  }
  function adText(el) {
    const lines = String(el.innerText != null ? el.innerText : el.textContent || '').split('\n').map(x => x.trim()).filter(x => x && !AD_LINE.test(x) && !UI_LABEL.test(x));
    const extra = [];
    for (const n of el.querySelectorAll('img, [role=img], a[aria-label], [aria-label]')) for (const v of [n.getAttribute('alt'), n.getAttribute('aria-label')]) {
      const t = String(v || '').trim(); if (!t || UI_LABEL.test(t)) continue;
      const q = altSays(t); extra.push(q || t.replace(/^may be an image of\s*/i, ''));
    }
    return [...new Set([...lines, ...extra])].join(' . ').slice(0, 900);
  }
  const DAIRY = /^(?:cheese|milk|butter|cream|yogurt|dairy|whey|casein|ghee|mozzarella|cheddar|parmesan)$/i;
  const dairyFreeOnly = (text, matched) => /\bdairy[- ]free\b/i.test(text) && matched.length && matched.every(m => DAIRY.test(m));
  const api = { animalListing, cardParts, price, adTiles, adText, dairyFreeOnly };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.VeganMarketplace = api;
  if (typeof document === 'undefined' || !root.chrome || !chrome.storage) return;

  const C = root.VeganClassifier;
  const DEFAULTS = { enabled: true, mode: 'dim', strictness: 'strict', marketplace: true, whitelist: [], whitelistDisabled: [], pageBlock: [], siteBlock: [] };
  let S = { ...DEFAULTS };
  let counts = { vegan: 0, nonvegan: 0, unknown: 0, context: 0, ads: 0, scanned: 0, caution: 0 }, sendT = null;
  try { chrome.runtime.onMessage.addListener(m => { if (m && m.type === 'recount') send(); }); } catch (e) {} // 0.4.59
  const send = () => { try { chrome.runtime.sendMessage({ type: 'counts', source: 'marketplace', counts }); } catch (e) {} };
  const count = k => { counts[k]++; clearTimeout(sendT); sendT = setTimeout(send, 300); };
  const on = () => S.enabled && S.marketplace;
  function pill(el, cls, text, title) { const b = document.createElement('span'); b.className = 'vl-mp-pill ' + cls; b.textContent = text; if (title) b.title = title; (typeof VeganLensBrand !== 'undefined' ? VeganLensBrand.mark : typeof require === 'function' ? require('./brand.js').mark : (e => e))(b, { compact: true }); el.appendChild(b); return b; }
  function dim(el, why) {
    el.classList.add('vl-mp-dim');
    const lab = pill(el, 'vl-mp-why', why + ' · show', 'Click to show anyway');
    lab.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); try { chrome.runtime.sendMessage({ type: 'stat', k: 'reveal' }); } catch (x) {} el.classList.remove('vl-mp-dim'); lab.remove(); }, true);
  }
  function judge(el, title, desc, cost) {
    counts.scanned++; const a = animalListing(title, desc, cost);
    if (a === 'adoption') { pill(el, 'vl-mp-adopt', '🐾 Adoption', 'Vegan Lens: adoption or rehoming listing'); return; }
    if (a === 'sale') { el.dataset.vlWhy = 'animal for sale'; count('nonvegan'); dim(el, 'Animal for sale (not adoption)'); return; }
    const r = C.classify(title + ' ' + (desc || ''), S);
    if (r.verdict === 'vegan' || r.verdict === 'non-vegan') el.dataset.vlWhy = r.verdict === 'vegan' ? 'Vegan' : 'contains ' + r.matched.join(', ');
    if (r.verdict === 'vegan') { count('vegan'); pill(el, 'vl-mp-vegan', '🌱 Vegan', 'Signals: ' + r.positives.join(', ')); }
    else if (r.verdict === 'non-vegan') { count('nonvegan'); if (S.mode === 'badge') pill(el, 'vl-mp-non', '✕ Not vegan: ' + r.matched.join(', ')); else dim(el, 'Not vegan: ' + r.matched.join(', ')); }
    else if (r.caution && r.caution.length) { count('unknown'); counts.caution++; pill(el, 'vl-mp-caution', '⚠ Caution: may contain animal products', r.caution.join(' ')); }
  }
  function scanCards() {
    for (const a of document.querySelectorAll('a[href*="/marketplace/item/"]:not([data-vl-mp])')) {
      const t = (a.innerText || '').trim(); if (!t) continue;
      a.dataset.vlMp = '1'; if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
      const p = cardParts(t); if (p.title) judge(a, p.title, '', p.price); imageStats(a, !!a.dataset.vlWhy || !!a.querySelector('.vl-mp-pill'));
    }
  }
  function scanAds() {
    for (const el of adTiles(document)) {
      if (el.dataset.vlMp) continue;
      const text = adText(el); if (text.length < 6) continue;
      el.dataset.vlMp = 'ad'; el.dataset.vlAd = '1'; if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      const r = C.classify(text, S), dfo = r.verdict === 'non-vegan' && dairyFreeOnly(text, r.matched);
      if (root.VeganAdUnits) { const st = root.VeganAdUnits.adImageStats(el); try { chrome.runtime.sendMessage({ type: 'stat', k: 'adImg', images: st.images, textless: st.textless, undecided: !dfo && r.verdict !== 'vegan' && r.verdict !== 'non-vegan' }); } catch (e) {} } // 0.4.49 opt-in aggregate, once per tile (data-vl-mp)
      imageStats(el, dfo || r.verdict === 'vegan' || r.verdict === 'non-vegan');
      if (dfo) continue;
      counts.ads++; judge(el, text, '', null);
    }
  }
  // 0.4.49: opt-in aggregate image stats for grid tiles and sponsored tiles (dedupe data-vl-img-stat), booleans/counts only
  function imageStats(el, decided) {
    const A = root.VeganAdUnits; if (!A) return; let n = 0, cl = 0, clu = 0; const text = el.innerText || '';
    for (const img of el.querySelectorAll('img:not([data-vl-img-stat]), [role=img]:not([data-vl-img-stat])')) {
      if (!A.imgMeaningful(img)) continue; img.dataset.vlImgStat = '1'; n++;
      if (A.imageContextless(img, text)) { cl++; if (!decided) clu++; }
    }
    if (n) try { chrome.runtime.sendMessage({ type: 'stat', k: 'img', n, contextless: cl, undecided: clu }); } catch (e) {}
  }
  function scanItem() {
    if (!/\/marketplace\/item\//.test(location.pathname) || document.getElementById('vl-mp-banner')) return;
    const h = document.querySelector('[role="main"] h1, h1'); if (!h || !h.innerText.trim()) return;
    const main = h.closest('[role="main"]') || document.body;
    const descEl = [...main.querySelectorAll('span[dir="auto"], div[dir="auto"]')].map(e => e.innerText || '').filter(s => s.length > 40).sort((x, y) => y.length - x.length)[0] || '';
    const cost = price(((h.parentElement && h.parentElement.parentElement) || main).innerText.split('\n').slice(0, 6).join(' | '));
    const box = document.createElement('div'); box.id = 'vl-mp-banner';
    judge(box, h.innerText, descEl.slice(0, 3000), cost);
    if (!box.firstChild) return;
    h.insertAdjacentElement('afterend', box);
  }
  function clearAll() {
    document.querySelectorAll('.vl-mp-pill').forEach(n => n.remove()); document.querySelectorAll('.vl-mp-dim').forEach(n => n.classList.remove('vl-mp-dim'));
    document.querySelectorAll('[data-vl-mp]').forEach(n => delete n.dataset.vlMp); const b = document.getElementById('vl-mp-banner'); b && b.remove();
    counts = { vegan: 0, nonvegan: 0, unknown: 0, context: 0, ads: 0, scanned: 0, caution: 0 }; send();
  }
  let t = null, lastUrl = location.href;
  const onMp = () => /^\/marketplace(?:\/|$)/.test(location.pathname); // 0.4.48: also injected on facebook.com (SPA navigation into Marketplace)
  const run = () => { if (!on() || !onMp()) return; if (location.href !== lastUrl) { lastUrl = location.href; clearAll(); } scanCards(); scanAds(); scanItem(); };
  chrome.storage.sync.get(DEFAULTS, s => { S = s; run(); new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 500); }).observe(document.body, { childList: true, subtree: true }); });
  chrome.storage.onChanged.addListener((ch, area) => { if (area !== 'sync') return; for (const k in ch) S[k] = ch[k].newValue; clearAll(); run(); });
  // 0.4.55: re-run on rule-list changes (editor apply/reset, signed update), debounced.
  let rulesTimer = null;
  if (window.VeganRules && window.VeganRules.onChange) window.VeganRules.onChange(() => { clearTimeout(rulesTimer); rulesTimer = setTimeout(() => { clearAll(); run(); }, 250); });
})(typeof window !== 'undefined' ? window : globalThis);
