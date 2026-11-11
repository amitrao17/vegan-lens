// Firefox (event page) loads these via manifest background.scripts instead (0.4.59 Firefox build).
if (typeof importScripts === 'function') importScripts('rules/rulesData.js', 'rules/rules.js', 'classifier.js', 'badge.js', 'pageKey.js', 'total.js', 'offers.js', 'dbLookup.js');
const empty = () => ({ vegan: 0, nonvegan: 0, unknown: 0, context: 0, ads: 0, scanned: 0, caution: 0, pageVegan: 0 });
let allClearOn = true; // 'Show all-clear check' option
chrome.storage.sync.get({ allClear: true }, s => { allClearOn = s.allClear !== false; });
const key = id => 'tab:' + id;
let cardsP = null;
let peopleP = null;
const getPeople = () => peopleP || (peopleP = fetch(chrome.runtime.getURL('people.json')).then(r => r.json()));
const getCards = () => cardsP || (cardsP = fetch(chrome.runtime.getURL('cards.json')).then(r => r.json()));

// ---- Opt-in, de-identified usage stats (off by default; nothing is sent unless shareStats is on AND STATS_URL is set).
const STATS_URL = '';
// ---- Partner offers (0.4.29). Matching happens in the content scripts, on-device. The list is shipped (coupons.json); an optional
// remote list (same for every user, no identifiers, credentials omitted) can be set here and is fetched at most once a day.
const DB_STORE = { get: async () => (await chrome.storage.local.get('dbCache')).dbCache || {}, set: v => chrome.storage.local.set({ dbCache: v }) };
async function dbLookup(m) {
  const { dbLookups } = await chrome.storage.sync.get({ dbLookups: true }); if (!dbLookups) return null;
  if (m.db !== 'off' && m.db !== 'obf') return null;
  return VeganDB.lookup(m.db, { code: m.code, brand: m.brand, name: m.name }, { fetch: (u, o) => fetch(u, o), store: DB_STORE });
}
const COUPONS_URL = ''; // blank = never fetched
let couponsP = null;
async function fetchRemoteCoupons(force) {
  if (!COUPONS_URL) return null; // no network call at all when blank
  const { couponsCache } = await chrome.storage.local.get('couponsCache');
  if (!force && couponsCache && couponsCache.day === today()) return couponsCache.list;
  try {
    const r = await fetch(COUPONS_URL, { credentials: 'omit', cache: 'no-store' });
    const list = VeganOffers.validate(await r.json());
    await chrome.storage.local.set({ couponsCache: { day: today(), list } }); return list;
  } catch (e) { return couponsCache ? couponsCache.list : null; }
}
const getCoupons = () => couponsP || (couponsP = (async () => {
  let shipped = []; try { shipped = VeganOffers.validate(await (await fetch(chrome.runtime.getURL('coupons.json'))).json()); } catch (e) {}
  const remote = await fetchRemoteCoupons(); couponsP = null; // re-read daily
  return shipped.concat(remote || []);
})()); // e.g. 'https://vegan-lens-stats.<you>.workers.dev/v1' once deployed (see telemetry/README.md)
const siteType = u => { let h = ''; try { h = new URL(u).hostname; } catch (e) {}
  return /(^|\.)amazon\./.test(h) ? 'amazon' : /youtube\.com$/.test(h) ? 'youtube' : /(^|\.)(google|bing|duckduckgo)\./.test(h) ? 'search'
    : /giantfood|stopandshop|martinsfoods|giantfoodstores|webstaurantstore|restaurantdepot/.test(h) ? 'grocery' : /walgreens|cvs\.com|goodrx|pharmacy\.amazon/.test(h) ? 'pharmacy' : 'other'; };
const today = () => new Date().toISOString().slice(0, 10);
const round5 = n => Math.round(n / 5) * 5;
const SHARE_DESTS = ['copy', 'email', 'x', 'facebook', 'reddit', 'whatsapp', 'telegram', 'linkedin', 'native'];
const AD_IMG_KEYS = ['adsSeen', 'adsWithImages', 'adsImageTextless', 'adsTextlessUndecided'];
const adImagesReport = st => { const o = {}; for (const k of AD_IMG_KEYS) o[k] = round5((st.adImages && st.adImages[k]) || 0); return o; };
const IMG_KEYS = ['imagesSeen', 'imagesContextless', 'imagesContextlessUndecided'];
const imagesReport = st => { const o = {}; for (const k of IMG_KEYS) o[k] = round5((st.images && st.images[k]) || 0); return o; };
function buildReport(st, settings) {
  const counts = {}; for (const [t, o] of Object.entries(st.counts || {})) { counts[t] = {}; for (const [k, n] of Object.entries(o)) counts[t][k] = round5(n); }
  const features = {}; for (const k of ['enabled', 'webEnabled', 'checkAds', 'contextCards', 'markPeople', 'markMeat', 'blurImages', 'hideMeatSections', 'showSwaps', 'showOffers']) features[k] = !!settings[k];
  const sharesClicked = {}; for (const [d, n] of Object.entries(st.shares || {})) if (SHARE_DESTS.includes(d)) sharesClicked[d] = round5(n); // destination type only
  return { v: chrome.runtime.getManifest().version, day: st.day, features, mode: settings.mode, webMode: settings.webMode, sensitivity: settings.sensitivity, searchAssist: settings.searchAssist, counts, reveals: round5(st.reveals || 0), offersShown: round5(st.offersShown || 0), offersClicked: round5(st.offersClicked || 0), sharesClicked, images: imagesReport(st), adImages: adImagesReport(st) };
}
let statsChain = Promise.resolve();
function bumpStats(fn) {
  statsChain = statsChain.then(async () => {
    const { shareStats } = await chrome.storage.sync.get({ shareStats: false }); if (!shareStats) return;
    let { stats } = await chrome.storage.local.get('stats'); stats = stats || { day: today(), counts: {}, reveals: 0 };
    if (stats.day !== today()) { // new day: send yesterday's aggregate, then start fresh
      if (STATS_URL) { const settings = await chrome.storage.sync.get(null); try { await fetch(STATS_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildReport(stats, settings)), credentials: 'omit' }); } catch (e) {} }
      stats = { day: today(), counts: {}, reveals: 0 };
    }
    fn(stats); await chrome.storage.local.set({ stats });
  }).catch(() => {});
}
const tabUrls = {}; // tabId -> top-frame URL (reported by content scripts; no "tabs" permission needed)
const offTabs = new Set(); // tabs whose current page is disabled
// 0.4.57: tab ids that closed recently (bounded), so late async work for them is skipped; every tab-scoped call goes
// through VeganBadge.safeTabCall (reads runtime.lastError / catches rejections) because a tab can still vanish mid-call.
const closedTabs = new Set();
const tabGone = tabId => closedTabs.has(tabId);
const tabCall = (api, name, ...args) => api && typeof api[name] === 'function' ? VeganBadge.safeTabCall(api[name].bind(api), ...args) : Promise.resolve(null);
async function setCounts(tabId, counts) {
  if (tabGone(tabId)) return;
  if (offTabs.has(tabId)) counts = empty(); // badge stays clear on disabled pages
  await chrome.storage.session.set({ [key(tabId)]: counts });
  if (tabGone(tabId)) { chrome.storage.session.remove(key(tabId)).catch(() => {}); return; }
  const b = VeganBadge.computeBadge(counts, { allClear: allClearOn });
  tabCall(chrome.action, 'setBadgeText', { tabId, text: b.text });
  tabCall(chrome.action, 'setBadgeBackgroundColor', { tabId, color: b.color });
  tabCall(chrome.action, 'setTitle', { tabId, title: b.title || 'Vegan Lens' });
}
// Each frame/script reports its own totals; store per source and sum.
const sources = {}; // tabId -> {source: counts}
function merge(tabId) { const s = sources[tabId] || {}; const t = empty(); for (const c of Object.values(s)) for (const k in t) t[k] += c[k] | 0; return t; }

function setIconState(tabId, disabled) {
  if (disabled) offTabs.add(tabId); else offTabs.delete(tabId);
  if (tabGone(tabId)) return;
  tabCall(chrome.action, 'setIcon', { tabId, path: VeganPage.iconPaths(disabled) });
  if (disabled) { delete sources[tabId]; setCounts(tabId, empty()); }
}
const getBlocks = () => chrome.storage.sync.get({ pageBlock: [], siteBlock: [] });
async function refreshTab(tabId) {
  const url = tabUrls[tabId]; if (!url) return;
  setIconState(tabId, VeganPage.isDisabled(await getBlocks(), url));
}
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && (ch.pageBlock || ch.siteBlock)) for (const id in tabUrls) refreshTab(+id);
  if (area === 'sync' && ch.allClear) { allClearOn = ch.allClear.newValue !== false; for (const id in sources) setCounts(+id, merge(+id)); }
});

// ---- all-time non-vegan total (service-worker safe: peaks in session, total in local, batched) ----
let pending = 0, flushT = null, chain = Promise.resolve();
const pk = id => 'peak:' + id;
function flush() {
  flushT = null; const d = pending; pending = 0; if (!d) return;
  chain = chain.then(async () => { const { allTime } = await chrome.storage.local.get('allTime');
    await chrome.storage.local.set({ allTime: VeganTotal.addToTotal(allTime, d, Date.now()) }); }).catch(() => {});
}
function trackTotal(tabId, url, src, counts) {
  chain = chain.then(async () => {
    const r = await chrome.storage.session.get(pk(tabId));
    const { tab, delta } = VeganTotal.applyReport(r[pk(tabId)], url, src, counts, offTabs.has(tabId));
    await chrome.storage.session.set({ [pk(tabId)]: tab });
    if (delta > 0) { pending += delta; if (!flushT) flushT = setTimeout(flush, 2000); }
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (!msg) return;
  if (msg.type === 'page' && sender.tab && sender.frameId === 0) { tabUrls[sender.tab.id] = msg.url; refreshTab(sender.tab.id); return; }
  // 0.4.31 open-database lookups (Open Food Facts / Open Beauty Facts). Only {db, code | brand+name} is used; toggle 'dbLookups'.
  if (msg.type === 'off-lookup' || msg.type === 'db-lookup') { dbLookup(msg.type === 'off-lookup' ? { db: 'off', code: msg.code } : msg).then(v => send(msg.type === 'off-lookup' ? (v ? v.verdict.replace('maybe', 'unknown') : null) : v), () => send(null)); return true; }
  if (msg.type === 'people') { getPeople().then(send, () => send(null)); return true; }
  if (msg.type === 'coupons') { getCoupons().then(send, () => send([])); return true; }
  if (msg.type === 'cards') { getCards().then(send, () => send(null)); return true; }
  const tabId = sender.tab && sender.tab.id;
  if (msg.type === 'counts' && tabId != null) {
    sources[tabId] = sources[tabId] || {};
    const prev = sources[tabId][msg.source + ':' + sender.frameId] || {}, t = siteType(tabUrls[tabId] || sender.url);
    bumpStats(st => { const o = st.counts[t] = st.counts[t] || {}; for (const [k, n] of Object.entries(msg.counts || {})) { const d = n - (prev[k] || 0); if (d > 0) o[k] = (o[k] || 0) + d; } });
    sources[tabId][msg.source + ':' + sender.frameId] = msg.counts;
    setCounts(tabId, merge(tabId));
    trackTotal(tabId, tabUrls[tabId] || (sender.frameId === 0 && sender.url) || (sender.tab && sender.tab.url) || sender.url, msg.source + ':' + sender.frameId, msg.counts);
  } else if (msg.type === 'tabState' && msg.tabId != null) {
    const c = offTabs.has(msg.tabId) ? empty() : merge(msg.tabId); send({ counts: c, allClear: allClearOn && VeganBadge.isAllClear(c) }); return true;
  } else if (msg.type === 'reset' && tabId != null) {
    delete sources[tabId]; setCounts(tabId, empty());
  } else if (msg.type === 'stat' && msg.k === 'reveal') {
    bumpStats(st => { st.reveals = (st.reveals || 0) + 1; });
  } else if (msg.type === 'stat' && (msg.k === 'offerShown' || msg.k === 'offerClicked')) {
    bumpStats(st => { const k = msg.k === 'offerShown' ? 'offersShown' : 'offersClicked'; st[k] = (st[k] || 0) + 1; }); // counts only: no brand, offer id or URL
  } else if (msg.type === 'stat' && msg.k === 'img') {
    const n = Math.max(0, Math.min(500, msg.n | 0)), c = Math.max(0, Math.min(n, msg.contextless | 0)), u = Math.max(0, Math.min(c, msg.undecided | 0));
    if (n) bumpStats(st => { const a = st.images = st.images || { imagesSeen: 0, imagesContextless: 0, imagesContextlessUndecided: 0 }; a.imagesSeen += n; a.imagesContextless += c; a.imagesContextlessUndecided += u; }); // counts only
  } else if (msg.type === 'stat' && msg.k === 'adImg') {
    bumpStats(st => { const a = st.adImages = st.adImages || { adsSeen: 0, adsWithImages: 0, adsImageTextless: 0, adsTextlessUndecided: 0 }; a.adsSeen++; if (msg.images) a.adsWithImages++; if (msg.images && msg.textless) { a.adsImageTextless++; if (msg.undecided) a.adsTextlessUndecided++; } }); // counts only: no URL, advertiser, text or image
  } else if (msg.type === 'stat' && msg.k === 'share' && SHARE_DESTS.includes(msg.dest)) {
    bumpStats(st => { st.shares = st.shares || {}; st.shares[msg.dest] = (st.shares[msg.dest] || 0) + 1; }); // destination type only: never text or URLs
  } else if (msg.type === 'shareOpen' && msg.item) {
    // 0.4.42: pill share button -> open the popup's share flow on that item; the content script falls back to an in-page menu.
    pendingShare = { item: msg.item, tabId };
    Promise.resolve().then(() => chrome.action.openPopup()).then(() => send({ ok: true }), () => { pendingShare = null; send({ ok: false }); }); return true;
  } else if (msg.type === 'sharePending') {
    const p = pendingShare; pendingShare = null; send(p && p.tabId === msg.tabId ? p.item : null); return true;
  } else if (msg.type === 'previewStats') {
    statsChain.then(async () => { const { stats } = await chrome.storage.local.get('stats'); send({ url: STATS_URL, report: buildReport(stats || { day: today(), counts: {}, reveals: 0 }, await chrome.storage.sync.get(null)) }); }); return true;
  } else if (msg.type === 'getTotal') {
    flush(); chain.then(() => chrome.storage.local.get('allTime')).then(r => send(VeganTotal.addToTotal(r.allTime, 0))); return true;
  } else if (msg.type === 'resetTotal') {
    pending = 0; chain = chain.then(() => chrome.storage.local.set({ allTime: VeganTotal.resetTotal() })).then(() => send(VeganTotal.resetTotal())); return true;
  } else if (msg.type === 'getCounts') {
    chrome.storage.session.get(key(msg.tabId)).then(r => send(r[key(msg.tabId)] || empty())); return true;
  }
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading' && info.url) { delete sources[tabId]; setCounts(tabId, empty()); }
  // New document: back to green until its content script reports a disabled page.
  if (info.status === 'loading') { chrome.storage.session.remove(pk(tabId)); delete tabUrls[tabId]; setIconState(tabId, false); }
  // 0.4.59: Chrome also fires 'loading'+url for same-document (SPA) navigations, e.g. YouTube, after the page's scripts
  // already reported; nothing would re-report, so the badge stayed empty while units were hidden. Ask the tab's scripts
  // to re-send their current counts and page state once the update settles (no-op for a new document).
  if (info.status === 'complete' || (info.status === 'loading' && info.url)) requestRecount(tabId);
});
const recountT = {};
function requestRecount(tabId) {
  clearTimeout(recountT[tabId]);
  recountT[tabId] = setTimeout(() => { delete recountT[tabId]; if (!tabGone(tabId)) tabCall(chrome.tabs, 'sendMessage', tabId, { type: 'recount' }); }, 800);
}
chrome.tabs.onRemoved.addListener(tabId => {
  closedTabs.add(tabId); if (closedTabs.size > 200) closedTabs.delete(closedTabs.values().next().value);
  delete sources[tabId]; delete tabUrls[tabId]; offTabs.delete(tabId); if (pendingShare && pendingShare.tabId === tabId) pendingShare = null;
  chrome.storage.session.remove([key(tabId), pk(tabId)]).catch(() => {});
});
// A replaced tab (prerender/instant navigation swaps the tab id) is gone too.
if (chrome.tabs.onReplaced) chrome.tabs.onReplaced.addListener((added, removed) => { closedTabs.add(removed); delete sources[removed]; delete tabUrls[removed]; offTabs.delete(removed); chrome.storage.session.remove([key(removed), pk(removed)]).catch(() => {}); });

// ---- 0.4.42 share: 'Share with Vegan Lens' context menu on any element; the page's content script resolves the flagged item.
let pendingShare = null;
chrome.runtime.onInstalled.addListener(() => { try { chrome.contextMenus.create({ id: 'vl-share', title: 'Share with Vegan Lens', contexts: ['page', 'link', 'image', 'selection'] }, () => void chrome.runtime.lastError); } catch (e) {} });
if (chrome.contextMenus && chrome.contextMenus.onClicked) chrome.contextMenus.onClicked.addListener((info, tab) => { if (info.menuItemId === 'vl-share' && tab && tab.id != null) tabCall(chrome.tabs, 'sendMessage', tab.id, { type: 'shareContext' }, { frameId: info.frameId || 0 }); });

// 0.4.52 rule-list updates. Off unless the user sets an update URL (Settings > About). Daily via chrome.alarms; plain GET of a
// signed list (no browsing data, no cookies). Verified (Ed25519), schema-checked and newer-than-bundled before it is stored;
// otherwise nothing changes and every context keeps the bundled list.
const RULES_ALARM = 'vl-rules-update';
function rulesCheck() {
  return new Promise(done => chrome.storage.sync.get({ rulesUrl: '' }, async S => {
    const url = String(S.rulesUrl || '').trim();
    const r = await VeganRules.fetchUpdate(url, { save: rec => new Promise(ok => chrome.storage.local.set({ [VeganRules.STORAGE_KEY]: rec }, ok)) });
    chrome.storage.local.set({ vlRulesLastCheck: { at: Date.now(), ok: r.ok, error: r.error || '', listVersion: VeganRules.info().listVersion } }, () => done(r));
  }));
}
try { chrome.alarms.get(RULES_ALARM, a => { if (!a) chrome.alarms.create(RULES_ALARM, { periodInMinutes: 24 * 60, delayInMinutes: 5 }); }); } catch (e) {}
if (chrome.alarms) chrome.alarms.onAlarm.addListener(a => { if (a.name === RULES_ALARM) rulesCheck(); });
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== 'vl-rules-update' || sender.tab) return; // popup only
  rulesCheck().then(reply); return true;
});
