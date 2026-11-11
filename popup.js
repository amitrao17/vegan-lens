const DEFAULTS = { checkAds: true, enabled: true, mode: 'dim', strictness: 'strict', showSwaps: true, affiliate: true, groceryMode: 'hide', badgeStyle: 'compact',
  webEnabled: true, webMode: 'dim', sensitivity: 'med', siteBlock: [], siteAllow: [], pageBlock: [], webAllowOnly: false, contextCards: true, markPeople: true, markMeat: true, blurImages: true, allClear: true, brandBanners: true, dbLookups: true, ...((typeof VeganOffers !== 'undefined' && VeganOffers.OFFER_DEFAULTS) || { showOffers: true, showExampleOffers: false }), shareStats: false, marketplace: true, hideMeatSections: true, searchAssist: 'suggest', audience: 'vegan', whitelist: [], whitelistDisabled: [], debug: false };
// Firefox for Android opens the popup as its own tab, so the active tab is the popup itself; use the most recently
// used other tab (the page the user came from). Desktop Chrome/Firefox: unchanged (the active tab).
function pageTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const own = t => t && t.url && t.url.startsWith(chrome.runtime.getURL(''));
    if (!own(tab)) return cb(tab);
    chrome.tabs.query({}, tabs => cb((tabs || []).filter(t => !own(t) && t.id !== tab.id).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0]));
  });
}
const SENS = ['low', 'med', 'high'];
const $ = id => document.getElementById(id);
const toList = v => v.split(/[\s,]+/).map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')).filter(Boolean);
const set = o => chrome.storage.sync.set(o);
let host = null;

$('version').textContent = 'v' + chrome.runtime.getManifest().version;
const showTotal = t => { if (!t) return; $('total').textContent = t.count.toLocaleString(); $('since').textContent = t.since ? 'since ' + new Date(t.since).toLocaleDateString() : 'all time'; };
chrome.runtime.sendMessage({ type: 'getTotal' }, showTotal);
$('resetTotal').addEventListener('click', e => { e.preventDefault(); if (confirm('Reset the all-time non-vegan items count?')) chrome.runtime.sendMessage({ type: 'resetTotal' }, showTotal); });

chrome.storage.sync.remove('sortTop'); // 0.4.0: sort-to-top removed; drop any stored value
chrome.storage.sync.get(DEFAULTS, s => {
  for (const k of ['enabled', 'mode', 'strictness', 'showSwaps', 'affiliate', 'groceryMode', 'badgeStyle', 'webEnabled', 'webMode', 'webAllowOnly', 'contextCards', 'markPeople', 'markMeat', 'blurImages', 'allClear', 'brandBanners', 'dbLookups', 'showOffers', 'showExampleOffers', 'shareStats', 'marketplace', 'hideMeatSections', 'searchAssist', 'checkAds', 'debug']) {
    const el = $(k);
    if (el.type === 'checkbox') el.checked = s[k]; else el.value = s[k];
    el.addEventListener('change', () => set({ [k]: el.type === 'checkbox' ? el.checked : el.value }));
  }
  // 0.4.44 audience slider: wording only (strings live in swaps.js AUDIENCE)
  const AUD = (typeof VeganSwaps !== 'undefined' && VeganSwaps.AUDIENCES) || ['vegan', 'flexitarian', 'omni'];
  const aud = $('audience');
  const applyAudience = a => {
    const W = typeof VeganSwaps !== 'undefined' ? VeganSwaps : null; window.VL_AUDIENCE = a;
    const name = W ? W.say(a, 'slider') : a; $('audienceName').textContent = '(' + name + ')'; aud.setAttribute('aria-valuetext', name);
    if (W) { $('totalLabel').textContent = W.say(a, 'totalLabel'); const t = W.say(a, 'tagline'); $('tagline').textContent = t; $('tagline').hidden = !t; }
  };
  aud.value = Math.max(0, AUD.indexOf(s.audience)); applyAudience(AUD[aud.value]);
  aud.addEventListener('input', () => applyAudience(AUD[aud.value]));
  aud.addEventListener('change', () => set({ audience: AUD[aud.value] }));
  const sens = $('sensitivity');
  const showSens = () => $('sensLabel').textContent = '(' + SENS[sens.value] + ')';
  sens.value = SENS.indexOf(s.sensitivity); showSens();
  sens.addEventListener('input', showSens);
  sens.addEventListener('change', () => set({ sensitivity: SENS[sens.value] }));
  for (const k of ['siteBlock', 'siteAllow']) {
    $(k).value = s[k].join('\n');
    $(k).addEventListener('change', () => set({ [k]: toList($(k).value) }));
  }
  renderWhitelist(s);
  $('wlForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('wlInput').value.trim(); if (!VeganBrands.norm(v).trim()) return;
    chrome.storage.sync.get(DEFAULTS, cur => {
      if (!cur.whitelist.some(x => VeganBrands.norm(x) === VeganBrands.norm(v))) cur.whitelist = [...cur.whitelist, v];
      set({ whitelist: cur.whitelist }); $('wlInput').value = ''; renderWhitelist(cur);
    });
  });
  // activeTab grants the current tab's URL when the popup is opened.
  pageTab(tab => {
    if (tab && tab.id != null) chrome.runtime.sendMessage({ type: 'tabState', tabId: tab.id }, r => { const el = $('allClearLine'); if (el && r && r.allClear) el.hidden = false; });
    if (tab) chrome.runtime.sendMessage({ type: 'getCounts', tabId: tab.id }, c => { if (c) for (const k in c) { const e = $('c-' + k); if (e) e.textContent = c[k]; } });
    try { host = new URL(tab.url).hostname.replace(/^www\./, ''); } catch (e) {}
    const pk = tab && VeganPage.pageKey(tab.url), pbox = $('pageOff'), prow = pbox.closest('.page');
    if (!pk) { $('page').textContent = 'n/a'; pbox.disabled = true; }
    else {
      const u = new URL(pk); $('page').textContent = u.hostname.replace(/^www\./, '') + u.pathname; $('page').title = pk;
      const renderPage = list => { const off = list.includes(pk); pbox.checked = off; prow.classList.toggle('off', off); $('h-icon').src = off ? 'icons/icon48-red.png' : 'icons/icon48.png'; };
      renderPage(s.pageBlock);
      pbox.addEventListener('change', () => chrome.storage.sync.get(DEFAULTS, cur => {
        const list = VeganPage.togglePage(cur.pageBlock, tab.url); set({ pageBlock: list }); renderPage(list);
      }));
    }
    const btn = $('toggleSite');
    if (!host || !/^https?:/.test(tab.url)) { $('site').textContent = 'n/a'; btn.disabled = true; return; }
    $('site').textContent = host;
    const render = list => { const on = list.includes(host); btn.textContent = on ? 'Enable on this site' : 'Disable on this site'; btn.classList.toggle('on', on); };
    render(s.siteBlock);
    btn.addEventListener('click', () => chrome.storage.sync.get(DEFAULTS, cur => {
      const list = cur.siteBlock.includes(host) ? cur.siteBlock.filter(d => d !== host) : [...cur.siteBlock, host];
      set({ siteBlock: list }); $('siteBlock').value = list.join('\n'); render(list);
    }));
  });
});

function wlItem(text, btnText, cls, onClick) {
  const li = document.createElement('li'); if (cls) li.className = cls;
  const sp = document.createElement('span'); sp.textContent = text;
  const b = document.createElement('button'); b.type = 'button'; b.textContent = btnText; if (cls === 'off') b.classList.add('on');
  b.addEventListener('click', onClick); li.append(sp, b); return li;
}
function renderWhitelist(s) {
  const u = $('wlUser'); u.innerHTML = '';
  if (!s.whitelist.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No entries yet'; u.append(li); }
  for (const n of s.whitelist) u.append(wlItem(n, 'Remove', '', () => chrome.storage.sync.get(DEFAULTS, cur => {
    cur.whitelist = cur.whitelist.filter(x => x !== n); set({ whitelist: cur.whitelist }); renderWhitelist(cur);
  })));
  const b = $('wlBuiltin'); b.innerHTML = ''; $('wlCount').textContent = VeganBrands.BUILTIN.length;
  const off = new Set(s.whitelistDisabled);
  for (const e of VeganBrands.BUILTIN) {
    const dis = off.has(e.name);
    b.append(wlItem(e.name, dis ? 'Enable' : 'Disable', dis ? 'off' : '', () => chrome.storage.sync.get(DEFAULTS, cur => {
      cur.whitelistDisabled = cur.whitelistDisabled.includes(e.name) ? cur.whitelistDisabled.filter(x => x !== e.name) : [...cur.whitelistDisabled, e.name];
      set({ whitelistDisabled: cur.whitelistDisabled }); renderWhitelist(cur);
    })));
  }
}

// Report a mistake: pre-filled GitHub issue; the user reviews/edits everything before submitting.
$('report').addEventListener('click', () => {
  const body = ['**Site:** ' + (host || '(add the site, or leave blank)'), '**What went wrong:** (e.g. a vegan item was dimmed, or a non-vegan one was missed)', '**Item or title:** ', '', '_Vegan Lens v' + chrome.runtime.getManifest().version + ' · ' + navigator.userAgent.replace(/^.*?(Chrome\/\d+|Edg\/\d+|Firefox\/\d+).*$/, '$1') + '_'].join('\n');
  chrome.tabs.create({ url: 'https://github.com/amitrao17/vegan-lens/issues/new?labels=false-positive&title=' + encodeURIComponent('Mistake on ' + (host || 'a page')) + '&body=' + encodeURIComponent(body) });
});
$('previewStats').addEventListener('click', e => { e.preventDefault();
  chrome.runtime.sendMessage({ type: 'previewStats' }, r => { const p = $('statsPreview'); p.hidden = false; p.textContent = (r && r.url ? 'Sent once a day to ' + r.url : 'Not sent anywhere yet (no stats server configured).') + '\n' + JSON.stringify(r && r.report, null, 1); });
});

// ---- 0.4.42 Share a find: items come from the active tab's content scripts; the message is composed here, on-device.
(function () {
  const SH = typeof VeganShare !== 'undefined' ? VeganShare : null; if (!SH) return;
  let current = null;
  function renderItems(items, pre) {
    const ul = $('shareItems'); ul.innerHTML = '';
    if (!items.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Nothing found on this page to share yet.'; ul.append(li); return; }
    items.slice(0, SH.MAX_ITEMS).forEach(it => {
      const li = document.createElement('li'); const sp = document.createElement('span'); sp.textContent = it.title; sp.title = it.title;
      const sm = document.createElement('small'); sm.textContent = it.verdict; sp.append(sm);
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Share'; b.setAttribute('aria-label', 'Share ' + it.title);
      b.addEventListener('click', () => { [...ul.children].forEach(x => x.classList.remove('sel')); li.classList.add('sel'); compose(it); });
      li.append(sp, b); ul.append(li);
    });
    if (pre) compose(pre);
  }
  function compose(it) {
    current = SH.normItem(it); $('shareCompose').hidden = false; $('shareText').value = SH.buildMessage(current, { audience: window.VL_AUDIENCE || 'vegan' }); $('shareNote').textContent = '';
    const box = $('shareDests'); box.innerHTML = '';
    for (const d of SH.ORDER) {
      if (d === 'native' && !navigator.share) continue;
      const b = document.createElement('button'); b.type = 'button'; b.textContent = SH.DESTS[d].label; b.dataset.dest = d;
      b.addEventListener('click', () => go(d)); box.append(b);
    }
    $('shareText').focus(); $('shareText').setSelectionRange(0, 0); $('shareText').scrollTop = 0;
  }
  async function go(d) {
    const r = SH.destination(d, current, $('shareText').value); if (!r) return;
    chrome.runtime.sendMessage({ type: 'stat', k: 'share', dest: d });
    let note = '';
    if (r.copy) { try { await navigator.clipboard.writeText(r.copy); note = r.note || 'Copied. Paste it into Instagram, Messenger, iMessage or any DM.'; } catch (e) { note = 'Copy failed: select the message and copy it.'; } }
    if (r.native) { try { await navigator.share(r.native); } catch (e) {} }
    if (r.mailto) { const a = document.createElement('a'); a.href = r.mailto; a.click(); }
    if (r.url) chrome.tabs.create({ url: r.url });
    $('shareNote').textContent = note;
  }
  pageTab(tab => {
    if (!tab || tab.id == null) return renderItems([]);
    chrome.runtime.sendMessage({ type: 'sharePending', tabId: tab.id }, pre => {
      if (pre) VL_TABS.select('page', false);
      chrome.tabs.sendMessage(tab.id, { type: 'shareItems' }, { frameId: 0 }, res => {
        void chrome.runtime.lastError;
        const items = (res && res.items) || [];
        renderItems(pre && !items.some(i => i.title === pre.title) ? [pre, ...items] : items, pre);
      });
    });
  });
})();

// 0.4.43 tabs: This page / Settings / About. Last tab is remembered in chrome.storage.local;
// a pending share (pill or right-click) always opens 'This page' without overwriting the saved choice.
var VL_TABS = (() => {
  const ids = ['page', 'settings', 'about'];
  const tab = id => document.getElementById('tab-' + id);
  let pinned = false;
  function select(id, save = true, focus = false) {
    if (!ids.includes(id)) id = 'page';
    for (const t of ids) {
      const on = t === id;
      tab(t).setAttribute('aria-selected', String(on)); tab(t).tabIndex = on ? 0 : -1;
      document.getElementById('panel-' + t).hidden = !on;
    }
    if (focus) tab(id).focus();
    if (!save) pinned = true;
    else { try { chrome.storage.local.set({ popupTab: id }); } catch (e) {} }
  }
  ids.forEach((id, i) => {
    tab(id).addEventListener('click', () => select(id));
    tab(id).addEventListener('keydown', e => {
      const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault(); select(ids[(k + ids.length) % ids.length], true, true);
    });
  });
  try { chrome.storage.local.get({ popupTab: 'page' }, r => { if (!pinned) select((r && r.popupTab) || 'page', false); pinned = false; }); } catch (e) {}
  return { select };
})();
const av = document.getElementById('aboutVersion'); if (av) av.textContent = 'v' + chrome.runtime.getManifest().version;

// 0.4.49: local view of the opt-in image counts (today's, unrounded; collected only while usage stats are on, like every other stat)
function showAdImgStats() {
  const el = $('adImgStats'); if (!el) return;
  chrome.storage.sync.get({ shareStats: false }, ({ shareStats }) => chrome.storage.local.get('stats', ({ stats }) => {
    const i = (stats && stats.images) || null, a = (stats && stats.adImages) || null;
    el.textContent = !shareStats ? 'Image stats: counted only while anonymous usage stats are on.'
      : !i && !a ? 'Images with no description or text: none counted yet today.'
      : 'Images with no description or text: ' + ((i && i.imagesContextless) || 0) + ' of ' + ((i && i.imagesSeen) || 0) + ' (' + ((i && i.imagesContextlessUndecided) || 0) + ' left undecided)'
        + ' (ads: ' + ((a && a.adsImageTextless) || 0) + ' of ' + ((a && a.adsWithImages) || 0) + ' with images had no image description; ' + ((a && a.adsTextlessUndecided) || 0) + ' undecided). Today, on this device.';
  }));
}
showAdImgStats(); if ($('shareStats')) $('shareStats').addEventListener('change', () => setTimeout(showAdImgStats, 100));

// 0.4.52 rule list: version, optional update URL, 'Update now' (disabled and explained while no URL is set).
(function rulesAbout() {
  const R = window.VeganRules, ver = document.getElementById('rulesVersion'), url = document.getElementById('rulesUrl'), btn = document.getElementById('rulesUpdate'), st = document.getElementById('rulesStatus');
  if (!R || !ver || !url || !btn) return;
  const show = () => { const i = R.info(); ver.textContent = i.listVersion + (i.source === 'local' ? ' \u2014 Local edits active' : i.source === 'bundled' ? ' (built-in)' : ' (updated)'); };
  const ed = document.getElementById('editRules'); if (ed) ed.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('rules-editor.html') }));
  const gate = () => { const on = /^https:\/\//i.test(url.value.trim()); btn.disabled = !on; if (!on) st.textContent = url.value.trim() ? 'The update URL must start with https://' : 'Updates are off: no update URL set. The built-in list is used.'; };
  show(); R.onChange(show);
  chrome.storage.sync.get({ rulesUrl: '' }, S => { url.value = S.rulesUrl || ''; gate();
    chrome.storage.local.get({ vlRulesLastCheck: null }, L => { const c = L.vlRulesLastCheck; if (c && url.value) st.textContent = 'Last check ' + new Date(c.at).toLocaleString() + (c.ok ? ': OK' : ': ' + c.error); }); });
  url.addEventListener('change', () => { chrome.storage.sync.set({ rulesUrl: url.value.trim() }); gate(); });
  url.addEventListener('input', gate);
  btn.addEventListener('click', () => { btn.disabled = true; st.textContent = 'Checking…';
    chrome.storage.sync.set({ rulesUrl: url.value.trim() }, () => chrome.runtime.sendMessage({ type: 'vl-rules-update' }, r => {
      st.textContent = !r ? 'Update failed; keeping the current list.' : r.ok ? 'Rule list ' + r.listVersion + (r.note ? ' (' + r.note + ')' : '') : 'Update rejected (' + r.error + '); keeping the current list.'; gate(); show(); })); });
})();

// 0.4.58: affiliate toggle + disclosure + support link. Hidden entirely while the rule list has no tag / URL.
function showMonetization() {
  const SW = typeof VeganSwaps !== 'undefined' ? VeganSwaps : null; if (!SW) return;
  chrome.storage.sync.get({ affiliate: true }, s => {
    const on = SW.affiliateConfigured();
    const row = document.getElementById('affiliateRow'); if (row) row.hidden = !on;
    const d = document.getElementById('affiliateDisclosure');
    if (d) { d.hidden = !SW.affiliateActive(s); d.firstElementChild.textContent = SW.affiliateDisclosure(); }
  });
  const u = SW.supportUrl(), r = document.getElementById('supportRow'), a = document.getElementById('supportLink');
  if (r && a) { r.hidden = !u; if (u) a.href = u; else a.removeAttribute('href'); }
}
showMonetization();
if (typeof Rules !== 'undefined' && Rules.onChange) Rules.onChange(showMonetization);
chrome.storage.onChanged.addListener(c => { if (c.affiliate) showMonetization(); });
