importScripts('classifier.js', 'badge.js', 'pageKey.js', 'total.js');
const empty = () => ({ vegan: 0, nonvegan: 0, unknown: 0, context: 0, ads: 0 });
const key = id => 'tab:' + id;
let cardsP = null;
let peopleP = null;
const getPeople = () => peopleP || (peopleP = fetch(chrome.runtime.getURL('people.json')).then(r => r.json()));
const getCards = () => cardsP || (cardsP = fetch(chrome.runtime.getURL('cards.json')).then(r => r.json()));

const tabUrls = {}; // tabId -> top-frame URL (reported by content scripts; no "tabs" permission needed)
const offTabs = new Set(); // tabs whose current page is disabled
async function setCounts(tabId, counts) {
  if (offTabs.has(tabId)) counts = empty(); // badge stays clear on disabled pages
  await chrome.storage.session.set({ [key(tabId)]: counts });
  const b = VeganBadge.computeBadge(counts);
  chrome.action.setBadgeText({ tabId, text: b.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
}
// Each frame/script reports its own totals; store per source and sum.
const sources = {}; // tabId -> {source: counts}
function merge(tabId) { const s = sources[tabId] || {}; const t = empty(); for (const c of Object.values(s)) for (const k in t) t[k] += c[k] | 0; return t; }

function setIconState(tabId, disabled) {
  if (disabled) offTabs.add(tabId); else offTabs.delete(tabId);
  chrome.action.setIcon({ tabId, path: VeganPage.iconPaths(disabled) }).catch(() => {});
  if (disabled) { delete sources[tabId]; setCounts(tabId, empty()); }
}
const getBlocks = () => chrome.storage.sync.get({ pageBlock: [], siteBlock: [] });
async function refreshTab(tabId) {
  const url = tabUrls[tabId]; if (!url) return;
  setIconState(tabId, VeganPage.isDisabled(await getBlocks(), url));
}
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && (ch.pageBlock || ch.siteBlock)) for (const id in tabUrls) refreshTab(+id);
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
  if (msg.type === 'off-lookup') { VeganClassifier.lookupOpenFoodFacts(msg.code).then(send); return true; }
  if (msg.type === 'people') { getPeople().then(send, () => send(null)); return true; }
  if (msg.type === 'cards') { getCards().then(send, () => send(null)); return true; }
  const tabId = sender.tab && sender.tab.id;
  if (msg.type === 'counts' && tabId != null) {
    sources[tabId] = sources[tabId] || {};
    sources[tabId][msg.source + ':' + sender.frameId] = msg.counts;
    setCounts(tabId, merge(tabId));
    trackTotal(tabId, tabUrls[tabId] || (sender.frameId === 0 && sender.url) || (sender.tab && sender.tab.url) || sender.url, msg.source + ':' + sender.frameId, msg.counts);
  } else if (msg.type === 'reset' && tabId != null) {
    delete sources[tabId]; setCounts(tabId, empty());
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
});
chrome.tabs.onRemoved.addListener(tabId => { delete sources[tabId]; delete tabUrls[tabId]; offTabs.delete(tabId); chrome.storage.session.remove([key(tabId), pk(tabId)]); });
